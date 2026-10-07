const express = require('express');
const router = express.Router();
const {
  getFrameworks,
  createFramework,
  getControls,
  createControl,
  assessControl,
  collectEvidence,
  getComplianceSummary,
} = require('../controllers/complianceController');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/rbac');

router.use(protect);

router.get('/frameworks', requirePermission(PERMISSIONS.COMPLIANCE_READ), getFrameworks);
router.post('/frameworks', requirePermission(PERMISSIONS.COMPLIANCE_MANAGE), createFramework);

router.get('/controls', requirePermission(PERMISSIONS.COMPLIANCE_READ), getControls);
router.post('/controls', requirePermission(PERMISSIONS.COMPLIANCE_MANAGE), createControl);
router.post('/controls/:id/assess', requirePermission(PERMISSIONS.COMPLIANCE_MANAGE), assessControl);
router.post('/controls/:id/evidence', requirePermission(PERMISSIONS.COMPLIANCE_MANAGE), collectEvidence);

router.get('/summary', requirePermission(PERMISSIONS.COMPLIANCE_READ), getComplianceSummary);

module.exports = router;
