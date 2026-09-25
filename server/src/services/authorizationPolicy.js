export const APPROVED_ROLES = Object.freeze(['patient', 'doctor', 'staff', 'admin']);

export const PERMISSIONS = Object.freeze({
  PATIENT_SELF_ACCESS: 'patient:self:access',
  DOCTOR_PORTAL_ACCESS: 'doctor:portal:access',
  STAFF_OPERATIONS: 'staff:operations',
  ADMIN_ACCOUNT_MANAGEMENT: 'admin:accounts:manage',
  CLINICAL_RECORD_CREATE: 'clinical-record:create',
  CERTIFICATE_ISSUE: 'medical-certificate:issue',
  CONSULTATION_COMPLETE: 'consultation:complete',
});

const rolePermissions = Object.freeze({
  patient: new Set([PERMISSIONS.PATIENT_SELF_ACCESS]),
  doctor: new Set([
    PERMISSIONS.DOCTOR_PORTAL_ACCESS,
    PERMISSIONS.CLINICAL_RECORD_CREATE,
    PERMISSIONS.CERTIFICATE_ISSUE,
    PERMISSIONS.CONSULTATION_COMPLETE,
  ]),
  staff: new Set([PERMISSIONS.STAFF_OPERATIONS]),
  admin: new Set([PERMISSIONS.ADMIN_ACCOUNT_MANAGEMENT]),
});

export function isApprovedRole(role) {
  return APPROVED_ROLES.includes(role);
}

export function isApprovedPermission(permission) {
  return Object.values(PERMISSIONS).includes(permission);
}

export function roleHasPermission(role, permission) {
  return isApprovedRole(role) && rolePermissions[role].has(permission);
}
