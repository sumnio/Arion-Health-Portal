import { timingSafeEqual } from 'node:crypto';

function equalSecret(received, expected) {
  const left = Buffer.from(received ?? '');
  const right = Buffer.from(expected ?? '');
  if (!left.length || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function createCronReminderAuth(secret = '') {
  return function cronReminderAuth(request, response, next) {
    const match = request.get('authorization')?.match(/^Bearer ([^\s]+)$/);
    if (!secret || !match || !equalSecret(match[1], secret)) {
      return response.status(401).json({
        error: { code: 'CRON_UNAUTHORIZED', message: 'Scheduler authentication is required.' },
      });
    }
    return next();
  };
}
