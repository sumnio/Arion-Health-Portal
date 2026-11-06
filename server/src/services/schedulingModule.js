import { createClinicConfig } from '../config/clinic.js';
import { doctorSchedulingRepository } from '../repositories/doctorSchedulingRepository.js';
import { createBookingAvailabilityService } from './bookingAvailabilityService.js';
import { createDoctorAvailabilityService } from './doctorAvailabilityService.js';
import { createRescheduleSuggestionService } from './rescheduleSuggestionService.js';

export function createSchedulingModule({
  repository = doctorSchedulingRepository,
  clinic: clinicOptions,
  now,
} = {}) {
  const clinic = createClinicConfig(clinicOptions);
  const bookingAvailabilityService = createBookingAvailabilityService({ repository, clinic, now });
  return {
    clinic,
    doctorAvailabilityService: createDoctorAvailabilityService({ repository, clinic, now }),
    bookingAvailabilityService,
    rescheduleSuggestionService: createRescheduleSuggestionService({ bookingAvailabilityService, now }),
  };
}
