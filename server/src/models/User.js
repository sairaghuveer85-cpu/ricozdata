import mongoose from 'mongoose';
import { USER_STATUS, USER_ROLES } from '../constants/user.js';
import { verifyPassword } from '../utils/crypto.js';

const { Schema } = mongoose;

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const UserProfileSchema = new Schema(
  {
    avatarUrl: { type: String, trim: true, default: '' },
    title: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    bio: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const UserSettingsSchema = new Schema(
  {
    theme: {
      type: String,
      enum: {
        values: ['light', 'dark', 'system'],
        message: 'Theme must be light, dark, or system'
      },
      default: 'dark'
    },
    timezone: {
      type: String,
      trim: true,
      default: 'UTC'
    },
    locale: {
      type: String,
      trim: true,
      default: 'en-US'
    },
    notifications: {
      emailAlerts: { type: Boolean, default: true },
      securityAlerts: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: false },
      slackAlerts: { type: Boolean, default: false }
    }
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory for multitenant isolation'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      minlength: [2, 'User name must be at least 2 characters'],
      maxlength: [100, 'User name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'User email is required'],
      trim: true,
      lowercase: true,
      match: [emailRegex, 'Please provide a valid email address'],
      index: true
    },
    passwordHash: {
      type: String,
      required: [
        function () {
          // Required only for active users with local auth provider; invited placeholders or OAuth users can omit
          return this.status === USER_STATUS.ACTIVE && (!this.authProvider || this.authProvider === 'local');
        },
        'Password hash is required for active local accounts'
      ],
      select: false // Never returned in default queries
    },
    authProvider: {
      type: String,
      enum: {
        values: ['local', 'google', 'oauth2', 'saml'],
        message: 'Invalid auth provider'
      },
      default: 'local',
      index: true
    },
    googleId: {
      type: String,
      trim: true,
      index: true
    },
    passwordResetTokenHash: {
      type: String,
      select: false,
      default: null
    },
    passwordResetExpiresAt: {
      type: Date,
      default: null
    },
    emailVerificationTokenHash: {
      type: String,
      select: false,
      default: null
    },
    emailVerificationOtpHash: {
      type: String,
      select: false,
      default: null
    },
    emailVerificationExpiresAt: {
      type: Date,
      default: null
    },
    emailVerificationAttempts: {
      type: Number,
      default: 0
    },
    emailVerificationSentAt: {
      type: Date,
      default: null
    },
    role: {
      type: String,
      enum: {
        values: Object.values(USER_ROLES),
        message: 'Invalid user role'
      },
      default: USER_ROLES.ANALYST,
      index: true
    },
    status: {
      type: String,
      enum: {
        values: Object.values(USER_STATUS),
        message: 'Invalid user status'
      },
      default: USER_STATUS.ACTIVE,
      set: (val) => (typeof val === 'string' ? val.toLowerCase() : val),
      index: true
    },
    department: {
      type: String,
      trim: true,
      default: ''
    },
    profile: {
      type: UserProfileSchema,
      default: () => ({})
    },
    settings: {
      type: UserSettingsSchema,
      default: () => ({})
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    emailVerifiedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.passwordResetTokenHash;
        delete ret.emailVerificationTokenHash;
        delete ret.emailVerificationOtpHash;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Multitenancy Compound Indexes
// Ensures email uniqueness per organization
UserSchema.index({ organizationId: 1, email: 1 }, { unique: true });
UserSchema.index(
  { organizationId: 1, googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } }
);
UserSchema.index({ organizationId: 1, role: 1 });
UserSchema.index({ organizationId: 1, status: 1 });
UserSchema.index({ organizationId: 1, createdAt: -1 });

// Instance method to verify password
UserSchema.methods.isValidPassword = function (candidatePassword) {
  if (!this.passwordHash) return false;
  return verifyPassword(candidatePassword, this.passwordHash);
};

// Invalidate tenant dashboard cache upon any user mutation
UserSchema.post('save', function (doc) {
  if (doc?.organizationId) {
    import('../services/CacheService.js').then(({ CacheService }) => {
      CacheService.invalidateDashboard(doc.organizationId).catch(() => {});
    }).catch(() => {});
  }
});

UserSchema.post('findOneAndUpdate', function (doc) {
  if (doc?.organizationId) {
    import('../services/CacheService.js').then(({ CacheService }) => {
      CacheService.invalidateDashboard(doc.organizationId).catch(() => {});
    }).catch(() => {});
  }
});

UserSchema.post('findOneAndDelete', function (doc) {
  if (doc?.organizationId) {
    import('../services/CacheService.js').then(({ CacheService }) => {
      CacheService.invalidateDashboard(doc.organizationId).catch(() => {});
    }).catch(() => {});
  }
});

export const User = mongoose.model('User', UserSchema);
export default User;
