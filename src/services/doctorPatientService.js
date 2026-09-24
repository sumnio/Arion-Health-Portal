import { doctorRecordStore, demoDoctor } from '../mocks/doctorRecordStore.js';
import { doctorPatients, doctorConsultationDiagnoses } from '../mocks/doctorPatientData.js';
import { doctorScheduleService, shiftScheduleDate } from './doctorScheduleService.js';
import { medicalRecordService } from './medicalRecordService.js';
import { clinicToday } from './bookingService.js';
import { ageFromDob, isSenior } from './patientProfileService.js';
import { setAppointmentStatus } from '../mocks/staffAppointmentStore.js';

export const doctorPatientService = {
  get(id, selection, now = new Date()) {
    const patient = doctorPatients.find(item => item.id === id);
    if (!patient) return null;
    const today = clinicToday(now);
    const appointments = [-1, 0, 1].flatMap(offset => doctorScheduleService.getDay(shiftScheduleDate(today, offset), now));
    const appointment = selection?.appointmentId
      ? appointments.find(item => item.id === selection.appointmentId && item.patient_id === id && item.appointment_at.slice(0, 10) === selection.date)
      : appointments.find(item => item.patient_id === id && item.appointment_at.slice(0, 10) === today);
    if (!appointment) return null;
    const consultations = appointments.filter(item => item.patient_id === id && doctorConsultationDiagnoses[item.id]).map(item => ({
      id: item.id.replace(/^700/, '800'), patient_id: id, appointment_id: item.id,
      encounter_at: item.appointment_at, diagnosis: doctorConsultationDiagnoses[item.id], doctor: 'Demo Doctor',
    }));
    consultations.push(...doctorRecordStore.filter(item => item.patient_id === id).map(item => ({ ...item, doctor: demoDoctor.display_name })));
    const existingRecord = consultations.find(item => item.appointment_id === appointment.id);
    const consultationRecords = [...(id === doctorPatients[0].id ? medicalRecordService.list() : []), ...consultations].sort((a, b) => new Date(b.encounter_at) - new Date(a.encounter_at));
    const history = consultationRecords
      .filter(item => item.appointment_id !== appointment.id && new Date(item.encounter_at) < new Date(appointment.appointment_at))
      .sort((a, b) => new Date(b.encounter_at) - new Date(a.encounter_at)).slice(0, 3);
    const canAddRecord = appointment.status === 'confirmed' && appointment.appointment_at.slice(0, 10) <= today && !existingRecord;
    const assignedToCurrentDoctor = appointment.doctor_id === demoDoctor.id;
    const canComplete = assignedToCurrentDoctor && appointment.status === 'confirmed' && Boolean(existingRecord);
    const consultationMessage = existingRecord && appointment.status === 'completed' ? 'Consultation completed. The saved medical record is read-only.'
      : existingRecord ? 'Medical record saved. Confirm completion when the consultation is finished.'
      : appointment.status === 'cancelled' ? 'This appointment was cancelled. Medical record creation is unavailable.'
      : appointment.status === 'no_show' ? 'The patient did not attend this appointment. Medical record creation is unavailable.'
      : appointment.status === 'completed' ? 'This appointment is completed.'
      : appointment.status === 'pending' ? 'This appointment is awaiting confirmation.'
      : !canAddRecord ? 'Medical record creation will be available on the appointment day.'
      : 'Review the patient information before adding a medical record for this consultation.';
    return structuredClone({ patient: { ...patient, name: patient.full_name, age: ageFromDob(patient.dob, today), senior: isSenior(patient.dob, today) }, appointment, history, consultationRecords, patientAppointments: appointments.filter(item => item.patient_id === id), existingRecord, canAddRecord, canComplete, assignedToCurrentDoctor, consultationMessage });
  },
  complete(id, selection, doctorId = demoDoctor.id) {
    const detail = this.get(id, selection);
    if (!detail) return { error: 'Patient or appointment not found.' };
    if (detail.appointment.doctor_id !== doctorId) return { error: 'Only the doctor assigned to this appointment can complete the consultation.' };
    if (detail.appointment.status === 'completed') return { error: 'This consultation is already completed.' };
    if (['cancelled', 'no_show'].includes(detail.appointment.status)) return { error: 'A cancelled or no-show appointment cannot be completed.' };
    if (!detail.existingRecord) return { error: 'Save the medical record before completing this consultation.' };
    if (!detail.canComplete) return { error: 'This appointment is not eligible for consultation completion.' };
    setAppointmentStatus(detail.appointment, 'completed');
    return { appointment: this.get(id, selection).appointment };
  },
};
