// tests/models/Url.test.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Url = require('../../models/Url');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await Url.deleteMany({});
});

const validDoc = {
  originalUrl: 'https://example.com',
  shortId: 'abcd123',
  shortUrl: 'http://localhost:3000/abcd123'
};

describe('Url model validation', () => {
  test('persists a valid doc', async () => {
    const url = await Url.create(validDoc);
    expect(url._id).toBeDefined();
    expect(url.clicks).toBe(0);
    expect(url.isActive).toBe(true);
    expect(url.isCustom).toBe(false);
    expect(url.expiresAt).toBeNull();
    expect(url.createdAt).toBeInstanceOf(Date);
    expect(url.updatedAt).toBeInstanceOf(Date);
  });

  test('requires originalUrl', async () => {
    await expect(Url.create({ ...validDoc, originalUrl: undefined }))
      .rejects.toThrow(/originalUrl/);
  });

  test('rejects originalUrl over 2048 chars', async () => {
    await expect(
      Url.create({ ...validDoc, originalUrl: 'https://a.io/' + 'a'.repeat(2100) })
    ).rejects.toThrow(/maximum allowed length|maxlength/i);
  });

  test('rejects originalUrl without http(s) protocol', async () => {
    await expect(
      Url.create({ ...validDoc, originalUrl: 'example.com' })
    ).rejects.toThrow(/must start with http/i);
  });

  test('enforces unique shortId', async () => {
    await Url.create(validDoc);
    await expect(Url.create(validDoc)).rejects.toThrow(/duplicate key/i);
  });

  test.each(['ab', 'a'.repeat(21), 'has space', 'has.dot'])(
    'rejects bad shortId: %s',
    async (shortId) => {
      await expect(Url.create({ ...validDoc, shortId })).rejects.toThrow();
    }
  );

  test('defaults clickData entries correctly', async () => {
    const doc = await Url.create(validDoc);
    doc.clickData.push({ ipAddress: '1.1.1.1', userAgent: 'ua', referrer: 'r' });
    await doc.save();
    const fresh = await Url.findById(doc._id);
    expect(fresh.clickData[0].timestamp).toBeInstanceOf(Date);
  });

  test('rejects negative clicks', async () => {
    await expect(
      Url.create({ ...validDoc, clicks: -1 })
    ).rejects.toThrow();
  });
});