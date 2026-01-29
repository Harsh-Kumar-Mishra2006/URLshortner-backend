// routes/urlRoutes.js - UPDATED
const express = require('express');
const router = express.Router();
const urlController = require('../controller/urlController');
const { apiLimiter } = require('../middleware/rateLimiter');

// Apply rate limiting to all routes
router.use(apiLimiter);

// Shorten URL
router.post('/shorten', urlController.shortenUrl);

// Get URL analytics
router.get('/analytics/:shortId', urlController.getUrlAnalytics);

// Deactivate URL (public)
router.patch('/deactivate/:shortId', urlController.deactivateUrl);

// Delete URL (public)
router.delete('/delete/:shortId', urlController.deleteUrl);

// Redirect route will be handled separately in app.js
// router.get('/:shortId', urlController.redirectUrl);

module.exports = router;