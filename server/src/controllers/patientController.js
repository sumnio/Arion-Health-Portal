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
        request.query.date,
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
      const appointment = await appointmentService.cancelForPatient(
        request.authUser.user_profile_id,
        request.params.appointmentId,
      );
      response.json({ appointment });
    },
  };
}
