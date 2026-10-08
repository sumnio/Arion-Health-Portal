import { apiClient } from '../services/apiClient.js';

export function createAnalyticsApiRepository(client = apiClient) {
  return {
    async getAnalytics(role, period) {
      return (await client.request(`/api/${encodeURIComponent(role)}/analytics?period=${encodeURIComponent(period)}`)).analytics;
    },
  };
}

export const analyticsApiRepository = createAnalyticsApiRepository();
