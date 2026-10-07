import config from '../config/env.js';
import { TENANT_HEADERS, TENANT_RESOLUTION_SOURCE } from '../constants/tenant.js';
import { getTenantBySlug, getTenantById } from '../services/tenant.service.js';
import tokenService from '../services/token.service.js';
import User from '../models/User.js';
import { TenantConflictError, TenantNotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';

// Reserved subdomains that do not map to tenant organizations
const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'admin',
  'app',
  'mail',
  'static',
  'assets',
  'staging',
  'dev'
]);

/**
 * Safely extracts the subdomain identifier from the incoming HTTP request host.
 * Supports production domains (e.g. acme.ricozdata.io) and local development (e.g. acme.localhost).
 */
export function extractSubdomainFromHost(req, baseDomain = config.tenant.baseDomain) {
  // Inspect x-forwarded-host (proxy / gateway / client), then host header or req.hostname
  const hostCandidate =
    req.headers['x-forwarded-host'] ||
    req.headers.host ||
    req.hostname ||
    '';

  const rawHost = String(hostCandidate).split(',')[0].split(':')[0].toLowerCase().trim();

  if (!rawHost) {
    return null;
  }

  // Handle local development: *.localhost (e.g. acme.localhost)
  if (rawHost.endsWith('.localhost')) {
    const parts = rawHost.split('.');
    if (parts.length === 2 && parts[0] && !RESERVED_SUBDOMAINS.has(parts[0])) {
      return parts[0];
    }
  }

  // Handle configured base domain (e.g. acme.ricozdata.io)
  const normalizedBase = baseDomain.toLowerCase().trim();
  if (rawHost.endsWith(`.${normalizedBase}`)) {
    const subdomainPart = rawHost.slice(0, -(normalizedBase.length + 1));
    const subdomains = subdomainPart.split('.');
    const candidate = subdomains[subdomains.length - 1];

    if (candidate && !RESERVED_SUBDOMAINS.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Centralized Tenant Context Middleware.
 * Implements deterministic tenant resolution with conflict detection and defense against header impersonation.
 */
export function tenantContextMiddleware() {
  return async (req, res, next) => {
    try {
      // Initialize canonical request tenant fields
      req.organizationId = null;
      req.organization = null;
      req.tenant = null;
      req.tenantResolutionSource = TENANT_RESOLUTION_SOURCE.NONE;

      let resolvedOrg = null;
      let resolutionSource = TENANT_RESOLUTION_SOURCE.NONE;

      // ------------------------------------------------------------------
      // Priority 1: Authenticated User Tenant Context (when auth is present)
      // ------------------------------------------------------------------
      if (!req.user && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        try {
          const rawToken = req.headers.authorization.slice(7).trim();
          if (rawToken) {
            const decoded = tokenService.verifyAccessToken(rawToken);
            if (decoded && decoded.userId) {
              const authUser = await User.findById(decoded.userId);
              if (authUser && authUser.status !== 'suspended' && authUser.status !== 'deactivated') {
                req.user = authUser;
                req.userId = authUser._id.toString();
              }
            }
          }
        } catch {
          // Token verification errors will be handled properly downstream
        }
      }

      if (req.user?.organizationId) {
        resolvedOrg = await getTenantById(req.user.organizationId, { validateStatus: true });
        if (resolvedOrg) {
          resolutionSource = TENANT_RESOLUTION_SOURCE.AUTHENTICATED;
        }
      }

      // ------------------------------------------------------------------
      // Priority 2: Trusted Internal Tenant Header
      // Requires cryptographically or operationally verified secret.
      // Arbitrary untrusted client headers are strictly rejected or ignored.
      // ------------------------------------------------------------------
      const headerSlug = req.headers[TENANT_HEADERS.SLUG];
      const headerId = req.headers[TENANT_HEADERS.ID];
      const internalSecret = req.headers[TENANT_HEADERS.INTERNAL_SECRET];

      const isTrustedHeader =
        config.tenant.allowTrustedHeader &&
        Boolean(config.tenant.trustedInternalSecret) &&
        internalSecret === config.tenant.trustedInternalSecret;

      if ((headerSlug || headerId) && isTrustedHeader) {
        let headerOrg = null;
        if (headerId) {
          headerOrg = await getTenantById(headerId, { validateStatus: true });
        } else if (headerSlug) {
          headerOrg = await getTenantBySlug(headerSlug, { validateStatus: true });
        }

        if (headerOrg) {
          // Check for conflict with authenticated context
          if (resolvedOrg && resolvedOrg._id.toString() !== headerOrg._id.toString()) {
            throw new TenantConflictError(
              `Tenant conflict: Authenticated organization (${resolvedOrg.slug}) does not match trusted header tenant (${headerOrg.slug})`
            );
          }

          if (!resolvedOrg) {
            resolvedOrg = headerOrg;
            resolutionSource = TENANT_RESOLUTION_SOURCE.TRUSTED_HEADER;
          }
        }
      } else if (headerSlug || headerId) {
        // Log untrusted header attempt for security telemetry without accepting it
        logger.debug(
          `[TenantSecurity] Ignored untrusted client tenant header (${TENANT_HEADERS.SLUG}: "${headerSlug}") without valid internal credentials.`
        );
      }

      // ------------------------------------------------------------------
      // Priority 3: Subdomain-based Tenant Routing
      // e.g. acme.localhost or acme.ricozdata.io
      // ------------------------------------------------------------------
      const subdomain = extractSubdomainFromHost(req);
      if (subdomain) {
        const subdomainOrg = await getTenantBySlug(subdomain, { validateStatus: true });

        if (!subdomainOrg) {
          // If a specific subdomain was provided in host but doesn't exist, reject explicitly
          throw new TenantNotFoundError(`No organization found for subdomain "${subdomain}"`);
        }

        // Check for conflict with higher-priority source
        if (resolvedOrg && resolvedOrg._id.toString() !== subdomainOrg._id.toString()) {
          throw new TenantConflictError(
            `Tenant conflict: Context from ${resolutionSource} (${resolvedOrg.slug}) does not match host subdomain (${subdomainOrg.slug})`
          );
        }

        if (!resolvedOrg) {
          resolvedOrg = subdomainOrg;
          resolutionSource = TENANT_RESOLUTION_SOURCE.SUBDOMAIN;
        }
      }

      // ------------------------------------------------------------------
      // Canonical Internal Representation
      // ------------------------------------------------------------------
      if (resolvedOrg) {
        req.organization = resolvedOrg;
        req.tenant = resolvedOrg;
        req.organizationId = resolvedOrg._id.toString();
        req.tenantResolutionSource = resolutionSource;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export default tenantContextMiddleware;
