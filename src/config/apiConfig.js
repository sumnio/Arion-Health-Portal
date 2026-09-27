export const LOCAL_API_BASE_URL = 'http://127.0.0.1:5000';

export function resolveApiBaseUrl(
  configuredBaseUrl,
  { isProduction = false, localDefault = LOCAL_API_BASE_URL } = {},
) {
  if (configuredBaseUrl !== undefined) {
    return String(configuredBaseUrl).trim().replace(/\/$/, '');
  }
  return isProduction ? '' : localDefault;
}

export const API_BASE_URL = resolveApiBaseUrl(
  import.meta.env?.VITE_API_BASE_URL,
  { isProduction: import.meta.env?.PROD === true },
);
