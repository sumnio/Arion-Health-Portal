import { patientDashboardData } from './patientDashboardData.js';
import { exampleIds } from './portalData.js';

// Arion-created clinical fixtures only. The two older entries are exceptional
// manual records, not examples of the normal appointment-linked walk-in flow.
export const medicalRecords = [
  { ...patientDashboardData.recentRecord, created_at: '2026-09-02T10:25:00+08:00', updated_at: '2026-09-02T10:25:00+08:00' },
  {
    id: '30000000-0000-4000-8000-000000000002', patient_id: exampleIds.patient,
    doctor_id: '50000000-0000-4000-8000-000000000002', appointment_id: null,
    encounter_at: '2026-06-12T09:30:00+08:00', diagnosis: 'Seasonal allergic rhinitis',
    notes: 'Symptoms improved since the previous consultation. Avoidance of identified triggers discussed.',
    follow_up: 'Return for review if symptoms recur or persist.',
    created_at: '2026-06-12T10:00:00+08:00', updated_at: '2026-06-12T10:00:00+08:00',
  },
  {
    id: '30000000-0000-4000-8000-000000000003', patient_id: exampleIds.patient,
    doctor_id: '50000000-0000-4000-8000-000000000001', appointment_id: null,
    encounter_at: '2026-01-20T08:30:00+08:00', diagnosis: 'Routine health examination',
    notes: null, follow_up: 'Continue routine health reviews as discussed with your doctor.',
    created_at: '2026-01-20T09:00:00+08:00', updated_at: '2026-01-20T09:00:00+08:00',
  },
];

// UI-only labels; MedicalRecord has no visit-type field in the approved schema.
export const medicalRecordVisitLabels = {
  '30000000-0000-4000-8000-000000000002': 'Follow-up',
  '30000000-0000-4000-8000-000000000003': 'General Consultation',
};

// Prescription is a separate entity related through medical_record_id.
export const prescriptions = [
  { id: '60000000-0000-4000-8000-000000000001', medical_record_id: exampleIds.record,
    medicine: 'Paracetamol 500 mg', dosage: '1 tablet every 6 hours as needed',
    instructions: 'For fever or pain, as discussed during the consultation.' },
  { id: '60000000-0000-4000-8000-000000000002', medical_record_id: exampleIds.record,
    medicine: 'Cetirizine 10 mg', dosage: '1 tablet once daily at bedtime',
    instructions: 'Take as directed by the prescribing doctor.' },
];

export const recordCertificates = [{
  id: exampleIds.certificate, medical_certificate_number: 'MC-MOCK-20260902-001', patient_id: exampleIds.patient,
  doctor_id: patientDashboardData.recentRecord.doctor_id, medical_record_id: exampleIds.record,
  date_issued: '2026-09-02', purpose: 'Sick Leave', diagnosis_summary: 'Acute upper respiratory infection',
  valid_until: null, status: 'issued', created_at: '2026-09-02T10:30:00+08:00', updated_at: '2026-09-02T10:30:00+08:00',
}];
