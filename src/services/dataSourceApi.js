import api from './api';

export const dataSourceApi = {
  getDataSources: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString();
    return api.get(`/data-sources${queryString ? `?${queryString}` : ''}`);
  },

  getDataSourceById: async (id) => {
    return api.get(`/data-sources/${id}`);
  },

  createDataSource: async (dataSourceData) => {
    return api.post('/data-sources', dataSourceData);
  },

  updateDataSource: async (id, dataSourceData) => {
    return api.put(`/data-sources/${id}`, dataSourceData);
  },

  deleteDataSource: async (id) => {
    return api.delete(`/data-sources/${id}`);
  },

  testConnection: async (id, connectionConfig = {}) => {
    return api.post(`/data-sources/${id}/test`, connectionConfig);
  },

  discoverAssets: async (id) => {
    return api.post(`/data-sources/${id}/discover`, {});
  },

  syncCatalog: async (id, options = {}) => {
    return api.post(`/data-sources/${id}/sync`, options);
  }
};

export default dataSourceApi;
