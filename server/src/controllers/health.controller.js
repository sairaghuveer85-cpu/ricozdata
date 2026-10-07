import config from '../config/env.js';
import { getDatabaseStatus } from '../config/database.js';

/**
 * Controller for application health monitoring.
 */
export function getHealth(req, res) {
  const dbStatus = getDatabaseStatus();

  const payload = {
    success: true,
    message: 'RicozData API is healthy',
    environment: config.env,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: {
        status: dbStatus.state,
        connected: dbStatus.isConnected
      }
    }
  };

  res.status(200).json(payload);
}

/**
 * Readiness probe for Kubernetes / container health checks.
 * Returns 200 only if MongoDB connection is ready.
 */
export function getReadiness(req, res) {
  const dbStatus = getDatabaseStatus();

  if (dbStatus.isConnected) {
    return res.status(200).json({
      success: true,
      ready: true,
      timestamp: new Date().toISOString(),
      services: {
        database: 'ready'
      }
    });
  }

  return res.status(503).json({
    success: false,
    ready: false,
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus.state
    }
  });
}

export default {
  getHealth,
  getReadiness
};
