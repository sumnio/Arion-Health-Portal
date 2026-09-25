import { AUTH_COOKIE_NAME, authCookieOptions } from '../services/tokenService.js';

export function createAuthController({ service, nodeEnv }) {
  const cookieOptions = authCookieOptions(nodeEnv);

  return {
    async register(request, response) {
      const user = await service.registerPatient(request.validatedBody);
      response.status(201).json({ user });
    },
    async login(request, response) {
      const result = await service.login(request.validatedBody);
      response.cookie(AUTH_COOKIE_NAME, result.token, cookieOptions);
      response.json({ user: result.user });
    },
    logout(_request, response) {
      response.clearCookie(AUTH_COOKIE_NAME, {
        httpOnly: cookieOptions.httpOnly,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        path: cookieOptions.path,
      });
      response.json({ success: true });
    },
    me(request, response) {
      response.json({ user: request.authUser });
    },
  };
}
