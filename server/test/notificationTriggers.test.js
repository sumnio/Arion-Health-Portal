import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotificationTriggerService } from '../src/services/notificationTriggerService.js';

const ids = Object.freeze({
  patient: '100000000000000000000001',
  patientProfile: '200000000000000000000001',
  unlinkedPatient: '100000000000000000000002',
  inactivePatient: '100000000000000000000003',
  doctor: '300000000000000000000001',
  doctorProfile: '400000000000000000000001',
  inactiveDoctor: '300000000000000000000002',
  staffOne: '500000000000000000000001',
  staffTwo: '500000000000000000000002',
  appointment: '600000000000000000000001',
});
const APPOINTMENT_AT = new Date('2026-10-12T06:00:00.000Z');

function context({ failedRecipient, loggerThrows = false } = {}) {
  const created = [];
  const logs = [];
  const repository = {
    async findActivePatientProfileByPatientId(patientId) {
      return String(patientId) === ids.patient ? { _id: ids.patientProfile } : null;
    },
    async findActiveDoctorProfileByDoctorId(doctorId) {
      return String(doctorId) === ids.doctor ? { _id: ids.doctorProfile } : null;
    },
    async listActiveStaffProfiles() {
      return [{ _id: ids.staffOne }, { _id: ids.staffTwo }];
    },
    async findAppointmentNotificationContext(appointmentId) {
      return String(appointmentId) === ids.appointment ? {
        patient_display_name: 'Sample Patient',
        doctor_display_name: 'Sample Doctor',
        appointment_at: APPOINTMENT_AT,
      } : null;
    },
  };
  const notificationService = {
    async createNotification(input) {
      if (String(input.recipient_user_profile_id) === failedRecipient) throw new Error('private storage failure');
      created.push(structuredClone(input));
    },
  };
  const logger = { logSecurityEvent(event) { if (loggerThrows) throw new Error('logger unavailable'); logs.push(structuredClone(event)); } };
  return {
    created,
    logs,
    repository,
    triggers: createNotificationTriggerService({ repository, notificationService, logger }),
  };
}

function recipients(items) {
  return items.map(item => `${item.recipient_role}:${item.recipient_user_profile_id}`).sort();
}

test('Patient booking notifies every active Staff and only the assigned active Doctor', async () => {
  const { created, triggers } = context();
  await triggers.patientBooked({ appointmentId: ids.appointment, doctorId: ids.doctor });
  assert.deepEqual(recipients(created), [
    `doctor:${ids.doctorProfile}`,
    `staff:${ids.staffOne}`,
    `staff:${ids.staffTwo}`,
  ]);
  assert.deepEqual(created.map(item => item.type).sort(), [
    'assigned_appointment_created',
    'patient_booking_created',
    'patient_booking_created',
  ]);
  assert.equal(created.some(item => item.recipient_role === 'patient' || item.recipient_role === 'admin'), false);
  const staff = created.find(item => item.recipient_role === 'staff');
  assert.equal(staff.patient_display_name, 'Sample Patient');
  assert.equal(staff.doctor_display_name, 'Sample Doctor');
  assert.equal(staff.appointment_at.toISOString(), APPOINTMENT_AT.toISOString());
  const doctor = created.find(item => item.recipient_role === 'doctor');
  assert.equal(doctor.patient_display_name, 'Sample Patient');
  assert.equal('doctor_display_name' in doctor, false);
});

test('Staff-created appointment notifies only its assigned active Doctor', async () => {
  const { created, triggers } = context();
  await triggers.staffAppointmentCreated({ appointmentId: ids.appointment, doctorId: ids.doctor });
  assert.deepEqual(recipients(created), [`doctor:${ids.doctorProfile}`]);
  assert.equal(created[0].type, 'assigned_appointment_created');
});

test('confirmation and completion notify only a portal-linked active Patient', async () => {
  const { created, triggers } = context();
  await triggers.appointmentConfirmed({ appointmentId: ids.appointment, patientId: ids.patient });
  await triggers.appointmentCompleted({ appointmentId: ids.appointment, patientId: ids.patient });
  await triggers.appointmentConfirmed({ appointmentId: ids.appointment, patientId: ids.unlinkedPatient });
  await triggers.appointmentCompleted({ appointmentId: ids.appointment, patientId: ids.inactivePatient });
  assert.deepEqual(created.map(item => item.type), ['appointment_confirmed', 'appointment_completed']);
  assert.ok(created.every(item => item.recipient_user_profile_id === ids.patientProfile));
  assert.ok(created.every(item => item.doctor_display_name === 'Sample Doctor'));
  assert.ok(created.every(item => item.appointment_at.toISOString() === APPOINTMENT_AT.toISOString()));
  assert.ok(created.every(item => !('patient_display_name' in item)));
});

test('Patient reschedule and cancellation fan out to Patient, active Staff, and assigned Doctor', async () => {
  const { created, triggers } = context();
  const payload = { appointmentId: ids.appointment, patientId: ids.patient, doctorId: ids.doctor };
  await triggers.patientRescheduled(payload);
  await triggers.patientCancelled(payload);
  for (const type of ['appointment_rescheduled', 'appointment_cancelled']) {
    const matching = created.filter(item => item.type === type);
    assert.deepEqual(recipients(matching), [
      `doctor:${ids.doctorProfile}`,
      `patient:${ids.patientProfile}`,
      `staff:${ids.staffOne}`,
      `staff:${ids.staffTwo}`,
    ]);
  }
  assert.equal(created.some(item => item.recipient_role === 'admin'), false);
  for (const item of created) {
    assert.equal(item.appointment_at.toISOString(), APPOINTMENT_AT.toISOString());
    if (item.recipient_role === 'patient') {
      assert.equal(item.doctor_display_name, 'Sample Doctor');
      assert.equal('patient_display_name' in item, false);
    } else if (item.recipient_role === 'staff') {
      assert.equal(item.patient_display_name, 'Sample Patient');
      assert.equal(item.doctor_display_name, 'Sample Doctor');
    } else {
      assert.equal(item.patient_display_name, 'Sample Patient');
      assert.equal('doctor_display_name' in item, false);
    }
  }
});

test('Staff cancellation notifies only the linked active Patient and assigned active Doctor', async () => {
  const { created, triggers } = context();
  await triggers.staffCancelled({ appointmentId: ids.appointment, patientId: ids.patient, doctorId: ids.doctor });
  assert.deepEqual(recipients(created), [
    `doctor:${ids.doctorProfile}`,
    `patient:${ids.patientProfile}`,
  ]);
  assert.ok(created.every(item => item.type === 'appointment_cancelled'));
  assert.equal(created.some(item => item.recipient_role === 'staff' || item.recipient_role === 'admin'), false);
});

test('Staff cancellation skips unlinked or inactive recipients', async () => {
  const { created, triggers } = context();
  await triggers.staffCancelled({
    appointmentId: ids.appointment,
    patientId: ids.unlinkedPatient,
    doctorId: ids.inactiveDoctor,
  });
  assert.equal(created.length, 0);
});

test('arrival and Normal-to-Urgent notify only the assigned active Doctor', async () => {
  const { created, triggers } = context();
  await triggers.patientArrived({ appointmentId: ids.appointment, doctorId: ids.doctor });
  await triggers.appointmentMarkedUrgent({ appointmentId: ids.appointment, doctorId: ids.doctor });
  assert.deepEqual(created.map(item => item.type), ['patient_arrived', 'appointment_marked_urgent']);
  assert.ok(created.every(item => item.recipient_user_profile_id === ids.doctorProfile));
  assert.ok(created.every(item => item.patient_display_name === 'Sample Patient'));
  assert.ok(created.every(item => item.appointment_at.toISOString() === APPOINTMENT_AT.toISOString()));
  assert.equal(JSON.stringify(created).includes('urgency_reason'), false);
});

test('inactive or unlinked Doctor is skipped and logged without fabricating a recipient', async () => {
  const { created, logs, triggers } = context();
  await triggers.patientArrived({ appointmentId: ids.appointment, doctorId: ids.inactiveDoctor });
  assert.equal(created.length, 0);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].event, 'NOTIFICATION_RECIPIENT_SKIPPED');
  assert.deepEqual(logs[0].metadata, { notification_type: 'patient_arrived', recipient_role: 'doctor' });
});

test('one recipient failure is contained, safely logged, and does not stop Staff fan-out', async () => {
  const { created, logs, triggers } = context({ failedRecipient: ids.staffOne });
  await assert.doesNotReject(triggers.patientBooked({ appointmentId: ids.appointment, doctorId: ids.doctor }));
  assert.deepEqual(recipients(created), [`doctor:${ids.doctorProfile}`, `staff:${ids.staffTwo}`]);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].event, 'NOTIFICATION_TRIGGER_FAILED');
  assert.equal(JSON.stringify(logs).includes('private storage failure'), false);
});

test('notification and telemetry failures cannot fail the completed business action', async () => {
  const { triggers } = context({ failedRecipient: ids.staffOne, loggerThrows: true });
  await assert.doesNotReject(triggers.patientBooked({ appointmentId: ids.appointment, doctorId: ids.inactiveDoctor }));
});

test('missing rich context falls back to fixed generic content without blocking delivery', async () => {
  const { created, repository, triggers } = context();
  repository.findAppointmentNotificationContext = async () => null;
  await triggers.appointmentConfirmed({ appointmentId: ids.appointment, patientId: ids.patient });
  assert.equal(created.length, 1);
  assert.equal(created[0].message, 'Your appointment has been confirmed.');
  assert.equal('patient_display_name' in created[0], false);
  assert.equal('doctor_display_name' in created[0], false);
  assert.equal('appointment_at' in created[0], false);
});

test('generated notifications contain only approved role-specific operational context', async () => {
  const { created, triggers } = context();
  const payload = { appointmentId: ids.appointment, patientId: ids.patient, doctorId: ids.doctor };
  await triggers.patientBooked(payload);
  await triggers.appointmentConfirmed(payload);
  await triggers.patientRescheduled(payload);
  await triggers.patientCancelled(payload);
  await triggers.staffCancelled(payload);
  await triggers.patientArrived(payload);
  await triggers.appointmentMarkedUrgent(payload);
  await triggers.appointmentCompleted(payload);
  for (const item of created) {
    assert.equal(item.related_resource_type, 'appointment');
    assert.equal(item.related_resource_id, ids.appointment);
    const allowed = new Set([
      'appointment_at', 'doctor_display_name', 'message', 'patient_display_name',
      'recipient_role', 'recipient_user_profile_id', 'related_resource_id',
      'related_resource_type', 'title', 'type',
    ]);
    assert.ok(Object.keys(item).every(key => allowed.has(key)));
  }
  const serialized = JSON.stringify(created).toLowerCase();
  for (const forbidden of ['diagnosis', 'prescription', 'visit reason', 'urgency explanation', 'contact', 'date of birth', 'address', 'password', 'mfa', 'token']) {
    assert.equal(serialized.includes(forbidden), false);
  }
});
