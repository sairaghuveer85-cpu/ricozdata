const express = require('express');
const router = express.Router();

const { globalSearch } = require('../controllers/searchController');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/rbac');

router.use(protect);

router.get('/', requirePermission(PERMISSIONS.SEARCH_READ), globalSearch);

module.exports = router;