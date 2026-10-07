const mongoose = require('mongoose');

let mongoServer = null;

/**
 * Connect to MongoDB instance.
 * In production: strictly connects to MONGO_URI (MongoDB Atlas).
 * In development: connects to MONGO_URI or falls back to MongoMemoryServer for offline dev.
 */
const connectDB = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const uri = process.env.MONGO_URI || (isProduction ? null : 'mongodb://127.0.0.1:27017/ricozdata');

  if (isProduction && !process.env.MONGO_URI) {
    const errMsg = 'FATAL: MONGO_URI environment variable is required in production mode.';
    console.error(errMsg);
    throw new Error(errMsg);
  }

  const options = {
    serverSelectionTimeoutMS: isProduction ? 10000 : 2500,
    maxPoolSize: isProduction ? 20 : 10,
    minPoolSize: isProduction ? 2 : 1,
    socketTimeoutMS: 45000,
  };

  try {
    const conn = await mongoose.connect(uri, options);
    console.log(`MongoDB connected`);
    console.log(`Database Host: ${conn.connection.host}`);
    console.log(`Database Name: ${conn.connection.name}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    return conn;
  } catch (error) {
    if (isProduction) {
      console.error(`MongoDB Atlas connection error: ${error.message}`);
      throw error;
    }

    console.warn(`Local MongoDB connection failed (${error.message}). Initializing embedded development database...`);
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongoServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'ricozdata',
        },
      });
      const memoryUri = mongoServer.getUri();
      const conn = await mongoose.connect(memoryUri);
      console.log(`Embedded MongoDB connected: ${conn.connection.host}`);
      console.log(`Database Name: ${conn.connection.name}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'} (Embedded In-Memory)`);
      return conn;
    } catch (memError) {
      console.error('Error starting embedded development MongoDB:', memError.message);
      throw memError;
    }
  }
};

module.exports = connectDB;
module.exports.getMongoUri = () => {
  if (mongoServer) return mongoServer.getUri();
  return process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ricozdata';
};
