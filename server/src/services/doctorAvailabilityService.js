import { httpError } from '../utils/httpError.js';
import {
  addDays,
  clinicDate,
  dateOnlyToUtc,
  storedDateOnly,
} from '../utils/schedulingTime.js';
import {
  validateBlockedCreate,
  validatePublishedCreate,
  validateRecurringCreate,
  validateRecurringPatch,
  validateSchedulingId,
} from '../validation/schedulingValidation.js';

function id(value) { return String(value?._id ?? value); }
function recurringView(item) {
  return { id: id(item), day_of_week: item.day_of_week, start_time: item.start_time, end_time: item.end_time, is_active: item.is_active };
}
function publishedView(item) {
  return { id: id(item), availability_date: storedDateOnly(item.availability_date), start_time: item.start_time, end_time: item.end_time };
}
function blockedView(item) {
  return { id: id(item), start_at: new Date(item.start_at).toISOString(), end_at: new Date(item.end_at).toISOString(), reason: item.reason };
}

export function createDoctorAvailabilityService({ repository, clinic, now = () => new Date() }) {
  async function ownDoctor(userProfileId) {
    const doctor = await repository.findDoctorByUserProfileId(userProfileId);
    if (!doctor) throw httpError(404, 'DOCTOR_PROFILE_NOT_FOUND', 'Doctor profile was not found.');
    return doctor;
  }
  function withinClinicHours(start, end) {
    return !clinic.openTime || (start >= clinic.openTime && end <= clinic.closeTime);
  }
  function requireClinicHours(start, end) {
    if (!withinClinicHours(start, end)) {
      throw httpError(400, 'OUTSIDE_CLINIC_HOURS', 'Availability must remain within configured clinic hours.');
    }
  }
  async function requireNoRecurringOverlap(doctorId, values, excludeId) {
    if (await repository.recurringOverlaps(doctorId, values.day_of_week, values.start_time, values.end_time, excludeId)) {
      throw httpError(409, 'AVAILABILITY_OVERLAP', 'Recurring availability ranges cannot overlap.');
    }
  }

  return {
    async listRecurring(userProfileId) {
      const doctor = await ownDoctor(userProfileId);
      return (await repository.listRecurring(doctor._id ?? doctor.id)).map(recurringView);
    },
    async createRecurring(userProfileId, body) {
      const doctor = await ownDoctor(userProfileId);
      const values = validateRecurringCreate(body);
      requireClinicHours(values.start_time, values.end_time);
      await requireNoRecurringOverlap(doctor._id ?? doctor.id, values);
      return recurringView(await repository.createRecurring({ doctor_id: doctor._id ?? doctor.id, ...values }));
    },
    async updateRecurring(userProfileId, availabilityId, body) {
      validateSchedulingId(availabilityId, 'availabilityId');
      const doctor = await ownDoctor(userProfileId);
      const doctorId = doctor._id ?? doctor.id;
      const existing = await repository.findRecurringOwned(availabilityId, doctorId);
      if (!existing) throw httpError(404, 'AVAILABILITY_NOT_FOUND', 'Recurring availability was not found.');
      const values = validateRecurringPatch(body, existing);
      requireClinicHours(values.start_time, values.end_time);
      await requireNoRecurringOverlap(doctorId, values, availabilityId);
      return recurringView(await repository.updateRecurringOwned(availabilityId, doctorId, values));
    },
    async deleteRecurring(userProfileId, availabilityId) {
      validateSchedulingId(availabilityId, 'availabilityId');
      const doctor = await ownDoctor(userProfileId);
      const removed = await repository.deleteRecurringOwned(availabilityId, doctor._id ?? doctor.id);
      if (!removed) throw httpError(404, 'AVAILABILITY_NOT_FOUND', 'Recurring availability was not found.');
      return { id: id(removed), deleted: true };
    },

    async listPublished(userProfileId) {
      const doctor = await ownDoctor(userProfileId);
      return (await repository.listPublished(doctor._id ?? doctor.id)).map(publishedView);
    },
    async createPublished(userProfileId, body) {
      const doctor = await ownDoctor(userProfileId);
      const doctorId = doctor._id ?? doctor.id;
      const values = validatePublishedCreate(body);
      const today = clinicDate(now(), clinic.timeZone);
      if (values.availability_date < today || values.availability_date > addDays(today, 30)) {
        throw httpError(400, 'OUTSIDE_PUBLICATION_WINDOW', 'availability_date must be from today through the next 30 days.');
      }
      requireClinicHours(values.start_time, values.end_time);
      const weekday = dateOnlyToUtc(values.availability_date).getUTCDay();
      const recurring = await repository.listRecurring(doctorId);
      const insideTemplate = recurring.some((item) =>
        item.is_active && item.day_of_week === weekday && values.start_time >= item.start_time && values.end_time <= item.end_time);
      if (!insideTemplate) {
        throw httpError(409, 'OUTSIDE_RECURRING_AVAILABILITY', 'Published availability must fit within an active recurring range.');
      }
      const date = dateOnlyToUtc(values.availability_date);
      if (await repository.publishedOverlaps(doctorId, date, values.start_time, values.end_time)) {
        throw httpError(409, 'PUBLISHED_AVAILABILITY_OVERLAP', 'Published availability ranges cannot overlap.');
      }
      return publishedView(await repository.createPublished({
        doctor_id: doctorId,
        availability_date: date,
        start_time: values.start_time,
        end_time: values.end_time,
      }));
    },
    async deletePublished(userProfileId, publishedId) {
      validateSchedulingId(publishedId, 'publishedAvailabilityId');
      const doctor = await ownDoctor(userProfileId);
      const removed = await repository.deletePublishedOwned(publishedId, doctor._id ?? doctor.id);
      if (!removed) throw httpError(404, 'PUBLISHED_AVAILABILITY_NOT_FOUND', 'Published availability was not found.');
      return { id: id(removed), deleted: true };
    },

    async listBlocked(userProfileId) {
      const doctor = await ownDoctor(userProfileId);
      return (await repository.listBlocked(doctor._id ?? doctor.id)).map(blockedView);
    },
    async createBlocked(userProfileId, body) {
      const doctor = await ownDoctor(userProfileId);
      const doctorId = doctor._id ?? doctor.id;
      const values = validateBlockedCreate(body);
      if (await repository.hasActiveAppointmentOverlap(doctorId, values.start_at, values.end_at)) {
        throw httpError(409, 'BLOCK_OVERLAPS_APPOINTMENT', 'Blocked time overlaps an existing active appointment.');
      }
      return blockedView(await repository.createBlocked({ doctor_id: doctorId, ...values }));
    },
    async deleteBlocked(userProfileId, blockedId) {
      validateSchedulingId(blockedId, 'blockedTimeId');
      const doctor = await ownDoctor(userProfileId);
      const removed = await repository.deleteBlockedOwned(blockedId, doctor._id ?? doctor.id);
      if (!removed) throw httpError(404, 'BLOCKED_TIME_NOT_FOUND', 'Blocked time was not found.');
      return { id: id(removed), deleted: true };
    },
  };
}
