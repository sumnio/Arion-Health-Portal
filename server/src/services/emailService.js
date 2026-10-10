import { passwordResetTemplate, registrationVerificationTemplate } from './emailTemplates.js';

export class EmailDeliveryError extends Error {
  constructor() {
    super('Transactional email delivery failed.');
    this.name = 'EmailDeliveryError';
    this.code = 'EMAIL_DELIVERY_FAILED';
  }
}

function passwordResetUrl(appBaseUrl, token) {
  const url = new URL('/reset-password', appBaseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

export function createEmailService({ provider, appBaseUrl }) {
  async function deliver(to, template) {
    try {
      return await provider.send(Object.freeze({ to, ...template }));
    } catch {
      throw new EmailDeliveryError();
    }
  }
  return Object.freeze({
    providerName: provider.name,
    sendRegistrationVerificationEmail({ to, code, expiresMinutes = 10 }) {
      return deliver(to, registrationVerificationTemplate({ code, expiresMinutes }));
    },
    sendPasswordResetEmail({ to, token, expiresMinutes = 30 }) {
      return deliver(to, passwordResetTemplate({ resetUrl: passwordResetUrl(appBaseUrl, token), expiresMinutes }));
    },
  });
}
