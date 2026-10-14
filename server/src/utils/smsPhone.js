import { PHILIPPINE_MOBILE_PATTERN } from '../validation/phoneValidation.js';

export function toPhilippineE164(value) {
  if (typeof value !== 'string' || !PHILIPPINE_MOBILE_PATTERN.test(value)) {
    const error = new Error('SMS recipient is invalid.');
    error.category = 'invalid_recipient';
    throw error;
  }
  return `+63${value.slice(1)}`;
}
