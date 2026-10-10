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
