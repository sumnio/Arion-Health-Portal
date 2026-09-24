import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { appointmentRepository } from '../src/repositories/appointmentRepository.js';
import { patientRepository } from '../src/repositories/patientRepository.js';
import { medicalRecordRepository } from '../src/repositories/medicalRecordRepository.js';
import { medicalCertificateRepository } from '../src/repositories/medicalCertificateRepository.js';
import { appointmentService } from '../src/services/appointmentService.js';
import { doctorDashboardService } from '../src/services/doctorDashboardService.js';
import { staffDashboardService } from '../src/services/staffDashboardService.js';
import { medicalRecordService } from '../src/services/medicalRecordService.js';
import { doctorHistoryService } from '../src/services/doctorHistoryService.js';
import { certificateService } from '../src/services/certificateService.js';

test('role services project one canonical Appointment status', () => {
  const now = new Date('2026-09-24T02:00:00Z');
  const id = '70000000-0000-4000-8000-000000000011';
  appointmentRepository.update(id, { status: 'completed' });
  assert.equal(appointmentService.get(id).status, 'completed');
  assert.equal(doctorDashboardService.getDashboard(now).appointments.find(item=>item.id===id).status, 'completed');
  assert.equal(staffDashboardService.getDashboard(now).appointments.find(item=>item.id===id).status, 'completed');
  appointmentRepository.update(id, { status: 'confirmed' });
});

test('canonical repositories retain stable identities and linked entities', () => {
  const patient=patientRepository.get('10000000-0000-4000-8000-000000000001');
  const record=medicalRecordRepository.get('30000000-0000-4000-8000-000000000001');
  const certificate=medicalCertificateRepository.list().find(item=>item.medical_record_id===record.id);
  assert.equal(record.patient_id,patient.id);
  assert.equal(certificate.patient_id,patient.id);
});

test('Doctor and Patient projections read the same record and issued certificate', () => {
  const patientId='10000000-0000-4000-8000-000000000001';
  const record=medicalRecordService.get('30000000-0000-4000-8000-000000000001');
  const history=doctorHistoryService.get(patientId);
  const doctorRecord=history.records.find(item=>item.id===record.id);
  assert.equal(doctorRecord.diagnosis,record.diagnosis);
  const patientCertificate=certificateService.listForPatient(patientId).find(item=>item.medical_record_id===record.id);
  const doctorCertificate=history.certificates.find(item=>item.id===patientCertificate.id);
  assert.equal(doctorCertificate.medical_certificate_number,patientCertificate.medical_certificate_number);
});

test('pages do not import raw mock domain arrays', async () => {
  for (const path of ['../src/pages/patient/PatientAppointments.jsx','../src/pages/doctor/DoctorSchedule.jsx','../src/pages/staff/StaffQueue.jsx']) {
    const source=await readFile(new URL(path,import.meta.url),'utf8');
    assert.doesNotMatch(source,/\/mocks\//);
  }
});
