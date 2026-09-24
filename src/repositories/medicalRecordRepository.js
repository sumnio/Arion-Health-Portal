import { medicalRecords, prescriptions } from '../mocks/medicalRecordData.js';
import { createMockId } from './mockId.js';

export const medicalRecordStore = [...medicalRecords,
  { id:'80000000-0000-4000-8000-000000000001', patient_id:'10000000-0000-4000-8000-000000000001', doctor_id:'50000000-0000-4000-8000-000000000003', appointment_id:'70000000-0000-4000-8000-000000000001', encounter_at:'2026-09-24T09:00:00+08:00', diagnosis:'Routine health examination', notes:null, follow_up:null, created_at:'2026-09-24T09:20:00+08:00', updated_at:'2026-09-24T09:20:00+08:00' },
  { id:'80000000-0000-4000-8000-000000000002', patient_id:'10000000-0000-4000-8000-000000000002', doctor_id:'50000000-0000-4000-8000-000000000003', appointment_id:'70000000-0000-4000-8000-000000000002', encounter_at:'2026-09-24T09:30:00+08:00', diagnosis:'Allergic rhinitis, improving', notes:null, follow_up:null, created_at:'2026-09-24T09:50:00+08:00', updated_at:'2026-09-24T09:50:00+08:00' },
  { id:'80000000-0000-4000-8000-000000000006', patient_id:'10000000-0000-4000-8000-000000000002', doctor_id:'50000000-0000-4000-8000-000000000003', appointment_id:'70000000-0000-4000-8000-000000000006', encounter_at:'2026-09-23T09:00:00+08:00', diagnosis:'Allergic rhinitis', notes:null, follow_up:null, created_at:'2026-09-23T09:20:00+08:00', updated_at:'2026-09-23T09:20:00+08:00' },
];
export const prescriptionStore = [...prescriptions];

export const medicalRecordRepository = {
  list() { return medicalRecordStore; },
  get(id) { return medicalRecordStore.find(item=>item.id===id) ?? null; },
  findByAppointment(appointmentId) { return medicalRecordStore.find(item=>item.appointment_id===appointmentId) ?? null; },
  create(values, prescriptionValues=[]) {
    const record={ id:createMockId(), ...values };
    medicalRecordStore.push(record);
    const created=prescriptionValues.map(item=>({ id:createMockId(), medical_record_id:record.id, ...item }));
    prescriptionStore.push(...created);
    return record;
  },
  prescriptions(recordId) { return prescriptionStore.filter(item=>item.medical_record_id===recordId); },
};
