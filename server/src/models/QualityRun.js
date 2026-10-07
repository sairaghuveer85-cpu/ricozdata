import mongoose from 'mongoose';

const { Schema } = mongoose;

export const QUALITY_RUN_STATUSES = Object.freeze({
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
});

const QualityResultItemSchema = new Schema(
  {
    ruleId: {
      type: Schema.Types.ObjectId,
      ref: 'QualityRule',
      required: true
    },
    ruleName: {
      type: String,
      required: true
    },
    ruleType: {
      type: String,
      required: true
    },
    severity: {
      type: String,
      required: true
    },
    targetColumn: {
      type: String,
      default: null
    },
    targetColumns: [String],
    passed: {
      type: Boolean,
      required: true
    },
    recordsEvaluated: {
      type: Number,
      default: 0
    },
    recordsPassed: {
      type: Number,
      default: 0
    },
    recordsFailed: {
      type: Number,
      default: 0
    },
    passPercentage: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    message: {
      type: String,
      default: ''
    },
    evidenceSummary: {
      type: Schema.Types.Mixed,
      default: null // Bounded evidence preview (max 5-10 records, truncated)
    },
    executionDurationMs: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const QualityRunSchema = new Schema(
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
    dataSourceId: {
      type: Schema.Types.ObjectId,
      ref: 'DataSource',
      required: [true, 'Data Source ID is required'],
      index: true
    },
    status: {
      type: String,
      enum: {
        values: Object.values(QUALITY_RUN_STATUSES),
        message: 'Invalid quality run status'
      },
      default: QUALITY_RUN_STATUSES.QUEUED,
      index: true
    },
    startedAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    executionDurationMs: {
      type: Number,
      default: 0
    },
    rulesEvaluated: {
      type: Number,
      default: 0
    },
    passedRules: {
      type: Number,
      default: 0
    },
    failedRules: {
      type: Number,
      default: 0
    },
    recordsEvaluated: {
      type: Number,
      default: 0
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    metrics: {
      completeness: { type: Number, default: null, min: 0, max: 100 },
      uniqueness: { type: Number, default: null, min: 0, max: 100 },
      validity: { type: Number, default: null, min: 0, max: 100 },
      consistency: { type: Number, default: null, min: 0, max: 100 },
      integrity: { type: Number, default: null, min: 0, max: 100 }
    },
    results: [QualityResultItemSchema],
    error: {
      code: { type: String, default: null },
      message: { type: String, default: null }
    },
    triggeredBy: {
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

QualityRunSchema.index({ organizationId: 1, datasetId: 1, createdAt: -1 });
QualityRunSchema.index({ organizationId: 1, status: 1 });

export const QualityRun = mongoose.model('QualityRun', QualityRunSchema);
export default QualityRun;
