import mongoose from 'mongoose';

const { Schema } = mongoose;

const QualityMetricSnapshotSchema = new Schema(
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
    qualityRunId: {
      type: Schema.Types.ObjectId,
      ref: 'QualityRun',
      required: [true, 'Quality Run ID is required'],
      index: true
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    metrics: {
      completeness: { type: Number, default: null },
      uniqueness: { type: Number, default: null },
      validity: { type: Number, default: null },
      consistency: { type: Number, default: null },
      integrity: { type: Number, default: null }
    },
    rulesSummary: {
      total: { type: Number, default: 0 },
      passed: { type: Number, default: 0 },
      failed: { type: Number, default: 0 }
    },
    recordsEvaluated: {
      type: Number,
      default: 0
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
        return ret;
      }
    }
  }
);

QualityMetricSnapshotSchema.index({ organizationId: 1, datasetId: 1, timestamp: -1 });

// Invalidate tenant dashboard cache upon new quality snapshot
QualityMetricSnapshotSchema.post('save', function (doc) {
  if (doc?.organizationId) {
    import('../services/CacheService.js').then(({ CacheService }) => {
      CacheService.invalidateDashboard(doc.organizationId).catch(() => {});
    }).catch(() => {});
  }
});

export const QualityMetricSnapshot = mongoose.model('QualityMetricSnapshot', QualityMetricSnapshotSchema);
export default QualityMetricSnapshot;
