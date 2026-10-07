import mongoose from 'mongoose';
import encryptionService from '../services/encryption/encryption.service.js';

const { Schema } = mongoose;

const DataSourceSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory for multitenant isolation'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Data source name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    type: {
      type: String,
      required: [true, 'Data source type is required'],
      set: (v) => (typeof v === 'string' ? v.toLowerCase().trim() : v),
      enum: {
        values: [
          'postgresql',
          'mysql',
          'snowflake',
          'bigquery',
          'redshift',
          'mongodb',
          's3',
          'kafka',
          'api',
          'oracle',
          'sqlserver',
          'other'
        ],
        message: 'Unsupported data source type'
      },
      index: true
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    status: {
      type: String,
      set: (v) => (typeof v === 'string' ? v.toUpperCase().trim() : v),
      enum: {
        values: [
          'ACTIVE',
          'INACTIVE',
          'ERROR',
          'PENDING',
          'DISCONNECTED',
          'CONNECTED',
          'TESTING',
          'active',
          'inactive',
          'error',
          'pending',
          'disconnected',
          'connected',
          'testing'
        ],
        message: 'Invalid data source status'
      },
      default: 'DISCONNECTED',
      index: true
    },
    configuration: {
      type: Schema.Types.Mixed,
      default: {}
    },
    connectionConfig: {
      type: Schema.Types.Mixed,
      default: {}
    },
    credentials: {
      type: {
        type: String,
        enum: ['vault_reference', 'encrypted_payload', 'iam_role', 'none'],
        default: 'none'
      },
      isConfigured: {
        type: Boolean,
        default: false
      },
      // Encrypted ciphertext ready for envelope encryption (AES-256-GCM)
      // Stripped by default from queries for defense-in-depth security
      encryptedData: {
        type: String,
        select: false
      },
      keyId: {
        type: String,
        select: false
      },
      secretArn: { type: String }
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    healthStatus: {
      type: String,
      set: (v) => (typeof v === 'string' ? v.toUpperCase().trim() : v),
      enum: {
        values: ['UNKNOWN', 'HEALTHY', 'UNHEALTHY', 'DEGRADED', 'UNTESTED', 'ERROR'],
        message: 'Invalid health status'
      },
      default: 'UNTESTED',
      index: true
    },
    lastTestedAt: {
      type: Date,
      default: null
    },
    lastTestLatencyMs: {
      type: Number,
      default: null
    },
    lastTestError: {
      type: String,
      default: null
    },
    connectionState: {
      type: String,
      set: (v) => (typeof v === 'string' ? v.toUpperCase().trim() : v),
      enum: {
        values: ['DISCONNECTED', 'CONNECTED', 'CONNECTING', 'ERROR', 'UNKNOWN'],
        message: 'Invalid connection state'
      },
      default: 'DISCONNECTED'
    },
    lastSyncAt: {
      type: Date,
      default: null
    },
    syncStatus: {
      type: String,
      enum: ['idle', 'running', 'success', 'failed'],
      default: 'idle'
    },
    syncStats: {
      datasetsCount: { type: Number, default: 0 },
      lastError: { type: String, default: null }
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
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    tags: [
      {
        type: String,
        trim: true
      }
    ],
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
        // Redact any encrypted data, secrets, or internal key information
        const isConfigured = Boolean(
          (doc.credentials && (doc.credentials.isConfigured || doc.credentials.encryptedData)) ||
          (ret.credentials && (ret.credentials.isConfigured || ret.credentials.encryptedData))
        );

        if (ret.credentials) {
          delete ret.credentials.encryptedData;
          delete ret.credentials.keyId;
          delete ret.credentials.password;
          delete ret.credentials.apiKey;
          delete ret.credentials.clientSecret;
          delete ret.credentials.token;
          delete ret.credentials.secretKey;
          delete ret.credentials.isConfigured;
          ret.credentials.credentialStatus = isConfigured ? 'configured' : 'none';
        }

        ret.credentialStatus = isConfigured ? 'configured' : 'none';

        // Keep connectionConfig and configuration synced
        if (ret.configuration && (!ret.connectionConfig || Object.keys(ret.connectionConfig).length === 0)) {
          ret.connectionConfig = ret.configuration;
        } else if (ret.connectionConfig && (!ret.configuration || Object.keys(ret.configuration).length === 0)) {
          ret.configuration = ret.connectionConfig;
        }

        delete ret.__v;
        return ret;
      }
    }
  }
);

// Pre-save synchronization hook between configuration and connectionConfig
DataSourceSchema.pre('save', function (next) {
  if (this.configuration && Object.keys(this.configuration).length > 0 && (!this.connectionConfig || Object.keys(this.connectionConfig).length === 0)) {
    this.connectionConfig = this.configuration;
  } else if (this.connectionConfig && Object.keys(this.connectionConfig).length > 0 && (!this.configuration || Object.keys(this.configuration).length === 0)) {
    this.configuration = this.connectionConfig;
  }
  if (!this.ownerId && this.createdBy) {
    this.ownerId = this.createdBy;
  }
  if (!this.createdBy && this.ownerId) {
    this.createdBy = this.ownerId;
  }
  if (typeof next === 'function') {
    next();
  }
});

// Multitenancy Compound Indexes
// Ensures active data source names are unique within a single organization
DataSourceSchema.index({ organizationId: 1, name: 1 }, { unique: true });
DataSourceSchema.index({ organizationId: 1, type: 1 });
DataSourceSchema.index({ organizationId: 1, status: 1 });
DataSourceSchema.index({ organizationId: 1, isDeleted: 1 });
DataSourceSchema.index({ organizationId: 1, tags: 1 });
DataSourceSchema.index({ organizationId: 1, createdAt: -1 });

/**
 * Encrypt and store raw credentials using AES-256-GCM.
 * Never stores plaintext credentials in MongoDB.
 *
 * @param {Object|string} rawCredentials
 * @param {string} [keyId]
 */
DataSourceSchema.methods.setCredentials = function (rawCredentials, keyId = null) {
  if (!rawCredentials) {
    this.credentials = {
      type: 'none',
      isConfigured: false,
      encryptedData: null,
      keyId: null
    };
    return;
  }

  const bundle = encryptionService.encrypt(rawCredentials, { keyId });
  this.credentials = {
    type: 'encrypted_payload',
    isConfigured: true,
    encryptedData: bundle.serialized,
    keyId: bundle.keyId
  };
};

/**
 * Decrypt stored credentials in server-side execution memory.
 * Never leak decrypted credentials to HTTP responses or logs.
 *
 * @param {Object} [options]
 * @returns {Object|string|null} Decrypted credentials
 */
DataSourceSchema.methods.getDecryptedCredentials = function (options = {}) {
  const encryptedPayload = this.credentials?.encryptedData;
  if (!encryptedPayload) {
    return null;
  }

  return encryptionService.decrypt(encryptedPayload, { asJson: true, ...options });
};

/**
 * Rotate stored credentials to a new key version without plaintext exposure.
 *
 * @param {string} [targetKeyId]
 */
DataSourceSchema.methods.rotateCredentials = function (targetKeyId = null) {
  const currentEncrypted = this.credentials?.encryptedData;
  if (!currentEncrypted) {
    return;
  }

  const newBundle = encryptionService.rotate(currentEncrypted, targetKeyId);
  this.credentials.encryptedData = newBundle.serialized;
  this.credentials.keyId = newBundle.keyId;
};

// Invalidate tenant dashboard cache upon any data source mutation
DataSourceSchema.post('save', function (doc) {
  if (doc?.organizationId) {
    import('../services/CacheService.js').then(({ CacheService }) => {
      CacheService.invalidateDashboard(doc.organizationId).catch(() => {});
    }).catch(() => {});
  }
});

DataSourceSchema.post('findOneAndUpdate', function (doc) {
  if (doc?.organizationId) {
    import('../services/CacheService.js').then(({ CacheService }) => {
      CacheService.invalidateDashboard(doc.organizationId).catch(() => {});
    }).catch(() => {});
  }
});

DataSourceSchema.post('findOneAndDelete', function (doc) {
  if (doc?.organizationId) {
    import('../services/CacheService.js').then(({ CacheService }) => {
      CacheService.invalidateDashboard(doc.organizationId).catch(() => {});
    }).catch(() => {});
  }
});

export const DataSource = mongoose.models.DataSource || mongoose.model('DataSource', DataSourceSchema);
export default DataSource;
