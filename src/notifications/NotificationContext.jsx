import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { notificationApiErrorMessage, notificationApiService } from '../services/notificationApiService.js';

const NotificationContext = createContext(null);

export function NotificationProvider({ children, accountKey }) {
  const [unreadCount, setUnreadCountState] = useState(0);
  const [countError, setCountError] = useState('');
  const countRequestRef = useRef(0);

  const refreshUnreadCount = useCallback(async () => {
    const requestId = ++countRequestRef.current;
    try {
      const count = await notificationApiService.unreadCount();
      if (countRequestRef.current !== requestId) return null;
      setUnreadCountState(count);
      setCountError('');
      return count;
    } catch (error) {
      if (countRequestRef.current !== requestId) return null;
      setCountError(notificationApiErrorMessage(error, 'Unable to refresh the unread notification count.'));
      return null;
    }
  }, []);

  const setUnreadCount = useCallback((count) => {
    countRequestRef.current += 1;
    setUnreadCountState(Number.isInteger(count) && count > 0 ? count : 0);
  }, []);

  useEffect(() => {
    countRequestRef.current += 1;
    setUnreadCountState(0);
    setCountError('');
    refreshUnreadCount();
  }, [accountKey, refreshUnreadCount]);

  const value = useMemo(() => ({ unreadCount, countError, setUnreadCount, refreshUnreadCount }), [unreadCount, countError, refreshUnreadCount]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('useNotifications must be used inside NotificationProvider.');
  return value;
}
