// Relative times form a demo snapshot at 10:00 AM on the displayed clinic day.
export const doctorDashboardAppointments = [
  { id: '70000000-0000-4000-8000-000000000001', patient_id: '10000000-0000-4000-8000-000000000001', time: '09:00', status: 'completed', reason: 'General consultation' },
  { id: '70000000-0000-4000-8000-000000000002', patient_id: '10000000-0000-4000-8000-000000000002', time: '09:30', status: 'completed', reason: 'Follow-up consultation' },
  { id: '70000000-0000-4000-8000-000000000003', patient_id: '10000000-0000-4000-8000-000000000003', time: '13:00', status: 'confirmed', reason: 'Routine check-up' },
  { id: '70000000-0000-4000-8000-000000000004', patient_id: '10000000-0000-4000-8000-000000000004', time: '14:30', status: 'pending', reason: 'Follow-up consultation' },
  { id: '70000000-0000-4000-8000-000000000005', patient_id: '10000000-0000-4000-8000-000000000005', time: '16:00', status: 'confirmed', reason: 'General consultation' },
];
// Display-name lookup for mock patient/profile joins, not Patient schema fields.
export const doctorDashboardPatientNames = {
  '10000000-0000-4000-8000-000000000001': 'Demo Patient',
  '10000000-0000-4000-8000-000000000002': 'Ana Reyes',
  '10000000-0000-4000-8000-000000000003': 'Carlos Mendoza',
  '10000000-0000-4000-8000-000000000004': 'Liza Fernandez',
  '10000000-0000-4000-8000-000000000005': 'Robert Lim',
};
