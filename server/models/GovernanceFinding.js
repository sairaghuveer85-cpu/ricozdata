const mongoose = require('mongoose');

const governanceFindingSchema = new mongoose.Schema({
  ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'GovernanceRule', required: true, index: true },
  policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', required: true, index: true },
  targetType: {
    type: String,
    enum: ['DATASET', 'COLUMN', 'GLOSSARY_TERM'],
    required: true,
    index: true
  },
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', index: true },
  columnName: { type: String, trim: true },
  glossaryTermId: { type: mongoose.Schema.Types.ObjectId, ref: 'GlossaryTerm', index: true },
  resourceName: { type: String, required: true },
  severity: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium',
    set: (v) => (v ? v.toLowerCase() : 'medium'),
    index: true
  },
  title: { type: String, required: true, trim: true },
  explanation: { type: String, required: true },
  evidence: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: {
    type: String,
    enum: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'IGNORED'],
    default: 'OPEN',
    set: (v) => (v ? v.toUpperCase() : 'OPEN'),
    index: true
  },
  detectedAt: { type: Date, default: Date.now, index: true },
  acknowledgedAt: { type: Date },
  resolvedAt: { type: Date },
  assignedToId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  resolvedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolutionNotes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Deduplication index: Only 1 OPEN finding per rule + dataset + column / term
governanceFindingSchema.index(
  { ruleId: 1, datasetId: 1, columnName: 1, glossaryTermId: 1, status: 1 },
  { unique: false }
);

governanceFindingSchema.pre('save', function() {
  this.updatedAt = Date.now();
  if (this.isModified('status')) {
    if (this.status === 'ACKNOWLEDGED' && !this.acknowledgedAt) {
      this.acknowledgedAt = new Date();
    }
    if (this.status === 'RESOLVED' && !this.resolvedAt) {
      this.resolvedAt = new Date();
    }
  }
});

module.exports = mongoose.model('GovernanceFinding', governanceFindingSchema);
