import { doctorPatientService } from './doctorPatientService.js';
import { medicalRecordRepository } from '../repositories/medicalRecordRepository.js';
import { DEMO_DOCTOR_ID } from '../repositories/appointmentRepository.js';
import { doctorProfileService } from './doctorProfileService.js';

export const doctorRecordService = {
  context(patientId, selection) {
    if (!doctorPatientService.get(patientId)) return { error: 'Patient not found. Return to the schedule to select a valid patient.' };
    if (!selection?.appointmentId || !selection?.date) return { error: 'Select an appointment from Patient Details before adding a medical record.' };
    const detail = doctorPatientService.get(patientId, selection);
    if (!detail) return { error: 'Patient or appointment not found. Return to the schedule and select a valid consultation.' };
    return { ...detail, doctor: doctorProfileService.get(DEMO_DOCTOR_ID), error: detail.canAddRecord ? null : detail.consultationMessage };
  },
  get(id) {
    const record = medicalRecordRepository.get(id);
    return record ? structuredClone({ ...record, prescriptions: medicalRecordRepository.prescriptions(id) }) : null;
  },
  save(patientId, selection, values) {
    const context = this.context(patientId, selection);
    if (context.error) return { errors: { form: context.error } };
    const errors = {};
    if (!values.diagnosis?.trim()) errors.diagnosis = 'Enter a diagnosis.';
    const encounter = values.encounter_at;
    const timestamp = new Date(encounter + ':00+08:00');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(encounter ?? '') || !Number.isFinite(timestamp.getTime()) || (Number.isFinite(timestamp.getTime()) && new Date(timestamp.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16) !== encounter)) errors.encounter_at = 'Enter a valid encounter date and time.';
    const rows = values.prescriptions ?? [];
    rows.forEach((row, index) => {
      if (!row.medicine?.trim()) errors[`medicine-${index}`] = 'Enter a medicine or remove this row.';
      if (!row.dosage?.trim()) errors[`dosage-${index}`] = 'Enter a dosage.';
    });
    if (Object.keys(errors).length) return { errors };
    const now = new Date().toISOString();
    const recordValues = { patient_id: context.patient.id, doctor_id: context.doctor.id,
      appointment_id: context.appointment.id, encounter_at: timestamp.toISOString(), diagnosis: values.diagnosis.trim(),
      notes: values.notes?.trim() || null, follow_up: values.follow_up?.trim() || null, created_at: now, updated_at: now };
    const prescriptionValues = rows.map(row => ({ medicine: row.medicine.trim(), dosage: row.dosage.trim(), instructions: row.instructions?.trim() || null }));
    const record = medicalRecordRepository.create(recordValues, prescriptionValues);
    return { record: this.get(record.id) };
  },
};
