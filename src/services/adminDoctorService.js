import { adminDoctorStore } from '../mocks/adminDoctorStore.js';
import { adminUserProfileStore } from '../mocks/adminUserProfileStore.js';

function fields(input) {
  const display_name = String(input.display_name ?? '').trim();
  const contact_number = String(input.contact_number ?? '').trim();
  const specialty = String(input.specialty ?? '').trim();
  const license_number = String(input.license_number ?? '').trim();
  const ptr_number = String(input.ptr_number ?? '').trim();
  const signature_path = String(input.signature_path ?? '').trim() || null;
  if (!display_name || !contact_number || !specialty || !license_number || !ptr_number) {
    throw new Error('Doctor name, contact number, specialty, license number, and PTR number are required.');
  }
  return { display_name, contact_number, specialty, license_number, ptr_number, signature_path };
}

function joinedDoctor(doctor) {
  const profile = adminUserProfileStore.find(item => item.id === doctor.id && item.role === 'doctor');
  return profile ? { ...profile, ...doctor } : null;
}

function findDoctor(id) {
  return adminDoctorStore.find(doctor => doctor.id === id);
}

function changeStatus(id, status) {
  if (!['active', 'inactive'].includes(status)) throw new Error('Account status must be active or inactive.');
  const doctor = findDoctor(id);
  const profile = adminUserProfileStore.find(item => item.id === id && item.role === 'doctor');
  if (!doctor || !profile) throw new Error('Doctor not found.');
  profile.status = status;
  profile.updated_at = new Date().toISOString();
  return joinedDoctor(doctor);
}

export const adminDoctorService = {
  list(search = '') {
    const query = search.trim().toLowerCase();
    return adminDoctorStore.map(joinedDoctor).filter(Boolean).filter(doctor =>
      `${doctor.display_name} ${doctor.contact_number} ${doctor.specialty} ${doctor.license_number} ${doctor.ptr_number}`.toLowerCase().includes(query)
    );
  },
  get(id) { const doctor = findDoctor(id); return doctor ? joinedDoctor(doctor) : null; },
  create(input) {
    const values = fields(input);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    adminUserProfileStore.push({
      id,
      display_name: values.display_name,
      contact_number: values.contact_number,
      role: 'doctor',
      status: 'active',
      created_at: now,
      updated_at: now,
    });
    const doctor = {
      id,
      specialty: values.specialty,
      license_number: values.license_number,
      ptr_number: values.ptr_number,
      signature_path: values.signature_path,
    };
    adminDoctorStore.push(doctor);
    return joinedDoctor(doctor);
  },
  update(id, input) {
    const doctor = findDoctor(id);
    const profile = adminUserProfileStore.find(item => item.id === id && item.role === 'doctor');
    if (!doctor || !profile) throw new Error('Doctor not found.');
    const values = fields(input);
    Object.assign(profile, {
      display_name: values.display_name,
      contact_number: values.contact_number,
      updated_at: new Date().toISOString(),
    });
    Object.assign(doctor, {
      specialty: values.specialty,
      license_number: values.license_number,
      ptr_number: values.ptr_number,
      signature_path: values.signature_path,
    });
    return joinedDoctor(doctor);
  },
  deactivate(id) { return changeStatus(id, 'inactive'); },
  reactivate(id) { return changeStatus(id, 'active'); },
};
