import { medicalRecordService } from './medicalRecordService.js';
import { certificateService } from './certificateService.js';
import { patientRepository } from '../repositories/patientRepository.js';
import { appointmentRepository } from '../repositories/appointmentRepository.js';

export const doctorHistoryService={get(patientId){
 if(!patientRepository.get(patientId))return null;
 const records=medicalRecordService.listForPatient(patientId).map(record=>({...record,appointment:record.appointment_id?appointmentRepository.get(record.appointment_id):null}));
 const ids=new Set(records.map(item=>item.id));const certificates=certificateService.listForPatient(patientId,patientRepository.get(patientId).full_name).filter(item=>ids.has(item.medical_record_id)&&item.status==='issued').sort((a,b)=>b.date_issued.localeCompare(a.date_issued));
 return structuredClone({records,certificates});
}};
