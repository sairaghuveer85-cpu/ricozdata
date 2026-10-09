const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, default: 'dataset', index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  time: { type: String, default: 'Recently' },
  issueId: { type: mongoose.Schema.Types.ObjectId, ref: 'QualityIssue' },
  policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy' },
  glossaryTermId: { type: mongoose.Schema.Types.ObjectId, ref: 'GlossaryTerm', index: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

activitySchema.index({ timestamp: -1 });
activitySchema.index({ datasetId: 1, timestamp: -1 });
activitySchema.index({ glossaryTermId: 1, timestamp: -1 });

module.exports = mongoose.model('Activity', activitySchema);