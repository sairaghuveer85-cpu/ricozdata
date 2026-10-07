import mongoose from 'mongoose';

const { Schema } = mongoose;

export const LINEAGE_RELATIONSHIP_TYPES = Object.freeze({
  DIRECT_COPY: 'DIRECT_COPY',
  DERIVED: 'DERIVED',
  AGGREGATED: 'AGGREGATED',
  JOINED: 'JOINED',
  FILTERED: 'FILTERED',
  TRANSFORMED: 'TRANSFORMED'
});

const LineageEdgeSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory for multitenant isolation'],
      index: true
    },
    upstreamDatasetId: {
      type: Schema.Types.ObjectId,
      ref: 'Dataset',
      required: [true, 'Upstream dataset ID is required'],
      index: true
    },
    downstreamDatasetId: {
      type: Schema.Types.ObjectId,
      ref: 'Dataset',
      required: [true, 'Downstream dataset ID is required'],
      index: true
    },
    transformationId: {
      type: String,
      trim: true,
      default: null
    },
    upstreamColumn: {
      type: String,
      trim: true,
      default: null
    },
    downstreamColumn: {
      type: String,
      trim: true,
      default: null
    },
    relationshipType: {
      type: String,
      enum: {
        values: Object.values(LINEAGE_RELATIONSHIP_TYPES),
        message: 'Invalid lineage relationship type'
      },
      default: LINEAGE_RELATIONSHIP_TYPES.DERIVED,
      index: true
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 1.0
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    createdBy: {
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

// High-performance traversal indexes
LineageEdgeSchema.index({ organizationId: 1, upstreamDatasetId: 1 });
LineageEdgeSchema.index({ organizationId: 1, downstreamDatasetId: 1 });
LineageEdgeSchema.index(
  {
    organizationId: 1,
    upstreamDatasetId: 1,
    downstreamDatasetId: 1,
    upstreamColumn: 1,
    downstreamColumn: 1
  },
  { unique: true }
);

export const LineageEdge = mongoose.model('LineageEdge', LineageEdgeSchema);
export default LineageEdge;
