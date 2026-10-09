import { httpError } from '../utils/httpError.js';
import {
  validateAppointmentCreate,
  validateAppointmentReschedule,
  validateObjectId,
} from '../validation/appointmentValidation.js';
import { invokeNotificationTrigger } from './notificationTriggerService.js';

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
      return presentAppointment(appointment, await hasMedicalRecord(appointmentId), userProfileId);
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
        return presentAppointment(updated, false, userProfileId);
      } catch (error) {
        if (duplicateKey(error)) {
          throw httpError(409, 'APPOINTMENT_SLOT_CONFLICT', 'That doctor and time slot is no longer available.');
        }
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
      return presentAppointment(updated);
    },
  };
}
