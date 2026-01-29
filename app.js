// app.js - COMPLETE FIXED VERSION
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const urlRoutes = require('./routes/urlRoutes');
const urlController = require('./controller/urlController');
const connectDB = require('./config/database');

const app = express();

// 1. Connect to DB
connectDB();

// 2. Helmet security
app.use(helmet());

// 3. CORS - Configure properly
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 4. Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. Logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// 6. Routes
app.use('/api/url', urlRoutes);

// 7. Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 8. Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'URL Shortener API',
    version: '1.0.0',
    endpoints: {
      shorten: 'POST /api/url/shorten',
      analytics: 'GET /api/url/analytics/:shortId',
      deactivate: 'PATCH /api/url/deactivate/:shortId',
      delete: 'DELETE /api/url/delete/:shortId',
      health: 'GET /health'
    }
  });
});

// 9. Redirect route (MUST be last route before 404)
app.get('/:shortId', urlController.redirectUrl);

// 10. 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// 11. Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

module.exports = app;