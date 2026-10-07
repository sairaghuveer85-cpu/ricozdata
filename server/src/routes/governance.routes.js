import { Router } from 'express';
import {
  updateClassification,
  getDatasetClassification,
  getMaskingPolicies,
  createMaskingPolicy,
  updateMaskingPolicy,
  deleteMaskingPolicy,
  getComplianceReport
} from '../controllers/governance.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant } from '../middleware/requireTenant.js';
import { requirePermission } from '../middleware/authorizePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateRequest } from '../middleware/validate.js';
import {
  updateClassificationSchema,
  createMaskingPolicySchema,
  updateMaskingPolicySchema,
  maskingPolicyIdParamSchema
} from '../schemas/governance.schema.js';
import { datasetIdParamSchema } from '../schemas/dataset.schema.js';

const router = Router();

router.use(requireAuth);
router.use(requireTenant);

// Data Classification
router.post(
  '/classification',
  validateRequest(updateClassificationSchema),
  requirePermission(PERMISSIONS.GOVERNANCE_MANAGE),
  asyncHandler(updateClassification)
);

router.get(
  '/classification/:datasetId',
  validateRequest(datasetIdParamSchema),
  requirePermission(PERMISSIONS.GOVERNANCE_READ),
  asyncHandler(getDatasetClassification)
);

// Masking Policies
router.get(
  '/masking-policies',
  requirePermission(PERMISSIONS.GOVERNANCE_READ),
  asyncHandler(getMaskingPolicies)
);

router.post(
  '/masking-policies',
  validateRequest(createMaskingPolicySchema),
  requirePermission(PERMISSIONS.GOVERNANCE_MANAGE),
  asyncHandler(createMaskingPolicy)
);

router.patch(
  '/masking-policies/:id',
  validateRequest(updateMaskingPolicySchema),
  requirePermission(PERMISSIONS.GOVERNANCE_MANAGE),
  asyncHandler(updateMaskingPolicy)
);

router.delete(
  '/masking-policies/:id',
  validateRequest(maskingPolicyIdParamSchema),
  requirePermission(PERMISSIONS.GOVERNANCE_MANAGE),
  asyncHandler(deleteMaskingPolicy)
);

// Compliance Report
router.get(
  '/compliance-report',
  requirePermission(PERMISSIONS.GOVERNANCE_READ),
  asyncHandler(getComplianceReport)
);

export default router;
