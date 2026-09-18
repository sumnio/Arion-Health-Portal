import { appointmentStore } from '../mocks/appointmentStore.js';
import { bookingDoctors } from '../mocks/bookingData.js';
import { bookingService, clinicToday, slotRange } from './bookingService.js';

export function canManageAppointment(item, now = new Date()) {
  return !!item && ['pending', 'confirmed'].includes(item.status)
    && !item.check_in_at && new Date(item.appointment_at) > now;
}
function present(item) {
  const doctor = bookingDoctors.find(doctor => doctor.id === item.doctor_id);
  const time = new Date(item.appointment_at).toLocaleTimeString('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' });
  return { ...item, doctor: doctor?.name ?? 'Doctor unavailable', specialty: doctor?.specialty,
    date: clinicToday(new Date(item.appointment_at)), time, timeLabel: slotRange(time), location: 'Arion Health Clinic' };
}
export const appointmentService = {
  list() { return appointmentStore.map(present).sort((a, b) => new Date(a.appointment_at) - new Date(b.appointment_at)); },
  get(id) { const item = appointmentStore.find(item => item.id === id); return item ? present(item) : null; },
  cancel(id) {
    const item = appointmentStore.find(item => item.id === id);
    if (!canManageAppointment(item)) return { error: 'This appointment can no longer be cancelled.' };
    item.status = 'cancelled';
    return { appointment: present(item) };
  },
  reschedule(id, date, time) {
    const item = appointmentStore.find(item => item.id === id);
    if (!canManageAppointment(item)) return { error: 'This appointment can no longer be rescheduled.' };
    if (!bookingService.getSlots(item.doctor_id, date).some(slot => slot.time === time && slot.available)) {
      return { error: 'Select an available date and time. That slot may no longer be available.' };
    }
    item.appointment_at = `${date}T${time}:00+08:00`;
    return { appointment: present(item) };
  },
};
