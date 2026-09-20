import test from 'node:test';
import assert from 'node:assert/strict';
import { staffPatientsService, patientListPage } from '../src/services/staffPatientsService.js';
import { staffWalkInService } from '../src/services/staffWalkInService.js';
const now = new Date('2026-09-20T02:00:00Z');
test('directory searches name and formatted phone, projects only operational data, and includes new guests',()=>{
 const ana=staffPatientsService.list({query:' ANA '},now).items[0];
 assert.equal(ana.name,'Ana Reyes');
 assert.equal(staffPatientsService.list({query:'09175550102'},now).items[0].id,ana.id);
 assert.equal(staffPatientsService.list({query:'not-a-patient'},now).filteredTotal,0);
 assert.equal(staffPatientsService.list({query:'Carlos'},now).items[0].isSenior,true);
 assert.equal(staffPatientsService.list({query:'Robert'},now).items[0].isPwd,true);
 assert.deepEqual(Object.keys(ana).sort(),['id','name','dob','age','sex','contactNumber','isPwd','isSenior'].sort());
 const {patient}=staffWalkInService.register({name:'Mila Garcia',dob:'1980-02-01',sex:'Female',contact_number:'09179990009',is_pwd:true},now);
 assert.equal(staffPatientsService.list({query:'Mila'},now).items[0].id,patient.id);
});
test('pagination covers all patients once, clamps bounds, and handles empty data and senior birthday',()=>{
 const patients=Array.from({length:23},(_,i)=>({id:String(i).padStart(2,'0'),dob:'1966-09-21',sex:'Female',contact_number:'09170000000',is_pwd:false}));
 const names=id=>'Patient '+id;
 const pages=[1,2,3,4,5].map(page=>patientListPage(patients,names,{page},'2026-09-20'));
 assert.deepEqual(pages.map(x=>x.items.length),[5,5,5,5,3]);
 assert.equal(new Set(pages.flatMap(x=>x.items.map(p=>p.id))).size,23);
 assert.equal(patientListPage(patients,names,{page:99}).page,5);
 assert.equal(patientListPage(patients,names,{query:'Patient 00',page:3}).page,1);
 assert.equal(patientListPage([],names).total,0); assert.deepEqual(patientListPage([],names).items,[]);
 assert.equal(pages[0].items[0].isSenior,false);
 assert.equal(patientListPage(patients,names,{},'2026-09-21').items[0].isSenior,true);
});
