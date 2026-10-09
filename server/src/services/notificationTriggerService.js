const APPOINTMENT_RESOURCE = 'appointment';

const CONTENT = Object.freeze({
  patient: Object.freeze({
    appointment_confirmed: ['Appointment confirmed', 'Your appointment has been confirmed.'],
    appointment_rescheduled: ['Appointment rescheduled', 'Your appointment has been rescheduled.'],
    appointment_cancelled: ['Appointment cancelled', 'Your appointment has been cancelled.'],
    appointment_completed: ['Consultation completed', 'Your consultation has been completed.'],
  }),
  staff: Object.freeze({
    patient_booking_created: ['New patient booking', 'A patient appointment has been booked.'],
    appointment_rescheduled: ['Appointment rescheduled', 'A patient appointment has been rescheduled.'],
    appointment_cancelled: ['Appointment cancelled', 'A patient appointment has been cancelled.'],
  }),
  doctor: Object.freeze({
    assigned_appointment_created: ['New assigned appointment', 'A new appointment has been assigned to you.'],
    patient_arrived: ['Patient arrived', 'A patient has arrived for an assigned appointment.'],
    appointment_marked_urgent: ['Appointment marked urgent', 'An assigned appointment has been marked urgent.'],
    appointment_rescheduled: ['Appointment rescheduled', 'An assigned appointment has been rescheduled.'],
    appointment_cancelled: ['Appointment cancelled', 'An assigned appointment has been cancelled.'],
  }),
});

export async function invokeNotificationTrigger(service, method, payload) {
  try {
    await service?.[method]?.(payload);
  } catch {
    // The source workflow has already committed; notification delivery is best effort.
  }
}

function id(value) {
  const result = value?._id ?? value?.id ?? value;
  return result == null ? null : String(result);
}

function eventInput(profile, role, type, appointmentId) {
  const [title, message] = CONTENT[role][type];
  return {
    recipient_user_profile_id: id(profile),
    recipient_role: role,
    type,
    title,
    message,
    related_resource_type: APPOINTMENT_RESOURCE,
    related_resource_id: id(appointmentId),
  };
}

export function createNotificationTriggerService({ repository, notificationService, logger }) {
  function log({ event = 'NOTIFICATION_TRIGGER_FAILED', outcome = 'failure', role, type, appointmentId }) {
    try {
      logger?.logSecurityEvent({
        event,
        severity: outcome === 'failure' ? 'warning' : 'info',
        outcome,
        target_type: APPOINTMENT_RESOURCE,
        target_id: id(appointmentId),
        metadata: { notification_type: type, recipient_role: role },
      });
    } catch {
      // Notification telemetry must never affect the completed business action.
    }
  }

  async function createForProfile(profile, role, type, appointmentId) {
    try {
      await notificationService.createNotification(eventInput(profile, role, type, appointmentId));
    } catch {
      log({ role, type, appointmentId });
    }
  }

  async function notifyPatient(patientId, type, appointmentId) {
    try {
      const profile = await repository.findActivePatientProfileByPatientId(patientId);
      if (profile) await createForProfile(profile, 'patient', type, appointmentId);
    } catch {
      log({ role: 'patient', type, appointmentId });
    }
  }

  async function notifyDoctor(doctorId, type, appointmentId) {
    try {
      const profile = await repository.findActiveDoctorProfileByDoctorId(doctorId);
      if (profile) {
        await createForProfile(profile, 'doctor', type, appointmentId);
      } else {
        log({ event: 'NOTIFICATION_RECIPIENT_SKIPPED', outcome: 'skipped', role: 'doctor', type, appointmentId });
      }
    } catch {
      log({ role: 'doctor', type, appointmentId });
    }
  }

  async function notifyStaff(type, appointmentId) {
    try {
      const profiles = await repository.listActiveStaffProfiles();
      for (const profile of profiles) {
        await createForProfile(profile, 'staff', type, appointmentId);
      }
    } catch {
      log({ role: 'staff', type, appointmentId });
    }
  }

  async function run(task, role, type, appointmentId) {
    try {
      await task();
    } catch {
      log({ role, type, appointmentId });
    }
  }

  return Object.freeze({
    async patientBooked({ appointmentId, doctorId }) {
      await run(async () => {
        await notifyStaff('patient_booking_created', appointmentId);
        await notifyDoctor(doctorId, 'assigned_appointment_created', appointmentId);
      }, 'staff', 'patient_booking_created', appointmentId);
    },

    async staffAppointmentCreated({ appointmentId, doctorId }) {
      await notifyDoctor(doctorId, 'assigned_appointment_created', appointmentId);
    },

    async appointmentConfirmed({ appointmentId, patientId }) {
      await notifyPatient(patientId, 'appointment_confirmed', appointmentId);
    },

    async patientRescheduled({ appointmentId, patientId, doctorId }) {
      await run(async () => {
        await notifyPatient(patientId, 'appointment_rescheduled', appointmentId);
        await notifyStaff('appointment_rescheduled', appointmentId);
        await notifyDoctor(doctorId, 'appointment_rescheduled', appointmentId);
      }, 'patient', 'appointment_rescheduled', appointmentId);
    },

    async patientCancelled({ appointmentId, patientId, doctorId }) {
      await run(async () => {
        await notifyPatient(patientId, 'appointment_cancelled', appointmentId);
        await notifyStaff('appointment_cancelled', appointmentId);
        await notifyDoctor(doctorId, 'appointment_cancelled', appointmentId);
      }, 'patient', 'appointment_cancelled', appointmentId);
    },

    async patientArrived({ appointmentId, doctorId }) {
      await notifyDoctor(doctorId, 'patient_arrived', appointmentId);
    },

    async appointmentMarkedUrgent({ appointmentId, doctorId }) {
      await notifyDoctor(doctorId, 'appointment_marked_urgent', appointmentId);
    },

    async appointmentCompleted({ appointmentId, patientId }) {
      await notifyPatient(patientId, 'appointment_completed', appointmentId);
    },
  });
}
