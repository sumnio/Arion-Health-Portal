import { httpError } from '../utils/httpError.js';

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
  return value.trim();
}

function optionalText(value, field) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') {
    throw httpError(400, 'INVALID_INPUT', `${field} must be text or null.`);
  }
  return value.trim() || null;
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
      const dob = new Date(body.dob);
      if (!body.dob || Number.isNaN(dob.getTime()) || dob > new Date()) {
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
