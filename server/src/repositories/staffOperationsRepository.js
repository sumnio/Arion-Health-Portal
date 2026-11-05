import mongoose from 'mongoose';
import { Appointment, AppointmentPriorityAudit, AuthAccount, Doctor, MedicalRecord, Patient } from '../models/index.js';

const doctorPopulation = { path: 'doctor_id', select: 'specialty user_profile_id', populate: { path: 'user_profile_id', select: 'display_name' } };
const pwdVerificationPopulation = { path: 'pwd_verification', select: 'patient_id status' };
const queuePopulation = [
  { path: 'patient_id', select: 'full_name dob sex contact_number', populate: pwdVerificationPopulation },
  doctorPopulation,
];
const auditActorPopulation = { path: 'staff_actor_user_profile_id', select: 'display_name' };
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function flexiblePhoneRegex(value, anchored = false) {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 3) return null;
  return new RegExp(`${anchored ? '^\\D*' : ''}${digits.split('').join('\\D*')}${anchored ? '\\D*$' : ''}`);
}

export const staffOperationsRepository = {
  async listAppointmentsBetween(start, end) {
    return Appointment.find({ appointment_at: { $gte: start, $lt: end } })
      .sort({ appointment_at: 1 })
      .populate(queuePopulation)
      .lean();
  },
  async listAppointmentHistory({ start, end, statuses, doctorId, patientSearch, visitType, page, limit }) {
    const query = { appointment_at: { $gte: start, $lt: end }, status: { $in: statuses } };
    if (doctorId) query.doctor_id = doctorId;
    if (visitType) query.visit_type = visitType;
    if (patientSearch) {
      const patientIds = await Patient.find({ full_name: { $regex: escapeRegex(patientSearch), $options: 'i' } }).distinct('_id');
      query.patient_id = { $in: patientIds };
    }
    const population = [
      { path: 'patient_id', select: 'full_name dob user_profile_id', populate: pwdVerificationPopulation },
      doctorPopulation,
      { path: 'created_by', select: 'role' },
    ];
    const [items, total] = await Promise.all([
      Appointment.find(query)
        .select('patient_id doctor_id created_by appointment_at status visit_type reason check_in_at priority')
        .sort({ appointment_at: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(population)
        .lean(),
      Appointment.countDocuments(query),
    ]);
    return { items, total };
  },
  async listActiveDoctors() {
    const doctors = await Doctor.find()
      .select('specialty user_profile_id')
      .populate({ path: 'user_profile_id', match: { role: 'doctor', status: 'active' }, select: 'display_name' })
      .sort({ created_at: 1 })
      .lean();
    return doctors.filter((doctor) => doctor.user_profile_id);
  },
  async searchPatients(search) {
    const query = search.trim();
    let patients;
    if (!query) patients = await Patient.find({}).sort({ full_name: 1 }).limit(50).lean();
    else {
      const pattern = new RegExp(escapeRegex(query), 'i');
      const phonePattern = flexiblePhoneRegex(query);
      const accountProfileIds = await AuthAccount.find({ email: pattern }).distinct('user_profile_id');
      patients = await Patient.find({ $or: [
        { full_name: pattern },
        { contact_number: phonePattern ?? pattern },
        { portal_email: pattern },
        ...(accountProfileIds.length ? [{ user_profile_id: { $in: accountProfileIds } }] : []),
      ] }).sort({ full_name: 1 }).limit(50).lean();
    }
    const profileIds = patients.map(item => item.user_profile_id).filter(Boolean);
    const accounts = profileIds.length
      ? await AuthAccount.find({ user_profile_id: { $in: profileIds } }).select('user_profile_id email').lean()
      : [];
    const accountEmails = new Map(accounts.map(item => [String(item.user_profile_id), item.email]));
    return patients.map(item => ({ ...item, account_email: item.user_profile_id ? accountEmails.get(String(item.user_profile_id)) ?? null : null }));
  },
  async listAppointmentsForPatients(patientIds) {
    return Appointment.find({ patient_id: { $in: patientIds } })
      .sort({ appointment_at: -1 })
      .populate(doctorPopulation)
      .lean();
  },
  async listAppointmentsForPatient(patientId) {
    return Appointment.find({ patient_id: patientId })
      .sort({ appointment_at: -1 })
      .populate(doctorPopulation)
      .lean();
  },
  async findPotentialDuplicates({ full_name, contact_number, portal_email, dob }) {
    const account = portal_email ? await AuthAccount.findOne({ email: portal_email }).select('user_profile_id email').lean() : null;
    const query = { $or: [
      { contact_number: flexiblePhoneRegex(contact_number, true) },
      { full_name: new RegExp(`^${escapeRegex(full_name)}$`, 'i'), dob },
      ...(portal_email ? [{ portal_email }] : []),
      ...(account?.user_profile_id ? [{ user_profile_id: account.user_profile_id }] : []),
    ] };
    const patients = await Patient.find(query).limit(10).lean();
    const profileIds = patients.map(item => item.user_profile_id).filter(Boolean);
    const accounts = profileIds.length
      ? await AuthAccount.find({ user_profile_id: { $in: profileIds } }).select('user_profile_id email').lean()
      : [];
    const accountEmails = new Map(accounts.map(item => [String(item.user_profile_id), item.email]));
    return patients.map(item => ({ ...item, account_email: item.user_profile_id ? accountEmails.get(String(item.user_profile_id)) ?? null : null }));
  },
  async findAuthAccountByEmail(email) { return email ? AuthAccount.findOne({ email }).select('_id user_profile_id').lean() : null; },
  async createPatient(data) { return (await Patient.create(data)).toObject(); },
  async findPatientById(id) {
    const patient = await Patient.findById(id).populate(pwdVerificationPopulation).lean();
    if (!patient?.user_profile_id) return patient;
    const account = await AuthAccount.findOne({ user_profile_id: patient.user_profile_id }).select('email').lean();
    return { ...patient, account_email: account?.email ?? null };
  },
  async doctorExists(id) { return Boolean(await Doctor.exists({ _id: id })); },
  async createAppointment(data) { return (await Appointment.create(data)).toObject(); },
  async findAppointmentById(id) { return Appointment.findById(id).lean(); },
  async confirmArrivalEligible(id, timestamp, start, end, expectedAppointmentAt) {
    return Appointment.findOneAndUpdate(
      { _id: id, status: { $in: ['pending', 'confirmed'] }, check_in_at: null, appointment_at: { $eq: expectedAppointmentAt, $gte: start, $lt: end } },
      { $set: { status: 'confirmed', check_in_at: timestamp } },
      { new: true, runValidators: true },
    ).populate(queuePopulation).lean();
  },
  async changePriorityWithAudit(id, previousPriority, input, staffActorId) {
    const session = await mongoose.startSession();
    try {
      let result = null;
      await session.withTransaction(async () => {
        const appointment = await Appointment.findOneAndUpdate(
          { _id: id, status: 'confirmed', check_in_at: { $ne: null }, priority: previousPriority },
          { $set: { priority: input.priority } },
          { new: true, runValidators: true, session },
        ).populate(queuePopulation).lean();
        if (!appointment) return;
        const [audit] = await AppointmentPriorityAudit.create([{
          appointment_id: id,
          previous_priority: previousPriority,
          new_priority: input.priority,
          urgency_reason: input.urgency_reason,
          explanation: input.explanation,
          correction_reason: input.correction_reason,
          staff_actor_user_profile_id: staffActorId,
        }], { session });
        result = { appointment, audit: audit.toObject() };
      });
      return result;
    } finally {
      await session.endSession();
    }
  },
  async listPriorityHistory(id) {
    return AppointmentPriorityAudit.find({ appointment_id: id }).sort({ created_at: 1, _id: 1 }).populate(auditActorPopulation).lean();
  },
  async markNoShowEligible(id, cutoff, expectedAppointmentAt) {
    return Appointment.findOneAndUpdate({ _id: id, status: { $in: ['pending', 'confirmed'] }, check_in_at: null, appointment_at: { $eq: expectedAppointmentAt, $lte: cutoff } }, { $set: { status: 'no_show' } }, { new: true, runValidators: true }).populate(queuePopulation).lean();
  },
  async cancelEligible(id) {
    return Appointment.findOneAndUpdate(
      { _id: id, status: { $in: ['pending', 'confirmed'] }, check_in_at: null },
      { $set: { status: 'cancelled' } },
      { new: true, runValidators: true },
    ).populate(queuePopulation).lean();
  },
  async listWaitingBetween(start, end) {
    return Appointment.find({ status: 'confirmed', check_in_at: { $ne: null }, appointment_at: { $gte: start, $lt: end } }).populate(queuePopulation).lean();
  },
  async listRecordSummaries(patientId) {
    return MedicalRecord.find({ patient_id: patientId })
      .select('patient_id doctor_id encounter_at')
      .sort({ encounter_at: -1 })
      .populate({ path: 'patient_id', select: 'full_name' })
      .populate(doctorPopulation)
      .lean();
  },
};
