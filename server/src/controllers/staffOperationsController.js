import { validateEmptyBody } from '../validation/inputValidation.js';
import { validatePatientSearchQuery, validateStaffAppointmentsQuery } from '../validation/staffOperationsValidation.js';

export function createStaffOperationsController({ staffOperationsService }) {
  return {
    async appointments(request, response) { response.json({ appointments: await staffOperationsService.appointments(validateStaffAppointmentsQuery(request.query)) }); },
    async doctors(_request, response) { response.json({ doctors: await staffOperationsService.doctors() }); },
    async patients(request, response) { response.json({ patients: await staffOperationsService.searchPatients(validatePatientSearchQuery(request.query)) }); },
    async patient(request, response) { response.json({ patient: await staffOperationsService.patient(request.params.patientId) }); },
    async registerWalkIn(request, response) { response.status(201).json({ patient: await staffOperationsService.registerWalkIn(request.body) }); },
    async createWalkInAppointment(request, response) { response.status(201).json({ appointment: await staffOperationsService.createWalkInAppointment(request.authUser.user_profile_id, request.params.patientId, request.body) }); },
    async checkIn(request, response) { validateEmptyBody(request.body); response.json({ queue_entry: await staffOperationsService.checkIn(request.params.appointmentId) }); },
    async priority(request, response) { response.json({ appointment: await staffOperationsService.updatePriority(request.params.appointmentId, request.body) }); },
    async noShow(request, response) { validateEmptyBody(request.body); response.json({ appointment: await staffOperationsService.markNoShow(request.params.appointmentId) }); },
    async cancel(request, response) { validateEmptyBody(request.body); response.json({ appointment: await staffOperationsService.cancel(request.params.appointmentId) }); },
    async queue(request, response) { response.json({ queue: await staffOperationsService.queue() }); },
    async recordSummary(request, response) { response.json({ medical_record_summaries: await staffOperationsService.recordSummary(request.params.patientId) }); },
  };
}
