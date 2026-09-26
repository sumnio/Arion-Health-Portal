import { httpError } from '../utils/httpError.js';
import {
  isValidDateOnly,
  SLOT_TIME_PATTERN,
} from '../utils/schedulingTime.js';
import { validateObjectId } from './appointmentValidation.js';
import { INPUT_LIMITS, validateQueryKeys } from './inputValidation.js';

function objectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, 'INVALID_INPUT', 'Request body must be an object.');
  }
  return body;
}

function rejectUnsupported(body, allowed) {
  const unsupported = Object.keys(body).find((field) => !allowed.includes(field));
  if (unsupported) throw httpError(400, 'RESTRICTED_FIELD', `${unsupported} cannot be set here.`);
}

function time(value, field) {
  if (!SLOT_TIME_PATTERN.test(value ?? '')) {
    throw httpError(400, 'INVALID_TIME_RANGE', `${field} must use a 30-minute HH:MM boundary.`);
  }
  return value;
}

function orderedRange(startTime, endTime) {
  if (startTime >= endTime) {
    throw httpError(400, 'INVALID_TIME_RANGE', 'end_time must be later than start_time.');
  }
}

export function validateRecurringCreate(body) {
  objectBody(body);
  rejectUnsupported(body, ['day_of_week', 'start_time', 'end_time', 'is_active']);
  const day = Number(body.day_of_week);
  if (!Number.isInteger(day) || day < 0 || day > 6) {
    throw httpError(400, 'INVALID_DAY_OF_WEEK', 'day_of_week must be an integer from 0 through 6.');
  }
  const startTime = time(body.start_time, 'start_time');
  const endTime = time(body.end_time, 'end_time');
  orderedRange(startTime, endTime);
  if (body.is_active != null && typeof body.is_active !== 'boolean') {
    throw httpError(400, 'INVALID_INPUT', 'is_active must be boolean.');
  }
  return { day_of_week: day, start_time: startTime, end_time: endTime, is_active: body.is_active ?? true };
}

export function validateRecurringPatch(body, existing) {
  objectBody(body);
  rejectUnsupported(body, ['day_of_week', 'start_time', 'end_time', 'is_active']);
  if (!Object.keys(body).length) throw httpError(400, 'INVALID_INPUT', 'Provide at least one availability field.');
  return validateRecurringCreate({
    day_of_week: body.day_of_week ?? existing.day_of_week,
    start_time: body.start_time ?? existing.start_time,
    end_time: body.end_time ?? existing.end_time,
    is_active: body.is_active ?? existing.is_active,
  });
}

export function validatePublishedCreate(body) {
  objectBody(body);
  rejectUnsupported(body, ['availability_date', 'start_time', 'end_time']);
  if (!isValidDateOnly(body.availability_date)) {
    throw httpError(400, 'INVALID_DATE', 'availability_date must use YYYY-MM-DD.');
  }
  const startTime = time(body.start_time, 'start_time');
  const endTime = time(body.end_time, 'end_time');
  orderedRange(startTime, endTime);
  return { availability_date: body.availability_date, start_time: startTime, end_time: endTime };
}

export function validateBlockedCreate(body) {
  objectBody(body);
  rejectUnsupported(body, ['start_at', 'end_at', 'reason']);
  if (typeof body.start_at !== 'string' || typeof body.end_at !== 'string' || body.start_at.length > 64 || body.end_at.length > 64) {
    throw httpError(400, 'INVALID_DATE_TIME', 'start_at and end_at must be valid date/time strings.');
  }
  const startAt = new Date(body.start_at);
  const endAt = new Date(body.end_at);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw httpError(400, 'INVALID_DATE_TIME', 'start_at and end_at must be valid date/time values.');
  }
  if (startAt >= endAt) {
    throw httpError(400, 'INVALID_TIME_RANGE', 'end_at must be later than start_at.');
  }
  if (typeof body.reason !== 'string' || !body.reason.trim()) {
    throw httpError(400, 'INVALID_INPUT', 'reason is required.');
  }
  if (body.reason.trim().length > INPUT_LIMITS.reason) {
    throw httpError(400, 'INVALID_INPUT', `reason must not exceed ${INPUT_LIMITS.reason} characters.`);
  }
  return { start_at: startAt, end_at: endAt, reason: body.reason.trim() };
}

export function validateSchedulingId(value, field = 'id') {
  return validateObjectId(value, field);
}

export function validateSlotQuery(date, doctorId) {
  validateObjectId(doctorId, 'doctorId');
  if (!isValidDateOnly(date)) {
    throw httpError(400, 'INVALID_DATE', 'date query parameter must use YYYY-MM-DD.');
  }
  return { date, doctor_id: doctorId };
}

export function validateSlotQueryParameters(query) {
  validateQueryKeys(query, new Set(['date']));
  if (Array.isArray(query.date) || (query.date != null && typeof query.date !== 'string')) {
    throw httpError(400, 'INVALID_QUERY', 'date must be a single YYYY-MM-DD value.');
  }
  return query.date;
}
