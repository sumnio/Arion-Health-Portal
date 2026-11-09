function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function registrationVerificationTemplate({ code, expiresMinutes = 10 }) {
  const safeCode = escapeHtml(code);
  return Object.freeze({
    type: 'registration_verification',
    subject: 'Verify your Arion Health Portal account',
    text: ['Arion Health Portal', '', `Your verification code is ${code}.`, `This code expires in ${expiresMinutes} minutes.`, 'If you did not register, you can ignore this email.'].join('\n'),
    html: `<p>Arion Health Portal</p><p>Your verification code is <strong>${safeCode}</strong>.</p><p>This code expires in ${expiresMinutes} minutes.</p><p>If you did not register, you can ignore this email.</p>`,
  });
}

export function passwordResetTemplate({ resetUrl, expiresMinutes = 30 }) {
  const safeUrl = escapeHtml(resetUrl);
  return Object.freeze({
    type: 'password_reset',
    subject: 'Reset your Arion Health Portal password',
    text: ['Arion Health Portal', '', `Reset your password: ${resetUrl}`, `This link expires in ${expiresMinutes} minutes and can be used only once.`, 'If you did not request a password reset, you can ignore this email.'].join('\n'),
    html: `<p>Arion Health Portal</p><p><a href="${safeUrl}">Reset Password</a></p><p>This link expires in ${expiresMinutes} minutes and can be used only once.</p><p>If you did not request a password reset, you can ignore this email.</p>`,
  });
}

export function portalInvitationTemplate({ claimUrl, expiresHours = 24 }) {
  const safeUrl = escapeHtml(claimUrl);
  return Object.freeze({
    type: 'portal_invitation',
    subject: 'Claim your Arion Health Portal account',
    text: ['Arion Health Portal', '', 'The clinic created a Patient record for you. Use the secure link below to create your own portal password.', claimUrl, `This link expires in ${expiresHours} hours and can be used only once.`, 'If you were not expecting this invitation, you can ignore this email.'].join('\n'),
    html: `<p>Arion Health Portal</p><p>The clinic created a Patient record for you. Use the secure link below to create your own portal password.</p><p><a href="${safeUrl}">Claim Portal Account</a></p><p>This link expires in ${expiresHours} hours and can be used only once.</p><p>If you were not expecting this invitation, you can ignore this email.</p>`,
  });
}

export function portalClaimCodeTemplate({ code, expiresMinutes = 10 }) {
  const safeCode = escapeHtml(code);
  return Object.freeze({
    type: 'portal_claim_verification',
    subject: 'Verify your Arion Health Portal invitation',
    text: ['Arion Health Portal', '', `Your verification code is ${code}.`, `This code expires in ${expiresMinutes} minutes.`, 'Do not share this code.'].join('\n'),
    html: `<p>Arion Health Portal</p><p>Your verification code is <strong>${safeCode}</strong>.</p><p>This code expires in ${expiresMinutes} minutes.</p><p>Do not share this code.</p>`,
  });
}

export function appointmentRescheduledTemplate({ appointmentUrl, appointmentDate, appointmentTime, doctorName = null }) {
  const safeUrl = escapeHtml(appointmentUrl);
  const safeDate = escapeHtml(appointmentDate);
  const safeTime = escapeHtml(appointmentTime);
  const safeDoctor = doctorName ? escapeHtml(doctorName) : null;
  const schedule = `${appointmentDate} at ${appointmentTime}${doctorName ? ` with ${doctorName}` : ''}`;
  return Object.freeze({
    type: 'appointment_rescheduled',
    subject: 'Your Arion appointment was rescheduled',
    text: [
      'Arion Health Portal', '',
      'Your appointment schedule has been updated. Sign in to Arion Health Portal to review the latest appointment details.',
      `Updated schedule: ${schedule}`,
      `View Updated Appointment: ${appointmentUrl}`,
    ].join('\n'),
    html: `<p>Arion Health Portal</p><p>Your appointment schedule has been updated. Sign in to Arion Health Portal to review the latest appointment details.</p><p><strong>Updated schedule:</strong> ${safeDate} at ${safeTime}${safeDoctor ? ` with ${safeDoctor}` : ''}</p><p><a href="${safeUrl}">View Updated Appointment</a></p>`,
  });
}

export function appointmentNeedsRescheduleTemplate({ appointmentUrl }) {
  const safeUrl = escapeHtml(appointmentUrl);
  return Object.freeze({
    type: 'appointment_needs_reschedule',
    subject: 'Your Arion appointment needs rescheduling',
    text: ['Arion Health Portal', '', 'Your Doctor is unavailable for your current appointment schedule. Sign in to Arion Health Portal to choose an available replacement schedule.', `View Appointment: ${appointmentUrl}`].join('\n'),
    html: `<p>Arion Health Portal</p><p>Your Doctor is unavailable for your current appointment schedule. Sign in to Arion Health Portal to choose an available replacement schedule.</p><p><a href="${safeUrl}">View Appointment</a></p>`,
  });
}
