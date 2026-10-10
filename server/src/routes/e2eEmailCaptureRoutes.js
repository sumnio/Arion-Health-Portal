import { Router } from 'express';

export function createE2eEmailCaptureRouter({ provider, captureKey }) {
  const router = Router();
  router.get('/latest', (request, response) => {
    if (request.get('x-e2e-capture-key') !== captureKey) {
      return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found.' } });
    }
    const recipient = typeof request.query.recipient === 'string' ? request.query.recipient : '';
    if (!recipient || recipient.length > 320) {
      return response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'A test recipient is required.' } });
    }
    const type = request.query.type === 'password_reset'
      ? 'password_reset'
      : 'registration_verification';
    const delivery = [...provider.deliveries].reverse().find(
      item => item.to === recipient && item.type === type,
    );
    if (type === 'password_reset') {
      const resetUrl = delivery?.text?.match(/https?:\/\/[^\s]+\/reset-password\?token=[A-Za-z0-9_-]+/)?.[0];
      if (!resetUrl) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'No test delivery was captured.' } });
      response.set('Cache-Control', 'no-store');
      return response.json({ reset_url: resetUrl });
    }
    const code = delivery?.text?.match(/\b\d{6}\b/)?.[0];
    if (!code) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'No test delivery was captured.' } });
    response.set('Cache-Control', 'no-store');
    return response.json({ code });
  });
  return router;
}
