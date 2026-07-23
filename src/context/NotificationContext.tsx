import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Employee, AppNotification } from '../types';
import { dbService } from '../lib/dbService';

// ─── Toast Types ──────────────────────────────────────────────────────────────

export interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  duration: number;
}

interface ToastInput {
  title: string;
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  duration?: number;
}

export type NotificationFilter = 'all' | 'unread' | 'tasks' | 'finance' | 'employees_attendance' | 'chat';

// ─── Context Type ─────────────────────────────────────────────────────────────

interface NotificationContextValue {
  // Toasts
  toasts: Toast[];
  addToast: (toast: ToastInput) => void;
  removeToast: (id: string) => void;

  // Notifications
  notifications: AppNotification[];
  addNotification: (notif: Partial<AppNotification>) => void;
  markNotificationRead: (id: string) => void;
  deleteNotification: (id: string) => void;
  unreadCount: number;

  // Panel state
  showNotificationsPanel: boolean;
  setShowNotificationsPanel: (show: boolean) => void;
  selectedNotification: AppNotification | null;
  setSelectedNotification: (n: AppNotification | null) => void;
  notificationFilter: NotificationFilter;
  setNotificationFilter: (f: NotificationFilter) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ─── Default Seed Notifications ──────────────────────────────────────────────

const SEED_NOTIFICATIONS: AppNotification[] = [
  { id: 'MSG-2026-A01', recipientId: 'emp_1', recipientName: 'Trương Hữu Long', department: 'Ban Giám Đốc', content: 'Kính trình Giám Đốc duyệt phiếu đề xuất chi phí tạm ứng mộc thô cho hạng mục biệt thự Lâm Đồng.', subTaskCode: 'CV-001', createdAt: '2026-06-08T08:00:00Z', read: false },
  { id: 'MSG-2026-A02', recipientId: 'emp_1', recipientName: 'Trương Hữu Long', department: 'Ban Giám Đốc', content: 'Hồ sơ quyết toán hạng mục chỉ thạch cao & phào mộc sấy cách nhiệt đã hoàn thành, kính mời Giám đốc kiểm duyệt.', subTaskCode: 'CV-003', createdAt: '2026-06-08T08:30:00Z', read: false },
  { id: 'MSG-2026-B01', recipientId: 'emp_2', recipientName: 'Lê Thị Mai', department: 'Phòng Kế Toán', content: 'Có yêu cầu duyệt quyết toán chi phí mua sắm nẹp chỉ nhựa PVC dán cạnh xưởng thô.', subTaskCode: 'CV-002', createdAt: '2026-06-08T09:12:00Z', read: false },
  { id: 'MSG-2026-C01', recipientId: 'emp_3', recipientName: 'Nguyễn Văn Hải', department: 'Phòng Dự Án - Xây Dựng', content: 'Báo cáo mác bê tông đổ dầm sàn tầng 2 đã đạt chỉ tiêu chất lượng thô.', subTaskCode: 'CV-001', createdAt: '2026-06-08T09:45:00Z', read: false },
  { id: 'MSG-2026-D01', recipientId: 'emp_4', recipientName: 'Trần Minh Quân', department: 'Phòng Dự Án - Nội Thất', content: 'Yêu cầu kiểm tra gấp định mức kỹ thuật ván MDF cánh sơn phủ bóng Acrylic phòng Master.', subTaskCode: 'CV-002', createdAt: '2026-06-08T10:05:00Z', read: false },
  { id: 'MSG-2026-E01', recipientId: 'emp_7', recipientName: 'Bùi Văn Tiến', department: 'Tổ Sản Xuất', content: 'Đã hoàn thành lắp ráp bộ khung tủ bếp thô An Cường. Đề nghị bộ phận dán cạnh bàn giao chỉ dính cạnh gỗ PVC.', subTaskCode: 'CV-002', createdAt: '2026-06-08T10:15:00Z', read: false },
];

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NotificationProvider({
  children,
  employees,
  currentUser,
}: {
  children: ReactNode;
  employees: Employee[];
  currentUser: Employee | null;
}) {
  // ── Toasts ──
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: ToastInput) => {
    const id = `${Date.now()}_${Math.random()}`;
    const duration = toast.duration === undefined ? 5000 : toast.duration;
    setToasts(prev => [...prev, { ...toast, id, duration, type: toast.type || 'info' }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Notifications ──
  const [notifications, setNotifications] = useState<AppNotification[]>(SEED_NOTIFICATIONS);

  // Load from Supabase
  useEffect(() => {
    let mounted = true;
    dbService.notifications.list()
      .then(list => {
        if (mounted && Array.isArray(list) && list.length > 0) {
          const sorted = [...list].sort((a, b) =>
            (b.createdAt || '').localeCompare(a.createdAt || ''));
          setNotifications(sorted as AppNotification[]);
        }
      })
      .catch(err => console.warn('Lỗi khi tải thông báo từ Supabase:', err));
    return () => { mounted = false; };
  }, []);

  const addNotification = useCallback((notif: Partial<AppNotification>) => {
    const randomNum = Math.floor(100 + Math.random() * 900);
    const id = notif.id || `MSG-${Date.now()}-${randomNum}`;
    const recipientId = notif.recipientId || 'emp_1';
    const recipient = employees.find(e => e.id === recipientId) || currentUser;

    if (!recipient) return;

    const newNotif: AppNotification = {
      id,
      recipientId: recipient.id,
      recipientName: recipient.name,
      department: recipient.department || 'Phòng Ban',
      content: notif.content || 'Thông báo mới từ hệ thống.',
      subTaskCode: notif.subTaskCode || 'CV-GEN',
      createdAt: notif.createdAt || new Date().toISOString(),
      read: false,
      senderId: notif.senderId || 'system',
      senderName: notif.senderName || 'Hệ Thống',
      senderAvatar: notif.senderAvatar || 'HT',
      category: notif.category || 'tasks',
      title: notif.title || 'Thông báo hệ thống',
      detailedContent: notif.detailedContent || notif.content || 'Nội dung chi tiết thông báo hệ thống.',
      conversationId: notif.conversationId,
      taskId: notif.taskId
    };

    setNotifications(prev => [newNotif, ...prev]);
    addToast({ title: `🔔 ${newNotif.title}`, message: newNotif.content, type: 'info' });
    // Persist to Supabase (non-blocking)
    dbService.notifications.save(newNotif).catch(err =>
      console.warn('Lỗi khi lưu thông báo lên Supabase:', err));

    // 🔔 Gửi Web Push notification đến thiết bị người nhận (non-blocking)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseAnonKey && recipient.id) {
        fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            userIds: [recipient.id],
            title: newNotif.title || 'Thông báo mới',
            body: newNotif.content || '',
            data: {
              url: '/',
              type: newNotif.category,
              sourceId: newNotif.subTaskCode,
              tag: `system-${newNotif.category}`,
            },
          }),
        }).catch(err => console.warn('Web Push error:', err));
      }
    } catch (err) {
      console.warn('Web Push error (ignored):', err);
    }
  }, [employees, currentUser, addToast]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    dbService.notifications.markRead(id).catch(err =>
      console.warn('Lỗi khi đánh dấu đã đọc thông báo:', err));
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    dbService.notifications.delete(id).catch(err =>
      console.warn('Lỗi khi xóa thông báo:', err));
  }, []);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  // ── Panel state ──
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>('all');

  // ── LƯU Ý: KHÔNG lắng nghe 'hl-dispatch-notification' ở đây nữa ──
  // App.tsx đã tự quản lý danh sách thông báo hiển thị và lắng nghe sự kiện này.
  // Nếu Provider cũng lắng nghe sẽ gây thông báo/toast bị nhân đôi.

  // ── LƯU Ý: Nhắc điểm danh đã được App.tsx xử lý ──
  // Không lặp lại ở Provider để tránh thông báo điểm danh bị nhân đôi.

  const value = useMemo<NotificationContextValue>(() => ({
    toasts, addToast, removeToast,
    notifications, addNotification, markNotificationRead, deleteNotification, unreadCount,
    showNotificationsPanel, setShowNotificationsPanel,
    selectedNotification, setSelectedNotification,
    notificationFilter, setNotificationFilter,
  }), [
    toasts, addToast, removeToast,
    notifications, addNotification, markNotificationRead, deleteNotification, unreadCount,
    showNotificationsPanel, selectedNotification, notificationFilter,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// ─── Consumer Hook ────────────────────────────────────────────────────────────

// Fallback an toàn khi component render ngoài NotificationProvider
// (tránh crash toàn bộ app do lỗi import/HMR)
const FALLBACK_TOAST = {
  toasts: [] as Toast[],
  addToast: (_t: ToastInput) => { console.warn('[useNotification] Provider chưa sẵn sàng, toast bị bỏ qua'); },
  removeToast: () => {},
  notifications: [] as AppNotification[],
  addNotification: () => {},
  markNotificationRead: () => {},
  deleteNotification: () => {},
  unreadCount: 0,
  showNotificationsPanel: false,
  setShowNotificationsPanel: () => {},
  selectedNotification: null,
  setSelectedNotification: () => {},
  notificationFilter: 'all' as NotificationFilter,
  setNotificationFilter: () => {},
};

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    console.warn('[useNotification] Context null — trả về fallback an toàn');
    return FALLBACK_TOAST as NotificationContextValue;
  }
  return ctx;
}
