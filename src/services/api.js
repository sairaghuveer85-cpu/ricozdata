const API_BASE_URL = import.meta.env?.VITE_API_URL || import.meta.env?.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Cooldown and guard against concurrent 401 event storms
let isHandlingUnauthorized = false;
let unauthorizedCooldownTimer = null;

/**
 * Checks whether an endpoint is an authentication endpoint.
 * Auth endpoints should not trigger global session revocation upon 401.
 */
function isAuthEndpoint(endpoint) {
  if (!endpoint) return false;
  return /\/auth\/(login|logout|register|refresh)/i.test(endpoint);
}

/**
 * Safely dispatches the unauthorized event at most once per session loss.
 */
function dispatchUnauthorized(message) {
  if (isHandlingUnauthorized) return;
  isHandlingUnauthorized = true;

  try {
    localStorage.removeItem('ricoz_jwt');
    localStorage.removeItem('ricoz-authenticated');
  } catch (err) {
    console.warn('[API] Could not access localStorage:', err);
  }

  window.dispatchEvent(
    new CustomEvent('ricoz-unauthorized', {
      detail: { message: message || 'Session expired. Please log in again.' }
    })
  );

  // Cooldown period: prevent concurrent requests from spamming unauthorized events
  if (unauthorizedCooldownTimer) clearTimeout(unauthorizedCooldownTimer);
  unauthorizedCooldownTimer = setTimeout(() => {
    isHandlingUnauthorized = false;
  }, 2000);
}

/**
 * Reset unauthorized state when a successful login occurs.
 */
export function resetUnauthorizedState() {
  isHandlingUnauthorized = false;
  if (unauthorizedCooldownTimer) {
    clearTimeout(unauthorizedCooldownTimer);
    unauthorizedCooldownTimer = null;
  }
}

/**
 * Standard HTTP request wrapper with JWT authorization support
 */
export async function apiRequest(endpoint, options = {}) {
  let token = localStorage.getItem('ricoz_jwt');
  if (token === 'demo-local-jwt-token') {
    localStorage.removeItem('ricoz_jwt');
    token = null;
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Only trigger global unauthorized handler if:
      // 1. Status is 401 Unauthorized
      // 2. The endpoint is NOT an auth endpoint (login, logout, refresh, etc.)
      // 3. An authorization token was actually provided on the request
      if (response.status === 401 && !isAuthEndpoint(endpoint) && headers.Authorization) {
        dispatchUnauthorized(data.message);
      }

      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    // Suppress console error spam for expected auth credential rejections
    if (!isAuthEndpoint(endpoint)) {
      console.warn(`[API Error] ${options.method || 'GET'} ${endpoint}:`, error.message);
    }
    throw error;
  }
}

export const api = {
  get: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  patch: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  delete: (endpoint, options = {}) => {
    const fetchOptions = { ...options, method: 'DELETE' };
    if (options && options.data && !options.body) {
      fetchOptions.body = JSON.stringify(options.data);
    } else if (options && options.body && typeof options.body === 'object') {
      fetchOptions.body = JSON.stringify(options.body);
    }
    return apiRequest(endpoint, fetchOptions);
  }
};

export default api;
