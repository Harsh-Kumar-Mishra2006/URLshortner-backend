//app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const urlRoutes = require('./routes/urlRoutes');
const urlController = require('./controller/urlController');
const connectDB = require('./config/database');

const app = express();

//  Connecting to DB
connectDB();

//  Helmet security
app.use(helmet());

//  CORS 
const allowedOrigins = [
  'https://urlshortner-frontend-lkyq.onrender.com',
  'http://localhost:3000'
];

// Configuring CORS properly
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (process.env.NODE_ENV === 'development' || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.warn('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

app.use(cors(corsOptions));

//  Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//  Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin || 'No origin'} - ${new Date().toISOString()}`);
  next();
});

//  Routes
app.use('/api/url', urlRoutes);

//  Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    backendUrl: 'https://urlshortner-backend-afvd.onrender.com',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    allowedOrigins: allowedOrigins
  });
});

//  Root endpoint
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
    },
    note: 'CORS is configured to allow requests from the frontend URL'
  });
});

//  Redirect route
app.get('/:shortId', urlController.redirectUrl);

//  404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'POST /api/url/shorten',
      'GET /:shortId',
      'GET /api/url/analytics/:shortId',
      'PATCH /api/url/deactivate/:shortId',
      'DELETE /api/url/delete/:shortId'
    ]
  });
});

//  Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  
  // Handling CORS errors
  if (err.message.includes('CORS') || err.message.includes('Not allowed by CORS')) {
    return res.status(403).json({
      success: false,
      error: 'CORS Error',
      message: 'Cross-Origin Request Blocked',
      allowedOrigins: allowedOrigins,
      yourOrigin: req.headers.origin,
      tip: 'Your frontend URL must be in the allowedOrigins array'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` Server is running on port ${PORT}`);
  console.log(` Backend URL: https://urlshortner-backend-afvd.onrender.com`);
  console.log(` Allowed CORS origins: ${allowedOrigins.join(', ')}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(` Health check: https://urlshortner-backend-afvd.onrender.com/health`);
});

module.exports = app;