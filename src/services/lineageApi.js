import api from './api';

export const lineageApi = {
  getAllLineage: async () => {
    return api.get('/lineage');
  },
  getLineageForDataset: async (datasetId) => {
    return api.get(`/lineage/${datasetId}`);
  },
  saveLineage: async (datasetId, graphData) => {
    return api.post(`/lineage/${datasetId}`, graphData);
  }
};

export default lineageApi;
