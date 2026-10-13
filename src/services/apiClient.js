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

export const RATE_LIMIT_MESSAGE = 'Too many attempts. Please try again later.';

export function apiErrorMessage(error, {
  fallback = 'The request could not be completed. Please try again.',
  forbidden = 'You do not have access to this operation.',
  notFound = fallback,
  codeMessages = {},
} = {}) {
  if (!(error instanceof ApiError)) return fallback;
  if (codeMessages[error.code]) return codeMessages[error.code];
  if (error.status === 401) return 'Your session has expired. Please log in again.';
  if (error.status === 403) return forbidden;
  if (error.status === 404) return notFound;
  if (error.status === 429) return RATE_LIMIT_MESSAGE;
  if ([400, 409].includes(error.status)) return error.message || fallback;
  return fallback;
}

let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

export function createApiClient({ baseUrl = API_BASE_URL, fetchImpl = globalThis.fetch } = {}) {
  async function perform(path, options = {}, responseType = 'json') {
    const { body, formData, headers = {}, skipUnauthorizedHandling = false, ...requestOptions } = options;
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        ...requestOptions,
        credentials: 'include',
        headers: {
          Accept: responseType === 'blob' ? 'application/pdf, image/png, image/jpeg' : 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
      });
    } catch {
      throw new ApiError('Unable to connect to the server. Please try again.', { code: 'NETWORK_ERROR' });
    }

    const contentType = response.headers.get('content-type') || '';
    const payload = !response.ok && contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) {
      const error = new ApiError(
        response.status === 429 ? RATE_LIMIT_MESSAGE : payload?.error?.message || 'The request could not be completed. Please try again.',
        { status: response.status, code: payload?.error?.code || 'REQUEST_FAILED', details: payload?.error?.details ?? null },
      );
      if (response.status === 401 && !skipUnauthorizedHandling) unauthorizedHandler?.(error);
      throw error;
    }
    if (responseType === 'blob') {
      return {
        blob: await response.blob(),
        contentType,
        contentDisposition: response.headers.get('content-disposition') || '',
      };
    }
    return contentType.includes('application/json') ? await response.json() : null;
  }
  return {
    request(path, options) { return perform(path, options); },
    upload(path, formData, options = {}) { return perform(path, { ...options, formData }); },
    download(path, options = {}) { return perform(path, options, 'blob'); },
  };
}

export const apiClient = createApiClient();
