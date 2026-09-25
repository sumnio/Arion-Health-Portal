import {
  isApprovedPermission,
  isApprovedRole,
  roleHasPermission,
} from '../services/authorizationPolicy.js';
import { httpError } from '../utils/httpError.js';

const FORBIDDEN_MESSAGE = 'You do not have permission to perform this action.';

export function requireActiveUser(request, _response, next) {
  if (!request.authUser || request.authUser.status !== 'active') {
    return next(httpError(403, 'ACCOUNT_INACTIVE', FORBIDDEN_MESSAGE));
  }
  return next();
}

export function requireRole(...allowedRoles) {
  if (allowedRoles.length === 0 || allowedRoles.some((role) => !isApprovedRole(role))) {
    throw new Error('requireRole must use one or more approved roles.');
  }

  return function authorizeRole(request, _response, next) {
    if (!request.authUser || !allowedRoles.includes(request.authUser.role)) {
      return next(httpError(403, 'FORBIDDEN', FORBIDDEN_MESSAGE));
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
      return next(httpError(403, 'FORBIDDEN', FORBIDDEN_MESSAGE));
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
        throw httpError(403, 'FORBIDDEN', FORBIDDEN_MESSAGE);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
