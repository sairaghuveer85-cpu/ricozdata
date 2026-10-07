const mongoose = require('mongoose');

const complianceAssessmentSchema = new mongoose.Schema({
  controlId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ComplianceControl',
    required: true,
    index: true
  },
  frameworkId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ComplianceFramework',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['COMPLIANT', 'PARTIALLY_COMPLIANT', 'NON_COMPLIANT', 'NOT_ASSESSED', 'NOT_APPLICABLE'],
    required: true,
    index: true
  },
  assessorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  notes: {
    type: String,
    required: true,
    trim: true
  },
  evidenceIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ComplianceEvidence'
  }],
  findingIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GovernanceFinding'
  }],
  assessedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

complianceAssessmentSchema.index({ controlId: 1, assessedAt: -1 });

module.exports = mongoose.model('ComplianceAssessment', complianceAssessmentSchema);
