// tests/setup.js
process.env.BASE_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';

// Silence expected console.error noise from controllers
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  console.error.mockRestore();
});