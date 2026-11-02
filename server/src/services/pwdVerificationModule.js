import { pwdVerificationRepository } from '../repositories/pwdVerificationRepository.js';
import { createGridFsPwdVerificationStorage } from './pwdVerificationStorage.js';
import { createPwdVerificationService } from './pwdVerificationService.js';

export function createPwdVerificationModule({
  repository = pwdVerificationRepository,
  storage = createGridFsPwdVerificationStorage(),
  now,
} = {}) {
  return Object.freeze({
    pwdVerificationService: createPwdVerificationService({ repository, storage, now }),
  });
}
