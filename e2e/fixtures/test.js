import { test as base, expect } from '@playwright/test';
import { cleanupTestPatient, createTestPatient } from '../helpers/testData.js';

export const test = base.extend({
  patientAccount: async ({ request }, use) => {
    const account = await createTestPatient(request);
    try {
      await use(account);
    } finally {
      await cleanupTestPatient(account);
    }
  },
});

export { expect };
