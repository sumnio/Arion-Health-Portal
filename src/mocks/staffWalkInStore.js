export const walkInSubmissions = new Map();
// Submission tokens are UI idempotency metadata, not domain entities.
export { patientRepository } from '../repositories/patientRepository.js';
import { patientRepository } from '../repositories/patientRepository.js';
export function allStaffPatients() { return patientRepository.list(); }
