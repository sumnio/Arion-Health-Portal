import { pwdVerificationRepository } from '../repositories/pwdVerificationRepository.js';
import { createGridFsPwdVerificationStorage } from './pwdVerificationStorage.js';
import { createPwdVerificationService } from './pwdVerificationService.js';

export function createPwdVerificationModule({
  repository = pwdVerificationRepository,
  storage = createGridFsPwdVerificationStorage(),
  notificationTriggers,
  now,
} = {}) {
  return Object.freeze({
    pwdVerificationService: createPwdVerificationService({ repository, storage, notificationTriggers, now }),
  });
}
