import { Router } from 'express';
import mongoose from 'mongoose';
import { redisHealthCheck } from '../config/redis.js';

const router = Router();

/**
 * GET /healthz
 * Liveness probe: returns 200 if the process is running.
 */
router.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /readyz
 * Readiness probe: checks required dependencies (MongoDB, Redis).
 * Returns 200 when ready to accept traffic, 503 if critical dependencies are down.
 */
router.get('/readyz', async (req, res) => {
  const isMongoConnected = mongoose.connection && mongoose.connection.readyState === 1;
  const redisCheck = await redisHealthCheck();

  const isReady = isMongoConnected;
  const statusCode = isReady ? 200 : 503;

  res.status(statusCode).json({
    status: isReady ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    dependencies: {
      database: {
        status: isMongoConnected ? 'connected' : 'disconnected',
        name: 'mongodb'
      },
      cache: {
        status: redisCheck.status,
        available: redisCheck.available,
        latencyMs: redisCheck.latencyMs || null
      }
    }
  });
});

export default router;
