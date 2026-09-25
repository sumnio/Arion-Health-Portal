import mongoose from 'mongoose';
import {
  Appointment,
  Doctor,
  MedicalCertificate,
  MedicalRecord,
  Patient,
  Prescription,
} from '../models/index.js';

const doctorPopulation = {
  path: 'doctor_id',
  select: 'specialty license_number ptr_number signature_path user_profile_id',
  populate: { path: 'user_profile_id', select: 'display_name' },
};
const patientPopulation = { path: 'patient_id', select: 'full_name dob sex contact_number allergies is_pwd' };
const recordPopulation = [doctorPopulation, patientPopulation, { path: 'appointment_id', select: 'appointment_at status visit_type reason check_in_at' }];

export const clinicalRepository = {
  async findDoctorByUserProfileId(userProfileId) {
    return Doctor.findOne({ user_profile_id: userProfileId }).lean();
  },
  async findPatientByUserProfileId(userProfileId) {
    return Patient.findOne({ user_profile_id: userProfileId }).lean();
  },
  async findPatientById(patientId) { return Patient.findById(patientId).lean(); },
  async findAppointmentById(id) { return Appointment.findById(id).lean(); },
  async findRecordByAppointmentId(id) { return MedicalRecord.findOne({ appointment_id: id }).lean(); },
  async listAppointmentsForDoctor(doctorId, { start, end, patientId } = {}) {
    const query = { doctor_id: doctorId };
    if (patientId) query.patient_id = patientId;
    if (start && end) query.appointment_at = { $gte: start, $lt: end };
    return Appointment.find(query).sort({ appointment_at: 1 }).populate(patientPopulation).lean();
  },
  async listRecordAppointmentIds(appointmentIds) {
    return MedicalRecord.find({ appointment_id: { $in: appointmentIds } }).select('_id appointment_id').lean();
  },

  async createRecordWithPrescriptions(recordData, prescriptionInputs) {
    const session = await mongoose.startSession();
    try {
      let record;
      let prescriptions = [];
      try {
        await session.withTransaction(async () => {
          [record] = await MedicalRecord.create([recordData], { session });
          if (prescriptionInputs.length) {
            prescriptions = await Prescription.create(
              prescriptionInputs.map((item) => ({ ...item, medical_record_id: record._id })),
              { session },
            );
          }
        });
      } catch (error) {
        const transactionUnavailable = error?.code === 20 || /Transaction numbers are only allowed|replica set/i.test(error?.message ?? '');
        if (!transactionUnavailable) throw error;
        record = await MedicalRecord.create(recordData);
        try {
          if (prescriptionInputs.length) {
            prescriptions = await Prescription.create(
              prescriptionInputs.map((item) => ({ ...item, medical_record_id: record._id })),
            );
          }
        } catch (creationError) {
          await Prescription.deleteMany({ medical_record_id: record._id });
          await MedicalRecord.deleteOne({ _id: record._id });
          throw creationError;
        }
      }
      return { record: record.toObject(), prescriptions: prescriptions.map((item) => item.toObject()) };
    } finally {
      await session.endSession();
    }
  },

  async listRecordsForPatient(patientId) {
    return MedicalRecord.find({ patient_id: patientId }).sort({ encounter_at: -1 }).populate(recordPopulation).lean();
  },
  async findRecordForPatient(recordId, patientId) {
    return MedicalRecord.findOne({ _id: recordId, patient_id: patientId }).populate(recordPopulation).lean();
  },
  async listRecordsForDoctorPatient(doctorId, patientId) {
    return MedicalRecord.find({ doctor_id: doctorId, patient_id: patientId }).sort({ encounter_at: -1 }).populate(recordPopulation).lean();
  },
  async findRecordForDoctor(recordId, doctorId) {
    return MedicalRecord.findOne({ _id: recordId, doctor_id: doctorId }).populate(recordPopulation).lean();
  },
  async listPrescriptions(recordId) {
    return Prescription.find({ medical_record_id: recordId }).sort({ created_at: 1 }).lean();
  },

  async createCertificate(data) { return (await MedicalCertificate.create(data)).toObject(); },
  async listIssuedCertificatesForPatient(patientId) {
    return MedicalCertificate.find({ patient_id: patientId, status: 'issued' }).sort({ date_issued: -1 }).populate(doctorPopulation).lean();
  },
  async findIssuedCertificateForPatient(id, patientId) {
    return MedicalCertificate.findOne({ _id: id, patient_id: patientId, status: 'issued' }).populate(doctorPopulation).lean();
  },
  async findCertificateForDoctor(id, doctorId) {
    return MedicalCertificate.findOne({ _id: id, doctor_id: doctorId }).populate(doctorPopulation).lean();
  },
  async listIssuedCertificatesForDoctorPatient(doctorId, patientId) {
    return MedicalCertificate.find({ doctor_id: doctorId, patient_id: patientId, status: 'issued' })
      .sort({ date_issued: -1 })
      .populate(doctorPopulation)
      .lean();
  },

  async completeConfirmedCheckedIn(id, doctorId) {
    return Appointment.findOneAndUpdate(
      { _id: id, doctor_id: doctorId, status: 'confirmed', check_in_at: { $ne: null } },
      { $set: { status: 'completed' } },
      { new: true, runValidators: true },
    ).lean();
  },
};
