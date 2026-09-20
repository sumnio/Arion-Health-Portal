// Session-only overrides shared by Staff operational views. Reload resets the preview.
const statuses = new Map();
const checkIns = new Map();
const key = item => item.appointment_at + '/' + item.id;
export function staffAppointmentStatus(item) { return statuses.get(key(item)) ?? item.status; }
export function setStaffAppointmentStatus(item, status) { statuses.set(key(item), status); }
export function staffCheckIn(item) { return checkIns.get(key(item)) ?? item.check_in_at; }
export function setStaffCheckIn(item, time) { checkIns.set(key(item), time); }
