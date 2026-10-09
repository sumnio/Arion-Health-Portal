import { apiClient } from '../services/apiClient.js';

export function createNotificationApiRepository(client = apiClient) {
  return Object.freeze({
    async list({ unreadOnly = false, page = 1, limit = 20 } = {}) {
      const query = new URLSearchParams({
        unread_only: String(unreadOnly),
        page: String(page),
        limit: String(limit),
      });
      return (await client.request(`/api/notifications?${query}`)).notifications;
    },
    async unreadCount() {
      return (await client.request('/api/notifications/unread-count')).unread_count;
    },
    async markRead(notificationId) {
      return (await client.request(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
        method: 'PATCH',
      })).notification;
    },
    async markAllRead() {
      return (await client.request('/api/notifications/read-all', { method: 'PATCH' })).updated_count;
    },
  });
}

export const notificationApiRepository = createNotificationApiRepository();
