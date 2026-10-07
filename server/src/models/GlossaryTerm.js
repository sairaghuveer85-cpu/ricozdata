import mongoose from 'mongoose';

const { Schema } = mongoose;

export const GLOSSARY_TERM_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  DEPRECATED: 'DEPRECATED'
});

const LinkedDatasetSchema = new Schema(
  {
    datasetId: {
      type: Schema.Types.ObjectId,
      ref: 'Dataset',
      required: true
    },
    column: {
      type: String,
      trim: true,
      default: null // If null, linked to dataset; if string, linked to specific column
    },
    linkedAt: {
      type: Date,
      default: Date.now
    },
    linkedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { _id: false }
);

const GlossaryTermSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory for multitenant isolation'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Term name is required'],
      trim: true,
      minlength: [2, 'Term name must be at least 2 characters'],
      maxlength: [150, 'Term name cannot exceed 150 characters']
    },
    definition: {
      type: String,
      required: [true, 'Term definition is required'],
      trim: true,
      minlength: [5, 'Definition must be at least 5 characters'],
      maxlength: [2000, 'Definition cannot exceed 2000 characters']
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [5000, 'Description cannot exceed 5000 characters']
    },
    domain: {
      type: String,
      trim: true,
      default: 'General',
      maxlength: [100, 'Domain cannot exceed 100 characters'],
      index: true
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: [50, 'Tag cannot exceed 50 characters']
      }
    ],
    owner: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Owner cannot exceed 100 characters']
    },
    steward: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    synonyms: [
      {
        type: String,
        trim: true,
        maxlength: [150, 'Synonym cannot exceed 150 characters']
      }
    ],
    status: {
      type: String,
      enum: {
        values: Object.values(GLOSSARY_TERM_STATUSES),
        message: 'Invalid glossary term status'
      },
      default: GLOSSARY_TERM_STATUSES.DRAFT,
      index: true
    },
    linkedDatasets: [LinkedDatasetSchema],
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

// High-performance unique index within tenant
GlossaryTermSchema.index({ organizationId: 1, name: 1 }, { unique: true });
GlossaryTermSchema.index({ organizationId: 1, domain: 1 });
GlossaryTermSchema.index({ organizationId: 1, status: 1 });
GlossaryTermSchema.index({ organizationId: 1, 'linkedDatasets.datasetId': 1 });

export const GlossaryTerm = mongoose.model('GlossaryTerm', GlossaryTermSchema);
export default GlossaryTerm;
