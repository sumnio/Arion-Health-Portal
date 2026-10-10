import { accountSecurityRepository } from '../repositories/accountSecurityRepository.js';
import { createAccountSecurityService } from './accountSecurityService.js';
import { createAccountTokenService } from './accountTokenService.js';

export function createAccountSecurityModule({
  accountTokenHmacSecret,
  nodeEnv = 'development',
  repository = accountSecurityRepository,
  clock,
} = {}) {
  const tokens = createAccountTokenService(accountTokenHmacSecret, nodeEnv);
  const service = createAccountSecurityService({ repository, tokens, clock });
  return { service, tokens };
}
