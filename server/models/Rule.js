const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true },
  targetDatasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset' },
  field: { type: String, required: true },
  targetColumn: { type: String },
  expression: { type: String, default: '' },
  dimension: {
    type: String,
    required: true,
    set: (v) => v ? v.toLowerCase() : v,
    enum: ['completeness', 'accuracy', 'consistency', 'validity', 'uniqueness', 'timeliness']
  },
  ruleType: {
    type: String,
    required: true,
    set: (v) => v ? v.toUpperCase() : v,
    enum: ['NOT_NULL', 'UNIQUE', 'RANGE', 'REGEX', 'DATA_TYPE', 'ENUM', 'MIN_LENGTH', 'MAX_LENGTH', 'REFERENTIAL_INTEGRITY', 'FRESHNESS', 'DUPLICATE', 'CUSTOM']
  },
  condition: { type: mongoose.Schema.Types.Mixed, default: {} },
  threshold: { type: mongoose.Schema.Types.Mixed, default: 0.95 },
  severity: {
    type: String,
    required: true,
    set: (v) => v ? v.toLowerCase() : v,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium'
  },
  enabled: { type: Boolean, default: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastRunAt: { type: Date },
  lastResult: { type: String, enum: ['pass', 'fail', 'warning', 'error'] },
  status: { type: String, enum: ['active', 'inactive', 'scheduled', 'archived'], default: 'active' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ruleSchema.index({ datasetId: 1, field: 1, enabled: 1 });
ruleSchema.index({ ruleType: 1, dimension: 1 });
ruleSchema.index({ createdBy: 1 });
ruleSchema.index({ lastRunAt: 1 });

ruleSchema.pre('save', function() {
  this.updatedAt = Date.now();
  if (!this.targetDatasetId && this.datasetId) {
    this.targetDatasetId = this.datasetId;
  }
  if (!this.targetColumn && this.field) {
    this.targetColumn = this.field;
  }
});

module.exports = mongoose.model('Rule', ruleSchema);