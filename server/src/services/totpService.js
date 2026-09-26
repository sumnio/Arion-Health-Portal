import { generateSecret, generateURI, verify } from 'otplib';

export const TOTP_ISSUER = 'Arion Health Portal';

export const totpService = Object.freeze({
  createEnrollment(label) {
    const secret = generateSecret({ length: 20 });
    return {
      secret,
      uri: generateURI({ issuer: TOTP_ISSUER, label, secret, period: 30, digits: 6 }),
    };
  },
  async verify(code, secret) {
    const result = await verify({ secret, token: code, period: 30, digits: 6, epochTolerance: 30 });
    return result.valid;
  },
});
