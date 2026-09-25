import { staffOperationsRepository } from '../repositories/staffOperationsRepository.js';
import { createStaffOperationsService } from './staffOperationsService.js';

export function createStaffOperationsModule({ repository = staffOperationsRepository, clinic, now } = {}) {
  return { staffOperationsService: createStaffOperationsService({ repository, clinic, now }) };
}
