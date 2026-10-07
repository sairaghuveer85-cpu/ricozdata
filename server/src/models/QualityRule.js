import mongoose from 'mongoose';

const { Schema } = mongoose;

export const QUALITY_RULE_TYPES = Object.freeze({
  NULL_CHECK: 'NULL_CHECK',
  UNIQUENESS: 'UNIQUENESS',
  REGEX_PATTERN: 'REGEX_PATTERN',
  VALUE_RANGE: 'VALUE_RANGE',
  REFERENCE_INTEGRITY: 'REFERENCE_INTEGRITY',
  CUSTOM_SQL: 'CUSTOM_SQL'
});

export const QUALITY_SEVERITIES = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
});

export const QUALITY_RULE_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED'
});

const QualityRuleSchema = new Schema(
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
    name: {
      type: String,
      required: [true, 'Rule name is required'],
      trim: true,
      minlength: [2, 'Rule name must be at least 2 characters'],
      maxlength: [150, 'Rule name cannot exceed 150 characters']
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    ruleType: {
      type: String,
      required: [true, 'Rule type is required'],
      enum: {
        values: Object.values(QUALITY_RULE_TYPES),
        message: 'Invalid quality rule type'
      },
      index: true
    },
    targetColumn: {
      type: String,
      trim: true,
      default: null
    },
    targetColumns: [
      {
        type: String,
        trim: true
      }
    ],
    configuration: {
      type: Schema.Types.Mixed,
      required: [true, 'Rule configuration is required'],
      default: {}
    },
    severity: {
      type: String,
      enum: {
        values: Object.values(QUALITY_SEVERITIES),
        message: 'Invalid severity level'
      },
      default: QUALITY_SEVERITIES.MEDIUM,
      index: true
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true
    },
    status: {
      type: String,
      enum: {
        values: Object.values(QUALITY_RULE_STATUSES),
        message: 'Invalid rule status'
      },
      default: QUALITY_RULE_STATUSES.ACTIVE,
      index: true
    },
    owner: {
      type: String,
      trim: true,
      default: ''
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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

// High-performance compound indexes
QualityRuleSchema.index({ organizationId: 1, datasetId: 1, status: 1 });
QualityRuleSchema.index({ organizationId: 1, ruleType: 1 });
QualityRuleSchema.index({ organizationId: 1, enabled: 1 });

// Invalidate tenant dashboard cache upon quality rule mutation
QualityRuleSchema.post('save', function (doc) {
  if (doc?.organizationId) {
    import('../services/CacheService.js').then(({ CacheService }) => {
      CacheService.invalidateDashboard(doc.organizationId).catch(() => {});
    }).catch(() => {});
  }
});

QualityRuleSchema.post('findOneAndUpdate', function (doc) {
  if (doc?.organizationId) {
    import('../services/CacheService.js').then(({ CacheService }) => {
      CacheService.invalidateDashboard(doc.organizationId).catch(() => {});
    }).catch(() => {});
  }
});

QualityRuleSchema.post('findOneAndDelete', function (doc) {
  if (doc?.organizationId) {
    import('../services/CacheService.js').then(({ CacheService }) => {
      CacheService.invalidateDashboard(doc.organizationId).catch(() => {});
    }).catch(() => {});
  }
});

export const QualityRule = mongoose.model('QualityRule', QualityRuleSchema);
export default QualityRule;
