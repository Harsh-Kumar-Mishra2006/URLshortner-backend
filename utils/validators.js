const Url = require('../models/Url');
const generateShortId = require('../utils/generateShortId');
const {
  urlSchema,
  analyticsSchema,
  shortIdParamSchema,
  sanitizeString
} = require('../utils/validators');

// Helper: respond with validation error
const validationError = (res, message) =>
  res.status(400).json({ success: false, error: message });

// Helper: validate shortId param
const validateShortId = (req, res) => {
  const { error, value } = shortIdParamSchema.validate(req.params);
  if (error) {
    res.status(400).json({ success: false, error: error.details[0].message });
    return null;
  }
  return value.shortId;
};

// Helper: ensure BASE_URL is set
const getBaseUrl = () => {
  const base = process.env.BASE_URL;
  if (!base) throw new Error('BASE_URL environment variable is not set');
  return base.replace(/\/+$/, ''); // strip trailing slashes
};

// ---------------- Shorten URL ----------------
const shortenUrl = async (req, res) => {
  try {
    const { error, value } = urlSchema.validate(req.body, {
      abortEarly: true,
      stripUnknown: true
    });
    if (error) return validationError(res, error.details[0].message);

    const { originalUrl, customId, expiresIn } = value;

    if (customId) {
      const existingUrl = await Url.findOne({ shortId: customId }).lean();
      if (existingUrl) {
        return res.status(409).json({ success: false, error: 'Custom ID already in use' });
      }
    }

    const shortId = customId || generateShortId();
    const shortUrl = `${getBaseUrl()}/${shortId}`;

    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    const url = new Url({
      originalUrl,
      shortId,
      shortUrl,
      isCustom: !!customId,
      expiresAt
    });

    await url.save();

    res.status(201).json({
      success: true,
      data: {
        originalUrl,
        shortUrl,
        shortId,
        expiresAt: url.expiresAt,
        createdAt: url.createdAt
      }
    });
  } catch (error) {
    console.error('Shorten URL error:', error);
    // Handle Mongo duplicate key race (custom ID taken between check & save)
    if (error.code === 11000) {
      return res.status(409).json({ success: false, error: 'Custom ID already in use' });
    }
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// ---------------- Redirect ----------------
const redirectUrl = async (req, res) => {
  try {
    const shortId = validateShortId(req, res);
    if (!shortId) return;

    const reservedPaths = ['api', 'health', 'favicon.ico', 'robots.txt'];
    if (reservedPaths.includes(shortId)) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    // First, find the URL (no update yet) so we can check expiry before counting a click
    const url = await Url.findOne({ shortId, isActive: true });
    if (!url) {
      return res.status(404).json({ success: false, error: 'URL not found or expired' });
    }

    // Expired? Deactivate and refuse
    if (url.expiresAt && url.expiresAt < new Date()) {
      url.isActive = false;
      await url.save();
      return res.status(410).json({ success: false, error: 'URL has expired' });
    }

    // Sanitize redirect logging fields
    const ipAddress = (req.ip || '').slice(0, 64);
    const userAgent = sanitizeString(req.get('User-Agent') || '').slice(0, 512);
    const referrer = sanitizeString(req.get('Referer') || 'Direct').slice(0, 512);

    // Atomically increment + log, only if still active & not expired
    await Url.updateOne(
      {
        shortId,
        isActive: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
      },
      {
        $inc: { clicks: 1 },
        $push: {
          clickData: {
            $each: [{ ipAddress, userAgent, referrer }],
            $slice: -1000 // keep last 1000 entries to bound doc size
          }
        }
      }
    );

    return res.redirect(url.originalUrl);
  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// ---------------- Analytics ----------------
const getUrlAnalytics = async (req, res) => {
  try {
    const shortId = validateShortId(req, res);
    if (!shortId) return;

    const { error, value } = analyticsSchema.validate(req.query, {
      abortEarly: true,
      stripUnknown: true,
      convert: true
    });
    if (error) return validationError(res, error.details[0].message);

    const { startDate, endDate, page, limit } = value;
    const skip = (page - 1) * limit;

    const url = await Url.findOne({ shortId }).lean();
    if (!url) {
      return res.status(404).json({ success: false, error: 'URL not found' });
    }

    let filteredClicks = url.clickData || [];
    if (startDate || endDate) {
      filteredClicks = filteredClicks.filter((click) => {
        const t = new Date(click.timestamp).getTime();
        return (
          (!startDate || t >= new Date(startDate).getTime()) &&
          (!endDate || t <= new Date(endDate).getTime())
        );
      });
    }

    const totalClicks = filteredClicks.length;
    const clicks = filteredClicks
      .slice()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(skip, skip + limit);

    // Safe last-click timestamp
    const lastClicked =
      url.clickData && url.clickData.length > 0
        ? url.clickData
            .reduce((max, c) => (c.timestamp > max ? c.timestamp : max), url.clickData[0].timestamp)
        : null;

    res.json({
      success: true,
      data: {
        originalUrl: url.originalUrl,
        shortUrl: url.shortUrl,
        shortId: url.shortId,
        totalClicks: url.clicks,
        clicksInRange: totalClicks,
        clicks,
        createdAt: url.createdAt,
        lastClicked,
        isActive: url.isActive,
        expiresAt: url.expiresAt
      },
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalClicks / limit) || 0,
        totalClicksInRange: totalClicks
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// ---------------- Deactivate ----------------
const deactivateUrl = async (req, res) => {
  try {
    const shortId = validateShortId(req, res);
    if (!shortId) return;

    const url = await Url.findOneAndUpdate(
      { shortId },
      { isActive: false },
      { new: true }
    );

    if (!url) {
      return res.status(404).json({ success: false, error: 'URL not found' });
    }

    res.json({
      success: true,
      message: 'URL deactivated successfully',
      data: url
    });
  } catch (error) {
    console.error('Deactivate error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// ---------------- Delete ----------------
const deleteUrl = async (req, res) => {
  try {
    const shortId = validateShortId(req, res);
    if (!shortId) return;

    const url = await Url.findOneAndDelete({ shortId });

    if (!url) {
      return res.status(404).json({ success: false, error: 'URL not found' });
    }

    res.json({ success: true, message: 'URL deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

module.exports = { shortenUrl, redirectUrl, getUrlAnalytics, deactivateUrl, deleteUrl };