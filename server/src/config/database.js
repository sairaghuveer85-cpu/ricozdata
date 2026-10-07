import mongoose from 'mongoose';
import config from './env.js';
import logger from '../utils/logger.js';

/**
 * Sanitizes a MongoDB connection URI to mask credentials before logging.
 */
export function sanitizeMongoUri(uri) {
  try {
    return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
  } catch {
    return 'mongodb://***';
  }
}

/**
 * Maps Mongoose readyState numbers to human-readable strings.
 */
const READY_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

/**
 * Retrieves the current real-time database connection status.
 */
export function getDatabaseStatus() {
  const readyState = mongoose.connection.readyState;
  return {
    state: READY_STATES[readyState] || 'unknown',
    readyState,
    isConnected: readyState === 1,
    host: mongoose.connection.host || null,
    port: mongoose.connection.port || null,
    name: mongoose.connection.name || null
  };
}

let isEventListenersRegistered = false;

function registerConnectionEvents() {
  if (isEventListenersRegistered) return;

  mongoose.connection.on('connected', () => {
    logger.info(`[MongoDB] Connected to database "${mongoose.connection.name}" at ${mongoose.connection.host}:${mongoose.connection.port}`);
  });

  mongoose.connection.on('error', (err) => {
    logger.error(`[MongoDB] Connection error event: ${err.message}`, err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('[MongoDB] Connection lost. Disconnected from database.');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('[MongoDB] Reconnected to database.');
  });

  isEventListenersRegistered = true;
}

/**
 * Connects to MongoDB with centralized configuration and diagnostics.
 * @throws {Error} If connection fails after timeout or network error.
 */
export async function connectDB(customUri = null, customOptions = {}) {
  const targetUri = customUri || config.mongo.uri;
  const targetOptions = {
    ...config.mongo.options,
    ...customOptions
  };

  registerConnectionEvents();

  const sanitizedUri = sanitizeMongoUri(targetUri);
  logger.info(`[MongoDB] Attempting connection to: ${sanitizedUri}`);

  try {
    const conn = await mongoose.connect(targetUri, targetOptions);
    logger.info(`[MongoDB] Connection successfully established to ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    if (targetUri.includes('localhost') && (error.name === 'MongoServerSelectionError' || error.name === 'MongooseServerSelectionError' || error.code === 'ECONNREFUSED')) {
      const fallbackUri = targetUri.replace('localhost', '127.0.0.1');
      logger.warn(`[MongoDB] Initial connection to ${sanitizedUri} failed. Attempting IPv4 fallback with ${sanitizeMongoUri(fallbackUri)}...`);
      try {
        const conn = await mongoose.connect(fallbackUri, targetOptions);
        logger.info(`[MongoDB] Connection successfully established via IPv4 fallback to ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);
        return conn;
      } catch (fallbackError) {
        logger.error(`[MongoDB] IPv4 fallback also failed: ${fallbackError.message}`);
      }
    }

    let diagnosticAdvice = '';

    if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
      diagnosticAdvice = `MongoDB server is not reachable at ${sanitizedUri}. Ensure that the MongoDB service (mongod) is running locally or check network connectivity and firewall rules.`;
    } else if (error.name === 'MongoServerSelectionError' || error.name === 'MongooseServerSelectionError') {
      diagnosticAdvice = `Failed to select a MongoDB server within selection timeout (${targetOptions.serverSelectionTimeoutMS || 5000}ms). Verify that the database host is up and accessible.`;
    } else if (error.message.includes('Authentication failed')) {
      diagnosticAdvice = `Authentication failed. Verify credentials in MONGO_URI.`;
    }

    logger.error(`[MongoDB] Connection Failure: ${error.message}`, {
      uri: sanitizedUri,
      errorCode: error.code,
      errorName: error.name,
      diagnosticAdvice
    });

    throw error;
  }
}

/**
 * Gracefully disconnects from MongoDB.
 */
export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    logger.info('[MongoDB] Closing database connection...');
    await mongoose.disconnect();
    logger.info('[MongoDB] Database connection closed.');
  }
}

export default {
  connectDB,
  disconnectDB,
  getDatabaseStatus,
  sanitizeMongoUri
};
