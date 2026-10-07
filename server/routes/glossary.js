const express = require('express');
const router = express.Router();
const {
  getGlossary,
  getGlossaryTerm,
  createGlossaryTerm,
  updateGlossaryTerm,
  updateGlossaryTermStatus,
  deleteGlossaryTerm,
  linkDataset,
  unlinkDataset,
  linkColumn,
  unlinkColumn,
  linkRelatedTerm,
  unlinkRelatedTerm,
  getGlossaryTermsForDataset,
} = require('../controllers/glossaryController');
const {
  generateSuggestions,
  getSuggestions,
  getSuggestionById,
  approveSuggestion,
  rejectSuggestion,
  dismissSuggestion,
  bulkActionSuggestions,
} = require('../controllers/glossarySuggestionController');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/rbac');

router.use(protect);

// Specific routes must come before generic /:id routes
router.get('/dataset/:datasetId', requirePermission(PERMISSIONS.GLOSSARY_READ), getGlossaryTermsForDataset);

// Phase 3: Intelligent Glossary Suggestions (Must be defined before /:id routes)
router.post('/suggestions/generate', requirePermission(PERMISSIONS.GLOSSARY_UPDATE), generateSuggestions);
router.get('/suggestions', requirePermission(PERMISSIONS.GLOSSARY_READ), getSuggestions);
router.post('/suggestions/bulk', requirePermission(PERMISSIONS.GLOSSARY_CREATE), bulkActionSuggestions);
router.get('/suggestions/:id', requirePermission(PERMISSIONS.GLOSSARY_READ), getSuggestionById);
router.post('/suggestions/:id/approve', requirePermission(PERMISSIONS.GLOSSARY_CREATE), approveSuggestion);
router.post('/suggestions/:id/reject', requirePermission(PERMISSIONS.GLOSSARY_UPDATE), rejectSuggestion);
router.post('/suggestions/:id/dismiss', requirePermission(PERMISSIONS.GLOSSARY_UPDATE), dismissSuggestion);

// Core CRUD
router.get('/', requirePermission(PERMISSIONS.GLOSSARY_READ), getGlossary);
router.get('/:id', requirePermission(PERMISSIONS.GLOSSARY_READ), getGlossaryTerm);
router.post('/', requirePermission(PERMISSIONS.GLOSSARY_CREATE), createGlossaryTerm);
router.put('/:id', requirePermission(PERMISSIONS.GLOSSARY_UPDATE), updateGlossaryTerm);
router.patch('/:id/status', requirePermission(PERMISSIONS.GLOSSARY_UPDATE), updateGlossaryTermStatus);
router.delete('/:id', requirePermission(PERMISSIONS.GLOSSARY_DELETE), deleteGlossaryTerm);

// Dataset Relationships
router.post('/:id/datasets/:datasetId', requirePermission(PERMISSIONS.GLOSSARY_UPDATE), linkDataset);
router.delete('/:id/datasets/:datasetId', requirePermission(PERMISSIONS.GLOSSARY_UPDATE), unlinkDataset);

// Column Relationships
router.post('/:id/columns', requirePermission(PERMISSIONS.GLOSSARY_UPDATE), linkColumn);
router.delete('/:id/columns', requirePermission(PERMISSIONS.GLOSSARY_UPDATE), unlinkColumn);

// Related Business Terms Relationships
router.post('/:id/related-terms', requirePermission(PERMISSIONS.GLOSSARY_UPDATE), linkRelatedTerm);
router.delete('/:id/related-terms/:relatedTermId', requirePermission(PERMISSIONS.GLOSSARY_UPDATE), unlinkRelatedTerm);

module.exports = router;
