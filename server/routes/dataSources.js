const express = require('express');
const router = express.Router();
const {
  getDataSources,
  getDataSource,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  testConnection,
  discoverAssets,
  syncCatalog
} = require('../controllers/dataSourceController');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/rbac');

router.use(protect);

// Specific subresource operations BEFORE /:id
router.post('/test', requirePermission(PERMISSIONS.DATA_SOURCE_TEST), testConnection);
router.post('/discover', requirePermission(PERMISSIONS.DATA_SOURCE_UPDATE), discoverAssets);
router.post('/sync', requirePermission(PERMISSIONS.DATA_SOURCE_UPDATE), syncCatalog);
router.post('/:id/test', requirePermission(PERMISSIONS.DATA_SOURCE_TEST), testConnection);
router.post('/:id/discover', requirePermission(PERMISSIONS.DATA_SOURCE_UPDATE), discoverAssets);
router.post('/:id/sync', requirePermission(PERMISSIONS.DATA_SOURCE_UPDATE), syncCatalog);

// Root collection routes
router.get('/', requirePermission(PERMISSIONS.DATA_SOURCE_READ), getDataSources);
router.post('/', requirePermission(PERMISSIONS.DATA_SOURCE_CREATE), createDataSource);

// Resource routes by id
router.get('/:id', requirePermission(PERMISSIONS.DATA_SOURCE_READ), getDataSource);
router.put('/:id', requirePermission(PERMISSIONS.DATA_SOURCE_UPDATE), updateDataSource);
router.patch('/:id', requirePermission(PERMISSIONS.DATA_SOURCE_UPDATE), updateDataSource);
router.delete('/:id', requirePermission(PERMISSIONS.DATA_SOURCE_DELETE), deleteDataSource);

module.exports = router;
