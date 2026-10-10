import { validateObjectId } from './appointmentValidation.js';
import {
  boundedText,
  queryInteger,
  rejectUnknownFields,
  requireObject,
  validateQueryKeys,
} from './inputValidation.js';
import {
  NOTIFICATION_MESSAGE_MAX,
  NOTIFICATION_DISPLAY_NAME_MAX,
  NOTIFICATION_RECIPIENT_ROLES,
  NOTIFICATION_RESOURCE_TYPES,
  NOTIFICATION_TITLE_MAX,
  NOTIFICATION_TYPES,
} from '../models/index.js';
import { httpError } from '../utils/httpError.js';

const createFields = new Set([
  'recipient_user_profile_id', 'recipient_role', 'type', 'title', 'message',
  'related_resource_type', 'related_resource_id', 'patient_display_name',
  'doctor_display_name', 'appointment_at',
]);
const listFields = new Set(['unread_only', 'page', 'limit']);

function enumValue(value, field, allowed) {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw httpError(400, 'VALIDATION_ERROR', `${field} is not supported.`);
  }
  return value;
}

function plainText(value, field, max) {
  const result = boundedText(value, field, max);
  if (/[<>]/.test(result)) {
    throw httpError(400, 'VALIDATION_ERROR', `${field} must be plain text without HTML.`);
  }
  return result;
}

function optionalDateTime(value, field) {
  if (value == null || value === '') return null;
  if (!(value instanceof Date) && typeof value !== 'string') {
    throw httpError(400, 'VALIDATION_ERROR', `${field} must be a valid timestamp.`);
  }
  const result = new Date(value);
  if (!Number.isFinite(result.getTime())) {
    throw httpError(400, 'VALIDATION_ERROR', `${field} must be a valid timestamp.`);
  }
  return result;
}

export function validateNotificationCreate(value) {
  const body = requireObject(value, 'Notification input');
  rejectUnknownFields(body, createFields);
  const relatedType = body.related_resource_type == null
    ? null
    : enumValue(body.related_resource_type, 'related_resource_type', NOTIFICATION_RESOURCE_TYPES);
  const relatedId = body.related_resource_id == null
    ? null
    : validateObjectId(body.related_resource_id, 'related_resource_id');
  if (Boolean(relatedType) !== Boolean(relatedId)) {
    throw httpError(400, 'VALIDATION_ERROR', 'related_resource_type and related_resource_id must be supplied together.');
  }
  return {
    recipient_user_profile_id: validateObjectId(body.recipient_user_profile_id, 'recipient_user_profile_id'),
    recipient_role: enumValue(body.recipient_role, 'recipient_role', NOTIFICATION_RECIPIENT_ROLES),
    type: enumValue(body.type, 'type', NOTIFICATION_TYPES),
    title: plainText(body.title, 'title', NOTIFICATION_TITLE_MAX),
    message: plainText(body.message, 'message', NOTIFICATION_MESSAGE_MAX),
    related_resource_type: relatedType,
    related_resource_id: relatedId,
    patient_display_name: body.patient_display_name == null ? null : plainText(body.patient_display_name, 'patient_display_name', NOTIFICATION_DISPLAY_NAME_MAX),
    doctor_display_name: body.doctor_display_name == null ? null : plainText(body.doctor_display_name, 'doctor_display_name', NOTIFICATION_DISPLAY_NAME_MAX),
    appointment_at: optionalDateTime(body.appointment_at, 'appointment_at'),
  };
}

export function validateNotificationListQuery(query = {}) {
  const value = validateQueryKeys(query, listFields);
  let unreadOnly = false;
  if (value.unread_only != null && value.unread_only !== '') {
    if (!['true', 'false'].includes(value.unread_only)) {
      throw httpError(400, 'INVALID_QUERY', 'unread_only must be true or false.');
    }
    unreadOnly = value.unread_only === 'true';
  }
  return {
    unread_only: unreadOnly,
    page: queryInteger(value.page, 'page', { defaultValue: 1, max: 1_000_000 }),
    limit: queryInteger(value.limit, 'limit', { defaultValue: 20, max: 50 }),
  };
}

export function validateNotificationId(value) {
  return validateObjectId(value, 'notificationId');
}
