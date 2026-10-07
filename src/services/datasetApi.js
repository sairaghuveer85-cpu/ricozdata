import api from './api';

export const datasetApi = {
  getDatasets: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString();
    return api.get(`/datasets${queryString ? `?${queryString}` : ''}`);
  },
  getDatasetById: async (id, params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString();
    return api.get(`/datasets/${id}${queryString ? `?${queryString}` : ''}`);
  },
  createDataset: async (datasetData) => {
    return api.post('/datasets', datasetData);
  },
  updateDataset: async (id, datasetData) => {
    return api.put(`/datasets/${id}`, datasetData);
  },
  deleteDataset: async (id) => {
    return api.delete(`/datasets/${id}`);
  },
  getDatasetSummary: async () => {
    return api.get('/datasets/stats/summary');
  },
  toggleFavorite: async (id) => {
    return api.post(`/datasets/${id}/favorite`);
  },
  getFavorites: async (id) => {
    return api.get(`/datasets/${id}/favorite`);
  },
  certifyDataset: async (id, certificationData) => {
    return api.put(`/datasets/${id}/certification`, certificationData);
  },
  updateColumnMetadata: async (datasetId, columnId, metadata) => {
    return api.put(`/datasets/${datasetId}/schema/${columnId}`, metadata);
  },
  getDatasetActivity: async (id) => {
    return api.get(`/datasets/${id}/activity`);
  },
  getRelatedDatasets: async (id) => {
    return api.get(`/datasets/${id}/related`);
  },
  getTags: async () => {
    return api.get('/datasets/tags');
  },
  getSources: async () => {
    return api.get('/datasets/sources');
  },
  executeQuery: async (id, query, limit = 50) => {
    return api.post(`/datasets/${id}/query`, { query, limit });
  },
  getPreview: async (id, limit = 50) => {
    return api.get(`/datasets/${id}/preview?limit=${limit}`);
  },
  exportSchema: async (id, download = false) => {
    return api.get(`/datasets/${id}/export-schema${download ? '?download=true' : ''}`);
  }
};

export default datasetApi;
