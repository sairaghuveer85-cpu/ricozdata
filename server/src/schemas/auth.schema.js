import { z } from 'zod';

export const loginSchema = {
  body: z.object({
    email: z.string().trim().email('A valid email address is required'),
    password: z.string().min(1, 'Password is required')
  }).passthrough()
};

export const refreshSchema = {
  body: z.object({
    refreshToken: z.string().optional()
  }).passthrough()
};
