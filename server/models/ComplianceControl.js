const mongoose = require('mongoose');

const complianceControlSchema = new mongoose.Schema({
  frameworkId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ComplianceFramework',
    required: true,
    index: true
  },
  controlId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    default: 'Technical & Organizational Safeguards'
  },
  policyIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Policy'
  }],
  ruleIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GovernanceRule'
  }],
  datasetIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dataset'
  }],
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['COMPLIANT', 'PARTIALLY_COMPLIANT', 'NON_COMPLIANT', 'NOT_ASSESSED', 'NOT_APPLICABLE'],
    default: 'NOT_ASSESSED',
    index: true
  },
  lastAssessedAt: {
    type: Date
  },
  lastAssessedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

complianceControlSchema.index({ frameworkId: 1, controlId: 1 }, { unique: true });

complianceControlSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('ComplianceControl', complianceControlSchema);
