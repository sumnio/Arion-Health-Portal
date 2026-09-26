import { validateEmptyBody } from '../validation/inputValidation.js';

export function createDoctorClinicalController({ clinicalService }) {
  return {
    async appointments(request, response) {
      response.json({ appointments: await clinicalService.listDoctorAppointments(request.authUser.user_profile_id, request.query) });
    },
    async createRecord(request, response) {
      response.status(201).json({ medical_record: await clinicalService.createRecord(request.authUser.user_profile_id, request.params.appointmentId, request.body) });
    },
    async patientRecords(request, response) {
      const [medicalRecords, medicalCertificates] = await Promise.all([
        clinicalService.listDoctorPatientRecords(request.authUser.user_profile_id, request.params.patientId),
        clinicalService.listDoctorPatientCertificates(request.authUser.user_profile_id, request.params.patientId),
      ]);
      response.json({ medical_records: medicalRecords, medical_certificates: medicalCertificates });
    },
    async record(request, response) {
      response.json({ medical_record: await clinicalService.getDoctorRecord(request.authUser.user_profile_id, request.params.recordId) });
    },
    async createCertificate(request, response) {
      response.status(201).json({ medical_certificate: await clinicalService.createCertificate(request.authUser.user_profile_id, request.params.recordId, request.body) });
    },
    async certificate(request, response) {
      response.json({ medical_certificate: await clinicalService.getDoctorCertificate(request.authUser.user_profile_id, request.params.certificateId) });
    },
    async complete(request, response) {
      validateEmptyBody(request.body);
      response.json({ appointment: await clinicalService.completeConsultation(request.authUser.user_profile_id, request.params.appointmentId) });
    },
  };
}

export function createPatientClinicalController({ clinicalService }) {
  return {
    async records(request, response) {
      response.json({ medical_records: await clinicalService.listPatientRecords(request.authUser.user_profile_id) });
    },
    async record(request, response) {
      response.json({ medical_record: await clinicalService.getPatientRecord(request.authUser.user_profile_id, request.params.recordId) });
    },
    async certificates(request, response) {
      response.json({ medical_certificates: await clinicalService.listPatientCertificates(request.authUser.user_profile_id) });
    },
    async certificate(request, response) {
      response.json({ medical_certificate: await clinicalService.getPatientCertificate(request.authUser.user_profile_id, request.params.certificateId) });
    },
  };
}
