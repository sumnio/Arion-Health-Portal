import { doctorDashboardService } from './doctorDashboardService.js';


import { staffQueueFixtures } from '../mocks/staffDashboardData.js';
import { demoDoctor } from '../mocks/doctorRecordStore.js';
import { bookingDoctors } from '../mocks/bookingData.js';
import { clinicToday, formatSlot } from './bookingService.js';
import { isSenior } from './patientProfileService.js';
import { staffAppointmentStatus, staffCheckIn } from '../mocks/staffAppointmentStore.js';
import { walkInAppointments, walkInServices, staffPatient, staffPatientName } from '../mocks/staffWalkInStore.js';

export function queueTier(appointment, patient, date) {
  return appointment.priority === 'urgent' ? 0 : patient.is_pwd || isSenior(patient.dob, date) ? 1 : 2;
}
export function compareQueue(a, b) {
  return a.tier - b.tier || new Date(a.check_in_at ?? a.appointment_at) - new Date(b.check_in_at ?? b.appointment_at) || a.id.localeCompare(b.id);
}
export const staffDashboardService = {
  getDashboard(now = new Date()) {
    const date = clinicToday(now);
    const shared = doctorDashboardService.getDashboard(now).appointments.map(item => ({ ...item, doctor_id: demoDoctor.id, doctor: demoDoctor.display_name, priority: 'normal', check_in_at: item.status === 'completed' ? item.appointment_at : null }));
    const additions = staffQueueFixtures.map(({time, checkedIn, ...item}) => ({ ...item, appointment_at: `${date}T${time}:00+08:00`, check_in_at: `${date}T${checkedIn}:00+08:00`, status: 'confirmed', doctor_id: bookingDoctors[0].id, doctor: bookingDoctors[0].name, timeLabel: formatSlot(time) }));
    // Explicit operational projection: no diagnoses, notes, allergies or prescriptions.
    const walkIns = walkInAppointments.filter(item => item.appointment_at.slice(0, 10) === date).map(item => ({ ...item,
      doctor: item.doctor_id === demoDoctor.id ? demoDoctor.display_name : bookingDoctors.find(doctor => doctor.id === item.doctor_id)?.name,
      timeLabel: formatSlot(item.appointment_at.slice(11, 16)), service: walkInServices.get(item.id) }));
    const appointments = [...shared, ...additions, ...walkIns].map(item => {
      item.status = staffAppointmentStatus(item);
      item.check_in_at = staffCheckIn(item);
      const patient = staffPatient(item.patient_id);
      const tier = queueTier(item, patient, date);
      return { id: item.id, patient_id: item.patient_id, patientName: staffPatientName(item.patient_id), doctor_id: item.doctor_id, doctor: item.doctor, appointment_at: item.appointment_at, timeLabel: item.timeLabel, status: item.status, check_in_at: item.check_in_at, priority: item.priority, reason: item.reason, service: item.service, tier, priorityLabel: ['Urgent', 'Senior / PWD', 'Normal'][tier], checkInLabel: item.check_in_at ? 'Checked in' : 'Not checked in' };
    }).sort((a,b) => new Date(a.appointment_at)-new Date(b.appointment_at));
    const waiting = appointments.filter(item => item.check_in_at && ['pending','confirmed'].includes(item.status)).sort(compareQueue);
    const upcoming = appointments.filter(item => !item.check_in_at && ['pending','confirmed'].includes(item.status));
    return structuredClone({ date, appointments, waiting, upcoming, total: appointments.length, checkedIn: appointments.filter(item=>item.check_in_at).length, completed: appointments.filter(item=>item.status === 'completed').length });
  },
};
