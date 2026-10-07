import mongoose from 'mongoose';

const { Schema } = mongoose;

export const JOB_TYPES = Object.freeze({
  CATALOG_SYNC: 'catalog_sync',
  DATA_PROFILING: 'data_profiling',
  QUALITY_SCAN: 'quality_scan'
});

export const JOB_STATUSES = Object.freeze({
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
});

const JobSchema = new Schema(
  {
    jobId: {
      type: String,
      required: [true, 'Job ID is required'],
      unique: true,
      trim: true,
      index: true
    },
    jobType: {
      type: String,
      required: [true, 'Job type is required'],
      enum: {
        values: Object.values(JOB_TYPES),
        message: 'Invalid job type'
      },
      index: true
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory for tenant isolation'],
      index: true
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Resource ID is required'],
      index: true
    },
    resourceType: {
      type: String,
      required: true,
      enum: ['data_source', 'dataset']
    },
    status: {
      type: String,
      enum: {
        values: Object.values(JOB_STATUSES),
        message: 'Invalid job status'
      },
      default: JOB_STATUSES.QUEUED,
      index: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 3
    },
    startedAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    duration: {
      type: Number,
      default: 0 // Duration in milliseconds
    },
    errorCode: {
      type: String,
      default: null
    },
    safeErrorMessage: {
      type: String,
      default: null,
      maxlength: [1000, 'Error message cannot exceed 1000 characters']
    },
    correlationId: {
      type: String,
      trim: true,
      default: null,
      index: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
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

// High-performance operational indexes
JobSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
JobSchema.index({ organizationId: 1, jobType: 1, createdAt: -1 });
JobSchema.index({ organizationId: 1, resourceId: 1, status: 1 });

export const Job = mongoose.model('Job', JobSchema);
export default Job;
