import { useState, useEffect } from 'react';
import { AppNotification, Employee } from '../types';
import { dbService } from '../lib/dbService';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Check,
  Trash,
  X
} from 'lucide-react';

interface NotificationListProps {
  notifications: AppNotification[];
  currentUser: Employee;
  employees: Employee[];
  onUpdateNotifications: (updated: AppNotification[]) => void;
  onNavigateTab?: (tab: string) => void;
  onClose?: () => void;
}

type NotificationGroupKey = 'approval' | 'tasks' | 'finance' | 'hr' | 'attendance' | 'projects' | 'other';

interface NotificationGroup {
  key: NotificationGroupKey;
  label: string;
  icon: string;
  color: string;
  filter: (n: AppNotification) => boolean;
}

const GROUPS: NotificationGroup[] = [
  {
    key: 'approval',
    label: 'Cần duyệt',
    icon: '⏳',
    color: '#F39C12',
    filter: (n) => n.category === 'approval'
  },
  {
    key: 'tasks',
    label: 'Công việc',
    icon: '📌',
    color: '#2AABEE',
    filter: (n) => n.category === 'tasks'
  },
  {
    key: 'finance',
    label: 'Tài chính',
    icon: '💰',
    color: '#27AE60',
    filter: (n) => n.category === 'finance'
  },
  {
    key: 'hr',
    label: 'Nhân sự',
    icon: '📋',
    color: '#8E44AD',
    filter: (n) => n.category === 'hr'
  },
  {
    key: 'attendance',
    label: 'Chấm công',
    icon: '⏰',
    color: '#E74C3C',
    filter: (n) => n.category === 'attendance'
  },
  {
    key: 'projects',
    label: 'Dự án',
    icon: '🏗️',
    color: '#16A085',
    filter: (n) => n.category === 'projects'
  },
  {
    key: 'other',
    label: 'Khác',
    icon: '🔔',
    color: '#5F6D7E',
    filter: (n) => !['approval', 'tasks', 'finance', 'hr', 'attendance', 'projects'].includes(n.category || '')
  }
];

const formatTime = (iso: string) => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (isToday) return `${hh}:${mm}`;
    if (isYesterday) return `Hôm qua ${hh}:${mm}`;
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')} ${hh}:${mm}`;
  } catch { return ''; }
};

export default function NotificationList({
  notifications,
  currentUser,
  onUpdateNotifications,
  onNavigateTab,
  onClose
}: NotificationListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(GROUPS.map(g => g.key)));

  // ─── Multi-select mode ──────────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedNotifIds, setSelectedNotifIds] = useState<Set<string>>(new Set());

  // Đóng băng thông báo khi click ra ngoài
  useEffect(() => {
    if (!onClose) return;
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const inNotif = target.closest('#notification_list_root');
      const inMessenger = target.closest('#messenger_container');
      const inBell = target.closest('#notification_bell_btn');
      const inPopover = target.closest('#notification_popover');
      if (inNotif || inMessenger || inBell || inPopover) return;
      onClose();
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [onClose]);

  // Lọc notification thuộc về user hiện tại
  const myNotifications = notifications.filter(
    n => n.recipientId === currentUser.id && n.category !== 'chat'
  );

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const markAsRead = (notifId: string) => {
    onUpdateNotifications(notifications.map(n =>
      n.id === notifId ? { ...n, read: true } : n
    ));
    // Lưu lên Supabase (non-blocking)
    dbService.notifications.markRead(notifId).catch(() => {});
  };

  const markAllRead = (group: NotificationGroup) => {
    const toMark = notifications.filter(n => group.filter(n) && !n.read);
    onUpdateNotifications(notifications.map(n =>
      group.filter(n) && !n.read ? { ...n, read: true } : n
    ));
    // Lưu lên Supabase (non-blocking)
    toMark.forEach(n => dbService.notifications.markRead(n.id).catch(() => {}));
  };

  // ─── Multi-select handlers ───────────────────────────────────────────────
  const toggleNotifSelect = (notifId: string) => {
    setSelectedNotifIds(prev => {
      const next = new Set(prev);
      if (next.has(notifId)) next.delete(notifId);
      else next.add(notifId);
      return next;
    });
  };

  const toggleSelectAllNotifs = () => {
    if (selectedNotifIds.size === myNotifications.length) {
      setSelectedNotifIds(new Set());
    } else {
      setSelectedNotifIds(new Set(myNotifications.map(n => n.id)));
    }
  };

  const handleBulkDeleteNotifications = async () => {
    const count = selectedNotifIds.size;
    if (count === 0) return;
    if (!confirm(`Xóa ${count} thông báo đã chọn?\nThao tác này không thể hoàn tác.`)) return;

    const idsToDelete = Array.from(selectedNotifIds);
    // Cập nhật state ngay lập tức
    onUpdateNotifications(notifications.filter(n => !selectedNotifIds.has(n.id)));
    // Xóa trên Supabase (non-blocking)
    for (const id of idsToDelete) {
      dbService.notifications.delete(id).catch(() => {});
    }
    setSelectedNotifIds(new Set());
    setSelectMode(false);
  };

  // Khi user click ra ngoài cửa sổ thông báo → đóng cửa sổ
  useEffect(() => {
    if (!onClose) return;
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Bỏ qua nếu click nằm trong chính cửa sổ thông báo này hoặc trong Messenger
      const inNotif = target.closest('#notification_list_root');
      const inMessenger = target.closest('#messenger_container');
      const inBell = target.closest('#notification_bell_btn');
      const inPopover = target.closest('#notification_popover');
      if (inNotif || inMessenger || inBell || inPopover) return;
      onClose();
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [onClose]);

  // Sắp xếp ưu tiên: chưa đọc trước, sau đó mới nhất (createdAt)
  const sortByUnreadThenNewest = (a: AppNotification, b: AppNotification) => {
    const aUnread = a.read ? 0 : 1;
    const bUnread = b.read ? 0 : 1;
    if (aUnread > 0 && bUnread === 0) return -1;
    if (aUnread === 0 && bUnread > 0) return 1;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  };

  const handleNavigate = (notif: AppNotification) => {
    if (!onNavigateTab) return;
    const cat = notif.category;
    if (cat === 'tasks' || cat === 'approval') onNavigateTab('tasks');
    else if (cat === 'projects') onNavigateTab('projects-construction');
    else if (cat === 'finance') onNavigateTab('finance');
    else if (cat === 'hr') onNavigateTab('employees');
    else if (cat === 'attendance') onNavigateTab('dashboard');
    else onNavigateTab('dashboard');
  };

  const totalUnread = myNotifications.filter(n => !n.read).length;

  return (
    <div className="flex flex-col h-full bg-slate-950" id="notification_list_root">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-400" />
            Thông báo
          </h1>
          <div className="flex items-center gap-2">
            {totalUnread > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {totalUnread} chưa đọc
              </span>
            )}
            <button
              onClick={() => { setSelectMode(v => !v); setSelectedNotifIds(new Set()); }}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                selectMode
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {selectMode ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
              {selectMode ? 'Hủy' : 'Chọn'}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-400">
          Nhắc nhở điểm danh, công việc, phê duyệt & cập nhật hệ thống
        </p>
      </div>

      {/* Notification groups */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
       

        {GROUPS.map(group => {
          const groupNotifs = myNotifications.filter(group.filter).sort(sortByUnreadThenNewest);
          const unreadCount = groupNotifs.filter(n => !n.read).length;
          const isExpanded = expandedGroups.has(group.key);

          if (groupNotifs.length === 0) return null;

          return (
            <div key={group.key} className="">
              {/* Group header */}
              <div
                onClick={() => toggleGroup(group.key)}
                className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-slate-900 transition-colors sticky top-0 bg-slate-950 z-10"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{group.icon}</span>
                  <span className="text-[13px] font-semibold text-white">{group.label}</span>
                  {unreadCount > 0 && (
                    <span
                      className="text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: group.color }}
                    >
                      {unreadCount}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500">({groupNotifs.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markAllRead(group); }}
                      className="text-[10px] text-indigo-400 hover:text-white font-semibold px-2 py-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Đọc hết
                    </button>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Notification items */}
              {isExpanded && (
                <div className="space-y-0.5 pb-1">
                  {groupNotifs.map(notif => {
                    const isUnread = !notif.read;

                    // Click vào thông báo: đánh dấu đã đọc + chuyển ngay sang phân hệ liên quan
                    const handleClick = () => {
                      if (isUnread) markAsRead(notif.id);
                      if (onNavigateTab) handleNavigate(notif);
                    };

                    return (
                      <div
                        key={notif.id}
                        onClick={() => selectMode ? toggleNotifSelect(notif.id) : handleClick()}
                        className={`mx-2 rounded-xl transition-all cursor-pointer ${
                          selectMode && selectedNotifIds.has(notif.id)
                            ? 'bg-indigo-500/15 border border-indigo-500/30'
                            : isUnread
                              ? 'bg-indigo-500/5 border border-indigo-500/10'
                              : 'hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-start gap-3 p-3">
                          {/* Select checkbox */}
                          {selectMode && (
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                              selectedNotifIds.has(notif.id)
                                ? 'bg-indigo-500 border-indigo-500'
                                : 'border-slate-600 hover:border-slate-400'
                            }`}>
                              {selectedNotifIds.has(notif.id) && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                          )}
                          {/* Icon */}
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0"
                            style={{ backgroundColor: group.color + '20' }}
                          >
                            {group.icon}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className={`text-[12px] font-semibold block truncate ${
                                  isUnread ? 'text-white' : 'text-slate-400'
                                }`}>
                                  {notif.title || 'Thông báo'}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {formatTime(notif.createdAt)}
                                </span>
                              </div>
                            </div>
                            <p className={`text-[11px] mt-0.5 leading-snug ${
                              isUnread ? 'text-slate-200' : 'text-slate-500'
                            }`}>
                              {notif.content}
                            </p>

                            {/* Sender & subTaskCode */}
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className="text-[9px] font-semibold uppercase"
                                style={{ color: group.color }}
                              >
                                {notif.senderName || 'HỆ THỐNG'}
                              </span>
                              {notif.subTaskCode && (
                                <span className="text-[9px] text-slate-500 font-mono">
                                  • {notif.subTaskCode}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Unread dot */}
                          {isUnread && (
                            <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1"></div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* BULK ACTION BAR */}
        {selectMode && (
          <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 px-4 py-2.5 flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAllNotifs}
                className="text-[11px] text-indigo-400 hover:text-white font-semibold cursor-pointer transition-colors"
              >
                {selectedNotifIds.size === myNotifications.length ? 'Bỏ chọn hết' : 'Chọn tất cả'}
              </button>
              <span className="text-[11px] text-slate-500">
                {selectedNotifIds.size > 0 && `Đã chọn ${selectedNotifIds.size}`}
              </span>
            </div>
            {selectedNotifIds.size > 0 && (
              <button
                onClick={handleBulkDeleteNotifications}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold rounded-lg transition-all cursor-pointer"
              >
                <Trash className="w-3.5 h-3.5" />
                Xóa ({selectedNotifIds.size})
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
