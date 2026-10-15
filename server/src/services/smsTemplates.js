export const SMS_MESSAGE_MAX_LENGTH = 160;

function compactName(value) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return normalized && normalized.length <= 45 ? normalized : 'your doctor';
}

function localDateKey(value, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
}

export function createAppointmentSms({
  reminderType,
  appointmentAt,
  doctorName,
  timeZone = 'Asia/Manila',
  referenceTime = new Date(),
}) {
  const date = new Intl.DateTimeFormat('en-PH', {
    timeZone, month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(appointmentAt));
  const time = new Intl.DateTimeFormat('en-PH', {
    timeZone, hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(appointmentAt));
  const doctor = compactName(doctorName);
  const today = localDateKey(appointmentAt, timeZone) === localDateKey(referenceTime, timeZone);
  const messages = {
    booking_immediate: `Arion: Your appointment is scheduled ${today ? 'today' : `on ${date}`} at ${time} with ${doctor}. Please arrive on time.`,
    reminder_24h: `Arion: Reminder: your appointment is on ${date} at ${time} with ${doctor}. Please arrive on time.`,
    reminder_1h: `Arion: Your appointment with ${doctor} is at ${time} today. Please prepare to arrive on time.`,
    reschedule_immediate: `Arion: Your appointment has been rescheduled to ${date} at ${time} with ${doctor}.`,
    cancellation_immediate: `Arion: Your appointment on ${date} at ${time} has been cancelled. Sign in to Arion if you need another appointment.`,
  };
  let message = messages[reminderType];
  if (!message) throw new Error('Unsupported SMS reminder type.');
  if (message.length > SMS_MESSAGE_MAX_LENGTH) {
    message = reminderType === 'cancellation_immediate'
      ? `Arion: Your appointment on ${date} at ${time} was cancelled. Sign in if you need another appointment.`
      : `Arion: Appointment ${date} at ${time} with ${doctor}.`;
  }
  if (message.length > SMS_MESSAGE_MAX_LENGTH) throw new Error('SMS template exceeds the length limit.');
  return message;
}
