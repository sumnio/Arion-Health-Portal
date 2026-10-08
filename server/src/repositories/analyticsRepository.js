import { Appointment, Doctor } from '../models/index.js';

const doctorPopulation = {
  path: 'doctor_id',
  select: 'user_profile_id',
  populate: { path: 'user_profile_id', select: 'display_name status' },
};

export const analyticsRepository = {
  async listAppointmentsBetween(start, end) {
    return Appointment.find({ appointment_at: { $gte: start, $lt: end } })
      .select('patient_id doctor_id appointment_at status visit_type reason priority')
      .populate({ path: 'patient_id', select: 'dob is_pwd' })
      .populate(doctorPopulation)
      .lean();
  },

  async listDoctors() {
    return Doctor.find({})
      .select('user_profile_id')
      .populate({ path: 'user_profile_id', select: 'display_name status' })
      .sort({ created_at: 1 })
      .lean();
  },
};
