import { exampleIds } from './portalData.js';

// Reuse the existing record-linked certificate without changing record pages.
export const medicalCertificates = [
  {
    id: exampleIds.certificate, medical_certificate_number: 'MC-MOCK-20260902-001', patient_id: exampleIds.patient,
    doctor_id: '50000000-0000-4000-8000-000000000001', medical_record_id: exampleIds.record,
    date_issued: '2026-09-02', purpose: 'Sick Leave', diagnosis_summary: 'Acute upper respiratory infection',
    valid_until: null, status: 'issued', created_at: '2026-09-02T10:30:00+08:00', updated_at: '2026-09-02T10:30:00+08:00',
  },
  {
    id: '40000000-0000-4000-8000-000000000002', medical_certificate_number: 'MC-MOCK-20260612-001', patient_id: exampleIds.patient,
    doctor_id: '50000000-0000-4000-8000-000000000002', medical_record_id: null,
    purpose: 'Fit to Work', diagnosis_summary: 'Routine health assessment completed; no acute concerns noted in this mock assessment.',
    date_issued: '2026-06-12', valid_until: '2026-06-19', status: 'issued',
    created_at: '2026-06-12T10:00:00+08:00', updated_at: '2026-06-12T10:00:00+08:00',
  },
  {
    id: '40000000-0000-4000-8000-000000000003', medical_certificate_number: 'MC-MOCK-20260903-001', patient_id: exampleIds.patient,
    doctor_id: '50000000-0000-4000-8000-000000000001', medical_record_id: null,
    purpose: 'Sick Leave', diagnosis_summary: 'Draft awaiting review.',
    date_issued: null, valid_until: null, status: 'draft',
    created_at: '2026-09-03T10:00:00+08:00', updated_at: '2026-09-03T10:00:00+08:00',
  },
];
