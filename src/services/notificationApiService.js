import { apiErrorMessage } from './apiClient.js';
import { clinicTimeZone } from './dateTimeService.js';
import { notificationApiRepository } from '../repositories/notificationApiRepository.js';

export const NOTIFICATION_PAGE_SIZE = 5;
export const NOTIFICATION_PANEL_SIZE = 5;

export function formatUnreadBadge(count) {
  const safeCount = Number.isInteger(count) && count > 0 ? count : 0;
  return safeCount > 99 ? '99+' : String(safeCount);
}

export function formatNotificationTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Time unavailable';
  const calendarDate = date.toLocaleDateString('en-US', {
    timeZone: clinicTimeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const clockTime = date.toLocaleTimeString('en-US', {
    timeZone: clinicTimeZone,
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${calendarDate} · ${clockTime}`;
}

function normalizeNotification(item) {
  return {
    id: String(item.id),
    type: String(item.type ?? ''),
    title: String(item.title ?? 'Notification'),
    message: String(item.message ?? ''),
    relatedResource: item.related_resource
      ? { type: String(item.related_resource.type), id: String(item.related_resource.id) }
      : null,
    patientDisplayName: item.patient_display_name ? String(item.patient_display_name) : null,
    doctorDisplayName: item.doctor_display_name ? String(item.doctor_display_name) : null,
    appointmentAt: item.appointment_at ?? null,
    isRead: item.is_read === true,
    readAt: item.read_at ?? null,
    createdAt: item.created_at,
  };
}

function normalizeList(result) {
  const total = Number.isInteger(result.total) && result.total >= 0 ? result.total : 0;
  const limit = Number.isInteger(result.limit) && result.limit > 0 ? result.limit : NOTIFICATION_PAGE_SIZE;
  const page = Number.isInteger(result.page) && result.page > 0 ? result.page : 1;
  return {
    items: (result.items ?? []).map(normalizeNotification),
    page,
    limit,
    total,
    pageCount: Math.max(1, Math.ceil(total / limit)),
    unreadCount: Number.isInteger(result.unread_count) && result.unread_count > 0 ? result.unread_count : 0,
  };
}

export function notificationApiErrorMessage(error, fallback = 'Unable to load notifications. Please try again.') {
  return apiErrorMessage(error, {
    fallback,
    forbidden: 'You do not have access to notifications.',
    notFound: fallback,
  });
}

export function createNotificationApiService(repository = notificationApiRepository) {
  return Object.freeze({
    async list(options) { return normalizeList(await repository.list(options)); },
    async unreadCount() {
      const count = await repository.unreadCount();
      return Number.isInteger(count) && count > 0 ? count : 0;
    },
    async markRead(notificationId) { return normalizeNotification(await repository.markRead(notificationId)); },
    async markAllRead() { return repository.markAllRead(); },
  });
}

export const notificationApiService = createNotificationApiService();
