import { requestSecurityEvent } from '../services/securityLogger.js';
import { pipeline } from 'node:stream/promises';
import { validateEmptyBody } from '../validation/inputValidation.js';

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
        request.files,
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

export function createStaffPwdVerificationController({ pwdVerificationService }) {
  return Object.freeze({
    async list(request, response) {
      response.json({ pwd_verifications: await pwdVerificationService.listPending(request.query) });
    },
    async review(request, response) {
      response.json({ pwd_verification: await pwdVerificationService.pendingReview(request.params.verificationId) });
    },
    async document(request, response) {
      const result = await pwdVerificationService.pendingDocument(request.params.verificationId, request.params.side);
      const extension = result.metadata.mime_type === 'application/pdf' ? 'pdf' : result.metadata.mime_type === 'image/png' ? 'png' : 'jpg';
      response.set({
        'Content-Type': result.metadata.mime_type,
        'Content-Length': String(result.metadata.file_size),
        'Content-Disposition': `inline; filename="pwd-verification-document.${extension}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      await pipeline(result.stream, response);
    },
    async verify(request, response) {
      validateEmptyBody(request.body);
      const result = await pwdVerificationService.verify(request.params.verificationId, request.authUser.user_profile_id);
      requestSecurityEvent(request, { event: 'PWD_VERIFICATION_REVIEWED', severity: 'info', outcome: 'success', target_type: 'pwd_verification', target_id: request.params.verificationId, metadata: { action: 'verified' } });
      response.json({ pwd_verification: result });
    },
    async reject(request, response) {
      const result = await pwdVerificationService.reject(request.params.verificationId, request.authUser.user_profile_id, request.body);
      requestSecurityEvent(request, { event: 'PWD_VERIFICATION_REVIEWED', severity: 'info', outcome: 'success', target_type: 'pwd_verification', target_id: request.params.verificationId, metadata: { action: 'rejected' } });
      response.json({ pwd_verification: result });
    },
  });
}
