import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
dotenv.config({ path: envPath, quiet: true });

export const AUTH_SECRET_MIN_LENGTH = 32;
export const MFA_ENCRYPTION_KEY_BYTES = 32;
export const ACCOUNT_TOKEN_HMAC_SECRET_MIN_LENGTH = 32;
export const DEFAULT_DEVELOPMENT_ORIGIN = 'http://127.0.0.1:5173';
const allowedNodeEnvironments = new Set(['development', 'test', 'production']);
const allowedEmailProviders = new Set(['fake', 'resend']);
const placeholderSecrets = new Set([
  'secret',
  'changeme',
  'change-me',
  'replace-me',
  'your-secret',
  'your-auth-secret',
  'default-secret',
  'development-secret',
  'example-secret',
]);

function parsePort(value) {
  const port = Number(value ?? 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return port;
}

function parsePositiveInteger(value, fallback, name) {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return result;
}

function parseBoolean(value, fallback, name) {
  if (value == null || value === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false.`);
}

function parseNodeEnvironment(value) {
  const nodeEnv = value?.trim() || 'development';
  if (!allowedNodeEnvironments.has(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }
  return nodeEnv;
}

function parseMongoDatabaseName(value) {
  const name = value?.trim() || '';
  if (name && !/^[A-Za-z0-9_-]{1,64}$/.test(name)) {
    throw new Error('MONGODB_DB_NAME must contain only letters, numbers, underscores, or hyphens.');
  }
  return name;
}

function normalizeTrustedOrigin(value) {
  if (!value || value === '*') throw new Error('CORS_ORIGIN must contain explicit trusted origins.');
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('CORS_ORIGIN contains an invalid origin.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.origin !== value) {
    throw new Error('CORS_ORIGIN entries must use origin-only HTTP or HTTPS URLs.');
  }
  return parsed.origin;
}

export function parseCorsOrigins(value, nodeEnv = 'development') {
  const raw = value?.trim();
  if (!raw) {
    if (nodeEnv === 'production') throw new Error('CORS_ORIGIN is required in production.');
    return [DEFAULT_DEVELOPMENT_ORIGIN];
  }
  const entries = raw.split(',').map(item => item.trim());
  if (entries.some(item => !item)) throw new Error('CORS_ORIGIN must not contain empty entries.');
  return [...new Set(entries.map(normalizeTrustedOrigin))];
}

export function requireAuthSecret(secret, nodeEnv = 'development') {
  const value = secret?.trim();
  if (!value) throw new Error('AUTH_SECRET is required. Add it to server/.env before starting the API.');
  if (nodeEnv !== 'test') {
    const normalized = value.toLowerCase();
    if (
      value.length < AUTH_SECRET_MIN_LENGTH ||
      placeholderSecrets.has(normalized) ||
      normalized.includes('replace-with') ||
      /[<>]/.test(value)
    ) {
      throw new Error(`AUTH_SECRET must be a non-placeholder value of at least ${AUTH_SECRET_MIN_LENGTH} characters.`);
    }
  }
  return value;
}

export function requireMfaEncryptionKey(key, nodeEnv = 'development') {
  const value = key?.trim();
  if (!value) {
    if (nodeEnv === 'test') return Buffer.alloc(MFA_ENCRYPTION_KEY_BYTES, 7).toString('base64');
    throw new Error('MFA_ENCRYPTION_KEY is required. Add a base64-encoded 32-byte key to server/.env.');
  }
  let decoded;
  try {
    decoded = Buffer.from(value, 'base64');
  } catch {
    throw new Error('MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }
  if (decoded.length !== MFA_ENCRYPTION_KEY_BYTES || decoded.toString('base64') !== value) {
    throw new Error('MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }
  return value;
}

export function requireAccountTokenHmacSecret(secret, nodeEnv = 'development') {
  const value = secret?.trim();
  if (!value) {
    if (nodeEnv === 'test') return 'test-only-account-token-hmac-secret';
    throw new Error('ACCOUNT_TOKEN_HMAC_SECRET is required for account token operations.');
  }
  if (nodeEnv !== 'test') {
    const normalized = value.toLowerCase();
    if (
      value.length < ACCOUNT_TOKEN_HMAC_SECRET_MIN_LENGTH ||
      placeholderSecrets.has(normalized) ||
      normalized.includes('replace-with') ||
      /[<>]/.test(value)
    ) {
      throw new Error(`ACCOUNT_TOKEN_HMAC_SECRET must be a non-placeholder value of at least ${ACCOUNT_TOKEN_HMAC_SECRET_MIN_LENGTH} characters.`);
    }
  }
  return value;
}

function parseEmailProvider(value, nodeEnv) {
  const provider = value?.trim().toLowerCase() || 'fake';
  if (!allowedEmailProviders.has(provider)) {
    throw new Error('EMAIL_PROVIDER must be fake or resend.');
  }
  if (nodeEnv === 'production' && provider === 'fake' && value?.trim()) {
    throw new Error('EMAIL_PROVIDER=fake is not allowed in production.');
  }
  return provider;
}

function parseAppBaseUrl(value, nodeEnv) {
  const raw = value?.trim() || (nodeEnv === 'production' ? '' : DEFAULT_DEVELOPMENT_ORIGIN);
  if (!raw) return '';
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('APP_BASE_URL must be a valid HTTP or HTTPS origin.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.origin !== raw) {
    throw new Error('APP_BASE_URL must be an origin-only HTTP or HTTPS URL.');
  }
  return parsed.origin;
}

export function validateRuntimeConfig(config) {
  if (!config?.mongoUri) throw new Error('MONGODB_URI is required. Add it to server/.env before starting the API.');
  requireAuthSecret(config.authSecret, config.nodeEnv);
  requireMfaEncryptionKey(config.mfaEncryptionKey, config.nodeEnv);
  if (!Array.isArray(config.corsOrigins) || !config.corsOrigins.length) {
    throw new Error('CORS_ORIGIN must contain at least one trusted origin.');
  }
  if (config.nodeEnv === 'production') {
    requireAccountTokenHmacSecret(config.accountTokenHmacSecret, config.nodeEnv);
    if (!config.mongoDatabaseName) {
      throw new Error('MONGODB_DB_NAME is required in production to isolate application data.');
    }
    if (!config.clinicTimeZone) {
      throw new Error('CLINIC_TIME_ZONE is required in production.');
    }
    if (!config.clinicName) {
      throw new Error('CLINIC_NAME is required in production.');
    }
    if (!config.clinicLocation || config.clinicLocation === 'Clinic location not configured') {
      throw new Error('CLINIC_LOCATION must contain the real clinic location in production.');
    }
  }
  if (config.emailProvider === 'resend') {
    requireAccountTokenHmacSecret(config.accountTokenHmacSecret, config.nodeEnv);
    if (!config.resendApiKey) throw new Error('RESEND_API_KEY is required when EMAIL_PROVIDER=resend.');
    if (!config.emailFrom) throw new Error('EMAIL_FROM is required when EMAIL_PROVIDER=resend.');
    if (!config.appBaseUrl) throw new Error('APP_BASE_URL is required when EMAIL_PROVIDER=resend.');
    if (/\r|\n/.test(config.emailFrom) || config.emailFrom.length > 320) {
      throw new Error('EMAIL_FROM contains an invalid sender value.');
    }
    if (config.nodeEnv === 'production' && !config.appBaseUrl.startsWith('https://')) {
      throw new Error('APP_BASE_URL must use HTTPS in production email mode.');
    }
  }
  return config;
}

export function loadConfig(environment = process.env) {
  const nodeEnv = parseNodeEnvironment(environment.NODE_ENV);
  const corsOrigins = parseCorsOrigins(environment.CORS_ORIGIN, nodeEnv);
  return {
    port: parsePort(environment.PORT),
    nodeEnv,
    mongoUri: environment.MONGODB_URI?.trim() || '',
    mongoDatabaseName: parseMongoDatabaseName(environment.MONGODB_DB_NAME),
    corsOrigin: corsOrigins[0],
    corsOrigins,
    authSecret: environment.AUTH_SECRET?.trim() || '',
    mfaEncryptionKey: environment.MFA_ENCRYPTION_KEY?.trim() || '',
    accountTokenHmacSecret: environment.ACCOUNT_TOKEN_HMAC_SECRET?.trim() || '',
    emailProvider: parseEmailProvider(environment.EMAIL_PROVIDER, nodeEnv),
    resendApiKey: environment.RESEND_API_KEY?.trim() || '',
    emailFrom: environment.EMAIL_FROM?.trim() || '',
    appBaseUrl: parseAppBaseUrl(environment.APP_BASE_URL, nodeEnv),
    clinicTimeZone: environment.CLINIC_TIME_ZONE?.trim() || (nodeEnv === 'production' ? '' : 'Asia/Manila'),
    clinicOpenTime: environment.CLINIC_OPEN_TIME?.trim() || '',
    clinicCloseTime: environment.CLINIC_CLOSE_TIME?.trim() || '',
    clinicName: environment.CLINIC_NAME?.trim() || (nodeEnv === 'production' ? '' : 'Arion Health Clinic'),
    clinicLocation: environment.CLINIC_LOCATION?.trim() || (nodeEnv === 'production' ? '' : 'Clinic location not configured'),
    certificateIssuanceEnabled: parseBoolean(
      environment.CERTIFICATE_ISSUANCE_ENABLED,
      nodeEnv !== 'production',
      'CERTIFICATE_ISSUANCE_ENABLED',
    ),
    loginRateLimitWindowMs: parsePositiveInteger(environment.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, 'AUTH_LOGIN_RATE_LIMIT_WINDOW_MS'),
    loginRateLimitMax: parsePositiveInteger(environment.AUTH_LOGIN_RATE_LIMIT_MAX, 10, 'AUTH_LOGIN_RATE_LIMIT_MAX'),
    registerRateLimitWindowMs: parsePositiveInteger(environment.AUTH_REGISTER_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000, 'AUTH_REGISTER_RATE_LIMIT_WINDOW_MS'),
    registerRateLimitMax: parsePositiveInteger(environment.AUTH_REGISTER_RATE_LIMIT_MAX, 5, 'AUTH_REGISTER_RATE_LIMIT_MAX'),
    adminProvisionRateLimitWindowMs: parsePositiveInteger(environment.ADMIN_PROVISION_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, 'ADMIN_PROVISION_RATE_LIMIT_WINDOW_MS'),
    adminProvisionRateLimitMax: parsePositiveInteger(environment.ADMIN_PROVISION_RATE_LIMIT_MAX, 20, 'ADMIN_PROVISION_RATE_LIMIT_MAX'),
    mfaVerifyRateLimitWindowMs: parsePositiveInteger(environment.MFA_VERIFY_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000, 'MFA_VERIFY_RATE_LIMIT_WINDOW_MS'),
    mfaVerifyRateLimitMax: parsePositiveInteger(environment.MFA_VERIFY_RATE_LIMIT_MAX, 5, 'MFA_VERIFY_RATE_LIMIT_MAX'),
    verificationAttemptRateLimitWindowMs: parsePositiveInteger(environment.EMAIL_VERIFICATION_ATTEMPT_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000, 'EMAIL_VERIFICATION_ATTEMPT_RATE_LIMIT_WINDOW_MS'),
    verificationAttemptRateLimitMax: parsePositiveInteger(environment.EMAIL_VERIFICATION_ATTEMPT_RATE_LIMIT_MAX, 10, 'EMAIL_VERIFICATION_ATTEMPT_RATE_LIMIT_MAX'),
    verificationResendRateLimitWindowMs: parsePositiveInteger(environment.EMAIL_VERIFICATION_RESEND_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000, 'EMAIL_VERIFICATION_RESEND_RATE_LIMIT_WINDOW_MS'),
    verificationResendRateLimitMax: parsePositiveInteger(environment.EMAIL_VERIFICATION_RESEND_RATE_LIMIT_MAX, 3, 'EMAIL_VERIFICATION_RESEND_RATE_LIMIT_MAX'),
    forgotPasswordRateLimitWindowMs: parsePositiveInteger(environment.FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000, 'FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS'),
    forgotPasswordRateLimitMax: parsePositiveInteger(environment.FORGOT_PASSWORD_RATE_LIMIT_MAX, 5, 'FORGOT_PASSWORD_RATE_LIMIT_MAX'),
    passwordResetRateLimitWindowMs: parsePositiveInteger(environment.PASSWORD_RESET_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, 'PASSWORD_RESET_RATE_LIMIT_WINDOW_MS'),
    passwordResetRateLimitMax: parsePositiveInteger(environment.PASSWORD_RESET_RATE_LIMIT_MAX, 5, 'PASSWORD_RESET_RATE_LIMIT_MAX'),
  };
}
