export const SMS_MESSAGE_MAX_LENGTH = 160;

const typeLead = Object.freeze({
  booking_immediate: 'Your appointment is booked for',
  reminder_24h: 'Reminder: your appointment is on',
  reminder_1h: 'Reminder: your appointment is on',
  reschedule_immediate: 'Your appointment was moved to',
  cancellation_immediate: 'Your appointment on',
});

function compactName(value) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return normalized && normalized.length <= 45 ? normalized : 'your doctor';
}

export function createAppointmentSms({ reminderType, appointmentAt, doctorName, timeZone = 'Asia/Manila' }) {
  if (!typeLead[reminderType]) throw new Error('Unsupported SMS reminder type.');
  const date = new Intl.DateTimeFormat('en-PH', {
    timeZone, month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(appointmentAt));
  const time = new Intl.DateTimeFormat('en-PH', {
    timeZone, hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(appointmentAt));
  const doctor = compactName(doctorName);
  const ending = reminderType === 'cancellation_immediate'
    ? `${date} at ${time} with ${doctor} was cancelled.`
    : `${date} at ${time} with ${doctor}. Please arrive on time.`;
  let message = `Arion: ${typeLead[reminderType]} ${ending}`;
  if (message.length > SMS_MESSAGE_MAX_LENGTH) {
    message = reminderType === 'cancellation_immediate'
      ? `Arion: Your appointment on ${date} at ${time} was cancelled.`
      : `Arion: Appointment ${date} at ${time}. Please arrive on time.`;
  }
  if (message.length > SMS_MESSAGE_MAX_LENGTH) throw new Error('SMS template exceeds the length limit.');
  return message;
}
