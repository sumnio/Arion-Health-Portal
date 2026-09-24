// Doctor-owned profile fields only. Shared account data is held in
// adminUserProfileStore and joined by the service layer.
export const adminDoctorStore = [
  {
    id: '50000000-0000-4000-8000-000000000001',
    specialty: 'General Medicine',
    license_number: 'PRC-0123456',
    ptr_number: 'PTR-2026-1001',
    signature_path: 'signatures/doctor-maria-santos.png',
  },
  {
    id: '50000000-0000-4000-8000-000000000002',
    specialty: 'Family Medicine',
    license_number: 'PRC-0234567',
    ptr_number: 'PTR-2026-1002',
    signature_path: 'signatures/doctor-carlo-reyes.png',
  },
  {
    id: '50000000-0000-4000-8000-000000000003',
    specialty: 'General Medicine',
    license_number: 'PRC-0345678',
    ptr_number: 'PTR-2026-1003',
    signature_path: 'signatures/demo-doctor.png',
  },
];
