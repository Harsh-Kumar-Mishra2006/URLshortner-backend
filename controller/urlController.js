// controller/urlController.js - UPDATED
const Url = require('../models/Url');
const generateShortId = require('../utils/generateShortId');
const { urlSchema, analyticsSchema } = require('../utils/validators');

class UrlController {
  // Shorten URL
  async shortenUrl(req, res) {
    try {
      const { error, value } = urlSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const { originalUrl, customId, expiresIn } = value; // No userId
      
      // Check if custom ID already exists
      if (customId) {
        const existingUrl = await Url.findOne({ shortId: customId });
        if (existingUrl) {
          return res.status(409).json({
            success: false,
            error: 'Custom ID already in use'
          });
        }
      }

      const shortId = customId || generateShortId();
      const shortUrl = `${process.env.BASE_URL}/${shortId}`;
      
      let expiresAt = null;
      if (expiresIn) {
        expiresAt = new Date(Date.now() + expiresIn * 1000);
      }

      const url = new Url({
        originalUrl,
        shortId,
        shortUrl,
        isCustom: !!customId,
        expiresAt
        // No userId
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
      res.status(500).json({
        success: false,
        error: 'Server error'
      });
    }
  }

  // Redirect to original URL - FIXED (removed next parameter issue)
  async redirectUrl(req, res) {
    try {
      const { shortId } = req.params;
      
      // Skip if shortId is reserved path
      const reservedPaths = ['api', 'health', 'favicon.ico', 'robots.txt'];
      if (reservedPaths.includes(shortId)) {
        return res.status(404).json({
          success: false,
          error: 'Not found'
        });
      }
      
      const url = await Url.findOneAndUpdate(
        { shortId, isActive: true },
        { 
          $inc: { clicks: 1 },
          $push: {
            clickData: {
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
              referrer: req.get('Referer') || 'Direct'
            }
          }
        },
        { new: true }
      );

      if (!url) {
        return res.status(404).json({
          success: false,
          error: 'URL not found or expired'
        });
      }

      // Check if URL has expired
      if (url.expiresAt && url.expiresAt < new Date()) {
        url.isActive = false;
        await url.save();
        return res.status(410).json({
          success: false,
          error: 'URL has expired'
        });
      }

      res.redirect(url.originalUrl);
    } catch (error) {
      console.error('Redirect error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error'
      });
    }
  }

  // Get URL analytics
  async getUrlAnalytics(req, res) {
    try {
      const { shortId } = req.params;
      const { error, value } = analyticsSchema.validate(req.query);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const { startDate, endDate, page, limit } = value;
      const skip = (page - 1) * limit;

      const url = await Url.findOne({ shortId });
      
      if (!url) {
        return res.status(404).json({
          success: false,
          error: 'URL not found'
        });
      }

      // Filter click data by date range
      let filteredClicks = url.clickData;
      if (startDate || endDate) {
        filteredClicks = url.clickData.filter(click => {
          const clickDate = new Date(click.timestamp);
          return (!startDate || clickDate >= new Date(startDate)) &&
                 (!endDate || clickDate <= new Date(endDate));
        });
      }

      const totalClicks = filteredClicks.length;
      const clicks = filteredClicks
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(skip, skip + limit);

      res.json({
        success: true,
        data: {
          originalUrl: url.originalUrl,
          shortUrl: url.shortUrl,
          shortId: url.shortId,
          totalClicks: url.clicks,
          clicksInRange: totalClicks,
          clicks: clicks,
          createdAt: url.createdAt,
          lastClicked: url.clickData.length > 0 ? 
            url.clickData[url.clickData.length - 1].timestamp : null,
          isActive: url.isActive,
          expiresAt: url.expiresAt
        },
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(totalClicks / limit),
          totalClicksInRange: totalClicks
        }
      });
    } catch (error) {
      console.error('Analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error'
      });
    }
  }

  // Remove getUserUrls method entirely since we don't have users
  // Remove deactivateUrl and deleteUrl methods (or keep them public)

  // Deactivate URL (public - anyone can deactivate any URL)
  async deactivateUrl(req, res) {
    try {
      const { shortId } = req.params;

      const url = await Url.findOneAndUpdate(
        { shortId },
        { isActive: false },
        { new: true }
      );

      if (!url) {
        return res.status(404).json({
          success: false,
          error: 'URL not found'
        });
      }

      res.json({
        success: true,
        message: 'URL deactivated successfully',
        data: url
      });
    } catch (error) {
      console.error('Deactivate error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error'
      });
    }
  }

  // Delete URL (public - anyone can delete any URL)
  async deleteUrl(req, res) {
    try {
      const { shortId } = req.params;

      const url = await Url.findOneAndDelete({ shortId });

      if (!url) {
        return res.status(404).json({
          success: false,
          error: 'URL not found'
        });
      }

      res.json({
        success: true,
        message: 'URL deleted successfully'
      });
    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error'
      });
    }
  }
}

module.exports = new UrlController();