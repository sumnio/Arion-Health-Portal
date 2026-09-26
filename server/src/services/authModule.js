import { authRepository } from '../repositories/authRepository.js';
import { createAuthService } from './authService.js';
import { passwordService } from './passwordService.js';
import { createTokenService } from './tokenService.js';
import { createMfaEncryptionService } from './mfaEncryptionService.js';
import { createMfaService } from './mfaService.js';
import { totpService } from './totpService.js';

export function createAuthModule({ authSecret, mfaEncryptionKey, nodeEnv = 'development', repository = authRepository } = {}) {
  const tokens = createTokenService(authSecret, nodeEnv);
  const encryption = createMfaEncryptionService(mfaEncryptionKey, nodeEnv);
  const mfaService = createMfaService({ repository, tokens, encryption, totp: totpService });
  const service = createAuthService({ repository, passwords: passwordService, tokens, mfa: mfaService });
  return { service, tokens, mfaService };
}
