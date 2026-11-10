import { requestSecurityEvent } from '../services/securityLogger.js';
import { validateEmptyBody } from '../validation/inputValidation.js';
import { validateSlotQueryParameters } from '../validation/schedulingValidation.js';
import { recordRequestAudit } from '../services/auditLogService.js';

function logChange(request, action, recordId) {
  requestSecurityEvent(request, {
    event: 'STAFF_SCHEDULE_CHANGE',
    severity: 'info',
    outcome: 'success',
    target_type: 'doctor_schedule',
    target_id: request.params.doctorId,
    metadata: { action, schedule_record_id: recordId },
  });
}

function auditSchedule(request, action, targetId, record = {}) {
  return recordRequestAudit(request, {
    category: action === 'DOCTOR_UNAVAILABILITY_RESCHEDULE_CONFIRMED' ? 'APPOINTMENT' : 'SCHEDULE',
    action,
    result: 'success',
    target_type: action === 'DOCTOR_UNAVAILABILITY_RESCHEDULE_CONFIRMED' ? 'Appointment' : 'Doctor Schedule',
    target_id: targetId,
    target_display_snapshot: action === 'DOCTOR_UNAVAILABILITY_RESCHEDULE_CONFIRMED' ? 'Appointment' : 'Doctor Schedule',
    safe_metadata: {
      date: record.date,
      day_of_week: record.day_of_week,
      start_time: record.start_time,
      end_time: record.end_time,
      start_at: record.start_at,
      end_at: record.end_at,
      operation: action,
      new_date: record.appointment_date,
      new_time: record.appointment_time,
    },
  });
}

export function createStaffSchedulingController({ doctorAvailabilityService, bookingAvailabilityService, doctorUnavailabilityService }) {
  return {
    async availableSlots(request, response) {
      const date = validateSlotQueryParameters(request.query);
      response.json(await bookingAvailabilityService.getPatientSlots(request.params.doctorId, date));
    },
    async schedule(request, response) {
      const [schedule, affected] = await Promise.all([
        doctorAvailabilityService.getStaffSchedule(request.params.doctorId),
        doctorUnavailabilityService?.listAffectedForDoctor(request.params.doctorId) ?? [],
      ]);
      response.json({ schedule: { ...schedule, affected_appointments: affected } });
    },
    async createRecurring(request, response) {
      const availability = await doctorAvailabilityService.createRecurringForDoctor(request.params.doctorId, request.body);
      logChange(request, 'recurring_availability_created', availability.id);
      await auditSchedule(request, 'WORKING_HOURS_CREATED', availability.id, availability);
      response.status(201).json({ availability });
    },
    async updateRecurring(request, response) {
      const availability = await doctorAvailabilityService.updateRecurringForDoctor(request.params.doctorId, request.params.availabilityId, request.body);
      logChange(request, 'recurring_availability_updated', availability.id);
      await auditSchedule(request, 'WORKING_HOURS_UPDATED', availability.id, availability);
      response.json({ availability });
    },
    async deleteRecurring(request, response) {
      validateEmptyBody(request.body);
      const result = await doctorAvailabilityService.deleteRecurringForDoctor(request.params.doctorId, request.params.availabilityId);
      logChange(request, 'recurring_availability_deleted', result.id);
      await auditSchedule(request, 'WORKING_HOURS_DELETED', result.id, result);
      response.json(result);
    },
    async createPublished(request, response) {
      const published = await doctorAvailabilityService.createPublishedForDoctor(request.params.doctorId, request.body);
      logChange(request, 'published_availability_created', published.id);
      await auditSchedule(request, 'PUBLISHED_AVAILABILITY_CREATED', published.id, published);
      response.status(201).json({ published_availability: published });
    },
    async updatePublished(request, response) {
      const published = await doctorAvailabilityService.updatePublishedForDoctor(
        request.params.doctorId,
        request.params.publishedId,
        request.body,
      );
      logChange(request, 'published_availability_updated', published.id);
      await auditSchedule(request, 'PUBLISHED_AVAILABILITY_UPDATED', published.id, published);
      response.json({ published_availability: published });
    },
    async deletePublished(request, response) {
      validateEmptyBody(request.body);
      const result = await doctorAvailabilityService.deletePublishedForDoctor(request.params.doctorId, request.params.publishedId);
      logChange(request, 'published_availability_deleted', result.id);
      await auditSchedule(request, 'PUBLISHED_AVAILABILITY_REMOVED', result.id, result);
      response.json(result);
    },
    async excludePublishedOccurrence(request, response) {
      const result = await doctorAvailabilityService.excludePublishedOccurrenceForDoctor(
        request.params.doctorId,
        request.params.publishedId,
        request.body,
      );
      logChange(request, 'published_availability_occurrence_excluded', result.id);
      await auditSchedule(request, 'PUBLISHED_AVAILABILITY_REMOVED', result.id, result);
      response.json(result);
    },
    async createBlocked(request, response) {
      const blocked = await doctorAvailabilityService.createBlockedForDoctor(request.params.doctorId, request.body);
      const affected = await doctorUnavailabilityService?.blockedTimeCreated({ ...blocked, doctor_id: request.params.doctorId }) ?? [];
      logChange(request, 'blocked_time_created', blocked.id);
      await auditSchedule(request, 'TIME_OFF_CREATED', blocked.id, blocked);
      response.status(201).json({ blocked_time: blocked, affected_appointments: affected, affected_count: affected.length });
    },
    async deleteBlocked(request, response) {
      validateEmptyBody(request.body);
      const result = await doctorAvailabilityService.deleteBlockedForDoctor(request.params.doctorId, request.params.blockedTimeId);
      await doctorUnavailabilityService?.blockedTimeDeleted(result.id);
      logChange(request, 'blocked_time_deleted', result.id);
      await auditSchedule(request, 'TIME_OFF_REMOVED', result.id, result);
      response.json(result);
    },
    async rescheduleAffected(request, response) {
      const appointment = await doctorUnavailabilityService.rescheduleForStaff(request.params.appointmentId, request.body);
      logChange(request, 'affected_appointment_rescheduled', appointment.id);
      await auditSchedule(request, 'DOCTOR_UNAVAILABILITY_RESCHEDULE_CONFIRMED', appointment.id, appointment);
      response.json({ appointment });
    },
  };
}
