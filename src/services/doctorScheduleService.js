import { appointmentRepository, DEMO_DOCTOR_ID } from '../repositories/appointmentRepository.js';
import { patientRepository } from '../repositories/patientRepository.js';
import { formatSlot } from './bookingService.js';

export function shiftScheduleDate(date, offset) { const result = new Date(date + 'T00:00:00Z'); result.setUTCDate(result.getUTCDate() + offset); return result.toISOString().slice(0, 10); }
export const doctorScheduleService = { getDay(date, now = new Date()) {
  return appointmentRepository.list(now).filter(item => item.doctor_id === DEMO_DOCTOR_ID && item.appointment_at.slice(0,10) === date).map(item => ({ ...item, timeLabel: formatSlot(item.appointment_at.slice(11,16)), patientName: patientRepository.get(item.patient_id)?.full_name ?? 'Patient unavailable', patientPath: '/doctor/patients/' + item.patient_id })).sort((a,b)=>new Date(a.appointment_at)-new Date(b.appointment_at));
} };
