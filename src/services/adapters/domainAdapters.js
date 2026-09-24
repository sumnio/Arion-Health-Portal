// Domain-to-view adapters keep API-shaped snake_case entities immutable.
export function toDoctorOption(profile) {
  return { id: profile.id, name: profile.display_name, specialty: profile.specialty };
}

export function toPatientSearchOption(patient) {
  return { id: patient.id, full_name: patient.full_name, dob: patient.dob, contact_number: patient.contact_number };
}
