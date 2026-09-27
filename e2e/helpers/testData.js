import { randomUUID } from 'node:crypto';
import { AuthAccount, Patient, UserProfile } from '../../server/src/models/index.js';
import { connectDatabase, disconnectDatabase } from '../../server/src/config/database.js';
import {
  DEFAULT_E2E_API_URL,
  getE2eRuntimeConfig,
  loadE2eEnvironment,
} from '../../server/scripts/e2eEnvironment.js';

export function buildTestPatient() {
  const marker = randomUUID();
  return {
    marker,
    email: `e2e-patient-${marker}@example.invalid`,
    password: `E2e!Patient-${marker}`,
    display_name: `E2E Patient ${marker.slice(0, 8)}`,
    full_name: `E2E Patient ${marker.slice(0, 8)}`,
    contact_number: `09${Date.now().toString().slice(-9)}`,
    dob: '1990-01-15',
    sex: 'other',
    address: null,
    emergency_contact_name: null,
    emergency_contact_number: null,
    emergency_contact_relationship: null,
    allergies: [],
    is_pwd: false,
  };
}

export async function createTestPatient(request) {
  loadE2eEnvironment();
  const account = buildTestPatient();
  const { marker: _marker, ...registration } = account;
  const apiURL = process.env.E2E_API_URL || DEFAULT_E2E_API_URL;
  const response = await request.post(`${apiURL}/api/auth/register`, { data: registration });
  if (!response.ok()) {
    throw new Error(`Unable to create disposable E2E Patient: HTTP ${response.status()} ${await response.text()}`);
  }
  return account;
}

export async function cleanupTestPatient(account) {
  if (!account?.email?.startsWith('e2e-patient-') || !account.email.endsWith('@example.invalid')) {
    throw new Error('Refusing to clean up an account without the E2E Patient marker.');
  }
  const { mongoUri } = getE2eRuntimeConfig();
  await connectDatabase(mongoUri);
  try {
    const authAccount = await AuthAccount.findOne({ email: account.email }).select('_id user_profile_id').lean();
    if (!authAccount) return;
    const profileId = authAccount.user_profile_id;
    const patient = await Patient.findOne({ user_profile_id: profileId }).select('_id').lean();
    await AuthAccount.deleteOne({ _id: authAccount._id, email: account.email });
    if (patient) await Patient.deleteOne({ _id: patient._id, user_profile_id: profileId });
    await UserProfile.deleteOne({ _id: profileId, role: 'patient' });
  } finally {
    await disconnectDatabase();
  }
}
