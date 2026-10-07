import api from './api';

export const userApi = {
  getUsers: async () => {
    return api.get('/users');
  },
  getUserById: async (id) => {
    return api.get(`/users/${id}`);
  },
  createUser: async (userData) => {
    return api.post('/users', userData);
  },
  updateUser: async (id, userData) => {
    return api.put(`/users/${id}`, userData);
  },
  deleteUser: async (id) => {
    return api.delete(`/users/${id}`);
  }
};

export default userApi;
