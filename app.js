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

// 3. CORS - FIXED CONFIGURATION
const allowedOrigins = [
  'https://urlshortner-frontend-lkyq.onrender.com',
  'http://localhost:3001',
  'http://localhost:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      console.warn('CORS blocked:', origin);
      return callback(new Error(`CORS not allowed for ${origin}`), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests - FIXED LINE 49:
// Instead of app.options('*', cors()), handle specific routes or use:
app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

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
    backendUrl: 'https://urlshortner-backend-afvd.onrender.com',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 8. Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'URL Shortener API',
    backendUrl: 'https://urlshortner-backend-afvd.onrender.com',
    frontendUrl: 'https://urlshortner-frontend-lkyq.onrender.com',
    version: '1.0.0',
    endpoints: {
      shorten: 'POST /api/url/shorten',
      redirect: 'GET /:shortId',
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
  console.error('Error:', err.message);
  
  // Handle CORS errors
  if (err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      error: 'CORS Error',
      message: err.message,
      allowedOrigins: allowedOrigins
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Allowed origins: ${allowedOrigins.join(', ')}`);
});

module.exports = app;