import { AuthAccount, Patient, Staff, UserProfile } from '../../server/src/models/index.js';
import { passwordService } from '../../server/src/services/passwordService.js';
import { PatientScenario } from './patientScenario.js';

export class StaffScenario extends PatientScenario {
  async createStaff() {
    const suffix = `${this.marker}-${this.profileIds.length + 1}`;
    const email = `e2e-staff-${suffix}@example.invalid`;
    const password = `E2e!Staff-${suffix}`;
    const profile = await UserProfile.create({
      display_name: `E2E Staff ${suffix.slice(0, 8)}`,
      role: 'staff',
      contact_number: `07${String(Date.now() + this.profileIds.length).slice(-9)}`,
      status: 'active',
    });
    this.profileIds.push(String(profile._id));
    await AuthAccount.create({ user_profile_id: profile._id, email, password_hash: await passwordService.hash(password) });
    const staff = await Staff.create({ user_profile_id: profile._id });
    return { email, password, profileId: String(profile._id), staffId: String(staff._id), display_name: profile.display_name };
  }

  async createGuestPatient(overrides = {}) {
    const suffix = `${this.marker}-${this.patientIds.length + 1}`;
    const patient = await Patient.create({
      user_profile_id: null,
      full_name: `E2E Walkin ${suffix.slice(0, 8)}`,
      dob: new Date('1992-04-18T00:00:00.000Z'),
      sex: 'other',
      contact_number: `06${String(Date.now() + this.patientIds.length).slice(-9)}`,
      address: null,
      emergency_contact_name: null,
      emergency_contact_number: null,
      emergency_contact_relationship: null,
      allergies: [],
      is_pwd: false,
      ...overrides,
    });
    const patientId = String(patient._id);
    this.patientIds.push(patientId);
    return { patientId, full_name: patient.full_name, contact_number: patient.contact_number, dob: patient.dob };
  }

  rememberPatient(patientId) {
    const value = String(patientId);
    if (!this.patientIds.includes(value)) this.patientIds.push(value);
  }
}
