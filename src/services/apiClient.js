import { API_BASE_URL } from '../config/apiConfig.js';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'REQUEST_FAILED', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

export function createApiClient({ baseUrl = API_BASE_URL, fetchImpl = globalThis.fetch } = {}) {
  async function request(path, options = {}) {
    const { body, headers = {}, skipUnauthorizedHandling = false, ...requestOptions } = options;
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        ...requestOptions,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('Unable to connect to the server. Please try again.', { code: 'NETWORK_ERROR' });
    }

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) {
      const error = new ApiError(
        payload?.error?.message || 'The request could not be completed. Please try again.',
        { status: response.status, code: payload?.error?.code || 'REQUEST_FAILED', details: payload?.error?.details ?? null },
      );
      if (response.status === 401 && !skipUnauthorizedHandling) unauthorizedHandler?.(error);
      throw error;
    }
    return payload;
  }
  return { request };
}

export const apiClient = createApiClient();
