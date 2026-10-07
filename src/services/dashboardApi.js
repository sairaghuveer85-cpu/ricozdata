import api from './api';

export const dashboardApi = {
  getMetrics: async () => {
    return api.get('/dashboard/metrics');
  },
  getRecentActivity: async () => {
    return api.get('/dashboard/activity');
  },
  getPopularDatasets: async () => {
    return api.get('/dashboard/popular-datasets');
  }
};

export default dashboardApi;
