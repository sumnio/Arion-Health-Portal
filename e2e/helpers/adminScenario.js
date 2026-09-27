import {
  AuthAccount,
  Doctor,
  Staff,
  UserProfile,
} from '../../server/src/models/index.js';
import { getE2eRuntimeConfig } from '../../server/scripts/e2eEnvironment.js';
import { createMfaEncryptionService } from '../../server/src/services/mfaEncryptionService.js';
import { passwordService } from '../../server/src/services/passwordService.js';
import { totpService } from '../../server/src/services/totpService.js';
import { StaffScenario } from './staffScenario.js';

export class AdminScenario extends StaffScenario {
  constructor() {
    super();
    this.runtime = getE2eRuntimeConfig();
    this.encryption = createMfaEncryptionService(this.runtime.mfaEncryptionKey, 'test');
  }

  async createAdmin({ enrolled = false } = {}) {
    const suffix = `${this.marker}-${this.profileIds.length + 1}`;
    const email = `e2e-admin-${suffix}@example.invalid`;
    const password = `E2e!Admin-${suffix}`;
    const profile = await UserProfile.create({
      display_name: `E2E Admin ${suffix.slice(0, 8)}`,
      role: 'admin',
      contact_number: `06${String(Date.now() + this.profileIds.length).slice(-9)}`,
      status: 'active',
    });
    this.profileIds.push(String(profile._id));
    let mfaSecret = null;
    const mfaFields = {};
    if (enrolled) {
      mfaSecret = totpService.createEnrollment(email).secret;
      mfaFields.mfa_enabled = true;
      mfaFields.mfa_secret_encrypted = this.encryption.encrypt(mfaSecret);
      mfaFields.mfa_enrolled_at = new Date();
    }
    await AuthAccount.create({
      user_profile_id: profile._id,
      email,
      password_hash: await passwordService.hash(password),
      ...mfaFields,
    });
    return {
      email,
      password,
      profileId: String(profile._id),
      display_name: profile.display_name,
      mfaSecret,
    };
  }

  async pendingMfaSecret(profileId) {
    const account = await AuthAccount.findOne({ user_profile_id: profileId })
      .select('+mfa_pending_secret_encrypted')
      .lean();
    return this.encryption.decrypt(account.mfa_pending_secret_encrypted);
  }

  async expireMfaChallenge(profileId) {
    await AuthAccount.updateOne(
      { user_profile_id: profileId },
      { $set: { mfa_challenge_expires_at: new Date(Date.now() - 1000) } },
    );
  }

  async rememberProvisionedAccount(email, role) {
    const account = await AuthAccount.findOne({ email }).lean();
    if (!account) throw new Error(`Expected provisioned ${role} account was not found.`);
    const profileId = String(account.user_profile_id);
    if (!this.profileIds.includes(profileId)) this.profileIds.push(profileId);
    if (role === 'doctor') {
      const doctor = await Doctor.findOne({ user_profile_id: profileId }).lean();
      if (!doctor) throw new Error('Expected provisioned Doctor profile was not found.');
      const doctorId = String(doctor._id);
      if (!this.doctorIds.includes(doctorId)) this.doctorIds.push(doctorId);
      return { account, profileId, roleProfile: doctor, roleProfileId: doctorId };
    }
    const staff = await Staff.findOne({ user_profile_id: profileId }).lean();
    if (!staff) throw new Error('Expected provisioned Staff profile was not found.');
    return { account, profileId, roleProfile: staff, roleProfileId: String(staff._id) };
  }
}
