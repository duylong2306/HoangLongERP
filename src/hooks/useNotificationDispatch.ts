import { useCallback } from 'react';
import { Employee, AppNotification } from '../types';
import { dispatchNotification, NotificationEvent } from '../lib/notificationRouter';

/**
 * Hook that provides dispatch functions for routing notifications
 * to the correct stakeholders based on event context.
 * Accepts addNotification directly (from App.tsx's own state) to avoid
 * requiring NotificationProvider context at call site.
 */
export function useNotificationDispatch(
  addNotification: (notif: Partial<AppNotification>) => void,
  employees: Employee[],
  currentUser: Employee | null
) {
  const dispatch = useCallback((event: Omit<NotificationEvent, 'timestamp'>) => {
    const fullEvent: NotificationEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };
    dispatchNotification(fullEvent, addNotification, employees, currentUser);
  }, [addNotification, employees, currentUser]);

  return { dispatch };
}
