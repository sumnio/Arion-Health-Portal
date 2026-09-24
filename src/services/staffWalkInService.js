import { walkInSubmissions } from '../mocks/staffWalkInStore.js';
import { visitTypes } from '../mocks/bookingData.js';
import { bookingService, clinicToday, formatSlot } from './bookingService.js';
import { staffDashboardService } from './staffDashboardService.js';
import { ageFromDob, isSenior, profileSexOptions } from './patientProfileService.js';
import { patientRepository } from '../repositories/patientRepository.js';
import { appointmentRepository, DEMO_DOCTOR_ID } from '../repositories/appointmentRepository.js';
import { createMockId } from '../repositories/mockId.js';
import { doctorProfileService } from './doctorProfileService.js';
import { toPatientSearchOption } from './adapters/domainAdapters.js';

// Match the existing Staff dashboard preview snapshot regardless of local testing time.
export function walkInMockNow() { return new Date(clinicToday() + 'T10:00:00+08:00'); }
const phone = value => (value ?? '').replace(/\D/g, '');
const normalized = value => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
export const staffWalkInService = {
  getPatient(id) {
    const patient = patientRepository.get(id);
    return patient ? structuredClone(patient) : null;
  },
  search(query) {
    const name = normalized(query), digits = phone(query);
    if (!name) return [];
    return patientRepository.list().filter(item => normalized(item.full_name).includes(name) || (digits.length >= 3 && phone(item.contact_number).includes(digits)))
      .map(toPatientSearchOption);
  },
  register(values, now = new Date()) {
    const errors = {};
    if (!values.full_name?.trim()) errors.full_name = 'Enter the patient’s full name.';
    if (ageFromDob(values.dob, clinicToday(now)) === null) errors.dob = 'Enter a valid date of birth, not in the future.';
    if (!profileSexOptions.includes(values.sex)) errors.sex = 'Select a sex option.';
    if (!/^[+\d\s().-]+$/.test(values.contact_number ?? '') || phone(values.contact_number).length < 7 || phone(values.contact_number).length > 15) errors.contact_number = 'Enter a contact number with 7–15 digits.';
    if (values.emergency_contact_number?.trim() && (!/^[+\d\s().-]+$/.test(values.emergency_contact_number) || phone(values.emergency_contact_number).length < 7 || phone(values.emergency_contact_number).length > 15)) errors.emergency_contact_number = 'Enter an emergency contact number with 7–15 digits.';
    if (Object.keys(errors).length) return { errors };
    const matches = patientRepository.list().filter(item => phone(item.contact_number) === phone(values.contact_number) || (normalized(item.full_name) === normalized(values.full_name) && item.dob === values.dob));
    if (matches.length) return { matches: matches.map(item => this.getPatient(item.id)) };
    const patient = { id: createMockId(), user_profile_id: null, full_name: values.full_name.trim(), dob: values.dob, sex: values.sex,
      contact_number: values.contact_number.trim(), address: values.address?.trim() || null,
      emergency_contact_name: values.emergency_contact_name?.trim() || null,
      emergency_contact_number: values.emergency_contact_number?.trim() || null,
      emergency_contact_relationship: values.emergency_contact_relationship?.trim() || null,
      allergies: (values.allergies ?? '').split(/[,\n]/).map(value => value.trim()).filter(Boolean), is_pwd: values.is_pwd === true };
    patientRepository.add(patient);
    return { patient: this.getPatient(patient.id) };
  },
  options(now = walkInMockNow()) {
    const date = clinicToday(now);
    const occupied = staffDashboardService.getDashboard(now).appointments.filter(item => !['cancelled', 'no_show'].includes(item.status));
    const dutyTimes = ['09:00','09:30','10:00','10:30','11:00','11:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30'];
    const doctors = doctorProfileService.list({ activeOnly: true }).map(doctor => {
      const candidates = doctor.id === DEMO_DOCTOR_ID ? dutyTimes : bookingService.getSlots(doctor.id, date, now).filter(slot => slot.available).map(slot => slot.time);
      const slots = candidates.filter(time => {
        const at = `${date}T${time}:00+08:00`;
        return new Date(at) >= now && !occupied.some(item => item.doctor_id === doctor.id && new Date(item.appointment_at).getTime() === new Date(at).getTime());
      });
      return { id: doctor.id, name: doctor.display_name, slots };
    }).filter(doctor => doctor.slots.length);
    return { date, doctors, services: structuredClone(visitTypes) };
  },
  createAppointment(patientId, values, submissionId, now = walkInMockNow()) {
    if (walkInSubmissions.has(submissionId)) return { appointment: structuredClone(walkInSubmissions.get(submissionId)) };
    const patient = patientRepository.get(patientId);
    if (!patient) return { errors: { form: 'Patient not found. Select or register a patient first.' } };
    const options = this.options(now), errors = {};
    if (values.date !== options.date) errors.form = 'The clinic day changed. Refresh to create today’s appointment.';
    const doctor = options.doctors.find(item => item.id === values.doctor);
    if (!doctor) errors.doctor = 'Select an available doctor.';
    if (!doctor?.slots.includes(values.time)) errors.time = 'Select an available time. That slot may no longer be available.';
    const service = visitTypes.find(item => item.id === values.service);
    if (!service) errors.service = 'Select a visit type.';
    if (!values.reason?.trim()) errors.reason = 'Enter the reason for visit.';
    if (!['normal', 'urgent'].includes(values.priority)) errors.priority = 'Select Normal or Urgent.';
    if (!submissionId) errors.form = 'Missing submission context. Reload this page.';
    if (Object.keys(errors).length) return { errors };
    const appointment = appointmentRepository.create({ patient_id: patientId, doctor_id: doctor.id,
      appointment_at: `${options.date}T${values.time}:00+08:00`, check_in_at: null, status: 'confirmed',
      reason: values.reason.trim(), service: service.name, priority: values.priority, created_by: null,
      created_at: now.toISOString(), updated_at: now.toISOString() });
    walkInSubmissions.set(submissionId, appointment);
    return { appointment: structuredClone(appointment) };
  },
};
export { isSenior, ageFromDob, profileSexOptions, formatSlot };
