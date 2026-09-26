import { Appointment, Doctor, MedicalRecord, Patient } from '../models/index.js';

const doctorPopulation = { path: 'doctor_id', select: 'specialty user_profile_id', populate: { path: 'user_profile_id', select: 'display_name' } };
const queuePopulation = [
  { path: 'patient_id', select: 'full_name dob is_pwd sex contact_number' },
  doctorPopulation,
];
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
    if (!query) return Patient.find({}).sort({ full_name: 1 }).limit(50).lean();
    const pattern = new RegExp(escapeRegex(query), 'i');
    const phonePattern = flexiblePhoneRegex(query);
    return Patient.find({ $or: [{ full_name: pattern }, { contact_number: phonePattern ?? pattern }] }).sort({ full_name: 1 }).limit(50).lean();
  },
  async findPotentialDuplicate({ full_name, contact_number, dob }) {
    return Patient.findOne({ $or: [
      { contact_number: flexiblePhoneRegex(contact_number, true) },
      { full_name: new RegExp(`^${escapeRegex(full_name)}$`, 'i'), dob },
    ] }).lean();
  },
  async createPatient(data) { return (await Patient.create(data)).toObject(); },
  async findPatientById(id) { return Patient.findById(id).lean(); },
  async doctorExists(id) { return Boolean(await Doctor.exists({ _id: id })); },
  async createAppointment(data) { return (await Appointment.create(data)).toObject(); },
  async findAppointmentById(id) { return Appointment.findById(id).lean(); },
  async checkInConfirmed(id, timestamp) {
    return Appointment.findOneAndUpdate({ _id: id, status: 'confirmed', check_in_at: null }, { $set: { check_in_at: timestamp } }, { new: true, runValidators: true }).populate(queuePopulation).lean();
  },
  async updatePriorityEligible(id, priority) {
    return Appointment.findOneAndUpdate({ _id: id, status: { $in: ['pending', 'confirmed'] } }, { $set: { priority } }, { new: true, runValidators: true }).populate(queuePopulation).lean();
  },
  async markNoShowEligible(id, now) {
    return Appointment.findOneAndUpdate({ _id: id, status: { $in: ['pending', 'confirmed'] }, check_in_at: null, appointment_at: { $lte: now } }, { $set: { status: 'no_show' } }, { new: true, runValidators: true }).populate(queuePopulation).lean();
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
      .select('patient_id doctor_id encounter_at diagnosis')
      .sort({ encounter_at: -1 })
      .populate({ path: 'patient_id', select: 'full_name' })
      .populate(doctorPopulation)
      .lean();
  },
};
