// Operational additions to the shared Doctor Dashboard's 10 AM mock snapshot.
// Relative times are fixture metadata, converted to Appointment timestamps by the service.
export const staffQueueFixtures = [
  { id: '90000000-0000-4000-8000-000000000001', patient_id: '10000000-0000-4000-8000-000000000004', time: '10:00', checkedIn: '09:50', priority: 'urgent' },
  { id: '90000000-0000-4000-8000-000000000002', patient_id: '10000000-0000-4000-8000-000000000003', time: '10:30', checkedIn: '09:40', priority: 'normal' },
  { id: '90000000-0000-4000-8000-000000000003', patient_id: '10000000-0000-4000-8000-000000000005', time: '11:00', checkedIn: '09:45', priority: 'normal' },
  { id: '90000000-0000-4000-8000-000000000004', patient_id: '10000000-0000-4000-8000-000000000001', time: '11:30', checkedIn: '09:35', priority: 'normal' },
];
