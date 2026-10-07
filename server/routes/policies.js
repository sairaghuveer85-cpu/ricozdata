const express = require('express');
const router = express.Router();
const {
  getPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  deletePolicy,
  togglePolicyStatus,
  transitionPolicyStatus,
} = require('../controllers/policyController');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/rbac');

router.use(protect);

router.get('/', requirePermission(PERMISSIONS.POLICY_READ), getPolicies);
router.get('/:id', requirePermission(PERMISSIONS.POLICY_READ), getPolicy);
router.post('/', requirePermission(PERMISSIONS.POLICY_CREATE), createPolicy);
router.put('/:id', requirePermission(PERMISSIONS.POLICY_UPDATE), updatePolicy);
router.put('/:id/transition', requirePermission(PERMISSIONS.POLICY_UPDATE), transitionPolicyStatus);
router.delete('/:id', requirePermission(PERMISSIONS.POLICY_DELETE), deletePolicy);
router.put('/:id/toggle', requirePermission(PERMISSIONS.POLICY_UPDATE), togglePolicyStatus);

module.exports = router;
