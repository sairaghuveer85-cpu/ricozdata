const express = require('express');
const router = express.Router();
const {
  getDatasets,
  getDataset,
  createDataset,
  updateDataset,
  deleteDataset,
  getDatasetStats,
  favoriteDataset,
  getDatasetFavorites,
  certifyDataset,
  updateColumnMetadata,
  getDatasetActivity,
  getRelatedDatasets,
  getTags,
  getSources,
  executeDatasetQuery,
  getDatasetPreview,
  exportDatasetSchema,
} = require('../controllers/datasetController');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/rbac');

router.use(protect);

// Specific literal routes BEFORE subresource routes
router.get('/stats/summary', requirePermission(PERMISSIONS.DATASET_READ), getDatasetStats);
router.get('/tags', requirePermission(PERMISSIONS.DATASET_READ), getTags);
router.get('/sources', requirePermission(PERMISSIONS.DATASET_READ), getSources);

// Mutating subresource routes BEFORE generic resource routes
router.post('/:id/favorite', requirePermission(PERMISSIONS.DATASET_READ), favoriteDataset);
router.post('/:id/query', requirePermission(PERMISSIONS.DATASET_READ), executeDatasetQuery);
router.put('/:id/certification', requirePermission(PERMISSIONS.DATASET_UPDATE), certifyDataset);
router.put('/:id/schema/:columnId', requirePermission(PERMISSIONS.DATASET_UPDATE), updateColumnMetadata);

// Read subresource routes BEFORE generic resource routes
router.get('/:id/activity', requirePermission(PERMISSIONS.DATASET_READ), getDatasetActivity);
router.get('/:id/related', requirePermission(PERMISSIONS.DATASET_READ), getRelatedDatasets);
router.get('/:id/favorite', requirePermission(PERMISSIONS.DATASET_READ), getDatasetFavorites);
router.get('/:id/preview', requirePermission(PERMISSIONS.DATASET_READ), getDatasetPreview);
router.get('/:id/export-schema', requirePermission(PERMISSIONS.DATASET_READ), exportDatasetSchema);
router.get('/:id/schema/export', requirePermission(PERMISSIONS.DATASET_READ), exportDatasetSchema);

// Root collection routes
router.get('/', requirePermission(PERMISSIONS.DATASET_READ), getDatasets);
router.post('/', requirePermission(PERMISSIONS.DATASET_CREATE), createDataset);

// Resource routes by id (must come AFTER subresource routes)
router.get('/:id', requirePermission(PERMISSIONS.DATASET_READ), getDataset);
router.put('/:id', requirePermission(PERMISSIONS.DATASET_UPDATE), updateDataset);
router.delete('/:id', requirePermission(PERMISSIONS.DATASET_DELETE), deleteDataset);

module.exports = router;