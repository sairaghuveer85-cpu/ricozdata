import mongoose from 'mongoose';

const { Schema } = mongoose;

export const ORGANIZATION_STATUS = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  PENDING: 'pending',
  ARCHIVED: 'archived'
});

const ALLOWED_STATUS_VALUES = Object.values(ORGANIZATION_STATUS);

const OrganizationSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      minlength: [2, 'Organization name must be at least 2 characters'],
      maxlength: [100, 'Organization name cannot exceed 100 characters']
    },
    slug: {
      type: String,
      required: [true, 'Organization slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'],
      index: true
    },
    status: {
      type: String,
      enum: {
        values: ALLOWED_STATUS_VALUES,
        message: 'Status must be active, suspended, pending, or archived'
      },
      default: ORGANIZATION_STATUS.ACTIVE,
      set: (val) => (typeof val === 'string' ? val.toLowerCase() : val),
      index: true
    },
    settings: {
      tier: {
        type: String,
        enum: ['starter', 'growth', 'enterprise'],
        default: 'starter'
      },
      maxDataSources: {
        type: Number,
        default: 10,
        min: [1, 'Must allow at least 1 data source']
      },
      maxUsers: {
        type: Number,
        default: 25,
        min: [1, 'Must allow at least 1 user']
      },
      features: {
        lineageEnabled: { type: Boolean, default: true },
        qualityAlertsEnabled: { type: Boolean, default: true },
        glossaryEnabled: { type: Boolean, default: true },
        advancedGovernance: { type: Boolean, default: false }
      },
      dataRetentionDays: {
        type: Number,
        default: 90,
        min: [7, 'Minimum data retention is 7 days']
      }
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

// Compound and query performance indexes
OrganizationSchema.index({ createdAt: -1 });
OrganizationSchema.index({ status: 1, createdAt: -1 });

export const Organization = mongoose.model('Organization', OrganizationSchema);
export default Organization;
