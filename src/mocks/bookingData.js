// UI-only catalog and recurring mock availability; no schema changes.
export const visitTypes = [
  { id: 'consultation', name: 'General Consultation' },
  { id: 'follow-up', name: 'Follow-up Consultation' },
];

// Frontend scheduling fixtures only; weekday numbers use Sunday = 0.
export const mockDoctorAvailability = {
  '50000000-0000-4000-8000-000000000001': { weekdays: [1, 2, 3, 5, 6], blockedDates: ['2026-09-23'], fullyBookedDates: ['2026-09-26'] },
  '50000000-0000-4000-8000-000000000002': { weekdays: [1, 2, 4, 5, 6], blockedDates: ['2026-09-25'], fullyBookedDates: ['2026-09-29'] },
};
export const bookingDoctors = [
  { id: '50000000-0000-4000-8000-000000000001', name: 'Dr. Maria Santos', specialty: 'General Medicine', morning: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30'], afternoon: ['13:00', '13:30', '14:00', '14:30'] },
  { id: '50000000-0000-4000-8000-000000000002', name: 'Dr. Carlo Reyes', specialty: 'Family Medicine', morning: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'], afternoon: ['14:00', '14:30', '15:00', '15:30'] },
];
