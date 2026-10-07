import api from './api';

export const glossaryApi = {
  getTerms: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString();
    return api.get(`/glossary${queryString ? `?${queryString}` : ''}`);
  },
  getTermById: async (id) => {
    return api.get(`/glossary/${id}`);
  },
  createTerm: async (termData) => {
    return api.post('/glossary', termData);
  },
  updateTerm: async (id, termData) => {
    return api.put(`/glossary/${id}`, termData);
  },
  deleteTerm: async (id) => {
    return api.delete(`/glossary/${id}`);
  },
  updateStatus: async (id, status) => {
    return api.patch(`/glossary/${id}/status`, { status });
  },
  addDatasetRelationship: async (id, datasetId) => {
    return api.post(`/glossary/${id}/datasets/${datasetId}`);
  },
  removeDatasetRelationship: async (id, datasetId) => {
    return api.delete(`/glossary/${id}/datasets/${datasetId}`);
  },
  addColumnRelationship: async (id, { datasetId, columnId }) => {
    return api.post(`/glossary/${id}/columns`, { datasetId, columnId });
  },
  removeColumnRelationship: async (id, { datasetId, columnId }) => {
    return api.delete(`/glossary/${id}/columns`, { data: { datasetId, columnId } });
  },
  addRelatedTerm: async (id, relatedTermId) => {
    return api.post(`/glossary/${id}/related-terms`, { relatedTermId });
  },
  removeRelatedTerm: async (id, relatedTermId) => {
    return api.delete(`/glossary/${id}/related-terms/${relatedTermId}`);
  },

  // Intelligent Glossary Suggestions
  generateSuggestions: async (data = {}) => {
    return api.post('/glossary/suggestions/generate', data);
  },
  getSuggestions: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString();
    return api.get(`/glossary/suggestions${queryString ? `?${queryString}` : ''}`);
  },
  getSuggestionById: async (id) => {
    return api.get(`/glossary/suggestions/${id}`);
  },
  approveSuggestion: async (id, overrideData = {}) => {
    return api.post(`/glossary/suggestions/${id}/approve`, overrideData);
  },
  rejectSuggestion: async (id, data = {}) => {
    return api.post(`/glossary/suggestions/${id}/reject`, data);
  },
  dismissSuggestion: async (id) => {
    return api.post(`/glossary/suggestions/${id}/dismiss`);
  },
  bulkActionSuggestions: async (action, suggestionIds, reason = '') => {
    return api.post('/glossary/suggestions/bulk', { action, suggestionIds, reason });
  },
};

export default glossaryApi;
