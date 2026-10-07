import mongoose from 'mongoose';

const { Schema } = mongoose;

export const QUALITY_ISSUE_STATUSES = Object.freeze({
  OPEN: 'OPEN',
  IN_REVIEW: 'IN_REVIEW',
  RESOLVED: 'RESOLVED'
});

export const QUALITY_ISSUE_SEVERITIES = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
});

const QualityIssueSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory for multitenant isolation'],
      index: true
    },
    datasetId: {
      type: Schema.Types.ObjectId,
      ref: 'Dataset',
      required: [true, 'Dataset ID is required'],
      index: true
    },
    ruleId: {
      type: Schema.Types.ObjectId,
      ref: 'QualityRule',
      required: [true, 'Quality Rule ID is required'],
      index: true
    },
    qualityRunId: {
      type: Schema.Types.ObjectId,
      ref: 'QualityRun',
      default: null,
      index: true
    },
    severity: {
      type: String,
      enum: {
        values: Object.values(QUALITY_ISSUE_SEVERITIES),
        message: 'Invalid issue severity'
      },
      default: QUALITY_ISSUE_SEVERITIES.MEDIUM,
      index: true
    },
    status: {
      type: String,
      enum: {
        values: Object.values(QUALITY_ISSUE_STATUSES),
        message: 'Invalid issue status'
      },
      default: QUALITY_ISSUE_STATUSES.OPEN,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Issue title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    rootCause: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Root cause cannot exceed 2000 characters']
    },
    affectedColumn: {
      type: String,
      trim: true,
      default: null
    },
    affectedRowsCount: {
      type: Number,
      default: 0
    },
    evidenceSummary: {
      type: Schema.Types.Mixed,
      default: null // Bounded evidence summary: max 5-10 records, truncated values
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    resolution: {
      notes: { type: String, trim: true, default: '' },
      resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      resolvedAt: { type: Date, default: null }
    },
    resolvedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

QualityIssueSchema.index({ organizationId: 1, datasetId: 1, status: 1 });
QualityIssueSchema.index({ organizationId: 1, status: 1 });
QualityIssueSchema.index({ organizationId: 1, ruleId: 1, status: 1 });

// Invalidate tenant dashboard cache upon quality issue mutation
QualityIssueSchema.post('save', function (doc) {
  if (doc?.organizationId) {
    import('../services/CacheService.js').then(({ CacheService }) => {
      CacheService.invalidateDashboard(doc.organizationId).catch(() => {});
    }).catch(() => {});
  }
});

QualityIssueSchema.post('findOneAndUpdate', function (doc) {
  if (doc?.organizationId) {
    import('../services/CacheService.js').then(({ CacheService }) => {
      CacheService.invalidateDashboard(doc.organizationId).catch(() => {});
    }).catch(() => {});
  }
});

QualityIssueSchema.post('findOneAndDelete', function (doc) {
  if (doc?.organizationId) {
    import('../services/CacheService.js').then(({ CacheService }) => {
      CacheService.invalidateDashboard(doc.organizationId).catch(() => {});
    }).catch(() => {});
  }
});

export const QualityIssue = mongoose.model('QualityIssue', QualityIssueSchema);
export default QualityIssue;
