import { patientDashboardData } from '../mocks/patientDashboardData.js';
import { portalService } from './portalService.js';

// A dashboard view model assembled behind a provider-independent service boundary.
export const patientDashboardService = {
  getDashboard() {
    return {
      profile: portalService.getPreviewProfile('patient'),
      ...structuredClone(patientDashboardData),
    };
  },
};

