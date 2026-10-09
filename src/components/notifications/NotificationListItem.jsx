import { formatNotificationTime } from '../../services/notificationApiService.js';

export default function NotificationListItem({ notification, onOpen, disabled = false }) {
  const content = <>
    <span className="notification-item-heading">
      <strong>{notification.title}</strong>
      {!notification.isRead && <span className="notification-unread-dot" aria-label="Unread" />}
    </span>
    <span className="notification-message">{notification.message}</span>
    <time dateTime={notification.createdAt}>{formatNotificationTime(notification.createdAt)} · Philippine time</time>
  </>;
  return <li className={'notification-item' + (notification.isRead ? '' : ' notification-item-unread')}>
    {notification.isRead
      ? <article>{content}</article>
      : <button type="button" disabled={disabled} onClick={() => onOpen(notification)} aria-label={`Mark ${notification.title} as read`}>{content}</button>}
  </li>;
}
