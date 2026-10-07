import apiClient from './apiClient';

/**
 * Enterprise Governance & Policies API Service.
 */
export const governanceApi = {
  /**
   * Fetch masking policies for tenant.
   * @param {Object} [params]
   */
  async getMaskingPolicies(params = {}) {
    const q = new URLSearchParams();
    if (params.datasetId) q.set('datasetId', params.datasetId);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return await apiClient.get(`/governance/masking-policies${qs}`);
  },

  /**
   * Create a new masking policy.
   * @param {Object} payload
   */
  async createMaskingPolicy(payload) {
    return await apiClient.post('/governance/masking-policies', payload);
  },

  /**
   * Update an existing masking policy.
   * @param {string} id
   * @param {Object} payload
   */
  async updateMaskingPolicy(id, payload) {
    if (!id) throw new Error('Policy ID is required');
    return await apiClient.patch(`/governance/masking-policies/${id}`, payload);
  },

  /**
   * Delete a masking policy.
   * @param {string} id
   */
  async deleteMaskingPolicy(id) {
    if (!id) throw new Error('Policy ID is required');
    return await apiClient.delete(`/governance/masking-policies/${id}`);
  },

  /**
   * Fetch automated governance and compliance report.
   */
  async getComplianceReport() {
    return await apiClient.get('/governance/compliance-report');
  },

  /**
   * Update dataset or column classification.
   * @param {Object} payload
   */
  async updateClassification(payload) {
    return await apiClient.post('/governance/classification', payload);
  },

  /**
   * Get dataset classification details.
   * @param {string} datasetId
   */
  async getDatasetClassification(datasetId) {
    if (!datasetId) throw new Error('Dataset ID is required');
    return await apiClient.get(`/governance/classification/${datasetId}`);
  }
};

export default governanceApi;
