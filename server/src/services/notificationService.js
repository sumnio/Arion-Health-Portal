import { httpError } from '../utils/httpError.js';
import {
  validateNotificationCreate,
  validateNotificationId,
  validateNotificationListQuery,
} from '../validation/notificationValidation.js';

function id(value) { return String(value?._id ?? value?.id ?? value); }

function notificationView(item) {
  return {
    id: id(item),
    type: item.type,
    title: item.title,
    message: item.message,
    related_resource: item.related_resource_type && item.related_resource_id
      ? { type: item.related_resource_type, id: id(item.related_resource_id) }
      : null,
    is_read: item.is_read === true,
    read_at: item.read_at ? new Date(item.read_at).toISOString() : null,
    created_at: new Date(item.created_at).toISOString(),
  };
}

function recipient(userProfileId, role) {
  return { user_profile_id: userProfileId, role };
}

export function createNotificationService({ repository, now = () => new Date() }) {
  return Object.freeze({
    async createNotification(value) {
      const input = validateNotificationCreate(value);
      const profile = await repository.findRecipientProfile(input.recipient_user_profile_id);
      if (!profile || profile.role !== input.recipient_role || profile.status !== 'active') {
        throw httpError(400, 'INVALID_NOTIFICATION_RECIPIENT', 'Notification recipient is invalid.');
      }
      return notificationView(await repository.create({
        ...input,
        is_read: false,
        read_at: null,
        created_at: now(),
      }));
    },

    async listNotificationsForRecipient(userProfileId, role, query) {
      const paging = validateNotificationListQuery(query);
      const result = await repository.listForRecipient(recipient(userProfileId, role), paging);
      return {
        items: result.items.map(notificationView),
        page: paging.page,
        limit: paging.limit,
        total: result.total,
        unread_count: result.unread_count,
      };
    },

    async countUnreadForRecipient(userProfileId, role) {
      return repository.countUnreadForRecipient(recipient(userProfileId, role));
    },

    async markNotificationRead(userProfileId, role, notificationId) {
      const validId = validateNotificationId(notificationId);
      const item = await repository.markReadForRecipient(validId, recipient(userProfileId, role), now());
      if (!item) throw httpError(404, 'NOTIFICATION_NOT_FOUND', 'Notification was not found.');
      return notificationView(item);
    },

    async markAllNotificationsRead(userProfileId, role) {
      return repository.markAllReadForRecipient(recipient(userProfileId, role), now());
    },
  });
}
