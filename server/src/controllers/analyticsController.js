import { validateAnalyticsQuery } from '../validation/analyticsValidation.js';

export function createAnalyticsController({ analyticsService }) {
  return {
    async analytics(request, response) {
      response.json({ analytics: await analyticsService.get(validateAnalyticsQuery(request.query)) });
    },
  };
}
