import { validateEmptyBody } from '../validation/inputValidation.js';

export function createStaffAppointmentController({ appointmentService }) {
  return {
    async confirm(request, response) {
      validateEmptyBody(request.body);
      const appointment = await appointmentService.confirmForStaff(
        request.params.appointmentId,
      );
      response.json({ appointment });
    },
  };
}
