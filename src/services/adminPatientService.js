import { userProfileRepository } from '../repositories/accountRepository.js';
import { patientRepository } from '../repositories/patientRepository.js';
const adminUserProfileStore = userProfileRepository.list();

export const ADMIN_PATIENT_PAGE_SIZE = 5;
export const adminPatientStatusFilters = ['all', 'active', 'inactive', 'no_account'];

const normalized = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const phoneDigits = value => String(value ?? '').replace(/\D/g, '');

function profileFor(patient) {
  if (!patient.user_profile_id) return null;
  return adminUserProfileStore.find(profile => profile.id === patient.user_profile_id && profile.role === 'patient') ?? null;
}

function project(patient) {
  const profile = profileFor(patient);
  return {
    id: patient.id,
    user_profile_id: patient.user_profile_id,
    full_name: patient.full_name,
    contact_number: profile?.contact_number ?? patient.contact_number,
    account_status: profile?.status ?? null,
    account_created_at: profile?.created_at ?? null,
    has_portal_account: Boolean(profile),
  };
}

function changeStatus(patientId, status) {
  if (!['active', 'inactive'].includes(status)) throw new Error('Account status must be active or inactive.');
  const patient = patientRepository.get(patientId);
  if (!patient) throw new Error('Patient not found.');
  const profile = profileFor(patient);
  if (!profile) throw new Error('This patient has no portal account to update.');
  profile.status = status;
  profile.updated_at = new Date().toISOString();
  return project(patient);
}

export function adminPatientListPage(patients, profiles, { query = '', status = 'all', page = 1 } = {}) {
  const term = normalized(query);
  const digits = phoneDigits(query);
  const validStatus = adminPatientStatusFilters.includes(status) ? status : 'all';
  const rows = patients.map(patient => {
    const profile = patient.user_profile_id
      ? profiles.find(item => item.id === patient.user_profile_id && item.role === 'patient') ?? null
      : null;
    return {
      id: patient.id,
      user_profile_id: patient.user_profile_id,
      full_name: patient.full_name,
      contact_number: profile?.contact_number ?? patient.contact_number,
      account_status: profile?.status ?? null,
      account_created_at: profile?.created_at ?? null,
      has_portal_account: Boolean(profile),
    };
  });
  const matches = rows.filter(row => {
    const matchesSearch = !term || normalized(row.full_name).includes(term)
      || (digits.length > 0 && !/[a-z]/i.test(term) && phoneDigits(row.contact_number).includes(digits));
    const matchesStatus = validStatus === 'all'
      || (validStatus === 'no_account' ? !row.has_portal_account : row.account_status === validStatus);
    return matchesSearch && matchesStatus;
  }).sort((a, b) => a.full_name.localeCompare(b.full_name) || a.id.localeCompare(b.id));
  const pageCount = Math.max(1, Math.ceil(matches.length / ADMIN_PATIENT_PAGE_SIZE));
  const currentPage = Math.min(pageCount, Math.max(1, Math.trunc(Number(page)) || 1));
  const start = (currentPage - 1) * ADMIN_PATIENT_PAGE_SIZE;
  return {
    items: matches.slice(start, start + ADMIN_PATIENT_PAGE_SIZE),
    total: rows.length,
    filteredTotal: matches.length,
    page: currentPage,
    pageCount,
  };
}

export const adminPatientService = {
  list(options) {
    return adminPatientListPage(patientRepository.list(), adminUserProfileStore, options);
  },
  get(id) {
    const patient = patientRepository.get(id);
    return patient ? project(patient) : null;
  },
  deactivate(id) { return changeStatus(id, 'inactive'); },
  reactivate(id) { return changeStatus(id, 'active'); },
};
