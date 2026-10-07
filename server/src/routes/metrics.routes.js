import { Router } from 'express';
import { register } from '../metrics/prometheus.js';

const router = Router();

/**
 * GET /metrics
 * Exposes Prometheus-compatible metric exposition format.
 */
router.get('/metrics', async (req, res) => {
  try {
    res.setHeader('Content-Type', register.contentType);
    const metricsData = await register.metrics();
    res.send(metricsData);
  } catch (err) {
    res.status(500).send(`Error collecting metrics: ${err.message}`);
  }
});

export default router;
