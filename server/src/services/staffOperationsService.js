import { httpError } from '../utils/httpError.js';
import { appointmentLocalParts, clinicDate, addDays, isValidDateOnly, zonedDateTimeToUtc } from '../utils/schedulingTime.js';
import { validateObjectId } from '../validation/appointmentValidation.js';
import { validatePriority, validateWalkInAppointment, validateWalkInPatient } from '../validation/staffOperationsValidation.js';

export const NO_SHOW_GRACE_PERIOD_MS = 5 * 60 * 1000;

function id(value) { const result = value?._id ?? value?.id ?? value; return result == null ? null : String(result); }
function iso(value) { return value ? new Date(value).toISOString() : null; }
function duplicateKey(error) { return error?.code === 11000; }
function priorityAuditView(item) {
  return {
    id: id(item), appointment_id: id(item.appointment_id), previous_priority: item.previous_priority,
    new_priority: item.new_priority, urgency_reason: item.urgency_reason ?? null,
    explanation: item.explanation ?? null, correction_reason: item.correction_reason ?? null,
    staff_actor: { id: id(item.staff_actor_user_profile_id), display_name: item.staff_actor_user_profile_id?.display_name ?? null },
    changed_at: iso(item.created_at),
  };
}
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
      if (!isValidDateOnly(date)) throw httpError(400, 'INVALID_DATE', 'date must use a valid YYYY-MM-DD value.');
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
      return (await repository.searchPatients(search)).map((item) => patientView(item, today));
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
      const current = now();
      const date = clinicDate(current, clinic.timeZone);
      const start = zonedDateTimeToUtc(date, '00:00', clinic.timeZone);
      const end = zonedDateTimeToUtc(addDays(date, 1), '00:00', clinic.timeZone);
      const existing = await repository.findAppointmentById(appointmentId);
      if (!existing) throw httpError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment was not found.');
      if (appointmentLocalParts(existing.appointment_at, clinic.timeZone).date !== date || !['pending', 'confirmed'].includes(existing.status) || existing.check_in_at) throw httpError(409, 'CHECK_IN_NOT_ALLOWED', 'Only an unchecked pending or confirmed appointment for the current clinic day can confirm arrival.');
      const updated = await repository.confirmArrivalEligible(appointmentId, current, start, end, existing.appointment_at);
      if (!updated) throw httpError(409, 'CHECK_IN_NOT_ALLOWED', 'Arrival can no longer be confirmed for this appointment.');
      return queueView(updated, date);
    },
    async updatePriority(staffProfileId, appointmentId, body) {
      validateObjectId(appointmentId, 'appointmentId');
      validateObjectId(staffProfileId, 'staffProfileId');
      const input = validatePriority(body);
      const existing = await repository.findAppointmentById(appointmentId);
      if (!existing) throw httpError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment was not found.');
      if (existing.status !== 'confirmed' || !existing.check_in_at) throw httpError(409, 'PRIORITY_NOT_ALLOWED', 'Priority can be changed only after Confirm Arrival for an active appointment.');
      if (existing.priority === input.priority) throw httpError(409, 'PRIORITY_NOT_ALLOWED', `This appointment is already ${input.priority}.`);
      if (existing.priority !== 'normal' || input.priority !== 'urgent') {
        if (existing.priority !== 'urgent' || input.priority !== 'normal') throw httpError(409, 'PRIORITY_NOT_ALLOWED', 'This priority transition is not allowed.');
      }
      const changed = await repository.changePriorityWithAudit(appointmentId, existing.priority, input, staffProfileId);
      if (!changed) throw httpError(409, 'PRIORITY_NOT_ALLOWED', 'Priority can no longer be changed for this appointment.');
      return { id: id(changed.appointment), priority: changed.appointment.priority, audit_event: priorityAuditView(changed.audit) };
    },
    async priorityHistory(appointmentId) {
      validateObjectId(appointmentId, 'appointmentId');
      if (!(await repository.findAppointmentById(appointmentId))) throw httpError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment was not found.');
      return (await repository.listPriorityHistory(appointmentId)).map(priorityAuditView);
    },
    async markNoShow(appointmentId) {
      validateObjectId(appointmentId, 'appointmentId');
      const current = now();
      const existing = await repository.findAppointmentById(appointmentId);
      if (!existing) throw httpError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment was not found.');
      if (appointmentLocalParts(existing.appointment_at, clinic.timeZone).date !== clinicDate(current, clinic.timeZone) || !['pending', 'confirmed'].includes(existing.status) || existing.check_in_at) throw httpError(409, 'NO_SHOW_NOT_ALLOWED', 'This appointment cannot be marked as no-show.');
      const eligibleAt = new Date(existing.appointment_at).getTime() + NO_SHOW_GRACE_PERIOD_MS;
      if (current.getTime() < eligibleAt) throw httpError(409, 'NO_SHOW_GRACE_PERIOD', 'No-show becomes available five minutes after the scheduled appointment time.');
      const cutoff = new Date(current.getTime() - NO_SHOW_GRACE_PERIOD_MS);
      const updated = await repository.markNoShowEligible(appointmentId, cutoff, existing.appointment_at);
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
