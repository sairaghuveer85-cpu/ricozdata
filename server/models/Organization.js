const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
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
      index: true
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'active', 'inactive', 'suspended'],
      default: 'ACTIVE',
      set: (val) => (val ? val.toUpperCase() : 'ACTIVE'),
      index: true
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    settings: {
      tier: {
        type: String,
        enum: ['starter', 'growth', 'enterprise'],
        default: 'starter'
      },
      maxDataSources: {
        type: Number,
        default: 20
      },
      maxUsers: {
        type: Number,
        default: 50
      },
      features: {
        lineageEnabled: { type: Boolean, default: true },
        qualityAlertsEnabled: { type: Boolean, default: true },
        glossaryEnabled: { type: Boolean, default: true },
        advancedGovernance: { type: Boolean, default: true }
      }
    }
  },
  {
    timestamps: true
  }
);

organizationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Organization', organizationSchema);
