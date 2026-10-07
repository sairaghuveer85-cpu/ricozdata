import { Router } from 'express';
import { getHealth, getReadiness } from '../controllers/health.controller.js';

const router = Router();

// GET /api/health
router.get('/', getHealth);

// GET /api/health/ready
router.get('/ready', getReadiness);

export default router;
