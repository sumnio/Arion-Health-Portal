import { addDays, clinicDate } from '../utils/schedulingTime.js';
import { ASSISTANT_INTENTS } from './assistantIntents.js';

const APPOINTMENT_LIMIT = 3;
const NOTIFICATION_LIMIT = 3;
const UPCOMING_STATUSES = new Set(['pending', 'confirmed']);
const VISIT_TYPE_LABELS = Object.freeze({
  general_consultation: 'General Consultation',
  follow_up: 'Follow-up',
  check_up: 'Check-up',
});

function result(tool, resultCategory, reply) {
  return Object.freeze({ tool, resultCategory, reply });
}

function sentenceText(value, max = 140) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function statusLabel(value) {
  if (value === 'no_show') return 'No-show';
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function formatAppointmentDate(value, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
}

function localDate(value, timeZone) {
  return clinicDate(new Date(value), timeZone);
}

function dateReference(message, now, timeZone) {
  if (/\btomorrow\b/i.test(message)) return addDays(clinicDate(now, timeZone), 1);
  if (/\btoday\b/i.test(message)) return clinicDate(now, timeZone);
  return null;
}

function appointmentSummary(item, timeZone) {
  const doctor = item.doctor_display_name || 'your assigned Doctor';
  const visitType = VISIT_TYPE_LABELS[item.visit_type] ?? 'Appointment';
  return `${formatAppointmentDate(item.appointment_at, timeZone)} with ${doctor} for ${visitType} (${statusLabel(item.status)})`;
}

function orderedAppointments(items) {
  return [...items]
    .filter((item) => Number.isFinite(new Date(item.appointment_at).getTime()))
    .sort((left, right) => new Date(left.appointment_at) - new Date(right.appointment_at));
}

export function createAssistantPatientToolService({
  appointmentService,
  notificationService,
  clinicTimeZone = 'Asia/Manila',
  now = () => new Date(),
}) {
  async function ownAppointments(userProfileId) {
    return orderedAppointments(await appointmentService.listAssistantAppointmentsForPatient(userProfileId));
  }

  function upcoming(items, current) {
    return items.filter((item) => UPCOMING_STATUSES.has(item.status) && new Date(item.appointment_at) >= current);
  }

  async function getMyUpcomingAppointments(userProfileId, { nextOnly = false } = {}) {
    const items = upcoming(await ownAppointments(userProfileId), now());
    const tool = nextOnly ? 'get_my_next_appointment' : 'get_my_upcoming_appointments';
    if (!items.length) {
      return result(tool, 'none', 'You do not currently have an upcoming appointment. You can request one from Book Appointment.');
    }
    if (nextOnly) {
      const item = items[0];
      const reply = `Your next appointment is ${appointmentSummary(item, clinicTimeZone)}. Open My Appointments for the full details.`;
      return result(tool, 'found', reply);
    }
    const visible = items.slice(0, APPOINTMENT_LIMIT).map((item) => appointmentSummary(item, clinicTimeZone));
    const lead = items.length === 1
      ? 'You have 1 upcoming appointment:'
      : `You have ${items.length} upcoming appointments. The next ${visible.length} are:`;
    return result(tool, items.length > 1 ? 'multiple' : 'found', `${lead} ${visible.join('; ')}. Open My Appointments for the full list.`);
  }

  async function getMyAppointmentStatus(userProfileId, message) {
    const current = now();
    const items = await ownAppointments(userProfileId);
    const requestedDate = dateReference(message, current, clinicTimeZone);
    const dated = requestedDate ? items.filter((item) => localDate(item.appointment_at, clinicTimeZone) === requestedDate) : null;
    const future = upcoming(items, current);
    let candidates = dated ?? future;
    let recent = false;
    if (!candidates.length && !requestedDate) {
      candidates = items.filter((item) => new Date(item.appointment_at) < current).slice(-1);
      recent = true;
    }
    if (!candidates.length) {
      return result('get_my_appointment_status', 'none', 'I could not find a relevant appointment in your account. Open My Appointments to review your appointment history.');
    }
    if (candidates.length !== 1) {
      return result('get_my_appointment_status', 'ambiguous', 'You have multiple appointments that could match that question, so I will not guess. Open My Appointments to check the status for the appointment you mean.');
    }
    const item = candidates[0];
    const prefix = recent ? 'Your most recent appointment' : 'Your appointment';
    return result(
      'get_my_appointment_status',
      'found',
      `${prefix} on ${formatAppointmentDate(item.appointment_at, clinicTimeZone)} is ${statusLabel(item.status)}. Open My Appointments for the full details.`,
    );
  }

  async function getMyAssignedDoctor(userProfileId, message) {
    const current = now();
    const items = await ownAppointments(userProfileId);
    const requestedDate = dateReference(message, current, clinicTimeZone);
    const future = upcoming(items, current);
    const candidates = requestedDate
      ? future.filter((item) => localDate(item.appointment_at, clinicTimeZone) === requestedDate)
      : future;
    if (!candidates.length) {
      return result('get_my_assigned_doctor', 'none', 'I could not find an upcoming appointment with an assigned Doctor. Open My Appointments to review your appointments.');
    }
    if (candidates.length === 1) {
      const item = candidates[0];
      const doctor = item.doctor_display_name || 'The assigned Doctor';
      return result('get_my_assigned_doctor', 'found', `${doctor} is assigned to your appointment on ${formatAppointmentDate(item.appointment_at, clinicTimeZone)}. Open My Appointments for the full details.`);
    }
    const visible = candidates.slice(0, APPOINTMENT_LIMIT).map((item) =>
      `${formatAppointmentDate(item.appointment_at, clinicTimeZone)} — ${item.doctor_display_name || 'Doctor unavailable'}`,
    );
    return result('get_my_assigned_doctor', 'ambiguous', `You have multiple upcoming appointments, so there is not one assigned Doctor: ${visible.join('; ')}. Open My Appointments for the full list.`);
  }

  async function getMyRecentNotifications(userProfileId) {
    const page = await notificationService.listNotificationsForRecipient(
      userProfileId,
      'patient',
      { page: 1, limit: NOTIFICATION_LIMIT },
    );
    if (!page.items.length) {
      return result('get_my_recent_notifications', 'none', 'You do not currently have any notifications. Open Notifications to review your notification history.');
    }
    const summaries = page.items.map((item) => {
      const state = item.is_read ? 'Read' : 'Unread';
      return `${state}: ${sentenceText(item.title, 70)} — ${sentenceText(item.message)}`;
    });
    const unread = page.unread_count === 1 ? '1 unread notification' : `${page.unread_count} unread notifications`;
    return result(
      'get_my_recent_notifications',
      'found',
      `You have ${unread}. Your ${summaries.length === 1 ? 'most recent notification is' : `${summaries.length} most recent notifications are`}: ${summaries.join('; ')}. Open Notifications for the full history.`,
    );
  }

  async function getMyUnreadNotificationCount(userProfileId) {
    const count = await notificationService.countUnreadForRecipient(userProfileId, 'patient');
    const label = count === 1 ? 'notification' : 'notifications';
    return result(
      'get_my_unread_notification_count',
      count ? 'found' : 'none',
      `You have ${count} unread ${label}. Open Notifications to review them.`,
    );
  }

  return Object.freeze({
    getMyUpcomingAppointments,
    getMyAppointmentStatus,
    getMyAssignedDoctor,
    getMyRecentNotifications,
    getMyUnreadNotificationCount,
    execute(intent, { userProfileId, message }) {
      if (!userProfileId) throw new Error('Authenticated Patient context is required.');
      if (intent === ASSISTANT_INTENTS.NEXT_APPOINTMENT) return getMyUpcomingAppointments(userProfileId, { nextOnly: true });
      if (intent === ASSISTANT_INTENTS.UPCOMING_APPOINTMENTS) return getMyUpcomingAppointments(userProfileId);
      if (intent === ASSISTANT_INTENTS.APPOINTMENT_STATUS) return getMyAppointmentStatus(userProfileId, message);
      if (intent === ASSISTANT_INTENTS.ASSIGNED_DOCTOR) return getMyAssignedDoctor(userProfileId, message);
      if (intent === ASSISTANT_INTENTS.RECENT_NOTIFICATIONS) return getMyRecentNotifications(userProfileId);
      if (intent === ASSISTANT_INTENTS.UNREAD_NOTIFICATION_COUNT) return getMyUnreadNotificationCount(userProfileId);
      throw new Error('Unsupported Patient assistant tool intent.');
    },
  });
}
