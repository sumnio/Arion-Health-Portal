import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { loadConfig, validateRuntimeConfig } from '../src/config/env.js';

export const DEFAULT_E2E_DATABASE = 'arion_health_e2e';
export const DEFAULT_E2E_BASE_URL = 'http://127.0.0.1:5173';
export const DEFAULT_E2E_API_URL = 'http://127.0.0.1:5000';

const e2eEnvPath = fileURLToPath(new URL('../.env.e2e', import.meta.url));

export function loadE2eEnvironment() {
  // Shell/CI values win. The E2E file adds only values that are not already set.
  dotenv.config({ path: e2eEnvPath, override: false, quiet: true });
  return process.env;
}

function mongoUriParts(uri) {
  const match = String(uri ?? '').trim().match(/^(mongodb(?:\+srv)?:\/\/.*\/)([^/?]*)(\?.*)?$/i);
  if (!match) {
    throw new Error('The E2E MongoDB URI must be a valid mongodb:// or mongodb+srv:// connection string.');
  }
  return { prefix: match[1], database: decodeURIComponent(match[2]), query: match[3] ?? '' };
}

function databaseName(uri) {
  return mongoUriParts(uri).database;
}

export function deriveE2eMongoUri(uri, name = DEFAULT_E2E_DATABASE) {
  if (!uri?.trim()) {
    throw new Error(
      'E2E MongoDB is not configured. Set E2E_MONGODB_URI in server/.env.e2e or MONGODB_URI in server/.env.',
    );
  }
  const parsed = mongoUriParts(uri);
  return `${parsed.prefix}${name}${parsed.query}`;
}

export function requireE2eMongoUri(uri) {
  const name = databaseName(uri);
  if (!name || !name.toLowerCase().includes('e2e')) {
    throw new Error('E2E_MONGODB_URI must name a dedicated database containing "e2e".');
  }
  return uri;
}

export function getE2eRuntimeConfig(environment = loadE2eEnvironment()) {
  const baseUrl = environment.E2E_BASE_URL?.trim() || DEFAULT_E2E_BASE_URL;
  const apiUrl = environment.E2E_API_URL?.trim() || DEFAULT_E2E_API_URL;
  const api = new URL(apiUrl);
  const configuredMongoUri = environment.E2E_MONGODB_URI?.trim();
  const mongoUri = requireE2eMongoUri(
    configuredMongoUri || deriveE2eMongoUri(environment.MONGODB_URI),
  );
  const testMfaKey = Buffer.alloc(32, 19).toString('base64');

  return validateRuntimeConfig(loadConfig({
    ...environment,
    NODE_ENV: 'test',
    PORT: api.port || (api.protocol === 'https:' ? '443' : '80'),
    CORS_ORIGIN: new URL(baseUrl).origin,
    MONGODB_URI: mongoUri,
    AUTH_SECRET: environment.E2E_AUTH_SECRET || 'arion-e2e-auth-secret-local-tests-only',
    MFA_ENCRYPTION_KEY: environment.E2E_MFA_ENCRYPTION_KEY || testMfaKey,
  }));
}
