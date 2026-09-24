import { doctorDashboardService } from './doctorDashboardService.js';
import { doctorPatient } from '../mocks/doctorPatientData.js';
import { doctorScheduleExtras } from '../mocks/doctorScheduleData.js';
import { clinicToday, formatSlot } from './bookingService.js';

export function shiftScheduleDate(date, offset) {
  const result = new Date(date + 'T00:00:00Z');
  result.setUTCDate(result.getUTCDate() + offset);
  return result.toISOString().slice(0, 10);
}
export const doctorScheduleService = {
  getDay(date, now = new Date()) {
    const today = clinicToday(now);
    if (date === today) return doctorDashboardService.getDashboard(now).appointments;
    return doctorScheduleExtras.filter(item => shiftScheduleDate(today, item.dayOffset) === date)
      .map(({ dayOffset, time, ...item }) => ({ ...item, appointment_at: `${date}T${time}:00+08:00`,
        timeLabel: formatSlot(time), patientName: doctorPatient(item.patient_id)?.full_name ?? 'Patient unavailable',
        patientPath: '/doctor/patients/' + item.patient_id,
      })).sort((a, b) => new Date(a.appointment_at) - new Date(b.appointment_at));
  },
};
