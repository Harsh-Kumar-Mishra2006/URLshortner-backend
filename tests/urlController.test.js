// tests/urlController.test.js
jest.mock('../models/Url');
jest.mock('../utils/generateShortId');

const Url = require('../models/Url');
const generateShortId = require('../utils/generateShortId');
const {
  shortenUrl,
  redirectUrl,
  getUrlAnalytics,
  deactivateUrl,
  deleteUrl
} = require('../controller/urlController');

// ---- helpers ----
const mockReq = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  ip: '1.2.3.4',
  get: jest.fn().mockReturnValue(undefined),
  ...overrides
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
};

// Save helpers on Url model — the controller does `new Url(...).save()`
const buildUrlDoc = (overrides = {}) => ({
  _id: 'abc',
  originalUrl: 'https://example.com',
  shortId: 'abcd123',
  shortUrl: 'http://localhost:3000/abcd123',
  clicks: 0,
  clickData: [],
  isActive: true,
  expiresAt: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  save: jest.fn().mockResolvedValue(true),
  ...overrides
});

beforeEach(() => {
  jest.resetAllMocks();
  // `new Url(doc)` must return an object whose .save() resolves
  Url.mockImplementation(function (doc) {
    Object.assign(this, buildUrlDoc(doc));
    this.save = jest.fn().mockResolvedValue(true);
  });
  generateShortId.mockReturnValue('gen123');
});

// ---------------------------------------------------------------------------
describe('shortenUrl', () => {
  test('returns 400 when body is invalid', async () => {
    const req = mockReq({ body: { originalUrl: 'not a url' } });
    const res = mockRes();
    await shortenUrl(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });

  test('returns 409 when customId already exists', async () => {
    Url.findOne = jest.fn().mockResolvedValue(buildUrlDoc());
    const req = mockReq({
      body: { originalUrl: 'https://example.com', customId: 'taken' }
    });
    const res = mockRes();
    await shortenUrl(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toMatch(/already in use/i);
  });

  test('creates URL with generated shortId (no customId)', async () => {
    Url.findOne = jest.fn();
    const req = mockReq({ body: { originalUrl: 'https://example.com' } });
    const res = mockRes();
    await shortenUrl(req, res);

    expect(Url.findOne).not.toHaveBeenCalled();
    expect(generateShortId).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.shortId).toBe('gen123');
    expect(body.data.shortUrl).toBe('http://localhost:3000/gen123');
  });

  test('creates URL with customId', async () => {
    Url.findOne = jest.fn().mockResolvedValue(null);
    const req = mockReq({
      body: { originalUrl: 'https://example.com', customId: 'mine' }
    });
    const res = mockRes();
    await shortenUrl(req, res);

    expect(Url.findOne).toHaveBeenCalledWith({ shortId: 'mine' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].data.shortId).toBe('mine');
  });

  test('sets expiresAt when expiresIn provided', async () => {
    Url.findOne = jest.fn();
    const now = Date.now();
    const req = mockReq({
      body: { originalUrl: 'https://example.com', expiresIn: 60 }
    });
    const res = mockRes();

    await shortenUrl(req, res);

    // new Url() was called — grab the constructed doc from mock instance
    const constructed = Url.mock.instances[0];
    expect(constructed.expiresAt).toBeInstanceOf(Date);
    const delta = constructed.expiresAt.getTime() - now;
    expect(delta).toBeGreaterThanOrEqual(59_000);
    expect(delta).toBeLessThanOrEqual(61_000);
  });

  test('returns 409 on Mongo duplicate-key race (code 11000)', async () => {
    Url.findOne = jest.fn().mockResolvedValue(null);
    Url.mockImplementation(function (doc) {
      Object.assign(this, buildUrlDoc(doc));
      this.save = jest.fn().mockRejectedValue(Object.assign(
        new Error('duplicate'), { code: 11000 }
      ));
    });
    const req = mockReq({
      body: { originalUrl: 'https://example.com', customId: 'mine' }
    });
    const res = mockRes();
    await shortenUrl(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('returns 500 on unexpected error', async () => {
    Url.findOne = jest.fn().mockRejectedValue(new Error('boom'));
    const req = mockReq({
      body: { originalUrl: 'https://example.com', customId: 'x123' }
    });
    const res = mockRes();
    await shortenUrl(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ---------------------------------------------------------------------------
describe('redirectUrl', () => {
  test('returns 400 on invalid shortId', async () => {
    const req = mockReq({ params: { shortId: 'a b' } });
    const res = mockRes();
    await redirectUrl(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 for reserved path', async () => {
    const req = mockReq({ params: { shortId: 'api' } });
    const res = mockRes();
    await redirectUrl(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 404 when URL not found', async () => {
    Url.findOne = jest.fn().mockResolvedValue(null);
    const req = mockReq({ params: { shortId: 'abcd123' } });
    const res = mockRes();
    await redirectUrl(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('deactivates and returns 410 when URL is expired', async () => {
    const doc = buildUrlDoc({
      expiresAt: new Date(Date.now() - 60_000),
      isActive: true
    });
    Url.findOne = jest.fn().mockResolvedValue(doc);
    const req = mockReq({ params: { shortId: 'abcd123' } });
    const res = mockRes();

    await redirectUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(doc.isActive).toBe(false);
    expect(doc.save).toHaveBeenCalled();
    expect(Url.updateOne).not.toHaveBeenCalled();
  });

  test('redirects and logs click when valid', async () => {
    Url.findOne = jest.fn().mockResolvedValue(buildUrlDoc());
    Url.updateOne = jest.fn().mockResolvedValue({ acknowledged: true });
    const req = mockReq({
      params: { shortId: 'abcd123' },
      get: jest.fn((h) => (h === 'User-Agent' ? 'jest-agent' : 'https://ref.example'))
    });
    const res = mockRes();

    await redirectUrl(req, res);

    expect(Url.updateOne).toHaveBeenCalledTimes(1);
    const [filter, update] = Url.updateOne.mock.calls[0];
    expect(filter.shortId).toBe('abcd123');
    expect(update.$inc.clicks).toBe(1);
    expect(update.$push.clickData.$each[0]).toMatchObject({
      ipAddress: '1.2.3.4',
      userAgent: 'jest-agent',
      referrer: 'https://ref.example'
    });
    expect(res.redirect).toHaveBeenCalledWith('https://example.com');
  });

  test('sanitizes XSS in userAgent/referrer', async () => {
    Url.findOne = jest.fn().mockResolvedValue(buildUrlDoc());
    Url.updateOne = jest.fn().mockResolvedValue({ acknowledged: true });
    const req = mockReq({
      params: { shortId: 'abcd123' },
      get: jest.fn((h) =>
        h === 'User-Agent'
          ? '<script>alert(1)</script>'
          : '<img src=x onerror=alert(2)>'
      )
    });
    const res = mockRes();

    await redirectUrl(req, res);

    const [, update] = Url.updateOne.mock.calls[0];
    const logged = update.$push.clickData.$each[0];
    expect(logged.userAgent).not.toMatch(/<script>/);
    expect(logged.referrer).not.toMatch(/onerror/);
  });
});

// ---------------------------------------------------------------------------
describe('getUrlAnalytics', () => {
  test('returns 400 on invalid query', async () => {
    const req = mockReq({
      params: { shortId: 'abcd123' },
      query: { limit: 999 }
    });
    const res = mockRes();
    await getUrlAnalytics(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when URL not found', async () => {
    Url.findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    });
    const req = mockReq({
      params: { shortId: 'abcd123' },
      query: {}
    });
    const res = mockRes();
    await getUrlAnalytics(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns paginated clicks with defaults', async () => {
    const clickData = Array.from({ length: 5 }, (_, i) => ({
      timestamp: new Date(2025, 0, i + 1),
      ipAddress: '1.1.1.1',
      userAgent: 'ua',
      referrer: 'r'
    }));
    Url.findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(
        buildUrlDoc({ clickData, clicks: 5 })
      )
    });
    const req = mockReq({ params: { shortId: 'abcd123' }, query: {} });
    const res = mockRes();

    await getUrlAnalytics(req, res);

    expect(res.json).toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.data.totalClicks).toBe(5);
    expect(body.data.clicksInRange).toBe(5);
    expect(body.data.clicks.length).toBe(5);
    // Newest first
    expect(body.data.clicks[0].timestamp).toEqual(new Date(2025, 0, 5));
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(20);
  });

  test('respects page/limit pagination', async () => {
    const clickData = Array.from({ length: 25 }, (_, i) => ({
      timestamp: new Date(2025, 0, i + 1)
    }));
    Url.findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(
        buildUrlDoc({ clickData, clicks: 25 })
      )
    });
    const req = mockReq({
      params: { shortId: 'abcd123' },
      query: { page: '2', limit: '10' }
    });
    const res = mockRes();

    await getUrlAnalytics(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.data.clicks.length).toBe(10);
    expect(body.pagination.page).toBe(2);
    expect(body.pagination.totalPages).toBe(3);
  });

  test('filters clicks by date range', async () => {
    const clickData = [
      { timestamp: new Date('2025-01-01T00:00:00Z') },
      { timestamp: new Date('2025-01-02T00:00:00Z') },
      { timestamp: new Date('2025-01-03T00:00:00Z') }
    ];
    Url.findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(
        buildUrlDoc({ clickData, clicks: 3 })
      )
    });
    const req = mockReq({
      params: { shortId: 'abcd123' },
      query: {
        startDate: '2025-01-02T00:00:00Z',
        endDate: '2025-01-02T23:59:59Z'
      }
    });
    const res = mockRes();
    await getUrlAnalytics(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.clicksInRange).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe('deactivateUrl', () => {
  test('returns 400 on invalid shortId', async () => {
    const req = mockReq({ params: { shortId: 'a' } });
    const res = mockRes();
    await deactivateUrl(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when not found', async () => {
    Url.findOneAndUpdate = jest.fn().mockResolvedValue(null);
    const req = mockReq({ params: { shortId: 'abcd123' } });
    const res = mockRes();
    await deactivateUrl(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('deactivates successfully', async () => {
    const doc = buildUrlDoc({ isActive: false });
    Url.findOneAndUpdate = jest.fn().mockResolvedValue(doc);
    const req = mockReq({ params: { shortId: 'abcd123' } });
    const res = mockRes();
    await deactivateUrl(req, res);
    expect(Url.findOneAndUpdate).toHaveBeenCalledWith(
      { shortId: 'abcd123' },
      { isActive: false },
      { new: true }
    );
    expect(res.json.mock.calls[0][0].success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('deleteUrl', () => {
  test('returns 400 on invalid shortId', async () => {
    const req = mockReq({ params: { shortId: 'has space' } });
    const res = mockRes();
    await deleteUrl(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when not found', async () => {
    Url.findOneAndDelete = jest.fn().mockResolvedValue(null);
    const req = mockReq({ params: { shortId: 'abcd123' } });
    const res = mockRes();
    await deleteUrl(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('deletes successfully', async () => {
    Url.findOneAndDelete = jest.fn().mockResolvedValue(buildUrlDoc());
    const req = mockReq({ params: { shortId: 'abcd123' } });
    const res = mockRes();
    await deleteUrl(req, res);
    expect(res.json.mock.calls[0][0].success).toBe(true);
  });
});