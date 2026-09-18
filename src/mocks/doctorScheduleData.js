// Relative-day fixtures supplement the shared dashboard snapshot.
export const doctorScheduleExtras = [
  { id: '70000000-0000-4000-8000-000000000006', patient_id: '10000000-0000-4000-8000-000000000002', dayOffset: -1, time: '09:00', status: 'completed', reason: 'Follow-up consultation' },
  { id: '70000000-0000-4000-8000-000000000007', patient_id: '10000000-0000-4000-8000-000000000003', dayOffset: -1, time: '10:00', status: 'cancelled', reason: 'Routine check-up' },
  { id: '70000000-0000-4000-8000-000000000008', patient_id: '10000000-0000-4000-8000-000000000005', dayOffset: -1, time: '13:00', status: 'no_show', reason: 'General consultation' },
  { id: '70000000-0000-4000-8000-000000000009', patient_id: '10000000-0000-4000-8000-000000000004', dayOffset: 1, time: '09:30', status: 'confirmed', reason: 'Follow-up consultation' },
  { id: '70000000-0000-4000-8000-000000000010', patient_id: '10000000-0000-4000-8000-000000000001', dayOffset: 1, time: '14:00', status: 'pending', reason: 'General consultation' },
];
