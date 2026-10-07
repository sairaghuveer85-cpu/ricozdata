import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Reusable Zod validator for MongoDB ObjectIds.
 */
export const zObjectId = z.string().trim().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  { message: 'Invalid MongoDB ObjectId identifier format' }
);

/**
 * Enterprise Request Validation Middleware using Zod.
 * Validates request body, params, query, and headers.
 * Strips unknown fields by default to prevent mass assignment attacks.
 *
 * @param {Object} schemas
 * @param {import('zod').ZodSchema} [schemas.body]
 * @param {import('zod').ZodSchema} [schemas.params]
 * @param {import('zod').ZodSchema} [schemas.query]
 * @param {import('zod').ZodSchema} [schemas.headers]
 */
export function validateRequest(schemas = {}) {
  return async (req, res, next) => {
    try {
      if (schemas.params) {
        const parsedParams = await schemas.params.parseAsync(req.params);
        req.params = parsedParams;
      }

      if (schemas.query) {
        const parsedQuery = await schemas.query.parseAsync(req.query);
        req.query = parsedQuery;
      }

      if (schemas.body) {
        const parsedBody = await schemas.body.parseAsync(req.body);
        req.body = parsedBody;
      }

      if (schemas.headers) {
        await schemas.headers.parseAsync(req.headers);
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code
        }));

        const primaryMessage = details[0]
          ? `${details[0].field ? details[0].field + ': ' : ''}${details[0].message}`
          : 'Request validation failed';

        return res.status(400).json({
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: primaryMessage,
            details
          },
          meta: {},
          message: primaryMessage
        });
      }

      next(error);
    }
  };
}

export default validateRequest;
