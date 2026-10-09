import { notificationRepository } from '../repositories/notificationRepository.js';
import { createNotificationService } from './notificationService.js';
import { createNotificationTriggerService } from './notificationTriggerService.js';

export function createNotificationModule({ repository = notificationRepository, now, logger } = {}) {
  const notificationService = createNotificationService({ repository, now });
  const notificationTriggerService = createNotificationTriggerService({
    repository,
    notificationService,
    logger,
  });
  return { notificationService, notificationTriggerService };
}
