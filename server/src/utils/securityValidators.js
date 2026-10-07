/**
 * Security Validators for Quality Rules, Profiling, and Custom SQL.
 * Protects against ReDoS, SQL Injection, Destructive Operations, and Runaway Execution.
 */

// Forbidden SQL statements and dangerous operational keywords
const DISALLOWED_SQL_KEYWORDS = [
  'DROP',
  'ALTER',
  'TRUNCATE',
  'DELETE',
  'UPDATE',
  'INSERT',
  'CREATE',
  'GRANT',
  'REVOKE',
  'COPY',
  'CALL',
  'EXEC',
  'EXECUTE',
  'INTO',
  'MERGE',
  'UPSERT',
  'REPLACE',
  'LOCK',
  'BEGIN',
  'COMMIT',
  'ROLLBACK',
  'SET',
  'SHOW',
  'VACUUM',
  'ANALYZE',
  'EXPLAIN',
  'DO',
  'PREPARE',
  'DEALLOCATE',
  'PG_SLEEP',
  'BENCHMARK',
  'SLEEP',
  'SHUTDOWN'
];

// Regex to detect nested/pathological quantifiers prone to catastrophic backtracking (ReDoS)
const REDOS_PATTERNS = [
  /\([^)]*[*+]\)[*+]/,       // (a+)+ or (a*)* or (.*)+
  /\([^)]*[*+][^)]*\)[*+]/,  // (a+b+)+
  /\([a-zA-Z0-9_\\]+\|[a-zA-Z0-9_\\]+\)[*+]/, // (a|a)+
  /(\.\*){2,}/,              // .*.*
  /(\.\+){2,}/,              // .+.+
  /\\d\+\\d\+/,
  /\\w\+\\w\+/
];

/**
 * Validates a regular expression pattern for length, syntax, and ReDoS safety.
 * @param {string} pattern
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateSafeRegex(pattern) {
  if (!pattern || typeof pattern !== 'string') {
    return { valid: false, error: 'Regex pattern must be a non-empty string' };
  }

  if (pattern.length > 200) {
    return { valid: false, error: 'Regex pattern exceeds maximum allowed length of 200 characters' };
  }

  // Check for known catastrophic backtracking patterns
  for (const re of REDOS_PATTERNS) {
    if (re.test(pattern)) {
      return {
        valid: false,
        error: 'Regex pattern rejected: contains potentially pathological backtracking constructs (ReDoS risk)'
      };
    }
  }

  // Verify that it is syntactically valid in JavaScript V8
  try {
    new RegExp(pattern);
  } catch (err) {
    return { valid: false, error: `Invalid regular expression syntax: ${err.message}` };
  }

  return { valid: true };
}

/**
 * Validates a Custom SQL query for strict read-only, single-statement SELECT semantics.
 * @param {string} query
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCustomSql(query) {
  if (!query || typeof query !== 'string') {
    return { valid: false, error: 'SQL query must be a non-empty string' };
  }

  const trimmed = query.trim();

  if (trimmed.length > 2000) {
    return { valid: false, error: 'SQL query exceeds maximum allowed length of 2000 characters' };
  }

  // Reject multi-statement queries (semicolon)
  // Strips trailing semicolon if present, but rejects internal semicolons
  const withoutTrailingSemicolon = trimmed.replace(/;\s*$/, '');
  if (withoutTrailingSemicolon.includes(';')) {
    return { valid: false, error: 'Multiple SQL statements are strictly forbidden' };
  }

  // Reject SQL comments that can conceal payload injection
  if (/(--|\/\*|\*\/)/.test(withoutTrailingSemicolon)) {
    return { valid: false, error: 'SQL comments are not permitted in custom quality checks' };
  }

  // Query must begin with SELECT or WITH (Common Table Expressions leading to SELECT)
  const startsWithSelectOrWith = /^(SELECT|WITH)\b/i.test(withoutTrailingSemicolon);
  if (!startsWithSelectOrWith) {
    return {
      valid: false,
      error: 'Custom SQL query must begin with SELECT or WITH (read-only query semantics only)'
    };
  }

  // Check for disallowed/destructive keywords
  // Tokenize by word boundaries
  const words = withoutTrailingSemicolon.toUpperCase().match(/\b[A-Z_]+\b/g) || [];
  for (const word of words) {
    if (DISALLOWED_SQL_KEYWORDS.includes(word)) {
      return {
        valid: false,
        error: `Disallowed SQL operation "${word}". Custom SQL must be strictly read-only.`
      };
    }
  }

  // Reject specific sensitive system table access
  const lowerQuery = withoutTrailingSemicolon.toLowerCase();
  if (
    lowerQuery.includes('pg_shadow') ||
    lowerQuery.includes('pg_authid') ||
    lowerQuery.includes('information_schema.user_privileges')
  ) {
    return {
      valid: false,
      error: 'Access to system authentication tables is prohibited'
    };
  }

  return { valid: true };
}

/**
 * Validates a host string for SSRF safety against cloud metadata, link-local,
 * and restricted network boundaries.
 * @param {string} host
 * @param {Object} [options]
 * @param {boolean} [options.allowLocal=false] - Whether to allow localhost/loopback in dev/test
 * @param {boolean} [options.enforcePublicOnly=false] - Whether to forbid internal RFC1918 private IPs
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateSafeHost(host, options = {}) {
  const { allowLocal = false, enforcePublicOnly = false } = options;

  if (!host || typeof host !== 'string') {
    return { valid: false, error: 'Host is required and must be a string' };
  }

  const cleanHost = host.trim().toLowerCase();

  // Cloud metadata services (always blocked, even in dev/test)
  const METADATA_HOSTS = [
    '169.254.169.254',
    'metadata.google.internal',
    'metadata.google',
    '169.254.169.253',
    'fd00:ec2::254'
  ];
  if (METADATA_HOSTS.includes(cleanHost) || cleanHost.startsWith('169.254.')) {
    return {
      valid: false,
      error: 'Access to cloud instance metadata services (169.254.x.x) is strictly prohibited (SSRF prevention)'
    };
  }

  // Link-local / APIPA
  if (cleanHost.startsWith('169.254.') || cleanHost.startsWith('fe80:')) {
    return { valid: false, error: 'Access to link-local IP addresses is prohibited' };
  }

  // Unroutable / reserved
  if (cleanHost === '0.0.0.0' || cleanHost.startsWith('240.') || cleanHost.startsWith('255.')) {
    return { valid: false, error: 'Access to unroutable or reserved addresses is prohibited' };
  }

  // Loopback / localhost
  const isLoopback = cleanHost === 'localhost' || cleanHost === '127.0.0.1' || cleanHost === '::1' || cleanHost.startsWith('127.');
  if (isLoopback && !allowLocal) {
    return { valid: false, error: 'Access to localhost / loopback addresses is restricted' };
  }

  // Private RFC1918 ranges
  const isPrivate = /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanHost) ||
                    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(cleanHost) ||
                    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(cleanHost);
  if (isPrivate && enforcePublicOnly) {
    return { valid: false, error: 'Access to private internal network ranges (RFC 1918) is prohibited in public mode' };
  }

  // Validate hostname format
  if (!/^[a-zA-Z0-9.-]+$/.test(cleanHost)) {
    return { valid: false, error: 'Host contains invalid characters' };
  }

  return { valid: true };
}

export default {
  validateSafeRegex,
  validateCustomSql,
  validateSafeHost
};
