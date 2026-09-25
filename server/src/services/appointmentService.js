import { httpError } from '../utils/httpError.js';
import {
  validateAppointmentCreate,
  validateObjectId,
} from '../validation/appointmentValidation.js';

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

function presentAppointment(appointment) {
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
  now = () => new Date(),
}) {
  async function ownPatient(userProfileId) {
    return patientService.resolveOwnPatient(userProfileId);
  }

  return {
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
        return presentAppointment(result ?? created);
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
      return appointments
        .map(presentAppointment)
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
      return presentAppointment(appointment);
    },

    async cancelForPatient(userProfileId, appointmentId) {
      validateObjectId(appointmentId, 'appointmentId');
      const patient = await ownPatient(userProfileId);
      const patientId = patient._id ?? patient.id;
      const existing = await repository.findOwnedById(appointmentId, patientId);
      if (!existing) {
        throw httpError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment was not found.');
      }
      if (!['pending', 'confirmed'].includes(existing.status)) {
        throw httpError(409, 'INVALID_STATUS_TRANSITION', 'This appointment cannot be cancelled.');
      }
      const updated = await repository.cancelOwnedEligible(appointmentId, patientId);
      if (!updated) {
        throw httpError(409, 'INVALID_STATUS_TRANSITION', 'This appointment can no longer be cancelled.');
      }
      return presentAppointment(updated);
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
      return presentAppointment(updated);
    },
  };
}
