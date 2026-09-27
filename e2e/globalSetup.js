import { request } from '@playwright/test';
import {
  DEFAULT_E2E_API_URL,
  loadE2eEnvironment,
} from '../server/scripts/e2eEnvironment.js';

export default async function globalSetup() {
  loadE2eEnvironment();
  const apiURL = process.env.E2E_API_URL || DEFAULT_E2E_API_URL;
  const context = await request.newContext({ baseURL: apiURL });
  try {
    const response = await context.get('/api/health');
    if (!response.ok()) {
      throw new Error(`Backend health precheck returned HTTP ${response.status()}.`);
    }
    const body = await response.json();
    if (body.status !== 'ok') {
      throw new Error('Backend health precheck returned an unexpected response.');
    }
  } catch (error) {
    throw new Error(`E2E backend health precheck failed at ${apiURL}/api/health: ${error.message}`);
  } finally {
    await context.dispose();
  }
}
