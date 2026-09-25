import { httpError } from '../utils/httpError.js';
import {
  addDays,
  appointmentLocalParts,
  clinicDate,
  dateOnlyToUtc,
  minutes,
  SLOT_MS,
  timeFromMinutes,
  zonedDateTimeToUtc,
} from '../utils/schedulingTime.js';
import { validateSlotQuery } from '../validation/schedulingValidation.js';

function slotKey(value) { return new Date(value).getTime(); }

export function createBookingAvailabilityService({ repository, clinic, now = () => new Date() }) {
  async function getAvailableSlots(doctorId, date) {
    validateSlotQuery(date, doctorId);
    if (!(await repository.doctorExists(doctorId))) {
      throw httpError(404, 'DOCTOR_NOT_FOUND', 'Doctor was not found.');
    }
    const current = now();
    const today = clinicDate(current, clinic.timeZone);
    if (date < today || date > addDays(today, 14)) return [];

    const published = await repository.listPublishedForDate(doctorId, dateOnlyToUtc(date));
    if (!published.length) return [];
    const dayStart = zonedDateTimeToUtc(date, '00:00', clinic.timeZone);
    const dayEnd = zonedDateTimeToUtc(addDays(date, 1), '00:00', clinic.timeZone);
    const [blocks, appointments] = await Promise.all([
      repository.listBlocksOverlapping(doctorId, dayStart, dayEnd),
      repository.listActiveAppointmentsBetween(doctorId, dayStart, dayEnd),
    ]);
    const occupied = new Set(appointments.map((item) => slotKey(item.appointment_at)));
    const seen = new Set();
    const result = [];

    for (const range of published) {
      for (let value = minutes(range.start_time); value + 30 <= minutes(range.end_time); value += 30) {
        const startTime = timeFromMinutes(value);
        const endTime = timeFromMinutes(value + 30);
        if (seen.has(startTime)) continue;
        seen.add(startTime);
        if (clinic.openTime && (startTime < clinic.openTime || endTime > clinic.closeTime)) continue;
        const start = zonedDateTimeToUtc(date, startTime, clinic.timeZone);
        const end = new Date(start.getTime() + SLOT_MS);
        if (start <= current) continue;
        if (occupied.has(start.getTime())) continue;
        if (blocks.some((item) => start < new Date(item.end_at) && end > new Date(item.start_at))) continue;
        result.push({ start_time: startTime, end_time: endTime, appointment_at: start.toISOString() });
      }
    }
    return result.sort((left, right) => left.appointment_at.localeCompare(right.appointment_at));
  }

  return {
    timeZone: clinic.timeZone,
    getAvailableSlots,
    async getPatientSlots(doctorId, date) {
      return { doctor_id: doctorId, date, slots: await getAvailableSlots(doctorId, date) };
    },
    async assertBookable(doctorId, appointmentAt) {
      const local = appointmentLocalParts(appointmentAt, clinic.timeZone);
      const slots = await getAvailableSlots(doctorId, local.date);
      if (!slots.some((slot) => new Date(slot.appointment_at).getTime() === new Date(appointmentAt).getTime())) {
        throw httpError(409, 'APPOINTMENT_SLOT_UNAVAILABLE', 'That appointment slot is not available.');
      }
    },
  };
}
