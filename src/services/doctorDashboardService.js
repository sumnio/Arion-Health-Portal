import { doctorDashboardAppointments } from '../mocks/doctorDashboardData.js';
import { doctorPatient } from '../mocks/doctorPatientData.js';
import { portalService } from './portalService.js';
import { clinicToday, formatSlot } from './bookingService.js';
import { demoDoctor } from '../mocks/doctorRecordStore.js';
import { appointmentStatus } from '../mocks/staffAppointmentStore.js';

export const doctorDashboardService = {
  getDashboard(now = new Date()) {
    const date = clinicToday(now);
    const appointments = doctorDashboardAppointments.map(({ time, ...item }) => ({ ...item, doctor_id: demoDoctor.id,
      appointment_at: `${date}T${time}:00+08:00`, timeLabel: formatSlot(time),
      patientName: doctorPatient(item.patient_id)?.full_name ?? 'Patient unavailable',
      patientPath: '/doctor/patients/' + item.patient_id,
    })).map(item => ({ ...item, status: appointmentStatus(item) }))
      .sort((a, b) => new Date(a.appointment_at) - new Date(b.appointment_at));
    const upcoming = appointments.filter(item => ['pending', 'confirmed'].includes(item.status) && new Date(item.appointment_at) >= new Date(`${date}T10:00:00+08:00`));
    return { profile: portalService.getPreviewProfile('doctor'), date, appointments, upcoming,
      nextPatient: upcoming.find(item => item.status === 'confirmed') ?? null,
      total: appointments.length, completed: appointments.filter(item => item.status === 'completed').length };
  },
};
