const mongoose = require('mongoose');

const complianceEvidenceSchema = new mongoose.Schema({
  controlId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ComplianceControl',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'RULE_EVALUATION',
      'POLICY_SNAPSHOT',
      'CATALOG_METADATA',
      'GLOSSARY_TERM',
      'ACCESS_CONFIGURATION',
      'AUDIT_LOG',
      'MANUAL_UPLOAD'
    ],
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  sourceResource: {
    type: String,
    required: true,
    trim: true
  },
  dataSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  collectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collectedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

complianceEvidenceSchema.index({ controlId: 1, collectedAt: -1 });

module.exports = mongoose.model('ComplianceEvidence', complianceEvidenceSchema);
