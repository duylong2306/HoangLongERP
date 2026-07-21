import React, { useState, useEffect } from 'react';
import { AppNotification, Employee } from '../types';
import {
  Bell,
  CheckCheck,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  AlertCircle
} from 'lucide-react';

interface NotificationListProps {
  notifications: AppNotification[];
  currentUser: Employee;
  employees: Employee[];
  onUpdateNotifications: (updated: AppNotification[]) => void;
  onNavigateTab?: (tab: string) => void;
  initialSelectedId?: string | null; // Tự động mở chi tiết thông báo này khi mount
  onClose?: () => void; // Đóng cửa sổ thông báo (khi click ra ngoài)
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
  employees,
  onUpdateNotifications,
  onNavigateTab,
  initialSelectedId,
  onClose
}: NotificationListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(GROUPS.map(g => g.key)));
  const [selectedNotif, setSelectedNotif] = useState<AppNotification | null>(null);

  // Khi được yêu cầu mở chi tiết một thông báo cụ thể (từ chuông thông báo)
  useEffect(() => {
    if (!initialSelectedId) return;
    const target = notifications.find(n => n.id === initialSelectedId);
    if (target) {
      setSelectedNotif(target);
      // Mở rộng nhóm chứa thông báo này để nó hiển thị
      const group = GROUPS.find(g => g.filter(target));
      if (group) {
        setExpandedGroups(prev => {
          const next = new Set(prev);
          next.add(group.key);
          return next;
        });
      }
      // Đánh dấu đã đọc
      if (!target.read) markAsRead(target.id);
    }
  }, [initialSelectedId]);

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
  };

  const markAllRead = (group: NotificationGroup) => {
    onUpdateNotifications(notifications.map(n =>
      group.filter(n) && !n.read ? { ...n, read: true } : n
    ));
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
    else if (cat === 'hr' || cat === 'attendance') onNavigateTab('employees');
    else onNavigateTab('dashboard');
  };

  const getActionForNotif = (notif: AppNotification) => {
    const hasNavigation = onNavigateTab && notif.subTaskCode;
    return { hasNavigation };
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
          {totalUnread > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {totalUnread} chưa đọc
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400">
          Nhắc nhở điểm danh, công việc, phê duyệt & cập nhật hệ thống
        </p>
      </div>

      {/* Notification groups */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {totalUnread === 0 && (
          <div className="py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-7 h-7 text-emerald-500" />
            </div>
            <p className="text-[13px] text-slate-400 font-medium">Tất cả đã xem</p>
            <p className="text-[11px] text-slate-500 mt-1">Bạn không có thông báo nào chưa đọc</p>
          </div>
        )}

        {GROUPS.map(group => {
          const groupNotifs = myNotifications.filter(group.filter).sort(sortByUnreadThenNewest);
          const unreadCount = groupNotifs.filter(n => !n.read).length;
          const isExpanded = expandedGroups.has(group.key);

          if (groupNotifs.length === 0) return null;

          return (
            <div key={group.key} className="border-b border-slate-800/50">
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
                    const isSelected = selectedNotif?.id === notif.id;
                    const { hasNavigation } = getActionForNotif(notif);

                    // Click vào thông báo: đánh dấu đã đọc + chuyển ngay sang phân hệ liên quan
                    const handleClick = () => {
                      if (isUnread) markAsRead(notif.id);
                      if (hasNavigation && onNavigateTab) handleNavigate(notif);
                      else setSelectedNotif(isSelected ? null : notif);
                    };

                    return (
                      <div
                        key={notif.id}
                        onClick={handleClick}
                        className={`mx-2 rounded-xl transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-500/10'
                            : isUnread
                              ? 'bg-indigo-500/5 border border-indigo-500/10'
                              : 'hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-start gap-3 p-3">
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
                              <div className="flex items-center gap-1 shrink-0">
                                {isUnread && (
                                  <button
                                    onClick={() => markAsRead(notif.id)}
                                    className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
                                    title="Đánh dấu đã đọc"
                                  >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {isSelected ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                )}
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

                            {/* Buttons (hiện khi selected) */}
                            {isSelected && (
                              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800">
                                {hasNavigation && (
                                  <button
                                    onClick={() => handleNavigate(notif)}
                                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    Xem chi tiết
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isUnread) markAsRead(notif.id);
                                    if (hasNavigation && onNavigateTab) handleNavigate(notif);
                                  }}
                                  className={`py-1.5 px-3 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                                    isUnread
                                      ? 'bg-slate-800 text-white hover:bg-slate-700'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {hasNavigation ? 'Đi tới' : (isUnread ? 'Đã đọc' : 'Đã xem')}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Unread dot */}
                          {isUnread && !isSelected && (
                            <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1"></div>
                          )}
                        </div>

                        {/* Detail content (hiện khi selected và có detailedContent) */}
                        {isSelected && notif.detailedContent && notif.detailedContent !== notif.content && (
                          <div className="px-3 pb-3 pl-[60px]">
                            <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-[11px] text-slate-400 leading-relaxed whitespace-pre-wrap">
                              {notif.detailedContent}
                            </div>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
