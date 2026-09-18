import { medicalCertificates, certificateClinic } from '../mocks/certificateData.js';
import { exampleIds } from '../mocks/portalData.js';
import { bookingDoctors } from '../mocks/bookingData.js';
import { medicalRecordService } from './medicalRecordService.js';
import { portalService } from './portalService.js';

const patientVisible = item => item.patient_id === exampleIds.patient && item.status === 'issued' && !!item.date_issued;
function present(item) {
  const doctor = bookingDoctors.find(doctor => doctor.id === item.doctor_id);
  const record = item.medical_record_id ? medicalRecordService.get(item.medical_record_id) : null;
  return structuredClone({ ...item, doctor: doctor?.name ?? 'Doctor unavailable', specialty: doctor?.specialty ?? '',
    patientName: portalService.getPreviewProfile('patient').display_name, clinic: certificateClinic,
    relatedRecord: record ? { id: record.id, encounter_at: record.encounter_at, visitType: record.visitType } : null });
}
// Read-only mock patient scope, not authentication or backend authorization.
export const certificateService = {
  list() { return medicalCertificates.filter(patientVisible).map(present).sort((a, b) => b.date_issued.localeCompare(a.date_issued)); },
  get(id) { const item = medicalCertificates.find(item => item.id === id && patientVisible(item)); return item ? present(item) : null; },
};
export function formatCertificateDate(value) {
  return value ? new Date(value + 'T00:00:00+08:00').toLocaleDateString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'long' }) : 'Not specified';
}
