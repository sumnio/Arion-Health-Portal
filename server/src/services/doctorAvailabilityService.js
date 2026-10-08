import { httpError } from '../utils/httpError.js';
import { addDays, clinicDate, dateOnlyToUtc, storedDateOnly, zonedDateTimeToUtc } from '../utils/schedulingTime.js';
import {
  validateBlockedCreate, validatePublishedCreate, validateRecurringCreate,
  validateRecurringPatch, validateSchedulingId,
} from '../validation/schedulingValidation.js';

function id(value) { return String(value?._id ?? value); }
function targetId(doctor) { return doctor._id ?? doctor.id; }
function recurringView(item) { return { id: id(item), day_of_week: item.day_of_week, start_time: item.start_time, end_time: item.end_time, is_active: item.is_active }; }
function publishedView(item) { return { id: id(item), availability_date: storedDateOnly(item.availability_date), start_time: item.start_time, end_time: item.end_time }; }
function blockedView(item) { return { id: id(item), start_at: new Date(item.start_at).toISOString(), end_at: new Date(item.end_at).toISOString(), reason: item.reason }; }

export function createDoctorAvailabilityService({ repository, clinic, now = () => new Date() }) {
  async function ownDoctor(userProfileId) {
    const doctor = await repository.findDoctorByUserProfileId(userProfileId);
    if (!doctor) throw httpError(404, 'DOCTOR_PROFILE_NOT_FOUND', 'Doctor profile was not found.');
    return doctor;
  }
  async function activeDoctor(doctorId) {
    validateSchedulingId(doctorId, 'doctorId');
    const doctor = await repository.findActiveDoctorById(doctorId);
    if (!doctor) throw httpError(404, 'DOCTOR_PROFILE_NOT_FOUND', 'Active Doctor profile was not found.');
    return doctor;
  }
  function requireClinicHours(start, end) {
    if (clinic.openTime && (start < clinic.openTime || end > clinic.closeTime)) {
      throw httpError(400, 'OUTSIDE_CLINIC_HOURS', 'Availability must remain within configured clinic hours.');
    }
  }
  async function requireNoRecurringOverlap(doctorId, values, excludeId) {
    if (await repository.recurringOverlaps(doctorId, values.day_of_week, values.start_time, values.end_time, excludeId)) {
      throw httpError(409, 'AVAILABILITY_OVERLAP', 'Recurring availability ranges cannot overlap.');
    }
  }
  async function activePublished(doctorId) {
    const current = now();
    const today = clinicDate(current, clinic.timeZone);
    return (await repository.listPublishedActive(doctorId, dateOnlyToUtc(today)))
      .filter((item) => {
        const date = storedDateOnly(item.availability_date);
        return date > today || zonedDateTimeToUtc(date, item.end_time, clinic.timeZone) > current;
      })
      .map(publishedView);
  }
  async function activeBlocked(doctorId) {
    return (await repository.listBlockedActive(doctorId, now())).map(blockedView);
  }

  return {
    async listOwnRecurring(userProfileId) {
      const doctor = await ownDoctor(userProfileId);
      return (await repository.listRecurring(targetId(doctor))).map(recurringView);
    },
    async listOwnPublished(userProfileId) {
      const doctor = await ownDoctor(userProfileId);
      return activePublished(targetId(doctor));
    },
    async listOwnBlocked(userProfileId) {
      const doctor = await ownDoctor(userProfileId);
      return activeBlocked(targetId(doctor));
    },
    async getStaffSchedule(doctorId) {
      const doctor = await activeDoctor(doctorId);
      const target = targetId(doctor);
      const [recurring, published, blocked] = await Promise.all([
        repository.listRecurring(target), activePublished(target), activeBlocked(target),
      ]);
      return { doctor_id: id(target), recurring_availability: recurring.map(recurringView), published_availability: published, blocked_times: blocked };
    },
    async createRecurringForDoctor(doctorId, body) {
      const target = targetId(await activeDoctor(doctorId));
      const values = validateRecurringCreate(body);
      requireClinicHours(values.start_time, values.end_time);
      await requireNoRecurringOverlap(target, values);
      return recurringView(await repository.createRecurring({ doctor_id: target, ...values }));
    },
    async updateRecurringForDoctor(doctorId, availabilityId, body) {
      validateSchedulingId(availabilityId, 'availabilityId');
      const target = targetId(await activeDoctor(doctorId));
      const existing = await repository.findRecurringOwned(availabilityId, target);
      if (!existing) throw httpError(404, 'AVAILABILITY_NOT_FOUND', 'Recurring availability was not found.');
      const values = validateRecurringPatch(body, existing);
      requireClinicHours(values.start_time, values.end_time);
      await requireNoRecurringOverlap(target, values, availabilityId);
      return recurringView(await repository.updateRecurringOwned(availabilityId, target, values));
    },
    async deleteRecurringForDoctor(doctorId, availabilityId) {
      validateSchedulingId(availabilityId, 'availabilityId');
      const target = targetId(await activeDoctor(doctorId));
      const removed = await repository.deleteRecurringOwned(availabilityId, target);
      if (!removed) throw httpError(404, 'AVAILABILITY_NOT_FOUND', 'Recurring availability was not found.');
      return { id: id(removed), deleted: true };
    },
    async createPublishedForDoctor(doctorId, body) {
      const target = targetId(await activeDoctor(doctorId));
      const values = validatePublishedCreate(body);
      const today = clinicDate(now(), clinic.timeZone);
      if (values.availability_date < today || values.availability_date > addDays(today, 30)) {
        throw httpError(400, 'OUTSIDE_PUBLICATION_WINDOW', 'availability_date must be from today through the next 30 days.');
      }
      requireClinicHours(values.start_time, values.end_time);
      const weekday = dateOnlyToUtc(values.availability_date).getUTCDay();
      const recurring = await repository.listRecurring(target);
      const insideTemplate = recurring.some((item) => item.is_active && item.day_of_week === weekday && values.start_time >= item.start_time && values.end_time <= item.end_time);
      if (!insideTemplate) throw httpError(409, 'OUTSIDE_RECURRING_AVAILABILITY', 'Published availability must fit within an active recurring range.');
      const date = dateOnlyToUtc(values.availability_date);
      if (await repository.publishedOverlaps(target, date, values.start_time, values.end_time)) {
        throw httpError(409, 'PUBLISHED_AVAILABILITY_OVERLAP', 'Published availability ranges cannot overlap.');
      }
      return publishedView(await repository.createPublished({ doctor_id: target, availability_date: date, start_time: values.start_time, end_time: values.end_time }));
    },
    async deletePublishedForDoctor(doctorId, publishedId) {
      validateSchedulingId(publishedId, 'publishedAvailabilityId');
      const target = targetId(await activeDoctor(doctorId));
      const removed = await repository.deletePublishedOwned(publishedId, target);
      if (!removed) throw httpError(404, 'PUBLISHED_AVAILABILITY_NOT_FOUND', 'Published availability was not found.');
      return { id: id(removed), deleted: true };
    },
    async createBlockedForDoctor(doctorId, body) {
      const target = targetId(await activeDoctor(doctorId));
      const values = validateBlockedCreate(body);
      if (await repository.hasActiveAppointmentOverlap(target, values.start_at, values.end_at)) {
        throw httpError(409, 'BLOCK_OVERLAPS_APPOINTMENT', 'Blocked time overlaps an existing active appointment.');
      }
      return blockedView(await repository.createBlocked({ doctor_id: target, ...values }));
    },
    async deleteBlockedForDoctor(doctorId, blockedId) {
      validateSchedulingId(blockedId, 'blockedTimeId');
      const target = targetId(await activeDoctor(doctorId));
      const removed = await repository.deleteBlockedOwned(blockedId, target);
      if (!removed) throw httpError(404, 'BLOCKED_TIME_NOT_FOUND', 'Blocked time was not found.');
      return { id: id(removed), deleted: true };
    },
  };
}
