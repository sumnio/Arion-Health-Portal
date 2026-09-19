import { doctorPatientService } from './doctorPatientService.js';
import { doctorRecordStore, doctorPrescriptionStore, demoDoctor } from '../mocks/doctorRecordStore.js';

export const doctorRecordService = {
  context(patientId, selection) {
    if (!doctorPatientService.get(patientId)) return { error: 'Patient not found. Return to the schedule to select a valid patient.' };
    if (!selection?.appointmentId || !selection?.date) return { error: 'Select an appointment from Patient Details before adding a medical record.' };
    const detail = doctorPatientService.get(patientId, selection);
    if (!detail) return { error: 'Patient or appointment not found. Return to the schedule and select a valid consultation.' };
    return { ...detail, doctor: demoDoctor, error: detail.canAddRecord ? null : detail.consultationMessage };
  },
  get(id) {
    const record = doctorRecordStore.find(item => item.id === id);
    return record ? structuredClone({ ...record, prescriptions: doctorPrescriptionStore.filter(item => item.medical_record_id === id) }) : null;
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
    const record = { id: crypto.randomUUID(), patient_id: context.patient.id, doctor_id: context.doctor.id,
      appointment_id: context.appointment.id, encounter_at: timestamp.toISOString(), diagnosis: values.diagnosis.trim(),
      notes: values.notes?.trim() || null, follow_up: values.follow_up?.trim() || null, created_at: now, updated_at: now };
    const prescriptions = rows.map(row => ({ id: crypto.randomUUID(), medical_record_id: record.id, medicine: row.medicine.trim(), dosage: row.dosage.trim(), instructions: row.instructions?.trim() || null }));
    doctorRecordStore.push(record);
    doctorPrescriptionStore.push(...prescriptions);
    return { record: this.get(record.id) };
  },
};
