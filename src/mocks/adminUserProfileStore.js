const createdAt = '2026-09-01T08:00:00.000Z';

// Canonical account profiles for the Admin mock. Role-specific stores keep
// only fields owned by Doctor or Staff.
export const adminUserProfileStore = [
  {
    id: '50000000-0000-4000-8000-000000000001',
    display_name: 'Dr. Maria Santos',
    contact_number: '0917 555 0201',
    role: 'doctor',
    status: 'active',
    created_at: createdAt,
    updated_at: createdAt,
  },
  {
    id: '50000000-0000-4000-8000-000000000002',
    display_name: 'Dr. Carlo Reyes',
    contact_number: '0917 555 0202',
    role: 'doctor',
    status: 'active',
    created_at: createdAt,
    updated_at: createdAt,
  },
  {
    id: '50000000-0000-4000-8000-000000000003',
    display_name: 'Demo Doctor',
    contact_number: '0917 555 0203',
    role: 'doctor',
    status: 'active',
    created_at: createdAt,
    updated_at: createdAt,
  },
  {
    id: '60000000-0000-4000-8000-000000000001',
    display_name: 'Demo Staff',
    contact_number: '0917 555 0301',
    role: 'staff',
    status: 'active',
    created_at: createdAt,
    updated_at: createdAt,
  },
];
