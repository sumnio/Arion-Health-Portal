import { exampleIds } from './portalData.js';
import { appointmentStatus } from './staffAppointmentStore.js';

// In-memory fixtures for one demo patient. Service is presentation metadata,
// not a proposed database field. Refreshing restores this sample snapshot.
const fixture = (suffix, appointment_at, status, service, reason, doctor = '1', prefix = '20000000') => ({
  id: `${prefix}-0000-4000-8000-${suffix.padStart(12, '0')}`,
  patient_id: exampleIds.patient,
  doctor_id: `50000000-0000-4000-8000-${doctor.padStart(12, '0')}`,
  appointment_at, status, service, reason, check_in_at: null,
});
export const appointmentStore = [
  fixture('11', '2026-09-24T15:30:00+08:00', 'confirmed', 'Check-up', 'Check-up', '3', '70000000'),
  fixture('2', '2026-09-02T10:00:00+08:00', 'completed', 'General Consultation', 'Follow-up on recovery'),
  fixture('3', '2026-09-28T09:00:00+08:00', 'pending', 'Follow-up', 'Routine follow-up', '2'),
  fixture('4', '2026-08-20T14:00:00+08:00', 'cancelled', 'General Consultation', 'Annual wellness visit', '2'),
  fixture('5', '2026-08-14T09:00:00+08:00', 'no_show', 'General Consultation', ''),
];

export function slotOccupied(doctorId, date, time) {
  const timestamp = new Date(`${date}T${time}:00+08:00`).getTime();
  return appointmentStore.some(item => item.doctor_id === doctorId
    && appointmentStatus(item) !== 'cancelled' && appointmentStatus(item) !== 'no_show'
    && new Date(item.appointment_at).getTime() === timestamp);
}
