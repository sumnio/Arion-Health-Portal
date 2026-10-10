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
export const staffWeekDays = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
export function staffPublicationWindow(now = new Date()) {
  const start = clinicToday(now); const end = new Date(`${start}T00:00:00.000Z`); end.setUTCDate(end.getUTCDate() + 30);
  return { start, end: end.toISOString().slice(0, 10) };
}
export function staffBlockedTimePayload(values) {
  const next = new Date(`${values.date}T00:00:00.000Z`); next.setUTCDate(next.getUTCDate() + 1);
  return {
    start_at: values.whole_day ? `${values.date}T00:00:00+08:00` : `${values.date}T${values.start_time}:00+08:00`,
    end_at: values.whole_day ? `${next.toISOString().slice(0, 10)}T00:00:00+08:00` : `${values.date}T${values.end_time}:00+08:00`,
    reason: values.reason.trim(),
  };
}
export function normalizeStaffPatient(patient) {
  return {
    ...patient,
    isSenior: patient.is_senior === true,
    hasPortalAccount: patient.has_portal_account === true,
    latestAppointment: patient.latest_appointment ? normalizeStaffPatientAppointment(patient.latest_appointment) : null,
    upcomingAppointment: patient.upcoming_appointment ? normalizeStaffPatientAppointment(patient.upcoming_appointment) : null,
  };
}
export function normalizeStaffPatientAppointment(item) {
  const local = clinicDateTimeParts(item.appointment_at);
  return {
    ...item, date: local.date, time: local.time, timeLabel: formatSlot(local.time),
    doctorName: item.doctor?.display_name ?? 'Doctor unavailable',
    visitLabel: visitLabels[item.visit_type] ?? item.visit_type,
    priorityLabel: item.queue_priority === 'urgent' ? 'Urgent' : item.queue_priority === 'senior_pwd' ? 'Senior / PWD' : 'Normal',
    originLabel: item.origin === 'patient' ? 'Patient booking' : 'Staff-created / walk-in',
  };
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
export const STAFF_LIST_PAGE_SIZE = 5;
export function staffListPage(items, page = 1) {
  const pageCount = Math.max(1, Math.ceil(items.length / STAFF_LIST_PAGE_SIZE)); const current = Math.min(pageCount, Math.max(1, page));
  return { items: items.slice((current - 1) * STAFF_LIST_PAGE_SIZE, current * STAFF_LIST_PAGE_SIZE), total: items.length, page: current, pageCount };
}
export function patientListPage(patients, page = 1) {
  return staffListPage(patients, page);
}
export function createStaffApiService(repository = staffApiRepository) {
  const service = {
    async getAppointments(date = clinicToday()) { return (await repository.getAppointments(date)).map(normalizeStaffAppointment); },
    async getQueue() { return (await repository.getQueue()).map(normalizeStaffAppointment); },
    async getDashboard() {
      const date = clinicToday(); const [appointments, queue] = await Promise.all([this.getAppointments(date), this.getQueue()]);
      return { date, appointments, queue, total: appointments.length, urgent: queue.filter((item) => item.priority === 'urgent').length, completed: appointments.filter((item) => item.status === 'completed').length, upcoming: appointments.filter((item) => ['pending', 'confirmed'].includes(item.status) && !item.check_in_at) };
    },
    async searchPatients(query = '') { return (await repository.searchPatients(query)).map(normalizeStaffPatient); },
    async getPatientDetails(id) {
      const detail = await repository.getPatientDetails(id);
      const appointments = (detail.appointments ?? []).map(normalizeStaffPatientAppointment).sort((left, right) => new Date(right.appointment_at) - new Date(left.appointment_at));
      const current = new Date();
      const upcomingAppointment = [...appointments].reverse().find((item) => ['pending', 'confirmed'].includes(item.status) && new Date(item.appointment_at) > current) ?? null;
      const latestAppointment = appointments.find((item) => new Date(item.appointment_at) <= current) ?? null;
      return { patient: normalizeStaffPatient(detail.patient), appointments, latestAppointment, upcomingAppointment };
    },
    async getPatientContext(id) { const [patient, records] = await Promise.all([repository.getPatient(id), repository.getRecordSummary(id)]); return { patient: normalizeStaffPatient(patient), records }; },
    getDoctors: () => repository.getDoctors(),
    async getAvailableSlots(doctorId, date = clinicToday()) {
      const result = await repository.getAvailableSlots(doctorId, date);
      return (result.slots ?? []).map(slot => ({ time: slot.start_time, appointment_at: slot.appointment_at, available: slot.available === true, occupied: slot.occupied === true }));
    },
    async getDoctorDirectory() {
      const date = clinicToday();
      const [doctors, appointments] = await Promise.all([repository.getDoctors(), repository.getAppointments(date)]);
      const schedules = await Promise.all(doctors.map(doctor => repository.getDoctorSchedule(doctor.id)));
      return doctors.map((doctor, index) => ({
        ...doctor,
        todayAppointmentCount: appointments.filter(item => String(item.doctor?.id) === String(doctor.id)).length,
        scheduledToday: schedules[index].published_availability.some(item => item.availability_date === date),
      }));
    },
    async getDoctorSchedule(id) {
      const [doctors, schedule] = await Promise.all([repository.getDoctors(), repository.getDoctorSchedule(id)]);
      return { doctor: doctors.find(item => String(item.id) === String(id)) ?? null, schedule };
    },
    createDoctorAvailability: (id, payload) => repository.createDoctorAvailability(id, payload),
    updateDoctorAvailability: (id, availabilityId, payload) => repository.updateDoctorAvailability(id, availabilityId, payload),
    deleteDoctorAvailability: (id, availabilityId) => repository.deleteDoctorAvailability(id, availabilityId),
    createPublishedAvailability: (id, payload) => repository.createPublishedAvailability(id, payload),
    deletePublishedAvailability: (id, publishedId) => repository.deletePublishedAvailability(id, publishedId),
    createBlockedTime: (id, values) => repository.createBlockedTime(id, staffBlockedTimePayload(values)),
    deleteBlockedTime: (id, blockedId) => repository.deleteBlockedTime(id, blockedId),
    registerWalkIn(values) { return repository.registerWalkIn({ ...values, address: values.address?.trim() || null, emergency_contact_name: values.emergency_contact_name?.trim() || null, emergency_contact_number: values.emergency_contact_number?.trim() || null, emergency_contact_relationship: values.emergency_contact_relationship?.trim() || null, allergies: (values.allergies ?? '').split(/[\n,]/).map((value) => value.trim()).filter(Boolean) }); },
    createWalkInAppointment(patientId, values) { return repository.createWalkInAppointment(patientId, { doctor_id: values.doctor, appointment_at: `${values.date}T${values.time}:00+08:00`, visit_type: values.service, reason: values.reason.trim(), priority: 'normal' }); },
    confirm: (id) => repository.confirmAppointment(id), checkIn: (id) => repository.checkIn(id), updatePriority: (id, payload) => repository.updatePriority(id, payload), getPriorityHistory: (id) => repository.getPriorityHistory(id), noShow: (id) => repository.markNoShow(id), cancel: (id) => repository.cancelAppointment(id),
  };
  return service;
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
