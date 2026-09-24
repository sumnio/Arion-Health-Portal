import { doctorRepository, userProfileRepository } from '../repositories/accountRepository.js';

// Read-only projection shared by certificate workflows. Authentication and
// account editing remain outside this service.
export const doctorProfileService = {
  list({ activeOnly = false } = {}) {
    return doctorRepository.list().map(doctor => {
      const profile = userProfileRepository.list().find(item => item.id === doctor.id && item.role === 'doctor');
      return profile ? structuredClone({ ...profile, ...doctor }) : null;
    }).filter(Boolean).filter(item => !activeOnly || item.status === 'active');
  },
  get(id) {
    const doctor = doctorRepository.get(id);
    const profile = userProfileRepository.list().find(item => item.id === id && item.role === 'doctor');
    return doctor && profile ? structuredClone({ ...profile, ...doctor }) : null;
  },
};
