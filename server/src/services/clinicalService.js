import { createHash } from 'node:crypto';
import { generateCertificateNumber } from '../utils/certificateNumber.js';
import { httpError } from '../utils/httpError.js';
import {
  validateCertificateCreate,
  validateDoctorAppointmentHistoryQuery,
  validateDoctorAppointmentQuery,
  validateClinicalObjectId,
  validateMedicalRecordCreate,
} from '../validation/clinicalValidation.js';
import { addDays, clinicDate, dateOnlyToUtc, isValidDateOnly, zonedDateTimeToUtc } from '../utils/schedulingTime.js';
import { buildCertificateStatement, certificatePurposeDisplay } from './certificateContent.js';
import { invokeNotificationTrigger } from './notificationTriggerService.js';
import { invokeSmsReminderWorkflow } from './smsReminderWorkflow.js';
import { CERTIFICATE_PDF_RENDER_VERSION, buildCertificatePdf } from './certificatePdfService.js';

function id(value) {
  const resolved = value?._id ?? value?.id ?? value;
  return resolved == null ? null : String(resolved);
}
function duplicateKey(error) { return error?.code === 11000; }
function iso(value) { return value ? new Date(value).toISOString() : null; }
function date(value) { return value ? new Date(value).toISOString().slice(0, 10) : null; }
async function streamBuffer(stream, maximum = 2 * 1024 * 1024) {
  const chunks = []; let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > maximum) throw httpError(422, 'DOCTOR_SIGNATURE_INVALID', 'The configured Doctor signature cannot be used.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function priorityAuditView(item) {
  return {
    id: id(item), appointment_id: id(item.appointment_id), previous_priority: item.previous_priority,
    new_priority: item.new_priority, urgency_reason: item.urgency_reason ?? null,
    explanation: item.explanation ?? null, correction_reason: item.correction_reason ?? null,
    staff_actor: { id: id(item.staff_actor_user_profile_id), display_name: item.staff_actor_user_profile_id?.display_name ?? null },
    changed_at: iso(item.created_at),
  };
}

function doctorView(doctor, signatureAvailable = Boolean(doctor?.signature_path)) {
  return {
    id: id(doctor),
    display_name: doctor?.user_profile_id?.display_name ?? null,
    specialty: doctor?.specialty ?? null,
    license_number: doctor?.license_number ?? null,
    ptr_number: doctor?.ptr_number ?? null,
    signature_available: signatureAvailable,
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

export function doctorHistoryDateRange(filters, current, timeZone) {
  const today = clinicDate(current, timeZone);
  let from = filters.from;
  let to = filters.to;
  if (filters.range === 'today') from = to = today;
  if (filters.range === 'last_7_days') { from = addDays(today, -6); to = today; }
  if (filters.range === 'last_30_days') { from = addDays(today, -29); to = today; }
  if (filters.range === 'this_month') { from = `${today.slice(0, 7)}-01`; to = today; }
  const start = zonedDateTimeToUtc(from, '00:00', timeZone);
  const inclusiveDayEnd = zonedDateTimeToUtc(addDays(to, 1), '00:00', timeZone);
  const end = inclusiveDayEnd < current ? inclusiveDayEnd : current;
  return { from, to, start, end };
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
  const medicalRecord = item.medical_record_id;
  const appointment = medicalRecord?.appointment_id;
  const timeZone = clinic.timeZone ?? 'Asia/Manila';
  const purpose = certificatePurposeDisplay({ purposeCode: item.purpose_code, customPurpose: item.custom_purpose, legacyPurpose: item.purpose });
  return {
    id: id(item), medical_certificate_number: item.medical_certificate_number,
    patient_id: id(item.patient_id), doctor: doctorView(item.doctor_id, Boolean(item.pdf_storage_file_id) || Boolean(item.doctor_id?.signature_path)), medical_record_id: id(item.medical_record_id),
    date_issued: date(item.date_issued), purpose, purpose_code: item.purpose_code ?? null,
    custom_purpose: item.custom_purpose ?? null, diagnosis_summary: item.diagnosis_summary,
    recommendation: item.recommendation ?? null,
    statement: buildCertificateStatement({ purposeCode: item.purpose_code, customPurpose: item.custom_purpose, legacyPurpose: item.purpose }),
    consultation_date: appointment?.appointment_at ? clinicDate(new Date(appointment.appointment_at), timeZone) : null,
    valid_until: date(item.valid_until), status: item.status, clinic,
    pdf_available: Boolean(item.pdf_storage_file_id), legacy_pdf: !item.pdf_storage_file_id,
    created_at: iso(item.created_at), updated_at: iso(item.updated_at),
  };
}

function certificatePdfData(item, clinic) {
  const record = item.medical_record_id;
  const appointment = record?.appointment_id;
  const patient = item.patient_id ?? record?.patient_id;
  const doctor = item.doctor_id;
  return {
    medical_certificate_number: item.medical_certificate_number,
    date_issued: date(item.date_issued),
    consultation_date: appointment?.appointment_at ? clinicDate(new Date(appointment.appointment_at), clinic.timeZone ?? 'Asia/Manila') : null,
    valid_until: date(item.valid_until),
    patient_name: patient?.full_name ?? 'Patient', patient_dob: date(patient?.dob), patient_sex: patient?.sex ?? null,
    purpose: certificatePurposeDisplay({ purposeCode: item.purpose_code, customPurpose: item.custom_purpose, legacyPurpose: item.purpose }),
    statement: buildCertificateStatement({ purposeCode: item.purpose_code, customPurpose: item.custom_purpose, legacyPurpose: item.purpose }),
    diagnosis_summary: item.diagnosis_summary, recommendation: item.recommendation,
    doctor_name: doctor?.user_profile_id?.display_name ?? 'Issuing Doctor', doctor_specialty: doctor?.specialty ?? 'Not available',
    license_number: doctor?.license_number ?? 'Not available', ptr_number: doctor?.ptr_number ?? 'Not available', clinic,
  };
}

export function createClinicalService({ repository, clinic, notificationTriggers, smsReminders, doctorSignatureService, certificateArtifactStorage, pdfRenderer = buildCertificatePdf, now = () => new Date(), numberGenerator = generateCertificateNumber, certificateIssuanceEnabled = true }) {
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
      filters = validateDoctorAppointmentQuery(filters);
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
    async listDoctorAppointmentHistory(profileId, query = {}) {
      const filters = validateDoctorAppointmentHistoryQuery(query);
      const doctor = await doctorFor(profileId);
      const current = now();
      const range = doctorHistoryDateRange(filters, current, clinic.timeZone);
      const statuses = filters.status === 'all' ? ['completed', 'cancelled', 'no_show'] : [filters.status];
      const result = range.start < range.end
        ? await repository.listDoctorAppointmentHistory(id(doctor), {
          start: range.start,
          end: range.end,
          statuses,
          patientSearch: filters.patient_search,
          visitType: filters.visit_type === 'all' ? null : filters.visit_type,
          page: filters.page,
          limit: filters.limit,
        })
        : { items: [], total: 0 };
      const records = await repository.listRecordAppointmentIds(result.items.map((item) => item._id ?? item.id));
      const recordByAppointment = new Map(records.map((record) => [id(record.appointment_id), id(record)]));
      return {
        items: result.items.map((appointment) => ({
          ...appointmentView(appointment),
          patient: { id: id(appointment.patient_id), full_name: appointment.patient_id?.full_name ?? null },
          medical_record_id: recordByAppointment.get(id(appointment)) ?? null,
        })),
        page: filters.page,
        limit: filters.limit,
        total: result.total,
        page_count: Math.max(1, Math.ceil(result.total / filters.limit)),
        range: { preset: filters.range, from: range.from, to: range.to, time_zone: clinic.timeZone },
      };
    },
    async priorityHistoryForDoctor(profileId, appointmentId) {
      validateClinicalObjectId(appointmentId, 'appointmentId');
      const doctor = await doctorFor(profileId);
      const appointment = await repository.findAppointmentById(appointmentId);
      if (!appointment) throw httpError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment was not found.');
      if (id(appointment.doctor_id) !== id(doctor)) throw httpError(403, 'FORBIDDEN', 'This appointment is assigned to another Doctor.');
      return (await repository.listPriorityHistory(appointmentId)).map(priorityAuditView);
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

    async previewCertificate(profileId, recordId, body) {
      if (!certificateIssuanceEnabled) {
        throw httpError(503, 'CERTIFICATE_ISSUANCE_DISABLED', 'Medical certificate issuance is temporarily unavailable.');
      }
      validateClinicalObjectId(recordId, 'recordId');
      const issueDate = dateOnlyToUtc(clinicDate(now(), clinic.timeZone ?? 'Asia/Manila'));
      const input = validateCertificateCreate(body, { dateIssued: issueDate });
      const doctor = await doctorFor(profileId);
      const record = await repository.findRecordForDoctor(recordId, id(doctor));
      if (!record) throw httpError(404, 'MEDICAL_RECORD_NOT_FOUND', 'Medical record was not found.');
      const signature = await doctorSignatureService?.getDoctorSignatureForCertificate(id(doctor));
      let signatureBuffer = null;
      if (signature) {
        try { signatureBuffer = await streamBuffer(signature.stream); }
        catch (error) { if (error?.status) throw error; throw httpError(422, 'DOCTOR_SIGNATURE_INVALID', 'The configured Doctor signature cannot be used.'); }
      }
      const preview = {
        ...input,
        medical_certificate_number: 'DRAFT PREVIEW',
        patient_id: record.patient_id,
        doctor_id: doctor,
        medical_record_id: record,
      };
      const buffer = pdfRenderer(certificatePdfData(preview, clinic), {
        signatureBuffer,
        signatureMissingText: 'Signature not configured - preview only',
      });
      return {
        filename: 'Medical-Certificate-Draft-Preview.pdf',
        buffer,
        sha256: createHash('sha256').update(buffer).digest('hex'),
        size: buffer.length,
      };
    },

    async createCertificate(profileId, recordId, body) {
      if (!certificateIssuanceEnabled) {
        throw httpError(503, 'CERTIFICATE_ISSUANCE_DISABLED', 'Medical certificate issuance is temporarily unavailable.');
      }
      validateClinicalObjectId(recordId, 'recordId');
      const issueDate = dateOnlyToUtc(clinicDate(now(), clinic.timeZone ?? 'Asia/Manila'));
      const input = validateCertificateCreate(body, { dateIssued: issueDate });
      const doctor = await doctorFor(profileId);
      const record = await repository.findRecordForDoctor(recordId, id(doctor));
      if (!record) throw httpError(404, 'MEDICAL_RECORD_NOT_FOUND', 'Medical record was not found.');
      const signature = await doctorSignatureService?.getDoctorSignatureForCertificate(id(doctor));
      if (!signature) throw httpError(409, 'DOCTOR_SIGNATURE_REQUIRED', 'Configure your Doctor signature before issuing a medical certificate.');
      let signatureBuffer;
      try { signatureBuffer = await streamBuffer(signature.stream); }
      catch (error) { if (error?.status) throw error; throw httpError(422, 'DOCTOR_SIGNATURE_INVALID', 'The configured Doctor signature cannot be used.'); }
      for (let attempt = 0; attempt < 3; attempt += 1) {
        let storedArtifact = null;
        try {
          const medicalCertificateNumber = numberGenerator(input.date_issued);
          const pending = {
            ...input, medical_certificate_number: medicalCertificateNumber,
            patient_id: record.patient_id?._id ?? record.patient_id,
            doctor_id: doctor._id ?? doctor.id, medical_record_id: record._id ?? record.id, status: 'issued',
          };
          const pdf = pdfRenderer(certificatePdfData({ ...pending, patient_id: record.patient_id, doctor_id: doctor, medical_record_id: record }, clinic), { signatureBuffer });
          const sha256 = createHash('sha256').update(pdf).digest('hex');
          try { storedArtifact = await certificateArtifactStorage.upload(pdf); }
          catch { throw httpError(503, 'CERTIFICATE_PDF_UNAVAILABLE', 'The certificate PDF could not be stored securely.'); }
          const created = await repository.createCertificate({ ...pending,
            pdf_storage_file_id: storedArtifact.storageFileId, pdf_sha256: sha256, pdf_file_size: pdf.length,
            pdf_render_version: CERTIFICATE_PDF_RENDER_VERSION, pdf_generated_at: now(),
          });
          created.doctor_id = doctor;
          created.patient_id = record.patient_id;
          created.medical_record_id = record;
          return presentCertificate(created, clinic);
        } catch (error) {
          if (storedArtifact?.storageFileId) await certificateArtifactStorage.delete(storedArtifact.storageFileId).catch(() => {});
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
    async getDoctorCertificatePdf(profileId, certificateId) {
      validateClinicalObjectId(certificateId, 'certificateId');
      const doctor = await doctorFor(profileId);
      const certificate = await repository.findCertificateForDoctor(certificateId, id(doctor));
      if (!certificate) throw httpError(404, 'CERTIFICATE_NOT_FOUND', 'Medical certificate was not found.');
      return certificatePdf(certificate);
    },
    async getPatientCertificatePdf(profileId, certificateId) {
      validateClinicalObjectId(certificateId, 'certificateId');
      const patient = await patientFor(profileId);
      const certificate = await repository.findIssuedCertificateForPatient(certificateId, id(patient));
      if (!certificate) throw httpError(404, 'CERTIFICATE_NOT_FOUND', 'Medical certificate was not found.');
      return certificatePdf(certificate);
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
      await invokeNotificationTrigger(notificationTriggers, 'appointmentCompleted', {
        appointmentId: completed._id ?? completed.id,
        patientId: completed.patient_id?._id ?? completed.patient_id,
      });
      await invokeSmsReminderWorkflow(smsReminders, 'appointmentCompleted', {
        appointmentId: completed._id ?? completed.id,
      });
      return { id: id(completed), status: completed.status, medical_record_preserved: true };
    },
  };

  function certificatePdf(certificate) {
    const filename = `Medical-Certificate-${plainCertificateNumber(certificate.medical_certificate_number)}.pdf`;
    if (certificate.pdf_storage_file_id) return {
      filename, stream: certificateArtifactStorage.openDownload(certificate.pdf_storage_file_id),
      sha256: certificate.pdf_sha256, size: certificate.pdf_file_size, legacy: false,
    };
    const buffer = pdfRenderer(certificatePdfData(certificate, clinic), { signatureBuffer: null });
    return { filename, buffer, sha256: createHash('sha256').update(buffer).digest('hex'), size: buffer.length, legacy: true };
  }
}

function plainCertificateNumber(value) { return String(value ?? 'certificate').replace(/[^A-Za-z0-9._-]+/g, '-'); }
