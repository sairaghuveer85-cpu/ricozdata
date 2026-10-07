const mongoose = require('mongoose');

const dimensionSnapshotSchema = new mongoose.Schema({
  name: { type: String, required: true },
  score: { type: Number, default: null },
  status: { type: String, enum: ['ASSESSED', 'NOT_ASSESSED'], default: 'ASSESSED' },
  color: { type: String, default: '#64748b' }
});

const qualityHistorySchema = new mongoose.Schema({
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
  score: { type: Number, required: true },
  grade: { type: String, required: true },
  trendText: { type: String },
  trendDirection: { type: String },
  dimensions: [dimensionSnapshotSchema],
  sourceType: { type: String },
  sourceSystem: { type: String },
  passedRulesCount: { type: Number, default: 0 },
  totalRulesCount: { type: Number, default: 0 },
  activeIssuesCount: { type: Number, default: 0 },
  openIssuesCount: { type: Number, default: 0 },
  resolvedIssuesCount: { type: Number, default: 0 },
  criticalIssuesCount: { type: Number, default: 0 },
  highIssuesCount: { type: Number, default: 0 },
  medianIssueSeverity: { type: Number, default: 0 },
  evaluatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

qualityHistorySchema.index({ datasetId: 1, evaluatedAt: -1 });
qualityHistorySchema.index({ evaluatedAt: -1 });

module.exports = mongoose.model('QualityHistory', qualityHistorySchema);
