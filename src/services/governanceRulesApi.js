import api from './api';

export const governanceRulesApi = {
  getRules: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return api.get(`/governance-rules${qs ? `?${qs}` : ''}`);
  },

  getRuleById: async (id) => {
    return api.get(`/governance-rules/${id}`);
  },

  createRule: async (ruleData) => {
    return api.post('/governance-rules', ruleData);
  },

  updateRule: async (id, ruleData) => {
    return api.put(`/governance-rules/${id}`, ruleData);
  },

  deleteRule: async (id) => {
    return api.delete(`/governance-rules/${id}`);
  },

  evaluateRule: async (id) => {
    return api.post(`/governance-rules/${id}/evaluate`);
  },

  evaluatePolicyRules: async (policyId) => {
    return api.post(`/governance-rules/policy/${policyId}/evaluate`);
  },

  getFindings: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return api.get(`/governance-findings${qs ? `?${qs}` : ''}`);
  },

  getFindingById: async (id) => {
    return api.get(`/governance-findings/${id}`);
  },

  updateFindingStatus: async (id, statusData) => {
    return api.patch(`/governance-findings/${id}/status`, statusData);
  },
};

export default governanceRulesApi;
