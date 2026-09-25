import { httpError } from '../utils/httpError.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  return value.trim() || null;
}

function validEmail(value) {
  const email = requiredText(value, 'email').toLowerCase();
  if (!emailPattern.test(email)) {
    throw httpError(400, 'INVALID_INPUT', 'email must be valid.');
  }
  return email;
}

function validPassword(value) {
  if (typeof value !== 'string' || value.length < 8) {
    throw httpError(400, 'INVALID_INPUT', 'password must be at least 8 characters.');
  }
  return value;
}

function presentPassword(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw httpError(400, 'INVALID_INPUT', 'password is required.');
  }
  return value;
}

export function validateRegistration(body = {}) {
  if (body.role && body.role !== 'patient') {
    throw httpError(400, 'PUBLIC_ROLE_NOT_ALLOWED', 'Public registration is for patients only.');
  }

  const displayName = requiredText(body.display_name ?? body.full_name, 'display_name');
  const dob = new Date(body.dob);
  if (!body.dob || Number.isNaN(dob.getTime()) || dob > new Date()) {
    throw httpError(400, 'INVALID_INPUT', 'dob must be a valid date that is not in the future.');
  }
  if (body.allergies != null && !Array.isArray(body.allergies)) {
    throw httpError(400, 'INVALID_INPUT', 'allergies must be an array when provided.');
  }
  if (body.is_pwd != null && typeof body.is_pwd !== 'boolean') {
    throw httpError(400, 'INVALID_INPUT', 'is_pwd must be boolean when provided.');
  }

  return {
    email: validEmail(body.email),
    password: validPassword(body.password),
    display_name: displayName,
    full_name: requiredText(body.full_name ?? displayName, 'full_name'),
    contact_number: requiredText(body.contact_number, 'contact_number'),
    dob,
    sex: requiredText(body.sex, 'sex'),
    address: optionalText(body.address, 'address'),
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
    allergies: (body.allergies ?? []).map((allergy) => requiredText(allergy, 'allergy')),
    is_pwd: body.is_pwd ?? false,
  };
}

export function validateLogin(body = {}) {
  return {
    email: validEmail(body.email),
    password: presentPassword(body.password),
  };
}
