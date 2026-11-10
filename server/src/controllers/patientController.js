import { validateEmptyBody } from '../validation/inputValidation.js';
import { validateSlotQueryParameters } from '../validation/schedulingValidation.js';
import { recordRequestAudit } from '../services/auditLogService.js';

export function createPatientController({ patientService, appointmentService }) {
  return {
    async profile(request, response) {
      const patient = await patientService.getOwnProfile(request.authUser.user_profile_id);
      response.json({ patient });
    },

    async updateProfile(request, response) {
      const patient = await patientService.updateOwnProfile(
        request.authUser.user_profile_id,
        request.body,
      );
      response.json({ patient });
    },

    async createAppointment(request, response) {
      const appointment = await appointmentService.createForPatient(
        request.authUser.user_profile_id,
        request.body,
      );
      response.status(201).json({ appointment });
    },

    async availableSlots(request, response) {
      const result = await appointmentService.getAvailableSlots(
        request.params.doctorId,
        validateSlotQueryParameters(request.query),
      );
      response.json(result);
    },

    async doctors(_request, response) {
      response.json({ doctors: await appointmentService.listDoctors() });
    },

    async listAppointments(request, response) {
      const appointments = await appointmentService.listForPatient(
        request.authUser.user_profile_id,
      );
      response.json({ appointments });
    },

    async appointment(request, response) {
      const appointment = await appointmentService.getForPatient(
        request.authUser.user_profile_id,
        request.params.appointmentId,
      );
      response.json({ appointment });
    },

    async cancelAppointment(request, response) {
      validateEmptyBody(request.body);
      const appointment = await appointmentService.cancelForPatient(
        request.authUser.user_profile_id,
        request.params.appointmentId,
      );
      await recordRequestAudit(request, {
        category: 'APPOINTMENT', action: 'APPOINTMENT_CANCELLED', result: 'success',
        target_type: 'Appointment', target_id: appointment.id ?? request.params.appointmentId,
        target_display_snapshot: 'Appointment',
        safe_metadata: { old_status: 'pending_or_confirmed', new_status: appointment.status ?? 'cancelled' },
      });
      response.json({ appointment });
    },

    async rescheduleAppointment(request, response) {
      const appointment = await appointmentService.rescheduleForPatient(
        request.authUser.user_profile_id,
        request.params.appointmentId,
        request.body,
      );
      await recordRequestAudit(request, {
        category: 'APPOINTMENT', action: 'APPOINTMENT_RESCHEDULED', result: 'success',
        target_type: 'Appointment', target_id: appointment.id ?? request.params.appointmentId,
        target_display_snapshot: 'Appointment',
        safe_metadata: {
          new_date: appointment.appointment_date,
          new_time: appointment.appointment_time,
          new_status: appointment.status,
        },
      });
      response.json({ appointment });
    },
  };
}
