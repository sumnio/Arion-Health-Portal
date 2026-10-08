import { httpError } from '../utils/httpError.js';
import { validateQueryKeys } from './inputValidation.js';

export const ANALYTICS_PERIODS = Object.freeze(['today', 'week', 'month']);

export function validateAnalyticsQuery(query = {}) {
  validateQueryKeys(query, new Set(['period']));
  const period = query.period ?? 'today';
  if (Array.isArray(period) || typeof period !== 'string' || !ANALYTICS_PERIODS.includes(period)) {
    throw httpError(400, 'INVALID_ANALYTICS_PERIOD', 'period must be today, week, or month.');
  }
  return period;
}
