import { randomUUID } from 'node:crypto';
import {
  AuthAccount,
  EmailVerificationChallenge,
  PasswordResetToken,
  Patient,
  UserProfile,
} from '../../server/src/models/index.js';
import { connectDatabase, disconnectDatabase } from '../../server/src/config/database.js';
import {
  getE2eRuntimeConfig,
  loadE2eEnvironment,
} from '../../server/scripts/e2eEnvironment.js';
import { authRepository } from '../../server/src/repositories/authRepository.js';
import { passwordService } from '../../server/src/services/passwordService.js';

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

export async function createTestPatient(_request) {
  loadE2eEnvironment();
  const account = buildTestPatient();
  const { marker: _marker, ...registration } = account;
  const { mongoUri } = getE2eRuntimeConfig();
  await connectDatabase(mongoUri);
  try {
    await authRepository.createPatientRegistration({
      ...registration,
      dob: new Date(registration.dob),
      password_hash: await passwordService.hash(registration.password),
      email_verification_required: false,
      email_verified_at: null,
    });
  } finally {
    await disconnectDatabase();
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
    await EmailVerificationChallenge.deleteMany({ account_id: authAccount._id });
    await PasswordResetToken.deleteMany({ account_id: authAccount._id });
    await AuthAccount.deleteOne({ _id: authAccount._id, email: account.email });
    if (patient) await Patient.deleteOne({ _id: patient._id, user_profile_id: profileId });
    await UserProfile.deleteOne({ _id: profileId, role: 'patient' });
  } finally {
    await disconnectDatabase();
  }
}
