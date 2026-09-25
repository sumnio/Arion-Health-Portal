import { patientRepository } from '../repositories/patientRepository.js';
import { appointmentRepository, DEMO_DOCTOR_ID } from '../repositories/appointmentRepository.js';
import { medicalRecordRepository } from '../repositories/medicalRecordRepository.js';
import { clinicToday } from './bookingService.js';
import { ageFromDob, isSenior } from './patientProfileService.js';
import { doctorProfileService } from './doctorProfileService.js';

function recordsFor(patientId) { const doctor=doctorProfileService.get(DEMO_DOCTOR_ID); return medicalRecordRepository.list().filter(item=>item.patient_id===patientId).map(item=>({ ...item, doctor:doctor?.display_name??'Doctor unavailable', prescriptions:medicalRecordRepository.prescriptions(item.id) })); }
export const doctorPatientService={
 get(id,selection,now=new Date()){
  const patient=patientRepository.get(id);if(!patient)return null;const today=clinicToday(now);const appointments=appointmentRepository.list(now).filter(item=>item.doctor_id===DEMO_DOCTOR_ID);
  const selected=selection?.appointmentId?appointmentRepository.getForDate(selection.appointmentId,selection.date):null;
  const appointment=selection?.appointmentId?(selected?.patient_id===id&&selected?.doctor_id===DEMO_DOCTOR_ID?selected:null):appointments.find(item=>item.patient_id===id&&item.appointment_at.slice(0,10)===today);
  if(!appointment)return null;
  const consultationRecords=recordsFor(id).sort((a,b)=>new Date(b.encounter_at)-new Date(a.encounter_at));const existingRecord=consultationRecords.find(item=>item.appointment_id===appointment.id)??null;
  const history=consultationRecords.filter(item=>item.appointment_id!==appointment.id&&new Date(item.encounter_at)<new Date(appointment.appointment_at)).slice(0,3);
  const canAddRecord=appointment.status==='confirmed'&&appointment.appointment_at.slice(0,10)<=today&&!existingRecord;const assignedToCurrentDoctor=appointment.doctor_id===DEMO_DOCTOR_ID;const canComplete=assignedToCurrentDoctor&&appointment.status==='confirmed'&&Boolean(existingRecord);
  const consultationMessage=existingRecord&&appointment.status==='completed'?'Consultation completed. The saved medical record is read-only.':existingRecord?'Medical record saved. Confirm completion when the consultation is finished.':appointment.status==='cancelled'?'This appointment was cancelled. Medical record creation is unavailable.':appointment.status==='no_show'?'The patient did not attend this appointment. Medical record creation is unavailable.':appointment.status==='completed'?'This appointment is completed.':appointment.status==='pending'?'This appointment is awaiting confirmation.':!canAddRecord?'Medical record creation will be available on the appointment day.':'Review the patient information before adding a medical record for this consultation.';
  const patientAppointments=appointments.filter(item=>item.patient_id===id);if(!patientAppointments.some(item=>item.id===appointment.id))patientAppointments.push(appointment);
  return structuredClone({patient:{...patient,name:patient.full_name,age:ageFromDob(patient.dob,today),senior:isSenior(patient.dob,today)},appointment,history,consultationRecords,patientAppointments,existingRecord,canAddRecord,canComplete,assignedToCurrentDoctor,consultationMessage});
 },
 complete(id,selection,doctorId=DEMO_DOCTOR_ID){const detail=this.get(id,selection);if(!detail)return{error:'Patient or appointment not found.'};if(detail.appointment.doctor_id!==doctorId)return{error:'Only the doctor assigned to this appointment can complete the consultation.'};if(detail.appointment.status==='completed')return{error:'This consultation is already completed.'};if(['cancelled','no_show'].includes(detail.appointment.status))return{error:'A cancelled or no-show appointment cannot be completed.'};if(!detail.existingRecord)return{error:'Save the medical record before completing this consultation.'};if(!detail.canComplete)return{error:'This appointment is not eligible for consultation completion.'};appointmentRepository.update(detail.appointment.id,{status:'completed'});return{appointment:this.get(id,selection).appointment};},
};
