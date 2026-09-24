import { medicalRecordRepository } from '../repositories/medicalRecordRepository.js';
import { medicalCertificateRepository } from '../repositories/medicalCertificateRepository.js';
import { appointmentRepository } from '../repositories/appointmentRepository.js';
import { doctorProfileService } from './doctorProfileService.js';
import { exampleIds } from '../mocks/portalData.js';
import { medicalRecordVisitLabels } from '../mocks/medicalRecordData.js';

export function presentMedicalRecord(record) {
 const doctor=doctorProfileService.get(record.doctor_id), appointment=record.appointment_id?appointmentRepository.get(record.appointment_id):null;
 return structuredClone({...record,doctor:doctor?.display_name??'Doctor unavailable',specialty:doctor?.specialty??'',visitType:appointment?.service??medicalRecordVisitLabels[record.id]??'Consultation',prescriptions:medicalRecordRepository.prescriptions(record.id),certificates:medicalCertificateRepository.list().filter(item=>item.medical_record_id===record.id&&item.patient_id===record.patient_id&&item.status==='issued')});
}
export const medicalRecordService={
 list(query=''){const search=query.trim().toLowerCase();return medicalRecordRepository.list().filter(item=>item.patient_id===exampleIds.patient).map(presentMedicalRecord).filter(item=>[item.doctor,item.diagnosis,item.visitType].some(value=>value.toLowerCase().includes(search))).sort((a,b)=>new Date(b.encounter_at)-new Date(a.encounter_at));},
 get(id){const record=medicalRecordRepository.get(id);return record&&record.patient_id===exampleIds.patient?presentMedicalRecord(record):null;},
 listForPatient(patientId){return medicalRecordRepository.list().filter(item=>item.patient_id===patientId).map(presentMedicalRecord).sort((a,b)=>new Date(b.encounter_at)-new Date(a.encounter_at));},
};
export function formatEncounter(value){return new Date(value).toLocaleString('en-US',{timeZone:'Asia/Manila',dateStyle:'long',timeStyle:'short'});}
