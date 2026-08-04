const mongoose = require('mongoose');

const connectDB = async () => {
  let uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️ MONGODB_URI not provided. Running in memory mode.');
    return;
  }

  // Clean quotes or leading/trailing whitespace if accidentally pasted
  uri = uri.trim().replace(/^["']|["']$/g, '');

  try {
    const conn = await mongoose.connect(uri);
    console.log(`🍃 MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // Print safe sanitized URI structure to help debug formatting issues
    const sanitized = uri.replace(/\/\/(.*):(.*)@/, '//***:***@');
    console.error(`🔍 Received URI format: "${sanitized}"`);
  }
};

module.exports = connectDB;
