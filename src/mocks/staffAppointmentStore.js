// Session-only Appointment state shared by Patient, Doctor, and Staff views.
// Reloading the application resets this mock preview state.
const statuses = new Map();
const checkIns = new Map();
const key = item => item.id;
export function appointmentStatus(item) { return statuses.get(key(item)) ?? item.status; }
export function setAppointmentStatus(item, status) { statuses.set(key(item), status); }
export function appointmentCheckIn(item) { return checkIns.get(key(item)) ?? item.check_in_at; }
export function setAppointmentCheckIn(item, time) { checkIns.set(key(item), time); }
