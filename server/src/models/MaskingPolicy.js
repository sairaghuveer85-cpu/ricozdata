import mongoose from 'mongoose';

const { Schema } = mongoose;

export const MASKING_STRATEGIES = Object.freeze({
  REDACT: 'REDACT',
  PARTIAL: 'PARTIAL',
  HASH: 'HASH',
  TOKENIZED: 'TOKENIZED'
});

const MaskingPolicySchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory for multitenant isolation'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Policy name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [150, 'Name cannot exceed 150 characters']
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    datasetId: {
      type: Schema.Types.ObjectId,
      ref: 'Dataset',
      required: [true, 'Target dataset ID is required'],
      index: true
    },
    column: {
      type: String,
      required: [true, 'Target column name is required'],
      trim: true,
      maxlength: [200, 'Column name cannot exceed 200 characters']
    },
    maskingType: {
      type: String,
      required: [true, 'Masking type is required'],
      enum: {
        values: Object.values(MASKING_STRATEGIES),
        message: 'Invalid masking strategy'
      },
      index: true
    },
    roles: [
      {
        type: String,
        trim: true,
        lowercase: true
      }
    ],
    enabled: {
      type: Boolean,
      default: true,
      index: true
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

// One active masking policy per column per dataset in tenant
MaskingPolicySchema.index({ organizationId: 1, datasetId: 1, column: 1 }, { unique: true });
MaskingPolicySchema.index({ organizationId: 1, enabled: 1 });

export const MaskingPolicy = mongoose.model('MaskingPolicy', MaskingPolicySchema);
export default MaskingPolicy;
