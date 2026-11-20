// tests/validators.test.js
const {
  urlSchema,
  analyticsSchema,
  shortIdParamSchema
} = require('../utils/validators');

describe('urlSchema', () => {
  const valid = {
    originalUrl: 'https://example.com/path?q=1',
    customId: 'myLink',
    expiresIn: 3600
  };

  test('accepts a fully-valid payload', () => {
    const { error, value } = urlSchema.validate(valid);
    expect(error).toBeUndefined();
    expect(value.originalUrl).toBe('https://example.com/path?q=1');
    expect(value.customId).toBe('myLink');
    expect(value.expiresIn).toBe(3600);
  });

  test('accepts payload without optional fields', () => {
    const { error } = urlSchema.validate({ originalUrl: 'https://a.io' });
    expect(error).toBeUndefined();
  });

  test('trims whitespace around originalUrl and customId', () => {
    const { value } = urlSchema.validate({
      originalUrl: '  https://example.com  ',
      customId: '  abc123  '
    });
    expect(value.originalUrl).toBe('https://example.com');
    expect(value.customId).toBe('abc123');
  });

  test('rejects missing originalUrl', () => {
    const { error } = urlSchema.validate({});
    expect(error).toBeDefined();
    expect(error.details[0].message).toMatch(/URL is required/i);
  });

  test.each([
    'not a url',
    'ftp://example.com',
    'javascript:alert(1)',
    'example.com',                    // no protocol
    'http://',                        // no host
    'https://' + 'a'.repeat(2050)     // too long
  ])('rejects invalid originalUrl: %s', (url) => {
    const { error } = urlSchema.validate({ originalUrl: url });
    expect(error).toBeDefined();
  });

  test('treats empty-string customId as absent', () => {
    const { error, value } = urlSchema.validate({
      originalUrl: 'https://example.com',
      customId: ''
    });
    expect(error).toBeUndefined();
    expect(value.customId).toBeUndefined();
  });

  test.each(['a', 'ab', 'a'.repeat(21)])(
    'rejects customId of bad length: %s',
    (customId) => {
      const { error } = urlSchema.validate({
        originalUrl: 'https://example.com',
        customId
      });
      expect(error).toBeDefined();
    }
  );

  test.each(['has space', 'has!bang', 'has.slash'])(
    'rejects customId with bad characters: %s',
    (customId) => {
      const { error } = urlSchema.validate({
        originalUrl: 'https://example.com',
        customId
      });
      expect(error).toBeDefined();
    }
  );

  test.each([299, 2592001, 1.5, 'abc'])(
    'rejects out-of-bounds expiresIn: %s',
    (expiresIn) => {
      const { error } = urlSchema.validate({
        originalUrl: 'https://example.com',
        expiresIn
      });
      expect(error).toBeDefined();
    }
  );

  test('accepts expiresIn = null', () => {
    const { error } = urlSchema.validate({
      originalUrl: 'https://example.com',
      expiresIn: null
    });
    expect(error).toBeUndefined();
  });
});

describe('analyticsSchema', () => {
  test('applies defaults for page and limit', () => {
    const { value } = analyticsSchema.validate({});
    expect(value.page).toBe(1);
    expect(value.limit).toBe(20);
  });

  test('coerces numeric strings', () => {
    const { value } = analyticsSchema.validate({ page: '3', limit: '50' });
    expect(value.page).toBe(3);
    expect(value.limit).toBe(50);
  });

  test('rejects startDate after endDate', () => {
    const { error } = analyticsSchema.validate({
      startDate: '2025-01-02T00:00:00.000Z',
      endDate:   '2025-01-01T00:00:00.000Z'
    });
    expect(error).toBeDefined();
    expect(error.details[0].message).toMatch(/before or equal/i);
  });

  test('rejects limit > 100', () => {
    const { error } = analyticsSchema.validate({ limit: 101 });
    expect(error).toBeDefined();
  });

  test('rejects page < 1', () => {
    const { error } = analyticsSchema.validate({ page: 0 });
    expect(error).toBeDefined();
  });
});

describe('shortIdParamSchema', () => {
  test('accepts valid shortId', () => {
    const { error } = shortIdParamSchema.validate({ shortId: 'abc123' });
    expect(error).toBeUndefined();
  });

  test.each(['ab', 'a'.repeat(21), 'has space', 'has.dot', 'has$dollar'])(
    'rejects invalid shortId: %s',
    (shortId) => {
      const { error } = shortIdParamSchema.validate({ shortId });
      expect(error).toBeDefined();
    }
  );

  test('rejects non-string (NoSQL operator injection attempt)', () => {
    const { error } = shortIdParamSchema.validate({ shortId: { $ne: null } });
    expect(error).toBeDefined();
  });
});