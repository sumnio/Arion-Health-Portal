import { medicalCertificateRepository } from '../repositories/medicalCertificateRepository.js';
import { exampleIds } from '../mocks/portalData.js';
import { medicalRecordService } from './medicalRecordService.js';
import { portalService } from './portalService.js';
import { doctorProfileService } from './doctorProfileService.js';
import { clinicConfig } from '../config/clinicConfig.js';

const patientVisible = (item, patientId) => item.patient_id === patientId && item.status === 'issued' && !!item.date_issued;
function present(item, patientName = portalService.getPreviewProfile('patient').display_name) {
  const doctor = doctorProfileService.get(item.doctor_id);
  const record = item.medical_record_id ? medicalRecordService.get(item.medical_record_id) : null;
  return structuredClone({ ...item, doctor: doctor?.display_name ?? 'Doctor unavailable', specialty: doctor?.specialty ?? '',
    license_number: doctor?.license_number ?? 'Not available', ptr_number: doctor?.ptr_number ?? 'Not available',
    signature_available: Boolean(doctor?.signature_path), patientName, clinic: clinicConfig,
    relatedRecord: record ? { id: record.id, encounter_at: record.encounter_at, visitType: record.visitType } : null });
}
// Read-only mock patient scope, not authentication or backend authorization.
export const certificateService = {
  list() { return this.listForPatient(exampleIds.patient); },
  listForPatient(patientId, patientName) {
    return medicalCertificateRepository.list().filter(item => patientVisible(item, patientId)).map(item => present(item, patientName))
      .sort((a, b) => b.date_issued.localeCompare(a.date_issued));
  },
  get(id) {
    const item = medicalCertificateRepository.get(id);
    return item && patientVisible(item, exampleIds.patient) ? present(item) : null;
  },
};
export function formatCertificateDate(value) {
  return value ? new Date(value + 'T00:00:00+08:00').toLocaleDateString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'long' }) : 'Not specified';
}
