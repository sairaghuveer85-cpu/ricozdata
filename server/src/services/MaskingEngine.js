import crypto from 'crypto';

export class MaskingEngine {
  /**
   * Applies a specific masking strategy to a single raw value.
   * 
   * @param {any} value
   * @param {string} strategy - 'REDACT' | 'PARTIAL' | 'HASH' | 'TOKENIZED'
   * @returns {string} Masked string representation
   */
  static maskValue(value, strategy) {
    return this.applyMasking(value, strategy);
  }

  static applyMasking(value, strategy) {
    if (value === null || value === undefined) {
      return value;
    }

    const strVal = String(value);
    const upperStrategy = String(strategy || 'REDACT').toUpperCase();

    switch (upperStrategy) {
      case 'REDACT':
        return '[REDACTED]';

      case 'PARTIAL': {
        // Email masking: ravi@example.com -> r***@example.com
        if (strVal.includes('@')) {
          const [user, domain] = strVal.split('@');
          const maskedUser = user.length > 1
            ? `${user[0]}***${user[user.length - 1]}`
            : `${user}***`;
          return `${maskedUser}@${domain}`;
        }

        // Phone or numeric digits: 9876543210 -> ******3210
        if (/^\d+$/.test(strVal)) {
          if (strVal.length > 4) {
            return '*'.repeat(strVal.length - 4) + strVal.slice(-4);
          }
          return '****';
        }

        // General text: First character + *** + Last character
        if (strVal.length > 2) {
          return `${strVal[0]}***${strVal[strVal.length - 1]}`;
        }
        return '***';
      }

      case 'HASH': {
        const hash = crypto.createHash('sha256').update(strVal).digest('hex').substring(0, 16);
        return `[HASH:${hash}]`;
      }

      case 'TOKENIZED': {
        const tokenHash = crypto.createHash('md5').update(strVal).digest('hex').substring(0, 8).toUpperCase();
        return `[TOKEN:TK-${tokenHash}]`;
      }

      default:
        return '[REDACTED]';
    }
  }

  /**
   * Masks a list of record objects against active masking policies for a user role.
   * 
   * @param {Array<Object>} records
   * @param {Array<Object>} policies
   * @param {string} userRole
   * @returns {Array<Object>} Records with sensitive columns masked
   */
  static maskRecords(records, policies, userRole) {
    if (!Array.isArray(records) || records.length === 0) return records;
    if (!Array.isArray(policies) || policies.length === 0) return records;

    const normalizedRole = String(userRole || '').toLowerCase();

    // Filter policies applicable to this role
    const activePolicies = policies.filter((p) => {
      if (!p.enabled) return false;
      const targetRoles = (p.roles || []).map((r) => r.toLowerCase());
      // If no specific roles defined, applies to non-admin roles (viewer, analyst, etc.)
      if (targetRoles.length === 0) {
        return !['admin', 'owner'].includes(normalizedRole);
      }
      return targetRoles.includes(normalizedRole);
    });

    if (activePolicies.length === 0) return records;

    // Policy map: column name -> policy
    const policyMap = new Map();
    activePolicies.forEach((p) => {
      policyMap.set(p.column.toLowerCase(), p);
    });

    return records.map((record) => {
      if (!record || typeof record !== 'object') return record;
      const masked = { ...record };

      for (const [key, val] of Object.entries(masked)) {
        const policy = policyMap.get(key.toLowerCase());
        if (policy) {
          masked[key] = MaskingEngine.applyMasking(val, policy.maskingType);
        }
      }

      return masked;
    });
  }
}

export default MaskingEngine;
