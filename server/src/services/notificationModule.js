import { notificationRepository } from '../repositories/notificationRepository.js';
import { createNotificationService } from './notificationService.js';

export function createNotificationModule({ repository = notificationRepository, now } = {}) {
  return { notificationService: createNotificationService({ repository, now }) };
}
