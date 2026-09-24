import { doctorPatients } from './doctorPatientData.js';
import { demoDoctor } from './doctorRecordStore.js';

export const walkInPatients = [];
export const walkInAppointments = [];
// Service labels remain separate because Appointment has no approved visit-type field yet.
export const walkInServices = new Map();
export const walkInSubmissions = new Map();
export function staffPatient(id) { return doctorPatients.find(item => item.id === id) ?? walkInPatients.find(item => item.id === id); }
export function allStaffPatients() { return [...doctorPatients, ...walkInPatients]; }
// Demo Doctor covers the same daily mock clinic schedule used by the Staff dashboard.
export const walkInDutyDoctor = { id: demoDoctor.id, name: demoDoctor.display_name,
  times: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'] };
