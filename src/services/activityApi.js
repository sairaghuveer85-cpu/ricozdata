import api from './api';

export const activityApi = {
  getActivities: async (limit = 20) => {
    return api.get(`/activities?limit=${limit}`);
  },
  getActivityCount: async () => {
    return api.get('/activities/count');
  },
  createActivity: async (activityData) => {
    return api.post('/activities', activityData);
  }
};

export default activityApi;
