import { apiErrorMessage } from './apiClient.js';
import { analyticsApiRepository } from '../repositories/analyticsApiRepository.js';

export const analyticsPeriods = Object.freeze([
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
]);

export function analyticsErrorMessage(error) {
  return apiErrorMessage(error, {
    fallback: 'Unable to load clinic analytics.',
    forbidden: 'You do not have access to clinic analytics.',
  });
}

export function createAnalyticsService(repository = analyticsApiRepository) {
  return {
    getAnalytics(role, period = 'today') {
      if (!['staff', 'admin'].includes(role)) throw new Error('Clinic analytics is available only to Staff and Admin.');
      if (!analyticsPeriods.some((item) => item.key === period)) throw new Error('Unsupported analytics period.');
      return repository.getAnalytics(role, period);
    },
  };
}

export const analyticsService = createAnalyticsService();
