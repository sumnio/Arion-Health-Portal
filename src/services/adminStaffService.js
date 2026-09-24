import { adminStaffStore } from '../mocks/adminStaffStore.js';
import { adminUserProfileStore } from '../mocks/adminUserProfileStore.js';

function fields(input) {
  const display_name = String(input.display_name ?? '').trim();
  const contact_number = String(input.contact_number ?? '').trim();
  if (!display_name || !contact_number) throw new Error('Staff name and contact number are required.');
  return { display_name, contact_number };
}

function joinedStaff(staff) {
  const profile = adminUserProfileStore.find(item => item.id === staff.id && item.role === 'staff');
  return profile ? { ...profile } : null;
}

function findStaff(id) {
  return adminStaffStore.find(staff => staff.id === id);
}

function changeStatus(id, status) {
  if (!['active', 'inactive'].includes(status)) throw new Error('Account status must be active or inactive.');
  const staff = findStaff(id);
  const profile = adminUserProfileStore.find(item => item.id === id && item.role === 'staff');
  if (!staff || !profile) throw new Error('Staff account not found.');
  profile.status = status;
  profile.updated_at = new Date().toISOString();
  return joinedStaff(staff);
}

export const adminStaffService = {
  list(search = '') {
    const query = search.trim().toLowerCase();
    return adminStaffStore.map(joinedStaff).filter(Boolean).filter(staff =>
      `${staff.display_name} ${staff.contact_number} ${staff.status}`.toLowerCase().includes(query)
    );
  },
  get(id) { const staff = findStaff(id); return staff ? joinedStaff(staff) : null; },
  create(input) {
    const values = fields(input);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    adminUserProfileStore.push({
      id,
      ...values,
      role: 'staff',
      status: 'active',
      created_at: now,
      updated_at: now,
    });
    const staff = { id };
    adminStaffStore.push(staff);
    return joinedStaff(staff);
  },
  update(id, input) {
    const staff = findStaff(id);
    const profile = adminUserProfileStore.find(item => item.id === id && item.role === 'staff');
    if (!staff || !profile) throw new Error('Staff account not found.');
    Object.assign(profile, fields(input), { updated_at: new Date().toISOString() });
    return joinedStaff(staff);
  },
  deactivate(id) { return changeStatus(id, 'inactive'); },
  reactivate(id) { return changeStatus(id, 'active'); },
};
