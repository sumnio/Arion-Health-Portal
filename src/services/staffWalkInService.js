import { allStaffPatients, staffPatient, staffPatientName, walkInPatients, walkInNames, walkInAppointments, walkInServices, walkInSubmissions, walkInDutyDoctor } from '../mocks/staffWalkInStore.js';
import { bookingDoctors, visitTypes } from '../mocks/bookingData.js';
import { bookingService, clinicToday, formatSlot } from './bookingService.js';
import { staffDashboardService } from './staffDashboardService.js';
import { ageFromDob, isSenior, profileSexOptions } from './patientProfileService.js';

// Match the existing Staff dashboard preview snapshot regardless of local testing time.
export function walkInMockNow() { return new Date(clinicToday() + 'T10:00:00+08:00'); }
const phone = value => (value ?? '').replace(/\D/g, '');
const normalized = value => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
export const staffWalkInService = {
  getPatient(id) {
    const patient = staffPatient(id);
    return patient ? structuredClone({ ...patient, name: staffPatientName(id) }) : null;
  },
  search(query) {
    const name = normalized(query), digits = phone(query);
    if (!name) return [];
    return allStaffPatients().filter(item => normalized(staffPatientName(item.id)).includes(name) || (digits.length >= 3 && phone(item.contact_number).includes(digits)))
      .map(item => ({ id: item.id, name: staffPatientName(item.id), dob: item.dob, contact_number: item.contact_number }));
  },
  register(values, now = new Date()) {
    const errors = {};
    if (!values.name?.trim()) errors.name = 'Enter the patient’s full name.';
    if (ageFromDob(values.dob, clinicToday(now)) === null) errors.dob = 'Enter a valid date of birth, not in the future.';
    if (!profileSexOptions.includes(values.sex)) errors.sex = 'Select a sex option.';
    if (!/^[+\d\s().-]+$/.test(values.contact_number ?? '') || phone(values.contact_number).length < 7 || phone(values.contact_number).length > 15) errors.contact_number = 'Enter a contact number with 7–15 digits.';
    if (Object.keys(errors).length) return { errors };
    const matches = allStaffPatients().filter(item => phone(item.contact_number) === phone(values.contact_number) || (normalized(staffPatientName(item.id)) === normalized(values.name) && item.dob === values.dob));
    if (matches.length) return { matches: matches.map(item => this.getPatient(item.id)) };
    const patient = { id: crypto.randomUUID(), user_profile_id: null, dob: values.dob, sex: values.sex,
      contact_number: values.contact_number.trim(), emergency_contact: values.emergency_contact?.trim() || null,
      allergies: (values.allergies ?? '').split(/[,\n]/).map(value => value.trim()).filter(Boolean), is_pwd: values.is_pwd === true };
    walkInPatients.push(patient); walkInNames.set(patient.id, values.name.trim());
    return { patient: this.getPatient(patient.id) };
  },
  options(now = walkInMockNow()) {
    const date = clinicToday(now);
    const occupied = staffDashboardService.getDashboard(now).appointments.filter(item => !['cancelled', 'no_show'].includes(item.status));
    const doctors = [...bookingDoctors, walkInDutyDoctor].map(doctor => {
      const candidates = doctor.id === walkInDutyDoctor.id ? doctor.times : bookingService.getSlots(doctor.id, date, now).filter(slot => slot.available).map(slot => slot.time);
      const slots = candidates.filter(time => {
        const at = `${date}T${time}:00+08:00`;
        return new Date(at) >= now && !occupied.some(item => item.doctor_id === doctor.id && new Date(item.appointment_at).getTime() === new Date(at).getTime());
      });
      return { id: doctor.id, name: doctor.name, slots };
    }).filter(doctor => doctor.slots.length);
    return { date, doctors, services: structuredClone(visitTypes) };
  },
  createAppointment(patientId, values, submissionId, now = walkInMockNow()) {
    if (walkInSubmissions.has(submissionId)) return { appointment: structuredClone(walkInSubmissions.get(submissionId)) };
    const patient = staffPatient(patientId);
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
    const appointment = { id: crypto.randomUUID(), patient_id: patientId, doctor_id: doctor.id,
      appointment_at: `${options.date}T${values.time}:00+08:00`, check_in_at: null, status: 'confirmed',
      reason: values.reason.trim(), priority: values.priority, created_by: null,
      created_at: now.toISOString(), updated_at: now.toISOString() };
    walkInAppointments.push(appointment); walkInServices.set(appointment.id, service.name);
    walkInSubmissions.set(submissionId, appointment);
    return { appointment: structuredClone(appointment) };
  },
};
export { isSenior, ageFromDob, profileSexOptions, formatSlot };
