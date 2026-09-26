import { httpError } from '../utils/httpError.js';

export const INPUT_LIMITS = Object.freeze({
  name: 120,
  email: 254,
  password: 128,
  contact: 32,
  shortText: 200,
  address: 300,
  search: 100,
  reason: 1000,
  narrative: 5000,
  path: 500,
  prescriptions: 20,
  allergies: 20,
});

export function requireObject(value, label = 'Request body') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw httpError(400, 'INVALID_INPUT', `${label} must be an object.`);
  }
  return value;
}

export function rejectUnknownFields(value, allowed, code = 'UNSUPPORTED_FIELD') {
  const field = Object.keys(value).find(key => !allowed.has(key));
  if (field) throw httpError(400, code, `${field} is not accepted.`);
}

export function boundedText(value, field, max, { optional = false, code = 'VALIDATION_ERROR' } = {}) {
  if (value == null || value === '') {
    if (optional) return null;
    throw httpError(400, code, `${field} is required.`);
  }
  if (typeof value !== 'string') throw httpError(400, code, `${field} must be text.`);
  const result = value.trim();
  if (!result) {
    if (optional) return null;
    throw httpError(400, code, `${field} is required.`);
  }
  if (result.length > max) throw httpError(400, code, `${field} must not exceed ${max} characters.`);
  return result;
}

export function validateEmptyBody(body) {
  if (body == null) return;
  requireObject(body);
  if (Object.keys(body).length) {
    throw httpError(400, 'UNSUPPORTED_FIELD', 'This action does not accept request fields.');
  }
}

export function validateQueryKeys(query, allowed) {
  const value = query ?? {};
  requireObject(value, 'Query parameters');
  const field = Object.keys(value).find(key => !allowed.has(key));
  if (field) throw httpError(400, 'INVALID_QUERY', `${field} is not a supported query parameter.`);
  return value;
}

export function queryText(value, field, { optional = true, max = INPUT_LIMITS.search } = {}) {
  if (value == null || value === '') return optional ? '' : boundedText(value, field, max);
  return boundedText(value, field, max, { code: 'INVALID_QUERY' });
}

export function queryInteger(value, field, { defaultValue, min = 1, max = 50 } = {}) {
  if (value == null || value === '') return defaultValue;
  if (Array.isArray(value) || typeof value === 'object' || !/^\d+$/.test(String(value))) {
    throw httpError(400, 'INVALID_QUERY', `${field} must be an integer.`);
  }
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) {
    throw httpError(400, 'INVALID_QUERY', `${field} must be from ${min} through ${max}.`);
  }
  return result;
}
