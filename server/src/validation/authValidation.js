import { httpError } from '../utils/httpError.js';
import { boundedText, INPUT_LIMITS, rejectUnknownFields, requireObject } from './inputValidation.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const registrationFields = new Set(['email', 'password', 'display_name', 'full_name', 'contact_number', 'dob', 'sex', 'address', 'emergency_contact_name', 'emergency_contact_number', 'emergency_contact_relationship', 'allergies', 'is_pwd']);
const loginFields = new Set(['email', 'password']);
const mfaCodeFields = new Set(['code']);

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw httpError(400, 'INVALID_INPUT', `${field} is required.`);
  }
  return value.trim();
}

function optionalText(value, field) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') {
    throw httpError(400, 'INVALID_INPUT', `${field} must be text.`);
  }
  const result = value.trim() || null;
  const max = field === 'address' ? INPUT_LIMITS.address : field === 'emergency_contact_number' ? INPUT_LIMITS.contact : INPUT_LIMITS.name;
  if (result && result.length > max) throw httpError(400, 'INVALID_INPUT', `${field} must not exceed ${max} characters.`);
  return result;
}

function validEmail(value) {
  const email = requiredText(value, 'email').toLowerCase();
  if (email.length > INPUT_LIMITS.email || !emailPattern.test(email)) {
    throw httpError(400, 'INVALID_INPUT', 'email must be valid.');
  }
  return email;
}

function validPassword(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > INPUT_LIMITS.password) {
    throw httpError(400, 'INVALID_INPUT', `password must be from 8 through ${INPUT_LIMITS.password} characters.`);
  }
  return value;
}

function presentPassword(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > INPUT_LIMITS.password) {
    throw httpError(400, 'INVALID_INPUT', `password must be text from 1 through ${INPUT_LIMITS.password} characters.`);
  }
  return value;
}

export function validateRegistration(body = {}) {
  requireObject(body);
  if (Object.hasOwn(body, 'role')) {
    throw httpError(400, 'PUBLIC_ROLE_NOT_ALLOWED', 'Public registration is for patients only.');
  }
  rejectUnknownFields(body, registrationFields, 'RESTRICTED_FIELD');

  const displayName = boundedText(body.display_name ?? body.full_name, 'display_name', INPUT_LIMITS.name, { code: 'INVALID_INPUT' });
  if (typeof body.dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.dob)) {
    throw httpError(400, 'INVALID_INPUT', 'dob must use YYYY-MM-DD.');
  }
  const dob = new Date(`${body.dob}T00:00:00.000Z`);
  if (Number.isNaN(dob.getTime()) || dob.toISOString().slice(0, 10) !== body.dob || dob > new Date()) {
    throw httpError(400, 'INVALID_INPUT', 'dob must be a valid date that is not in the future.');
  }
  if (body.allergies != null && !Array.isArray(body.allergies)) {
    throw httpError(400, 'INVALID_INPUT', 'allergies must be an array when provided.');
  }
  if ((body.allergies?.length ?? 0) > INPUT_LIMITS.allergies) {
    throw httpError(400, 'INVALID_INPUT', `allergies must contain at most ${INPUT_LIMITS.allergies} items.`);
  }
  if (body.is_pwd != null && typeof body.is_pwd !== 'boolean') {
    throw httpError(400, 'INVALID_INPUT', 'is_pwd must be boolean when provided.');
  }

  return {
    email: validEmail(body.email),
    password: validPassword(body.password),
    display_name: displayName,
    full_name: boundedText(body.full_name ?? displayName, 'full_name', INPUT_LIMITS.name, { code: 'INVALID_INPUT' }),
    contact_number: boundedText(body.contact_number, 'contact_number', INPUT_LIMITS.contact, { code: 'INVALID_INPUT' }),
    dob,
    sex: boundedText(body.sex, 'sex', 40, { code: 'INVALID_INPUT' }),
    address: body.address == null || body.address === '' ? null : boundedText(body.address, 'address', INPUT_LIMITS.address, { optional: true, code: 'INVALID_INPUT' }),
    emergency_contact_name: optionalText(
      body.emergency_contact_name,
      'emergency_contact_name',
    ),
    emergency_contact_number: optionalText(
      body.emergency_contact_number,
      'emergency_contact_number',
    ),
    emergency_contact_relationship: optionalText(
      body.emergency_contact_relationship,
      'emergency_contact_relationship',
    ),
    allergies: (body.allergies ?? []).map((allergy) => boundedText(allergy, 'allergy', INPUT_LIMITS.shortText, { code: 'INVALID_INPUT' })),
    is_pwd: body.is_pwd ?? false,
  };
}

export function validateLogin(body = {}) {
  requireObject(body);
  rejectUnknownFields(body, loginFields, 'RESTRICTED_FIELD');
  return {
    email: validEmail(body.email),
    password: presentPassword(body.password),
  };
}

export function validateMfaCode(body = {}) {
  requireObject(body);
  rejectUnknownFields(body, mfaCodeFields, 'RESTRICTED_FIELD');
  if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) {
    throw httpError(400, 'INVALID_INPUT', 'code must contain exactly 6 digits.');
  }
  return { code: body.code };
}
