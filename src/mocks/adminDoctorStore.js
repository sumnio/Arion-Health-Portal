import { bookingDoctors } from './bookingData.js';
import { demoDoctor } from './doctorRecordStore.js';

// Account-management copies: editing these never rewrites historical clinical data.
export const adminDoctorStore = [
  ...bookingDoctors.map(({ id, name, specialty }) => ({ id, display_name: name, specialty, role: 'doctor' })),
  { id: demoDoctor.id, display_name: demoDoctor.display_name, specialty: '', role: 'doctor' },
];
