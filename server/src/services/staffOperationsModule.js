import { staffOperationsRepository } from '../repositories/staffOperationsRepository.js';
import { createStaffOperationsService } from './staffOperationsService.js';

export function createStaffOperationsModule({ repository = staffOperationsRepository, clinic, bookingAvailabilityService, notificationTriggers, smsReminders, portalInvitations, now } = {}) {
  return { staffOperationsService: createStaffOperationsService({ repository, clinic, bookingAvailabilityService, notificationTriggers, smsReminders, portalInvitations, now }) };
}
