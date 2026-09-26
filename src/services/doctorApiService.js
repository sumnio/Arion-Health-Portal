import { apiErrorMessage } from './apiClient.js';
import { doctorApiRepository } from '../repositories/doctorApiRepository.js';
import { clinicDateTimeParts, clinicToday, formatSlot } from './dateTimeService.js';

export const doctorWeekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const visitLabels = { general_consultation: 'General Consultation', follow_up: 'Follow-up', check_up: 'Check-up' };

export function normalizeDoctorAppointment(item) {
  const local = clinicDateTimeParts(item.appointment_at);
  return {
    ...item, date: local.date, time: local.time, timeLabel: formatSlot(local.time),
    patient: item.patient ?? null, patientName: item.patient?.full_name ?? 'Patient unavailable',
    patientPath: item.patient?.id ? `/doctor/patients/${item.patient.id}` : null,
    visitLabel: visitLabels[item.visit_type] ?? item.visit_type,
  };
}

function normalizeRecord(item) {
  return {
    ...item,
    doctor: item.doctor?.display_name ?? 'Doctor unavailable',
    doctorProfile: item.doctor ?? null,
    patient: item.patient ?? null,
    patientName: item.patient?.full_name ?? 'Patient unavailable',
    appointment_id: item.appointment?.id ?? null,
    prescriptions: item.prescriptions ?? [],
  };
}

function normalizeCertificate(item, patientName = '') {
  return {
    ...item, patientName,
    doctor: item.doctor?.display_name ?? 'Doctor unavailable',
    specialty: item.doctor?.specialty ?? '',
    license_number: item.doctor?.license_number ?? 'Not available',
    ptr_number: item.doctor?.ptr_number ?? 'Not available',
    signature_available: item.doctor?.signature_available === true,
  };
}

export function doctorApiErrorMessage(error, fallback = 'Unable to load Doctor data.') {
  return apiErrorMessage(error, { fallback, forbidden: 'You do not have access to this Doctor information.', notFound: fallback });
}

export function createDoctorApiService(repository = doctorApiRepository) {
  const service = {
    publicationWindow(now = new Date()) {
      const start = clinicToday(now); const date = new Date(`${start}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 30);
      return { start, end: date.toISOString().slice(0, 10) };
    },
    async getAppointments(filters) { return (await repository.getAppointments(filters)).map(normalizeDoctorAppointment); },
    async getDashboard() {
      const date = clinicToday(); const appointments = await service.getAppointments({ date });
      const upcoming = appointments.filter((item) => ['pending', 'confirmed'].includes(item.status) && new Date(item.appointment_at) >= new Date());
      return { date, appointments, upcoming, total: appointments.length, completed: appointments.filter((item) => item.status === 'completed').length, nextPatient: upcoming[0] ?? null };
    },
    async getAvailability() {
      const [recurring, published, blocked] = await Promise.all([repository.getRecurringAvailability(), repository.getPublishedAvailability(), repository.getBlockedTimes()]);
      return { recurring, published: published.map((item) => ({ ...item, date: item.availability_date })), blocked };
    },
    createRecurring: (payload) => repository.createRecurringAvailability(payload),
    updateRecurring: (id, payload) => repository.updateRecurringAvailability(id, payload),
    removeRecurring: (id) => repository.deleteRecurringAvailability(id),
    publish: (payload) => repository.createPublishedAvailability({ availability_date: payload.date, start_time: payload.start_time, end_time: payload.end_time }),
    removePublished: (id) => repository.deletePublishedAvailability(id),
    addBlocked(payload) {
      const next = new Date(`${payload.date}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
      return repository.createBlockedTime({
        start_at: payload.whole_day ? `${payload.date}T00:00:00+08:00` : `${payload.date}T${payload.start_time}:00+08:00`,
        end_at: payload.whole_day ? `${next.toISOString().slice(0, 10)}T00:00:00+08:00` : `${payload.date}T${payload.end_time}:00+08:00`,
        reason: payload.reason,
      });
    },
    removeBlocked: (id) => repository.deleteBlockedTime(id),
    async getPatientContext(patientId, selection = {}) {
      const [appointments, history] = await Promise.all([service.getAppointments({ patientId }), repository.getPatientHistory(patientId)]);
      const appointment = (selection.appointmentId && appointments.find((item) => item.id === selection.appointmentId))
        || appointments.find((item) => ['confirmed', 'pending'].includes(item.status)) || appointments.at(-1);
      if (!appointment || appointment.patient?.id !== patientId) return null;
      const records = (history.medical_records ?? []).map(normalizeRecord);
      const certificates = (history.medical_certificates ?? []).map((item) => normalizeCertificate(item, appointment.patient.full_name));
      const existingRecord = records.find((item) => item.appointment_id === appointment.id) ?? null;
      const canAddRecord = appointment.status === 'confirmed' && !existingRecord;
      const canComplete = appointment.status === 'confirmed' && Boolean(appointment.check_in_at) && Boolean(existingRecord);
      const consultationMessage = existingRecord && appointment.status === 'completed' ? 'Consultation completed. The saved medical record is read-only.'
        : existingRecord ? 'Medical record saved. Confirm completion when the consultation is finished.'
          : appointment.status === 'cancelled' ? 'This appointment was cancelled. Medical record creation is unavailable.'
            : appointment.status === 'no_show' ? 'The patient did not attend this appointment. Medical record creation is unavailable.'
              : appointment.status === 'pending' ? 'This appointment is awaiting confirmation.'
                : canAddRecord ? 'Review the patient information before adding a medical record.' : 'This appointment is not eligible for a medical record.';
      return { patient: appointment.patient, appointment, records, certificates, existingRecord, canAddRecord, canComplete, consultationMessage };
    },
    async createMedicalRecord(appointmentId, values) {
      return normalizeRecord(await repository.createMedicalRecord(appointmentId, {
        diagnosis: values.diagnosis.trim(), notes: values.notes?.trim() || null, follow_up: values.follow_up?.trim() || null,
        prescriptions: (values.prescriptions ?? []).map(({ medicine, dosage, instructions }) => ({ medicine: medicine.trim(), dosage: dosage.trim(), instructions: instructions?.trim() || null })),
      }));
    },
    async getRecord(id) { return normalizeRecord(await repository.getRecord(id)); },
    async issueCertificate(recordId, values, patientName = '') {
      const created = await repository.createCertificate(recordId, { purpose: values.purpose.trim(), diagnosis_summary: values.diagnosis_summary.trim(), date_issued: values.date_issued, valid_until: values.valid_until || null });
      return normalizeCertificate(await repository.getCertificate(created.id), patientName);
    },
    async getCertificate(id) { return normalizeCertificate(await repository.getCertificate(id)); },
    completeAppointment: (id) => repository.completeAppointment(id),
  };
  return service;
}

export const doctorApiService = createDoctorApiService();
