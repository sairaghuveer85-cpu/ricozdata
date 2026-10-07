const express = require('express');
const router = express.Router();
const {
  getAccessOverview,
  inspectResourceAccess,
  createResourceAccessGrant,
  deleteResourceAccessGrant,
} = require('../controllers/accessControlController');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/rbac');

router.use(protect);

router.get('/overview', requirePermission(PERMISSIONS.POLICY_READ), getAccessOverview);
router.get('/inspect', requirePermission(PERMISSIONS.POLICY_READ), inspectResourceAccess);
router.post('/grants', requirePermission(PERMISSIONS.ACCESS_MANAGE), createResourceAccessGrant);
router.delete('/grants/:id', requirePermission(PERMISSIONS.ACCESS_MANAGE), deleteResourceAccessGrant);

module.exports = router;
