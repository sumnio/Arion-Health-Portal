import { randomBytes } from 'node:crypto';

export function generateCertificateNumber(date = new Date()) {
  const day = date.toISOString().slice(0, 10).replaceAll('-', '');
  return `AHC-${day}-${randomBytes(4).toString('hex').toUpperCase()}`;
}
