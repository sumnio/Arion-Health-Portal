import {
  Appointment,
  Doctor,
  DoctorAvailability,
  DoctorBlockedTime,
  DoctorPublishedAvailability,
} from '../models/index.js';

const ACTIVE_APPOINTMENT_STATUSES = ['pending', 'confirmed', 'completed'];

export const doctorSchedulingRepository = {
  async findDoctorByUserProfileId(userProfileId) {
    return Doctor.findOne({ user_profile_id: userProfileId }).lean();
  },

  async doctorExists(doctorId) {
    return Boolean(await Doctor.exists({ _id: doctorId }));
  },

  async listRecurring(doctorId) {
    return DoctorAvailability.find({ doctor_id: doctorId }).sort({ day_of_week: 1, start_time: 1 }).lean();
  },
  async findRecurringOwned(id, doctorId) {
    return DoctorAvailability.findOne({ _id: id, doctor_id: doctorId }).lean();
  },
  async recurringOverlaps(doctorId, day, start, end, excludeId) {
    return Boolean(await DoctorAvailability.exists({
      doctor_id: doctorId,
      day_of_week: day,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      start_time: { $lt: end },
      end_time: { $gt: start },
    }));
  },
  async createRecurring(data) { return (await DoctorAvailability.create(data)).toObject(); },
  async updateRecurringOwned(id, doctorId, updates) {
    return DoctorAvailability.findOneAndUpdate(
      { _id: id, doctor_id: doctorId },
      { $set: updates },
      { new: true, runValidators: true },
    ).lean();
  },
  async deleteRecurringOwned(id, doctorId) {
    return DoctorAvailability.findOneAndDelete({ _id: id, doctor_id: doctorId }).lean();
  },

  async listPublished(doctorId) {
    return DoctorPublishedAvailability.find({ doctor_id: doctorId })
      .sort({ availability_date: 1, start_time: 1 })
      .lean();
  },
  async publishedOverlaps(doctorId, date, start, end) {
    return Boolean(await DoctorPublishedAvailability.exists({
      doctor_id: doctorId,
      availability_date: date,
      start_time: { $lt: end },
      end_time: { $gt: start },
    }));
  },
  async createPublished(data) { return (await DoctorPublishedAvailability.create(data)).toObject(); },
  async deletePublishedOwned(id, doctorId) {
    return DoctorPublishedAvailability.findOneAndDelete({ _id: id, doctor_id: doctorId }).lean();
  },
  async listPublishedForDate(doctorId, date) {
    return DoctorPublishedAvailability.find({ doctor_id: doctorId, availability_date: date })
      .sort({ start_time: 1 })
      .lean();
  },

  async listBlocked(doctorId) {
    return DoctorBlockedTime.find({ doctor_id: doctorId }).sort({ start_at: 1 }).lean();
  },
  async createBlocked(data) { return (await DoctorBlockedTime.create(data)).toObject(); },
  async deleteBlockedOwned(id, doctorId) {
    return DoctorBlockedTime.findOneAndDelete({ _id: id, doctor_id: doctorId }).lean();
  },
  async listBlocksOverlapping(doctorId, start, end) {
    return DoctorBlockedTime.find({
      doctor_id: doctorId,
      start_at: { $lt: end },
      end_at: { $gt: start },
    }).lean();
  },

  async hasActiveAppointmentOverlap(doctorId, start, end) {
    const earliestStart = new Date(start.getTime() - 30 * 60 * 1000);
    return Boolean(await Appointment.exists({
      doctor_id: doctorId,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
      appointment_at: { $gt: earliestStart, $lt: end },
    }));
  },
  async listActiveAppointmentsBetween(doctorId, start, end) {
    return Appointment.find({
      doctor_id: doctorId,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
      appointment_at: { $gte: start, $lt: end },
    }).select('appointment_at').lean();
  },
};
