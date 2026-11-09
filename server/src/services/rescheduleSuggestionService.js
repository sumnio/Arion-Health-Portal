import { addDays, appointmentLocalParts, clinicDate } from '../utils/schedulingTime.js';

const DEFAULT_LIMIT = 5;

function minutes(value) {
  const [hour, minute] = value.split(':').map(Number);
  return (hour * 60) + minute;
}

export function createRescheduleSuggestionService({ bookingAvailabilityService, now = () => new Date() }) {
  return Object.freeze({
    timeZone: bookingAvailabilityService?.timeZone ?? 'Asia/Manila',
    async suggest(doctorId, originalAppointmentAt, limit = DEFAULT_LIMIT) {
      if (!bookingAvailabilityService) return [];
      const timeZone = bookingAvailabilityService.timeZone ?? 'Asia/Manila';
      const current = now();
      const today = clinicDate(current, timeZone);
      const original = appointmentLocalParts(originalAppointmentAt, timeZone);
      const firstDate = original.date > today ? original.date : today;
      const horizon = addDays(today, 14);
      const originalMinutes = minutes(original.time);
      const candidates = [];

      for (let date = firstDate; date <= horizon; date = addDays(date, 1)) {
        const slots = await bookingAvailabilityService.getAvailableSlots(doctorId, date);
        for (const slot of slots) {
          if (!slot.available || new Date(slot.appointment_at) <= current) continue;
          if (date === original.date && new Date(slot.appointment_at) <= new Date(originalAppointmentAt)) continue;
          candidates.push({
            date,
            start_time: slot.start_time,
            end_time: slot.end_time,
            appointment_at: slot.appointment_at,
            day_distance: Math.round((new Date(`${date}T00:00:00Z`) - new Date(`${firstDate}T00:00:00Z`)) / 86400000),
            time_distance: Math.abs(minutes(slot.start_time) - originalMinutes),
          });
        }
      }

      return candidates
        .sort((left, right) => left.day_distance - right.day_distance || left.time_distance - right.time_distance || left.appointment_at.localeCompare(right.appointment_at))
        .slice(0, limit)
        .map(({ day_distance: _day, time_distance: _time, ...slot }) => slot);
    },
  });
}
