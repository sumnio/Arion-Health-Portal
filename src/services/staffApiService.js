import { apiErrorMessage } from './apiClient.js';
import { staffApiRepository } from '../repositories/staffApiRepository.js';
import { clinicDateTimeParts, clinicToday, formatSlot } from './dateTimeService.js';

export const staffVisitTypes = [
  { id: 'general_consultation', name: 'General Consultation' },
  { id: 'follow_up', name: 'Follow-up' },
  { id: 'check_up', name: 'Check-up' },
];
const visitLabels = Object.fromEntries(staffVisitTypes.map((item) => [item.id, item.name]));
export const NO_SHOW_GRACE_PERIOD_MS = 5 * 60 * 1000;
export const urgentReasonOptions = Object.freeze([
  'Sudden worsening of condition',
  'Severe pain or discomfort',
  'Breathing difficulty or respiratory concern',
  'Dizziness, weakness, or risk of fainting',
  'Active bleeding or recent injury',
  'Doctor-directed priority',
  'Other urgent concern',
]);
export const PRIORITY_REASON_MAX_LENGTH = 200;
export function normalizeStaffPatient(patient) {
  return { ...patient, isSenior: patient.is_senior === true, hasPortalAccount: patient.has_portal_account === true };
}
export function normalizeStaffAppointment(item) {
  const local = clinicDateTimeParts(item.appointment_at); const patient = normalizeStaffPatient(item.patient ?? {});
  return { ...item, id: item.id ?? item.appointment_id, patient, patient_id: patient.id, patientName: patient.full_name ?? 'Patient unavailable', doctor_id: item.doctor?.id, doctorName: item.doctor?.display_name ?? 'Doctor unavailable', date: local.date, time: local.time, timeLabel: formatSlot(local.time), visitLabel: visitLabels[item.visit_type] ?? item.visit_type, tier: item.queue_tier, priorityLabel: item.queue_priority === 'urgent' ? 'Urgent' : item.queue_priority === 'senior_pwd' ? 'Senior / PWD' : 'Normal' };
}
export function staffApiErrorMessage(error, fallback = 'Unable to load Staff data.') {
  return apiErrorMessage(error, { fallback, forbidden: 'You do not have access to this Staff operation.', notFound: fallback });
}
export function staffCalendarActions(item, today = clinicToday(), now = new Date()) {
  const active = ['pending', 'confirmed'].includes(item?.status); const unchecked = !item?.check_in_at;
  const currentDayUnchecked = Boolean(active && unchecked && item?.date === today);
  const noShowAvailableAt = item?.appointment_at ? new Date(item.appointment_at).getTime() + NO_SHOW_GRACE_PERIOD_MS : null;
  return {
    confirmArrival: currentDayUnchecked,
    cancel: Boolean(active && unchecked && item?.date >= today),
    queue: Boolean(active && item?.date === today && item?.check_in_at),
    noShow: Boolean(currentDayUnchecked && noShowAvailableAt <= now.getTime()),
    noShowGracePending: Boolean(currentDayUnchecked && noShowAvailableAt > now.getTime()),
    noShowAvailableAt,
  };
}
export function staffQueueActions(item, now = new Date()) {
  const active = item?.date === clinicToday(now) && ['pending', 'confirmed'].includes(item?.status);
  const unchecked = Boolean(active && !item?.check_in_at);
  const noShowAvailableAt = item?.appointment_at ? new Date(item.appointment_at).getTime() + NO_SHOW_GRACE_PERIOD_MS : null;
  const priorityEligible = Boolean(active && item.status === 'confirmed' && item.check_in_at);
  return { confirmArrival: unchecked, noShow: Boolean(unchecked && noShowAvailableAt <= now.getTime()), noShowGracePending: Boolean(unchecked && noShowAvailableAt > now.getTime()), noShowAvailableAt, markUrgent: priorityEligible && item.priority !== 'urgent', setNormal: priorityEligible && item.priority === 'urgent' };
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
      return { date, appointments, queue, total: appointments.length, urgent: queue.filter((item) => item.priority === 'urgent').length, completed: appointments.filter((item) => item.status === 'completed').length, upcoming: appointments.filter((item) => ['pending', 'confirmed'].includes(item.status) && !item.check_in_at) };
    },
    async searchPatients(query = '') { return (await repository.searchPatients(query)).map(normalizeStaffPatient); },
    async getPatientContext(id) { const [patient, records] = await Promise.all([repository.getPatient(id), repository.getRecordSummary(id)]); return { patient: normalizeStaffPatient(patient), records }; },
    getDoctors: () => repository.getDoctors(),
    registerWalkIn(values) { return repository.registerWalkIn({ ...values, address: values.address?.trim() || null, emergency_contact_name: values.emergency_contact_name?.trim() || null, emergency_contact_number: values.emergency_contact_number?.trim() || null, emergency_contact_relationship: values.emergency_contact_relationship?.trim() || null, allergies: (values.allergies ?? '').split(/[\n,]/).map((value) => value.trim()).filter(Boolean) }); },
    createWalkInAppointment(patientId, values) { return repository.createWalkInAppointment(patientId, { doctor_id: values.doctor, appointment_at: `${values.date}T${values.time}:00+08:00`, visit_type: values.service, reason: values.reason.trim(), priority: 'normal' }); },
    confirm: (id) => repository.confirmAppointment(id), checkIn: (id) => repository.checkIn(id), updatePriority: (id, payload) => repository.updatePriority(id, payload), getPriorityHistory: (id) => repository.getPriorityHistory(id), noShow: (id) => repository.markNoShow(id), cancel: (id) => repository.cancelAppointment(id),
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
