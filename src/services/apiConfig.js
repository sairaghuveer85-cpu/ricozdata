/**
 * Centralized API & Backend URL resolution for RicozData frontend.
 *
 * Environment variables:
 * - VITE_API_URL: Full base URL to the API (e.g. 'http://3.110.165.162:5000/api')
 * - VITE_BACKEND_URL: Base URL to the backend host (e.g. 'http://3.110.165.162:5000')
 *
 * Behavior:
 * - In local development: Values are loaded from local .env (defaults to localhost:5000 via .env)
 * - In production (Vercel): Values are provided by Vercel project environment variables at build time
 * - Supports automatic cross-derivation if only one of VITE_API_URL or VITE_BACKEND_URL is set
 * - Removes hardcoded fallback to localhost:5000 from runtime code
 */

// Direct property access for static analysis and build-time substitution by Vite
const rawApiEnv = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';
const rawBackendEnv = import.meta.env.VITE_BACKEND_URL || '';

function resolveEnvironmentUrls() {
  const cleanApi = typeof rawApiEnv === 'string' ? rawApiEnv.trim().replace(/\/+$/, '') : '';
  const cleanBackend = typeof rawBackendEnv === 'string' ? rawBackendEnv.trim().replace(/\/+$/, '') : '';

  let backend = cleanBackend;
  let api = cleanApi;

  // If backend URL is set but API URL is not, derive API URL by appending /api
  if (backend && !api) {
    api = `${backend}/api`;
  }

  // If API URL is set but backend URL is not, derive backend URL by stripping /api
  if (api && !backend) {
    backend = api.replace(/\/api(\/v\d+)?\/?$/, '');
  }

  // Ensure API URL has /api path if not already versioned or rooted
  if (api && !api.endsWith('/api') && !/\/api\/v\d+$/.test(api)) {
    api = `${api}/api`;
  }

  // If neither variable was provided (e.g. missing environment configuration):
  // Fall back to relative /api without hardcoding localhost:5000 into production bundles
  if (!api && !backend) {
    api = '/api';
    backend = '';
    if (import.meta.env.DEV) {
      console.warn('[RicozData API] Neither VITE_API_URL nor VITE_BACKEND_URL is defined. Please ensure your .env file is set up.');
    }
  }

  return { backendUrl: backend, apiUrl: api };
}

const { backendUrl, apiUrl } = resolveEnvironmentUrls();

export const BACKEND_URL = backendUrl;
export const API_BASE_URL = apiUrl;

/**
 * Builds a normalized, fully qualified URL for any given API endpoint.
 *
 * @param {string} endpoint - Path such as '/auth/login', '/api/users', or an absolute URL
 * @returns {string} Fully qualified or normalized URL
 */
export function buildApiUrl(endpoint) {
  if (!endpoint) return API_BASE_URL;

  // If already an absolute URL, return as-is
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // If endpoint already starts with /api (e.g. /api/auth/refresh)
  if (cleanEndpoint.startsWith('/api')) {
    return BACKEND_URL ? `${BACKEND_URL}${cleanEndpoint}` : cleanEndpoint;
  }

  // Standard endpoint (e.g. /auth/login) -> append to API_BASE_URL
  return `${API_BASE_URL}${cleanEndpoint}`;
}

export default {
  BACKEND_URL,
  API_BASE_URL,
  buildApiUrl
};
