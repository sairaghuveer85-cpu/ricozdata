/**
 * Normalized Connector Errors for RicozData.
 * These errors normalize driver-specific exceptions into structured, safe errors
 * without leaking raw driver stack traces, credentials, or internal connection strings.
 */

export class ConnectorError extends Error {
  /**
   * @param {string} message - Safe user/operator message
   * @param {string} code - Machine-readable error code
   * @param {number} [statusCode=500] - Suggested HTTP status code
   * @param {Object} [details={}] - Non-sensitive context details
   */
  constructor(message, code = 'CONNECTOR_ERROR', statusCode = 500, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    };
  }
}

export class ConnectorConfigurationError extends ConnectorError {
  constructor(message = 'Invalid data source connector configuration', details = {}) {
    super(message, 'CONNECTOR_CONFIGURATION_ERROR', 400, details);
  }
}

export class ConnectorAuthenticationError extends ConnectorError {
  constructor(message = 'Failed to authenticate with data source', details = {}) {
    super(message, 'CONNECTOR_AUTHENTICATION_ERROR', 401, details);
  }
}

export class ConnectorTimeoutError extends ConnectorError {
  constructor(message = 'Connection or query to data source timed out', details = {}) {
    super(message, 'CONNECTOR_TIMEOUT_ERROR', 504, details);
  }
}

export class ConnectorUnavailableError extends ConnectorError {
  constructor(message = 'Target data source host is unreachable or unavailable', details = {}) {
    super(message, 'CONNECTOR_UNAVAILABLE_ERROR', 503, details);
  }
}

export class ConnectorPermissionError extends ConnectorError {
  constructor(message = 'Insufficient permissions on data source to perform operation', details = {}) {
    super(message, 'CONNECTOR_PERMISSION_ERROR', 403, details);
  }
}

export class ConnectorQueryError extends ConnectorError {
  constructor(message = 'Failed to execute query against data source', details = {}) {
    super(message, 'CONNECTOR_QUERY_ERROR', 502, details);
  }
}

export class ConnectorUnsupportedError extends ConnectorError {
  constructor(message = 'Requested operation or source type is not supported by connector', details = {}) {
    super(message, 'CONNECTOR_UNSUPPORTED_ERROR', 501, details);
  }
}
