import { createEmailService } from './emailService.js';
import { createFakeEmailProvider } from './fakeEmailProvider.js';
import { createResendEmailProvider } from './resendEmailProvider.js';

export function createEmailModule(
  { emailProvider = 'fake', resendApiKey = '', emailFrom = '', appBaseUrl = 'http://127.0.0.1:5173' } = {},
  { fetchImpl, capture } = {},
) {
  const provider = emailProvider === 'resend'
    ? createResendEmailProvider({ apiKey: resendApiKey, from: emailFrom, fetchImpl })
    : createFakeEmailProvider({ capture });
  return { provider, emailService: createEmailService({ provider, appBaseUrl }) };
}
