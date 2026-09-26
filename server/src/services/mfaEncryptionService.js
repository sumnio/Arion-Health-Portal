import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { requireMfaEncryptionKey } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

export function createMfaEncryptionService(encodedKey, nodeEnv = 'development') {
  let key;
  const encryptionKey = () => {
    key ??= Buffer.from(requireMfaEncryptionKey(encodedKey, nodeEnv), 'base64');
    return key;
  };
  return Object.freeze({
    encrypt(value) {
      const iv = randomBytes(12);
      const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
      const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
    },
    decrypt(value) {
      const [version, ivValue, tagValue, encryptedValue, extra] = String(value ?? '').split('.');
      if (version !== VERSION || !ivValue || !tagValue || !encryptedValue || extra) {
        throw new Error('Stored MFA secret is invalid.');
      }
      const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivValue, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    },
  });
}
