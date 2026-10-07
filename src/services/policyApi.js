import api from './api';

export const policyApi = {
  getPolicies: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString();
    return api.get(`/policies${queryString ? `?${queryString}` : ''}`);
  },
  getPolicyById: async (id) => {
    return api.get(`/policies/${id}`);
  },
  createPolicy: async (policyData) => {
    return api.post('/policies', policyData);
  },
  updatePolicy: async (id, policyData) => {
    return api.put(`/policies/${id}`, policyData);
  },
  togglePolicyStatus: async (id) => {
    return api.put(`/policies/${id}/toggle`);
  },
  transitionPolicyStatus: async (id, targetStatus, reason) => {
    return api.put(`/policies/${id}/transition`, { targetStatus, reason });
  },
  evaluatePolicyRules: async (id) => {
    return api.post(`/governance-rules/policy/${id}/evaluate`);
  },
  deletePolicy: async (id) => {
    return api.delete(`/policies/${id}`);
  }
};

export default policyApi;
