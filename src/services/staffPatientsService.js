import { allStaffPatients, staffPatientName } from '../mocks/staffWalkInStore.js';
import { ageFromDob, isSenior } from './patientProfileService.js';
import { clinicToday } from './bookingService.js';

const normalize = value => value.trim().replace(/\s+/g, ' ').toLowerCase();
// Read-only projection: intentionally excludes clinical and account information.
export function patientListPage(patients, nameFor, { query = '', page = 1 } = {}, today = clinicToday()) {
  const term = normalize(query), digits = term.replace(/\D/g, '');
  const rows = patients.map(patient => ({ id: patient.id, name: nameFor(patient.id) ?? 'Unnamed patient',
    dob: patient.dob, age: ageFromDob(patient.dob, today), sex: patient.sex,
    contactNumber: patient.contact_number, isPwd: patient.is_pwd === true, isSenior: isSenior(patient.dob, today) }));
  const matches = rows.filter(item => !term || normalize(item.name).includes(term) ||
    (digits.length > 0 && !/[a-z]/i.test(term) && (item.contactNumber ?? '').replace(/\D/g, '').includes(digits)))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const pageCount = Math.max(1, Math.ceil(matches.length / 5));
  const currentPage = Math.min(pageCount, Math.max(1, Math.trunc(Number(page)) || 1));
  return { items: matches.slice((currentPage - 1) * 5, currentPage * 5), total: patients.length,
    filteredTotal: matches.length, page: currentPage, pageCount };
}
export const staffPatientsService = {
  list(options, now = new Date()) { return patientListPage(allStaffPatients(), staffPatientName, options, clinicToday(now)); },
};
