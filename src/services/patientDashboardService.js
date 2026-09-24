import { portalService } from './portalService.js';
import { appointmentService } from './appointmentService.js';
import { medicalRecordService } from './medicalRecordService.js';
import { doctorProfileService } from './doctorProfileService.js';

export const patientDashboardService={getDashboard(){
 const now=new Date();const nextAppointment=appointmentService.list().filter(item=>['pending','confirmed'].includes(item.status)&&new Date(item.appointment_at)>=now).sort((a,b)=>new Date(a.appointment_at)-new Date(b.appointment_at))[0]??null;
 const recentRecord=medicalRecordService.list()[0]??null;const doctor=recentRecord?doctorProfileService.get(recentRecord.doctor_id):null;
 return {profile:portalService.getPreviewProfile('patient'),nextAppointment,recentRecord,doctor:{display_name:doctor?.display_name??'Doctor unavailable'}};
}};
