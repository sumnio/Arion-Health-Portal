import { patientProfileData } from './patientProfileData.js';
// Patient fields only; names are joined from the existing dashboard lookup.
export const doctorPatients = [
  { id: '10000000-0000-4000-8000-000000000001', dob: patientProfileData.dob, sex: patientProfileData.sex, contact_number: patientProfileData.contactNumber, allergies: patientProfileData.allergies, is_pwd: patientProfileData.isPwd },
  { id: '10000000-0000-4000-8000-000000000002', dob: '1986-04-12', sex: 'Female', contact_number: '0917 555 0102', allergies: [], is_pwd: false },
  { id: '10000000-0000-4000-8000-000000000003', dob: '1960-08-21', sex: 'Male', contact_number: '0917 555 0103', allergies: ['Penicillin'], is_pwd: false },
  { id: '10000000-0000-4000-8000-000000000004', dob: '1994-03-06', sex: 'Female', contact_number: '0917 555 0104', allergies: [], is_pwd: false },
  { id: '10000000-0000-4000-8000-000000000005', dob: '1978-11-19', sex: 'Male', contact_number: '0917 555 0105', allergies: [], is_pwd: true },
];
// Completed consultations from the existing relative-day schedule fixtures.
export const doctorConsultationDiagnoses = {
  '70000000-0000-4000-8000-000000000001': 'Routine health examination',
  '70000000-0000-4000-8000-000000000002': 'Allergic rhinitis, improving',
  '70000000-0000-4000-8000-000000000006': 'Allergic rhinitis',
};
