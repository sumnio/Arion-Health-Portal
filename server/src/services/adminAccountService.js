import { httpError } from '../utils/httpError.js';
import { validateAdminId, validateAdminListQuery, validateDoctorCreate, validateDoctorUpdate, validatePatientListQuery, validateStaffCreate, validateStaffUpdate } from '../validation/adminAccountValidation.js';

function id(value) { const result = value?._id ?? value?.id ?? value; return result == null ? null : String(result); }
function iso(value) { return value ? new Date(value).toISOString() : null; }
function duplicate(error) { return error?.code === 11000; }
function duplicateError(error) {
  const field = Object.keys(error?.keyPattern ?? {})[0] ?? '';
  if (field === 'email') return httpError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.');
  if (field === 'license_number') return httpError(409, 'LICENSE_NUMBER_EXISTS', 'That Doctor license number already exists.');
  if (field === 'ptr_number') return httpError(409, 'PTR_NUMBER_EXISTS', 'That Doctor PTR number already exists.');
  return httpError(409, 'ACCOUNT_CONFLICT', 'Account information conflicts with an existing account.');
}
function doctorView(item) { const profile = item.user_profile_id; return { id: id(item), user_profile_id: id(profile), email: item.email ?? null, display_name: profile?.display_name ?? null, contact_number: profile?.contact_number ?? null, status: profile?.status ?? null, specialty: item.specialty, license_number: item.license_number, ptr_number: item.ptr_number, signature_path: item.signature_path ?? null, signature_available: Boolean(item.signature_path), created_at: iso(item.created_at), updated_at: iso(item.updated_at) }; }
function staffView(item) { const profile = item.user_profile_id; return { id: id(item), user_profile_id: id(profile), email: item.email ?? null, display_name: profile?.display_name ?? null, contact_number: profile?.contact_number ?? null, status: profile?.status ?? null, created_at: iso(item.created_at), updated_at: iso(item.updated_at) }; }
function patientView(item) { const profile = item.user_profile_id; return { id: id(item), user_profile_id: id(profile), full_name: item.full_name, contact_number: profile?.contact_number ?? item.contact_number, dob: item.dob ? new Date(item.dob).toISOString().slice(0, 10) : null, sex: item.sex, account_status: profile?.status ?? null, has_portal_account: Boolean(profile), account_created_at: iso(profile?.created_at), created_at: iso(item.created_at) }; }
function pageResult(result, presenter) { return { items: result.items.map(presenter), total: result.total, page: result.page, page_size: result.limit, page_count: Math.max(1, Math.ceil(result.total / result.limit)) }; }

export function createAdminAccountService({ repository, passwords }) {
  async function provision(input, type) {
    if (await repository.findAccountByEmail(input.email)) throw httpError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.');
    const passwordHash = await passwords.hash(input.password);
    try {
      const created = type === 'doctor'
        ? await repository.createDoctorAccount({ ...input, password_hash: passwordHash })
        : await repository.createStaffAccount({ ...input, password_hash: passwordHash });
      return { ...created.roleProfile, user_profile_id: created.profile, email: created.account.email };
    } catch (error) { if (duplicate(error)) throw duplicateError(error); throw error; }
  }
  async function lifecycle(kind, entityId, status) {
    validateAdminId(entityId, `${kind}Id`);
    const find = kind === 'doctor' ? repository.findDoctorById.bind(repository) : kind === 'staff' ? repository.findStaffById.bind(repository) : repository.findPatientById.bind(repository);
    const set = kind === 'doctor' ? repository.setDoctorStatus.bind(repository) : kind === 'staff' ? repository.setStaffStatus.bind(repository) : repository.setPatientStatus.bind(repository);
    const existing = await find(entityId);
    if (!existing) throw httpError(404, `${kind.toUpperCase()}_NOT_FOUND`, `${kind[0].toUpperCase()}${kind.slice(1)} was not found.`);
    if (kind === 'patient' && !existing.user_profile_id) throw httpError(409, 'PATIENT_HAS_NO_PORTAL_ACCOUNT', 'This Patient has no portal account to update.');
    const currentStatus = existing.user_profile_id?.status;
    if (currentStatus === status) throw httpError(409, 'ACCOUNT_STATUS_UNCHANGED', `Account is already ${status}.`);
    const updated = await set(entityId, status);
    return kind === 'doctor' ? doctorView(updated) : kind === 'staff' ? staffView(updated) : patientView(updated);
  }
  return {
    async createDoctor(body) { const input = validateDoctorCreate(body); return doctorView(await provision(input, 'doctor')); },
    async listDoctors(query) { return pageResult(await repository.listDoctors(validateAdminListQuery(query)), doctorView); },
    async getDoctor(doctorId) { validateAdminId(doctorId, 'doctorId'); const item = await repository.findDoctorById(doctorId); if (!item) throw httpError(404, 'DOCTOR_NOT_FOUND', 'Doctor was not found.'); return doctorView(item); },
    async updateDoctor(doctorId, body) { validateAdminId(doctorId, 'doctorId'); const input = validateDoctorUpdate(body); const profile = {}; const doctor = {}; for (const [key, value] of Object.entries(input)) (['display_name', 'contact_number'].includes(key) ? profile : doctor)[key] = value; try { const item = await repository.updateDoctor(doctorId, profile, doctor); if (!item) throw httpError(404, 'DOCTOR_NOT_FOUND', 'Doctor was not found.'); return doctorView(item); } catch (error) { if (duplicate(error)) throw duplicateError(error); throw error; } },
    deactivateDoctor(id) { return lifecycle('doctor', id, 'inactive'); }, reactivateDoctor(id) { return lifecycle('doctor', id, 'active'); },
    async createStaff(body) { const input = validateStaffCreate(body); return staffView(await provision(input, 'staff')); },
    async listStaff(query) { return pageResult(await repository.listStaff(validateAdminListQuery(query)), staffView); },
    async getStaff(staffId) { validateAdminId(staffId, 'staffId'); const item = await repository.findStaffById(staffId); if (!item) throw httpError(404, 'STAFF_NOT_FOUND', 'Staff was not found.'); return staffView(item); },
    async updateStaff(staffId, body) { validateAdminId(staffId, 'staffId'); const item = await repository.updateStaff(staffId, validateStaffUpdate(body)); if (!item) throw httpError(404, 'STAFF_NOT_FOUND', 'Staff was not found.'); return staffView(item); },
    deactivateStaff(id) { return lifecycle('staff', id, 'inactive'); }, reactivateStaff(id) { return lifecycle('staff', id, 'active'); },
    async listPatients(query) { return pageResult(await repository.listPatients(validatePatientListQuery(query)), patientView); },
    async getPatient(patientId) { validateAdminId(patientId, 'patientId'); const item = await repository.findPatientById(patientId); if (!item) throw httpError(404, 'PATIENT_NOT_FOUND', 'Patient was not found.'); return patientView(item); },
    deactivatePatient(id) { return lifecycle('patient', id, 'inactive'); }, reactivatePatient(id) { return lifecycle('patient', id, 'active'); },
  };
}
