import { pipeline } from 'node:stream/promises';
import { requestSecurityEvent } from '../services/securityLogger.js';
import { httpError } from '../utils/httpError.js';

export function createDoctorSignatureController({ doctorSignatureService }) {
  return Object.freeze({
    async status(request, response) {
      response.json({ signature: await doctorSignatureService.getStatus(request.authUser.user_profile_id) });
    },
    async upload(request, response) {
      if (!request.file) throw httpError(400, 'DOCTOR_SIGNATURE_REQUIRED', 'Select one PNG signature image.');
      const signature = await doctorSignatureService.uploadOwn(request.authUser.user_profile_id, request.file);
      requestSecurityEvent(request, { event: 'DOCTOR_SIGNATURE_UPLOAD_SUCCESS', severity: 'info', outcome: 'success', target_type: 'doctor_signature' });
      response.json({ signature });
    },
    async view(request, response) {
      const result = await doctorSignatureService.ownSignature(request.authUser.user_profile_id);
      if (!result) throw httpError(404, 'DOCTOR_SIGNATURE_NOT_CONFIGURED', 'No certificate signature is configured.');
      response.set({
        'Content-Type': 'image/png',
        'Content-Length': String(result.metadata.file_size),
        'Content-Disposition': 'inline; filename="certificate-signature.png"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      await pipeline(result.stream, response);
    },
  });
}
