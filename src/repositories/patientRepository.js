import { doctorPatients } from '../mocks/doctorPatientData.js';

const patients = doctorPatients;

export const patientRepository = {
  list() { return patients; },
  get(id) { return patients.find(item => item.id === id) ?? null; },
  add(patient) { patients.push(patient); return patient; },
};

