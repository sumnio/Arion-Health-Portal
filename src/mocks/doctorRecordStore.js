// Compatibility exports for older focused tests. Runtime services use the repository.
export { medicalRecordStore as doctorRecordStore, prescriptionStore as doctorPrescriptionStore } from '../repositories/medicalRecordRepository.js';
export const demoDoctor = { id: '50000000-0000-4000-8000-000000000003', display_name: 'Demo Doctor' };
