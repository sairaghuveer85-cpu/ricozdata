const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const { ROLES, canManageRole, mapLegacyRole } = require('../config/rbac');

// @desc    Get all users (employees) for current workspace
// @route   GET /api/users
// @access  Private/MAIN_ADMIN
const getUsers = asyncHandler(async (req, res) => {
  const filter = req.user.role === ROLES.SUPER_ADMIN ? {} : { organizationId: req.user.organizationId };
  const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
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

  // Workspace isolation check
  if (req.user.role !== ROLES.SUPER_ADMIN && user.organizationId && !user.organizationId.equals(req.user.organizationId)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to view users from another workspace.' });
  }

  res.json({ success: true, data: user });
});

// @desc    Create new employee account
// @route   POST /api/users
// @access  Private/MAIN_ADMIN
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, department, status } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Full name is required' });
  }

  if (!email || !email.trim()) {
    return res.status(400).json({ success: false, message: 'Work email is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name.trim();

  const userExists = await User.findOne({ email: normalizedEmail });
  if (userExists) {
    return res.status(400).json({ success: false, message: 'An account with this email address already exists' });
  }

  // Privilege escalation prevention:
  // Public users and ordinary creation endpoints cannot assign MAIN_ADMIN or SUPER_ADMIN
  const normalizedRole = role ? mapLegacyRole(role) : ROLES.EMPLOYEE;
  if ((normalizedRole === ROLES.SUPER_ADMIN || normalizedRole === ROLES.MAIN_ADMIN) && req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to assign administrative privileges to employee accounts.'
    });
  }

  // Generate cryptographically secure one-time activation/setup token
  const rawActivationToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawActivationToken).digest('hex');
  const tokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const initialPassword = password || `Emp_${crypto.randomBytes(4).toString('hex')}!`;

  // Avatar initials
  const avatarInitials = normalizedName
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'E';

  const user = await User.create({
    name: normalizedName,
    email: normalizedEmail,
    password: initialPassword, // Handled and hashed by userSchema.pre('save')
    role: normalizedRole,
    isMainAdmin: false, // Hard security: never permit isMainAdmin via API creation
    organizationId: req.user.organizationId,
    department: (department && department.trim()) ? department.trim() : 'Data Platform',
    avatar: avatarInitials,
    avatarBg: 'bg-blue-600',
    status: status ? String(status).toUpperCase() : 'ACTIVE',
    activationTokenHash: tokenHash,
    activationTokenExpires: tokenExpires,
  });

  const responseData = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isMainAdmin: user.isMainAdmin,
    organizationId: user.organizationId,
    department: user.department,
    avatar: user.avatar,
    avatarBg: user.avatarBg,
    status: user.status,
    createdAt: user.createdAt,
  };

  // Provide activation token for local development / testing fallback
  if (process.env.NODE_ENV !== 'production') {
    responseData.activationToken = rawActivationToken;
  }

  res.status(201).json({
    success: true,
    message: `Employee account created for ${user.name}`,
    data: responseData,
  });
});

// @desc    Update employee account
// @route   PUT /api/users/:id
// @access  Private/MAIN_ADMIN
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Workspace isolation check
  if (req.user.role !== ROLES.SUPER_ADMIN && user.organizationId && !user.organizationId.equals(req.user.organizationId)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to modify users from another workspace.' });
  }

  // Target is Main Admin protections
  const isTargetMainAdmin = user.isMainAdmin || user.role === ROLES.MAIN_ADMIN;

  if (isTargetMainAdmin) {
    // 1. Cannot deactivate the Main Admin
    if (req.body.status && req.body.status.toUpperCase() !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'The designated Main Admin account cannot be deactivated.'
      });
    }

    // 2. Cannot demote the Main Admin
    if (req.body.role && mapLegacyRole(req.body.role) !== ROLES.MAIN_ADMIN && mapLegacyRole(req.body.role) !== ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'The designated Main Admin role cannot be demoted.'
      });
    }
  }

  // Users cannot modify their own account role via this endpoint
  if (req.user._id.toString() === user._id.toString() && req.body.role && req.body.role !== user.role) {
    return res.status(403).json({
      success: false,
      message: 'You cannot modify your own role. Privileges are strictly managed.'
    });
  }

  // Privilege escalation prevention: only SUPER_ADMIN can assign SUPER_ADMIN role
  const targetRole = req.body.role ? mapLegacyRole(req.body.role) : user.role;
  if ((targetRole === ROLES.SUPER_ADMIN || targetRole === ROLES.MAIN_ADMIN) && req.user.role !== ROLES.SUPER_ADMIN && !req.user.isMainAdmin) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to assign administrative privileges.'
    });
  }

  const updateData = { ...req.body };
  delete updateData._id;
  delete updateData.__v;
  delete updateData.isMainAdmin; // Protect privileged flag from mass assignment

  if (updateData.role) {
    updateData.role = mapLegacyRole(updateData.role);
  }

  if (updateData.status) {
    updateData.status = String(updateData.status).toUpperCase();
  }

  if (updateData.password) {
    const salt = await bcrypt.genSalt(10);
    updateData.password = await bcrypt.hash(updateData.password, salt);
  }

  updateData.updatedAt = Date.now();

  const updatedUser = await User.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  ).select('-password');

  res.json({ success: true, data: updatedUser });
});

// @desc    Delete employee account
// @route   DELETE /api/users/:id
// @access  Private/MAIN_ADMIN
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Workspace isolation check
  if (req.user.role !== ROLES.SUPER_ADMIN && user.organizationId && !user.organizationId.equals(req.user.organizationId)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to delete users from another workspace.' });
  }

  // Hard protection: The Main Admin account can NEVER be deleted
  if (user.isMainAdmin || user.role === ROLES.MAIN_ADMIN) {
    return res.status(403).json({
      success: false,
      message: 'The designated Main Admin account cannot be deleted.'
    });
  }

  if (user.role === ROLES.SUPER_ADMIN && req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to delete the Super Admin user.'
    });
  }

  // Users cannot delete their own account
  if (req.user._id.toString() === user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You cannot delete your own account.'
    });
  }

  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Employee account removed' });
});

// @desc    Reset employee password / issue fresh activation token
// @route   POST /api/users/:id/reset-password
// @access  Private/MAIN_ADMIN
const resetUserPassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Workspace isolation check
  if (req.user.role !== ROLES.SUPER_ADMIN && user.organizationId && !user.organizationId.equals(req.user.organizationId)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to reset passwords for users from another workspace.' });
  }

  const { newPassword } = req.body;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const tokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  user.activationTokenHash = tokenHash;
  user.activationTokenExpires = tokenExpires;

  if (newPassword && newPassword.length >= 8) {
    user.password = newPassword;
  }
  await user.save();

  res.json({
    success: true,
    message: `Password setup token generated for ${user.name}`,
    data: {
      userId: user._id,
      email: user.email,
      ...(process.env.NODE_ENV !== 'production' ? { activationToken: rawToken } : {})
    }
  });
});

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
};