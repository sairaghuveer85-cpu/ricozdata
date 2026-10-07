import api from './api';

export const complianceApi = {
  getFrameworks: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return api.get(`/compliance/frameworks${qs ? `?${qs}` : ''}`);
  },

  createFramework: async (data) => {
    return api.post('/compliance/frameworks', data);
  },

  getControls: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return api.get(`/compliance/controls${qs ? `?${qs}` : ''}`);
  },

  createControl: async (data) => {
    return api.post('/compliance/controls', data);
  },

  assessControl: async (id, assessmentData) => {
    return api.post(`/compliance/controls/${id}/assess`, assessmentData);
  },

  collectEvidence: async (id, evidenceData) => {
    return api.post(`/compliance/controls/${id}/evidence`, evidenceData);
  },

  getSummary: async () => {
    return api.get('/compliance/summary');
  },
};

export default complianceApi;
