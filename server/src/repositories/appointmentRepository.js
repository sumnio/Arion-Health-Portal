import { Appointment, Doctor, MedicalRecord } from '../models/index.js';

const doctorDisplayPopulation = {
  path: 'doctor_id',
  select: 'specialty user_profile_id',
  populate: { path: 'user_profile_id', select: 'display_name' },
};

export const appointmentRepository = {
  async listActiveDoctors() {
    const doctors = await Doctor.find()
      .select('specialty user_profile_id')
      .populate({
        path: 'user_profile_id',
        match: { role: 'doctor', status: 'active' },
        select: 'display_name',
      })
      .sort({ created_at: 1 })
      .lean();
    return doctors.filter((doctor) => doctor.user_profile_id);
  },

  async doctorExists(doctorId) {
    return Boolean(await Doctor.exists({ _id: doctorId }));
  },

  async create(data) {
    return (await Appointment.create(data)).toObject();
  },

  async listByPatientId(patientId) {
    return Appointment.find({ patient_id: patientId })
      .populate(doctorDisplayPopulation)
      .lean();
  },

  async findOwnedById(appointmentId, patientId) {
    return Appointment.findOne({ _id: appointmentId, patient_id: patientId })
      .populate(doctorDisplayPopulation)
      .lean();
  },

  async findById(appointmentId) {
    return Appointment.findById(appointmentId).lean();
  },

  async medicalRecordExists(appointmentId) {
    return Boolean(await MedicalRecord.exists({ appointment_id: appointmentId }));
  },

  async listRecordedAppointmentIds(appointmentIds) {
    if (!appointmentIds.length) return [];
    const records = await MedicalRecord.find({ appointment_id: { $in: appointmentIds } })
      .select('appointment_id')
      .lean();
    return records.map((record) => String(record.appointment_id));
  },

  async cancelOwnedEligible(appointmentId, patientId) {
    return Appointment.findOneAndUpdate(
      {
        _id: appointmentId,
        patient_id: patientId,
        status: { $in: ['pending', 'confirmed'] },
        check_in_at: null,
      },
      { $set: { status: 'cancelled' } },
      { new: true, runValidators: true },
    )
      .populate(doctorDisplayPopulation)
      .lean();
  },

  async confirmPending(appointmentId) {
    return Appointment.findOneAndUpdate(
      { _id: appointmentId, status: 'pending' },
      { $set: { status: 'confirmed' } },
      { new: true, runValidators: true },
    )
      .populate(doctorDisplayPopulation)
      .lean();
  },
};
