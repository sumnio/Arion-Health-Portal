import { exampleIds } from './portalData.js';

// Fixed sample snapshot for the dashboard preview, not live appointment data.
export const patientDashboardData = {
  nextAppointment: {
    id: exampleIds.appointment,
    patient_id: exampleIds.patient,
    doctor_id: '50000000-0000-4000-8000-000000000001',
    appointment_at: '2026-09-25T10:00:00+08:00',
    status: 'confirmed',
    reason: 'General Consultation',
  },
  recentRecord: {
    id: exampleIds.record,
    patient_id: exampleIds.patient,
    doctor_id: '50000000-0000-4000-8000-000000000001',
    appointment_id: '20000000-0000-4000-8000-000000000002',
    encounter_at: '2026-09-02T10:00:00+08:00',
    diagnosis: 'Acute upper respiratory infection',
    notes: 'Rest and hydration discussed during consultation.',
    follow_up: null,
  },
  doctor: { display_name: 'Dr. Maria Santos' },
};

