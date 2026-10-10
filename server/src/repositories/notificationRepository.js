import { Appointment, Doctor, Notification, Patient, UserProfile } from '../models/index.js';

function recipientScope(recipient) {
  return {
    recipient_user_profile_id: recipient.user_profile_id,
    recipient_role: recipient.role,
  };
}

export const notificationRepository = {
  async findRecipientProfile(userProfileId) {
    return UserProfile.findById(userProfileId).select('role status').lean();
  },

  async listActiveStaffProfiles() {
    return UserProfile.find({ role: 'staff', status: 'active' })
      .select('_id role status')
      .sort({ _id: 1 })
      .lean();
  },

  async findActiveDoctorProfileByDoctorId(doctorId) {
    const doctor = await Doctor.findById(doctorId)
      .select('user_profile_id')
      .populate({
        path: 'user_profile_id',
        match: { role: 'doctor', status: 'active' },
        select: 'role status',
      })
      .lean();
    return doctor?.user_profile_id ?? null;
  },

  async findActivePatientProfileByPatientId(patientId) {
    const patient = await Patient.findById(patientId)
      .select('user_profile_id')
      .populate({
        path: 'user_profile_id',
        match: { role: 'patient', status: 'active' },
        select: 'role status',
      })
      .lean();
    return patient?.user_profile_id ?? null;
  },

  async findAppointmentNotificationContext(appointmentId) {
    const appointment = await Appointment.findById(appointmentId)
      .select('patient_id doctor_id appointment_at')
      .populate({ path: 'patient_id', select: 'full_name' })
      .populate({
        path: 'doctor_id',
        select: 'user_profile_id',
        populate: { path: 'user_profile_id', select: 'display_name' },
      })
      .lean();
    if (!appointment) return null;
    return {
      patient_display_name: appointment.patient_id?.full_name ?? null,
      doctor_display_name: appointment.doctor_id?.user_profile_id?.display_name ?? null,
      appointment_at: appointment.appointment_at ?? null,
    };
  },

  async create(input) {
    const item = await Notification.create(input);
    return item.toObject();
  },

  async listForRecipient(recipient, { unread_only: unreadOnly, page, limit }) {
    const scope = recipientScope(recipient);
    const filter = unreadOnly ? { ...scope, is_read: false } : scope;
    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ created_at: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...scope, is_read: false }),
    ]);
    return { items, total, unread_count: unreadCount };
  },

  async countUnreadForRecipient(recipient) {
    return Notification.countDocuments({ ...recipientScope(recipient), is_read: false });
  },

  async markReadForRecipient(notificationId, recipient, readAt) {
    const scope = { _id: notificationId, ...recipientScope(recipient) };
    const updated = await Notification.findOneAndUpdate(
      { ...scope, is_read: false },
      { $set: { is_read: true, read_at: readAt } },
      { new: true, runValidators: true },
    ).lean();
    return updated ?? Notification.findOne(scope).lean();
  },

  async markAllReadForRecipient(recipient, readAt) {
    const result = await Notification.updateMany(
      { ...recipientScope(recipient), is_read: false },
      { $set: { is_read: true, read_at: readAt } },
      { runValidators: true },
    );
    return result.modifiedCount;
  },
};
