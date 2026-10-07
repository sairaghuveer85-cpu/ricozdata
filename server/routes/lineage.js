const express = require('express');
const router = express.Router();
const {
  getLineageForDataset,
  getAllLineage,
  createLineage,
  updateLineage,
  deleteLineage,
} = require('../controllers/lineageController');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/rbac');

router.use(protect);

router.get('/', requirePermission(PERMISSIONS.LINEAGE_READ), getAllLineage);
router.get('/:datasetId', requirePermission(PERMISSIONS.LINEAGE_READ), getLineageForDataset);
router.post('/', requirePermission(PERMISSIONS.LINEAGE_MANAGE), createLineage);
router.put('/:id', requirePermission(PERMISSIONS.LINEAGE_MANAGE), updateLineage);
router.delete('/:id', requirePermission(PERMISSIONS.LINEAGE_MANAGE), deleteLineage);

module.exports = router;
