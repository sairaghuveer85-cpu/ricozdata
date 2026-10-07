const express = require('express');
const router = express.Router();

const {
  getActivities,
  getActivityCount,
  createActivity,
} = require('../controllers/activityController');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/rbac');

router.use(protect);

router.get('/count', requirePermission(PERMISSIONS.ACTIVITY_READ), getActivityCount);
router.get('/', requirePermission(PERMISSIONS.ACTIVITY_READ), getActivities);
router.post('/', requirePermission(PERMISSIONS.ACTIVITY_READ), createActivity);

module.exports = router;