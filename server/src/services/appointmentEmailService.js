function appointmentSchedule(value, timeZone) {
  const date = new Intl.DateTimeFormat('en-PH', {
    timeZone, month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date(value));
  const time = new Intl.DateTimeFormat('en-PH', {
    timeZone, hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(value));
  return { date, time };
}

export function createAppointmentEmailService({ repository, email, timeZone = 'Asia/Manila' }) {
  return Object.freeze({
    async appointmentRescheduled({ appointmentId, patientId, appointmentAt, doctorName = null }) {
      const recipient = await repository.findRescheduleEmailRecipient?.(patientId);
      if (!recipient?.has_portal_account || !recipient.email || !email?.sendAppointmentRescheduledEmail) return { status: 'skipped' };
      const schedule = appointmentSchedule(appointmentAt, timeZone);
      try {
        await email.sendAppointmentRescheduledEmail({
          to: recipient.email,
          appointmentId,
          appointmentDate: schedule.date,
          appointmentTime: schedule.time,
          doctorName,
        });
        return { status: 'sent' };
      } catch {
        return { status: 'failed' };
      }
    },
  });
}
