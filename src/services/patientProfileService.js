import { patientProfileData } from '../mocks/patientProfileData.js';
import { clinicToday } from './bookingService.js';

let saved = structuredClone(patientProfileData);
export const profileSexOptions = ['Male', 'Female', 'Prefer not to say'];
export function ageFromDob(dob, today = clinicToday()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const parsed = new Date(dob + 'T00:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dob || dob > today) return null;
  return Number(today.slice(0, 4)) - Number(dob.slice(0, 4)) - (today.slice(5) < dob.slice(5) ? 1 : 0);
}
// Mock display rule only; senior status is derived and never stored.
export function isSenior(dob, today = clinicToday()) {
  const age = ageFromDob(dob, today);
  return age === null ? null : age >= 60;
}
const validPhone = value => /^[+\d\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 7 && value.replace(/\D/g, '').length <= 15;
export const patientProfileService = {
  get() { return structuredClone(saved); },
  validate(values) {
    const errors = {};
    if (!values.fullName?.trim()) errors.fullName = 'Enter your full name.';
    if (ageFromDob(values.dob) === null) errors.dob = 'Enter a valid date of birth that is not in the future.';
    if (!profileSexOptions.includes(values.sex)) errors.sex = 'Select a sex option.';
    if (!validPhone(values.contactNumber?.trim() ?? '')) errors.contactNumber = 'Enter a contact number with 7–15 digits.';
    if (values.emergencyNumber?.trim() && !validPhone(values.emergencyNumber.trim())) errors.emergencyNumber = 'Enter an emergency number with 7–15 digits, or leave it blank.';
    return errors;
  },
  save(values) {
    const errors = this.validate(values);
    if (Object.keys(errors).length) return { errors };
    saved = {
      fullName: values.fullName.trim(), dob: values.dob, sex: values.sex, contactNumber: values.contactNumber.trim(),
      email: saved.email, address: values.address.trim(), emergencyName: values.emergencyName.trim(),
      emergencyNumber: values.emergencyNumber.trim(), relationship: values.relationship.trim(),
      allergies: values.allergies.split(/[,\n]/).map(value => value.trim()).filter(Boolean), isPwd: values.isPwd === true,
    };
    return { profile: this.get() };
  },
};
