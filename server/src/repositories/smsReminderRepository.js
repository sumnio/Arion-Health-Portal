import { Appointment, AppointmentSmsReminder } from '../models/index.js';

export const smsReminderRepository = {
  async create(data) {
    return (await AppointmentSmsReminder.create(data)).toObject();
  },

  async claimNextDue(now) {
    return AppointmentSmsReminder.findOneAndUpdate(
      { status: 'scheduled', scheduled_for: { $lte: now } },
      { $set: { status: 'processing', processing_started_at: now } },
      { new: true, runValidators: true, sort: { scheduled_for: 1, created_at: 1 } },
    ).lean();
  },

  async failStaleProcessing(cutoff, now) {
    const result = await AppointmentSmsReminder.updateMany(
      { status: 'processing', processing_started_at: { $lte: cutoff } },
      {
        $set: {
          status: 'failed',
          failed_at: now,
          failure_category: 'stale_processing',
          processing_started_at: null,
        },
      },
      { runValidators: true },
    );
    return result.modifiedCount;
  },

  async findDeliveryContext(reminder) {
    const appointment = await Appointment.findOne({
      _id: reminder.appointment_id,
      patient_id: reminder.patient_id,
    })
      .select('appointment_at patient_id doctor_id')
      .populate({ path: 'patient_id', select: 'contact_number' })
      .populate({
        path: 'doctor_id',
        select: 'user_profile_id',
        populate: { path: 'user_profile_id', select: 'display_name' },
      })
      .lean();
    if (!appointment) return null;
    return {
      appointmentAt: appointment.appointment_at,
      phoneNumber: appointment.patient_id?.contact_number ?? null,
      doctorName: appointment.doctor_id?.user_profile_id?.display_name ?? null,
    };
  },

  async markSent(id, result, now) {
    return AppointmentSmsReminder.findOneAndUpdate(
      { _id: id, status: 'processing' },
      {
        $set: {
          status: 'sent',
          provider: result.provider,
          provider_reference_id: result.provider_reference_id,
          sent_at: now,
          failure_category: null,
          processing_started_at: null,
        },
      },
      { new: true, runValidators: true },
    ).lean();
  },

  async markFailed(id, result, now) {
    return AppointmentSmsReminder.findOneAndUpdate(
      { _id: id, status: 'processing' },
      {
        $set: {
          status: 'failed',
          provider: result.provider,
          failed_at: now,
          failure_category: result.safe_error_category ?? 'unknown_error',
          processing_started_at: null,
        },
      },
      { new: true, runValidators: true },
    ).lean();
  },
};
