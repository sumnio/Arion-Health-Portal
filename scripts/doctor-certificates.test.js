import test from 'node:test';
import assert from 'node:assert/strict';
import { doctorCertificateService as service } from '../src/services/doctorCertificateService.js';
import { doctorRecordService } from '../src/services/doctorRecordService.js';
import { doctorRecordStore } from '../src/mocks/doctorRecordStore.js';
import { clinicToday } from '../src/services/bookingService.js';
const id='80000000-0000-4000-8000-000000000001';
const values={purpose:'Fit to Work',diagnosis_summary:'Routine examination',date_issued:clinicToday(),valid_until:''};
test('invalid record and incomplete context are rejected',()=>{
 assert(service.context('missing').error);
 doctorRecordStore.push({id:'broken-context',patient_id:'missing',doctor_id:'missing'});
 assert(service.issue('broken-context',values,'broken').errors.form);
 doctorRecordStore.pop();
});
test('required fields and date ordering validate without issuing',()=>{
 const result=service.issue(id,{...values,purpose:' ',diagnosis_summary:'',valid_until:'2020-01-01'},'invalid');
 for(const key of ['purpose','diagnosis_summary','valid_until']) assert(result.errors[key]);
 assert(service.issue(id,{...values,date_issued:'2026-02-30'},'invalid-date').errors.date_issued);
 assert.equal(service.list(id).length,0);
});
test('issue uses schema links and prevents repeated submission and duplicate case',()=>{
 const result=service.issue(id,values,'submission-1');
 assert.equal(result.certificate.status,'issued');
 assert.equal(result.certificate.medical_record_id,id);
 assert.equal(result.certificate.valid_until,null);
 assert(service.issue(id,{...values,purpose:'Different purpose'},'submission-1').errors.form);
 assert(service.issue(id,{...values,purpose:' FIT TO WORK '},'submission-2').errors.form);
 assert.equal(service.list(id).length,1);
 assert(service.issue(id,{...values,purpose:'Sick Leave'},'submission-3').certificate);
});
test('Milestone 12 saved record supplies patient, doctor and diagnosis context',()=>{
 const patient='10000000-0000-4000-8000-000000000003';
 const saved=doctorRecordService.save(patient,{appointmentId:'70000000-0000-4000-8000-000000000003',date:clinicToday()},{diagnosis:'Routine examination',encounter_at:clinicToday()+'T13:00',prescriptions:[]}).record;
 const context=service.context(saved.id);
 assert.equal(context.patient.id,patient);
 assert.equal(context.doctor.id,saved.doctor_id);
 assert.equal(context.record.diagnosis,saved.diagnosis);
 assert(service.issue(saved.id,values,'new-record').certificate);
});
