const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, mapLegacyRole } = require('../config/rbac');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  password: { type: String, required: true },
  role: {
    type: String,
    required: true,
    index: true,
    enum: [
      ROLES.SUPER_ADMIN,
      ROLES.MAIN_ADMIN,
      ROLES.ADMIN,
      ROLES.EMPLOYEE,
      ROLES.DATA_STEWARD,
      ROLES.DATA_ENGINEER,
      ROLES.DATA_ANALYST,
      ROLES.VIEWER,
      // Support legacy string names seamlessly if any legacy seed/input is encountered
      'Super Admin',
      'Main Admin',
      'Admin',
      'Employee',
      'Data Steward',
      'Data Engineer',
      'Data Analyst',
      'Viewer',
      'Platform Administrator',
      'Security Administrator',
      'Data Governance Manager',
      'Product Data Owner',
      'Finance Data Owner',
      'Marketing Analyst',
      'Sales Operations Manager'
    ],
    default: ROLES.EMPLOYEE,
    set: function(val) {
      return mapLegacyRole(val);
    }
  },
  isMainAdmin: {
    type: Boolean,
    default: false,
    index: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true
  },
  activationTokenHash: {
    type: String,
    select: false
  },
  activationTokenExpires: {
    type: Date,
    select: false
  },
  department: { type: String, required: true, trim: true, default: 'General' },
  avatar: {
    type: String,
    required: true,
    default: function() {
      return (this.name ? this.name.trim().charAt(0) : 'U').toUpperCase();
    }
  },
  avatarBg: { type: String, required: true, default: 'bg-blue-600' },
  status: {
    type: String,
    default: 'ACTIVE',
    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'active', 'inactive', 'suspended'],
    index: true,
    set: (val) => (val ? val.toUpperCase() : 'ACTIVE')
  },
  lastActive: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function() {
  this.updatedAt = Date.now();
  // Automatically synchronize isMainAdmin flag with MAIN_ADMIN role
  if (this.role === ROLES.MAIN_ADMIN) {
    this.isMainAdmin = true;
  }
  // Safeguard: Main Admin accounts can never be deactivated
  if (this.isMainAdmin && this.status !== 'ACTIVE') {
    this.status = 'ACTIVE';
  }
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
