import { rejectUnknownFields } from '../validation/inputValidation.js';

export function createPortalInvitationController({ portalInvitationService }) {
  return {
    async inspect(request, response) { response.json(await portalInvitationService.inspect(request.params.token)); },
    async sendCode(request, response) { rejectUnknownFields(request.body ?? {}, new Set()); response.json(await portalInvitationService.sendCode(request.params.token)); },
    async verifyCode(request, response) { rejectUnknownFields(request.body ?? {}, new Set(['otp_session', 'code'])); response.json(await portalInvitationService.verifyCode({ token: request.params.token, otpSession: request.body?.otp_session, code: request.body?.code })); },
    async complete(request, response) { rejectUnknownFields(request.body ?? {}, new Set(['claim_session', 'password'])); response.status(201).json(await portalInvitationService.complete({ token: request.params.token, claimSession: request.body?.claim_session, password: request.body?.password })); },
  };
}
