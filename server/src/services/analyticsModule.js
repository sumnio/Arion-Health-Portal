import { analyticsRepository } from '../repositories/analyticsRepository.js';
import { createAnalyticsService } from './analyticsService.js';

export function createAnalyticsModule({ repository = analyticsRepository, clinic, now } = {}) {
  return { analyticsService: createAnalyticsService({ repository, clinic, now }) };
}
