import { clinicDate, isValidDateOnly, storedDateOnly } from '../utils/schedulingTime.js';

export const CERTIFICATE_VALIDITY_STATUSES = Object.freeze({
  ACTIVE: 'active',
  EXPIRED: 'expired',
  LEGACY: 'legacy',
});

export function certificateValidityStatus(validUntil, {
  now = new Date(),
  timeZone = 'Asia/Manila',
} = {}) {
  if (validUntil == null || validUntil === '') return CERTIFICATE_VALIDITY_STATUSES.LEGACY;

  const validUntilDate = typeof validUntil === 'string' && isValidDateOnly(validUntil)
    ? validUntil
    : storedDateOnly(validUntil);
  const currentClinicDate = clinicDate(now, timeZone);

  return currentClinicDate <= validUntilDate
    ? CERTIFICATE_VALIDITY_STATUSES.ACTIVE
    : CERTIFICATE_VALIDITY_STATUSES.EXPIRED;
}
