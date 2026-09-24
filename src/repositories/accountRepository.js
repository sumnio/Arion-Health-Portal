import { adminUserProfileStore } from '../mocks/adminUserProfileStore.js';
import { adminDoctorStore } from '../mocks/adminDoctorStore.js';
import { adminStaffStore } from '../mocks/adminStaffStore.js';

const repository = store => ({ list: () => store, get: id => store.find(item => item.id === id) ?? null, add: item => { store.push(item); return item; } });
export const userProfileRepository = repository(adminUserProfileStore);
export const doctorRepository = repository(adminDoctorStore);
export const staffRepository = repository(adminStaffStore);

