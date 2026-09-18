import { medicalRecords, medicalRecordVisitLabels, prescriptions, recordCertificates } from '../mocks/medicalRecordData.js';
import { exampleIds } from '../mocks/portalData.js';
import { bookingDoctors } from '../mocks/bookingData.js';
import { appointmentStore } from '../mocks/appointmentStore.js';

// Provider-independent, read-only view models for the current demo patient.
// Mock patient scoping is not authentication or a replacement for backend authorization.
function present(record) {
  const doctor = bookingDoctors.find(item => item.id === record.doctor_id);
  const appointment = appointmentStore.find(item => item.id === record.appointment_id && item.patient_id === record.patient_id && item.doctor_id === record.doctor_id);
  return structuredClone({ ...record,
    doctor: doctor?.name ?? 'Doctor unavailable', specialty: doctor?.specialty ?? '',
    visitType: appointment?.service ?? medicalRecordVisitLabels[record.id] ?? 'Consultation',
    prescriptions: prescriptions.filter(item => item.medical_record_id === record.id),
    certificates: recordCertificates.filter(item => item.medical_record_id === record.id && item.patient_id === record.patient_id && item.status === 'issued'),
  });
}
export const medicalRecordService = {
  list(query = '') {
    const search = query.trim().toLowerCase();
    return medicalRecords.filter(item => item.patient_id === exampleIds.patient).map(present)
      .filter(item => [item.doctor, item.diagnosis, item.visitType].some(value => value.toLowerCase().includes(search)))
      .sort((a, b) => new Date(b.encounter_at) - new Date(a.encounter_at));
  },
  get(id) {
    const record = medicalRecords.find(item => item.id === id && item.patient_id === exampleIds.patient);
    return record ? present(record) : null;
  },
};
export function formatEncounter(value) {
  return new Date(value).toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'long', timeStyle: 'short' });
}
