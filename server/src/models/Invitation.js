import mongoose from 'mongoose';
import { INVITATION_STATUS, USER_ROLES } from '../constants/user.js';

const { Schema } = mongoose;

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const InvitationSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is mandatory for team invitations'],
      index: true
    },
    email: {
      type: String,
      required: [true, 'Invitation email is required'],
      trim: true,
      lowercase: true,
      match: [emailRegex, 'Please provide a valid email address'],
      index: true
    },
    role: {
      type: String,
      enum: {
        values: Object.values(USER_ROLES),
        message: 'Invalid role for invitation'
      },
      default: USER_ROLES.VIEWER,
      index: true
    },
    department: {
      type: String,
      trim: true,
      default: ''
    },
    tokenHash: {
      type: String,
      required: [true, 'Invitation token hash is mandatory'],
      unique: true,
      select: false // Never exposed in queries by default
    },
    inviterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: {
        values: Object.values(INVITATION_STATUS),
        message: 'Invalid invitation status'
      },
      default: INVITATION_STATUS.PENDING,
      index: true
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration timestamp is required'],
      index: true
    },
    acceptedAt: {
      type: Date,
      default: null
    },
    revokedAt: {
      type: Date,
      default: null
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

// Compound Indexes for fast tenant scoping and duplicate invitation prevention
InvitationSchema.index({ organizationId: 1, email: 1, status: 1 });
InvitationSchema.index({ organizationId: 1, createdAt: -1 });

// Helper to determine if invitation has expired
InvitationSchema.methods.isExpired = function () {
  return new Date() > this.expiresAt;
};

export const Invitation = mongoose.model('Invitation', InvitationSchema);
export default Invitation;
