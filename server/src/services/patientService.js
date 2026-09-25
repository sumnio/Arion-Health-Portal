import { httpError } from '../utils/httpError.js';
import { validatePatientProfilePatch } from '../validation/patientValidation.js';

function isoDate(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : null;
}

function presentPatient(patient) {
  return {
    id: String(patient._id ?? patient.id),
    user_profile_id: patient.user_profile_id ? String(patient.user_profile_id) : null,
    full_name: patient.full_name,
    dob: isoDate(patient.dob),
    sex: patient.sex,
    contact_number: patient.contact_number,
    address: patient.address ?? null,
    emergency_contact_name: patient.emergency_contact_name ?? null,
    emergency_contact_number: patient.emergency_contact_number ?? null,
    emergency_contact_relationship: patient.emergency_contact_relationship ?? null,
    allergies: [...(patient.allergies ?? [])],
    is_pwd: patient.is_pwd === true,
  };
}

export function createPatientService({ repository }) {
  async function resolveOwn(userProfileId) {
    const patient = await repository.findByUserProfileId(userProfileId);
    if (!patient) {
      throw httpError(404, 'PATIENT_PROFILE_NOT_FOUND', 'Patient profile was not found.');
    }
    return patient;
  }

  return {
    async getOwnProfile(userProfileId) {
      return presentPatient(await resolveOwn(userProfileId));
    },

    async updateOwnProfile(userProfileId, body) {
      await resolveOwn(userProfileId);
      const updates = validatePatientProfilePatch(body);
      const patient = await repository.updateByUserProfileId(userProfileId, updates);
      if (!patient) {
        throw httpError(404, 'PATIENT_PROFILE_NOT_FOUND', 'Patient profile was not found.');
      }
      return presentPatient(patient);
    },

    async resolveOwnPatient(userProfileId) {
      return resolveOwn(userProfileId);
    },
  };
}
