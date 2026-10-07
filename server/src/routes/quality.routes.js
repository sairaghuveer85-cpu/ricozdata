import { Router } from 'express';
import {
  getDatasetQuality,
  getDatasetQualityHistory,
  runDatasetQualityCheck,
  getQualityRunById,
  getDatasetRules,
  createQualityRule,
  getQualityRuleById,
  updateQualityRule,
  deleteQualityRule,
  getQualityIssues,
  getQualityIssueById,
  updateQualityIssue
} from '../controllers/quality.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant } from '../middleware/requireTenant.js';
import { requirePermission } from '../middleware/authorizePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateRequest } from '../middleware/validate.js';
import {
  datasetIdParamSchema,
  ruleIdParamSchema,
  runIdParamSchema,
  issueIdParamSchema,
  createQualityRuleSchema,
  updateQualityRuleSchema,
  updateQualityIssueSchema
} from '../schemas/quality.schema.js';

const router = Router();

// Protect all quality routes with authentication and tenant context
router.use(requireAuth);
router.use(requireTenant);

// Dataset Quality Execution & Overview
router.get(
  '/datasets/:datasetId',
  validateRequest(datasetIdParamSchema),
  requirePermission(PERMISSIONS.QUALITY_READ),
  asyncHandler(getDatasetQuality)
);

router.get(
  '/datasets/:datasetId/history',
  validateRequest(datasetIdParamSchema),
  requirePermission(PERMISSIONS.QUALITY_READ),
  asyncHandler(getDatasetQualityHistory)
);

router.post(
  '/datasets/:datasetId/run',
  validateRequest(datasetIdParamSchema),
  requirePermission(PERMISSIONS.QUALITY_MANAGE),
  asyncHandler(runDatasetQualityCheck)
);

router.get(
  '/runs/:id',
  validateRequest(runIdParamSchema),
  requirePermission(PERMISSIONS.QUALITY_READ),
  asyncHandler(getQualityRunById)
);

// Rules Endpoints
router.get(
  '/datasets/:datasetId/rules',
  validateRequest(datasetIdParamSchema),
  requirePermission(PERMISSIONS.QUALITY_READ),
  asyncHandler(getDatasetRules)
);

router.post(
  '/datasets/:datasetId/rules',
  validateRequest(createQualityRuleSchema),
  requirePermission(PERMISSIONS.QUALITY_MANAGE),
  asyncHandler(createQualityRule)
);

router.get(
  '/rules/:id',
  validateRequest(ruleIdParamSchema),
  requirePermission(PERMISSIONS.QUALITY_READ),
  asyncHandler(getQualityRuleById)
);

router.patch(
  '/rules/:id',
  validateRequest(updateQualityRuleSchema),
  requirePermission(PERMISSIONS.QUALITY_MANAGE),
  asyncHandler(updateQualityRule)
);

router.delete(
  '/rules/:id',
  validateRequest(ruleIdParamSchema),
  requirePermission(PERMISSIONS.QUALITY_MANAGE),
  asyncHandler(deleteQualityRule)
);

// Issues & Remediation Endpoints
router.get(
  '/issues',
  requirePermission(PERMISSIONS.QUALITY_READ),
  asyncHandler(getQualityIssues)
);

router.get(
  '/issues/:id',
  validateRequest(issueIdParamSchema),
  requirePermission(PERMISSIONS.QUALITY_READ),
  asyncHandler(getQualityIssueById)
);

router.patch(
  '/issues/:id',
  validateRequest(updateQualityIssueSchema),
  requirePermission(PERMISSIONS.QUALITY_MANAGE),
  asyncHandler(updateQualityIssue)
);

export default router;
