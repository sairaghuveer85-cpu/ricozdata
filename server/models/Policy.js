const mongoose = require('mongoose');

const columnReferenceSchema = new mongoose.Schema({
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true },
  columnName: { type: String, required: true }
}, { _id: false });

const policyVersionHistorySchema = new mongoose.Schema({
  version: { type: Number, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  changedAt: { type: Date, default: Date.now },
  changeNotes: { type: String },
  snapshot: { type: mongoose.Schema.Types.Mixed }
}, { _id: true });

const VALID_POLICY_STATUSES = ['draft', 'under_review', 'active', 'deprecated', 'archived'];

const VALID_POLICY_TRANSITIONS = {
  draft: ['under_review', 'archived'],
  under_review: ['draft', 'active', 'archived'],
  active: ['under_review', 'deprecated', 'archived'],
  deprecated: ['active', 'archived'],
  archived: ['draft']
};

const policySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  description: { type: String, required: true, trim: true },
  category: {
    type: String,
    required: true,
    trim: true,
    index: true,
    default: 'Data Protection'
  },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  owner: { type: String, trim: true },
  status: {
    type: String,
    default: 'active',
    set: (val) => {
      if (!val) return 'draft';
      const normalized = val.toLowerCase().replace(/[\s-]/g, '_');
      if (normalized === 'inactive' || normalized === 'revoked') return 'deprecated';
      if (VALID_POLICY_STATUSES.includes(normalized)) return normalized;
      return 'draft';
    },
    index: true
  },
  priority: {
    type: String,
    default: 'Medium',
    enum: ['Low', 'Medium', 'High', 'Critical'],
    index: true
  },
  severity: {
    type: String,
    default: 'Medium',
    enum: ['Low', 'Medium', 'High', 'Critical'],
    index: true
  },
  scope: {
    type: String,
    default: 'Application-level governance policy; applies to RicozData metadata and catalog resources.'
  },
  appliesTo: { type: String, default: 'All Datasets' },
  datasetIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', index: true }],
  columnReferences: [columnReferenceSchema],
  glossaryTermIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GlossaryTerm', index: true }],
  ruleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GovernanceRule', index: true }],
  complianceFrameworks: [{ type: String, trim: true, default: ['GDPR'] }],
  compliance: { type: String },
  reviewFrequency: {
    type: String,
    default: 'Quarterly',
    enum: ['Monthly', 'Quarterly', 'Semiannual', 'Annual', 'Continuous']
  },
  effectiveDate: { type: Date },
  lastReviewed: { type: Date },
  nextReview: { type: Date },
  violationsCount: { type: Number, default: 0 },
  version: { type: Number, default: 1 },
  versionHistory: [policyVersionHistorySchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now, index: true }
});

policySchema.index({ name: 'text', description: 'text', category: 'text' });
policySchema.index({ status: 1, category: 1 });

policySchema.pre('save', function() {
  this.updatedAt = Date.now();
  if (this.complianceFrameworks && Array.isArray(this.complianceFrameworks)) {
    this.compliance = this.complianceFrameworks.join(', ');
  }
});

// Helper for validating status transitions
policySchema.methods.canTransitionTo = function(targetStatus) {
  const current = this.status;
  if (current === targetStatus) return true;
  const allowed = VALID_POLICY_TRANSITIONS[current] || [];
  return allowed.includes(targetStatus);
};

policySchema.statics.VALID_STATUSES = VALID_POLICY_STATUSES;
policySchema.statics.VALID_TRANSITIONS = VALID_POLICY_TRANSITIONS;

module.exports = mongoose.model('Policy', policySchema);