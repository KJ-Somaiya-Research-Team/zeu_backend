// db.js
// MongoDB connection logic
const { MongoClient } = require('mongodb');

let db = null;
let client = null;

const connectDB = async () => {
  if (db) return db;

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
  if (!uri || uri.startsWith('postgresql')) {
    console.warn('MONGO_URI / MONGODB_URI not set — falling back to in-memory store');
    return null;
  }

  try {
    client = new MongoClient(uri);
    await client.connect();
    
    // Automatically use the database specified in the URI, or 'zeu_db'
    db = client.db(); 
    
    // Create indexes for performance
    await db.collection('messages').createIndex({ sessionId: 1 });
    await db.collection('tickets').createIndex({ status: 1 });
    await db.collection('tickets').createIndex({ sessionId: 1 });
    await db.collection('research_events').createIndex({ eventType: 1 });

    console.log('✅ MongoDB connected');
    return db;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    db = null;
    return null;
  }
};

const getDB = () => db;

module.exports = { connectDB, getDB };
