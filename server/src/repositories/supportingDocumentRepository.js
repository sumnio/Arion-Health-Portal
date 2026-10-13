import {
  Appointment,
  ConsultationSupportingDocument,
  Doctor,
  MedicalRecord,
  Patient,
} from '../models/index.js';

export const supportingDocumentRepository = Object.freeze({
  async findPatientByUserProfileId(userProfileId) {
    return Patient.findOne({ user_profile_id: userProfileId }).lean();
  },
  async findDoctorByUserProfileId(userProfileId) {
    return Doctor.findOne({ user_profile_id: userProfileId }).lean();
  },
  async findAppointmentById(appointmentId) {
    return Appointment.findById(appointmentId).lean();
  },
  async medicalRecordExists(appointmentId) {
    return Boolean(await MedicalRecord.exists({ appointment_id: appointmentId }));
  },
  async listByAppointment(appointmentId) {
    return ConsultationSupportingDocument.find({ appointment_id: appointmentId })
      .sort({ slot: 1 })
      .lean();
  },
  async createMany(items) {
    return (await ConsultationSupportingDocument.insertMany(items)).map(item => item.toObject());
  },
  async deleteByIds(ids) {
    if (ids.length) await ConsultationSupportingDocument.deleteMany({ _id: { $in: ids } });
  },
  async deleteByStorageFileIds(ids) {
    if (ids.length) await ConsultationSupportingDocument.deleteMany({ storage_file_id: { $in: ids } });
  },
  async findForPatient({ documentId, appointmentId, patientId }) {
    return ConsultationSupportingDocument.findOne({
      _id: documentId,
      appointment_id: appointmentId,
      patient_id: patientId,
    }).lean();
  },
  async findForAppointment({ documentId, appointmentId }) {
    return ConsultationSupportingDocument.findOne({
      _id: documentId,
      appointment_id: appointmentId,
    }).lean();
  },
});
