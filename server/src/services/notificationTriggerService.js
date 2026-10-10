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

function contentFor(role, type, context) {
  const [title, fallback] = CONTENT[role][type];
  const patient = context.patient_display_name;
  const doctor = context.doctor_display_name;
  const messages = {
    patient: {
      appointment_confirmed: doctor ? `Your appointment with ${doctor} has been confirmed.` : fallback,
      appointment_rescheduled: doctor ? `Your appointment with ${doctor} has been rescheduled.` : fallback,
      appointment_cancelled: doctor ? `Your appointment with ${doctor} has been cancelled.` : fallback,
      appointment_completed: doctor ? `Your consultation with ${doctor} has been completed.` : fallback,
    },
    staff: {
      patient_booking_created: patient && doctor ? `${patient} booked an appointment with ${doctor}.` : fallback,
      appointment_rescheduled: patient && doctor ? `${patient} rescheduled their appointment with ${doctor}.` : fallback,
      appointment_cancelled: patient && doctor ? `${patient}'s appointment with ${doctor} has been cancelled.` : fallback,
    },
    doctor: {
      assigned_appointment_created: patient ? `A new appointment with ${patient} has been assigned to you.` : fallback,
      patient_arrived: patient ? `${patient} has arrived for their appointment.` : fallback,
      appointment_marked_urgent: patient ? `${patient}'s appointment has been marked urgent.` : fallback,
      appointment_rescheduled: patient ? `${patient}'s assigned appointment has been rescheduled.` : fallback,
      appointment_cancelled: patient ? `${patient}'s assigned appointment has been cancelled.` : fallback,
    },
  };
  return [title, messages[role]?.[type] ?? fallback];
}

function contextForRole(role, context) {
  return {
    ...(role !== 'patient' && context.patient_display_name ? { patient_display_name: context.patient_display_name } : {}),
    ...(role !== 'doctor' && context.doctor_display_name ? { doctor_display_name: context.doctor_display_name } : {}),
    ...(context.appointment_at ? { appointment_at: context.appointment_at } : {}),
  };
}

function eventInput(profile, role, type, appointmentId, context = {}) {
  const [title, message] = contentFor(role, type, context);
  return {
    recipient_user_profile_id: id(profile),
    recipient_role: role,
    type,
    title,
    message,
    related_resource_type: APPOINTMENT_RESOURCE,
    related_resource_id: id(appointmentId),
    ...contextForRole(role, context),
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

  async function appointmentContext(appointmentId, role, type) {
    try {
      return await repository.findAppointmentNotificationContext?.(appointmentId) ?? {};
    } catch {
      log({ role, type, appointmentId });
      return {};
    }
  }

  async function createForProfile(profile, role, type, appointmentId, context) {
    try {
      await notificationService.createNotification(eventInput(profile, role, type, appointmentId, context));
    } catch {
      log({ role, type, appointmentId });
    }
  }

  async function notifyPatient(patientId, type, appointmentId, context) {
    try {
      const profile = await repository.findActivePatientProfileByPatientId(patientId);
      if (profile) await createForProfile(profile, 'patient', type, appointmentId, context);
    } catch {
      log({ role: 'patient', type, appointmentId });
    }
  }

  async function notifyDoctor(doctorId, type, appointmentId, context) {
    try {
      const profile = await repository.findActiveDoctorProfileByDoctorId(doctorId);
      if (profile) {
        await createForProfile(profile, 'doctor', type, appointmentId, context);
      } else {
        log({ event: 'NOTIFICATION_RECIPIENT_SKIPPED', outcome: 'skipped', role: 'doctor', type, appointmentId });
      }
    } catch {
      log({ role: 'doctor', type, appointmentId });
    }
  }

  async function notifyStaff(type, appointmentId, context) {
    try {
      const profiles = await repository.listActiveStaffProfiles();
      for (const profile of profiles) {
        await createForProfile(profile, 'staff', type, appointmentId, context);
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
      const context = await appointmentContext(appointmentId, 'staff', 'patient_booking_created');
      await run(async () => {
        await notifyStaff('patient_booking_created', appointmentId, context);
        await notifyDoctor(doctorId, 'assigned_appointment_created', appointmentId, context);
      }, 'staff', 'patient_booking_created', appointmentId);
    },

    async staffAppointmentCreated({ appointmentId, doctorId }) {
      const context = await appointmentContext(appointmentId, 'doctor', 'assigned_appointment_created');
      await notifyDoctor(doctorId, 'assigned_appointment_created', appointmentId, context);
    },

    async appointmentConfirmed({ appointmentId, patientId }) {
      const context = await appointmentContext(appointmentId, 'patient', 'appointment_confirmed');
      await notifyPatient(patientId, 'appointment_confirmed', appointmentId, context);
    },

    async patientRescheduled({ appointmentId, patientId, doctorId }) {
      const context = await appointmentContext(appointmentId, 'patient', 'appointment_rescheduled');
      await run(async () => {
        await notifyPatient(patientId, 'appointment_rescheduled', appointmentId, context);
        await notifyStaff('appointment_rescheduled', appointmentId, context);
        await notifyDoctor(doctorId, 'appointment_rescheduled', appointmentId, context);
      }, 'patient', 'appointment_rescheduled', appointmentId);
    },

    async patientCancelled({ appointmentId, patientId, doctorId }) {
      const context = await appointmentContext(appointmentId, 'patient', 'appointment_cancelled');
      await run(async () => {
        await notifyPatient(patientId, 'appointment_cancelled', appointmentId, context);
        await notifyStaff('appointment_cancelled', appointmentId, context);
        await notifyDoctor(doctorId, 'appointment_cancelled', appointmentId, context);
      }, 'patient', 'appointment_cancelled', appointmentId);
    },

    async staffCancelled({ appointmentId, patientId, doctorId }) {
      const context = await appointmentContext(appointmentId, 'patient', 'appointment_cancelled');
      await run(async () => {
        await notifyPatient(patientId, 'appointment_cancelled', appointmentId, context);
        await notifyDoctor(doctorId, 'appointment_cancelled', appointmentId, context);
      }, 'patient', 'appointment_cancelled', appointmentId);
    },

    async patientArrived({ appointmentId, doctorId }) {
      const context = await appointmentContext(appointmentId, 'doctor', 'patient_arrived');
      await notifyDoctor(doctorId, 'patient_arrived', appointmentId, context);
    },

    async appointmentMarkedUrgent({ appointmentId, doctorId }) {
      const context = await appointmentContext(appointmentId, 'doctor', 'appointment_marked_urgent');
      await notifyDoctor(doctorId, 'appointment_marked_urgent', appointmentId, context);
    },

    async appointmentCompleted({ appointmentId, patientId }) {
      const context = await appointmentContext(appointmentId, 'patient', 'appointment_completed');
      await notifyPatient(patientId, 'appointment_completed', appointmentId, context);
    },
  });
}
