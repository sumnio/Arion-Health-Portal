import { adminAccountRepository } from '../repositories/adminAccountRepository.js';
import { passwordService } from './passwordService.js';
import { createAdminAccountService } from './adminAccountService.js';

export function createAdminAccountModule({ repository = adminAccountRepository, passwords = passwordService } = {}) {
  return { adminAccountService: createAdminAccountService({ repository, passwords }) };
}
