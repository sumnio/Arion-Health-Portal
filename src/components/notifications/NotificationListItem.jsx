import { formatNotificationTime } from '../../services/notificationApiService.js';

const EVENT_LABELS = Object.freeze({
  appointment_created: 'Booked',
  patient_booking_created: 'Booked',
  assigned_appointment_created: 'Assigned',
  appointment_confirmed: 'Confirmed',
  appointment_rescheduled: 'Rescheduled',
  appointment_cancelled: 'Cancelled',
  patient_arrived: 'Arrived',
  appointment_marked_urgent: 'Marked urgent',
  appointment_completed: 'Completed',
  appointment_reminder: 'Sent',
});

function heading(notification) {
  return <span className="notification-item-heading">
    <strong>{notification.title}</strong>
    {!notification.isRead && <span className="notification-unread-dot" aria-label="Unread" />}
  </span>;
}

export default function NotificationListItem({ notification, onOpen, disabled = false, detailed = false }) {
  const content = <>
    {heading(notification)}
    <span className="notification-message">{notification.message}</span>
    <time dateTime={notification.createdAt}>{formatNotificationTime(notification.createdAt)} · Philippine time</time>
  </>;

  if (detailed) {
    return <li className={'notification-item notification-item-detailed' + (notification.isRead ? '' : ' notification-item-unread')}>
      <article>
        {heading(notification)}
        <p className="notification-message">{notification.message}</p>
        <dl className="notification-detail-grid">
          {notification.appointmentAt && <div><dt>Appointment</dt><dd><time dateTime={notification.appointmentAt}>{formatNotificationTime(notification.appointmentAt)} · Philippine time</time></dd></div>}
          <div><dt>{EVENT_LABELS[notification.type] ?? 'Notification created'}</dt><dd><time dateTime={notification.createdAt}>{formatNotificationTime(notification.createdAt)} · Philippine time</time></dd></div>
        </dl>
        {!notification.isRead && <button type="button" className="notification-mark-read" disabled={disabled} onClick={() => onOpen(notification)}>Mark as read</button>}
      </article>
    </li>;
  }

  return <li className={'notification-item' + (notification.isRead ? '' : ' notification-item-unread')}>
    {notification.isRead
      ? <article>{content}</article>
      : <button type="button" disabled={disabled} onClick={() => onOpen(notification)} aria-label={`Mark ${notification.title} as read`}>{content}</button>}
  </li>;
}
