import { httpError } from '../utils/httpError.js';
import {
  validateAppointmentCreate,
  validateAppointmentReschedule,
  validateObjectId,
} from '../validation/appointmentValidation.js';
import { invokeNotificationTrigger } from './notificationTriggerService.js';
import { invokeSmsReminderWorkflow } from './smsReminderWorkflow.js';
import { clinicDate } from '../utils/schedulingTime.js';

const RESCHEDULE_CUTOFF_MS = 60 * 60 * 1000;

function duplicateKey(error) {
  return error?.code === 11000;
}

function presentDoctor(doctor) {
  if (!doctor || typeof doctor !== 'object' || !doctor._id) {
    return doctor ? { id: String(doctor) } : null;
  }
  return {
    id: String(doctor._id),
    display_name: doctor.user_profile_id?.display_name ?? null,
    specialty: doctor.specialty ?? null,
  };
}

function presentAppointment(appointment, hasMedicalRecord = false, patientCreatorId = null) {
  return {
    id: String(appointment._id ?? appointment.id),
    patient_id: String(appointment.patient_id?._id ?? appointment.patient_id),
    doctor: presentDoctor(appointment.doctor_id),
    appointment_at: new Date(appointment.appointment_at).toISOString(),
    visit_type: appointment.visit_type,
    reason: appointment.reason,
    status: appointment.status,
    priority: appointment.priority,
    check_in_at: appointment.check_in_at
      ? new Date(appointment.check_in_at).toISOString()
      : null,
    has_medical_record: hasMedicalRecord,
    patient_created: Boolean(patientCreatorId && String(appointment.created_by?._id ?? appointment.created_by) === String(patientCreatorId)),
    source_medical_record_id: appointment.source_medical_record_id
      ? String(appointment.source_medical_record_id?._id ?? appointment.source_medical_record_id)
      : null,
    requires_reschedule_due_to_doctor_unavailability: appointment.requires_reschedule_due_to_doctor_unavailability === true,
  };
}

function compareAppointments(left, right, now) {
  const leftTime = new Date(left.appointment_at).getTime();
  const rightTime = new Date(right.appointment_at).getTime();
  const leftUpcoming = leftTime >= now.getTime();
  const rightUpcoming = rightTime >= now.getTime();
  if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
  return leftUpcoming ? leftTime - rightTime : rightTime - leftTime;
}

export function createAppointmentService({
  repository,
  patientService,
  bookingAvailabilityService,
  notificationTriggers,
  smsReminders,
  appointmentEmails,
  rescheduleSuggestionService,
  now = () => new Date(),
}) {
  async function ownPatient(userProfileId) {
    return patientService.resolveOwnPatient(userProfileId);
  }

  async function hasMedicalRecord(appointmentId) {
    return repository.medicalRecordExists ? repository.medicalRecordExists(appointmentId) : false;
  }

  async function recordedAppointmentIds(appointments) {
    const ids = appointments.map((item) => item._id ?? item.id);
    if (repository.listRecordedAppointmentIds) return new Set(await repository.listRecordedAppointmentIds(ids));
    const entries = await Promise.all(ids.map(async (appointmentId) => [String(appointmentId), await hasMedicalRecord(appointmentId)]));
    return new Set(entries.filter(([, recorded]) => recorded).map(([appointmentId]) => appointmentId));
  }

  return {
    async listDoctors() {
      return (await repository.listActiveDoctors()).map(presentDoctor);
    },

    async getAvailableSlots(doctorId, date) {
      if (!bookingAvailabilityService) {
        throw httpError(503, 'SCHEDULING_UNAVAILABLE', 'Scheduling service is unavailable.');
      }
      return bookingAvailabilityService.getPatientSlots(doctorId, date);
    },

    async createForPatient(userProfileId, body) {
      const patient = await ownPatient(userProfileId);
      const input = validateAppointmentCreate(
        body,
        now(),
        bookingAvailabilityService?.timeZone ?? 'Asia/Manila',
      );
      if (!(await repository.doctorExists(input.doctor_id))) {
        throw httpError(404, 'DOCTOR_NOT_FOUND', 'Doctor was not found.');
      }
      if (input.source_medical_record_id) {
        const record = await repository.findFollowUpRecordForPatient?.(
          input.source_medical_record_id,
          patient._id ?? patient.id,
        );
        if (!record || record.follow_up_required !== true) {
          throw httpError(404, 'FOLLOW_UP_RECOMMENDATION_NOT_FOUND', 'The follow-up recommendation was not found.');
        }
        if (String(record.doctor_id) !== String(input.doctor_id)
          || input.visit_type !== 'follow_up'
          || input.reason !== 'Follow-up consultation') {
          throw httpError(409, 'FOLLOW_UP_CONTEXT_MISMATCH', 'This appointment must use the recommended Doctor and follow-up visit type.');
        }
        const actualDate = clinicDate(input.appointment_at, bookingAvailabilityService?.timeZone ?? 'Asia/Manila');
        const recommendedDate = new Date(record.follow_up_recommended_date).toISOString().slice(0, 10);
        if (actualDate < recommendedDate) {
          throw httpError(409, 'FOLLOW_UP_BEFORE_RECOMMENDED_DATE', 'Choose a slot on or after the recommended follow-up date.');
        }
        if (await repository.findActiveLinkedFollowUp?.(input.source_medical_record_id)) {
          throw httpError(409, 'FOLLOW_UP_ALREADY_SCHEDULED', 'This follow-up recommendation already has an active appointment.');
        }
      }
      if (bookingAvailabilityService) {
        await bookingAvailabilityService.assertBookable(input.doctor_id, input.appointment_at);
      }
      try {
        const created = await repository.create({
          ...input,
          patient_id: patient._id ?? patient.id,
          status: 'pending',
          priority: 'normal',
          check_in_at: null,
          created_by: userProfileId,
        });
        const result = await repository.findOwnedById(
          created._id ?? created.id,
          patient._id ?? patient.id,
        );
        const appointment = result ?? created;
        await invokeNotificationTrigger(notificationTriggers, 'patientBooked', {
          appointmentId: appointment._id ?? appointment.id,
          doctorId: appointment.doctor_id?._id ?? appointment.doctor_id,
        });
        await invokeSmsReminderWorkflow(smsReminders, 'appointmentBooked', {
          appointmentId: appointment._id ?? appointment.id,
          patientId: appointment.patient_id?._id ?? appointment.patient_id,
          appointmentAt: appointment.appointment_at,
        });
        return presentAppointment(appointment, false, userProfileId);
      } catch (error) {
        if (duplicateKey(error)) {
          throw httpError(409, 'APPOINTMENT_SLOT_CONFLICT', 'That doctor and time slot is no longer available.');
        }
        throw error;
      }
    },

    async listForPatient(userProfileId) {
      const patient = await ownPatient(userProfileId);
      const current = now();
      const appointments = await repository.listByPatientId(patient._id ?? patient.id);
      const recorded = await recordedAppointmentIds(appointments);
      return appointments
        .map((appointment) => presentAppointment(appointment, recorded.has(String(appointment._id ?? appointment.id)), userProfileId))
        .sort((left, right) => compareAppointments(left, right, current));
    },

    async listAssistantAppointmentsForPatient(userProfileId) {
      const patient = await ownPatient(userProfileId);
      const appointments = await repository.listAssistantAppointmentsByPatientId(patient._id ?? patient.id);
      return appointments.map((appointment) => ({
        appointment_at: new Date(appointment.appointment_at).toISOString(),
        status: appointment.status,
        visit_type: appointment.visit_type,
        doctor_display_name: appointment.doctor_id?.user_profile_id?.display_name ?? null,
      }));
    },

    async getForPatient(userProfileId, appointmentId) {
      validateObjectId(appointmentId, 'appointmentId');
      const patient = await ownPatient(userProfileId);
      const appointment = await repository.findOwnedById(
        appointmentId,
        patient._id ?? patient.id,
      );
      if (!appointment) {
        throw httpError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment was not found.');
      }
      const result = presentAppointment(appointment, await hasMedicalRecord(appointmentId), userProfileId);
      if (result.requires_reschedule_due_to_doctor_unavailability && !result.has_medical_record && !result.check_in_at) {
        result.suggested_reschedule_slots = await rescheduleSuggestionService?.suggest(result.doctor.id, result.appointment_at) ?? [];
      }
      return result;
    },

    async cancelForPatient(userProfileId, appointmentId) {
      validateObjectId(appointmentId, 'appointmentId');
      const current = now();
      const patient = await ownPatient(userProfileId);
      const patientId = patient._id ?? patient.id;
      const existing = await repository.findOwnedById(appointmentId, patientId);
      if (!existing) {
        throw httpError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment was not found.');
      }
      if (!['pending', 'confirmed'].includes(existing.status)) {
        throw httpError(409, 'INVALID_STATUS_TRANSITION', 'This appointment cannot be cancelled.');
      }
      if (existing.check_in_at) {
        throw httpError(409, 'APPOINTMENT_ALREADY_CHECKED_IN', 'A checked-in appointment cannot be cancelled by the patient.');
      }
      if (new Date(existing.appointment_at) <= current) {
        throw httpError(409, 'APPOINTMENT_NOT_IN_FUTURE', 'Only a future appointment can be cancelled.');
      }
      if (await hasMedicalRecord(appointmentId)) {
        throw httpError(409, 'MEDICAL_RECORD_EXISTS', 'This consultation already has a medical record and cannot be cancelled.');
      }
      const updated = await repository.cancelOwnedEligible(appointmentId, patientId, current, existing.appointment_at);
      if (!updated) {
        throw httpError(409, 'INVALID_STATUS_TRANSITION', 'This appointment can no longer be cancelled.');
      }
      await invokeNotificationTrigger(notificationTriggers, 'patientCancelled', {
        appointmentId: updated._id ?? updated.id,
        patientId: updated.patient_id?._id ?? updated.patient_id,
        doctorId: updated.doctor_id?._id ?? updated.doctor_id,
      });
      await invokeSmsReminderWorkflow(smsReminders, 'appointmentCancelled', {
        appointmentId: updated._id ?? updated.id,
        patientId: updated.patient_id?._id ?? updated.patient_id,
        appointmentAt: updated.appointment_at,
      });
      return presentAppointment(updated, false, userProfileId);
    },

    async rescheduleForPatient(userProfileId, appointmentId, body) {
      validateObjectId(appointmentId, 'appointmentId');
      const current = now();
      const input = validateAppointmentReschedule(
        body,
        current,
        bookingAvailabilityService?.timeZone ?? 'Asia/Manila',
      );
      const patient = await ownPatient(userProfileId);
      const patientId = patient._id ?? patient.id;
      const existing = await repository.findOwnedById(appointmentId, patientId);
      if (!existing) {
        throw httpError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment was not found.');
      }
      if (!['pending', 'confirmed'].includes(existing.status)) {
        throw httpError(409, 'RESCHEDULE_NOT_ALLOWED', 'This appointment cannot be rescheduled.');
      }
      if (existing.check_in_at) {
        throw httpError(409, 'APPOINTMENT_ALREADY_CHECKED_IN', 'A checked-in appointment cannot be rescheduled.');
      }
      if (String(existing.created_by?._id ?? existing.created_by) !== String(userProfileId)) {
        throw httpError(409, 'RESCHEDULE_NOT_ALLOWED', 'Only appointments created by this Patient account can be rescheduled.');
      }
      const originalTime = new Date(existing.appointment_at);
      if (originalTime.getTime() - current.getTime() < RESCHEDULE_CUTOFF_MS) {
        throw httpError(409, 'RESCHEDULE_CUTOFF_PASSED', 'Appointments can be rescheduled only until one hour before the scheduled time.');
      }
      if (await hasMedicalRecord(appointmentId)) {
        throw httpError(409, 'MEDICAL_RECORD_EXISTS', 'This consultation already has a medical record and cannot be rescheduled.');
      }
      if (input.appointment_at.getTime() === originalTime.getTime()) {
        throw httpError(409, 'RESCHEDULE_NO_CHANGE', 'Choose a different appointment time.');
      }
      if (!bookingAvailabilityService) {
        throw httpError(503, 'SCHEDULING_UNAVAILABLE', 'Scheduling service is unavailable.');
      }
      const doctorId = existing.doctor_id?._id ?? existing.doctor_id;
      await bookingAvailabilityService.assertBookable(doctorId, input.appointment_at);
      try {
        const updated = await repository.rescheduleOwnedEligible({
          appointmentId,
          patientId,
          userProfileId,
          doctorId,
          expectedAppointmentAt: originalTime,
          eligibilityCutoff: new Date(current.getTime() + RESCHEDULE_CUTOFF_MS),
          appointmentAt: input.appointment_at,
        });
        if (!updated) {
          throw httpError(409, 'RESCHEDULE_CONFLICT', 'This appointment changed and can no longer be rescheduled with that request.');
        }
        await invokeNotificationTrigger(notificationTriggers, 'patientRescheduled', {
          appointmentId: updated._id ?? updated.id,
          patientId: updated.patient_id?._id ?? updated.patient_id,
          doctorId: updated.doctor_id?._id ?? updated.doctor_id,
        });
        await invokeSmsReminderWorkflow(smsReminders, 'appointmentRescheduled', {
          appointmentId: updated._id ?? updated.id,
          patientId: updated.patient_id?._id ?? updated.patient_id,
          appointmentAt: updated.appointment_at,
        });
        let emailNotification = 'skipped';
        try {
          const result = await appointmentEmails?.appointmentRescheduled?.({
            appointmentId: updated._id ?? updated.id,
            patientId: updated.patient_id?._id ?? updated.patient_id,
            appointmentAt: updated.appointment_at,
            doctorName: updated.doctor_id?.user_profile_id?.display_name ?? null,
          });
          emailNotification = result?.status ?? 'skipped';
        } catch {
          emailNotification = 'failed';
        }
        return { ...presentAppointment(updated, false, userProfileId), email_notification: emailNotification };
      } catch (error) {
        if (duplicateKey(error)) {
          throw httpError(409, 'APPOINTMENT_SLOT_CONFLICT', 'That doctor and time slot is no longer available.');
        }
        throw error;
      }
    },

    async rescheduleForStaff(appointmentId, validatedInput) {
      const existing = await repository.findById(appointmentId);
      if (!existing || !existing.requires_reschedule_due_to_doctor_unavailability) throw httpError(409, 'APPOINTMENT_NOT_AFFECTED', 'This appointment does not require Doctor-unavailability rescheduling.');
      if (!['pending', 'confirmed'].includes(existing.status) || existing.check_in_at || await hasMedicalRecord(appointmentId)) throw httpError(409, 'RESCHEDULE_NOT_ALLOWED', 'This appointment is locked and requires manual Staff review.');
      const originalTime = new Date(existing.appointment_at);
      if (validatedInput.appointment_at.getTime() === originalTime.getTime()) throw httpError(409, 'RESCHEDULE_NO_CHANGE', 'Choose a different appointment time.');
      const doctorId = existing.doctor_id?._id ?? existing.doctor_id;
      await bookingAvailabilityService.assertBookable(doctorId, validatedInput.appointment_at);
      try {
        const updated = await repository.rescheduleAffectedForStaff({ appointmentId, doctorId, expectedAppointmentAt: originalTime, appointmentAt: validatedInput.appointment_at });
        if (!updated) throw httpError(409, 'RESCHEDULE_CONFLICT', 'This appointment changed before rescheduling could finish.');
        const payload = { appointmentId: updated._id, patientId: updated.patient_id, doctorId: updated.doctor_id?._id ?? updated.doctor_id };
        await invokeNotificationTrigger(notificationTriggers, 'staffRescheduled', payload);
        await invokeSmsReminderWorkflow(smsReminders, 'appointmentRescheduled', { appointmentId: updated._id, patientId: updated.patient_id, appointmentAt: updated.appointment_at });
        let emailNotification = 'skipped';
        try { emailNotification = (await appointmentEmails?.appointmentRescheduled?.({ appointmentId: updated._id, patientId: updated.patient_id, appointmentAt: updated.appointment_at, doctorName: updated.doctor_id?.user_profile_id?.display_name ?? null }))?.status ?? 'skipped'; } catch { emailNotification = 'failed'; }
        return { ...presentAppointment(updated), email_notification: emailNotification };
      } catch (error) {
        if (duplicateKey(error)) throw httpError(409, 'APPOINTMENT_SLOT_CONFLICT', 'That doctor and time slot is no longer available.');
        throw error;
      }
    },

    async confirmForStaff(appointmentId) {
      validateObjectId(appointmentId, 'appointmentId');
      const existing = await repository.findById(appointmentId);
      if (!existing) {
        throw httpError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment was not found.');
      }
      if (existing.status !== 'pending') {
        throw httpError(409, 'INVALID_STATUS_TRANSITION', 'Only a pending appointment can be confirmed.');
      }
      const updated = await repository.confirmPending(appointmentId);
      if (!updated) {
        throw httpError(409, 'INVALID_STATUS_TRANSITION', 'This appointment can no longer be confirmed.');
      }
      await invokeNotificationTrigger(notificationTriggers, 'appointmentConfirmed', {
        appointmentId: updated._id ?? updated.id,
        patientId: updated.patient_id?._id ?? updated.patient_id,
      });
      await invokeSmsReminderWorkflow(smsReminders, 'appointmentArrived', {
        appointmentId: updated._id ?? updated.id,
      });
      return presentAppointment(updated);
    },
  };
}
