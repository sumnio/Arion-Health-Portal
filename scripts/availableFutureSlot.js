import { bookingService, clinicToday } from '../src/services/bookingService.js';
export function availableFutureSlot(offset = 2) {
  const doctor = bookingService.getOptions().doctors[0].id;
  for (let days = offset; days <= 60; days++) {
    const date = new Date(clinicToday() + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + days);
    const day = date.toISOString().slice(0, 10);
    const slot = bookingService.getSlots(doctor, day).find(item => item.available);
    if (slot) return { date: day, doctor, time: slot.time };
  }
  throw new Error('No available future mock slot for test');
}
