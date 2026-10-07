const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const { canManageRole, isValidRole } = require('../config/rbac');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/ADMIN
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select('-password').sort({ createdAt: -1 });
  res.json({ success: true, data: users });
});

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  res.json({ success: true, data: user });
});

// @desc    Create new user
// @route   POST /api/users
// @access  Private/ADMIN
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, department, avatar, avatarBg, status } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({ success: false, message: 'User already exists' });
  }

  // Privilege escalation prevention: only SUPER_ADMIN can assign SUPER_ADMIN role
  const targetRole = role || 'DATA_ANALYST';
  if (targetRole === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to assign the SUPER_ADMIN role.'
    });
  }

  const user = await User.create({
    name,
    email,
    password,
    role: targetRole,
    department,
    avatar,
    avatarBg,
    status: status || 'ACTIVE',
  });

  res.status(201).json({
    success: true,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      avatar: user.avatar,
      avatarBg: user.avatarBg,
      status: user.status,
    },
  });
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/ADMIN
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Privilege escalation prevention: only SUPER_ADMIN can assign SUPER_ADMIN role
  const targetRole = req.body.role || user.role;
  if (targetRole === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to assign the SUPER_ADMIN role.'
    });
  }

  // Users cannot modify their own account via admin endpoint
  if (req.user._id.toString() === user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You cannot modify your own account. Use account settings instead.'
    });
  }

  // Role changes require strict hierarchy enforcement
  if (req.body.role && req.body.role !== user.role) {
    if (!canManageRole(req.user.role, req.body.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to assign this role to the target user.'
      });
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedAt: Date.now() },
    { new: true, runValidators: true }
  ).select('-password');

  res.json({ success: true, data: updatedUser });
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/ADMIN
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Privilege escalation prevention: SUPER_ADMIN protection
  if (user.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to delete the SUPER_ADMIN user.'
    });
  }

  // Users cannot delete their own account
  if (req.user._id.toString() === user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You cannot delete your own account.'
    });
  }

  // Role hierarchy enforcement for deletion
  if (user.role !== 'VIEWER' && !canManageRole(req.user.role, user.role)) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to delete this user.'
    });
  }

  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'User removed' });
});

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};