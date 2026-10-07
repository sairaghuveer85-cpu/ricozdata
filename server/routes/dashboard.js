const express = require('express');
const router = express.Router();

const {
  getDashboardMetrics,
  getDashboardActivity,
  getPopularDatasets,
} = require('../controllers/dashboardController');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/rbac');

router.use(protect);

router.get('/metrics', requirePermission(PERMISSIONS.DASHBOARD_READ), getDashboardMetrics);
router.get('/activity', requirePermission(PERMISSIONS.DASHBOARD_READ), getDashboardActivity);
router.get('/popular-datasets', requirePermission(PERMISSIONS.DASHBOARD_READ), getPopularDatasets);

module.exports = router;