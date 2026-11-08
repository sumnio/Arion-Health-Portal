import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createDoctorApiService } from '../src/services/doctorApiService.js';
import { createPatientApiService } from '../src/services/patientApiService.js';

const prescription = {
  id: 'rx1', medicine: 'Paracetamol', dosage: '500 mg', instructions: 'As needed',
  attachment_available: true, attachment: { filename: 'prescription.pdf', mime_type: 'application/pdf', size: 1200 },
  issued_at: '2026-11-08T02:00:00.000Z', status: 'issued',
  doctor: { display_name: 'Sample Doctor', specialty: 'General Doctor' },
  medical_record: { id: 'record1', encounter_at: '2026-11-08T02:00:00.000Z', appointment: { id: 'appointment1', appointment_at: '2026-11-08T01:00:00.000Z', visit_type: 'general_consultation' } },
};

test('Doctor and Patient services normalize server-side prescription history pagination', async () => {
  const result = { prescriptions: [prescription], pagination: { page: 2, page_size: 5, total: 6, page_count: 2 } };
  const doctor = createDoctorApiService({ async getPatientPrescriptions() { return result; } });
  const patient = createPatientApiService({ async getPrescriptions() { return result; } });
  assert.deepEqual((await doctor.getPatientPrescriptions('patient1', { page: 2 })).pagination, { page: 2, pageSize: 5, total: 6, pageCount: 2 });
  assert.deepEqual((await patient.getPrescriptions({ page: 2 })).pagination, { page: 2, pageSize: 5, total: 6, pageCount: 2 });
});

test('Prescription attachment control provides authenticated View and Download with object URL cleanup', async () => {
  const source = await readFile(new URL('../src/components/records/PrescriptionAttachmentButton.jsx', import.meta.url), 'utf8');
  assert.match(source, /'View'/);
  assert.match(source, /'Download'/);
  assert.match(source, /inline: mode === 'view'/);
  assert.match(source, /URL\.createObjectURL/);
  assert.match(source, /URL\.revokeObjectURL/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /mimeType === 'application\/pdf'/);
});

test('Doctor and Patient prescription history are read-only, paginated, and preserve Medical Record context', async () => {
  const [history, doctorPage, patientPage] = await Promise.all([
    readFile(new URL('../src/components/records/PrescriptionHistory.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/doctor/DoctorPatientDetail.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/patient/PatientRecords.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(history, /Issued · Read-only/);
  assert.match(history, /Attachment available/);
  assert.match(history, /View linked Medical Record/);
  assert.match(history, /Prescription history pages/);
  assert.doesNotMatch(history, />\s*(?:Edit|Replace|Delete)\s*</);
  assert.match(doctorPage, /\['prescriptions', 'Prescriptions'\]/);
  assert.match(doctorPage, /No prescriptions have been issued for this Patient\./);
  assert.match(patientPage, /You do not have any prescriptions yet\./);
  assert.match(patientPage, /role="tablist"/);
});

test('Staff and Admin pages do not add prescription history content', async () => {
  const paths = [
    '../src/pages/staff/StaffPatientDetail.jsx',
    '../src/pages/admin/AdminPatients.jsx',
  ];
  for (const path of paths) {
    try {
      const source = await readFile(new URL(path, import.meta.url), 'utf8');
      assert.doesNotMatch(source, /PrescriptionHistory|downloadPrescriptionAttachment/);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
});
