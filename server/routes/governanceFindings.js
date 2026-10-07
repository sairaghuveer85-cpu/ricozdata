const express = require('express');
const router = express.Router();
const {
  getFindings,
  getFinding,
  updateFindingStatus,
} = require('../controllers/governanceRuleController');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/rbac');

router.use(protect);

router.get('/', requirePermission(PERMISSIONS.RULE_READ), getFindings);
router.get('/:id', requirePermission(PERMISSIONS.RULE_READ), getFinding);
router.patch('/:id/status', requirePermission(PERMISSIONS.RULE_UPDATE), updateFindingStatus);

module.exports = router;
