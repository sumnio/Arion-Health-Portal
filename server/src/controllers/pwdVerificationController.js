import { requestSecurityEvent } from '../services/securityLogger.js';

export function createPwdVerificationController({ pwdVerificationService }) {
  return Object.freeze({
    async status(request, response) {
      response.json({
        pwd_verification: await pwdVerificationService.getOwnStatus(request.authUser.user_profile_id),
      });
    },
    async submit(request, response) {
      const result = await pwdVerificationService.submitOwn(
        request.authUser.user_profile_id,
        request.body,
        request.file,
      );
      requestSecurityEvent(request, {
        event: 'PWD_VERIFICATION_SUBMITTED',
        severity: 'info',
        outcome: 'success',
        target_type: 'patient',
        metadata: { status: 'pending' },
      });
      response.status(201).json({ pwd_verification: result });
    },
  });
}
