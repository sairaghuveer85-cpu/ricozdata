import mongoose from 'mongoose';

const { Schema } = mongoose;

export const ColumnSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Column name is required'],
      trim: true,
      maxlength: [200, 'Column name cannot exceed 200 characters']
    },
    dataType: {
      type: String,
      required: [true, 'Column data type is required'],
      trim: true,
      maxlength: [100, 'Data type cannot exceed 100 characters']
    },
    nullable: {
      type: Boolean,
      default: true
    },
    ordinalPosition: {
      type: Number,
      default: 1
    },
    defaultValue: {
      type: String,
      default: null
    },
    isPrimaryKey: {
      type: Boolean,
      default: false
    },
    isForeignKey: {
      type: Boolean,
      default: false
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: [50, 'Tag cannot exceed 50 characters']
      }
    ],
    classification: {
      type: String,
      enum: ['none', 'public', 'internal', 'confidential', 'restricted', 'pii', 'financial'],
      default: 'none'
    },
    piiClassification: {
      type: String,
      enum: ['none', 'pii', 'sensitive', 'sensitive_pii', 'phi', 'financial', 'confidential'],
      default: 'none'
    }
  },
  { _id: false }
);

const DatasetSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory for multitenant isolation'],
      index: true
    },
    dataSourceId: {
      type: Schema.Types.ObjectId,
      ref: 'DataSource',
      required: [true, 'Data Source ID is mandatory'],
      index: true
    },
    externalId: {
      type: String,
      trim: true,
      index: true,
      default: null // Stable external identifier from source, e.g. "public.orders"
    },
    name: {
      type: String,
      required: [true, 'Dataset name is required'],
      trim: true,
      minlength: [1, 'Dataset name cannot be empty'],
      maxlength: [200, 'Dataset name cannot exceed 200 characters']
    },
    fullyQualifiedName: {
      type: String,
      trim: true,
      index: true,
      default: ''
    },
    schemaName: {
      type: String,
      trim: true,
      default: 'public',
      index: true
    },
    path: {
      type: String,
      trim: true,
      default: '' // e.g. "analytics.core.dim_customers" or "s3://bucket/data.parquet"
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    type: {
      type: String,
      enum: {
        values: ['table', 'view', 'stream', 'file', 'collection', 'model'],
        message: 'Invalid dataset type'
      },
      default: 'table',
      index: true
    },
    assetType: {
      type: String,
      enum: ['table', 'view', 'stream', 'file', 'collection', 'model'],
      default: 'table'
    },
    origin: {
      type: String,
      enum: ['DISCOVERED', 'MANUAL'],
      default: 'DISCOVERED',
      index: true
    },
    syncStatus: {
      type: String,
      enum: ['ACTIVE', 'MISSING_FROM_SOURCE', 'DEPRECATED', 'UNSYNCED'],
      default: 'ACTIVE',
      index: true
    },
    columns: [ColumnSchema],
    schemaMetadata: {
      fields: [ColumnSchema],
      rowCount: {
        type: Number,
        default: 0,
        min: 0
      },
      sizeBytes: {
        type: Number,
        default: 0,
        min: 0
      },
      lastSchemaSyncAt: {
        type: Date,
        default: null
      }
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: [50, 'Tag cannot exceed 50 characters']
      }
    ],
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    stewardId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    classification: {
      type: String,
      enum: ['public', 'internal', 'confidential', 'restricted'],
      default: 'internal',
      index: true
    },
    qualityScore: {
      score: {
        type: Number,
        min: 0,
        max: 100,
        default: null
      },
      lastEvaluatedAt: {
        type: Date,
        default: null
      }
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        // Ensure columns and schemaMetadata.fields are consistently populated
        if ((!ret.columns || ret.columns.length === 0) && ret.schemaMetadata?.fields?.length > 0) {
          ret.columns = ret.schemaMetadata.fields;
        } else if ((!ret.schemaMetadata?.fields || ret.schemaMetadata.fields.length === 0) && ret.columns?.length > 0) {
          if (!ret.schemaMetadata) ret.schemaMetadata = {};
          ret.schemaMetadata.fields = ret.columns;
        }
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Pre-save synchronization hook between columns and schemaMetadata.fields, and assetType/type
DatasetSchema.pre('save', function (next) {
  if (this.columns && this.columns.length > 0 && (!this.schemaMetadata?.fields || this.schemaMetadata.fields.length === 0)) {
    if (!this.schemaMetadata) this.schemaMetadata = {};
    this.schemaMetadata.fields = this.columns;
  } else if (this.schemaMetadata?.fields && this.schemaMetadata.fields.length > 0 && (!this.columns || this.columns.length === 0)) {
    this.columns = this.schemaMetadata.fields;
  }

  if (this.assetType && !this.type) {
    this.type = this.assetType;
  } else if (this.type && !this.assetType) {
    this.assetType = this.type;
  }

  if (!this.fullyQualifiedName) {
    const s = this.schemaName || 'public';
    this.fullyQualifiedName = `${s}.${this.name}`;
  }

  if (!this.externalId) {
    this.externalId = this.fullyQualifiedName;
  }

  // Deduplicate and sanitize tags
  if (Array.isArray(this.tags)) {
    this.tags = Array.from(new Set(this.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))).slice(0, 50);
  }

  if (typeof next === 'function') {
    next();
  }
});

// Multitenancy Compound Indexes
DatasetSchema.index({ organizationId: 1, dataSourceId: 1, name: 1 }, { unique: true });
DatasetSchema.index({ organizationId: 1, dataSourceId: 1, externalId: 1 });
DatasetSchema.index({ organizationId: 1, type: 1 });
DatasetSchema.index({ organizationId: 1, origin: 1 });
DatasetSchema.index({ organizationId: 1, syncStatus: 1 });
DatasetSchema.index({ organizationId: 1, isDeleted: 1 });
DatasetSchema.index({ organizationId: 1, tags: 1 });
DatasetSchema.index({ organizationId: 1, classification: 1 });
DatasetSchema.index({ organizationId: 1, createdAt: -1 });

// Invalidate tenant dashboard cache upon any dataset mutation
DatasetSchema.post('save', function (doc) {
  if (doc?.organizationId) {
    import('../services/CacheService.js').then(({ CacheService }) => {
      CacheService.invalidateDashboard(doc.organizationId).catch(() => {});
    }).catch(() => {});
  }
});

DatasetSchema.post('findOneAndUpdate', function (doc) {
  if (doc?.organizationId) {
    import('../services/CacheService.js').then(({ CacheService }) => {
      CacheService.invalidateDashboard(doc.organizationId).catch(() => {});
    }).catch(() => {});
  }
});

DatasetSchema.post('findOneAndDelete', function (doc) {
  if (doc?.organizationId) {
    import('../services/CacheService.js').then(({ CacheService }) => {
      CacheService.invalidateDashboard(doc.organizationId).catch(() => {});
    }).catch(() => {});
  }
});

DatasetSchema.post('deleteOne', { document: true, query: false }, function (doc) {
  if (doc?.organizationId) {
    import('../services/CacheService.js').then(({ CacheService }) => {
      CacheService.invalidateDashboard(doc.organizationId).catch(() => {});
    }).catch(() => {});
  }
});

export const Dataset = mongoose.models.Dataset || mongoose.model('Dataset', DatasetSchema);
export default Dataset;
