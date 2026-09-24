import { doctorAvailabilityRepository } from '../repositories/doctorAvailabilityRepository.js';
import { appointmentRepository, DEMO_DOCTOR_ID } from '../repositories/appointmentRepository.js';
import { createMockId } from '../repositories/mockId.js';

export const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):(?:00|30)$/;
const doctorAvailabilityStore = doctorAvailabilityRepository.recurring;
const doctorPublishedAvailabilityStore = doctorAvailabilityRepository.published;
const doctorBlockedTimeStore = doctorAvailabilityRepository.blocked;
const clone = value => structuredClone(value);
const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const timeFromMinutes = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
function validDate(value) {
  if (!datePattern.test(value ?? '')) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function clinicDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}
function addDays(date, amount) {
  const value = new Date(date + 'T00:00:00Z');
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
function rangeError(start, end) {
  if (!timePattern.test(start ?? '') || !timePattern.test(end ?? '')) return 'Use 30-minute time boundaries.';
  if (minutes(start) >= minutes(end)) return 'End time must be later than start time.';
  return null;
}
function overlaps(start, end, itemStart, itemEnd) { return start < itemEnd && end > itemStart; }
function slotTimestamp(date, time) { return new Date(`${date}T${time}:00+08:00`); }

export const doctorAvailabilityService = {
  publicationWindow(now = new Date()) {
    const start = clinicDate(now);
    return { start, end: addDays(start, 30) };
  },
  get(doctorId = DEMO_DOCTOR_ID) {
    return clone({
      recurring: doctorAvailabilityStore.filter(item => item.doctor_id === doctorId).sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)),
      published: doctorPublishedAvailabilityStore.filter(item => item.doctor_id === doctorId).sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)),
      blocked: doctorBlockedTimeStore.filter(item => item.doctor_id === doctorId).sort((a, b) => new Date(a.start_at) - new Date(b.start_at)),
    });
  },
  setDayActive(day, active, doctorId = DEMO_DOCTOR_ID) {
    const ranges = doctorAvailabilityStore.filter(item => item.doctor_id === doctorId && item.day_of_week === day);
    if (!ranges.length) return { error: 'Add a recurring range before enabling this day.' };
    ranges.forEach(item => { item.is_active = active; });
    return { recurring: clone(ranges) };
  },
  addRecurring({ day_of_week, start_time, end_time }, doctorId = DEMO_DOCTOR_ID) {
    const day = Number(day_of_week);
    if (!Number.isInteger(day) || day < 0 || day > 6) return { error: 'Select a valid day.' };
    const error = rangeError(start_time, end_time);
    if (error) return { error };
    const overlap = doctorAvailabilityStore.some(item => item.doctor_id === doctorId && item.day_of_week === day && overlaps(start_time, end_time, item.start_time, item.end_time));
    if (overlap) return { error: 'Recurring ranges for the same day cannot overlap.' };
    const item = { id: createMockId(), doctor_id: doctorId, day_of_week: day, start_time, end_time, is_active: true };
    doctorAvailabilityStore.push(item);
    return { recurring: clone(item) };
  },
  removeRecurring(id, doctorId = DEMO_DOCTOR_ID) {
    const index = doctorAvailabilityStore.findIndex(item => item.id === id && item.doctor_id === doctorId);
    if (index < 0) return { error: 'Recurring availability not found.' };
    return { recurring: clone(doctorAvailabilityStore.splice(index, 1)[0]) };
  },
  publish({ date, start_time, end_time }, doctorId = DEMO_DOCTOR_ID, now = new Date()) {
    const window = this.publicationWindow(now);
    if (!validDate(date) || date < window.start || date > window.end) return { error: 'Published dates must be from today through the next 30 days.' };
    const error = rangeError(start_time, end_time);
    if (error) return { error };
    const day = new Date(date + 'T00:00:00Z').getUTCDay();
    const withinTemplate = doctorAvailabilityStore.some(item => item.doctor_id === doctorId && item.day_of_week === day && item.is_active && start_time >= item.start_time && end_time <= item.end_time);
    if (!withinTemplate) return { error: 'Publish a range that fits within an active recurring range for this day.' };
    const overlap = doctorPublishedAvailabilityStore.some(item => item.doctor_id === doctorId && item.date === date && overlaps(start_time, end_time, item.start_time, item.end_time));
    if (overlap) return { error: 'Published ranges for the same date cannot overlap.' };
    const item = { id: createMockId(), doctor_id: doctorId, date, start_time, end_time };
    doctorPublishedAvailabilityStore.push(item);
    return { published: clone(item) };
  },
  removePublished(id, doctorId = DEMO_DOCTOR_ID) {
    const index = doctorPublishedAvailabilityStore.findIndex(item => item.id === id && item.doctor_id === doctorId);
    if (index < 0) return { error: 'Published availability not found.' };
    return { published: clone(doctorPublishedAvailabilityStore.splice(index, 1)[0]) };
  },
  addBlocked({ date, whole_day, start_time, end_time, reason }, doctorId = DEMO_DOCTOR_ID, now = new Date()) {
    const window = this.publicationWindow(now);
    if (!validDate(date) || date < window.start || date > window.end) return { error: 'Blocked dates must be from today through the next 30 days.' };
    if (!reason?.trim()) return { error: 'Enter a reason for the blocked time.' };
    if (!whole_day) {
      const error = rangeError(start_time, end_time);
      if (error) return { error };
    }
    const start_at = whole_day ? `${date}T00:00:00+08:00` : `${date}T${start_time}:00+08:00`;
    const end_at = whole_day ? `${addDays(date, 1)}T00:00:00+08:00` : `${date}T${end_time}:00+08:00`;
    const item = { id: createMockId(), doctor_id: doctorId, start_at, end_at, reason: reason.trim() };
    doctorBlockedTimeStore.push(item);
    return { blocked: clone(item) };
  },
  removeBlocked(id, doctorId = DEMO_DOCTOR_ID) {
    const index = doctorBlockedTimeStore.findIndex(item => item.id === id && item.doctor_id === doctorId);
    if (index < 0) return { error: 'Blocked time not found.' };
    return { blocked: clone(doctorBlockedTimeStore.splice(index, 1)[0]) };
  },
  getSlots(doctorId, date, now = new Date()) {
    if (!validDate(date)) return [];
    const ranges = doctorPublishedAvailabilityStore.filter(item => item.doctor_id === doctorId && item.date === date);
    const blocks = doctorBlockedTimeStore.filter(item => item.doctor_id === doctorId);
    const seen = new Set();
    return ranges.flatMap(range => {
      const slots = [];
      for (let value = minutes(range.start_time); value + 30 <= minutes(range.end_time); value += 30) {
        const time = timeFromMinutes(value);
        if (seen.has(time)) continue;
        seen.add(time);
        const start = slotTimestamp(date, time);
        const end = new Date(start.getTime() + 30 * 60 * 1000);
        const blocked = blocks.some(item => start < new Date(item.end_at) && end > new Date(item.start_at));
        const occupied = appointmentRepository.isSlotOccupied(doctorId, date, time, now);
        slots.push({ time, available: !blocked && !occupied && start > now, blocked, occupied });
      }
      return slots;
    }).sort((a, b) => a.time.localeCompare(b.time));
  },
};
