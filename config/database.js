// config/db.js - CORRECTED FOR MONGOOSE v6+
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // For Mongoose v6+, remove useNewUrlParser and useUnifiedTopology
    // They are now enabled by default and cannot be disabled
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`✅ Database: ${conn.connection.name}`);
    
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

// Event listeners for connection
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error(`❌ Mongoose connection error: ${err}`);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  Mongoose disconnected from MongoDB');
});

module.exports = connectDB;