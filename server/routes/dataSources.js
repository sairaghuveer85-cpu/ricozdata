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
const { protect } = require('../middleware/auth');

router.use(protect);

// Specific subresource operations BEFORE /:id
router.post('/test', testConnection);
router.post('/discover', discoverAssets);
router.post('/sync', syncCatalog);
router.post('/:id/test', testConnection);
router.post('/:id/discover', discoverAssets);
router.post('/:id/sync', syncCatalog);

// Root collection routes
router.get('/', getDataSources);
router.post('/', createDataSource);

// Resource routes by id
router.get('/:id', getDataSource);
router.put('/:id', updateDataSource);
router.patch('/:id', updateDataSource);
router.delete('/:id', deleteDataSource);

module.exports = router;
