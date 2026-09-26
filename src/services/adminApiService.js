import { apiErrorMessage } from './apiClient.js';
import { adminApiRepository } from '../repositories/adminApiRepository.js';

function page(result = {}) {
  return {
    items: result.items ?? [],
    total: result.total ?? 0,
    page: result.page ?? 1,
    pageSize: result.page_size ?? 5,
    pageCount: result.page_count ?? 1,
  };
}

function clean(values, keys) {
  return Object.fromEntries(keys.map((key) => [key, typeof values[key] === 'string' ? values[key].trim() : values[key]]));
}

export function adminApiErrorMessage(error, fallback = 'Unable to load Admin data.') {
  return apiErrorMessage(error, {
    fallback,
    forbidden: 'You do not have access to this Admin operation.',
    notFound: fallback,
    codeMessages: {
      EMAIL_ALREADY_REGISTERED: 'That email is already registered.',
      LICENSE_NUMBER_EXISTS: 'That Doctor license number is already in use.',
      PTR_NUMBER_EXISTS: 'That Doctor PTR number is already in use.',
      ACCOUNT_STATUS_UNCHANGED: error?.message,
      PATIENT_HAS_NO_PORTAL_ACCOUNT: 'This Patient has no portal account to update.',
    },
  });
}

export function createAdminApiService(repository = adminApiRepository) {
  return {
    async getDashboard() {
      const [doctors, staff, patients] = await Promise.all([
        repository.getDoctors({ page: 1, limit: 5 }),
        repository.getStaff({ page: 1, limit: 5 }),
        repository.getPatients({ page: 1, limit: 5, status: 'all' }),
      ]);
      return { doctors: page(doctors), staff: page(staff), patients: page(patients) };
    },
    async listDoctors({ search = '', page: pageNumber = 1, limit = 5 } = {}) { return page(await repository.getDoctors({ search, page: pageNumber, limit })); },
    getDoctor: (id) => repository.getDoctor(id),
    createDoctor(values) { return repository.createDoctor(clean(values, ['email', 'password', 'display_name', 'contact_number', 'specialty', 'license_number', 'ptr_number', 'signature_path'])); },
    updateDoctor(id, values) { return repository.updateDoctor(id, clean(values, ['display_name', 'contact_number', 'specialty', 'license_number', 'ptr_number', 'signature_path'])); },
    setDoctorStatus(doctor) { return doctor.status === 'active' ? repository.deactivateDoctor(doctor.id) : repository.reactivateDoctor(doctor.id); },
    async listStaff({ search = '', page: pageNumber = 1, limit = 5 } = {}) { return page(await repository.getStaff({ search, page: pageNumber, limit })); },
    getStaff: (id) => repository.getStaffMember(id),
    createStaff(values) { return repository.createStaff(clean(values, ['email', 'password', 'display_name', 'contact_number'])); },
    updateStaff(id, values) { return repository.updateStaff(id, clean(values, ['display_name', 'contact_number'])); },
    setStaffStatus(account) { return account.status === 'active' ? repository.deactivateStaff(account.id) : repository.reactivateStaff(account.id); },
    async listPatients({ search = '', status = 'all', page: pageNumber = 1, limit = 5 } = {}) { return page(await repository.getPatients({ search, status, page: pageNumber, limit })); },
    getPatient: (id) => repository.getPatient(id),
    setPatientStatus(patient) { return patient.account_status === 'active' ? repository.deactivatePatient(patient.id) : repository.reactivatePatient(patient.id); },
  };
}

export const adminApiService = createAdminApiService();
