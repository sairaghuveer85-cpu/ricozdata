import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Enterprise Session & Refresh Token Model for RicozData.
 * Implements token families, rotation tracking, revocation, and reuse detection.
 * Raw refresh tokens are NEVER stored in MongoDB — only cryptographic SHA-256 hashes.
 */
const SessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for session'],
      index: true
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required for session'],
      index: true
    },
    tokenHash: {
      type: String,
      required: [true, 'Token hash is required'],
      unique: true,
      index: true,
      select: false // Never exposed in queries by default
    },
    tokenFamilyId: {
      type: String,
      required: [true, 'Token family identifier is required'],
      index: true
    },
    expiresAt: {
      type: Date,
      required: [true, 'Session expiration timestamp is required'],
      index: true
    },
    lastUsedAt: {
      type: Date,
      default: Date.now
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true
    },
    revokedReason: {
      type: String,
      default: null
    },
    replacedBy: {
      type: String,
      default: null
    },
    userAgent: {
      type: String,
      default: ''
    },
    ipAddress: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.tokenHash;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Compound indexes supporting session queries, lookup, and security enforcement
SessionSchema.index({ userId: 1, organizationId: 1 });

// Helper to determine if session is currently valid and active
SessionSchema.methods.isActive = function () {
  return !this.revokedAt && new Date() < this.expiresAt;
};

// Helper to check if session has expired
SessionSchema.methods.isExpired = function () {
  return new Date() >= this.expiresAt;
};

export const Session = mongoose.model('Session', SessionSchema);
export default Session;
