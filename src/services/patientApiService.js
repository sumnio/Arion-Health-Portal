import { apiErrorMessage } from './apiClient.js';
import { patientApiRepository } from '../repositories/patientApiRepository.js';
import { clinicDateTimeParts, clinicToday, slotRange } from './dateTimeService.js';

export const patientVisitTypes = Object.freeze([
  { id: 'general_consultation', name: 'General Consultation' },
  { id: 'follow_up', name: 'Follow-up' },
  { id: 'check_up', name: 'Check-up' },
]);

export const patientProfileSexOptions = Object.freeze([
  { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' }, { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]);

export function patientAge(dob, today = clinicToday()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob ?? '')) return null;
  const parsed = new Date(`${dob}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dob || dob > today) return null;
  return Number(today.slice(0, 4)) - Number(dob.slice(0, 4)) - (today.slice(5) < dob.slice(5) ? 1 : 0);
}

export function patientIsSenior(dob, today = clinicToday()) {
  const age = patientAge(dob, today);
  return age === null ? null : age >= 60;
}

export function validatePatientProfile(values) {
  const validPhone = (value) => /^[+\d\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 7 && value.replace(/\D/g, '').length <= 15;
  const errors = {};
  if (!values.fullName?.trim()) errors.fullName = 'Enter your full name.';
  if (patientAge(values.dob) === null) errors.dob = 'Enter a valid date of birth that is not in the future.';
  if (!patientProfileSexOptions.some((option) => option.value === values.sex)) errors.sex = 'Select a sex option.';
  if (!validPhone(values.contactNumber?.trim() ?? '')) errors.contactNumber = 'Enter a contact number with 7–15 digits.';
  if (values.emergencyNumber?.trim() && !validPhone(values.emergencyNumber.trim())) errors.emergencyNumber = 'Enter an emergency number with 7–15 digits, or leave it blank.';
  return errors;
}

export function canCancelPatientAppointment(item, now = new Date()) {
  return Boolean(item && ['pending', 'confirmed'].includes(item.status) && !item.check_in_at && !item.has_medical_record && new Date(item.appointment_at) > now);
}

const visitTypeLabel = (value) => patientVisitTypes.find((item) => item.id === value)?.name ?? value ?? 'Consultation';
const nullableText = (value) => value ?? '';

export function normalizePatientProfile(patient) {
  return {
    id: patient.id,
    fullName: patient.full_name,
    dob: patient.dob,
    sex: patient.sex,
    contactNumber: patient.contact_number,
    address: nullableText(patient.address),
    emergencyName: nullableText(patient.emergency_contact_name),
    emergencyNumber: nullableText(patient.emergency_contact_number),
    relationship: nullableText(patient.emergency_contact_relationship),
    allergies: [...(patient.allergies ?? [])],
    isPwd: patient.is_pwd === true,
  };
}

function profilePatch(values) {
  return {
    full_name: values.fullName.trim(),
    dob: values.dob,
    sex: values.sex,
    contact_number: values.contactNumber.trim(),
    address: values.address.trim() || null,
    emergency_contact_name: values.emergencyName.trim() || null,
    emergency_contact_number: values.emergencyNumber.trim() || null,
    emergency_contact_relationship: values.relationship.trim() || null,
    is_pwd: values.isPwd === true,
  };
}

export function normalizeAppointment(item) {
  const local = clinicDateTimeParts(item.appointment_at);
  return {
    ...item,
    doctor_id: item.doctor?.id ?? null,
    doctor: item.doctor?.display_name ?? 'Doctor unavailable',
    specialty: item.doctor?.specialty ?? '',
    service: visitTypeLabel(item.visit_type),
    date: local.date,
    time: local.time,
    timeLabel: slotRange(local.time),
  };
}

export function normalizeRecord(item) {
  return {
    ...item,
    patient_id: item.patient?.id ?? null,
    doctor_id: item.doctor?.id ?? null,
    doctor: item.doctor?.display_name ?? 'Doctor unavailable',
    specialty: item.doctor?.specialty ?? '',
    appointment_id: item.appointment?.id ?? null,
    visitType: visitTypeLabel(item.appointment?.visit_type),
    prescriptions: [...(item.prescriptions ?? [])],
    certificates: [],
  };
}

export function normalizeCertificate(item, { patientName = '', relatedRecord = null } = {}) {
  return {
    ...item,
    doctor: item.doctor?.display_name ?? 'Doctor unavailable',
    specialty: item.doctor?.specialty ?? '',
    license_number: item.doctor?.license_number ?? 'Not available',
    ptr_number: item.doctor?.ptr_number ?? 'Not available',
    signature_available: item.doctor?.signature_available === true,
    patientName,
    relatedRecord,
  };
}

export function patientApiErrorMessage(error, fallback = 'Unable to load Patient data.') {
  return apiErrorMessage(error, {
    fallback,
    forbidden: 'You do not have access to this information.',
    notFound: fallback,
    codeMessages: { APPOINTMENT_SLOT_CONFLICT: 'This appointment slot is no longer available.' },
  });
}

export function createPatientApiService(repository = patientApiRepository) {
  const service = {
    async getProfile() { return normalizePatientProfile(await repository.getProfile()); },
    async updateProfile(values) { return normalizePatientProfile(await repository.updateProfile(profilePatch(values))); },
    async getDoctors() { return (await repository.getDoctors()).map((doctor) => ({ id: doctor.id, name: doctor.display_name, specialty: doctor.specialty ?? '' })); },
    async getAvailableSlots(doctorId, date) {
      const result = await repository.getAvailableSlots(doctorId, date);
      return (result.slots ?? []).map((slot) => ({ ...slot, time: slot.start_time, available: true }));
    },
    async getBookableDates(doctorId, dates) {
      const results = await Promise.all(dates.map(async (date) => ({ date, slots: await service.getAvailableSlots(doctorId, date) })));
      return Object.fromEntries(results.map(({ date, slots }) => [date, slots]));
    },
    async createAppointment(values) {
      const appointmentAt = `${values.date}T${values.time}:00+08:00`;
      return normalizeAppointment(await repository.createAppointment({
        doctor_id: values.doctor,
        appointment_at: appointmentAt,
        visit_type: values.service,
        reason: values.reason.trim(),
      }));
    },
    async getAppointments() { return (await repository.getAppointments()).map(normalizeAppointment); },
    async getAppointment(id) { return normalizeAppointment(await repository.getAppointment(id)); },
    async cancelAppointment(id) { return normalizeAppointment(await repository.cancelAppointment(id)); },
    async getRecords() { return (await repository.getRecords()).map(normalizeRecord); },
    async getRecord(id) {
      const [rawRecord, certificates] = await Promise.all([repository.getRecord(id), repository.getCertificates()]);
      const record = normalizeRecord(rawRecord);
      record.certificates = certificates.filter((item) => item.medical_record_id === record.id).map((item) => normalizeCertificate(item));
      return record;
    },
    async getCertificates() {
      const [items, profile] = await Promise.all([repository.getCertificates(), repository.getProfile()]);
      return items.map((item) => normalizeCertificate(item, { patientName: profile.full_name }));
    },
    async getCertificate(id) {
      const [item, profile] = await Promise.all([repository.getCertificate(id), repository.getProfile()]);
      let relatedRecord = null;
      if (item.medical_record_id) {
        const record = normalizeRecord(await repository.getRecord(item.medical_record_id));
        relatedRecord = { id: record.id, encounter_at: record.encounter_at, visitType: record.visitType };
      }
      return normalizeCertificate(item, { patientName: profile.full_name, relatedRecord });
    },
    async getDashboard() {
      const [profile, appointments, records] = await Promise.all([service.getProfile(), service.getAppointments(), service.getRecords()]);
      const now = new Date();
      const nextAppointment = appointments.filter((item) => ['pending', 'confirmed'].includes(item.status) && new Date(item.appointment_at) >= now).sort((a, b) => new Date(a.appointment_at) - new Date(b.appointment_at))[0] ?? null;
      const recentRecord = records.sort((a, b) => new Date(b.encounter_at) - new Date(a.encounter_at))[0] ?? null;
      return { profile, nextAppointment, recentRecord };
    },
  };
  return service;
}

export const patientApiService = createPatientApiService();

export function patientBookingDates(now = new Date()) {
  const start = clinicToday(now);
  return Array.from({ length: 15 }, (_, index) => {
    const date = new Date(`${start}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}
