const mongoose = require('mongoose');

const qualityIssueSchema = new mongoose.Schema({
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  field: { type: String, required: true },
  column: { type: String },
  ruleId: { type: String },
  ruleType: { type: String },
  dimension: {
    type: String,
    set: (v) => v ? v.toLowerCase() : v,
    enum: ['completeness', 'accuracy', 'consistency', 'validity', 'uniqueness', 'timeliness']
  },
  issue: { type: String, required: true },
  count: { type: Number, default: 1 },
  affectedRows: { type: Number, default: 0 },
  severity: {
    type: String,
    required: true,
    set: (v) => v ? v.toLowerCase() : v,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium',
    index: true
  },
  status: {
    type: String,
    required: true,
    set: (v) => v ? v.toLowerCase().replace(/[\s-]/g, '_') : v,
    enum: ['open', 'acknowledged', 'in_progress', 'investigating', 'resolved', 'ignored', 'closed'],
    index: true,
    default: 'open'
  },
  detectedAt: { type: Date, default: Date.now },
  acknowledgedAt: { type: Date },
  resolvedAt: { type: Date },
  assignedToId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  resolvedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolutionNote: { type: String },
  evidence: { type: mongoose.Schema.Types.Mixed },
  failureDetails: { type: String },
  score: { type: Number },
  totalRecords: { type: Number },
  lastSeenAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

qualityIssueSchema.index({ datasetId: 1, status: 1 });
qualityIssueSchema.index({ severity: 1 });
qualityIssueSchema.index({ ruleId: 1 });
qualityIssueSchema.index({ assignedToId: 1 });
qualityIssueSchema.index({ detectedAt: -1 });

qualityIssueSchema.pre('save', function() {
  this.updatedAt = Date.now();
  if (!this.column && this.field) {
    this.column = this.field;
  }

  // Auto-set timestamps based on status transitions
  if (this.isModified('status')) {
    if (this.status === 'acknowledged' && !this.acknowledgedAt) {
      this.acknowledgedAt = new Date();
    }
    if (this.status === 'resolved' && !this.resolvedAt) {
      this.resolvedAt = new Date();
    }
  }
});

module.exports = mongoose.model('QualityIssue', qualityIssueSchema);