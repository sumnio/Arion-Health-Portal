import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
dotenv.config({ path: envPath, quiet: true });

function parsePort(value) {
  const port = Number(value ?? 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return port;
}

export function loadConfig(environment = process.env) {
  return {
    port: parsePort(environment.PORT),
    nodeEnv: environment.NODE_ENV || 'development',
    mongoUri: environment.MONGODB_URI?.trim() || '',
    corsOrigin: environment.CORS_ORIGIN?.trim() || 'http://127.0.0.1:5173',
    authSecret: environment.AUTH_SECRET?.trim() || '',
    clinicTimeZone: environment.CLINIC_TIME_ZONE?.trim() || 'Asia/Manila',
    clinicOpenTime: environment.CLINIC_OPEN_TIME?.trim() || '',
    clinicCloseTime: environment.CLINIC_CLOSE_TIME?.trim() || '',
    clinicName: environment.CLINIC_NAME?.trim() || 'Arion Health Clinic',
    clinicLocation: environment.CLINIC_LOCATION?.trim() || 'Clinic location not configured',
  };
}
