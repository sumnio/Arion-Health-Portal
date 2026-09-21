import { adminDoctorStore } from '../mocks/adminDoctorStore.js';

function fields(input) {
  const display_name = String(input.display_name ?? '').trim();
  const specialty = String(input.specialty ?? '').trim();
  if (!display_name || !specialty) throw new Error('Doctor name and specialty are required.');
  return { display_name, specialty };
}

export const adminDoctorService = {
  list(search = '') {
    const query = search.trim().toLowerCase();
    return adminDoctorStore.filter(d => `${d.display_name} ${d.specialty}`.toLowerCase().includes(query)).map(d => ({ ...d }));
  },
  get(id) { const doctor = adminDoctorStore.find(d => d.id === id); return doctor ? { ...doctor } : null; },
  create(input) {
    const doctor = { ...fields(input), id: crypto.randomUUID(), role: 'doctor' };
    adminDoctorStore.push(doctor);
    return { ...doctor };
  },
  update(id, input) {
    const doctor = adminDoctorStore.find(d => d.id === id);
    if (!doctor) throw new Error('Doctor not found.');
    Object.assign(doctor, fields(input));
    return { ...doctor };
  },
};
