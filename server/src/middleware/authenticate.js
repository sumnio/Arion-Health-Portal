import { AUTH_COOKIE_NAME } from '../services/tokenService.js';
import { httpError } from '../utils/httpError.js';

export function createRequireAuth({ tokens, service }) {
  return async function requireAuth(request, _response, next) {
    try {
      const token = request.cookies?.[AUTH_COOKIE_NAME];
      if (!token) throw httpError(401, 'UNAUTHENTICATED', 'Authentication is required.');

      let payload;
      try {
        payload = tokens.verify(token);
      } catch {
        throw httpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
      }
      const profile = await service.getAuthenticatedUser(payload.sub);
      request.authUser = {
        user_profile_id: profile.user_profile_id,
        display_name: profile.display_name,
        role: profile.role,
        status: profile.status,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const createAuthenticate = createRequireAuth;
