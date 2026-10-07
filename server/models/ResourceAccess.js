const mongoose = require('mongoose');

const resourceAccessSchema = new mongoose.Schema({
  resourceType: {
    type: String,
    enum: ['DATASET', 'POLICY', 'GLOSSARY_TERM', 'GOVERNANCE_RULE'],
    required: true,
    index: true
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  grantType: {
    type: String,
    enum: ['GRANT', 'RESTRICTION'],
    default: 'GRANT',
    required: true,
    index: true
  },
  principalType: {
    type: String,
    enum: ['USER', 'ROLE'],
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  role: {
    type: String,
    index: true
  },
  permissions: [{
    type: String,
    required: true
  }],
  reason: {
    type: String,
    trim: true
  },
  grantedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

resourceAccessSchema.index({ resourceType: 1, resourceId: 1, principalType: 1 });
resourceAccessSchema.index({ userId: 1, resourceType: 1 });
resourceAccessSchema.index({ role: 1, resourceType: 1 });

resourceAccessSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('ResourceAccess', resourceAccessSchema);
