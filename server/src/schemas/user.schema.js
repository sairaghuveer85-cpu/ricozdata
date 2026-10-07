import { z } from 'zod';
import { zObjectId } from '../middleware/validate.js';
import { USER_ROLES, USER_STATUS } from '../constants/user.js';

const VALID_ROLES = Object.values(USER_ROLES);
const VALID_STATUSES = Object.values(USER_STATUS);

export const userIdParamSchema = {
  params: z.object({
    id: zObjectId
  })
};

export const inviteUserSchema = {
  body: z.object({
    email: z.string().trim().email('Valid email address required'),
    role: z.enum(VALID_ROLES, {
      message: `Invalid role. Permitted: [${VALID_ROLES.join(', ')}]`
    })
  }).passthrough()
};

export const acceptInviteSchema = {
  body: z.object({
    name: z.string().trim().min(2, 'Full name must be at least 2 characters'),
    password: z.string().min(8, 'Password must be at least 8 characters')
  }).passthrough()
};

export const updateUserRoleSchema = {
  params: z.object({
    id: zObjectId
  }),
  body: z.object({
    role: z.enum(VALID_ROLES, {
      message: `Invalid role. Permitted: [${VALID_ROLES.join(', ')}]`
    })
  }).passthrough()
};

export const updateUserStatusSchema = {
  params: z.object({
    id: zObjectId
  }),
  body: z.object({
    status: z.enum(VALID_STATUSES, {
      message: `Invalid status. Permitted: [${VALID_STATUSES.join(', ')}]`
    })
  }).passthrough()
};
