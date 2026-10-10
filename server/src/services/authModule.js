import { authRepository } from '../repositories/authRepository.js';
import { createAuthService } from './authService.js';
import { passwordService } from './passwordService.js';
import { createTokenService } from './tokenService.js';
import { createMfaEncryptionService } from './mfaEncryptionService.js';
import { createMfaService } from './mfaService.js';
import { totpService } from './totpService.js';
import { createAccountSecurityModule } from './accountSecurityModule.js';
import { createEmailModule } from './emailModule.js';

export function createAuthModule({
  authSecret,
  mfaEncryptionKey,
  accountTokenHmacSecret,
  emailProvider,
  resendApiKey,
  emailFrom,
  appBaseUrl,
  nodeEnv = 'development',
  repository = authRepository,
  accountSecurityModule,
  emailModule,
} = {}) {
  const tokens = createTokenService(authSecret, nodeEnv);
  const encryption = createMfaEncryptionService(mfaEncryptionKey, nodeEnv);
  const mfaService = createMfaService({ repository, tokens, encryption, totp: totpService });
  const security = accountSecurityModule ?? createAccountSecurityModule({ accountTokenHmacSecret, nodeEnv });
  const mail = emailModule ?? createEmailModule({ emailProvider, resendApiKey, emailFrom, appBaseUrl });
  const service = createAuthService({
    repository,
    passwords: passwordService,
    tokens,
    mfa: mfaService,
    accountSecurity: security.service,
    email: mail.emailService,
  });
  return { service, tokens, mfaService, emailProvider: mail.provider };
}
