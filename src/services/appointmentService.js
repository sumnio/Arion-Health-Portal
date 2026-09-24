import { appointmentRepository } from '../repositories/appointmentRepository.js';
import { bookingService, clinicToday, slotRange } from './bookingService.js';
import { doctorProfileService } from './doctorProfileService.js';
import { exampleIds } from '../mocks/portalData.js';

export function canManageAppointment(item, now = new Date()) { return !!item && ['pending','confirmed'].includes(item.status) && !item.check_in_at && new Date(item.appointment_at)>now; }
function present(item) { const doctor=doctorProfileService.get(item.doctor_id); const time=new Date(item.appointment_at).toLocaleTimeString('en-GB',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit'}); return { ...item, doctor:doctor?.display_name??'Doctor unavailable', specialty:doctor?.specialty??'', date:clinicToday(new Date(item.appointment_at)), time, timeLabel:slotRange(time), location:'Arion Health Clinic' }; }
export const appointmentService={
 list(){return appointmentRepository.list().filter(item=>item.patient_id===exampleIds.patient).map(present).sort((a,b)=>new Date(a.appointment_at)-new Date(b.appointment_at));},
 get(id){const item=appointmentRepository.get(id);return item&&item.patient_id===exampleIds.patient?present(item):null;},
 cancel(id){const item=appointmentRepository.get(id);if(!canManageAppointment(item?present(item):null))return{error:'This appointment can no longer be cancelled.'};appointmentRepository.update(id,{status:'cancelled'});return{appointment:present(appointmentRepository.get(id))};},
 reschedule(id,date,time){const item=appointmentRepository.get(id);if(!canManageAppointment(item?present(item):null))return{error:'This appointment can no longer be rescheduled.'};if(!bookingService.getSlots(item.doctor_id,date).some(slot=>slot.time===time&&slot.available))return{error:'Select an available date and time. That slot may no longer be available.'};appointmentRepository.update(id,{appointment_at:`${date}T${time}:00+08:00`});return{appointment:present(appointmentRepository.get(id))};},
};
