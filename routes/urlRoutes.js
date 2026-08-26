// routes/urlRoutes.js 
const express = require('express');
const router = express.Router();
const {
  shortenUrl,
  getUrlAnalytics,
  deactivateUrl,
  deleteUrl
} = require('../controller/urlController');
const { apiLimiter } = require('../middleware/rateLimiter');

// Applying rate limiting to all routes
router.use(apiLimiter);

// Shorten URL
router.post('/shorten', shortenUrl);

// Get URL analytics
router.get('/analytics/:shortId', getUrlAnalytics);

// Deactivate URL 
router.patch('/deactivate/:shortId', deactivateUrl);

// Delete URL
router.delete('/delete/:shortId', deleteUrl);


module.exports = router;