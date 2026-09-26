import {
  isApprovedPermission,
  isApprovedRole,
  roleHasPermission,
} from '../services/authorizationPolicy.js';
import { httpError } from '../utils/httpError.js';
import { requestSecurityEvent } from '../services/securityLogger.js';

const FORBIDDEN_MESSAGE = 'You do not have permission to perform this action.';

export function requireActiveUser(request, _response, next) {
  if (!request.authUser || request.authUser.status !== 'active') {
    const error = httpError(403, 'ACCOUNT_INACTIVE', FORBIDDEN_MESSAGE);
    requestSecurityEvent(request, { event: 'AUTH_INACTIVE_DENIED', severity: 'warning', outcome: 'denied' });
    error.securityLogged = true;
    return next(error);
  }
  return next();
}

export function requireRole(...allowedRoles) {
  if (allowedRoles.length === 0 || allowedRoles.some((role) => !isApprovedRole(role))) {
    throw new Error('requireRole must use one or more approved roles.');
  }

  return function authorizeRole(request, _response, next) {
    if (!request.authUser || !allowedRoles.includes(request.authUser.role)) {
      const error = httpError(403, 'FORBIDDEN', FORBIDDEN_MESSAGE);
      requestSecurityEvent(request, { event: 'AUTHZ_FORBIDDEN', severity: 'warning', outcome: 'denied' });
      error.securityLogged = true;
      return next(error);
    }
    return next();
  };
}

export function requirePermission(permission) {
  if (!isApprovedPermission(permission)) {
    throw new Error('requirePermission must use an approved permission.');
  }

  return function authorizePermission(request, _response, next) {
    if (!request.authUser || !roleHasPermission(request.authUser.role, permission)) {
      const error = httpError(403, 'FORBIDDEN', FORBIDDEN_MESSAGE);
      requestSecurityEvent(request, {
        event: 'AUTHZ_FORBIDDEN', severity: 'warning', outcome: 'denied',
        metadata: { permission },
      });
      error.securityLogged = true;
      return next(error);
    }
    return next();
  };
}

export function requireOwnership(resolveOwnerId) {
  if (typeof resolveOwnerId !== 'function') {
    throw new TypeError('requireOwnership requires an owner resolver function.');
  }

  return async function authorizeOwnership(request, _response, next) {
    try {
      const ownerId = await resolveOwnerId(request);
      if (
        ownerId == null ||
        request.authUser == null ||
        String(ownerId) !== String(request.authUser.user_profile_id)
      ) {
        const error = httpError(403, 'FORBIDDEN', FORBIDDEN_MESSAGE);
        requestSecurityEvent(request, {
          event: 'AUTHZ_OWNERSHIP_DENIED', severity: 'warning', outcome: 'denied',
          target_type: 'protected_resource',
          target_id: Object.values(request.params ?? {})[0],
        });
        error.securityLogged = true;
        throw error;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
