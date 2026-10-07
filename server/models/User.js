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
      ROLES.ADMIN,
      ROLES.DATA_STEWARD,
      ROLES.DATA_ENGINEER,
      ROLES.DATA_ANALYST,
      ROLES.VIEWER,
      // Support legacy string names seamlessly if any legacy seed/input is encountered
      'Super Admin',
      'Admin',
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
    default: ROLES.DATA_ANALYST,
    set: function(val) {
      if (!val) return ROLES.DATA_ANALYST;
      // If already a valid standardized role, keep it
      if (Object.values(ROLES).includes(val)) return val;
      // Otherwise map legacy role name
      return mapLegacyRole(val);
    }
  },
  department: { type: String, required: true, trim: true },
  avatar: { type: String, required: true },
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
