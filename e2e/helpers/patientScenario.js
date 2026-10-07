import { randomUUID } from 'node:crypto';
import {
  Appointment,
  AppointmentPriorityAudit,
  AuthAccount,
  Doctor,
  DoctorAvailability,
  DoctorBlockedTime,
  DoctorPublishedAvailability,
  MedicalCertificate,
  MedicalRecord,
  Patient,
  Prescription,
  Staff,
  UserProfile,
} from '../../server/src/models/index.js';
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

export class PatientScenario {
  constructor() {
    this.marker = randomUUID();
    this.profileIds = [];
    this.patientIds = [];
    this.doctorIds = [];
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

    if (certificateQuery.$or.length) await MedicalCertificate.deleteMany(certificateQuery);
    if (recordIds.length) await Prescription.deleteMany({ medical_record_id: { $in: recordIds } });
    if (recordQuery.$or.length) await MedicalRecord.deleteMany(recordQuery);
    if (appointmentIds.length) await AppointmentPriorityAudit.deleteMany({ appointment_id: { $in: appointmentIds } });
    if (appointmentQuery.$or.length) await Appointment.deleteMany(appointmentQuery);
    if (doctorIds.length) {
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
