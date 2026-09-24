import { adminDoctorStore } from '../mocks/adminDoctorStore.js';
import { adminUserProfileStore } from '../mocks/adminUserProfileStore.js';

// Read-only projection shared by certificate workflows. Authentication and
// account editing remain outside this service.
export const doctorProfileService = {
  get(id) {
    const doctor = adminDoctorStore.find(item => item.id === id);
    const profile = adminUserProfileStore.find(item => item.id === id && item.role === 'doctor');
    return doctor && profile ? structuredClone({ ...profile, ...doctor }) : null;
  },
};
