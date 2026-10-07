const mongoose = require('mongoose');

const governanceRuleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  description: { type: String, trim: true },
  policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', required: true, index: true },
  category: {
    type: String,
    enum: [
      'PII_PROTECTION',
      'DATASET_OWNERSHIP',
      'GLOSSARY_ALIGNMENT',
      'QUALITY_THRESHOLD',
      'ACCESS_CONTROL',
      'METADATA_COMPLETENESS',
      'CUSTOM'
    ],
    default: 'PII_PROTECTION',
    index: true
  },
  ruleType: {
    type: String,
    required: true,
    enum: [
      'PII_CLASSIFICATION',
      'DATASET_OWNER_REQUIRED',
      'GLOSSARY_DEFINITION_REQUIRED',
      'QUALITY_SCORE_THRESHOLD',
      'SENSITIVITY_CLASSIFICATION',
      'RESTRICTED_ACCESS_ROLE',
      'CUSTOM_ASSERTION'
    ],
    index: true
  },
  severity: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium',
    set: (v) => (v ? v.toLowerCase() : 'medium'),
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft', 'archived'],
    default: 'active',
    index: true
  },
  targetType: {
    type: String,
    enum: ['DATASET', 'COLUMN', 'GLOSSARY_TERM', 'ALL_DATASETS'],
    default: 'DATASET',
    index: true
  },
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', index: true },
  columnName: { type: String, trim: true },
  glossaryTermId: { type: mongoose.Schema.Types.ObjectId, ref: 'GlossaryTerm', index: true },
  parameters: { type: mongoose.Schema.Types.Mixed, default: {} },
  lastRunAt: { type: Date },
  lastResult: {
    type: String,
    enum: ['PASS', 'FAIL', 'NOT_EVALUATED', 'ERROR'],
    default: 'NOT_EVALUATED',
    index: true
  },
  lastRunSummary: { type: String },
  lastRunExplanation: { type: String },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

governanceRuleSchema.index({ policyId: 1, status: 1 });
governanceRuleSchema.index({ datasetId: 1, ruleType: 1 });

governanceRuleSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('GovernanceRule', governanceRuleSchema);
