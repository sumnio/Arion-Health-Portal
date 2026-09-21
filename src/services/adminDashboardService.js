import { adminDoctorService } from './adminDoctorService.js';
import { adminStaffService } from './adminStaffService.js';
import { portalService } from './portalService.js';

// Read-only account overview, using existing mock identities without new schema fields.
export const adminDashboardService = {
  getDashboard() {
    const doctors = adminDoctorService.list().map(({ id, display_name, specialty }) => ({ id, name: display_name, specialty }));
    const staff = adminStaffService.list();
    return { profile: portalService.getPreviewProfile('admin'), doctors, staff,
      totalDoctors: doctors.length, totalStaff: staff.length };
  },
};
