import { ApiError } from './apiClient.js';
import { staffApiRepository } from '../repositories/staffApiRepository.js';
import { clinicToday, formatSlot } from './dateTimeService.js';

export const staffVisitTypes = [
  { id: 'general_consultation', name: 'General Consultation' },
  { id: 'follow_up', name: 'Follow-up' },
  { id: 'check_up', name: 'Check-up' },
];
const visitLabels = Object.fromEntries(staffVisitTypes.map((item) => [item.id, item.name]));
function localParts(value) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  const day = `${part('year')}-${part('month')}-${part('day')}`;
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return { date: day, time };
}
export function normalizeStaffPatient(patient) {
  return { ...patient, isSenior: patient.is_senior === true, hasPortalAccount: patient.has_portal_account === true };
}
export function normalizeStaffAppointment(item) {
  const local = localParts(item.appointment_at); const patient = normalizeStaffPatient(item.patient ?? {});
  return { ...item, patient, patient_id: patient.id, patientName: patient.full_name ?? 'Patient unavailable', doctor_id: item.doctor?.id, doctorName: item.doctor?.display_name ?? 'Doctor unavailable', date: local.date, time: local.time, timeLabel: formatSlot(local.time), visitLabel: visitLabels[item.visit_type] ?? item.visit_type, tier: item.queue_tier, priorityLabel: item.queue_priority === 'urgent' ? 'Urgent' : item.queue_priority === 'senior_pwd' ? 'Senior / PWD' : 'Normal' };
}
export function staffApiErrorMessage(error, fallback = 'Unable to load Staff data.') {
  if (error instanceof ApiError && [400, 409].includes(error.status)) return error.message;
  if (error instanceof ApiError && error.status === 404) return fallback;
  if (error instanceof ApiError && error.status === 403) return 'You do not have access to this Staff operation.';
  return error?.message || 'Unable to connect to the server. Please try again.';
}
export function staffCalendarActions(item, today = clinicToday()) {
  const active = ['pending', 'confirmed'].includes(item?.status); const unchecked = !item?.check_in_at;
  return { confirm: active && unchecked && item.status === 'pending', cancel: active && unchecked && item.date >= today, queue: active && item.date === today };
}
export function staffQueueActions(item, now = new Date()) {
  const active = item?.date === clinicToday(now) && ['pending', 'confirmed'].includes(item?.status);
  return { checkIn: Boolean(active && item.status === 'confirmed' && !item.check_in_at), noShow: Boolean(active && !item.check_in_at && new Date(item.appointment_at) <= now), priority: Boolean(active) };
}
export function patientListPage(patients, page = 1) {
  const pageCount = Math.max(1, Math.ceil(patients.length / 5)); const current = Math.min(pageCount, Math.max(1, page));
  return { items: patients.slice((current - 1) * 5, current * 5), total: patients.length, page: current, pageCount };
}
export function createStaffApiService(repository = staffApiRepository) {
  return {
    async getAppointments(date = clinicToday()) { return (await repository.getAppointments(date)).map(normalizeStaffAppointment); },
    async getQueue() { return (await repository.getQueue()).map(normalizeStaffAppointment); },
    async getDashboard() {
      const date = clinicToday(); const [appointments, queue] = await Promise.all([this.getAppointments(date), this.getQueue()]);
      return { date, appointments, queue, total: appointments.length, checkedIn: appointments.filter((item) => item.check_in_at).length, completed: appointments.filter((item) => item.status === 'completed').length, upcoming: appointments.filter((item) => ['pending', 'confirmed'].includes(item.status) && !item.check_in_at) };
    },
    async searchPatients(query = '') { return (await repository.searchPatients(query)).map(normalizeStaffPatient); },
    async getPatientContext(id) { const [patient, records] = await Promise.all([repository.getPatient(id), repository.getRecordSummary(id)]); return { patient: normalizeStaffPatient(patient), records }; },
    getDoctors: () => repository.getDoctors(),
    registerWalkIn(values) { return repository.registerWalkIn({ ...values, address: values.address?.trim() || null, emergency_contact_name: values.emergency_contact_name?.trim() || null, emergency_contact_number: values.emergency_contact_number?.trim() || null, emergency_contact_relationship: values.emergency_contact_relationship?.trim() || null, allergies: (values.allergies ?? '').split(/[\n,]/).map((value) => value.trim()).filter(Boolean) }); },
    createWalkInAppointment(patientId, values) { return repository.createWalkInAppointment(patientId, { doctor_id: values.doctor, appointment_at: `${values.date}T${values.time}:00+08:00`, visit_type: values.service, reason: values.reason.trim(), priority: values.priority }); },
    confirm: (id) => repository.confirmAppointment(id), checkIn: (id) => repository.checkIn(id), updatePriority: (id, priority) => repository.updatePriority(id, priority), noShow: (id) => repository.markNoShow(id), cancel: (id) => repository.cancelAppointment(id),
  };
}
export const staffApiService = createStaffApiService();

export function sameDayTimeOptions(now = new Date()) {
  const result = []; const currentDate = clinicToday(now);
  for (let minutes = 9 * 60; minutes < 17 * 60; minutes += 30) {
    const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    if (new Date(`${currentDate}T${time}:00+08:00`) >= now) result.push(time);
  }
  return result;
}
