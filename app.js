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
  'https://urlshortner-frontend-lkyq.onrender.com', // Your deployed frontend
  'http://localhost:3001', // Local development
  'http://localhost:3000'  // Common React localhost port
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all origins in development
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Check if the origin is allowed
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      const msg = `The CORS policy for this site does not allow access from ${origin}`;
      console.warn('CORS blocked:', origin);
      return callback(new Error(msg), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
}));

// Handle preflight requests
app.options('*', cors());

// 4. Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. Logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  console.log('Origin:', req.headers.origin);
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
    uptime: process.uptime(),
    cors: {
      allowedOrigins: allowedOrigins
    }
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
    },
    note: 'Make sure your frontend is using the correct backend URL'
  });
});

// 9. Redirect route (MUST be last route before 404)
app.get('/:shortId', urlController.redirectUrl);

// 10. 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    availableEndpoints: {
      api: '/api/url/*',
      redirect: '/:shortId',
      health: '/health'
    }
  });
});

// 11. Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  
  // Handle CORS errors specifically
  if (err.message.includes('CORS policy')) {
    return res.status(403).json({
      success: false,
      error: 'CORS Error',
      message: err.message,
      allowedOrigins: allowedOrigins,
      yourOrigin: req.headers.origin,
      tip: 'Ensure your frontend URL is in the allowedOrigins array'
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ Deployed at: https://urlshortner-backend-afvd.onrender.com`);
  console.log(`✅ Frontend URL: https://urlshortner-frontend-lkyq.onrender.com`);
  console.log(`✅ Allowed origins: ${allowedOrigins.join(', ')}`);
});

module.exports = app;