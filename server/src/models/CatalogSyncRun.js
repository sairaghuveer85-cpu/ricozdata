import mongoose from 'mongoose';

const { Schema } = mongoose;

const DriftItemSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'TABLE_ADDED',
        'TABLE_REMOVED',
        'TABLE_CHANGED',
        'COLUMN_ADDED',
        'COLUMN_REMOVED',
        'COLUMN_TYPE_CHANGED',
        'COLUMN_NULLABILITY_CHANGED',
        'INDEX_CHANGED',
        'CONSTRAINT_CHANGED'
      ]
    },
    assetName: { type: String, required: true },
    externalId: { type: String, required: true },
    details: { type: Schema.Types.Mixed, default: {} },
    detectedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const CatalogSyncRunSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory for multitenant sync isolation'],
      index: true
    },
    dataSourceId: {
      type: Schema.Types.ObjectId,
      ref: 'DataSource',
      required: [true, 'Data Source ID is mandatory'],
      index: true
    },
    status: {
      type: String,
      enum: ['RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED'],
      default: 'RUNNING',
      index: true
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date,
      default: null
    },
    discoveredCount: {
      type: Number,
      default: 0
    },
    createdCount: {
      type: Number,
      default: 0
    },
    updatedCount: {
      type: Number,
      default: 0
    },
    removedCount: {
      type: Number,
      default: 0
    },
    driftCount: {
      type: Number,
      default: 0
    },
    driftDetails: [DriftItemSchema],
    errorCode: {
      type: String,
      default: null
    },
    errorMessageSafe: {
      type: String,
      default: null
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

CatalogSyncRunSchema.index({ organizationId: 1, dataSourceId: 1, createdAt: -1 });
CatalogSyncRunSchema.index({ organizationId: 1, status: 1 });

export const CatalogSyncRun = mongoose.model('CatalogSyncRun', CatalogSyncRunSchema);
export default CatalogSyncRun;
