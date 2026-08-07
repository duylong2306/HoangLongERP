import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

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

// ─── Context Type (chỉ giữ TOAST — lõi Thông báo hệ thống đã bị xóa) ─────────

interface NotificationContextValue {
  toasts: Toast[];
  addToast: (toast: ToastInput) => void;
  removeToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NotificationProvider({
  children,
  toasts: externalToasts,
  addToast: externalAddToast,
  removeToast: externalRemoveToast,
}: {
  children: ReactNode;
  // Hệ thống toast THỰC TẾ được render ở App.tsx. Truyền vào đây để mọi
  // component dùng useNotification().addToast hiển thị được toast. Nếu không
  // truyền (ví dụ dùng Provider độc lập trong test) sẽ fallback state nội bộ.
  toasts?: Toast[];
  addToast?: (toast: ToastInput) => void;
  removeToast?: (id: string) => void;
}) {
  // ── Toasts: state nội bộ dự phòng khi KHÔNG có hệ thống toast bên ngoài ──
  const [internalToasts, setInternalToasts] = useState<Toast[]>([]);

  const internalAddToast = useCallback((toast: ToastInput) => {
    const id = `${Date.now()}_${Math.random()}`;
    const duration = toast.duration === undefined ? 5000 : toast.duration;
    setInternalToasts(prev => [...prev, { ...toast, id, duration, type: toast.type || 'info' }]);
    if (duration > 0) {
      setTimeout(() => {
        setInternalToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const internalRemoveToast = useCallback((id: string) => {
    setInternalToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Ưu tiên hệ thống toast từ App (được render thật ở App.tsx). Nhờ vậy mọi
  // useNotification().addToast trong toàn app đều hiển thị đúng.
  const toasts = externalToasts ?? internalToasts;
  const addToast = externalAddToast ?? internalAddToast;
  const removeToast = externalRemoveToast ?? internalRemoveToast;

  const value = useMemo<NotificationContextValue>(() => ({
    toasts, addToast, removeToast,
  }), [toasts, addToast, removeToast]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// ─── Consumer Hook ────────────────────────────────────────────────────────────

// Fallback an toàn khi component render ngoài NotificationProvider
// (tránh crash toàn bộ app do lỗi import/HMR)
const FALLBACK_TOAST: NotificationContextValue = {
  toasts: [] as Toast[],
  addToast: (_t: ToastInput) => { console.warn('[useNotification] Provider chưa sẵn sàng, toast bị bỏ qua'); },
  removeToast: () => {},
};

// Chỉ cảnh báo 1 lần mỗi phiên để tránh spam console khi HMR (Fast Refresh)
// tạm thời làm mismatch định danh context ở môi trường dev.
let notificationContextWarned = false;

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    if (!notificationContextWarned) {
      notificationContextWarned = true;
      console.warn(
        '[useNotification] Context null — component render ngoài NotificationProvider, ' +
        'trả về fallback an toàn (toast sẽ không hiển thị). Thường chỉ xảy ra tạm thời khi HMR dev; hãy F5 nếu persistent.'
      );
    }
    return FALLBACK_TOAST;
  }
  return ctx;
}
