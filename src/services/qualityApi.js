import api from './api';

export const qualityApi = {
  getQualityOverview: async () => {
    return api.get('/quality');
  },
  getQualityForDataset: async (datasetId) => {
    return api.get(`/quality/${datasetId}`);
  },
  getIssues: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString();
    return api.get(`/quality/issues${queryString ? `?${queryString}` : ''}`);
  },
  searchIssues: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString();
    return api.get(`/quality/issues/search${queryString ? `?${queryString}` : ''}`);
  },
  updateIssueStatus: async (id, status) => {
    return api.put(`/quality/issues/${id}`, { status });
  },
  resolveIssue: async (id, resolutionNote) => {
    return api.post(`/quality/issues/${id}/resolve`, { resolutionNote });
  },
  acknowledgeIssue: async (id) => {
    return api.post(`/quality/issues/${id}/acknowledge`);
  },
  inProgressIssue: async (id) => {
    return api.post(`/quality/issues/${id}/in-progress`);
  },
  ignoreIssue: async (id) => {
    return api.post(`/quality/issues/${id}/ignore`);
  },
  reopenIssue: async (id) => {
    return api.post(`/quality/issues/${id}/reopen`);
  },
  assignIssue: async (id, userId) => {
    return api.post(`/quality/issues/${id}/assign`, { assignedToId: userId });
  },
  getRules: async (datasetId) => {
    return api.get('/quality/rules', { params: { datasetId } });
  },
  createRule: async (rule) => {
    return api.post('/quality/rules', rule);
  },
  updateRule: async (id, updates) => {
    return api.put(`/quality/rules/${id}`, updates);
  },
  deleteRule: async (id) => {
    return api.delete(`/quality/rules/${id}`);
  },
  runRule: async (id) => {
    return api.post(`/quality/rules/${id}/run`);
  },
  evaluateDataset: async (datasetId) => {
    return api.post(`/quality/evaluate/${datasetId}`);
  },
  getQualityTrends: async (datasetId, range = '30d') => {
    return api.get(`/quality/${datasetId}/trends`, { params: { range } });
  },
  getQualityProfile: async (datasetId) => {
    return api.get(`/quality/profile/${datasetId}`);
  },
};

export default qualityApi;
