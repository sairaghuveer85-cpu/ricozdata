const express = require('express');
const router = express.Router();
const {
  getQualities,
  getQualityForDataset,
  getQualityOverview,
  createQuality,
  updateQuality,
  deleteQuality,
  getQualityIssues,
  getQualityIssue,
  createQualityIssue,
  updateQualityIssue,
  deleteQualityIssue,
  getRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  runRule,
  evaluateDataset,
  resolveIssue,
  acknowledgeIssue,
  inProgressIssue,
  ignoreIssue,
  reopenIssue,
  assignIssue,
  getQualityTrends,
  getQualityProfile,
  searchIssues,
} = require('../controllers/qualityController');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/rbac');

router.use(protect);

// ─────────────────────────────────────────────────────────────────────────────
// 1. SPECIFIC LITERAL SUB-RESOURCE ROUTES (Must come first!)
// ─────────────────────────────────────────────────────────────────────────────

// Overview routes
router.get('/overview/:datasetId', requirePermission(PERMISSIONS.QUALITY_READ), getQualityOverview);

// Profile routes
router.get('/profile/:datasetId', requirePermission(PERMISSIONS.QUALITY_READ), getQualityProfile);

// Trends routes
router.get('/trends/:datasetId', requirePermission(PERMISSIONS.QUALITY_READ), getQualityTrends);

// Quality Issues collection & search
router.get('/issues/search', requirePermission(PERMISSIONS.QUALITY_READ), searchIssues);
router.get('/issues', requirePermission(PERMISSIONS.QUALITY_READ), getQualityIssues);
router.post('/issues', requirePermission(PERMISSIONS.QUALITY_UPDATE), createQualityIssue);

// Quality Issue individual & lifecycle actions
router.get('/issues/:id', requirePermission(PERMISSIONS.QUALITY_READ), getQualityIssue);
router.put('/issues/:id', requirePermission(PERMISSIONS.QUALITY_UPDATE), updateQualityIssue);
router.delete('/issues/:id', requirePermission(PERMISSIONS.QUALITY_MANAGE), deleteQualityIssue);
router.post('/issues/:id/resolve', requirePermission(PERMISSIONS.QUALITY_UPDATE), resolveIssue);
router.post('/issues/:id/acknowledge', requirePermission(PERMISSIONS.QUALITY_UPDATE), acknowledgeIssue);
router.post('/issues/:id/in-progress', requirePermission(PERMISSIONS.QUALITY_UPDATE), inProgressIssue);
router.post('/issues/:id/ignore', requirePermission(PERMISSIONS.QUALITY_MANAGE), ignoreIssue);
router.post('/issues/:id/reopen', requirePermission(PERMISSIONS.QUALITY_UPDATE), reopenIssue);
router.post('/issues/:id/assign', requirePermission(PERMISSIONS.QUALITY_UPDATE), assignIssue);

// Quality Rules collection & execution
router.get('/rules', requirePermission(PERMISSIONS.QUALITY_READ), getRules);
router.post('/rules', requirePermission(PERMISSIONS.QUALITY_MANAGE), createRule);
router.get('/rules/:id', requirePermission(PERMISSIONS.QUALITY_READ), getRule);
router.put('/rules/:id', requirePermission(PERMISSIONS.QUALITY_MANAGE), updateRule);
router.delete('/rules/:id', requirePermission(PERMISSIONS.QUALITY_MANAGE), deleteRule);
router.post('/rules/:id/run', requirePermission(PERMISSIONS.QUALITY_UPDATE), runRule);

// Dataset Evaluation
router.post('/evaluate/:datasetId', requirePermission(PERMISSIONS.QUALITY_UPDATE), evaluateDataset);

// ─────────────────────────────────────────────────────────────────────────────
// 2. ROOT & DATASET-PARAMETRIC ROUTES (Must come after literal sub-resources!)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', requirePermission(PERMISSIONS.QUALITY_READ), getQualities);
router.post('/', requirePermission(PERMISSIONS.QUALITY_UPDATE), createQuality);

// Dataset-specific sub-paths
router.get('/:datasetId/trends', requirePermission(PERMISSIONS.QUALITY_READ), getQualityTrends);
router.get('/:datasetId/profile', requirePermission(PERMISSIONS.QUALITY_READ), getQualityProfile);
router.get('/:datasetId/overview', requirePermission(PERMISSIONS.QUALITY_READ), getQualityOverview);

// Dataset single record by ID
router.get('/:datasetId', requirePermission(PERMISSIONS.QUALITY_READ), getQualityForDataset);
router.put('/:id', requirePermission(PERMISSIONS.QUALITY_UPDATE), updateQuality);
router.delete('/:id', requirePermission(PERMISSIONS.QUALITY_MANAGE), deleteQuality);

module.exports = router;
