import { test as base, expect } from '@playwright/test';
import { cleanupTestPatient, createTestPatient } from '../helpers/testData.js';
import { connectDatabase, disconnectDatabase } from '../../server/src/config/database.js';
import { getE2eRuntimeConfig } from '../../server/scripts/e2eEnvironment.js';
import { PatientScenario } from '../helpers/patientScenario.js';

export const test = base.extend({
  patientAccount: async ({ request }, use) => {
    const account = await createTestPatient(request);
    try {
      await use(account);
    } finally {
      await cleanupTestPatient(account);
    }
  },
  patientScenario: async ({}, use) => {
    const scenario = new PatientScenario();
    await connectDatabase(getE2eRuntimeConfig().mongoUri);
    try {
      await use(scenario);
    } finally {
      await scenario.cleanup();
      await disconnectDatabase();
    }
  },
  seededPatient: async ({ patientScenario }, use) => {
    await use(await patientScenario.createPatient());
  },
  seededDoctor: async ({ patientScenario }, use) => {
    await use(await patientScenario.createDoctor());
  },
});

export { expect };
