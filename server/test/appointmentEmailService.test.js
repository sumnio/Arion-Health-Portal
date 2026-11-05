import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppointmentEmailService } from '../src/services/appointmentEmailService.js';

const appointment = {
  appointmentId: 'appointment-1',
  patientId: 'patient-1',
  appointmentAt: new Date('2026-11-12T02:30:00.000Z'),
  doctorName: 'Dr. Maria Santos',
};

test('reschedule email uses the Patient account email and updated Manila schedule', async () => {
  const calls = [];
  const service = createAppointmentEmailService({
    repository: { async findRescheduleEmailRecipient() { return { email: 'patient@example.test', has_portal_account: true }; } },
    email: { async sendAppointmentRescheduledEmail(value) { calls.push(structuredClone(value)); } },
    timeZone: 'Asia/Manila',
  });
  assert.deepEqual(await service.appointmentRescheduled(appointment), { status: 'sent' });
  assert.deepEqual(calls, [{
    to: 'patient@example.test', appointmentId: 'appointment-1',
    appointmentDate: 'November 12, 2026', appointmentTime: '10:30 AM',
    doctorName: 'Dr. Maria Santos',
  }]);
});

test('missing Patient email skips delivery while provider failure returns a safe status', async () => {
  const missing = createAppointmentEmailService({
    repository: { async findRescheduleEmailRecipient() { return { email: null, has_portal_account: false }; } },
    email: { async sendAppointmentRescheduledEmail() { throw new Error('must not run'); } },
  });
  assert.deepEqual(await missing.appointmentRescheduled(appointment), { status: 'skipped' });

  const unlinked = createAppointmentEmailService({
    repository: { async findRescheduleEmailRecipient() { return { email: 'unlinked@example.test', has_portal_account: false }; } },
    email: { async sendAppointmentRescheduledEmail() { throw new Error('must not run'); } },
  });
  assert.deepEqual(await unlinked.appointmentRescheduled(appointment), { status: 'skipped' });

  const failing = createAppointmentEmailService({
    repository: { async findRescheduleEmailRecipient() { return { email: 'patient@example.test', has_portal_account: true }; } },
    email: { async sendAppointmentRescheduledEmail() { throw new Error('private provider detail'); } },
  });
  assert.deepEqual(await failing.appointmentRescheduled(appointment), { status: 'failed' });
});
