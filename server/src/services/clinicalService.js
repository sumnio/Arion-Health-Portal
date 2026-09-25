import { generateCertificateNumber } from '../utils/certificateNumber.js';
import { httpError } from '../utils/httpError.js';
import {
  validateCertificateCreate,
  validateClinicalObjectId,
  validateMedicalRecordCreate,
} from '../validation/clinicalValidation.js';
import { addDays, isValidDateOnly, zonedDateTimeToUtc } from '../utils/schedulingTime.js';

function id(value) {
  const resolved = value?._id ?? value?.id ?? value;
  return resolved == null ? null : String(resolved);
}
function duplicateKey(error) { return error?.code === 11000; }
function iso(value) { return value ? new Date(value).toISOString() : null; }
function date(value) { return value ? new Date(value).toISOString().slice(0, 10) : null; }

function doctorView(doctor) {
  return {
    id: id(doctor),
    display_name: doctor?.user_profile_id?.display_name ?? null,
    specialty: doctor?.specialty ?? null,
    license_number: doctor?.license_number ?? null,
    ptr_number: doctor?.ptr_number ?? null,
    signature_available: Boolean(doctor?.signature_path),
  };
}

function patientView(patient) {
  return {
    id: id(patient), full_name: patient?.full_name ?? null,
    dob: patient?.dob ? new Date(patient.dob).toISOString().slice(0, 10) : null,
    sex: patient?.sex ?? null, contact_number: patient?.contact_number ?? null,
    allergies: patient?.allergies ?? [], is_pwd: patient?.is_pwd === true,
  };
}

function appointmentView(appointment) {
  if (!appointment) return null;
  return {
    id: id(appointment), appointment_at: iso(appointment.appointment_at), status: appointment.status,
    visit_type: appointment.visit_type, reason: appointment.reason, check_in_at: iso(appointment.check_in_at),
  };
}

function prescriptionView(item) {
  return { id: id(item), medicine: item.medicine, dosage: item.dosage, instructions: item.instructions ?? null };
}

async function presentRecord(repository, record, suppliedPrescriptions) {
  const prescriptions = suppliedPrescriptions ?? await repository.listPrescriptions(id(record));
  return {
    id: id(record), patient: patientView(record.patient_id), doctor: doctorView(record.doctor_id),
    appointment: appointmentView(record.appointment_id), encounter_at: iso(record.encounter_at),
    diagnosis: record.diagnosis, notes: record.notes ?? null, follow_up: record.follow_up ?? null,
    prescriptions: prescriptions.map(prescriptionView), created_at: iso(record.created_at), updated_at: iso(record.updated_at),
  };
}

function presentCertificate(item, clinic) {
  return {
    id: id(item), medical_certificate_number: item.medical_certificate_number,
    patient_id: id(item.patient_id), doctor: doctorView(item.doctor_id), medical_record_id: id(item.medical_record_id),
    date_issued: date(item.date_issued), purpose: item.purpose, diagnosis_summary: item.diagnosis_summary,
    valid_until: date(item.valid_until), status: item.status, clinic,
    created_at: iso(item.created_at), updated_at: iso(item.updated_at),
  };
}

export function createClinicalService({ repository, clinic, now = () => new Date(), numberGenerator = generateCertificateNumber }) {
  async function doctorFor(profileId) {
    const doctor = await repository.findDoctorByUserProfileId(profileId);
    if (!doctor) throw httpError(403, 'DOCTOR_PROFILE_REQUIRED', 'An active Doctor profile is required.');
    return doctor;
  }
  async function patientFor(profileId) {
    const patient = await repository.findPatientByUserProfileId(profileId);
    if (!patient) throw httpError(404, 'PATIENT_PROFILE_NOT_FOUND', 'Patient profile was not found.');
    return patient;
  }

  return {
    async listDoctorAppointments(profileId, filters = {}) {
      const doctor = await doctorFor(profileId);
      let start;
      let end;
      if (filters.date != null) {
        if (!isValidDateOnly(filters.date)) throw httpError(400, 'VALIDATION_ERROR', 'date must use YYYY-MM-DD.');
        start = zonedDateTimeToUtc(filters.date, '00:00', clinic.timeZone);
        end = zonedDateTimeToUtc(addDays(filters.date, 1), '00:00', clinic.timeZone);
      }
      if (filters.patient_id != null) validateClinicalObjectId(filters.patient_id, 'patient_id');
      const appointments = await repository.listAppointmentsForDoctor(id(doctor), { start, end, patientId: filters.patient_id });
      const records = await repository.listRecordAppointmentIds(appointments.map((item) => item._id ?? item.id));
      const recordByAppointment = new Map(records.map((record) => [id(record.appointment_id), id(record)]));
      return appointments.map((appointment) => ({
        ...appointmentView(appointment), patient: patientView(appointment.patient_id),
        priority: appointment.priority, medical_record_id: recordByAppointment.get(id(appointment)) ?? null,
      }));
    },
    async createRecord(profileId, appointmentId, body) {
      validateClinicalObjectId(appointmentId, 'appointmentId');
      const input = validateMedicalRecordCreate(body);
      const doctor = await doctorFor(profileId);
      const appointment = await repository.findAppointmentById(appointmentId);
      if (!appointment) throw httpError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment was not found.');
      if (id(appointment.doctor_id) !== id(doctor)) throw httpError(403, 'FORBIDDEN', 'This appointment is assigned to another Doctor.');
      if (appointment.status !== 'confirmed') throw httpError(409, 'APPOINTMENT_NOT_ELIGIBLE', 'Only a confirmed appointment can receive a medical record.');
      if (await repository.findRecordByAppointmentId(appointmentId)) throw httpError(409, 'MEDICAL_RECORD_EXISTS', 'This appointment already has a medical record.');
      try {
        const created = await repository.createRecordWithPrescriptions({
          patient_id: appointment.patient_id, doctor_id: doctor._id ?? doctor.id,
          appointment_id: appointment._id ?? appointment.id, encounter_at: now(),
          diagnosis: input.diagnosis, notes: input.notes, follow_up: input.follow_up,
        }, input.prescriptions);
        created.record.patient_id = await repository.findPatientById(id(appointment.patient_id));
        created.record.doctor_id = doctor;
        created.record.appointment_id = appointment;
        return presentRecord(repository, created.record, created.prescriptions);
      } catch (error) {
        if (duplicateKey(error)) throw httpError(409, 'MEDICAL_RECORD_EXISTS', 'This appointment already has a medical record.');
        throw error;
      }
    },

    async listDoctorPatientRecords(profileId, patientId) {
      validateClinicalObjectId(patientId, 'patientId');
      const doctor = await doctorFor(profileId);
      return Promise.all((await repository.listRecordsForDoctorPatient(id(doctor), patientId)).map((item) => presentRecord(repository, item)));
    },
    async listDoctorPatientCertificates(profileId, patientId) {
      validateClinicalObjectId(patientId, 'patientId');
      const doctor = await doctorFor(profileId);
      const items = repository.listIssuedCertificatesForDoctorPatient
        ? await repository.listIssuedCertificatesForDoctorPatient(id(doctor), patientId)
        : [];
      return items
        .map((item) => presentCertificate(item, clinic));
    },
    async getDoctorRecord(profileId, recordId) {
      validateClinicalObjectId(recordId, 'recordId');
      const doctor = await doctorFor(profileId);
      const record = await repository.findRecordForDoctor(recordId, id(doctor));
      if (!record) throw httpError(404, 'MEDICAL_RECORD_NOT_FOUND', 'Medical record was not found.');
      return presentRecord(repository, record);
    },
    async listPatientRecords(profileId) {
      const patient = await patientFor(profileId);
      return Promise.all((await repository.listRecordsForPatient(id(patient))).map((item) => presentRecord(repository, item)));
    },
    async getPatientRecord(profileId, recordId) {
      validateClinicalObjectId(recordId, 'recordId');
      const patient = await patientFor(profileId);
      const record = await repository.findRecordForPatient(recordId, id(patient));
      if (!record) throw httpError(404, 'MEDICAL_RECORD_NOT_FOUND', 'Medical record was not found.');
      return presentRecord(repository, record);
    },

    async createCertificate(profileId, recordId, body) {
      validateClinicalObjectId(recordId, 'recordId');
      const input = validateCertificateCreate(body);
      const doctor = await doctorFor(profileId);
      const record = await repository.findRecordForDoctor(recordId, id(doctor));
      if (!record) throw httpError(404, 'MEDICAL_RECORD_NOT_FOUND', 'Medical record was not found.');
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const created = await repository.createCertificate({
            ...input, medical_certificate_number: numberGenerator(input.date_issued),
            patient_id: record.patient_id?._id ?? record.patient_id,
            doctor_id: doctor._id ?? doctor.id, medical_record_id: record._id ?? record.id, status: 'issued',
          });
          created.doctor_id = doctor;
          return presentCertificate(created, clinic);
        } catch (error) {
          if (!duplicateKey(error)) throw error;
        }
      }
      throw httpError(409, 'CERTIFICATE_NUMBER_CONFLICT', 'A unique certificate number could not be generated.');
    },
    async getDoctorCertificate(profileId, certificateId) {
      validateClinicalObjectId(certificateId, 'certificateId');
      const doctor = await doctorFor(profileId);
      const certificate = await repository.findCertificateForDoctor(certificateId, id(doctor));
      if (!certificate) throw httpError(404, 'CERTIFICATE_NOT_FOUND', 'Medical certificate was not found.');
      return presentCertificate(certificate, clinic);
    },
    async listPatientCertificates(profileId) {
      const patient = await patientFor(profileId);
      return (await repository.listIssuedCertificatesForPatient(id(patient))).map((item) => presentCertificate(item, clinic));
    },
    async getPatientCertificate(profileId, certificateId) {
      validateClinicalObjectId(certificateId, 'certificateId');
      const patient = await patientFor(profileId);
      const certificate = await repository.findIssuedCertificateForPatient(certificateId, id(patient));
      if (!certificate) throw httpError(404, 'CERTIFICATE_NOT_FOUND', 'Medical certificate was not found.');
      return presentCertificate(certificate, clinic);
    },

    async completeConsultation(profileId, appointmentId) {
      validateClinicalObjectId(appointmentId, 'appointmentId');
      const doctor = await doctorFor(profileId);
      const appointment = await repository.findAppointmentById(appointmentId);
      if (!appointment) throw httpError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment was not found.');
      if (id(appointment.doctor_id) !== id(doctor)) throw httpError(403, 'FORBIDDEN', 'This appointment is assigned to another Doctor.');
      if (appointment.status !== 'confirmed') throw httpError(409, 'APPOINTMENT_NOT_ELIGIBLE', 'Only a confirmed appointment can be completed.');
      if (!appointment.check_in_at) throw httpError(409, 'PATIENT_NOT_CHECKED_IN', 'The patient must be checked in before completion.');
      if (!(await repository.findRecordByAppointmentId(appointmentId))) throw httpError(409, 'MEDICAL_RECORD_REQUIRED', 'Save the medical record before completing the consultation.');
      const completed = await repository.completeConfirmedCheckedIn(appointmentId, id(doctor));
      if (!completed) throw httpError(409, 'APPOINTMENT_NOT_ELIGIBLE', 'The appointment can no longer be completed.');
      return { id: id(completed), status: completed.status, medical_record_preserved: true };
    },
  };
}
