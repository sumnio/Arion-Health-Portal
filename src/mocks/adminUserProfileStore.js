const createdAt = '2026-09-01T08:00:00.000Z';

// Canonical account profiles for the Admin mock. Role-specific stores keep
// only fields owned by Doctor or Staff.
export const adminUserProfileStore = [
  {
    id: '11000000-0000-4000-8000-000000000001',
    display_name: 'Demo Patient',
    contact_number: '0917 123 4567',
    role: 'patient',
    status: 'active',
    created_at: '2026-07-12T08:00:00.000Z',
    updated_at: '2026-07-12T08:00:00.000Z',
  },
  {
    id: '11000000-0000-4000-8000-000000000002',
    display_name: 'Ana Reyes',
    contact_number: '0917 555 0102',
    role: 'patient',
    status: 'active',
    created_at: '2026-08-03T08:00:00.000Z',
    updated_at: '2026-08-03T08:00:00.000Z',
  },
  {
    id: '11000000-0000-4000-8000-000000000004',
    display_name: 'Liza Fernandez',
    contact_number: '0917 555 0104',
    role: 'patient',
    status: 'inactive',
    created_at: '2026-06-18T08:00:00.000Z',
    updated_at: '2026-09-10T08:00:00.000Z',
  },
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
