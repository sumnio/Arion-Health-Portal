import { doctorCertificateStore } from '../mocks/doctorCertificateStore.js';
import { medicalCertificates } from '../mocks/certificateData.js';
import { doctorRecordService } from './doctorRecordService.js';
import { doctorPatientService } from './doctorPatientService.js';
import { doctorPatients } from '../mocks/doctorPatientData.js';
import { demoDoctor } from '../mocks/doctorRecordStore.js';
import { clinicToday } from './bookingService.js';
import { doctorProfileService } from './doctorProfileService.js';
import { nextMockCertificateNumber } from './certificateNumberService.js';
import { clinicConfig } from '../config/clinicConfig.js';

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export const doctorCertificateService = {
  context(id) {
    // Existing completed demo consultations and records saved in Milestone 12.
    const record = doctorRecordService.get(id) ?? doctorPatients.flatMap(patient => {
      const detail = doctorPatientService.get(patient.id);
      return [detail?.existingRecord, ...(detail?.history ?? [])].filter(item => item?.id?.startsWith('80000000'));
    }).find(item => item.id === id);
    if (!record) return { error: 'Medical record not found. It may have been cleared when the mock preview reloaded.' };
    const detail = doctorPatientService.get(record.patient_id);
    const doctor = doctorProfileService.get(demoDoctor.id);
    if (!detail || !doctor || (record.doctor_id ? record.doctor_id !== doctor.id : record.doctor !== doctor.display_name)) return { error: 'Patient or issuing doctor context is unavailable for this medical record.' };
    return { record, patient: detail.patient, doctor, clinic: clinicConfig, date: clinicToday(), selection: { appointmentId: record.appointment_id, date: new Date(record.encounter_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) } };
  },
  list(recordId) { return structuredClone(doctorCertificateStore.filter(item => item.medical_record_id === recordId)); },
  previewNumber(dateIssued) { return nextMockCertificateNumber(dateIssued, [...medicalCertificates, ...doctorCertificateStore]); },
  issue(recordId, values, requestId) {
    const context = this.context(recordId);
    if (context.error) return { errors: { form: context.error } };
    const errors = {};
    if (!values.purpose?.trim()) errors.purpose = 'Enter a purpose.';
    if (!values.diagnosis_summary?.trim()) errors.diagnosis_summary = 'Enter a diagnosis summary.';
    if (!validDate(values.date_issued)) errors.date_issued = 'Enter a valid issue date.';
    if (values.valid_until && (!validDate(values.valid_until) || values.valid_until < values.date_issued)) errors.valid_until = 'Valid until must be on or after the issue date.';
    if (Object.keys(errors).length) return { errors };
    const duplicate = doctorCertificateStore.find(item => item.medical_record_id === recordId && item.purpose.toLowerCase() === values.purpose.trim().toLowerCase() && item.date_issued === values.date_issued);
    if (issuedRequests.has(requestId) || duplicate) return { errors: { form: 'A certificate has already been issued for this submission or the same record, purpose, and issue date.' } };
    const now = new Date().toISOString();
    const certificate = { id: crypto.randomUUID(), medical_certificate_number: this.previewNumber(values.date_issued), patient_id: context.patient.id, doctor_id: context.doctor.id, medical_record_id: recordId,
      purpose: values.purpose.trim(), diagnosis_summary: values.diagnosis_summary.trim(), date_issued: values.date_issued,
      valid_until: values.valid_until || null, status: 'issued', created_at: now, updated_at: now };
    doctorCertificateStore.push(certificate);
    issuedRequests.add(requestId);
    return { certificate: structuredClone(certificate) };
  },
};
// Submission identity is UI/service metadata, never a MedicalCertificate field.
const issuedRequests = new Set();
