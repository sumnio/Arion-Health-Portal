import test from 'node:test';
import assert from 'node:assert/strict';
import { doctorHistoryService as history } from '../src/services/doctorHistoryService.js';
import { doctorRecordService } from '../src/services/doctorRecordService.js';
import { doctorCertificateService } from '../src/services/doctorCertificateService.js';
import { doctorPatientService } from '../src/services/doctorPatientService.js';
import { clinicToday } from '../src/services/bookingService.js';
import { readFile } from 'node:fs/promises';
import { createDoctorApiService } from '../src/services/doctorApiService.js';
const patient = n => '10000000-0000-4000-8000-00000000000'+n;
test('history joins existing prescriptions, appointments and issued certificates for the correct patient',()=>{
 const data=history.get(patient(1));
 const record=data.records.find(item=>item.id==='30000000-0000-4000-8000-000000000001');
 assert.equal(record.prescriptions.length,2);
 assert(record.appointment);
 assert(data.certificates.some(item=>item.medical_record_id===record.id));
 assert(data.records.some(item=>item.id==='80000000-0000-4000-8000-000000000001'));
 assert.deepEqual(history.get(patient(4)),{records:[],certificates:[]});
 assert.equal(history.get('missing'),null);
 data.records[0].diagnosis='modified';
 assert.notEqual(history.get(patient(1)).records[0].diagnosis,'modified');
});
test('new records and certificates appear without allowing duplicate record creation or leaking to other patients',()=>{
 const selection={appointmentId:'70000000-0000-4000-8000-000000000011',date:clinicToday()};
 assert(doctorPatientService.get(patient(1),selection).canAddRecord);
 const record=doctorRecordService.save(patient(1),selection,{diagnosis:'Mock diagnosis',notes:'Mock notes',follow_up:'Mock follow-up',encounter_at:clinicToday()+'T13:00',prescriptions:[{medicine:'Mock medicine',dosage:'Mock dosage',instructions:'Mock instructions'}]}).record;
 const certificate=doctorCertificateService.issue(record.id,{purpose:'Mock purpose',diagnosis_summary:record.diagnosis,date_issued:clinicToday(),valid_until:''},'history-test').certificate;
 const data=history.get(patient(1));
 const saved=data.records.find(item=>item.id===record.id);
 assert.equal(saved.prescriptions[0].medical_record_id,record.id);
 assert.equal(saved.notes,'Mock notes');
 assert.equal(saved.appointment.id,selection.appointmentId);
 assert(data.certificates.some(item=>item.id===certificate.id));
 assert.equal(doctorPatientService.get(patient(1),selection).canAddRecord,false);
 assert(!history.get(patient(2)).certificates.some(item=>item.id===certificate.id));
});

test('Doctor appointment history service normalizes backend pagination and newest-first items', async () => {
 const service=createDoctorApiService({async getAppointmentHistory(){return{items:[{id:'a2',patient:{id:'p1',full_name:'Alex Patient'},appointment_at:'2026-10-15T03:00:00.000Z',visit_type:'follow_up',reason:'Review',status:'completed',check_in_at:null,medical_record_id:'r1'}],page:2,limit:10,total:11,page_count:2,range:{preset:'last_30_days'}};}});
 const result=await service.getAppointmentHistory({page:2});
 assert.equal(result.page,2);assert.equal(result.limit,10);assert.equal(result.total,11);assert.equal(result.pageCount,2);
 assert.equal(result.items[0].patientName,'Alex Patient');assert.equal(result.items[0].visitLabel,'Follow-up');assert.equal(result.items[0].patientPath,'/doctor/patients/p1');
});

test('My Schedule contains an accessible History tab with approved filters and existing navigation', async () => {
 const schedule=await readFile(new URL('../src/pages/doctor/DoctorSchedule.jsx',import.meta.url),'utf8');
 const historyPage=await readFile(new URL('../src/components/scheduling/DoctorAppointmentHistory.jsx',import.meta.url),'utf8');
 assert.match(schedule,/>Appointments</);assert.match(schedule,/>Availability</);assert.match(schedule,/>History</);assert.match(schedule,/DoctorAppointmentHistory/);
 assert.match(historyPage,/last_30_days/);assert.match(historyPage,/Last 30 Days/);assert.match(historyPage,/Today/);assert.match(historyPage,/Last 7 Days/);assert.match(historyPage,/This Month/);assert.match(historyPage,/Custom Range/);
 assert.match(historyPage,/Patient Search/);assert.match(historyPage,/All visit types/);assert.match(historyPage,/No-show/);assert.match(historyPage,/newest first/);
 assert.match(historyPage,/Appointment history pages/);assert.match(historyPage,/>Previous</);assert.match(historyPage,/>Next</);assert.match(historyPage,/setPage\(1\)/);
 assert.match(historyPage,/View Patient/);assert.match(historyPage,/View Medical Record/);assert.match(historyPage,/item\.medical_record_id &&/);assert.match(historyPage,/tab: 'records'/);
 assert.match(historyPage,/No appointment history found for the selected filters/);assert.match(historyPage,/From date must be on or before To date/);
 for(const forbidden of ['diagnosis','prescriptions','Doctor’s notes','supporting-document','allergies','emergency contact'])assert.doesNotMatch(historyPage,new RegExp(forbidden,'i'));
});

test('Doctor appointment history layout stacks safely on narrow screens', async () => {
 const styles=await readFile(new URL('../src/styles/doctor-schedule.css',import.meta.url),'utf8');
 assert.match(styles,/\.history-filters/);assert.match(styles,/\.history-list/);assert.match(styles,/overflow-wrap:\s*anywhere/);assert.match(styles,/@media \(max-width: 550px\)[^{]*\{[^}]*\.doctor-schedule-page \.schedule-panel/s);
 assert.match(styles,/\.doctor-schedule-page \.history-list > li \{ grid-template-columns: 1fr/);
 assert.match(styles,/\.doctor-schedule-page \.history-search > div \{ align-items: stretch; flex-direction: column/);
});
