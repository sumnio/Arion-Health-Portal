import { adminStaffStore } from '../mocks/adminStaffStore.js';

function fields(input, id) {
  const display_name = String(input.display_name ?? '').trim();
  const username = String(input.username ?? '').trim() || null;
  if (!display_name) throw new Error('Staff name is required.');
  if (username && adminStaffStore.some(s => s.id !== id && s.username?.toLowerCase() === username.toLowerCase())) {
    throw new Error('This username is already used by another staff account.');
  }
  return { display_name, username };
}

export const adminStaffService = {
  list(search = '') {
    const query = search.trim().toLowerCase();
    return adminStaffStore.filter(s => `${s.display_name} ${s.username ?? ''}`.toLowerCase().includes(query)).map(s => ({ ...s }));
  },
  get(id) { const staff = adminStaffStore.find(s => s.id === id); return staff ? { ...staff } : null; },
  create(input) {
    const staff = { ...fields(input), id: crypto.randomUUID(), role: 'staff' };
    adminStaffStore.push(staff);
    return { ...staff };
  },
  update(id, input) {
    const staff = adminStaffStore.find(s => s.id === id);
    if (!staff) throw new Error('Staff account not found.');
    Object.assign(staff, fields(input, id));
    return { ...staff };
  },
};
