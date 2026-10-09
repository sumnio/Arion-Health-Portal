import { staffOperationsRepository } from '../repositories/staffOperationsRepository.js';
import { createStaffOperationsService } from './staffOperationsService.js';

export function createStaffOperationsModule({ repository = staffOperationsRepository, clinic, notificationTriggers, now } = {}) {
  return { staffOperationsService: createStaffOperationsService({ repository, clinic, notificationTriggers, now }) };
}
