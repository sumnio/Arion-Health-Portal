import { createMockId } from './mockId.js';

export const DEMO_DOCTOR_ID = '50000000-0000-4000-8000-000000000003';

const relativeAppointments = [
  ['70000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',0,'09:00','completed','General Consultation','normal',null],
  ['70000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',0,'09:30','completed','Follow-up','normal',null],
  ['70000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003',0,'13:00','confirmed','Check-up','normal',null],
  ['70000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000004',0,'14:30','pending','Follow-up','normal',null],
  ['70000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000005',0,'16:00','confirmed','General Consultation','normal',null],
  ['70000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000001',0,'15:30','confirmed','Check-up','normal',null],
  ['70000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000002',-1,'09:00','completed','Follow-up','normal',null],
  ['70000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000003',-1,'10:00','cancelled','Check-up','normal',null],
  ['70000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000005',-1,'13:00','no_show','General Consultation','normal',null],
  ['70000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000004',1,'09:30','confirmed','Follow-up','normal',null],
  ['70000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',1,'14:00','pending','General Consultation','normal',null],
  ['90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004',0,'10:00','confirmed','General Consultation','urgent','09:50'],
  ['90000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003',0,'10:30','confirmed','General Consultation','normal','09:40'],
  ['90000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000005',0,'11:00','confirmed','General Consultation','normal','09:45'],
  ['90000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001',0,'11:30','confirmed','General Consultation','normal','09:35'],
].map(([id,patient_id,day_offset,time,status,service,priority,check_in_time]) => ({
  id, patient_id, doctor_id: DEMO_DOCTOR_ID, day_offset, time, status, service,
  reason: service, priority, check_in_time, check_in_at: null,
}));

const fixedAppointments = [
  { id:'20000000-0000-4000-8000-000000000002', patient_id:'10000000-0000-4000-8000-000000000001', doctor_id:'50000000-0000-4000-8000-000000000001', appointment_at:'2026-09-02T10:00:00+08:00', status:'completed', service:'General Consultation', reason:'Follow-up on recovery', check_in_at:null, priority:'normal' },
  { id:'20000000-0000-4000-8000-000000000003', patient_id:'10000000-0000-4000-8000-000000000001', doctor_id:'50000000-0000-4000-8000-000000000002', appointment_at:'2026-09-28T09:00:00+08:00', status:'pending', service:'Follow-up', reason:'Routine follow-up', check_in_at:null, priority:'normal' },
  { id:'20000000-0000-4000-8000-000000000004', patient_id:'10000000-0000-4000-8000-000000000001', doctor_id:'50000000-0000-4000-8000-000000000002', appointment_at:'2026-08-20T14:00:00+08:00', status:'cancelled', service:'General Consultation', reason:'Annual wellness visit', check_in_at:null, priority:'normal' },
  { id:'20000000-0000-4000-8000-000000000005', patient_id:'10000000-0000-4000-8000-000000000001', doctor_id:'50000000-0000-4000-8000-000000000001', appointment_at:'2026-08-14T09:00:00+08:00', status:'no_show', service:'General Consultation', reason:'', check_in_at:null, priority:'normal' },
];
const createdAppointments = [];
const shift = (date, offset) => { const value = new Date(date + 'T00:00:00Z'); value.setUTCDate(value.getUTCDate()+offset); return value.toISOString().slice(0,10); };
const clinicDate = now => { const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now); return ['year','month','day'].map(type=>parts.find(part=>part.type===type).value).join('-'); };
function resolve(item, now) {
  if (!('day_offset' in item)) return item;
  const date = shift(clinicDate(now), item.day_offset);
  return { ...item, appointment_at:`${date}T${item.time}:00+08:00`, check_in_at:item.check_in_at ?? (item.check_in_time ? `${date}T${item.check_in_time}:00+08:00` : item.status === 'completed' ? `${date}T${item.time}:00+08:00` : null) };
}

export const appointmentRepository = {
  list(now = new Date()) { return [...relativeAppointments.map(item=>resolve(item,now)), ...fixedAppointments, ...createdAppointments]; },
  get(id, now = new Date()) { return this.list(now).find(item=>item.id===id) ?? null; },
  create(values) { const entity={ id:createMockId(), ...values }; createdAppointments.push(entity); return entity; },
  update(id, changes) {
    const entity=[...relativeAppointments,...fixedAppointments,...createdAppointments].find(item=>item.id===id);
    if (!entity) return null;
    Object.assign(entity, changes);
    return entity;
  },
  isSlotOccupied(doctorId,date,time,now=new Date()) {
    const target=new Date(`${date}T${time}:00+08:00`).getTime();
    return this.list(now).some(item=>item.doctor_id===doctorId && !['cancelled','no_show'].includes(item.status) && new Date(item.appointment_at).getTime()===target);
  },
};
