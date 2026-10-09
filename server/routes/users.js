const express = require('express');
const router = express.Router();

const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
} = require('../controllers/userController');
const { protect, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/rbac');

router.use(protect);

router.get('/', requirePermission(PERMISSIONS.USER_READ), getUsers);
router.get('/:id', requirePermission(PERMISSIONS.USER_READ), getUserById);
router.post('/', requirePermission(PERMISSIONS.USER_CREATE), createUser);
router.put('/:id', requirePermission(PERMISSIONS.USER_UPDATE), updateUser);
router.post('/:id/reset-password', requirePermission(PERMISSIONS.USER_UPDATE), resetUserPassword);
router.delete('/:id', requirePermission(PERMISSIONS.USER_DELETE), deleteUser);

module.exports = router;