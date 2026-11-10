import { clinicTimeZone } from './dateTimeService.js';

export const AUDIT_ROLES = ['patient', 'doctor', 'staff', 'admin', 'system', 'unknown'];
export const AUDIT_CATEGORIES = [
  'AUTH', 'MFA', 'ACCOUNT', 'APPOINTMENT', 'SCHEDULE', 'PWD',
  'MEDICAL_RECORD', 'PRESCRIPTION', 'CERTIFICATE',
  'PORTAL_INVITATION', 'PATIENT_ACCOUNT',
];
export const AUDIT_RESULTS = ['success', 'failed', 'denied'];
export const AUDIT_ACTIONS = [
  'AUTH_LOGIN_SUCCESS', 'AUTH_LOGIN_FAILURE', 'AUTH_LOGOUT',
  'MFA_VERIFY_SUCCESS', 'MFA_VERIFY_FAILURE', 'ACCOUNT_ACTIVATED',
  'ACCOUNT_DEACTIVATED', 'PWD_VERIFICATION_APPROVED', 'PWD_VERIFICATION_REJECTED',
  'APPOINTMENT_CANCELLED', 'APPOINTMENT_RESCHEDULED',
  'DOCTOR_UNAVAILABILITY_RESCHEDULE_CONFIRMED', 'WORKING_HOURS_CREATED',
  'WORKING_HOURS_UPDATED', 'WORKING_HOURS_DELETED',
  'PUBLISHED_AVAILABILITY_CREATED', 'PUBLISHED_AVAILABILITY_UPDATED',
  'PUBLISHED_AVAILABILITY_REMOVED', 'TIME_OFF_CREATED', 'TIME_OFF_REMOVED',
  'MEDICAL_RECORD_CREATED', 'PRESCRIPTION_ISSUED',
  'PRESCRIPTION_ATTACHMENT_ISSUED', 'MEDICAL_CERTIFICATE_ISSUED',
  'PORTAL_INVITATION_SENT', 'PORTAL_INVITATION_RESENT', 'PATIENT_ACCOUNT_CLAIMED',
];

const CATEGORY_LABELS = {
  AUTH: 'Auth', MFA: 'MFA', ACCOUNT: 'Account', APPOINTMENT: 'Appointment',
  SCHEDULE: 'Schedule', PWD: 'PWD', MEDICAL_RECORD: 'Medical Record',
  PRESCRIPTION: 'Prescription', CERTIFICATE: 'Certificate',
  PORTAL_INVITATION: 'Portal Invitation', PATIENT_ACCOUNT: 'Patient Account',
};
const ACTION_ACRONYMS = new Set(['MFA', 'PWD', 'AUTH']);
const ACTION_LABELS = {
  MEDICAL_RECORD_CREATED: 'Medical Record created',
  PORTAL_INVITATION_SENT: 'Portal invitation sent',
  PORTAL_INVITATION_RESENT: 'Portal invitation resent',
  PATIENT_ACCOUNT_CLAIMED: 'Patient account claimed',
};

export function auditActionLabel(action) {
  if (!action) return 'Unknown action';
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  return String(action).split('_').map((word, index) => {
    if (ACTION_ACRONYMS.has(word)) return word;
    const lower = word.toLowerCase();
    return index === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
  }).join(' ');
}

export function auditCategoryLabel(category) {
  return CATEGORY_LABELS[category] ?? 'Other';
}

export function formatAuditDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: clinicTimeZone,
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(date)
    .replace(' at ', ' • ')
    .replace(/, (?=\d{1,2}:\d{2} )/, ' • ');
}
