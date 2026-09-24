import { appointmentRepository, DEMO_DOCTOR_ID } from '../repositories/appointmentRepository.js';
import { patientRepository } from '../repositories/patientRepository.js';
import { portalService } from './portalService.js';
import { clinicToday, formatSlot } from './bookingService.js';

function present(item) {
  const patient = patientRepository.get(item.patient_id);
  return { ...item, timeLabel: formatSlot(item.appointment_at.slice(11, 16)), patientName: patient?.full_name ?? 'Patient unavailable', patientPath: '/doctor/patients/' + item.patient_id };
}
export const doctorDashboardService = { getDashboard(now = new Date()) {
  const date = clinicToday(now);
  const appointments = appointmentRepository.list(now).filter(item => item.doctor_id === DEMO_DOCTOR_ID && item.appointment_at.slice(0, 10) === date).map(present).sort((a,b) => new Date(a.appointment_at)-new Date(b.appointment_at));
  const upcoming = appointments.filter(item => ['pending','confirmed'].includes(item.status) && new Date(item.appointment_at) >= new Date(`${date}T10:00:00+08:00`));
  return { profile: portalService.getPreviewProfile('doctor'), date, appointments, upcoming, nextPatient: upcoming.find(item => item.status === 'confirmed') ?? null, total: appointments.length, completed: appointments.filter(item => item.status === 'completed').length };
} };
