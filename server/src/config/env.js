import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
dotenv.config({ path: envPath, quiet: true });

export const AUTH_SECRET_MIN_LENGTH = 32;
export const MFA_ENCRYPTION_KEY_BYTES = 32;
export const DEFAULT_DEVELOPMENT_ORIGIN = 'http://127.0.0.1:5173';
const allowedNodeEnvironments = new Set(['development', 'test', 'production']);
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

function parseNodeEnvironment(value) {
  const nodeEnv = value?.trim() || 'development';
  if (!allowedNodeEnvironments.has(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }
  return nodeEnv;
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

export function validateRuntimeConfig(config) {
  if (!config?.mongoUri) throw new Error('MONGODB_URI is required. Add it to server/.env before starting the API.');
  requireAuthSecret(config.authSecret, config.nodeEnv);
  requireMfaEncryptionKey(config.mfaEncryptionKey, config.nodeEnv);
  if (!Array.isArray(config.corsOrigins) || !config.corsOrigins.length) {
    throw new Error('CORS_ORIGIN must contain at least one trusted origin.');
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
    corsOrigin: corsOrigins[0],
    corsOrigins,
    authSecret: environment.AUTH_SECRET?.trim() || '',
    mfaEncryptionKey: environment.MFA_ENCRYPTION_KEY?.trim() || '',
    clinicTimeZone: environment.CLINIC_TIME_ZONE?.trim() || 'Asia/Manila',
    clinicOpenTime: environment.CLINIC_OPEN_TIME?.trim() || '',
    clinicCloseTime: environment.CLINIC_CLOSE_TIME?.trim() || '',
    clinicName: environment.CLINIC_NAME?.trim() || 'Arion Health Clinic',
    clinicLocation: environment.CLINIC_LOCATION?.trim() || 'Clinic location not configured',
    loginRateLimitWindowMs: parsePositiveInteger(environment.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, 'AUTH_LOGIN_RATE_LIMIT_WINDOW_MS'),
    loginRateLimitMax: parsePositiveInteger(environment.AUTH_LOGIN_RATE_LIMIT_MAX, 10, 'AUTH_LOGIN_RATE_LIMIT_MAX'),
    registerRateLimitWindowMs: parsePositiveInteger(environment.AUTH_REGISTER_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000, 'AUTH_REGISTER_RATE_LIMIT_WINDOW_MS'),
    registerRateLimitMax: parsePositiveInteger(environment.AUTH_REGISTER_RATE_LIMIT_MAX, 5, 'AUTH_REGISTER_RATE_LIMIT_MAX'),
    adminProvisionRateLimitWindowMs: parsePositiveInteger(environment.ADMIN_PROVISION_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, 'ADMIN_PROVISION_RATE_LIMIT_WINDOW_MS'),
    adminProvisionRateLimitMax: parsePositiveInteger(environment.ADMIN_PROVISION_RATE_LIMIT_MAX, 20, 'ADMIN_PROVISION_RATE_LIMIT_MAX'),
    mfaVerifyRateLimitWindowMs: parsePositiveInteger(environment.MFA_VERIFY_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000, 'MFA_VERIFY_RATE_LIMIT_WINDOW_MS'),
    mfaVerifyRateLimitMax: parsePositiveInteger(environment.MFA_VERIFY_RATE_LIMIT_MAX, 5, 'MFA_VERIFY_RATE_LIMIT_MAX'),
  };
}
