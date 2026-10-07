/**
 * Standardized application error hierarchy for RicozData backend.
 * Distinguishes operational (expected) errors from programmer bugs.
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details = null) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access', details = null) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', errorCode = 'FORBIDDEN', details = null) {
    if (typeof errorCode === 'object' && errorCode !== null) {
      super(message, 403, 'FORBIDDEN', errorCode);
    } else {
      super(message, 403, errorCode || 'FORBIDDEN', details);
    }
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = null) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details = null) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error', details = null) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
  }
}

export class TenantNotFoundError extends AppError {
  constructor(message = 'Organization / Tenant not found', details = null) {
    super(message, 404, 'TENANT_NOT_FOUND', details);
  }
}

export class TenantSuspendedError extends AppError {
  constructor(message = 'Organization access is suspended. Please contact platform support.', details = null) {
    super(message, 403, 'TENANT_SUSPENDED', details);
  }
}

export class TenantPendingError extends AppError {
  constructor(message = 'Organization account is pending activation.', details = null) {
    super(message, 403, 'TENANT_PENDING', details);
  }
}

export class TenantConflictError extends AppError {
  constructor(message = 'Conflicting tenant context detected across request sources', details = null) {
    super(message, 403, 'TENANT_CONTEXT_CONFLICT', details);
  }
}

export class TenantRequiredError extends AppError {
  constructor(message = 'Tenant context is required for this operation', details = null) {
    super(message, 400, 'TENANT_CONTEXT_REQUIRED', details);
  }
}

export class TenantPayloadMismatchError extends AppError {
  constructor(message = 'Payload organizationId does not match current tenant context', details = null) {
    super(message, 403, 'TENANT_PAYLOAD_MISMATCH', details);
  }
}
