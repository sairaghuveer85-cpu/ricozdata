import api from './api';

export const authApi = {
  login: async (email, password) => {
    return api.post('/auth/login', { email, password });
  },
  register: async (userData) => {
    return api.post('/auth/register', userData);
  },
  getCurrentUser: async () => {
    return api.get('/auth/me');
  },
  logout: async (token) => {
    const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('ricoz_jwt') : null);
    if (!activeToken || activeToken === 'demo-local-jwt-token') {
      return { success: true, message: 'No active remote session' };
    }
    try {
      return await api.post('/auth/logout', {}, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
    } catch (err) {
      // Logout must be idempotent: if token was already revoked/expired or server error occurs,
      // local session termination must succeed without throwing or looping.
      return { success: true, message: 'Logged out locally' };
    }
  }
};

export default authApi;
