import { httpError } from '../utils/httpError.js';
import { validateAppointmentReschedule, validateObjectId } from '../validation/appointmentValidation.js';
import { invokeNotificationTrigger } from './notificationTriggerService.js';
import { invokeSmsReminderWorkflow } from './smsReminderWorkflow.js';

function id(value) { return String(value?._id ?? value?.id ?? value); }
function doctorView(value) { return { id: id(value), display_name: value?.user_profile_id?.display_name ?? null, specialty: value?.specialty ?? null }; }
function patientView(value) { return { id: id(value), full_name: value?.full_name ?? null }; }

export function createDoctorUnavailabilityService({ repository, suggestionService, appointmentService, notificationTriggers, smsReminders, email, now = () => new Date() }) {
  async function operationalView(appointment) {
    const appointmentId = id(appointment);
    const locked = Boolean(appointment.check_in_at || await repository.medicalRecordExists(appointmentId));
    return {
      id: appointmentId,
      patient: patientView(appointment.patient_id),
      doctor: doctorView(appointment.doctor_id),
      appointment_at: new Date(appointment.appointment_at).toISOString(),
      visit_type: appointment.visit_type,
      status: appointment.status,
      source_medical_record_id: appointment.source_medical_record_id ? id(appointment.source_medical_record_id) : null,
      locked,
      suggested_slots: locked ? [] : await suggestionService.suggest(id(appointment.doctor_id), appointment.appointment_at),
    };
  }

  async function sendAffectedMessages(appointment) {
    const payload = { appointmentId: id(appointment), patientId: id(appointment.patient_id), doctorId: id(appointment.doctor_id) };
    await invokeNotificationTrigger(notificationTriggers, 'doctorUnavailable', payload);
    await invokeSmsReminderWorkflow(smsReminders, 'appointmentDoctorUnavailable', { appointmentId: payload.appointmentId });
    try {
      const recipient = await repository.findRescheduleEmailRecipient(payload.patientId);
      if (recipient?.has_portal_account && recipient.email) {
        await email?.sendAppointmentNeedsRescheduleEmail?.({ to: recipient.email, appointmentId: payload.appointmentId });
      }
    } catch {
      // Email is best effort and must not roll back the saved unavailable period.
    }
  }

  return Object.freeze({
    async blockedTimeCreated(blocked) {
      const affected = await repository.flagAppointmentsForDoctorBlock(blocked.doctor_id, blocked._id ?? blocked.id, blocked.start_at, blocked.end_at, now());
      await Promise.all(affected.map(sendAffectedMessages));
      return Promise.all(affected.map(operationalView));
    },
    async blockedTimeDeleted(blockedId) {
      await repository.removeDoctorBlockFlag(blockedId);
    },
    async listAffectedForDoctor(doctorId) {
      validateObjectId(doctorId, 'doctorId');
      return Promise.all((await repository.listAffectedAppointmentsForDoctor(doctorId)).map(operationalView));
    },
    async rescheduleForStaff(appointmentId, body) {
      validateObjectId(appointmentId, 'appointmentId');
      const input = validateAppointmentReschedule(body, now(), suggestionService.timeZone ?? 'Asia/Manila');
      return appointmentService.rescheduleForStaff(appointmentId, input);
    },
    async requireAffected(appointmentId) {
      const appointment = await repository.findById(appointmentId);
      if (!appointment?.requires_reschedule_due_to_doctor_unavailability) {
        throw httpError(409, 'APPOINTMENT_NOT_AFFECTED', 'This appointment does not require Doctor-unavailability rescheduling.');
      }
      return appointment;
    },
  });
}
