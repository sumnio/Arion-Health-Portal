import { AUTH_COOKIE_NAME } from '../services/tokenService.js';
import { httpError } from '../utils/httpError.js';

export function createAuthenticate({ tokens, service }) {
  return async function authenticate(request, _response, next) {
    try {
      const token = request.cookies?.[AUTH_COOKIE_NAME];
      if (!token) throw httpError(401, 'UNAUTHENTICATED', 'Authentication is required.');

      let payload;
      try {
        payload = tokens.verify(token);
      } catch {
        throw httpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
      }
      request.authUser = await service.getAuthenticatedUser(payload.sub);
      next();
    } catch (error) {
      next(error);
    }
  };
}
