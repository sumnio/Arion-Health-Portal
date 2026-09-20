// Session-only overrides shared by Staff operational views. Reload resets the preview.
const statuses = new Map();
export function staffAppointmentStatus(item) {
  return statuses.get(item.appointment_at + '/' + item.id) ?? item.status;
}
export function setStaffAppointmentStatus(item, status) {
  statuses.set(item.appointment_at + '/' + item.id, status);
}
