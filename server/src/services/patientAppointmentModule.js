import { appointmentRepository } from '../repositories/appointmentRepository.js';
import { patientRepository } from '../repositories/patientRepository.js';
import { createAppointmentService } from './appointmentService.js';
import { createPatientService } from './patientService.js';

export function createPatientAppointmentModule({
  patients = patientRepository,
  appointments = appointmentRepository,
  bookingAvailabilityService,
  notificationTriggers,
  now,
} = {}) {
  const patientService = createPatientService({ repository: patients });
  const appointmentService = createAppointmentService({
    repository: appointments,
    patientService,
    bookingAvailabilityService,
    notificationTriggers,
    now,
  });
  return { patientService, appointmentService };
}
