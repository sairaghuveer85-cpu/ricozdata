import { Router } from 'express';
import {
  getGlossaryTerms,
  createGlossaryTerm,
  getGlossaryTermById,
  updateGlossaryTerm,
  deleteGlossaryTerm,
  linkDataset,
  unlinkDataset
} from '../controllers/glossary.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant } from '../middleware/requireTenant.js';
import { requirePermission } from '../middleware/authorizePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateRequest } from '../middleware/validate.js';
import {
  createGlossaryTermSchema,
  updateGlossaryTermSchema,
  linkGlossaryTermSchema,
  glossaryIdParamSchema
} from '../schemas/glossary.schema.js';

const router = Router();

router.use(requireAuth);
router.use(requireTenant);

router.get(
  '/',
  requirePermission(PERMISSIONS.GLOSSARY_READ),
  asyncHandler(getGlossaryTerms)
);

router.post(
  '/',
  validateRequest(createGlossaryTermSchema),
  requirePermission(PERMISSIONS.GLOSSARY_MANAGE),
  asyncHandler(createGlossaryTerm)
);

router.get(
  '/:id',
  validateRequest(glossaryIdParamSchema),
  requirePermission(PERMISSIONS.GLOSSARY_READ),
  asyncHandler(getGlossaryTermById)
);

router.patch(
  '/:id',
  validateRequest(updateGlossaryTermSchema),
  requirePermission(PERMISSIONS.GLOSSARY_MANAGE),
  asyncHandler(updateGlossaryTerm)
);

router.delete(
  '/:id',
  validateRequest(glossaryIdParamSchema),
  requirePermission(PERMISSIONS.GLOSSARY_MANAGE),
  asyncHandler(deleteGlossaryTerm)
);

router.post(
  '/:id/link',
  validateRequest(linkGlossaryTermSchema),
  requirePermission(PERMISSIONS.GLOSSARY_MANAGE),
  asyncHandler(linkDataset)
);

router.delete(
  '/:id/link',
  validateRequest(linkGlossaryTermSchema),
  requirePermission(PERMISSIONS.GLOSSARY_MANAGE),
  asyncHandler(unlinkDataset)
);

export default router;
