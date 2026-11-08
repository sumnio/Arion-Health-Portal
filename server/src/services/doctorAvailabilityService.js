import { httpError } from '../utils/httpError.js';
import { addDays, clinicDate, dateOnlyToUtc, storedDateOnly, zonedDateTimeToUtc } from '../utils/schedulingTime.js';
import {
  validateBlockedCreate, validatePublishedCreate, validatePublishedException, validatePublishedUpdate, validateRecurringCreate,
  validateRecurringPatch, validateSchedulingId,
} from '../validation/schedulingValidation.js';

function id(value) { return String(value?._id ?? value); }
function targetId(doctor) { return doctor._id ?? doctor.id; }
function recurringView(item) { return { id: id(item), day_of_week: item.day_of_week, start_time: item.start_time, end_time: item.end_time, is_active: item.is_active }; }
function publishedView(item) {
  return {
    id: id(item),
    availability_date: storedDateOnly(item.availability_date),
    start_time: item.start_time,
    end_time: item.end_time,
    repeat_weekly: item.repeat_weekly === true,
    excluded_dates: (item.excluded_dates ?? []).map(storedDateOnly),
    date_overrides: (item.date_overrides ?? []).map((override) => ({
      availability_date: storedDateOnly(override.availability_date),
      start_time: override.start_time,
      end_time: override.end_time,
    })),
  };
}
function blockedView(item) { return { id: id(item), start_at: new Date(item.start_at).toISOString(), end_at: new Date(item.end_at).toISOString(), reason: item.reason }; }
function rangesOverlap(left, right) { return left.start_time < right.end_time && left.end_time > right.start_time; }
function publishedAppliesOn(item, date) {
  const start = storedDateOnly(item.availability_date);
  if (item.repeat_weekly !== true) return start === date;
  if (date < start || dateOnlyToUtc(start).getUTCDay() !== dateOnlyToUtc(date).getUTCDay()) return false;
  return !(item.excluded_dates ?? []).some((value) => storedDateOnly(value) === date);
}
function publishedRulesOverlap(existing, incoming) {
  if (!rangesOverlap(existing, incoming)) return false;
  const existingDate = storedDateOnly(existing.availability_date);
  const incomingDate = incoming.availability_date;
  if (existing.repeat_weekly === true && incoming.repeat_weekly) {
    return dateOnlyToUtc(existingDate).getUTCDay() === dateOnlyToUtc(incomingDate).getUTCDay();
  }
  if (existing.repeat_weekly === true) return publishedAppliesOn(existing, incomingDate);
  if (incoming.repeat_weekly) {
    return existingDate >= incomingDate && dateOnlyToUtc(existingDate).getUTCDay() === dateOnlyToUtc(incomingDate).getUTCDay();
  }
  return existingDate === incomingDate;
}

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
        if (item.repeat_weekly === true) return true;
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
      const existing = await repository.listPublished(target);
      if (existing.some((item) => publishedRulesOverlap(item, values))) {
        throw httpError(409, 'PUBLISHED_AVAILABILITY_OVERLAP', 'Published availability ranges cannot overlap.');
      }
      return publishedView(await repository.createPublished({
        doctor_id: target,
        availability_date: dateOnlyToUtc(values.availability_date),
        start_time: values.start_time,
        end_time: values.end_time,
        repeat_weekly: values.repeat_weekly,
        excluded_dates: [],
      }));
    },
    async excludePublishedOccurrenceForDoctor(doctorId, publishedId, body) {
      validateSchedulingId(publishedId, 'publishedAvailabilityId');
      const target = targetId(await activeDoctor(doctorId));
      const values = validatePublishedException(body);
      const existing = await repository.findPublishedOwned(publishedId, target);
      if (!existing) throw httpError(404, 'PUBLISHED_AVAILABILITY_NOT_FOUND', 'Published availability was not found.');
      if (existing.repeat_weekly !== true) throw httpError(409, 'NOT_RECURRING_PUBLICATION', 'Only a weekly publication can remove one date.');
      if (!publishedAppliesOn(existing, values.availability_date)) {
        throw httpError(409, 'INVALID_PUBLICATION_OCCURRENCE', 'That date is not an active occurrence of this weekly publication.');
      }
      const updated = await repository.excludePublishedDateOwned(publishedId, target, dateOnlyToUtc(values.availability_date));
      if (!updated) throw httpError(404, 'PUBLISHED_AVAILABILITY_NOT_FOUND', 'Published availability was not found.');
      return { id: id(updated), availability_date: values.availability_date, excluded: true };
    },
    async updatePublishedForDoctor(doctorId, publishedId, body) {
      validateSchedulingId(publishedId, 'publishedAvailabilityId');
      const target = targetId(await activeDoctor(doctorId));
      const values = validatePublishedUpdate(body);
      const existing = await repository.findPublishedOwned(publishedId, target);
      if (!existing) throw httpError(404, 'PUBLISHED_AVAILABILITY_NOT_FOUND', 'Published availability was not found.');
      requireClinicHours(values.start_time, values.end_time);

      const occurrenceDate = values.scope === 'occurrence'
        ? values.availability_date
        : storedDateOnly(existing.availability_date);
      if (values.scope === 'occurrence' && existing.repeat_weekly !== true) {
        if (occurrenceDate !== storedDateOnly(existing.availability_date)) {
          throw httpError(409, 'INVALID_PUBLICATION_OCCURRENCE', 'That date does not belong to this booking availability.');
        }
      } else if (values.scope === 'occurrence' && !publishedAppliesOn(existing, occurrenceDate)) {
        throw httpError(409, 'INVALID_PUBLICATION_OCCURRENCE', 'That date is not an active occurrence of this weekly publication.');
      }

      const weekday = dateOnlyToUtc(occurrenceDate).getUTCDay();
      const recurring = await repository.listRecurring(target);
      const insideTemplate = recurring.some((item) => item.is_active
        && item.day_of_week === weekday
        && values.start_time >= item.start_time
        && values.end_time <= item.end_time);
      if (!insideTemplate) throw httpError(409, 'OUTSIDE_RECURRING_AVAILABILITY', 'Published availability must fit within active working hours.');

      const candidate = {
        availability_date: occurrenceDate,
        start_time: values.start_time,
        end_time: values.end_time,
        repeat_weekly: values.scope === 'series' && existing.repeat_weekly === true,
      };
      const otherRules = (await repository.listPublished(target)).filter((item) => id(item) !== id(existing));
      if (otherRules.some((item) => publishedRulesOverlap(item, candidate))) {
        throw httpError(409, 'PUBLISHED_AVAILABILITY_OVERLAP', 'Published availability ranges cannot overlap.');
      }

      const updated = values.scope === 'occurrence' && existing.repeat_weekly === true
        ? await repository.upsertPublishedDateOverrideOwned(publishedId, target, {
          availability_date: dateOnlyToUtc(occurrenceDate),
          start_time: values.start_time,
          end_time: values.end_time,
        })
        : await repository.updatePublishedRangeOwned(publishedId, target, {
          start_time: values.start_time,
          end_time: values.end_time,
        });
      if (!updated) throw httpError(404, 'PUBLISHED_AVAILABILITY_NOT_FOUND', 'Published availability was not found.');
      return publishedView(updated);
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
      if (values.end_at <= now()) {
        throw httpError(400, 'PAST_BLOCKED_TIME', 'Time off must end in the future. Choose a current or future time range.');
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
