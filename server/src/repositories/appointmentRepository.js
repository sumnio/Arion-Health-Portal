import { Appointment, AuthAccount, Doctor, MedicalRecord, Patient } from '../models/index.js';

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

  async listAssistantAppointmentsByPatientId(patientId) {
    return Appointment.find({ patient_id: patientId })
      .select('-_id appointment_at status visit_type doctor_id')
      .populate({
        path: 'doctor_id',
        select: '-_id user_profile_id',
        populate: { path: 'user_profile_id', select: '-_id display_name' },
      })
      .sort({ appointment_at: 1 })
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

  async findRescheduleEmailRecipient(patientId) {
    const patient = await Patient.findById(patientId).select('user_profile_id portal_email').lean();
    if (!patient) return null;
    const account = patient.user_profile_id
      ? await AuthAccount.findOne({ user_profile_id: patient.user_profile_id }).select('email').lean()
      : null;
    return {
      email: account?.email ?? patient.portal_email ?? null,
      has_portal_account: Boolean(account),
    };
  },

  async flagAppointmentsForDoctorBlock(doctorId, blockId, startAt, endAt, flaggedAt) {
    const earliestStart = new Date(new Date(startAt).getTime() - (30 * 60 * 1000));
    const filter = {
      doctor_id: doctorId,
      status: { $in: ['pending', 'confirmed'] },
      appointment_at: { $gt: earliestStart, $lt: endAt },
    };
    const affected = await Appointment.find(filter).select('_id').lean();
    if (!affected.length) return [];
    const ids = affected.map((item) => item._id);
    await Appointment.updateMany(
      { _id: { $in: ids } },
      {
        $set: { requires_reschedule_due_to_doctor_unavailability: true, doctor_unavailability_flagged_at: flaggedAt },
        $addToSet: { doctor_unavailability_block_ids: blockId },
      },
    );
    return Appointment.find({ _id: { $in: ids } })
      .populate({ path: 'patient_id', select: 'full_name' })
      .populate(doctorDisplayPopulation)
      .sort({ appointment_at: 1 })
      .lean();
  },

  async removeDoctorBlockFlag(blockId) {
    await Appointment.updateMany({ doctor_unavailability_block_ids: blockId }, { $pull: { doctor_unavailability_block_ids: blockId } });
    await Appointment.updateMany(
      { requires_reschedule_due_to_doctor_unavailability: true, doctor_unavailability_block_ids: { $size: 0 } },
      { $set: { requires_reschedule_due_to_doctor_unavailability: false, doctor_unavailability_flagged_at: null } },
    );
  },

  async listAffectedAppointmentsForDoctor(doctorId) {
    return Appointment.find({ doctor_id: doctorId, requires_reschedule_due_to_doctor_unavailability: true, status: { $in: ['pending', 'confirmed'] } })
      .populate({ path: 'patient_id', select: 'full_name' })
      .populate(doctorDisplayPopulation)
      .sort({ appointment_at: 1 })
      .lean();
  },

  async medicalRecordExists(appointmentId) {
    return Boolean(await MedicalRecord.exists({ appointment_id: appointmentId }));
  },
  async findFollowUpRecordForPatient(recordId, patientId) {
    return MedicalRecord.findOne({ _id: recordId, patient_id: patientId })
      .select('patient_id doctor_id follow_up_required follow_up_recommended_date follow_up_reason')
      .lean();
  },
  async findActiveLinkedFollowUp(recordId) {
    return Appointment.findOne({
      source_medical_record_id: recordId,
      status: { $in: ['pending', 'confirmed'] },
    }).lean();
  },

  async listRecordedAppointmentIds(appointmentIds) {
    if (!appointmentIds.length) return [];
    const records = await MedicalRecord.find({ appointment_id: { $in: appointmentIds } })
      .select('appointment_id')
      .lean();
    return records.map((record) => String(record.appointment_id));
  },

  async cancelOwnedEligible(appointmentId, patientId, current, expectedAppointmentAt) {
    return Appointment.findOneAndUpdate(
      {
        _id: appointmentId,
        patient_id: patientId,
        status: { $in: ['pending', 'confirmed'] },
        check_in_at: null,
        appointment_at: { $eq: expectedAppointmentAt, $gt: current },
      },
      { $set: { status: 'cancelled' } },
      { new: true, runValidators: true },
    )
      .populate(doctorDisplayPopulation)
      .lean();
  },

  async rescheduleOwnedEligible({
    appointmentId,
    patientId,
    userProfileId,
    doctorId,
    expectedAppointmentAt,
    eligibilityCutoff,
    appointmentAt,
  }) {
    return Appointment.findOneAndUpdate(
      {
        _id: appointmentId,
        patient_id: patientId,
        doctor_id: doctorId,
        created_by: userProfileId,
        status: { $in: ['pending', 'confirmed'] },
        check_in_at: null,
        appointment_at: { $eq: expectedAppointmentAt, $gte: eligibilityCutoff },
      },
      { $set: { appointment_at: appointmentAt, status: 'pending', requires_reschedule_due_to_doctor_unavailability: false, doctor_unavailability_block_ids: [], doctor_unavailability_flagged_at: null } },
      { new: true, runValidators: true },
    )
      .populate(doctorDisplayPopulation)
      .lean();
  },

  async rescheduleAffectedForStaff({ appointmentId, doctorId, expectedAppointmentAt, appointmentAt }) {
    return Appointment.findOneAndUpdate(
      {
        _id: appointmentId,
        doctor_id: doctorId,
        status: { $in: ['pending', 'confirmed'] },
        check_in_at: null,
        appointment_at: { $eq: expectedAppointmentAt },
        requires_reschedule_due_to_doctor_unavailability: true,
      },
      { $set: { appointment_at: appointmentAt, requires_reschedule_due_to_doctor_unavailability: false, doctor_unavailability_block_ids: [], doctor_unavailability_flagged_at: null } },
      { new: true, runValidators: true },
    ).populate(doctorDisplayPopulation).lean();
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
