import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  AUDIT_RESULTS,
} from '../models/AuditLog.js';
import { httpError } from '../utils/httpError.js';

const CATEGORY_SET = new Set(AUDIT_CATEGORIES);
const ACTION_SET = new Set(AUDIT_ACTIONS);
const RESULT_SET = new Set(AUDIT_RESULTS);
const ROLE_SET = new Set(['patient', 'doctor', 'staff', 'admin', 'system', 'unknown']);
const UNSAFE_KEY = /password|hash|otp|totp|token|jwt|cookie|secret|api.?key|authorization|diagnosis|doctor.?notes|clinical|medicine|prescription.?detail|certificate.?content|document|filename|file.?id|binary|buffer|payload|request.?body|reason|contact|phone|email|address|allerg/i;
const SAFE_METADATA_KEYS = new Set([
  'old_date', 'old_time', 'new_date', 'new_time', 'date', 'day_of_week',
  'start_time', 'end_time', 'old_status', 'new_status', 'operation',
  'start_at', 'end_at',
  'has_attachment', 'invitation_mode', 'attempted_identifier',
]);

function safeText(value, max) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function safeMetadata(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const output = {};
  for (const [key, value] of Object.entries(input).slice(0, 20)) {
    if (!SAFE_METADATA_KEYS.has(key) || UNSAFE_KEY.test(key) || value == null) continue;
    if (typeof value === 'boolean' || typeof value === 'number') output[key] = value;
    else if (typeof value === 'string') output[key] = value.slice(0, 160);
  }
  return output;
}

function parseDate(value, name, endOfDay = false) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw httpError(400, 'INVALID_AUDIT_FILTER', `${name} must use YYYY-MM-DD.`);
  }
  const date = new Date(`${text}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  if (Number.isNaN(date.getTime())) throw httpError(400, 'INVALID_AUDIT_FILTER', `${name} is invalid.`);
  return date;
}

function boundedSearch(value, name) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (text.length < 2 || text.length > 80) {
    throw httpError(400, 'INVALID_AUDIT_FILTER', `${name} must contain 2 to 80 characters.`);
  }
  return text;
}

function present(item) {
  return {
    id: String(item._id),
    created_at: new Date(item.created_at).toISOString(),
    actor: item.actor_display_name_snapshot,
    actor_role: item.actor_role,
    category: item.category,
    action: item.action,
    target_type: item.target_type,
    target_id: item.target_id,
    target_display: item.target_display_snapshot,
    result: item.result,
    safe_metadata: safeMetadata(item.safe_metadata),
  };
}

export function createAuditLogService({ repository, logger = console, now = () => new Date() }) {
  async function recordAuditEvent(input = {}) {
    try {
      if (!CATEGORY_SET.has(input.category)) throw new Error('INVALID_AUDIT_CATEGORY');
      if (!ACTION_SET.has(input.action)) throw new Error('INVALID_AUDIT_ACTION');
      if (!RESULT_SET.has(input.result)) throw new Error('INVALID_AUDIT_RESULT');
      const actorRole = ROLE_SET.has(input.actor_role) ? input.actor_role : 'unknown';
      return await repository.create({
        actor_user_id: input.actor_user_id ?? null,
        actor_role: actorRole,
        actor_display_name_snapshot: safeText(input.actor_display_name_snapshot, 120),
        action: input.action,
        category: input.category,
        target_type: safeText(input.target_type, 80) ?? 'Unknown',
        target_id: safeText(input.target_id, 120),
        target_display_snapshot: safeText(input.target_display_snapshot, 160),
        result: input.result,
        request_id: safeText(input.request_id, 120),
        safe_metadata: safeMetadata(input.safe_metadata),
        created_at: now(),
      });
    } catch (error) {
      try {
        logger.error?.('Audit event could not be stored.', {
          action: ACTION_SET.has(input.action) ? input.action : 'INVALID',
          category: CATEGORY_SET.has(input.category) ? input.category : 'INVALID',
          error: error?.message === 'AUDIT_LOG_APPEND_ONLY' ? error.message : 'AUDIT_WRITE_FAILED',
        });
      } catch {
        // Audit diagnostics must never break the completed business action.
      }
      return null;
    }
  }

  async function listAuditEvents(query = {}) {
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || 10));
    const filters = {
      role: query.role || null,
      category: query.category || null,
      action: query.action || null,
      result: query.result || null,
      dateFrom: parseDate(query.date_from, 'date_from'),
      dateTo: parseDate(query.date_to, 'date_to', true),
      searchActor: boundedSearch(query.search_actor, 'search_actor'),
      searchTarget: boundedSearch(query.search_target, 'search_target'),
    };
    if (filters.role && !ROLE_SET.has(filters.role)) throw httpError(400, 'INVALID_AUDIT_FILTER', 'role is invalid.');
    if (filters.category && !CATEGORY_SET.has(filters.category)) throw httpError(400, 'INVALID_AUDIT_FILTER', 'category is invalid.');
    if (filters.action && !ACTION_SET.has(filters.action)) throw httpError(400, 'INVALID_AUDIT_FILTER', 'action is invalid.');
    if (filters.result && !RESULT_SET.has(filters.result)) throw httpError(400, 'INVALID_AUDIT_FILTER', 'result is invalid.');
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) throw httpError(400, 'INVALID_AUDIT_FILTER', 'date_from must not be after date_to.');
    const result = await repository.list({ page, limit, filters });
    return {
      items: result.items.map(present),
      pagination: {
        page,
        page_size: limit,
        total: result.total,
        page_count: Math.max(1, Math.ceil(result.total / limit)),
      },
    };
  }

  return Object.freeze({ recordAuditEvent, listAuditEvents });
}

export function auditActorFromRequest(request) {
  return {
    actor_user_id: request?.authUser?.user_profile_id ?? null,
    actor_role: request?.authUser?.role ?? 'unknown',
    actor_display_name_snapshot: request?.authUser?.display_name ?? null,
    request_id: request?.id ?? request?.get?.('x-request-id') ?? null,
  };
}

export function recordRequestAudit(request, event) {
  try {
    return request?.auditLogService?.recordAuditEvent({
      ...auditActorFromRequest(request),
      ...event,
    });
  } catch {
    return Promise.resolve(null);
  }
}
