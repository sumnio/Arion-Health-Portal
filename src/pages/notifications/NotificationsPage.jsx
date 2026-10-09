import { useCallback, useEffect, useRef, useState } from 'react';
import NotificationListItem from '../../components/notifications/NotificationListItem.jsx';
import { useNotifications } from '../../notifications/NotificationContext.jsx';
import { NOTIFICATION_PAGE_SIZE, notificationApiErrorMessage, notificationApiService } from '../../services/notificationApiService.js';

const initialState = { loading: true, error: '', items: [], total: 0, pageCount: 1 };

export default function NotificationsPage() {
  const { unreadCount, setUnreadCount, refreshUnreadCount } = useNotifications();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [state, setState] = useState(initialState);
  const [submitting, setSubmitting] = useState(false);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setState(old => ({ ...old, loading: true, error: '' }));
    try {
      const result = await notificationApiService.list({ unreadOnly: filter === 'unread', page, limit: NOTIFICATION_PAGE_SIZE });
      if (requestRef.current !== requestId) return;
      if (result.total > 0 && page > result.pageCount) { setPage(result.pageCount); return; }
      setState({ loading: false, error: '', items: result.items, total: result.total, pageCount: result.pageCount });
      setUnreadCount(result.unreadCount);
    } catch (error) {
      if (requestRef.current !== requestId) return;
      setState(old => ({ ...old, loading: false, error: notificationApiErrorMessage(error) }));
    }
  }, [filter, page, setUnreadCount]);

  useEffect(() => { load(); }, [load]);

  function changeFilter(value) { setFilter(value); setPage(1); }

  async function markRead(notification) {
    if (submitting || notification.isRead) return;
    setSubmitting(true);
    try {
      await notificationApiService.markRead(notification.id);
      await Promise.all([load(), refreshUnreadCount()]);
    } catch (error) {
      setState(old => ({ ...old, error: notificationApiErrorMessage(error, 'Unable to mark the notification as read.') }));
    } finally { setSubmitting(false); }
  }

  async function markAllRead() {
    if (submitting || unreadCount === 0) return;
    setSubmitting(true);
    try {
      await notificationApiService.markAllRead();
      setUnreadCount(0);
      if (filter === 'unread') setPage(1);
      await load();
    } catch (error) {
      setState(old => ({ ...old, error: notificationApiErrorMessage(error, 'Unable to mark all notifications as read.') }));
    } finally { setSubmitting(false); }
  }

  return <div className="notifications-page">
    <header className="notifications-heading"><div><h1>Notifications</h1><p>Appointment and clinic workflow updates for your account.</p></div>{unreadCount > 0 && <button type="button" className="action-link" disabled={submitting} onClick={markAllRead}>{submitting ? 'Updating…' : 'Mark all as read'}</button>}</header>
    <nav className="notification-filters" aria-label="Notification filters"><button type="button" aria-pressed={filter === 'all'} onClick={() => changeFilter('all')}>All</button><button type="button" aria-pressed={filter === 'unread'} onClick={() => changeFilter('unread')}>Unread{unreadCount ? ` (${unreadCount})` : ''}</button></nav>
    <section className="notifications-card" aria-label={`${filter === 'unread' ? 'Unread' : 'All'} notifications`}>
      {state.loading ? <p role="status">Loading notifications…</p> : state.error ? <div className="notification-feedback"><p role="alert">{state.error}</p><button type="button" className="action-link" onClick={load}>Try again</button></div> : state.items.length ? <><p className="notification-total">{state.total} {filter === 'unread' ? 'unread ' : ''}{state.total === 1 ? 'notification' : 'notifications'} · Newest first</p><ul className="notification-list notification-page-list">{state.items.map(item => <NotificationListItem key={item.id} notification={item} onOpen={markRead} disabled={submitting} />)}</ul></> : <div className="notification-empty"><h2>{filter === 'unread' ? 'You have no unread notifications.' : 'No notifications yet.'}</h2><p>{filter === 'unread' ? 'You’re all caught up.' : 'Account notifications will appear here when clinic workflows create them.'}</p></div>}
    </section>
    {!state.loading && !state.error && state.pageCount > 1 && <nav className="notification-pagination" aria-label="Notification pages"><button type="button" className="action-link" disabled={page === 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button><span>Page {page} of {state.pageCount}</span><button type="button" className="action-link" disabled={page === state.pageCount} onClick={() => setPage(value => Math.min(state.pageCount, value + 1))}>Next</button></nav>}
  </div>;
}
