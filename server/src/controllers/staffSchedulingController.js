import { requestSecurityEvent } from '../services/securityLogger.js';
import { validateEmptyBody } from '../validation/inputValidation.js';

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

export function createStaffSchedulingController({ doctorAvailabilityService }) {
  return {
    async schedule(request, response) {
      response.json({ schedule: await doctorAvailabilityService.getStaffSchedule(request.params.doctorId) });
    },
    async createRecurring(request, response) {
      const availability = await doctorAvailabilityService.createRecurringForDoctor(request.params.doctorId, request.body);
      logChange(request, 'recurring_availability_created', availability.id);
      response.status(201).json({ availability });
    },
    async updateRecurring(request, response) {
      const availability = await doctorAvailabilityService.updateRecurringForDoctor(request.params.doctorId, request.params.availabilityId, request.body);
      logChange(request, 'recurring_availability_updated', availability.id);
      response.json({ availability });
    },
    async deleteRecurring(request, response) {
      validateEmptyBody(request.body);
      const result = await doctorAvailabilityService.deleteRecurringForDoctor(request.params.doctorId, request.params.availabilityId);
      logChange(request, 'recurring_availability_deleted', result.id);
      response.json(result);
    },
    async createPublished(request, response) {
      const published = await doctorAvailabilityService.createPublishedForDoctor(request.params.doctorId, request.body);
      logChange(request, 'published_availability_created', published.id);
      response.status(201).json({ published_availability: published });
    },
    async deletePublished(request, response) {
      validateEmptyBody(request.body);
      const result = await doctorAvailabilityService.deletePublishedForDoctor(request.params.doctorId, request.params.publishedId);
      logChange(request, 'published_availability_deleted', result.id);
      response.json(result);
    },
    async createBlocked(request, response) {
      const blocked = await doctorAvailabilityService.createBlockedForDoctor(request.params.doctorId, request.body);
      logChange(request, 'blocked_time_created', blocked.id);
      response.status(201).json({ blocked_time: blocked });
    },
    async deleteBlocked(request, response) {
      validateEmptyBody(request.body);
      const result = await doctorAvailabilityService.deleteBlockedForDoctor(request.params.doctorId, request.params.blockedTimeId);
      logChange(request, 'blocked_time_deleted', result.id);
      response.json(result);
    },
  };
}
