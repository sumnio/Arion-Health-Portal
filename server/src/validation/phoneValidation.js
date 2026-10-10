import { httpError } from '../utils/httpError.js';

export const PHILIPPINE_MOBILE_PATTERN = /^09\d{9}$/;

export function validatePhilippineMobile(value, field, { optional = false, code = 'VALIDATION_ERROR' } = {}) {
  if (value == null || (typeof value === 'string' && !value.trim())) {
    if (optional) return null;
    throw httpError(400, code, `${field} is required.`);
  }
  if (typeof value !== 'string') throw httpError(400, code, 'Invalid phone number.');
  const canonical = value.replace(/ /g, '');
  if (!PHILIPPINE_MOBILE_PATTERN.test(canonical)) throw httpError(400, code, 'Invalid phone number.');
  return canonical;
}
