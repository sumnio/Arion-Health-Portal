import { staffDashboardService } from './staffDashboardService.js';
import { doctorScheduleService } from './doctorScheduleService.js';
import { appointmentRepository } from '../repositories/appointmentRepository.js';
import { doctorProfileService } from './doctorProfileService.js';
import { clinicToday } from './bookingService.js';

export function staffActions(item, today = clinicToday()) {
  const active = ['pending', 'confirmed'].includes(item.status);
  const eligible = active && item.appointment_at.slice(0, 10) >= today && !item.check_in_at;
  return { confirm: eligible && item.status === 'pending', cancel: eligible,
    queue: active && item.appointment_at.slice(0, 10) === today };
}
export const staffCalendarService = {
  getDay(date, now = new Date()) {
    const shared = doctorScheduleService.getDay(date, now);
    const items = date === clinicToday(now) ? staffDashboardService.getDashboard(now).appointments
      : shared.map(item => ({ id: item.id, patient_id: item.patient_id, patientName: item.patientName,
        doctor_id: item.doctor_id, doctor: doctorProfileService.get(item.doctor_id)?.display_name ?? 'Doctor unavailable', appointment_at: item.appointment_at,
        timeLabel: item.timeLabel, status: item.status, check_in_at: null }));
    return items.map(item => ({ ...item,
      reason: item.reason ?? shared.find(source => source.id === item.id)?.reason ?? 'General Consultation' }));
  },
  updateStatus(date, id, status, now = new Date()) {
    const item = this.getDay(date, now).find(item => item.id === id);
    if (!item) throw new Error('Appointment not found.');
    const actions = staffActions(item, clinicToday(now));
    if (!(status === 'confirmed' && actions.confirm || status === 'cancelled' && actions.cancel)) {
      throw new Error('This appointment is no longer eligible for that action.');
    }
    appointmentRepository.update(item.id, { status });
  },
};
