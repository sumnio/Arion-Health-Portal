import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import {
  Appointment,
  AppointmentPriorityAudit,
  AuthAccount,
  ConsultationSupportingDocument,
  Doctor,
  DoctorSignature,
  DoctorAvailability,
  DoctorBlockedTime,
  DoctorPublishedAvailability,
  MedicalCertificate,
  MedicalRecord,
  Notification,
  Patient,
  Prescription,
  Staff,
  UserProfile,
} from '../../server/src/models/index.js';
import { createGridFsSupportingDocumentStorage } from '../../server/src/services/supportingDocumentStorage.js';
import { createGridFsDoctorSignatureStorage } from '../../server/src/services/doctorSignatureStorage.js';
import { createGridFsCertificateArtifactStorage } from '../../server/src/services/certificateArtifactStorage.js';
import { authRepository } from '../../server/src/repositories/authRepository.js';
import { passwordService } from '../../server/src/services/passwordService.js';
import {
  addDays,
  clinicDate,
  dateOnlyToUtc,
  zonedDateTimeToUtc,
} from '../../server/src/utils/schedulingTime.js';

export const E2E_CLINIC_TIME_ZONE = 'Asia/Manila';

function marked(prefix, marker) {
  return `e2e-${prefix}-${marker}`;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const value = Buffer.alloc(12 + data.length); value.writeUInt32BE(data.length, 0); value.write(type, 4, 4, 'ascii'); data.copy(value, 8); return value;
}

function syntheticSignaturePng(width = 400, height = 120) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 4, 255); row[0] = 0;
    for (let x = 0; x < width; x += 1) { const p = 1 + x * 4; row[p] = 10; row[p + 1] = 70; row[p + 2] = 140; row[p + 3] = Math.abs(y - (60 + Math.sin(x / 25) * 15)) < 4 ? 255 : 0; }
    rows.push(row);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(Buffer.concat(rows))), pngChunk('IEND')]);
}

export class PatientScenario {
  constructor() {
    this.marker = randomUUID();
    this.profileIds = [];
    this.patientIds = [];
    this.doctorIds = [];
    this.notificationIds = [];
  }

  today() {
    return clinicDate(new Date(), E2E_CLINIC_TIME_ZONE);
  }

  futureDate(offset = 2) {
    return addDays(this.today(), offset);
  }

  slotFor(date, time) {
    return {
      date,
      time,
      appointmentAt: zonedDateTimeToUtc(date, time, E2E_CLINIC_TIME_ZONE),
    };
  }

  async createPatient(overrides = {}) {
    const suffix = `${this.marker}-${this.patientIds.length + 1}`;
    const password = `E2e!Patient-${suffix}`;
    const data = {
      email: `${marked('patient', suffix)}@example.invalid`,
      password,
      display_name: `E2E Patient ${suffix.slice(0, 8)}`,
      full_name: `E2E Patient ${suffix.slice(0, 8)}`,
      contact_number: `09${String(Date.now() + this.patientIds.length).slice(-9)}`,
      dob: new Date('1990-01-15T00:00:00.000Z'),
      sex: 'other',
      address: null,
      emergency_contact_name: null,
      emergency_contact_number: null,
      emergency_contact_relationship: null,
      allergies: [],
      is_pwd: false,
      ...overrides,
    };
    const registration = await authRepository.createPatientRegistration({
      ...data,
      password_hash: await passwordService.hash(password),
    });
    const profileId = registration.profile.user_profile_id;
    const patientId = String(registration.patient._id);
    this.profileIds.push(profileId);
    this.patientIds.push(patientId);
    return {
      email: data.email,
      password,
      display_name: data.display_name,
      profileId,
      patientId,
      full_name: data.full_name,
      contact_number: data.contact_number,
      dob: data.dob,
    };
  }

  async createDoctor(overrides = {}) {
    const suffix = `${this.marker}-${this.doctorIds.length + 1}`;
    const password = `E2e!Doctor-${suffix}`;
    const email = `${marked('doctor', suffix)}@example.invalid`;
    const profile = await UserProfile.create({
      display_name: `E2E Doctor ${suffix.slice(0, 8)}`,
      role: 'doctor',
      contact_number: `08${String(Date.now() + this.doctorIds.length).slice(-9)}`,
      status: 'active',
      ...overrides.profile,
    });
    this.profileIds.push(String(profile._id));
    await AuthAccount.create({
      user_profile_id: profile._id,
      email,
      password_hash: await passwordService.hash(password),
    });
    const doctor = await Doctor.create({
      user_profile_id: profile._id,
      specialty: 'General Medicine',
      license_number: `LIC-E2E-${suffix}`,
      ptr_number: `PTR-E2E-${suffix}`,
      signature_path: `e2e-signatures/${suffix}.png`,
      ...overrides.doctor,
    });
    this.doctorIds.push(String(doctor._id));
    return {
      email,
      password,
      doctorId: String(doctor._id),
      profileId: String(profile._id),
      display_name: profile.display_name,
      specialty: doctor.specialty,
      license_number: doctor.license_number,
      ptr_number: doctor.ptr_number,
    };
  }

  async createDoctorSignature(doctor) {
    const signature = syntheticSignaturePng();
    const stored = await createGridFsDoctorSignatureStorage().upload({ buffer: signature, mimeType: 'image/png' });
    await DoctorSignature.create({ doctor_id: doctor.doctorId, storage_file_id: stored.storageFileId, mime_type: 'image/png', file_size: signature.length, width: 400, height: 120, uploaded_at: new Date() });
    return { storageFileId: String(stored.storageFileId), bytes: signature };
  }

  async createBookableSlot({ doctor, offset = 2, startTime = '10:00', endTime = '11:00' }) {
    const date = this.futureDate(offset);
    const dayOfWeek = dateOnlyToUtc(date).getUTCDay();
    await DoctorAvailability.create({
      doctor_id: doctor.doctorId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      is_active: true,
    });
    await DoctorPublishedAvailability.create({
      doctor_id: doctor.doctorId,
      availability_date: dateOnlyToUtc(date),
      start_time: startTime,
      end_time: endTime,
    });
    return { ...this.slotFor(date, startTime), endTime };
  }

  async createAppointment({
    patient,
    doctor,
    slot,
    status = 'pending',
    visit_type = 'general_consultation',
    reason = 'E2E consultation',
    priority = 'normal',
    check_in_at = null,
  }) {
    const appointment = await Appointment.create({
      patient_id: patient.patientId,
      doctor_id: doctor.doctorId,
      appointment_at: slot.appointmentAt,
      status,
      visit_type,
      reason,
      priority,
      check_in_at,
      created_by: patient.profileId,
    });
    return { appointmentId: String(appointment._id), ...appointment.toObject() };
  }

  async createNotification({ recipient, title, message, type = 'appointment_created', isRead = false, patientDisplayName = null, doctorDisplayName = null, appointmentAt = null }) {
    const notification = await Notification.create({
      recipient_user_profile_id: recipient.profileId,
      recipient_role: recipient.role,
      type,
      title,
      message,
      patient_display_name: patientDisplayName,
      doctor_display_name: doctorDisplayName,
      appointment_at: appointmentAt,
      related_resource_type: null,
      related_resource_id: null,
      is_read: isRead,
      read_at: isRead ? new Date() : null,
      created_at: new Date(Date.now() + this.notificationIds.length),
    });
    this.notificationIds.push(String(notification._id));
    return { notificationId: String(notification._id), ...notification.toObject() };
  }

  async createRecord({ patient, doctor, appointment, diagnosis = 'E2E seasonal allergy', prescriptions = true }) {
    const record = await MedicalRecord.create({
      patient_id: patient.patientId,
      doctor_id: doctor.doctorId,
      appointment_id: appointment.appointmentId,
      encounter_at: new Date(),
      diagnosis,
      notes: 'E2E read-only doctor note',
      follow_up: 'Return if symptoms continue.',
    });
    if (prescriptions) {
      await Prescription.create({
        medical_record_id: record._id,
        medicine: 'E2E Cetirizine',
        dosage: '10 mg',
        instructions: 'Take once daily after dinner.',
      });
    }
    return { recordId: String(record._id), ...record.toObject() };
  }

  async createCertificate({ patient, doctor, record, purpose = 'Fitness for work' }) {
    const dateIssued = dateOnlyToUtc(this.today());
    const certificate = await MedicalCertificate.create({
      medical_certificate_number: `E2E-MC-${this.marker}-${Date.now()}`,
      patient_id: patient.patientId,
      doctor_id: doctor.doctorId,
      medical_record_id: record?.recordId ?? null,
      date_issued: dateIssued,
      purpose,
      diagnosis_summary: record?.diagnosis ?? 'E2E diagnosis summary',
      valid_until: dateOnlyToUtc(addDays(this.today(), 7)),
      status: 'issued',
    });
    return { certificateId: String(certificate._id), ...certificate.toObject() };
  }

  async cleanup() {
    const patientIds = this.patientIds;
    const doctorIds = this.doctorIds;
    const profileIds = this.profileIds;
    if (this.notificationIds.length || profileIds.length) {
      await Notification.deleteMany({
        $or: [
          ...(this.notificationIds.length ? [{ _id: { $in: this.notificationIds } }] : []),
          ...(profileIds.length ? [{ recipient_user_profile_id: { $in: profileIds } }] : []),
        ],
      });
    }
    const appointmentQuery = {
      $or: [
        ...(patientIds.length ? [{ patient_id: { $in: patientIds } }] : []),
        ...(doctorIds.length ? [{ doctor_id: { $in: doctorIds } }] : []),
      ],
    };
    const appointmentIds = appointmentQuery.$or.length
      ? await Appointment.find(appointmentQuery).distinct('_id')
      : [];
    const recordQuery = {
      $or: [
        ...(patientIds.length ? [{ patient_id: { $in: patientIds } }] : []),
        ...(doctorIds.length ? [{ doctor_id: { $in: doctorIds } }] : []),
        ...(appointmentIds.length ? [{ appointment_id: { $in: appointmentIds } }] : []),
      ],
    };
    const recordIds = recordQuery.$or.length
      ? await MedicalRecord.find(recordQuery).distinct('_id')
      : [];
    const certificateQuery = {
      $or: [
        ...(patientIds.length ? [{ patient_id: { $in: patientIds } }] : []),
        ...(doctorIds.length ? [{ doctor_id: { $in: doctorIds } }] : []),
        ...(recordIds.length ? [{ medical_record_id: { $in: recordIds } }] : []),
      ],
    };

    if (certificateQuery.$or.length) {
      const certificates = await MedicalCertificate.find(certificateQuery).select('pdf_storage_file_id').lean();
      const certificateStorage = createGridFsCertificateArtifactStorage();
      await Promise.allSettled(certificates.filter(item => item.pdf_storage_file_id).map(item => certificateStorage.delete(item.pdf_storage_file_id)));
      await MedicalCertificate.deleteMany(certificateQuery);
    }
    if (recordIds.length) await Prescription.deleteMany({ medical_record_id: { $in: recordIds } });
    if (recordQuery.$or.length) await MedicalRecord.deleteMany(recordQuery);
    if (appointmentIds.length) {
      const supportingDocuments = await ConsultationSupportingDocument.find({ appointment_id: { $in: appointmentIds } }).lean();
      const storage = createGridFsSupportingDocumentStorage();
      await Promise.allSettled(supportingDocuments.map((item) => storage.delete(item.storage_file_id)));
      await ConsultationSupportingDocument.deleteMany({ appointment_id: { $in: appointmentIds } });
    }
    if (appointmentIds.length) await AppointmentPriorityAudit.deleteMany({ appointment_id: { $in: appointmentIds } });
    if (appointmentQuery.$or.length) await Appointment.deleteMany(appointmentQuery);
    if (doctorIds.length) {
      const signatures = await DoctorSignature.find({ doctor_id: { $in: doctorIds } }).lean();
      const signatureStorage = createGridFsDoctorSignatureStorage();
      await Promise.allSettled(signatures.map(item => signatureStorage.delete(item.storage_file_id)));
      await DoctorSignature.deleteMany({ doctor_id: { $in: doctorIds } });
      await DoctorBlockedTime.deleteMany({ doctor_id: { $in: doctorIds } });
      await DoctorPublishedAvailability.deleteMany({ doctor_id: { $in: doctorIds } });
      await DoctorAvailability.deleteMany({ doctor_id: { $in: doctorIds } });
      await Doctor.deleteMany({ _id: { $in: doctorIds } });
    }
    if (patientIds.length) await Patient.deleteMany({ _id: { $in: patientIds } });
    if (profileIds.length) {
      await AuthAccount.deleteMany({ user_profile_id: { $in: profileIds } });
      await Staff.deleteMany({ user_profile_id: { $in: profileIds } });
      await UserProfile.deleteMany({ _id: { $in: profileIds } });
    }
  }
}
