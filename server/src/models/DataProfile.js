import mongoose from 'mongoose';

const { Schema } = mongoose;

const ColumnProfileSchema = new Schema(
  {
    columnName: {
      type: String,
      required: true,
      trim: true
    },
    dataType: {
      type: String,
      required: true,
      trim: true
    },
    rowCount: {
      type: Number,
      default: 0
    },
    nullCount: {
      type: Number,
      default: 0
    },
    nullPercentage: {
      type: Number,
      default: 0
    },
    distinctCount: {
      type: Number,
      default: 0
    },
    cardinality: {
      type: Number,
      default: 0
    },
    minValue: {
      type: Schema.Types.Mixed,
      default: null
    },
    maxValue: {
      type: Schema.Types.Mixed,
      default: null
    },
    meanValue: {
      type: Number,
      default: null
    },
    medianValue: {
      type: Schema.Types.Mixed,
      default: null
    },
    stdDevValue: {
      type: Number,
      default: null
    },
    histogram: [
      {
        bucket: String,
        count: Number,
        percentage: Number
      }
    ],
    profiledAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const DataProfileSchema = new Schema(
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
      enum: ['QUEUED', 'RUNNING', 'SUCCESS', 'FAILED'],
      default: 'SUCCESS',
      index: true
    },
    rowCount: {
      type: Number,
      default: 0
    },
    columnCount: {
      type: Number,
      default: 0
    },
    columns: [ColumnProfileSchema],
    profiledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    durationMs: {
      type: Number,
      default: 0
    },
    error: {
      code: { type: String, default: null },
      message: { type: String, default: null }
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

DataProfileSchema.index({ organizationId: 1, datasetId: 1, createdAt: -1 });

export const DataProfile = mongoose.model('DataProfile', DataProfileSchema);
export default DataProfile;
