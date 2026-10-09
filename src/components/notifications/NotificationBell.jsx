import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../notifications/NotificationContext.jsx';
import { formatUnreadBadge, NOTIFICATION_PANEL_SIZE, notificationApiErrorMessage, notificationApiService } from '../../services/notificationApiService.js';
import NotificationListItem from './NotificationListItem.jsx';

export default function NotificationBell({ role }) {
  const { unreadCount, countError, setUnreadCount, refreshUnreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ loading: false, error: '', items: [] });
  const [submitting, setSubmitting] = useState(false);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  const requestRef = useRef(0);

  const loadRecent = useCallback(async () => {
    const requestId = ++requestRef.current;
    setState(old => ({ ...old, loading: true, error: '' }));
    try {
      const result = await notificationApiService.list({ page: 1, limit: NOTIFICATION_PANEL_SIZE });
      if (requestRef.current !== requestId) return;
      setState({ loading: false, error: '', items: result.items });
      setUnreadCount(result.unreadCount);
    } catch (error) {
      if (requestRef.current !== requestId) return;
      setState(old => ({ ...old, loading: false, error: notificationApiErrorMessage(error) }));
    }
  }, [setUnreadCount]);

  useEffect(() => {
    if (!open) return undefined;
    loadRecent();
    const close = event => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      } else if (event.type === 'pointerdown' && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', close);
    queueMicrotask(() => panelRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', close);
    };
  }, [open, loadRecent]);

  async function markRead(notification) {
    if (submitting || notification.isRead) return;
    setSubmitting(true);
    try {
      const updated = await notificationApiService.markRead(notification.id);
      setState(old => ({ ...old, error: '', items: old.items.map(item => item.id === updated.id ? updated : item) }));
      await refreshUnreadCount();
    } catch (error) {
      setState(old => ({ ...old, error: notificationApiErrorMessage(error, 'Unable to mark the notification as read.') }));
    } finally { setSubmitting(false); }
  }

  async function markAllRead() {
    if (submitting || unreadCount === 0) return;
    setSubmitting(true);
    try {
      await notificationApiService.markAllRead();
      setState(old => ({ ...old, error: '', items: old.items.map(item => ({ ...item, isRead: true })) }));
      setUnreadCount(0);
    } catch (error) {
      setState(old => ({ ...old, error: notificationApiErrorMessage(error, 'Unable to mark all notifications as read.') }));
    } finally { setSubmitting(false); }
  }

  const badge = formatUnreadBadge(unreadCount);
  return <div className="notification-menu" ref={rootRef}>
    <button ref={buttonRef} className="notification-bell" type="button" aria-label={unreadCount ? `Notifications, ${badge} unread` : 'Notifications'} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(value => !value)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
      {unreadCount > 0 && <span className="notification-count" aria-hidden="true">{badge}</span>}
    </button>
    {open && <section className="notification-panel" role="dialog" aria-modal="false" aria-labelledby="notification-panel-title" tabIndex="-1" ref={panelRef}>
      <header><h2 id="notification-panel-title">Notifications</h2>{unreadCount > 0 && <button type="button" disabled={submitting} onClick={markAllRead}>{submitting ? 'Updating…' : 'Mark all as read'}</button>}</header>
      {countError && !state.error && <p className="notification-error" role="alert">{countError}</p>}
      {state.loading ? <p role="status">Loading notifications…</p> : state.error ? <div className="notification-feedback"><p role="alert">{state.error}</p><button type="button" onClick={loadRecent}>Try again</button></div> : state.items.length ? <ul className="notification-list">{state.items.map(item => <NotificationListItem key={item.id} notification={item} onOpen={markRead} disabled={submitting} />)}</ul> : <p className="notification-empty">No notifications yet.</p>}
      <Link className="notification-view-all" to={`/${role}/notifications`} onClick={() => setOpen(false)}>View All Notifications</Link>
    </section>}
  </div>;
}
