import { appointmentRepository } from '../repositories/appointmentRepository.js';
import { patientRepository } from '../repositories/patientRepository.js';
import { createAppointmentService } from './appointmentService.js';
import { createAppointmentEmailService } from './appointmentEmailService.js';
import { createPatientService } from './patientService.js';

export function createPatientAppointmentModule({
  patients = patientRepository,
  appointments = appointmentRepository,
  bookingAvailabilityService,
  notificationTriggers,
  smsReminders,
  email,
  clinicTimeZone = 'Asia/Manila',
  appointmentEmails,
  now,
} = {}) {
  const patientService = createPatientService({ repository: patients });
  const rescheduleEmails = appointmentEmails ?? createAppointmentEmailService({
    repository: appointments,
    email,
    timeZone: clinicTimeZone,
  });
  const appointmentService = createAppointmentService({
    repository: appointments,
    patientService,
    bookingAvailabilityService,
    notificationTriggers,
    smsReminders,
    appointmentEmails: rescheduleEmails,
    now,
  });
  return { patientService, appointmentService };
}
