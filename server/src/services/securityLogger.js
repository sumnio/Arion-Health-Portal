const SEVERITIES = new Set(['info', 'warning', 'critical']);
const SAFE_EVENT_FIELDS = new Set([
  'timestamp',
  'event',
  'severity',
  'outcome',
  'actor_user_profile_id',
  'actor_role',
  'target_type',
  'target_id',
  'route',
  'method',
  'ip',
  'metadata',
]);
const REDACTED_KEY = /password|password_hash|token|jwt|cookie|authorization|mongodb_uri|auth_secret|secret|private_key|signature_path|email|contact|address|full_name|date_of_birth|\bdob\b|request_body|payload|headers|medical|diagnosis|notes|allergies|prescription|certificate|totp|otp|recovery|challenge|otpauth|manual_key/i;

function safeString(value, max = 500) {
  if (value == null) return undefined;
  return String(value).slice(0, max);
}

function redact(value, depth = 0) {
  if (depth > 4) return '[REDACTED]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return safeString(value);
  if (Array.isArray(value)) return value.slice(0, 20).map(item => redact(item, depth + 1));
  if (typeof value !== 'object') return safeString(value);

  const result = {};
  for (const [key, item] of Object.entries(value).slice(0, 30)) {
    result[key] = REDACTED_KEY.test(key) ? '[REDACTED]' : redact(item, depth + 1);
  }
  return result;
}

export function normalizeSecurityEvent(input = {}) {
  const event = {};
  for (const [key, value] of Object.entries(input)) {
    if (!SAFE_EVENT_FIELDS.has(key) || value == null) continue;
    event[key] = key === 'metadata' ? redact(value) : safeString(value, 500);
  }
  event.timestamp = new Date().toISOString();
  event.event = safeString(input.event || 'SECURITY_EVENT', 100);
  event.severity = SEVERITIES.has(input.severity) ? input.severity : 'warning';
  event.outcome = safeString(input.outcome || 'observed', 50);
  return event;
}

function consoleWriter(event) {
  const line = JSON.stringify(event);
  if (event.severity === 'critical') console.error(line);
  else if (event.severity === 'warning') console.warn(line);
  else console.info(line);
}

export function createSecurityLogger({ write = consoleWriter } = {}) {
  return Object.freeze({
    logSecurityEvent(input) {
      try {
        write(normalizeSecurityEvent(input));
      } catch {
        // Security telemetry must never break the request it observes.
      }
    },
  });
}

export const securityLogger = createSecurityLogger();

export function attachSecurityLogger(logger = securityLogger) {
  return function securityLoggerContext(request, _response, next) {
    request.securityLogger = logger;
    next();
  };
}

export function requestSecurityEvent(request, input) {
  try {
    request?.securityLogger?.logSecurityEvent({
      actor_user_profile_id: request.authUser?.user_profile_id,
      actor_role: request.authUser?.role,
      route: request.originalUrl?.split('?')[0],
      method: request.method,
      ip: request.ip,
      ...input,
    });
  } catch {
    // Request processing must continue even with a faulty injected logger.
  }
}
