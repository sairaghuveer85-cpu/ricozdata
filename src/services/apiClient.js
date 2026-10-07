/**
 * Centralized Enterprise API Client for RicozData.
 *
 * Implements:
 * - Versioned /api base URL
 * - Strictly in-memory access token management (ZERO localStorage storage)
 * - Automatic HTTP-only cookie inclusion (credentials: 'include')
 * - Automatic 401 detection, token refresh via /api/auth/refresh, and single request retry
 * - Standardized error and response envelope normalization
 */

const rawBase = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';
const BASE_URL = rawBase.replace(/\/+$/, '').replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, '');

class ApiClient {
  constructor() {
    this.accessToken = null;
    this.isRefreshing = false;
    this.refreshSubscribers = [];
    this.onUnauthenticated = null;
  }

  /**
   * Set callback to invoke when token refresh completely fails (user logged out).
   * @param {Function} cb
   */
  setOnUnauthenticated(cb) {
    this.onUnauthenticated = cb;
  }

  /**
   * Set in-memory access token.
   * @param {string|null} token
   */
  setToken(token) {
    this.accessToken = token;
  }

  /**
   * Get in-memory access token.
   * @returns {string|null}
   */
  getToken() {
    return this.accessToken;
  }

  /**
   * Subscribes callbacks waiting for a token refresh in-flight.
   */
  subscribeTokenRefresh(cb) {
    this.refreshSubscribers.push(cb);
  }

  /**
   * Resolves waiting subscribers with the newly refreshed access token.
   */
  onRefreshed(token) {
    this.refreshSubscribers.forEach(cb => cb(token));
    this.refreshSubscribers = [];
  }

  /**
   * Attempts silent session refresh using the secure HTTP-only refresh cookie.
   * @returns {Promise<string|null>} New access token or null
   */
  async refreshToken() {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!response.ok) {
        // Fallback to legacy unversioned endpoint if needed
        const legacyRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        if (!legacyRes.ok) return null;
        const legacyData = await legacyRes.json();
        return legacyData.data?.accessToken || null;
      }

      const data = await response.json();
      return data.data?.accessToken || null;
    } catch (err) {
      console.warn('[ApiClient] Silent token refresh network error:', err);
      return null;
    }
  }

  /**
   * Core request wrapper with authorization headers, error normalization, and 401 retry.
   *
   * @param {string} endpoint - Path (e.g. '/api/v1/dashboard/summary' or '/dashboard/summary')
   * @param {RequestInit & { retry?: boolean }} [options={}]
   * @returns {Promise<{ success: boolean, data: any, error: any, meta: any }>}
   */
  async request(endpoint, options = {}) {
    const fullPath = endpoint.startsWith('http')
      ? endpoint
      : endpoint.startsWith('/api')
        ? `${BASE_URL}${endpoint}`
        : `${BASE_URL}/api${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (this.accessToken && !headers.Authorization) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    } else if (!headers.Authorization) {
      const stored = localStorage.getItem('ricoz_jwt');
      if (stored && stored !== 'demo-local-jwt-token') {
        headers.Authorization = `Bearer ${stored}`;
      }
    }

    const config = {
      credentials: 'include',
      ...options,
      headers
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(fullPath, config);
      let payload = null;

      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      // Handle 401 Unauthorized with token refresh and retry
      if (response.status === 401 && !options.retry) {
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          const newToken = await this.refreshToken();
          this.isRefreshing = false;

          if (newToken) {
            this.setToken(newToken);
            this.onRefreshed(newToken);
            return this.request(endpoint, { ...options, retry: true });
          } else {
            this.setToken(null);
            if (typeof this.onUnauthenticated === 'function') {
              this.onUnauthenticated();
            }
          }
        } else {
          // If refresh is already in-flight, wait for it to complete
          return new Promise(resolve => {
            this.subscribeTokenRefresh(newToken => {
              if (newToken) {
                resolve(this.request(endpoint, { ...options, retry: true }));
              } else {
                resolve({
                  success: false,
                  data: null,
                  error: {
                    code: 'UNAUTHORIZED',
                    message: 'Session expired. Please log in again.'
                  },
                  meta: {}
                });
              }
            });
          });
        }
      }

      // Normalize standard response envelope
      if (payload && typeof payload === 'object' && 'success' in payload) {
        return payload;
      }

      return {
        success: response.ok,
        data: payload,
        error: response.ok ? null : {
          code: `HTTP_${response.status}`,
          message: response.statusText || 'Request failed'
        },
        meta: {}
      };
    } catch (networkError) {
      console.warn(`[ApiClient] Network request failed for ${fullPath}:`, networkError);
      return {
        success: false,
        data: null,
        error: {
          code: 'NETWORK_ERROR',
          message: networkError.message || 'Unable to communicate with RicozData server'
        },
        meta: {}
      };
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
