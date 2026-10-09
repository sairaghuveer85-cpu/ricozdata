const mongoose = require('mongoose');

const dataSourceSchema = new mongoose.Schema(
  {
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
      enum: [
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
        'salesforce',
        'sap',
        'workday',
        'hubspot',
        'other'
      ],
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
      set: (v) => (typeof v === 'string' ? v.toUpperCase().trim() : 'ACTIVE'),
      enum: ['ACTIVE', 'INACTIVE', 'ERROR', 'PENDING', 'DISCONNECTED', 'CONNECTED', 'TESTING'],
      default: 'CONNECTED',
      index: true
    },
    healthStatus: {
      type: String,
      enum: ['HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNTESTED'],
      default: 'HEALTHY'
    },
    connectionState: {
      type: String,
      enum: ['CONNECTED', 'DISCONNECTED', 'FAILED', 'ERROR'],
      default: 'CONNECTED'
    },
    configuration: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    connectionConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    credentials: {
      type: mongoose.Schema.Types.Mixed,
      select: false, // Never expose raw credentials in query results
      default: {}
    },
    credentialStatus: {
      type: String,
      enum: ['configured', 'missing', 'vault_reference'],
      default: 'configured'
    },
    tablesCount: {
      type: Number,
      default: 0
    },
    tags: [{ type: String, trim: true }],
    lastTestedAt: {
      type: Date,
      default: Date.now
    },
    lastTestLatencyMs: {
      type: Number,
      default: null
    },
    lastError: {
      type: String,
      default: null
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      index: true
    }
  },
  {
    timestamps: true
  }
);

const encryptionService = require('../services/encryptionService');

// Pre-save hook: automatically encrypt credentials with AES-256-GCM if set as plaintext
dataSourceSchema.pre('save', function (next) {
  if (this.isModified('credentials') && this.credentials) {
    if (!encryptionService.isEncrypted(this.credentials)) {
      this.setCredentials(this.credentials);
    }
  }
  if (typeof next === 'function') {
    next();
  }
});

/**
 * Encrypt and store raw credentials using AES-256-GCM envelope encryption.
 * Never stores plaintext credentials in MongoDB.
 *
 * @param {Object|string} rawCredentials
 * @param {string} [keyId]
 */
dataSourceSchema.methods.setCredentials = function (rawCredentials, keyId = null) {
  if (!rawCredentials || (typeof rawCredentials === 'object' && Object.keys(rawCredentials).length === 0)) {
    this.credentials = {
      type: 'none',
      isConfigured: false,
      encryptedData: null,
      keyId: null
    };
    this.credentialStatus = 'missing';
    return;
  }

  // If already encrypted payload, preserve it
  if (encryptionService.isEncrypted(rawCredentials)) {
    const encryptedData = typeof rawCredentials === 'string' ? rawCredentials : rawCredentials.encryptedData;
    this.credentials = {
      type: 'encrypted_payload',
      isConfigured: true,
      encryptedData,
      keyId: rawCredentials.keyId || 'KEY_V1'
    };
    this.credentialStatus = 'configured';
    return;
  }

  const bundle = encryptionService.encrypt(rawCredentials, { keyId });
  this.credentials = {
    type: 'encrypted_payload',
    isConfigured: true,
    encryptedData: bundle.serialized,
    keyId: bundle.keyId
  };
  this.credentialStatus = 'configured';
};

/**
 * Decrypt stored credentials in server-side execution memory using AES-256-GCM.
 * Never leaks decrypted credentials to HTTP responses or logs.
 *
 * @returns {Object|null} Decrypted credentials
 */
dataSourceSchema.methods.getDecryptedCredentials = function () {
  if (!this.credentials) {
    return null;
  }

  // Case 1: Structured encrypted_payload
  if (this.credentials.encryptedData && typeof this.credentials.encryptedData === 'string') {
    return encryptionService.decrypt(this.credentials.encryptedData, { asJson: true });
  }

  // Case 2: String serialization enc:v1:...
  if (typeof this.credentials === 'string' && this.credentials.startsWith('enc:v')) {
    return encryptionService.decrypt(this.credentials, { asJson: true });
  }

  // Case 3: Legacy or unencrypted object { username, password }
  if (typeof this.credentials === 'object') {
    return { ...this.credentials };
  }

  return null;
};

// Redact credentials in JSON output
dataSourceSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.credentials;
  obj.credentialStatus = obj.credentialStatus || 'configured';
  return obj;
};

module.exports = mongoose.models.DataSource || mongoose.model('DataSource', dataSourceSchema);

