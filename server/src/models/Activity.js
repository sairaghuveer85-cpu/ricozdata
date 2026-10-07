import mongoose from 'mongoose';

const { Schema } = mongoose;

const SENSITIVE_AUDIT_KEYS = [
  'password',
  'token',
  'refreshtoken',
  'secret',
  'jwt',
  'credential',
  'credentials',
  'encrypteddata',
  'keyid',
  'authorization'
];

/**
 * Deeply scrubs sensitive credentials from audit payload summaries.
 */
function sanitizeAuditData(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj instanceof Date || obj instanceof mongoose.Types.ObjectId) return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeAuditData(item));
  }

  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    const lowerKey = k.toLowerCase().replace(/[^a-z]/g, '');
    if (SENSITIVE_AUDIT_KEYS.some(sk => lowerKey.includes(sk))) {
      clean[k] = '[REDACTED_CREDENTIAL]';
    } else if (v && typeof v === 'object') {
      clean[k] = sanitizeAuditData(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

const ActivitySchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory for multitenant audit isolation'],
      index: true
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor ID is mandatory'],
      index: true
    },
    action: {
      type: String,
      required: [true, 'Action name is required'],
      trim: true,
      index: true
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      enum: {
        values: [
          'organization',
          'user',
          'data_source',
          'dataset',
          'quality_rule',
          'quality_issue',
          'glossary_term',
          'policy',
          'lineage_edge',
          'report',
          'system'
        ],
        message: 'Invalid entity type for activity tracking'
      },
      index: true
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Target entity ID is mandatory'],
      index: true
    },
    before: {
      type: Schema.Types.Mixed,
      default: null
    },
    after: {
      type: Schema.Types.Mixed,
      default: null
    },
    correlationId: {
      type: String,
      trim: true,
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILURE', 'DENIED'],
      default: 'SUCCESS',
      index: true
    },
    requestMetadata: {
      ip: { type: String, default: null },
      userAgent: { type: String, default: null },
      method: { type: String, default: null },
      path: { type: String, default: null }
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: false,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.__v;
        ret.resourceType = ret.entityType;
        ret.resourceId = ret.entityId;
        return ret;
      }
    }
  }
);

// Virtual aliases for Step 30 resourceType / resourceId specification
ActivitySchema.virtual('resourceType')
  .get(function () { return this.entityType; })
  .set(function (v) { this.entityType = v; });

ActivitySchema.virtual('resourceId')
  .get(function () { return this.entityId; })
  .set(function (v) { this.entityId = v; });

// Sanitize sensitive credentials before persisting
ActivitySchema.pre('save', function (next) {
  if (this.metadata) {
    this.metadata = sanitizeAuditData(this.metadata);
  }
  if (this.before) {
    this.before = sanitizeAuditData(this.before);
  }
  if (this.after) {
    this.after = sanitizeAuditData(this.after);
  }
  if (typeof next === 'function') {
    next();
  }
});

// Immutability: Block update operations
ActivitySchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'findByIdAndUpdate'], function (next) {
  const err = new Error('Audit log is immutable and cannot be updated');
  err.statusCode = 403;
  if (typeof next === 'function') {
    return next(err);
  }
  throw err;
});

// Append-only: Block deletion unless explicit privileged archival/retention purge or test runner teardown
ActivitySchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete', 'findByIdAndDelete'], function (next) {
  const options = this.getOptions?.() || {};
  const isProd = process.env.NODE_ENV === 'production';
  const isTest = !isProd && (
    process.env.NODE_ENV === 'test' ||
    process.env.ALLOW_AUDIT_PURGE === 'true' ||
    process.execArgv.includes('--test') ||
    process.argv.some(a => typeof a === 'string' && a.includes('test'))
  );

  if (!isTest && !options.allowAuditRetentionPurge) {
    const err = new Error('Audit log is append-only and cannot be deleted without privileged archival retention authorization');
    err.statusCode = 403;
    if (typeof next === 'function') {
      return next(err);
    }
    throw err;
  }
  if (typeof next === 'function') {
    next();
  }
});

// High-performance audit indexes
ActivitySchema.index({ organizationId: 1, timestamp: -1 });
ActivitySchema.index({ organizationId: 1, entityType: 1, entityId: 1, timestamp: -1 });
ActivitySchema.index({ organizationId: 1, actorId: 1, timestamp: -1 });
ActivitySchema.index({ organizationId: 1, action: 1, timestamp: -1 });

// Invalidate tenant dashboard cache upon activity creation or deletion
ActivitySchema.post('save', function (doc) {
  if (doc?.organizationId) {
    import('../services/CacheService.js').then(({ CacheService }) => {
      CacheService.invalidateDashboard(doc.organizationId).catch(() => {});
    }).catch(() => {});
  }
});

ActivitySchema.post('deleteOne', { document: true, query: false }, function (doc) {
  if (doc?.organizationId) {
    import('../services/CacheService.js').then(({ CacheService }) => {
      CacheService.invalidateDashboard(doc.organizationId).catch(() => {});
    }).catch(() => {});
  }
});

export const Activity = mongoose.models.Activity || mongoose.model('Activity', ActivitySchema);
export default Activity;
