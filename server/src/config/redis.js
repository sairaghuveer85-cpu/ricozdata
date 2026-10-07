import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

let redisClient = null;
let isConnected = false;
let connectionAttempted = false;

/**
 * Initializes and configures the Redis connection client.
 * Designed with safe failure handling: if Redis is unreachable,
 * it logs the condition without crashing the application.
 */
export function initRedis(options = {}) {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || null;
  const host = options.host || process.env.REDIS_HOST || '127.0.0.1';
  const port = parseInt(options.port || process.env.REDIS_PORT || '6379', 10);
  const password = options.password || process.env.REDIS_PASSWORD || undefined;

  const redisConfig = redisUrl || {
    host,
    port,
    password,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy(times) {
      if (times > 3) {
        return null; // Stop retrying after 3 attempts to prevent log flooding
      }
      return Math.min(times * 500, 2000);
    }
  };

  try {
    redisClient = new Redis(redisConfig);

    redisClient.on('connect', () => {
      isConnected = true;
      logger.info(`[Redis] Connected successfully to Redis server at ${host}:${port}`);
    });

    redisClient.on('ready', () => {
      isConnected = true;
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      // Do not crash the server on Redis connection error
      if (!connectionAttempted) {
        logger.warn(`[Redis] Redis unavailable at ${host}:${port}: ${err.message}. Operating in resilient fallback mode.`);
      }
    });

    redisClient.on('close', () => {
      isConnected = false;
    });

    redisClient.on('end', () => {
      isConnected = false;
    });

    // Attempt initial connection asynchronously
    connectionAttempted = true;
    redisClient.connect().catch((err) => {
      isConnected = false;
      logger.warn(`[Redis] Initial connection attempt failed: ${err.message}. In-memory fallback active.`);
    });
  } catch (err) {
    isConnected = false;
    logger.warn(`[Redis] Failed to initialize Redis client: ${err.message}`);
  }

  return redisClient;
}

/**
 * Returns the active Redis client, or null if uninitialized.
 */
export function getRedisClient() {
  if (!redisClient && !connectionAttempted) {
    initRedis();
  }
  return redisClient;
}

/**
 * Checks whether Redis is currently connected and responsive.
 */
export function isRedisAvailable() {
  return isConnected && redisClient && redisClient.status === 'ready';
}

/**
 * Operational health check for Redis.
 * Safely measures round-trip latency without exposing credentials.
 */
export async function redisHealthCheck() {
  if (!isRedisAvailable()) {
    return {
      status: 'disconnected',
      available: false,
      message: 'Redis server is not connected; fallback engine active'
    };
  }

  try {
    const start = process.hrtime.bigint();
    await redisClient.ping();
    const end = process.hrtime.bigint();
    const latencyMs = Math.round(Number(end - start) / 1_000_000 * 100) / 100;

    return {
      status: 'connected',
      available: true,
      latencyMs
    };
  } catch (err) {
    return {
      status: 'error',
      available: false,
      message: err.message
    };
  }
}

/**
 * Gracefully terminates Redis connection.
 */
export async function closeRedisConnection() {
  if (redisClient) {
    try {
      if (isConnected) {
        await redisClient.quit();
      } else {
        redisClient.disconnect();
      }
    } catch {
      redisClient.disconnect();
    } finally {
      redisClient = null;
      isConnected = false;
      connectionAttempted = false;
    }
  }
}

export default {
  initRedis,
  getRedisClient,
  isRedisAvailable,
  redisHealthCheck,
  closeRedisConnection
};
