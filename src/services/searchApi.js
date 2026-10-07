import api from './api';

export const searchApi = {
  search: async (query) => {
    return api.get(`/search?q=${encodeURIComponent(query)}`);
  }
};

export default searchApi;
