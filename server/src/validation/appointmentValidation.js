import mongoose from 'mongoose';
import { APPOINTMENT_VISIT_TYPES } from '../models/index.js';
import { httpError } from '../utils/httpError.js';
import { INPUT_LIMITS } from './inputValidation.js';
import {
  addDays,
  appointmentLocalParts,
  clinicDate,
  SLOT_TIME_PATTERN,
} from '../utils/schedulingTime.js';

const allowedCreateFields = new Set(['doctor_id', 'appointment_at', 'visit_type', 'reason']);

export function validateObjectId(value, field = 'id') {
  if (!mongoose.isObjectIdOrHexString(value)) {
    throw httpError(400, 'INVALID_OBJECT_ID', `${field} must be a valid ObjectId.`);
  }
  return value;
}

export function validateAppointmentCreate(body, now = new Date(), timeZone = 'Asia/Manila') {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, 'INVALID_INPUT', 'Request body must be an object.');
  }
  const unsupported = Object.keys(body).find((field) => !allowedCreateFields.has(field));
  if (unsupported) {
    throw httpError(400, 'RESTRICTED_FIELD', `${unsupported} cannot be set by a Patient.`);
  }

  const doctorId = validateObjectId(body.doctor_id, 'doctor_id');
  if (!APPOINTMENT_VISIT_TYPES.includes(body.visit_type)) {
    throw httpError(400, 'INVALID_VISIT_TYPE', 'visit_type is not an approved value.');
  }
  if (typeof body.reason !== 'string' || !body.reason.trim()) {
    throw httpError(400, 'INVALID_INPUT', 'reason is required.');
  }
  if (body.reason.trim().length > INPUT_LIMITS.reason) {
    throw httpError(400, 'INVALID_INPUT', `reason must not exceed ${INPUT_LIMITS.reason} characters.`);
  }

  if (typeof body.appointment_at !== 'string' || body.appointment_at.length > 64) {
    throw httpError(400, 'INVALID_APPOINTMENT_TIME', 'appointment_at must be a valid date/time string.');
  }
  const appointmentAt = new Date(body.appointment_at);
  if (Number.isNaN(appointmentAt.getTime())) {
    throw httpError(400, 'INVALID_APPOINTMENT_TIME', 'appointment_at must be a valid date/time.');
  }
  if (appointmentAt <= now) {
    throw httpError(400, 'APPOINTMENT_IN_PAST', 'appointment_at must be in the future.');
  }
  const local = appointmentLocalParts(appointmentAt, timeZone);
  if (local.date > addDays(clinicDate(now, timeZone), 14)) {
    throw httpError(400, 'OUTSIDE_BOOKING_WINDOW', 'appointment_at must be within 14 days.');
  }
  if (!SLOT_TIME_PATTERN.test(local.time) || appointmentAt.getUTCSeconds() !== 0 || appointmentAt.getUTCMilliseconds() !== 0) {
    throw httpError(400, 'INVALID_APPOINTMENT_TIME', 'appointment_at must start on a 30-minute boundary.');
  }

  return {
    doctor_id: doctorId,
    appointment_at: appointmentAt,
    visit_type: body.visit_type,
    reason: body.reason.trim(),
  };
}
