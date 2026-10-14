import { httpError } from '../utils/httpError.js';

export function createSmsReminderController({ smsModule }) {
  return Object.freeze({
    async run(request, response, next) {
      try {
        if (request.body && Object.keys(request.body).length) {
          throw httpError(400, 'BODY_NOT_ALLOWED', 'This action does not accept a request body.');
        }
        response.json(await smsModule.smsReminderService.runDueReminders());
      } catch (error) {
        next(error);
      }
    },
  });
}
