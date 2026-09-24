import { visitTypes } from '../mocks/bookingData.js';
import { appointmentRepository } from '../repositories/appointmentRepository.js';
import { exampleIds } from '../mocks/portalData.js';
import { doctorAvailabilityService } from './doctorAvailabilityService.js';
import { doctorProfileService } from './doctorProfileService.js';
import { toDoctorOption } from './adapters/domainAdapters.js';

// Session-memory occupancy only. Reloading clears mock confirmations.
export const clinicTimeZone = 'Asia/Manila';
export function clinicToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: clinicTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function bookingWindow(now = new Date()) {
  const start = clinicToday(now);
  const end = new Date(start + 'T00:00:00Z');
  end.setUTCDate(end.getUTCDate() + 14);
  return { start, end: end.toISOString().slice(0, 10) };
}
export function formatBookingDate(value) {
  return validDate(value) ? new Date(value + 'T00:00:00+08:00').toLocaleDateString('en-US', { timeZone: clinicTimeZone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Not selected';
}
export function formatSlot(time) {
  const [hour, minute] = time.split(':').map(Number);
  return (hour % 12 || 12) + ':' + String(minute).padStart(2, '0') + (hour < 12 ? ' AM' : ' PM');
}
export function slotRange(time) {
  const [hour, minute] = time.split(':').map(Number);
  const end = hour * 60 + minute + 30;
  return formatSlot(time) + ' – ' + formatSlot(String(Math.floor(end / 60)).padStart(2, '0') + ':' + String(end % 60).padStart(2, '0'));
}
export const bookingService = {
  getOptions() {
    return { services: structuredClone(visitTypes), doctors: doctorProfileService.list({ activeOnly: true }).map(toDoctorOption) };
  },
  getSlots(doctorId, date, now = new Date()) {
    const doctor = doctorProfileService.get(doctorId);
    const window = bookingWindow(now);
    if (!doctor || !validDate(date) || date < window.start || date > window.end) return [];
    return doctorAvailabilityService.getSlots(doctorId, date, now);
  },
  isDateAvailable(doctorId, date, now = new Date()) {
    return this.getSlots(doctorId, date, now).some(slot => slot.available);
  },
  validate(values, now = new Date()) {
    const errors = {};
    if (!visitTypes.some(item => item.id === values.service)) errors.service = 'Select a visit type.';
    if (!doctorProfileService.list({ activeOnly: true }).some(item => item.id === values.doctor)) errors.doctor = 'Select a doctor.';
    if (!this.isDateAvailable(values.doctor, values.date, now)) errors.date = 'Select an available date from today through the next 14 days.';
    if (!values.time) errors.time = 'Select an available time slot.';
    else if (!this.getSlots(values.doctor, values.date, now).some(slot => slot.time === values.time && slot.available)) errors.time = 'That time is no longer available. Select another slot.';
    if (!values.reason?.trim()) errors.reason = 'Enter a reason for your visit.';
    return errors;
  },
  confirm(values) {
    const errors = this.validate(values);
    if (Object.keys(errors).length) return { errors };
    // Validation and reservation are synchronous so repeat submissions cannot claim the same slot.
    const appointment = appointmentRepository.create({ patient_id: exampleIds.patient, doctor_id: values.doctor,
      appointment_at: `${values.date}T${values.time}:00+08:00`, check_in_at: null,
      service: visitTypes.find(item => item.id === values.service).name, reason: values.reason.trim(), status: 'confirmed', priority: 'normal',
    });
    return { confirmation: {
      id: appointment.id,
      service: visitTypes.find(item => item.id === values.service).name,
      doctor: doctorProfileService.get(values.doctor).display_name,
      date: values.date, time: values.time, reason: values.reason.trim(), status: 'confirmed',
    } };
  },
};
