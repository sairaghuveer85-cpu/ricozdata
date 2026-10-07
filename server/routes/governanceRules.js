const express = require('express');
const router = express.Router();
const {
  getRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  evaluateRuleHandler,
  evaluatePolicyRules,
} = require('../controllers/governanceRuleController');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/rbac');

router.use(protect);

router.get('/', requirePermission(PERMISSIONS.RULE_READ), getRules);
router.get('/:id', requirePermission(PERMISSIONS.RULE_READ), getRule);
router.post('/', requirePermission(PERMISSIONS.RULE_CREATE), createRule);
router.put('/:id', requirePermission(PERMISSIONS.RULE_UPDATE), updateRule);
router.delete('/:id', requirePermission(PERMISSIONS.RULE_DELETE), deleteRule);
router.post('/:id/evaluate', requirePermission(PERMISSIONS.RULE_EVALUATE), evaluateRuleHandler);
router.post('/policy/:id/evaluate', requirePermission(PERMISSIONS.RULE_EVALUATE), evaluatePolicyRules);

module.exports = router;
