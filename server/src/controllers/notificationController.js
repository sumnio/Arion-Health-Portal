import { validateEmptyBody } from '../validation/inputValidation.js';

export function createNotificationController({ notificationService }) {
  const recipient = request => [request.authUser.user_profile_id, request.authUser.role];
  return {
    async list(request, response) {
      response.json({ notifications: await notificationService.listNotificationsForRecipient(...recipient(request), request.query) });
    },
    async unreadCount(request, response) {
      response.json({ unread_count: await notificationService.countUnreadForRecipient(...recipient(request)) });
    },
    async markRead(request, response) {
      validateEmptyBody(request.body);
      response.json({ notification: await notificationService.markNotificationRead(...recipient(request), request.params.notificationId) });
    },
    async markAllRead(request, response) {
      validateEmptyBody(request.body);
      response.json({ updated_count: await notificationService.markAllNotificationsRead(...recipient(request)) });
    },
  };
}
