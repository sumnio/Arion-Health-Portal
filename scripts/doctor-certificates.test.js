import test from 'node:test';
import assert from 'node:assert/strict';
import { doctorCertificateService as service } from '../src/services/doctorCertificateService.js';
import { doctorRecordService } from '../src/services/doctorRecordService.js';
import { doctorRecordStore } from '../src/mocks/doctorRecordStore.js';
import { clinicToday } from '../src/services/bookingService.js';
import { certificateService } from '../src/services/certificateService.js';
import { nextMockCertificateNumber } from '../src/services/certificateNumberService.js';
import { clinicConfig } from '../src/config/clinicConfig.js';
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
 assert.match(result.certificate.medical_certificate_number,/^MC-MOCK-\d{8}-\d{3}$/);
 assert.equal(result.certificate.medical_record_id,id);
 assert.equal(result.certificate.valid_until,null);
 assert(service.issue(id,{...values,purpose:'Different purpose'},'submission-1').errors.form);
 assert(service.issue(id,{...values,purpose:' FIT TO WORK '},'submission-2').errors.form);
 assert.equal(service.list(id).length,1);
 const second=service.issue(id,{...values,purpose:'Sick Leave'},'submission-3').certificate;
 assert.notEqual(second.medical_certificate_number,result.certificate.medical_certificate_number);
 assert.equal(new Set(service.list(id).map(item=>item.medical_certificate_number)).size,service.list(id).length);
 assert.equal(certificateService.get(result.certificate.id).medical_certificate_number,result.certificate.medical_certificate_number);
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
test('certificate context reads shared Doctor credentials and clinic configuration',()=>{
 const context=service.context(id);
 assert.equal(context.clinic,clinicConfig);
 assert.equal(context.doctor.display_name,'Demo Doctor');
 assert.equal(context.doctor.specialty,'General Medicine');
 assert.equal(context.doctor.license_number,'PRC-0345678');
 assert.equal(context.doctor.ptr_number,'PTR-2026-1003');
 assert.equal(context.doctor.signature_path,'signatures/demo-doctor.png');
 assert.equal(service.update,undefined);
 assert.equal(service.delete,undefined);
});
test('mock certificate number generator is human-readable and collision-safe',()=>{
 const first=nextMockCertificateNumber('2026-09-20',[]);
 const second=nextMockCertificateNumber('2026-09-20',[{medical_certificate_number:first}]);
 assert.equal(first,'MC-MOCK-20260920-001');
 assert.equal(second,'MC-MOCK-20260920-002');
});
