import { validateEmptyBody } from '../validation/inputValidation.js';
import { validatePatientSearchQuery, validateStaffAppointmentHistoryQuery, validateStaffAppointmentsQuery } from '../validation/staffOperationsValidation.js';
import { recordRequestAudit } from '../services/auditLogService.js';

export function createStaffOperationsController({ staffOperationsService }) {
  return {
    async appointments(request, response) { response.json({ appointments: await staffOperationsService.appointments(validateStaffAppointmentsQuery(request.query)) }); },
    async appointmentHistory(request, response) { response.json({ history: await staffOperationsService.appointmentHistory(validateStaffAppointmentHistoryQuery(request.query)) }); },
    async doctors(_request, response) { response.json({ doctors: await staffOperationsService.doctors() }); },
    async patients(request, response) { response.json({ patients: await staffOperationsService.searchPatients(validatePatientSearchQuery(request.query)) }); },
    async patient(request, response) { response.json(await staffOperationsService.patient(request.params.patientId)); },
    async walkInDuplicateReview(request, response) { response.json({ duplicate_review: await staffOperationsService.walkInDuplicateReview(request.body) }); },
    async registerWalkIn(request, response) { response.status(201).json({ patient: await staffOperationsService.registerWalkIn(request.body) }); },
    async createWalkInAppointment(request, response) { const appointment = await staffOperationsService.createWalkInAppointment(request.authUser.user_profile_id, request.params.patientId, request.body); if (appointment.portal_invitation?.status === 'sent') await recordRequestAudit(request, { category: 'PORTAL_INVITATION', action: 'PORTAL_INVITATION_SENT', result: 'success', target_type: 'Patient', target_id: request.params.patientId, target_display_snapshot: 'Patient portal invitation', safe_metadata: { invitation_mode: 'initial' } }); response.status(201).json({ appointment }); },
    async resendPortalInvitation(request, response) { const body = request.body ?? {}; if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'email')) throw Object.assign(new Error('Only email may be provided.'), { status: 400, code: 'INVALID_INPUT' }); const portalInvitation = await staffOperationsService.resendPortalInvitation(request.params.patientId, body); await recordRequestAudit(request, { category: 'PORTAL_INVITATION', action: 'PORTAL_INVITATION_RESENT', result: 'success', target_type: 'Patient', target_id: request.params.patientId, target_display_snapshot: 'Patient portal invitation', safe_metadata: { invitation_mode: 'resend' } }); response.json({ portal_invitation: portalInvitation }); },
    async checkIn(request, response) { validateEmptyBody(request.body); response.json({ queue_entry: await staffOperationsService.checkIn(request.params.appointmentId) }); },
    async priority(request, response) { response.json({ appointment: await staffOperationsService.updatePriority(request.authUser.user_profile_id, request.params.appointmentId, request.body) }); },
    async priorityHistory(request, response) { response.json({ priority_history: await staffOperationsService.priorityHistory(request.params.appointmentId) }); },
    async noShow(request, response) { validateEmptyBody(request.body); response.json({ appointment: await staffOperationsService.markNoShow(request.params.appointmentId) }); },
    async cancel(request, response) { validateEmptyBody(request.body); const appointment = await staffOperationsService.cancel(request.params.appointmentId); await recordRequestAudit(request, { category: 'APPOINTMENT', action: 'APPOINTMENT_CANCELLED', result: 'success', target_type: 'Appointment', target_id: appointment.id ?? request.params.appointmentId, target_display_snapshot: 'Appointment', safe_metadata: { new_status: appointment.status ?? 'cancelled' } }); response.json({ appointment }); },
    async queue(request, response) { response.json({ queue: await staffOperationsService.queue() }); },
    async recordSummary(request, response) { response.json({ medical_record_summaries: await staffOperationsService.recordSummary(request.params.patientId) }); },
  };
}
