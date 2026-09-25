export function createStaffOperationsController({ staffOperationsService }) {
  return {
    async patients(request, response) { response.json({ patients: await staffOperationsService.searchPatients(request.query.search ?? '') }); },
    async registerWalkIn(request, response) { response.status(201).json({ patient: await staffOperationsService.registerWalkIn(request.body) }); },
    async createWalkInAppointment(request, response) { response.status(201).json({ appointment: await staffOperationsService.createWalkInAppointment(request.authUser.user_profile_id, request.params.patientId, request.body) }); },
    async checkIn(request, response) { response.json({ queue_entry: await staffOperationsService.checkIn(request.params.appointmentId) }); },
    async priority(request, response) { response.json({ appointment: await staffOperationsService.updatePriority(request.params.appointmentId, request.body) }); },
    async noShow(request, response) { response.json({ appointment: await staffOperationsService.markNoShow(request.params.appointmentId) }); },
    async queue(request, response) { response.json({ queue: await staffOperationsService.queue() }); },
    async recordSummary(request, response) { response.json({ medical_record_summaries: await staffOperationsService.recordSummary(request.params.patientId) }); },
  };
}
