import { httpError } from '../utils/httpError.js';
import { INPUT_LIMITS } from './inputValidation.js';

const editableFields = new Set([
  'full_name',
  'contact_number',
  'dob',
  'sex',
  'address',
  'emergency_contact_name',
  'emergency_contact_number',
  'emergency_contact_relationship',
  'is_pwd',
]);

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw httpError(400, 'INVALID_INPUT', `${field} must be non-empty text.`);
  }
  const result = value.trim();
  const max = field === 'full_name' ? INPUT_LIMITS.name : field === 'contact_number' ? INPUT_LIMITS.contact : 40;
  if (result.length > max) throw httpError(400, 'INVALID_INPUT', `${field} must not exceed ${max} characters.`);
  return result;
}

function optionalText(value, field) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') {
    throw httpError(400, 'INVALID_INPUT', `${field} must be text or null.`);
  }
  const result = value.trim() || null;
  const max = field === 'address' ? INPUT_LIMITS.address : field === 'emergency_contact_number' ? INPUT_LIMITS.contact : INPUT_LIMITS.name;
  if (result && result.length > max) throw httpError(400, 'INVALID_INPUT', `${field} must not exceed ${max} characters.`);
  return result;
}

export function validatePatientProfilePatch(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, 'INVALID_INPUT', 'Request body must be an object.');
  }
  const keys = Object.keys(body);
  if (!keys.length) throw httpError(400, 'INVALID_INPUT', 'Provide at least one profile field.');
  const unsupported = keys.find((key) => !editableFields.has(key));
  if (unsupported) {
    throw httpError(400, 'RESTRICTED_FIELD', `${unsupported} cannot be updated here.`);
  }

  const updates = {};
  for (const field of keys) {
    if (field === 'full_name' || field === 'contact_number' || field === 'sex') {
      updates[field] = requiredText(body[field], field);
    } else if (field === 'dob') {
      if (typeof body.dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.dob)) {
        throw httpError(400, 'INVALID_INPUT', 'dob must use YYYY-MM-DD.');
      }
      const dob = new Date(`${body.dob}T00:00:00.000Z`);
      if (Number.isNaN(dob.getTime()) || dob.toISOString().slice(0, 10) !== body.dob || dob > new Date()) {
        throw httpError(400, 'INVALID_INPUT', 'dob must be a valid date that is not in the future.');
      }
      updates.dob = dob;
    } else if (field === 'is_pwd') {
      if (typeof body.is_pwd !== 'boolean') {
        throw httpError(400, 'INVALID_INPUT', 'is_pwd must be boolean.');
      }
      updates.is_pwd = body.is_pwd;
    } else {
      updates[field] = optionalText(body[field], field);
    }
  }
  return updates;
}
