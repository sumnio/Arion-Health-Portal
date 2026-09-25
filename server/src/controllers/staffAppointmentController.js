export function createStaffAppointmentController({ appointmentService }) {
  return {
    async confirm(request, response) {
      const appointment = await appointmentService.confirmForStaff(
        request.params.appointmentId,
      );
      response.json({ appointment });
    },
  };
}
