import api from './api';

export const accessControlApi = {
  getOverview: async () => {
    return api.get('/access-control/overview');
  },

  inspectResource: async (resourceType, resourceId) => {
    return api.get(`/access-control/inspect?resourceType=${resourceType}&resourceId=${resourceId}`);
  },

  createGrant: async (data) => {
    return api.post('/access-control/grants', data);
  },

  deleteGrant: async (id) => {
    return api.delete(`/access-control/grants/${id}`);
  },
};

export default accessControlApi;
