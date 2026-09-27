import { DEFAULT_E2E_API_URL, DEFAULT_E2E_BASE_URL, loadE2eEnvironment } from '../../server/scripts/e2eEnvironment.js';

loadE2eEnvironment();
export const e2eApiUrl = process.env.E2E_API_URL || DEFAULT_E2E_API_URL;
export const e2eBaseUrl = process.env.E2E_BASE_URL || DEFAULT_E2E_BASE_URL;

export async function browserApi(page, path, { method = 'GET', body } = {}) {
  return page.evaluate(async ({ origin, path: resource, method: verb, body: payload }) => {
    const response = await fetch(`${origin}${resource}`, {
      method: verb,
      credentials: 'include',
      headers: payload === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    return { status: response.status, body: await response.json() };
  }, { origin: e2eApiUrl, path, method, body });
}
