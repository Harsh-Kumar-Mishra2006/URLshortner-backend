// server.js 
require('dotenv').config();
const app = require('./app'); 
const connectDB = require('./config/database'); 

const PORT = process.env.PORT || 3000;

// Connect to database
if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    console.log(' Database connected');
  }).catch((err) => {
    console.error(' Database connection error:', err);
    process.exit(1);
  });
}

// Start server
const server = app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
  console.log(` Health check: http://localhost:${PORT}/health`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

module.exports = server;