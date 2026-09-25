import { APPOINTMENT_PRIORITIES, APPOINTMENT_VISIT_TYPES } from '../models/index.js';
import { httpError } from '../utils/httpError.js';
import { appointmentLocalParts, clinicDate, SLOT_TIME_PATTERN } from '../utils/schedulingTime.js';
import { validateObjectId } from './appointmentValidation.js';

const patientFields = new Set(['full_name', 'contact_number', 'dob', 'sex', 'address', 'emergency_contact_name', 'emergency_contact_number', 'emergency_contact_relationship', 'is_pwd']);
const appointmentFields = new Set(['doctor_id', 'appointment_at', 'visit_type', 'reason', 'priority']);

function bodyObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'INVALID_INPUT', 'Request body must be an object.');
}
function rejectUnknown(body, allowed) {
  const field = Object.keys(body).find((key) => !allowed.has(key));
  if (field) throw httpError(400, 'UNSUPPORTED_FIELD', `${field} is not accepted.`);
}
function text(value, field, optional = false) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result && !optional) throw httpError(400, 'VALIDATION_ERROR', `${field} is required.`);
  return result || null;
}
function validDateOnly(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw httpError(400, 'VALIDATION_ERROR', `${field} must use YYYY-MM-DD.`);
  const result = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(result.getTime()) || result.toISOString().slice(0, 10) !== value) throw httpError(400, 'VALIDATION_ERROR', `${field} must be a valid date.`);
  return result;
}

export function validateWalkInPatient(body = {}, now = new Date()) {
  bodyObject(body); rejectUnknown(body, patientFields);
  const dob = validDateOnly(body.dob, 'dob');
  if (dob > now) throw httpError(400, 'VALIDATION_ERROR', 'dob cannot be in the future.');
  const contact = text(body.contact_number, 'contact_number');
  const digits = contact.replace(/\D/g, '');
  if (!/^[+\d\s().-]+$/.test(contact) || digits.length < 7 || digits.length > 15) throw httpError(400, 'VALIDATION_ERROR', 'contact_number must contain 7 to 15 digits.');
  const sex = text(body.sex, 'sex');
  const emergencyNumber = text(body.emergency_contact_number, 'emergency_contact_number', true);
  if (emergencyNumber) {
    const emergencyDigits = emergencyNumber.replace(/\D/g, '');
    if (!/^[+\d\s().-]+$/.test(emergencyNumber) || emergencyDigits.length < 7 || emergencyDigits.length > 15) throw httpError(400, 'VALIDATION_ERROR', 'emergency_contact_number must contain 7 to 15 digits.');
  }
  if (body.is_pwd != null && typeof body.is_pwd !== 'boolean') throw httpError(400, 'VALIDATION_ERROR', 'is_pwd must be boolean when provided.');
  return {
    user_profile_id: null, full_name: text(body.full_name, 'full_name'), contact_number: contact,
    dob, sex, address: text(body.address, 'address', true),
    emergency_contact_name: text(body.emergency_contact_name, 'emergency_contact_name', true),
    emergency_contact_number: emergencyNumber,
    emergency_contact_relationship: text(body.emergency_contact_relationship, 'emergency_contact_relationship', true),
    is_pwd: body.is_pwd === true,
  };
}

export function validateWalkInAppointment(body = {}, now, timeZone) {
  bodyObject(body); rejectUnknown(body, appointmentFields);
  const doctorId = validateObjectId(body.doctor_id, 'doctor_id');
  if (!APPOINTMENT_VISIT_TYPES.includes(body.visit_type)) throw httpError(400, 'INVALID_VISIT_TYPE', 'visit_type is not an approved value.');
  if (!APPOINTMENT_PRIORITIES.includes(body.priority ?? 'normal')) throw httpError(400, 'INVALID_PRIORITY', 'priority must be normal or urgent.');
  const appointmentAt = new Date(body.appointment_at);
  if (!body.appointment_at || Number.isNaN(appointmentAt.getTime())) throw httpError(400, 'INVALID_APPOINTMENT_TIME', 'appointment_at must be a valid date/time.');
  const local = appointmentLocalParts(appointmentAt, timeZone);
  if (local.date !== clinicDate(now, timeZone)) throw httpError(400, 'WALK_IN_MUST_BE_TODAY', 'Walk-in appointments must be on the current clinic day.');
  if (appointmentAt < now || !SLOT_TIME_PATTERN.test(local.time) || appointmentAt.getUTCSeconds() !== 0 || appointmentAt.getUTCMilliseconds() !== 0) throw httpError(400, 'INVALID_APPOINTMENT_TIME', 'Walk-in appointment time must be a current or future 30-minute slot.');
  return { doctor_id: doctorId, appointment_at: appointmentAt, visit_type: body.visit_type, reason: text(body.reason, 'reason'), priority: body.priority ?? 'normal' };
}

export function validatePriority(body = {}) {
  bodyObject(body); rejectUnknown(body, new Set(['priority']));
  if (!APPOINTMENT_PRIORITIES.includes(body.priority)) throw httpError(400, 'INVALID_PRIORITY', 'priority must be normal or urgent.');
  return body.priority;
}
