import { authRepository } from '../repositories/authRepository.js';
import { createAuthService } from './authService.js';
import { passwordService } from './passwordService.js';
import { createTokenService } from './tokenService.js';

export function createAuthModule({ authSecret, repository = authRepository } = {}) {
  const tokens = createTokenService(authSecret);
  const service = createAuthService({ repository, passwords: passwordService, tokens });
  return { service, tokens };
}
