import { httpError } from '../utils/httpError.js';
import { appointmentLocalParts, clinicDate, addDays, zonedDateTimeToUtc } from '../utils/schedulingTime.js';
import { validateObjectId } from '../validation/appointmentValidation.js';
import { validatePriority, validateWalkInAppointment, validateWalkInPatient } from '../validation/staffOperationsValidation.js';

function id(value) { const result = value?._id ?? value?.id ?? value; return result == null ? null : String(result); }
function iso(value) { return value ? new Date(value).toISOString() : null; }
function duplicateKey(error) { return error?.code === 11000; }
function ageAt(dob, date) {
  const birth = new Date(dob); const current = new Date(`${date}T00:00:00.000Z`);
  let age = current.getUTCFullYear() - birth.getUTCFullYear();
  if (current.getUTCMonth() < birth.getUTCMonth() || (current.getUTCMonth() === birth.getUTCMonth() && current.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}
function patientView(item, date) {
  const age = ageAt(item.dob, date);
  return { id: id(item), full_name: item.full_name, contact_number: item.contact_number, dob: new Date(item.dob).toISOString().slice(0, 10), age, sex: item.sex, is_pwd: item.is_pwd === true, is_senior: age >= 60, has_portal_account: Boolean(item.user_profile_id) };
}
function doctorView(item) { return { id: id(item), display_name: item?.user_profile_id?.display_name ?? null, specialty: item?.specialty ?? null }; }
function tier(appointment, patient, date) { if (appointment.priority === 'urgent') return 0; return patient.is_pwd || ageAt(patient.dob, date) >= 60 ? 1 : 2; }
function queueView(item, date) {
  const priorityTier = tier(item, item.patient_id, date);
  return { appointment_id: id(item), patient: patientView(item.patient_id, date), doctor: doctorView(item.doctor_id), appointment_at: iso(item.appointment_at), check_in_at: iso(item.check_in_at), status: item.status, visit_type: item.visit_type, priority: item.priority, queue_tier: priorityTier, queue_priority: ['urgent', 'senior_pwd', 'normal'][priorityTier] };
}
function appointmentView(item, date) {
  const patient = patientView(item.patient_id, date);
  return { id: id(item), patient, doctor: doctorView(item.doctor_id), appointment_at: iso(item.appointment_at), check_in_at: iso(item.check_in_at), status: item.status, visit_type: item.visit_type, reason: item.reason, priority: item.priority };
}

export function createStaffOperationsService({ repository, clinic, now = () => new Date() }) {
  return {
    async appointments(dateValue) {
      const date = dateValue || clinicDate(now(), clinic.timeZone);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw httpError(400, 'INVALID_DATE', 'date must use YYYY-MM-DD.');
      const start = zonedDateTimeToUtc(date, '00:00', clinic.timeZone);
      const end = zonedDateTimeToUtc(addDays(date, 1), '00:00', clinic.timeZone);
      return (await repository.listAppointmentsBetween(start, end)).map((item) => appointmentView(item, date));
    },
    async doctors() { return (await repository.listActiveDoctors()).map(doctorView); },
    async patient(patientId) {
      validateObjectId(patientId, 'patientId');
      const patient = await repository.findPatientById(patientId);
      if (!patient) throw httpError(404, 'PATIENT_NOT_FOUND', 'Patient was not found.');
      return patientView(patient, clinicDate(now(), clinic.timeZone));
    },
    async searchPatients(search = '') {
      const today = clinicDate(now(), clinic.timeZone);
      return (await repository.searchPatients(String(search))).map((item) => patientView(item, today));
    },
    async registerWalkIn(body) {
      const input = validateWalkInPatient(body, now());
      if (await repository.findPotentialDuplicate(input)) throw httpError(409, 'PATIENT_MATCH_FOUND', 'An existing Patient may match this person. Search and select the existing Patient.');
      return patientView(await repository.createPatient(input), clinicDate(now(), clinic.timeZone));
    },
    async createWalkInAppointment(staffProfileId, patientId, body) {
      validateObjectId(patientId, 'patientId');
      const current = now();
      const input = validateWalkInAppointment(body, current, clinic.timeZone);
      if (!(await repository.findPatientById(patientId))) throw httpError(404, 'PATIENT_NOT_FOUND', 'Patient was not found.');
      if (!(await repository.doctorExists(input.doctor_id))) throw httpError(404, 'DOCTOR_NOT_FOUND', 'Doctor was not found.');
      try {
        const created = await repository.createAppointment({ ...input, patient_id: patientId, created_by: staffProfileId, status: 'confirmed', check_in_at: null });
        return { id: id(created), patient_id: id(created.patient_id), doctor_id: id(created.doctor_id), appointment_at: iso(created.appointment_at), visit_type: created.visit_type, reason: created.reason, priority: created.priority, status: created.status, check_in_at: null };
      } catch (error) {
        if (duplicateKey(error)) throw httpError(409, 'APPOINTMENT_SLOT_CONFLICT', 'That Doctor and time slot is no longer available.');
        throw error;
      }
    },
    async checkIn(appointmentId) {
      validateObjectId(appointmentId, 'appointmentId');
      const existing = await repository.findAppointmentById(appointmentId);
      if (!existing) throw httpError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment was not found.');
      if (appointmentLocalParts(existing.appointment_at, clinic.timeZone).date !== clinicDate(now(), clinic.timeZone) || existing.status !== 'confirmed' || existing.check_in_at) throw httpError(409, 'CHECK_IN_NOT_ALLOWED', 'Only an unchecked confirmed appointment for the current clinic day can be checked in.');
      const updated = await repository.checkInConfirmed(appointmentId, now());
      if (!updated) throw httpError(409, 'CHECK_IN_NOT_ALLOWED', 'This appointment can no longer be checked in.');
      return queueView(updated, clinicDate(now(), clinic.timeZone));
    },
    async updatePriority(appointmentId, body) {
      validateObjectId(appointmentId, 'appointmentId');
      const priority = validatePriority(body);
      const existing = await repository.findAppointmentById(appointmentId);
      if (!existing) throw httpError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment was not found.');
      if (!['pending', 'confirmed'].includes(existing.status)) throw httpError(409, 'PRIORITY_NOT_ALLOWED', 'Priority cannot be changed for this appointment.');
      const updated = await repository.updatePriorityEligible(appointmentId, priority);
      return { id: id(updated), priority: updated.priority };
    },
    async markNoShow(appointmentId) {
      validateObjectId(appointmentId, 'appointmentId');
      const current = now();
      const existing = await repository.findAppointmentById(appointmentId);
      if (!existing) throw httpError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment was not found.');
      if (appointmentLocalParts(existing.appointment_at, clinic.timeZone).date !== clinicDate(current, clinic.timeZone) || !['pending', 'confirmed'].includes(existing.status) || existing.check_in_at || new Date(existing.appointment_at) > current) throw httpError(409, 'NO_SHOW_NOT_ALLOWED', 'This appointment cannot be marked as no-show.');
      const updated = await repository.markNoShowEligible(appointmentId, current);
      if (!updated) throw httpError(409, 'NO_SHOW_NOT_ALLOWED', 'This appointment can no longer be marked as no-show.');
      return { id: id(updated), status: updated.status };
    },
    async cancel(appointmentId) {
      validateObjectId(appointmentId, 'appointmentId');
      const existing = await repository.findAppointmentById(appointmentId);
      if (!existing) throw httpError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment was not found.');
      if (!['pending', 'confirmed'].includes(existing.status) || existing.check_in_at) throw httpError(409, 'CANCEL_NOT_ALLOWED', 'Only an unchecked pending or confirmed appointment can be cancelled.');
      const updated = await repository.cancelEligible(appointmentId);
      if (!updated) throw httpError(409, 'CANCEL_NOT_ALLOWED', 'This appointment can no longer be cancelled.');
      return appointmentView(updated, appointmentLocalParts(updated.appointment_at, clinic.timeZone).date);
    },
    async queue() {
      const current = now(); const date = clinicDate(current, clinic.timeZone);
      const start = zonedDateTimeToUtc(date, '00:00', clinic.timeZone);
      const end = zonedDateTimeToUtc(addDays(date, 1), '00:00', clinic.timeZone);
      return (await repository.listWaitingBetween(start, end)).map((item) => queueView(item, date)).sort((a, b) => a.queue_tier - b.queue_tier || new Date(a.check_in_at ?? a.appointment_at) - new Date(b.check_in_at ?? b.appointment_at) || a.appointment_id.localeCompare(b.appointment_id));
    },
    async recordSummary(patientId) {
      validateObjectId(patientId, 'patientId');
      if (!(await repository.findPatientById(patientId))) throw httpError(404, 'PATIENT_NOT_FOUND', 'Patient was not found.');
      return (await repository.listRecordSummaries(patientId)).map((item) => ({ id: id(item), patient_name: item.patient_id?.full_name ?? null, encounter_at: iso(item.encounter_at), attending_doctor: item.doctor_id?.user_profile_id?.display_name ?? null, diagnosis_summary: item.diagnosis }));
    },
  };
}
