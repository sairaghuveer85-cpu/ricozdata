/**
 * Helper mirroring resolveEnvironmentUrls from src/services/apiConfig.js for backend/node testing
 */
function resolveEnvironmentUrls({ rawApiEnv, rawBackendEnv, hostname }) {
  const cleanApi = typeof rawApiEnv === 'string' ? rawApiEnv.trim().replace(/\/+$/, '') : '';
  const cleanBackend = typeof rawBackendEnv === 'string' ? rawBackendEnv.trim().replace(/\/+$/, '') : '';

  let backend = cleanBackend;
  let api = cleanApi;

  if (backend && !api) {
    api = `${backend}/api`;
  }

  if (api && !backend) {
    backend = api.replace(/\/api(\/v\d+)?\/?$/, '');
  }

  if (api && !api.endsWith('/api') && !/\/api\/v\d+$/.test(api)) {
    api = `${api}/api`;
  }

  if (!api && !backend) {
    api = '/api';
    backend = '';
  }

  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    if (backend && (backend.includes('localhost') || backend.includes('127.0.0.1'))) {
      backend = '';
      api = '/api';
    }
    if (api && (api.includes('localhost') || api.includes('127.0.0.1'))) {
      api = '/api';
    }
  }

  return { backendUrl: backend, apiUrl: api };
}

module.exports = { resolveEnvironmentUrls };
