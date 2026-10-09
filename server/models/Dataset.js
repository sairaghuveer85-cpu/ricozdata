const mongoose = require('mongoose');

const columnFieldSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String },
  dataType: { type: String },
  nullable: { type: Boolean, default: true },
  pii: { type: Boolean, default: false },
  description: { type: String },
  primaryKey: { type: Boolean, default: false },
  sensitivity: { type: String, default: 'Internal', enum: ['Public', 'Internal', 'Confidential', 'Restricted'] },
  businessMeaning: { type: String },
  foreignKey: { type: String },
  comments: [{ type: String }]
}, { _id: true });

const datasetSchema = new mongoose.Schema({
  // IDENTITY
  name: { type: String, required: true, index: true },
  displayName: { type: String },
  description: { type: String, required: true },
  businessDescription: { type: String },
  technicalDescription: { type: String },

  // OWNERSHIP
  owner: { type: String, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  steward: { type: String },
  stewardId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  technicalOwner: { type: String },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },

  // DOMAIN & CLASSIFICATION
  domain: { type: String, required: true, index: true },
  domainId: { type: mongoose.Schema.Types.ObjectId, ref: 'Domain', index: true },
  sourceSystem: { type: String, required: true, index: true },
  sourceType: { type: String, default: 'Warehouse' },
  type: { type: String, default: 'table', enum: ['table', 'view', 'collection', 'file', 'stream'] },
  environment: { type: String, default: 'Production' },
  connection: { type: String },
  sensitivity: { type: String, default: 'Confidential', enum: ['Public', 'Internal', 'Confidential', 'Restricted'], index: true },
  classification: { type: String, default: 'Operational', enum: ['Strategic', 'Tactical', 'Operational', 'Transactional'] },
  tags: [{ type: String, index: true }],
  certifications: [{
    status: { type: String, enum: ['Draft', 'Under Review', 'Certified', 'Deprecated', 'In Review', 'Not Certified'], default: 'Draft' },
    certifiedBy: { type: String },
    certifiedAt: { type: Date },
    certificationNotes: { type: String }
  }],
  status: { type: String, default: 'active', enum: ['active', 'archived'], index: true },

  // SOURCE & ACCESS
  source: { type: String, required: true, index: true },
  sourceDetails: { type: String },
  dataSourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'DataSource', index: true },
  tableName: { type: String, index: true },
  schemaName: { type: String },

  // DISCOVERY & METRICS
  popularity: { type: Number, default: 0, index: true },
  viewCount: { type: Number, default: 0 },
  favoriteCount: { type: Number, default: 0 },
  favoriteIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  usageCount: { type: Number, default: 0 },
  lastAccessedAt: { type: Date },
  lastRefreshedAt: { type: Date },
  lastUpdatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },

  // LIFECYCLE & GOVERNANCE
  certificationStatus: { type: String, default: 'Not Certified', enum: ['Certified', 'In Review', 'Not Certified', 'Deprecated', 'Under Review', 'Draft'], index: true },
  certificationDate: { type: Date },
  deprecatedAt: { type: Date },
  deprecateReason: { type: String },

  // METADATA & DOCUMENTATION
  documentation: { type: String },
  businessContext: { type: String },
  usageNotes: { type: String },
  limitations: { type: String },

  // TECHNICAL SPECIFICATIONS
  rowCount: { type: String, default: '0' },
  size: { type: String, default: '0 GB' },
  sizeBytes: { type: Number, default: 0 },
  refreshFrequency: { type: String, default: 'Daily' },

  // DATA QUALITY
  qualityScore: { type: Number, default: 0, index: true },
  qualityStatus: { type: String, default: 'Healthy', enum: ['Healthy', 'Warning', 'Critical', 'Deprecated'] },
  issueCount: { type: Number, default: 0 },
  lastQualityCheck: { type: Date },
  dimensions: { type: mongoose.Schema.Types.Mixed, default: [] },

  // GOVERNANCE
  policyIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Policy' }],
  glossaryTermIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GlossaryTerm' }],

  // ACTIVITY TRACKING
  views: { type: Number, default: 0 },
  activeUsersCount: { type: Number, default: 0 },
  columns: [columnFieldSchema],

  // BACKWARD COMPATIBILITY FIELDS
  ownerName: { type: String },
  stewardName: { type: String },
  domainName: { type: String },
  usage: { type: String },
  statistics: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({ trend: '+1.2%', trendDirection: 'up', health: 'Good' })
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.schema = ret.columns || [];
      ret.id = ret._id;
      return ret;
    }
  },
  toObject: {
    transform: function(doc, ret) {
      ret.schema = ret.columns || [];
      ret.id = ret._id;
      return ret;
    }
  }
});

datasetSchema.index({ domain: 1, status: 1 });
datasetSchema.index({ name: 'text', description: 'text' });

datasetSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.models.Dataset || mongoose.model('Dataset', datasetSchema);
