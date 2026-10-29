import { isPaymentProposedBy } from '../lib/approvalInbox';
import * as MT from '../lib/messageTemplates';
import { isTravelExpenseBeneficiary } from '../lib/ctpOwnership';
import { findUniqueEmployeeByName } from '../lib/employeeLookup';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Project, Task, Receipt, Payment, Quote, SubcontractorAdvanceProposal, SystemConfig } from '../types';
import { computeDailyWorkday, getAttendanceStatusText, readHrmConfigFromStorage } from './hr/hrCalculations';
import { isUserInRoleGroup, loadHrmRoleGroups, getConfiguredApprover, getConfiguredApprovers, useNotification, isRoleAdmin, isRoleAccounting, isRoleOffice } from '../context';
import { dbService, mapAttendanceRow, todayString } from '../lib/dbService';
import {
  enqueuePunch,
  removePunch,
  pendingCount as outboxPendingCount,
  getPendingPunches,
  burnTimestampToPhoto,
} from '../lib/attendanceOutbox';
import { mergePunchMeta, isAttendanceReportType } from '../lib/attendanceMeta';
import { sendApprovalDirectMessage, findEmployeeByName, maybeSendAttendanceChatMessage, getConversations, getUserConversations } from '../lib/chatStore';
import { unreadForBadge, readPrefs, prefsKey } from '../lib/chatPrefs';
import { companyScopedKey } from '../lib/supabase';
import { loadUnreadSummary } from '../lib/projectEventReads';
import MonthCalendar from './overview/MonthCalendar';
import OverviewHome, { type OverviewHomeData, type TodoItem } from './overview/OverviewHome';
import Sheet, { Field, Notice, SheetActions, Segmented, inputCls } from './overview/Sheet';
import {
  computeShiftView, pickFocusShift, buildWeek, standardWorkdays, summarizeTasks, summarizeViolations, summarizeLeaves, summarizeCtp, summarizeAdvances,
  myProjects, summarizeCompanyToday, hasTime, buildMonth, type ShiftView,
} from '../lib/overviewData';
import { CTPStatus, ctpStatusLabel } from '../lib/travelExpenseStatus';
import PunchMediaList from './hr/PunchMediaList';
import { DEFAULT_SYSTEM_CONFIG } from '../data';
import { 
  CheckSquare, 
  Clock, 
  AlertTriangle, 
  UserCheck, 
  CheckCircle,
  TrendingDown,
  Hammer,
  DollarSign,
  Plus,
  Send,
  Sparkles,
  RefreshCw,
  FolderOpen,
  Camera,
  Fingerprint,
  MapPin,
  X,
  Briefcase,
  Zap,
  AlertCircle,
  CalendarCheck,
  Settings,
  Lock,
  Sun,
  Moon,
  Compass
} from 'lucide-react';
import { Employee } from '../types';
import { generateLeaveId } from '../lib/leaveRequests';
import { evaluateLeaveNotice, isRealLeaveType, tagLateNoticeReason, formatDays } from '../lib/leaveNotice';
import { supportsShiftLeave, leaveDaysCount, shiftLabel, shiftLeaveBadge, shiftLeaveFullLabel, approvedShiftLeavesOnDay, type LeaveShift } from '../lib/leaveShift';

interface DashboardProps {
  projects: Project[];
  tasks: Task[];
  receipts: Receipt[];
  payments: Payment[];
  quotes: Quote[];
  currentUser: any;
  onNavigateTab: (tabId: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onApprovePayment?: (id: string, status: 'approved' | 'rejected') => void;
  onAddTask?: (newTask: Task) => void;
  onAddPayment?: (newPay: Payment) => void;
  travelExpensesSummary?: any[];
}


export default function DashboardOverview({
  projects,
  tasks,
  receipts,
  payments,
  quotes,
  currentUser,
  onNavigateTab,
  onUpdateTask,
  onApprovePayment,
  onAddTask,
  onAddPayment,
  travelExpensesSummary = [],
}: DashboardProps) {


  // --- PHẦN 1: BỘ LỌC CÔNG VIỆC THEO USER ĐANG ĐĂNG NHẬP (& PHÂN QUYỀN TRUY CẬP) ---
  const { addToast } = useNotification();

  const getTodayString = useCallback(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const r = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${r}`;
  }, []);

  const [todayVal, setTodayVal] = useState(getTodayString());

  // Update todayVal when getTodayString changes (e.g. at midnight)
  useEffect(() => {
    setTodayVal(getTodayString());
  }, [getTodayString]);

  // 1.1 Công việc cần duyệt (Tasks needing approval)
  // Director & Accountant có thể duyệt tất cả Reviewing tasks hoặc pending approvals.
  // PM duyệt cho dự án của họ hoặc nếu được gán là approver.
  // Các vai trò khác duyệt nếu họ được chỉ định approver.
  const isAdmin = currentUser ? isRoleAdmin(currentUser.id) : false;
  const isAccountant = currentUser ? isRoleAccounting(currentUser.id) : false;
  const isPM = currentUser ? isRoleOffice(currentUser.id) : false;

  const needingApprovalTasks = tasks.filter(t => {
    if (isAdmin || isAccountant) {
      return t.status === 'reviewing' || t.approvals?.some(a => a.status === 'pending');
    }
    if (isPM) {
      const isProjectPM = projects.find(p => p.id === t.projectId)?.pmId === currentUser.id;
      const isPendingApprover = t.approvals?.some(a => a.approverId === currentUser.id && a.status === 'pending');
      return (t.status === 'reviewing' && isProjectPM) || isPendingApprover;
    }
    return t.approvals?.some(a => a.approverId === currentUser.id && a.status === 'pending');
  });

  // 1.2 Công việc cần làm (My Tasks to do)
  const myTasks = tasks.filter(t => {
    const isAssignee = t.assigneeId === currentUser.id;
    const isMissionMember = t.missions?.some(m => m.mainAssigneeId === currentUser.id || (m.memberIds || []).includes(currentUser.id));
    const isNotCompleted = t.status !== 'completed';
    return (isAssignee || isMissionMember) && isNotCompleted;
  });

  // 1.3 Công việc quá hạn (Overdue tasks)
  const myOverdueTasks = tasks.filter(t => {
    const isAssignee = t.assigneeId === currentUser.id;
    const isMissionMember = t.missions?.some(m => m.mainAssigneeId === currentUser.id || (m.memberIds || []).includes(currentUser.id));
    const isCompleted = t.status === 'completed';
    const isOverdueStatus = t.status === 'overdue';
    const isPastDeadline = t.deadline < todayVal;
    return (isAssignee || isMissionMember) && !isCompleted && (isOverdueStatus || isPastDeadline);
  });


  // --- PHẦN 2: BỘ LỌC ĐỀ XUẤT TÀI CHÍNH (VẬT TƯ & TẠM ỨNG) ---

  // 2.1 Yêu cầu vật tư (Material requests)
  // Lấy từ danh sách payments có category là 'material'
  const materialRequests = payments.filter(p => p.category === 'material');
  const filteredMaterialRequests = materialRequests.filter(mr => {
    if (isAdmin || isAccountant) {
      return true; // Sếp / kế toán thấy tất cả để duyệt
    }
    const isPM = currentUser ? isRoleOffice(currentUser.id) : false;
    if (isPM) {
      const isProjectPM = projects.find(p => p.id === mr.projectId)?.pmId === currentUser.id;
      return isProjectPM || isPaymentProposedBy(mr, currentUser);
    }
    return isPaymentProposedBy(mr, currentUser);
  });

  // 2.2 Yêu cầu tạm ứng (Advance requests)
  // Lấy từ:
  // a) advanceRequests bên trong các tasks
  // b) payments có ghi nhận tạm ứng (hoặc category 'labor' / 'general' với notes chứa chữ "tạm ứng/ứng")
  const taskAdvances = tasks.flatMap(t => {
    const rxs = t.advanceRequests || [];
    return rxs.map(rx => ({
      originType: 'task_advance' as const,
      taskId: t.id,
      taskName: t.name,
      id: rx.id,
      title: rx.title,
      amount: rx.amount,
      status: rx.status,
      reason: rx.reason,
      proposerName: rx.proposerName,
      date: rx.date,
      type: rx.type
    }));
  });

  const paymentAdvances = payments.filter(p => 
    p.notes?.toLowerCase().includes('tạm ứng') || 
    p.notes?.toLowerCase().includes('ứng lương') ||
    p.notes?.toLowerCase().includes('ứng trước')
  ).map(p => ({
    originType: 'payment_advance' as const,
    taskId: '',
    taskName: projects.find(pr => pr.id === p.projectId)?.name || 'Hợp đồng chung',
    id: p.id,
    title: p.notes || 'Phiếu chi tạm ứng',
    amount: p.amount,
    status: p.status,
    reason: `Chi tạm ứng cho: ${p.recipient}`,
    proposerName: p.proposer,
    date: p.date,
    type: 'advance'
  }));

  const allAdvances = [...taskAdvances, ...paymentAdvances];
  const filteredAdvances = allAdvances.filter(ad => {
    if (isAdmin || isAccountant) {
      return true; // Sếp / Kế toán thấy toàn bộ
    }
    return ad.proposerName === currentUser.name || ad.proposerName.toLowerCase().includes(currentUser.name.toLowerCase());
  });


  // --- TRẠNG THÁI FORM TẠO NHANH (INLINE FORM STATES) ---
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);

  // States cho Form Vật Tư mới
  const [matProjId, setMatProjId] = useState(projects[0]?.id || '');
  const [matName, setMatName] = useState('');
  const [matAmount, setMatAmount] = useState('');
  const [matSupplier, setMatSupplier] = useState('');
  const [matNotes, setMatNotes] = useState('');

  // States cho Form Tạm Ứng mới
  const [advProjId, setAdvProjId] = useState(projects[0]?.id || '');
  const [advTitle, setAdvTitle] = useState('');
  const [advAmount, setAdvAmount] = useState('');
  const [advReason, setAdvReason] = useState('');
  const [advType, setAdvType] = useState<'advance' | 'reimbursement'>('advance');

  // --- LỌC TRẠNG THÁI CÔNG TÁC PHÍ (Tổng Quan) ---
  const [ctpStatusFilter, setCtpStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // CTP hiển thị trong Tổng Quan: CHỈ công tác phí mà user là NGƯỜI ĐƯỢC HƯỞNG (empId),
  // không phải người lập — để người hưởng theo dõi trạng thái xét duyệt khoản của mình.
  // Người duyệt sẽ xử lý ở tab Công tác phí (Nhân sự) hoặc cột Kế toán
  // (Công việc phải duyệt — Việc của tôi), không duyệt trên Tổng Quan nữa.
  const ctpList = React.useMemo(() => {
    const list = (travelExpensesSummary || []).filter((item: any) => isTravelExpenseBeneficiary(item, currentUser));
    if (ctpStatusFilter === 'all') return list;
    return list.filter((item: any) => {
      const st = item.status as CTPStatus;
      if (ctpStatusFilter === 'approved') return st === 'approved' || st === 'completed';
      return st === ctpStatusFilter;
    });
  }, [travelExpensesSummary, ctpStatusFilter, currentUser]);

  // Nộp Yêu Cầu Vật Tư mới
  const handleSubmitMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matName || !matAmount) {
      alert('Vui lòng nhập tên vật tư và số tiền đề nghị!');
      return;
    }
    if (onAddPayment) {
      const amt = parseFloat(matAmount.replace(/\D/g, '')) || Number(matAmount);
      const newPay: Payment = {
        id: `pay_${Date.now()}`,
        code: `PC-VT-${Math.floor(100 + Math.random() * 900)}`,
        date: todayVal,
        recipient: matSupplier || 'Nhà cung cấp vật tư lẻ',
        projectId: matProjId,
        category: 'material',
        amount: amt,
        paymentMethod: 'transfer',
        notes: `[Yêu cầu vật tư] Mua ${matName}. Chi tiết: ${matNotes || 'Không có ghi chú'}`,
        proposer: currentUser.name,
        approver: 'Trương Hữu Long (Giám Đốc)',
        status: 'pending'
      };
      onAddPayment(newPay);
      alert('Đệ trình yêu cầu mua vật tư thành công tới Ban giám đốc!');
      setMatName('');
      setMatAmount('');
      setMatSupplier('');
      setMatNotes('');
      setShowMaterialForm(false);
    }
  };

  // Nộp Yêu Cầu Tạm Ứng mới
  const handleSubmitAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!advTitle || !advAmount) {
      alert('Vui lòng nhập tiêu đề tạm ứng và số tiền đề xuất!');
      return;
    }
    const amt = parseFloat(advAmount.replace(/\D/g, '')) || Number(advAmount);
    
    // Tìm task đầu tiên thuộc dự án đã chọn để đính kèm yêu cầu tạm ứng mốc
    const targetTask = tasks.find(t => t.projectId === advProjId) || tasks[0];
    if (targetTask && onUpdateTask) {
      const prevRequests = targetTask.advanceRequests || [];
      const newReq = {
        id: `adv_${Date.now()}`,
        title: advTitle,
        amount: amt,
        status: 'pending' as const,
        reason: advReason || 'Phục vụ thanh toán trực tiếp ở công xưởng',
        proposerName: currentUser.name,
        date: todayVal,
        type: advType
      };
      onUpdateTask(targetTask.id, {
        advanceRequests: [...prevRequests, newReq]
      });
      alert('Đã đệ trình phiếu đề xuất tạm ứng kinh phí thành công!');
      setAdvTitle('');
      setAdvAmount('');
      setAdvReason('');
      setShowAdvanceForm(false);
    } else {
      alert('Không tìm thấy công việc mốc của dự án này để bổ sung đề xuất tạm ứng.');
    }
  };


  // --- PHẦN 3: HỆ THỐNG CHẤM CÔNG BIOMETRIC FACEID & GPS ---
  // Placeholder - SystemConfig is now imported from types.ts
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);

  // Load config từ Supabase khi mount
  useEffect(() => {
    dbService.shiftConfig.get().then(cloud => {
      if (cloud) setConfig(prev => ({ ...prev, ...cloud }));
    }).catch(() => {});
  }, []);

  // Listen for realtime config changes from Supabase
  useEffect(() => {
    const handleSettingsUpdate = () => {
      dbService.shiftConfig.get().then(cloud => {
        if (cloud) setConfig(prev => ({ ...prev, ...cloud }));
      }).catch(() => {});
    };
    window.addEventListener('hl_system_settings_updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('hl_system_settings_updated', handleSettingsUpdate);
    };
  }, []);

  // Helper: chuẩn hóa giá trị thời gian (xử lý object timestamp cũ)
  const normalizeTime = (v: any): string => {
    if (!v || v === '--:--' || v === '') return '--:--';
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && v.time) return v.time;
    return String(v);
  };
  const normalizeRecord = (r: any) => {
    const { _serverTime, ...rest } = r; // Loại bỏ _serverTime object (dữ liệu thời gian server)
    return {
      ...rest,
      timeInS: normalizeTime(rest.timeInS),
      timeOutS: normalizeTime(rest.timeOutS),
      timeInC: normalizeTime(rest.timeInC),
      timeOutC: normalizeTime(rest.timeOutC),
      timeInOT: normalizeTime(rest.timeInOT),
      timeOutOT: normalizeTime(rest.timeOutOT),
    };
  };

  const [attendanceList, setAttendanceList] = useState<any[]>([]);

  // Flag: true khi update đến từ cloud (Realtime/mount load), false khi từ user action
  const isSyncingFromCloud = useRef(false);

  // Debounce guard để ngăn chặn double-submit khi user click nhanh nút chấm công
  const punchDebounceRef = useRef<Set<string>>(new Set());

  // Loại bỏ bản ghi auto-generated trùng lặp (cùng empId + ngày, bỏ AT-AUTO-* khi có bản ghi thật)
  // VÀ gộp nhiều bản ghi thật thành 1 bản ghi duy nhất (merge tất cả fields)
  const dedupAttendance = (list: any[]): any[] => {
    const groups = new Map<string, any[]>();
    for (const log of list) {
      const key = `${log.empId}|${log.date}`;
      const arr = groups.get(key);
      if (arr) arr.push(log);
      else groups.set(key, [log]);
    }
    const deduped: any[] = [];
    for (const logs of groups.values()) {
      if (logs.length === 1) { deduped.push(logs[0]); continue; }
      const real = logs.filter((l: any) => !l.id?.startsWith('AT-AUTO-'));
      if (real.length > 0) {
        // Gộp nhiều bản ghi thật thành 1: lấy bản ghi mới nhất (theo id timestamp) làm base,
        // sau đó merge tất cả fields có dữ liệu từ các bản ghi khác
        const sorted = [...real].sort((a, b) => {
          // Ưu tiên bản ghi có id chứa timestamp lớn hơn (mới hơn)
          const aTs = a.id?.split('-').pop() || '';
          const bTs = b.id?.split('-').pop() || '';
          return bTs.localeCompare(aTs);
        });
        const merged = { ...sorted[0] };
        for (const log of sorted.slice(1)) {
          // Merge các field time, photo, location, coords, notes
          ['timeInS', 'timeOutS', 'timeInC', 'timeOutC', 'timeInOT', 'timeOutOT',
           'photoIn', 'photoOut', 'locationIn', 'locationOut', 'coordsIn', 'coordsOut',
           'method', 'status', 'otHours', 'notes'].forEach(key => {
            if (log[key] && log[key] !== '--:--' && log[key] !== '' && (!merged[key] || merged[key] === '--:--' || merged[key] === '')) {
              merged[key] = log[key];
            }
          });
          // Ảnh/tọa độ theo từng lượt: gộp theo slot (bản base thắng ở slot nó đã có)
          merged.punchMeta = mergePunchMeta(log.punchMeta, merged.punchMeta);
          // Giữ isLocked = true nếu có bản ghi nào locked
          if (log.isLocked) merged.isLocked = true;
        }
        deduped.push(merged);
        // Xóa bản ghi auto-generated trùng trên Supabase (fire-and-forget)
        logs.filter((l: any) => l.id?.startsWith('AT-AUTO-')).forEach((l: any) =>
          dbService.attendance.delete(l.id).catch(() => {})
        );
        // Xóa các bản ghi thật trùng lặp cũ trên Supabase (chỉ giữ merged)
        sorted.slice(1).forEach((l: any) =>
          dbService.attendance.delete(l.id).catch(() => {})
        );
      } else {
        deduped.push(logs[logs.length - 1]);
      }
    }
    return deduped;
  };

  // Load attendance from Supabase on mount.
  // Chỉ tải THÁNG HIỆN TẠI (thay vì toàn bộ lịch sử) để tránh lag khi nhiều user mở app — lịch
  // điểm danh chỉ cần dữ liệu trong tháng, báo cáo lịch sử nằm ở module Nhân sự.
  useEffect(() => {
    let mounted = true;
    const ym = todayVal.slice(0, 7); // 'YYYY-MM'
    // Chỉ tải dòng của đúng user đang đăng nhập (empId) → mỗi tab không download
    // toàn bộ chấm công của 25 user. Giảm ~25x băng thông khi nhiều người mở app.
    dbService.attendance.listForRange(`${ym}-01`, `${ym}-31`, empId)
      .then(list => {
        if (mounted && Array.isArray(list) && list.length > 0) {
          isSyncingFromCloud.current = true;
          setAttendanceList(dedupAttendance(list).map(normalizeRecord));
          requestAnimationFrame(() => { isSyncingFromCloud.current = false; });
        }
      })
      .catch(err => console.warn('Lỗi khi tải chấm công từ Supabase:', err));
    return () => { mounted = false; };
  }, []);

  // ─── Outbox: cập nhật UI từ sync TOÀN CỤC (thực hiện ở cấp App) ───────────
  // Việc ĐẨY dữ liệu lên DB giờ do App đảm nhiệm (chạy mọi khi app mở, bất kể tab)
  // để lượt chấm không bị kẹt trong localStorage khi user tắt app rồi mở lại ở
  // tab khác. Dashboard chỉ lắng nghe 'hl-outbox-synced' (do App dispatch) để cập
  // nhật badge "chờ đồng bộ" + xóa cờ pending trên dòng, cùng toast "Đã đồng bộ".
  useEffect(() => {
    const refreshPending = () => setPendingSync(outboxPendingCount());
    const onSynced = (e: Event) => {
      const summary = (e as CustomEvent).detail;
      refreshPending();
      // Xóa cờ chờ trên UI sau khi đã đồng bộ xong ít nhất 1 bản ghi
      if (summary?.synced > 0) {
        setAttendanceList(list => list.map(l => (l.syncPending ? { ...l, syncPending: false } : l)));
        addToast({
          title: '✅ Đã đồng bộ',
          message: `Đồng bộ thành công ${summary.synced} bản ghi chấm công đang chờ.`,
          type: 'success',
        });
      }
    };
    refreshPending();
    window.addEventListener('hl-outbox-synced', onSynced);
    return () => {
      window.removeEventListener('hl-outbox-synced', onSynced);
    };
  }, []);

  const [selectedDayDetail, setSelectedDayDetail] = useState<{ date: string; log: any; holidayName?: string } | null>(null);

  // Listen for real-time changes to the attendance logs (chỉ update UI, KHÔNG save lại Supabase — tránh vòng lặp Realtime)
  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        isSyncingFromCloud.current = true;
        const rawList = customEvent.detail.attendance || customEvent.detail;
        // Normalize time fields (phòng trường hợp data từ HRM chứa object timestamp thay vì string)
        setAttendanceList(Array.isArray(rawList) ? dedupAttendance(rawList).map(normalizeRecord) : []);
        requestAnimationFrame(() => { isSyncingFromCloud.current = false; });
      }
    };
    window.addEventListener('hl-attendance-updated', handleSync);
    window.addEventListener('hl_attendance_changed_from_hrm', handleSync);
    return () => {
      window.removeEventListener('hl-attendance-updated', handleSync);
      window.removeEventListener('hl_attendance_changed_from_hrm', handleSync);
    };
  }, []);

  // Realtime tăng dần (P1): cập nhật TẠI CHỖ 1 dòng từ payload realtime thay vì tải lại toàn bộ.
  // Đây là chìa khóa giải quyết lag giờ điểm danh — mỗi lượt chấm chỉ sửa 1 dòng trên state cục bộ,
  // không phát sinh truy vấn Supabase nào.
  useEffect(() => {
    const handleRealtime = (e: Event) => {
      const p = (e as CustomEvent).detail;
      if (!p || !p.eventType) return;
      // Dashboard CHỈ hiển thị chấm công của user đang đăng nhập → chỉ xử lý các
      // dòng thuộc empId hiện tại. Bỏ qua dòng của user khác để state không phình to
      // khi 25 user cùng chấm (mỗi realtime event của họ không đẩy vào list của ta).
      // empId rỗng (chưa gắn hồ sơ) → chấp nhận mọi dòng để không mất realtime.
      if (empId) {
        const rowEmpId = p.new?.emp_id || p.old?.emp_id || p.new?.empId || p.old?.empId;
        if (rowEmpId && rowEmpId !== empId) return;
      }
      isSyncingFromCloud.current = true;
      setAttendanceList(prev => {
        if (p.eventType === 'DELETE') {
          const id = p.old?.id;
          return id ? prev.filter(r => r.id !== id) : prev;
        }
        // INSERT / UPDATE / ERROR: ghi đè (upsert) theo id để tương thích với dòng mapped.
        const mapped = mapAttendanceRow(p.new);
        const idx = prev.findIndex(r => r.id === mapped.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = mapped;
          return copy;
        }
        return [mapped, ...prev];
      });
      requestAnimationFrame(() => { isSyncingFromCloud.current = false; });
    };
    window.addEventListener('hl-attendance-realtime', handleRealtime);
    return () => window.removeEventListener('hl-attendance-realtime', handleRealtime);
  }, []);

  // Mạng lưới an toàn (P1): định kỳ tải lại THÁNG HIỆN TẠI để tự sửa (reconcile)
  // các dòng bị lỡ realtime do mất kết nối/restart kênh. Chỉ tải 1 tháng (không
  // phải toàn bộ lịch sử) và tần suất thấp (2 phút) nên tải trọng không đáng kể so
  // với luồng điểm danh — đồng thời tái dùng event hl-attendance-updated để ghi đè list.
  useEffect(() => {
    const reloadMonth = async () => {
      // CHỈ đồng bộ khi tab đang hiển thị: 25 user mở app nhưng để background thì
      // không cần tải → tránh 25 tab gọi Supabase vô ích khi user không nhìn.
      if (document.visibilityState !== 'visible') return;
      // Đang có lượt chấm chờ đồng bộ (outbox) → state local ĐANG TRƯỚC DB.
      // Bỏ qua reconcile để không ghi đè mất lượt chấm vừa bấm (nút sẽ hiện lại
      // "VÀO/RA" gây hiểu nhầm). Khi outbox rỗng, reconcile tự chạy lại bình thường.
      if (outboxPendingCount() > 0) return;
      const ym = todayString().slice(0, 7); // 'YYYY-MM'
      try {
        // Chỉ tải lại dòng của mình (empId) để đồng bộ nền không kéo theo dữ liệu
        // của 25 user khác mỗi 2 phút.
        const list = await dbService.attendance.listForRange(`${ym}-01`, `${ym}-31`, empId);
        window.dispatchEvent(new CustomEvent('hl-attendance-updated', { detail: list }));
      } catch { /* thất bại êm — lần sau thử lại */ }
    };
    // Jitter ngẫu nhiên 0–20s: 25 tab không đồng loạt gọi Supabase tại cùng 1 phút
    // → dàn đều tải trọng, tránh spike khi nhiều user mở app cùng lúc.
    const jitter = Math.floor(Math.random() * 20000);
    const initialTimer = setTimeout(reloadMonth, jitter);
    const id = setInterval(reloadMonth, 120000);
    // Khi tab chuyển từ background → foreground, đồng bộ ngay (bù cho lúc bị bỏ qua).
    const onVisible = () => { if (document.visibilityState === 'visible') reloadMonth(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Dispatch changes made dynamically within the Dashboard module to the HRM module
  /* useEffect(() => {
    if (attendanceList) {
      window.dispatchEvent(new CustomEvent('hl_attendance_changed_from_dashboard', { detail: attendanceList }));
    }
  }, [attendanceList]); */

  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  };

  // ─── Helper: đọc phút hiện tại ───
  const getCurrentMinute = (): number => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };

  const getApproversList = () => {
    const defaultList = [
      { name: 'Trương Hữu Long', role: 'Giám đốc' },
      { name: 'Lê Thế Tiến', role: 'Quản đốc' },
      { name: 'Lê Thị Thảo', role: 'Kế Toán' }
    ];
    try {
      const list = hrmEmployees;
      if (Array.isArray(list)) {
        const filtered = list.filter((e: any) => {
          const role = (e.position || '').toLowerCase();
          return (
            role.includes('giám đốc') ||
            role.includes('quản') ||
            role.includes('trưởng') ||
            role.includes('kế toán') ||
            ['Trương Hữu Long', 'Lê Thế Tiến', 'Lê Thị Thảo'].includes(e.name)
          );
        });
        if (filtered.length > 0) {
          return filtered.map((e: any) => ({
            name: e.name,
            role: e.position || 'Quản lý'
          }));
        }
      }
    } catch (err) {
      console.error("Error loading approvers list:", err);
    }
    return defaultList;
  };

  const LEAVE_SYMBOLS = ['PN', 'P', 'KP', 'NL', 'T', 'C', 'OFF'];

  /** Giờ hợp lệ dạng "HH:MM" (loại bỏ '--:--', rỗng, ký hiệu nghỉ, object server-time). */
  const parsePunchMinutes = (raw: any): number | null => {
    const v = normalizeTime(raw);
    if (!v || v === '--:--' || LEAVE_SYMBOLS.includes(v)) return null;
    if (!/^\d{1,2}:\d{2}$/.test(v)) return null;
    const min = timeToMinutes(v);
    return Number.isFinite(min) ? min : null;
  };

  /** Ngày nghỉ theo lịch (cuối tuần hoặc nghỉ lễ) — không áp định mức giờ ca chuẩn. */
  const isCalendarRestDay = (dateStr: string): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    if ((config.weekendDays || [0]).includes(d.getDay())) return true;
    // dashHolidays lưu ngày dạng "DD/MM/YYYY"
    const [y, m, day] = dateStr.split('-');
    const holidayKey = `${day}/${m}/${y}`;
    return (dashHolidays || []).some((h: any) => h?.date === holidayKey);
  };

  /**
   * Ca nào trong ngày được MIỄN tính đi muộn / về sớm:
   *  - Đơn nghỉ phép đã duyệt (không có `shift` = nghỉ cả ngày)
   *  - Đơn giải trình chấm công đã duyệt cho đúng ca đó
   */
  const getExcusedShifts = (log: any): { morning: boolean; afternoon: boolean } => {
    const res = { morning: false, afternoon: false };
    const dateStr = log?.date;
    if (!dateStr) return res;
    for (const l of dashLeaves || []) {
      if (l?.status !== 'approved') continue;
      const sameEmp = (l.empId && log.empId && l.empId === log.empId)
        || (l.empName && log.empName && l.empName === log.empName);
      if (!sameEmp) continue;
      const inRange = l.fromDate && l.toDate
        ? (dateStr >= l.fromDate && dateStr <= l.toDate)
        : l.fromDate === dateStr;
      if (!inRange) continue;
      if (l.shift === 'morning') res.morning = true;
      else if (l.shift === 'afternoon') res.afternoon = true;
      else { res.morning = true; res.afternoon = true; }
    }
    return res;
  };

  /**
   * Đếm số lần ĐI MUỘN / VỀ SỚM của một bản ghi chấm công.
   *
   * Các điểm đã sửa so với bản cũ:
   *  1. VỀ SỚM có dung sai `punchOutOpenBeforeMinutes` (mặc định 15p) — trùng với
   *     cửa sổ mà hệ thống CHO PHÉP chấm ra ca. Trước đây ra ca lúc 11:20 (hệ thống
   *     mở cửa sổ chấm từ 11:15) vẫn bị tính là "về sớm" → con số luôn bị thổi phồng.
   *  2. Bỏ qua ngày nghỉ tuần / nghỉ lễ: những ngày này không có định mức giờ ca,
   *     ai đi làm bù/OT đều bị tính muộn oan.
   *  3. Bỏ qua ca đã có đơn nghỉ phép hoặc đơn giải trình ĐƯỢC DUYỆT.
   *  4. Chuẩn hóa giờ trước khi tính (bản ghi cũ có thể lưu object/JSON server-time),
   *     tránh NaN âm thầm làm sai kết quả.
   */
  const getLogAttendanceStats = (log: any) => {
    let lates = 0;
    let earlies = 0;
    let isLateMorning = false;
    let isEarlyMorning = false;
    let isLateAfternoon = false;
    let isEarlyAfternoon = false;

    const empty = { lates, earlies, isLateMorning, isEarlyMorning, isLateAfternoon, isEarlyAfternoon };
    if (!log) return empty;

    // Ngày nghỉ phép / ký hiệu off → không tính vi phạm giờ giấc
    const isLeave = LEAVE_SYMBOLS.includes(normalizeTime(log.timeInS)) ||
                    log.status === 'excused' ||
                    log.notes?.toLowerCase().includes('nghỉ') ||
                    log.notes?.toLowerCase().includes('off');
    if (isLeave) return empty;

    // Cuối tuần / nghỉ lễ: không có định mức giờ ca chuẩn để so sánh
    if (isCalendarRestDay(log.date)) return empty;

    const excused = getExcusedShifts(log);

    const targetInS = timeToMinutes(config?.morningIn || '07:30');
    const targetOutS = timeToMinutes(config?.morningOut || '11:30');
    const targetInC = timeToMinutes(config?.afternoonIn || '13:00');
    const targetOutC = timeToMinutes(config?.afternoonOut || '17:00');
    // Dung sai "Cho phép đi muộn" tách riêng theo từng ca (migration 036):
    //   - Ca Sáng  → allowedLateMorning
    //   - Ca Chiều → allowedLateAfternoon
    // `allowedLateMinutes` (global) chỉ còn là fallback.
    const allowedLateMorning   = config?.allowedLateMorning   ?? config?.allowedLateMinutes ?? 15;
    const allowedLateAfternoon = config?.allowedLateAfternoon ?? config?.allowedLateMinutes ?? 15;
    // Dung sai về sớm = đúng bằng khoảng thời gian hệ thống mở cửa sổ chấm ra ca sớm
    const allowedEarlies = config?.punchOutOpenBeforeMinutes ?? 15;

    // 1. Ca Sáng
    if (!excused.morning) {
      const inMin = parsePunchMinutes(log.timeInS);
      if (inMin !== null && inMin > targetInS + allowedLateMorning) {
        lates++;
        isLateMorning = true;
      }
      const outMin = parsePunchMinutes(log.timeOutS);
      if (outMin !== null && outMin < targetOutS - allowedEarlies) {
        earlies++;
        isEarlyMorning = true;
      }
    }

    // 2. Ca Chiều
    if (!excused.afternoon) {
      const inMin = parsePunchMinutes(log.timeInC);
      if (inMin !== null && inMin > targetInC + allowedLateAfternoon) {
        lates++;
        isLateAfternoon = true;
      }
      const outMin = parsePunchMinutes(log.timeOutC);
      if (outMin !== null && outMin < targetOutC - allowedEarlies) {
        earlies++;
        isEarlyAfternoon = true;
      }
    }

    return { lates, earlies, isLateMorning, isEarlyMorning, isLateAfternoon, isEarlyAfternoon };
  };


  /**
   * Mã nhân viên của người đang đăng nhập.
   *
   * ⚠️ TRƯỚC ĐÂY: hàm này đoán mã NV từ TÊN (localStorage `hl_hrm_employees_v3` rồi
   * fallback sang chuỗi if/else `name.includes('Ngọc') → NV002` … `return 'NV999'`).
   * Trên máy chưa có cache localStorage (đăng nhập lần đầu / xoá cache / máy khác),
   * mọi người đều bị gán nhầm mã — phần lớn thành 'NV999' (mã KHÔNG tồn tại trong
   * bảng employees). Bản ghi chấm công ghi lên Supabase với emp_id sai → tab
   * "Chấm công ngày" (lọc theo nhân viên đang làm việc) loại bỏ hết các bản ghi đó.
   *
   * BÂY GIỜ: `currentUser` chính là bản ghi Employee lấy từ bảng `employees`
   * (xem App.tsx – setCurrentUser(foundUser) từ danh sách employees), nên
   * `currentUser.id` LUÔN là mã nhân viên chuẩn. Không đoán theo tên nữa.
   */
  const empId = currentUser?.id || '';


  const [hrmEmployees, setHrmEmployees] = useState<any[]>([]);

  useEffect(() => {
    dbService.employees.list()
      .then(list => { if (Array.isArray(list)) setHrmEmployees(list); })
      .catch(err => console.warn('Lỗi tải nhân viên từ Supabase:', err));
  }, []);

  useEffect(() => {
    const handleSyncEmployees = (e: Event) => {
      const customEvent = e as CustomEvent;
      // detail có thể là mảng (sự kiện từ HRM) hoặc { employees: [...] } (App.fireEmployeesEvent,
      // bắn mỗi 60s). Luôn chuẩn hóa về mảng, nếu không state thành object → crash ".find is not a function".
      const d = customEvent.detail;
      const list = Array.isArray(d) ? d : d?.employees;
      if (Array.isArray(list)) {
        setHrmEmployees(list);
      }
    };
    window.addEventListener('hl_employees_changed_from_hrm', handleSyncEmployees);
    window.addEventListener('hl-employees-updated', handleSyncEmployees);
    return () => {
      window.removeEventListener('hl_employees_changed_from_hrm', handleSyncEmployees);
      window.removeEventListener('hl-employees-updated', handleSyncEmployees);
    };
  }, []);

  const getCurrentEmployeeProfile = (): any => {
    const match = hrmEmployees.find((e: any) => e.name.toLowerCase() === currentUser.name.toLowerCase() || e.id === empId);
    if (match) return match;
    return null;
  };

  const handleManualReset = () => {
    if (!confirm('Bạn có chắc chắn muốn reset dữ liệu chấm công cho ngày hiện tại (' + todayVal + ')?')) return;

    const updatedList = attendanceList.map((a: any) => {
        if (a.date === todayVal) {
             return {
              ...a,
              timeInS: '--:--',
              timeOutS: '--:--',
              timeInC: '--:--',
              timeOutC: '--:--',
              timeInOT: '--:--',
              timeOutOT: '--:--',
              status: 'valid',
              otHours: 0,
              notes: 'Reset thủ công ngày ' + todayVal
            };
        }
        return a;
    });
    setAttendanceList(updatedList.map(normalizeRecord));

    // Save to Supabase
    const todayRecord = updatedList.find(r => r.date === todayVal);
    if (todayRecord) {
      dbService.attendance.save(todayRecord).catch(err =>
        console.warn('Lỗi khi lưu reset chấm công lên Supabase:', err));
    }

    alert('Đã reset dữ liệu chấm công ngày ' + todayVal);
  }

  // Digital clock
  const [digitalTime, setDigitalTime] = useState('');
  const [digitalDate, setDigitalDate] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setDigitalTime(d.toLocaleTimeString('vi-VN', { hour12: false }));
      const weekdays = ['CHỦ NHẬT', 'THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY'];
      setDigitalDate(`${weekdays[d.getDay()]}, ${d.getDate()} THÁNG ${d.getMonth() + 1}`);

      // Auto-update to new day (e.g. past midnight) safely
      const sysToday = getTodayString();
      setTodayVal(prev => prev !== sysToday ? sysToday : prev);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [getTodayString]);

  // Automatic 6 AM reset
  /* useEffect(() => {
    if (!digitalTime || !attendanceList || attendanceList.length === 0) return;
    const currTimeStr = digitalTime.substring(0, 5);
    const currMin = timeToMinutes(currTimeStr);

    // 06:00 AM represented as 360 minutes from midnight
    if (currMin >= 360) {
      const lastResetDay = localStorage.getItem('hl_attendance_last_reset_day_v3');
      if (lastResetDay !== todayVal) {
        const updatedList = attendanceList.map((a: any) => {
          if (a.date === todayVal) {
            const leavesSaved = localStorage.getItem('hl_hrm_leaves_v3');
            let hasApprovedLeave = false;
            let leaveSymbol = '';
            if (leavesSaved) {
              try {
                const leavesList = JSON.parse(leavesSaved);
                const approved = leavesList.find((l: any) => {
                  if (l.status !== 'approved') return false;
                  if (l.isAttendanceCorrection || l.type === 'Yêu cầu xét duyệt công' || isAttendanceReportType(l.type)) return false;
                  const sameEmp = (l.empId && a.empId && l.empId === a.empId) || (l.empName && a.empName && l.empName === a.empName);
                  if (!sameEmp) return false;
                  return todayVal >= l.fromDate && todayVal <= l.toDate;
                });
                if (approved) {
                  hasApprovedLeave = true;
                  const tLower = approved.type.toLowerCase();
                  if (tLower.includes('phép năm') || tLower.includes('pn')) {
                    leaveSymbol = 'PN';
                  } else if (tLower.includes('không phép') || tLower === 'kp') {
                    leaveSymbol = 'KP';
                  } else if (tLower.includes('ma chay') || tLower.includes('hiếu') || tLower === 't') {
                    leaveSymbol = 'T';
                  } else if (tLower.includes('cưới') || tLower === 'c') {
                    leaveSymbol = 'C';
                  } else {
                    leaveSymbol = 'P';
                  }
                }
              } catch (e) {}
            }

            if (hasApprovedLeave) {
              return {
                ...a,
                timeInS: leaveSymbol,
                timeOutS: leaveSymbol,
                timeInC: leaveSymbol,
                timeOutC: leaveSymbol,
                timeInOT: '--:--',
                timeOutOT: '--:--',
                status: 'excused',
                otHours: 0,
                notes: `Nghỉ phép được phê duyệt (Tránh reset 6 AM): ${leaveSymbol}`
              };
            }

            return {
              ...a,
              timeInS: '--:--',
              timeOutS: '--:--',
              timeInC: '--:--',
              timeOutC: '--:--',
              timeInOT: '--:--',
              timeOutOT: '--:--',
              status: 'valid',
              otHours: 0,
              notes: 'Hệ thống tự động reset đầu ca ngày mới (sau 06:00 AM)'
            };
          }
          return a;
        });

    setAttendanceList(updatedList.map(normalizeRecord));
        localStorage.setItem('hl_attendance_last_reset_day_v3', todayVal);
        console.log(`⏱️ Đã tự động reset điểm danh đầu ca mới 6 AM ngày ${todayVal}`);
      }
    }
  }, [digitalTime, todayVal, attendanceList]); */

  const [activePunchSlot, setActivePunchSlot] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [liveGpsCoords, setLiveGpsCoords] = useState<string>('');
  const [liveGpsAddr, setLiveGpsAddr] = useState<string>('');
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string>('');
  const [showPunchModal, setShowPunchModal] = useState(false);
  const [pendingSync, setPendingSync] = useState<number>(() => outboxPendingCount());
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Modals for Leave and Advance
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveRequestType, setLeaveRequestType] = useState('Nghỉ phép năm');
  const [leaveTypes, setLeaveTypes] = useState<string[]>([
    'Nghỉ phép năm',
    'Nghỉ không lương có xin phép',
    'Nghỉ hiếu hĩ/ma chay',
    'Nghỉ cưới'
  ]);

  // Load coefficients and holidays for unified workday calculation (từ Supabase)
  const [dashCoefficients, setDashCoefficients] = useState<any[]>([]);
  const [dashHolidays, setDashHolidays] = useState<any[]>([]);

  useEffect(() => {
    const loadCoefficients = () => dbService.hrmLeaveCoefficients.list()
      .then(list => { if (Array.isArray(list)) setDashCoefficients(list); })
      .catch(err => console.warn('Lỗi tải hệ số nghỉ phép từ Supabase:', err));
    const loadHolidays = () => dbService.hrmHolidays.list()
      .then(list => { if (Array.isArray(list)) setDashHolidays(list); })
      .catch(err => console.warn('Lỗi tải ngày lễ từ Supabase:', err));
    loadCoefficients();
    loadHolidays();
    // Trước đây chỉ tải 1 lần lúc mount, không nghe sự kiện nào — 2 bảng này
    // thuộc nhóm polling 5 phút ở App.tsx (đã bắn đúng 2 event dưới đây) nhưng
    // Dashboard chưa từng lắng nghe, nên hệ số nghỉ phép/ngày lễ dùng để tính
    // loại nghỉ phép trong modal xin nghỉ có thể cũ tới khi F5.
    window.addEventListener('hl-hrm-leave-coefficients-updated', loadCoefficients);
    window.addEventListener('hl-hrm-holidays-updated', loadHolidays);
    return () => {
      window.removeEventListener('hl-hrm-leave-coefficients-updated', loadCoefficients);
      window.removeEventListener('hl-hrm-holidays-updated', loadHolidays);
    };
  }, []);

  useEffect(() => {
    if (leaveModalOpen) {
      try {
        const parsed = dashCoefficients;
        if (Array.isArray(parsed) && parsed.length > 0) {
          const types = parsed
            .filter((item: any) => item.isAuto === false)
            .map((item: any) => item.type)
            .filter(Boolean);
          if (types.length > 0) {
            setLeaveTypes(types);
            if (!types.includes(leaveRequestType)) {
              setLeaveRequestType(types[0]);
            }
          }
        }
      } catch (e) {
        console.error('Error loading leave types from coefficients:', e);
      }

      // Enforce default start date at least 2 days in advance, and end date +1 day from start date
      try {
        const baseDate = new Date(todayVal);
        baseDate.setDate(baseDate.getDate() + 2);
        const fromDateStr = baseDate.toISOString().split('T')[0];
        setLeaveFrom(fromDateStr);

        baseDate.setDate(baseDate.getDate() + 1);
        const toDateStr = baseDate.toISOString().split('T')[0];
        setLeaveTo(toDateStr);
      } catch (e) {
        console.error('Error calculating initial dates:', e);
      }
    }
  }, [leaveModalOpen, todayVal, dashCoefficients]);

  const [leaveFrom, setLeaveFrom] = useState('2026-06-08');
  const [leaveTo, setLeaveTo] = useState('2026-06-09');
  const [leaveDays, setLeaveDays] = useState(2);
  // Thời gian nghỉ của "Nghỉ phép năm" / "Nghỉ không lương có xin phép": cả ngày (mặc định) hoặc chỉ 1 ca. Nghỉ 1 ca = đúng 1 ngày, 0,5 ngày.
  const [leaveShiftChoice, setLeaveShiftChoice] = useState<'full' | LeaveShift>('full');

  // Loại phép không hỗ trợ nghỉ theo ca (hiếu hỉ, cưới...) → quay về nghỉ cả ngày
  useEffect(() => {
    if (!supportsShiftLeave(leaveRequestType)) setLeaveShiftChoice('full');
  }, [leaveRequestType]);

  // Tự đồng bộ số ngày (và ngày kết thúc khi nghỉ 1 ca) mỗi khi ngày hoặc cách nghỉ đổi
  useEffect(() => {
    try {
      const shift = leaveShiftChoice === 'full' ? undefined : leaveShiftChoice;
      if (shift && leaveTo !== leaveFrom) { setLeaveTo(leaveFrom); return; }   // nghỉ 1 ca chỉ trong 1 ngày
      setLeaveDays(leaveDaysCount(leaveFrom, leaveTo, shift));
    } catch (e) {
      setLeaveDays(0);
    }
  }, [leaveFrom, leaveTo, leaveShiftChoice]);

  const [leaveReasonText, setLeaveReasonText] = useState('');
  const [leaveApprover, setLeaveApprover] = useState('Trương Hữu Long');
  const [leaveApproverId, setLeaveApproverId] = useState('');
  const [leaveApproverPosition, setLeaveApproverPosition] = useState('');

  // Report Form state
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportApprover, setReportApprover] = useState('');
  const [reportStatusText, setReportStatusText] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportType, setReportType] = useState<'Báo cáo nghỉ ca' | 'Báo cáo lỗi chấm ra ca' | 'Báo cáo lỗi hệ thống chấm công' | ''>('');
  const [reportCategory, setReportCategory] = useState<'faulty' | 'missing' | ''>('');
  const [reportShift, setReportShift] = useState<'morning' | 'afternoon' | ''>('');
  // Báo cáo nghỉ ca: khi CẢ HAI ca của ngày đều vắng thì gửi 1 lần cho cả ngày (tạo 2 đơn: sáng + chiều). Mặc định bật.
  const [reportWholeDay, setReportWholeDay] = useState(true);

  // Leaves list state (nguồn: Supabase)
  const [dashLeaves, setDashLeaves] = useState<any[]>([]);

  const refreshDashLeaves = () => {
    dbService.hrmLeaves.list()
      .then(list => { if (Array.isArray(list)) setDashLeaves(list); })
      .catch(err => console.warn('Lỗi tải đơn nghỉ phép từ Supabase:', err));
  };

  // Listen for real-time leave updates (HRM + Supabase realtime)
  useEffect(() => {
    // Trước đây thiếu bước tải lúc mount — dashLeaves rỗng cho tới khi có sự
    // kiện thay đổi hrm_leaves xảy ra trong phiên, khiến tính công/hiển thị
    // trạng thái nghỉ trong lịch chấm công sai (coi ngày nghỉ đã duyệt là vắng).
    refreshDashLeaves();
    const handleSyncLeaves = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setDashLeaves(customEvent.detail);
      }
    };
    window.addEventListener('hl_leaves_changed_from_hrm', handleSyncLeaves);
    window.addEventListener('hl-hrm-leaves-updated', refreshDashLeaves);
    return () => {
      window.removeEventListener('hl_leaves_changed_from_hrm', handleSyncLeaves);
      window.removeEventListener('hl-hrm-leaves-updated', refreshDashLeaves);
    };
  }, []);

  // Reset/initialize report states on day selection
  useEffect(() => {
    if (selectedDayDetail) {
      setShowReportForm(false);
      setReportReason('');
      setReportType('');
      setReportCategory('');
      setReportShift('');
      
      const approvers = getApproversList();
      if (approvers.length > 0) {
        setReportApprover(approvers[0].name);
      }

      const log = selectedDayDetail.log;
      if (log) {
        const hasInS = !(!log.timeInS || log.timeInS === '--:--' || log.timeInS === '');
        const hasOutS = !(!log.timeOutS || log.timeOutS === '--:--' || log.timeOutS === '');
        const hasInC = !(!log.timeInC || log.timeInC === '--:--' || log.timeInC === '');
        const hasOutC = !(!log.timeOutC || log.timeOutC === '--:--' || log.timeOutC === '');

        let statusText = '';
        if (!hasInS && !hasOutS && !hasInC && !hasOutC) {
          statusText = 'Không có lịch sử check-in cả ngày';
        } else if (!hasInS && !hasOutS) {
          statusText = 'Không có lịch sử check-in Ca Sáng';
        } else if (!hasInC && !hasOutC) {
          statusText = 'Không có lịch sử check-in Ca Chiều';
        } else if (hasInS && !hasOutS) {
          statusText = 'Điểm danh lỗi Ca Sáng (Vào nhưng không Ra)';
        } else if (hasInC && !hasOutC) {
          statusText = 'Điểm danh lỗi Ca Chiều (Vào nhưng không Ra)';
        } else {
          statusText = 'Điều chỉnh điểm danh';
        }
        setReportStatusText(statusText);
      } else {
        setReportStatusText('Không có lịch sử check-in cả ngày');
      }
    }
  }, [selectedDayDetail]);

  // Calculate leave warning message in real-time (must register 2 days in advance)
  // Đánh giá thời gian báo trước của đơn đang lập (số ngày báo trước lấy từ Cấu Hình Ca; chỉ áp dụng cho đơn nghỉ phép thật) — xem lib/leaveNotice.ts
  const getLeaveNotice = () => {
    if (!leaveFrom || !isRealLeaveType(leaveRequestType)) return null;
    // Mốc bắt đầu nghỉ = giờ vào ca đầu tiên bị nghỉ (nghỉ riêng ca chiều → giờ vào ca chiều)
    const startIn = leaveShiftChoice === 'afternoon' ? config.afternoonIn : config.morningIn;
    const n = evaluateLeaveNotice({ fromDate: leaveFrom, now: new Date(), morningIn: startIn, requiredDays: config.leaveAdvanceDays });
    return n.late ? n : null;
  };
  // Phép năm còn dùng được = số còn lại TRỪ số ngày của các đơn phép năm CỦA MÌNH đang chờ duyệt (phép chỉ bị trừ lúc duyệt, nên nếu không
  // tính đơn đang chờ thì có thể nộp nhiều đơn vượt quá số phép còn lại).
  const getAnnualLeaveAvailability = () => {
    const profile = getCurrentEmployeeProfile();
    const remaining = profile?.phepNam !== undefined ? Number(profile.phepNam) : 12;
    const reserved = (dashLeaves || [])
      .filter((l: any) => l.status === 'pending' && l.type === 'Nghỉ phép năm' && (l.empId ? l.empId === empId : l.empName === currentUser.name))
      .reduce((sum: number, l: any) => sum + Number(l.daysCount || 0), 0);
    return { remaining, reserved, available: Math.max(0, remaining - reserved) };
  };
  const getLeaveDateWarningText = () => {
    try {
      const n = getLeaveNotice();
      if (!n) return null;
      const adv = n.advanceDays < 0 ? 'đã quá hạn' : `báo trước ${formatDays(n.advanceDays)} ngày`;
      return config.leaveAdvanceBlock
        ? `⚠️ Không đủ thời gian báo trước! Phải xin nghỉ phép trước ít nhất ${formatDays(n.requiredDays)} ngày (đơn này ${adv}). Công ty không cho nộp đơn xin muộn.`
        : `⚠️ Đơn xin muộn: ${adv}, quy định ${formatDays(n.requiredDays)} ngày. Vẫn nộp được nhưng đơn sẽ được đánh dấu "Xin muộn" để người duyệt cân nhắc.`;
    } catch (err) {}
    return null;
  };
  const leaveDateWarningMessage = getLeaveDateWarningText();

  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [advanceAmountVal, setAdvanceAmountVal] = useState('');
  const getCurrentPeriod = () => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const y = d.getFullYear();
    return `${m}/${y}`;
  };
  const getPeriodOptions = () => {
    const options = [];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    // 12 months before + current + 12 months after = 25 months
    for (let i = -12; i <= 12; i++) {
      let m = currentMonth + i;
      let y = currentYear;
      while (m < 1) { m += 12; y -= 1; }
      while (m > 12) { m -= 12; y += 1; }
      const val = `${String(m).padStart(2, '0')}/${y}`;
      const label = `Tháng ${String(m).padStart(2, '0')} năm ${y}`;
      options.push({ value: val, label });
    }
    return options;
  };
  const [advancePeriod, setAdvancePeriod] = useState(getCurrentPeriod());
  const [advanceReasonText, setAdvanceReasonText] = useState('');
  const [advanceApproverId, setAdvanceApproverId] = useState<string>('');

  // Lấy danh sách nhân viên từ Phân Quyền (Role Groups) - nhóm kế toán
  const getAccountingApprovers = useCallback(() => {
    // Đọc Role Groups từ Phân Quyền (localStorage: hl_hrm_roles_v2)
    let groups = loadHrmRoleGroups();

    // Fallback: nếu chưa có Role Groups nào, dùng default
    if (!groups || groups.length === 0) {
      const defaultRoles = [
        { id: 'role_admin', name: 'Ban Giám Đốc (Admin)', memberIds: [] },
        { id: 'role_accounting', name: 'Kế toán viên', memberIds: [] },
        { id: 'role_office', name: 'Nhân viên Văn phòng', memberIds: [] },
        { id: 'role_technical', name: 'Nhân viên Kỹ thuật', memberIds: [] },
        { id: 'role_factory_mwood', name: 'Tổ xưởng Mộc', memberIds: [] },
        { id: 'role_factory_mmetal', name: 'Tổ xưởng Cơ khí', memberIds: [] },
      ];
      groups = defaultRoles;
    }

    // Tìm nhóm Kế toán từ Phân Quyền
    const accountingGroup = groups.find(g => g.id === 'role_accounting');
    if (!accountingGroup || !accountingGroup.memberIds || accountingGroup.memberIds.length === 0) {
      return [];
    }

    // Đồng bộ IDs: hl_erp_employees dùng emp_xxx, hl_hrm_employees_v3 dùng NVxxx
    // Lọc nhân viên thuộc nhóm kế toán (theo memberIds từ Role Groups)
    const approvers: any[] = [];
    accountingGroup.memberIds.forEach((memberId: string) => {
      // Tìm theo ID trực tiếp trong hrmEmployees
      let emp = hrmEmployees.find(e => e.id === memberId);
      if (emp) {
        approvers.push(emp);
      }
    });

    // Loại bỏ trùng lặp
    const uniqueApprovers = Array.from(new Map(approvers.map(emp => [emp.id, emp])).values());
    return uniqueApprovers;
  }, [hrmEmployees, currentUser]);
  const [showDetailLogsModal, setShowDetailLogsModal] = useState(false);

  // Start Camera
  const startCameraStream = async () => {
    setWebcamActive(true);
    setWebcamError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.warn("Could not start real camera, showing animation scanning fallback instead.", e);
      setWebcamError(true);
    }
  };

  const stopCameraStream = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setWebcamActive(false);
  };

  const handlePunchClick = (slotName: string) => {
    setActivePunchSlot(slotName);
    setShowPunchModal(true);
    startCameraStream();
  };

  // Định vị GPS khi mở hộp chấm công: lấy tọa độ thật + địa chỉ thật (tra cứu ngược bản đồ). Không còn "địa điểm dự kiến"/danh sách công trình
  // cố định (dữ liệu cũ của bản demo); nếu không định vị được thì để TRỐNG và báo lỗi — tuyệt đối không bịa tọa độ/địa chỉ.
  useEffect(() => {
    if (showPunchModal) {
      setGpsLoading(true);
      setGpsErrorMsg('');
      setLiveGpsCoords('');
      setLiveGpsAddr('');

      if (!navigator.geolocation) {
        setGpsErrorMsg('Trình duyệt không hỗ trợ định vị GPS.');
        setGpsLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLiveGpsCoords(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);

          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi`);
            if (res.ok) {
              const resData = await res.json();
              if (resData && resData.display_name) setLiveGpsAddr(resData.display_name);
            }
          } catch (osmErr) {
            console.error('Nominatim call failed:', osmErr);   // không lấy được địa chỉ → để trống, tọa độ vẫn có
          }
          setGpsLoading(false);
        },
        (error) => {
          let errTxt = 'Không thể truy cập GPS.';
          if (error.code === error.PERMISSION_DENIED) {
            errTxt = 'Quyền truy cập GPS bị từ chối.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errTxt = 'Thông tin vị trí không sẵn sàng.';
          } else if (error.code === error.TIMEOUT) {
            errTxt = 'Yêu cầu định vị GPS hết hạn.';
          }
          console.error('GPS Geolocation Error:', error);
          setGpsErrorMsg(errTxt);
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    }
  }, [showPunchModal]);

  const captureSelfieFromStream = (): string => {
    // Chỉ chụp khi camera thật đang chạy VÀ đã có frame (readyState >= 2 = HAVE_CURRENT_DATA).
    // KHÔNG bao giờ trả về ảnh mẫu/ảnh giả — mọi ảnh lưu lên Supabase phải là ảnh
    // người dùng chụp trực tiếp lúc điểm danh.
    if (videoRef.current && cameraStream && videoRef.current.readyState >= 2) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/jpeg', 0.85);
        }
      } catch (e) {
        console.error("Webcam capture error", e);
      }
    }
    return '';
  };

  // Confirm Punching slot
  const handleConfirmPunch = async () => {
    if (!activePunchSlot) return;

    // ─── GUARD 0: Bắt buộc có mã nhân viên hợp lệ ───
    // Không cho ghi bản ghi chấm công "mồ côi" (emp_id rỗng hoặc không có trong bảng
    // employees). Bản ghi như vậy vẫn nằm trên Supabase nhưng bị mọi màn hình nhân sự
    // lọc bỏ → nhìn như mất dữ liệu.
    if (!empId) {
      stopCameraStream();
      setShowPunchModal(false);
      setActivePunchSlot(null);
      addToast({
        title: '⛔ Thiếu mã nhân viên',
        message: 'Tài khoản đang đăng nhập chưa gắn với hồ sơ nhân viên. Vui lòng đăng nhập lại hoặc liên hệ quản trị để cập nhật hồ sơ trước khi chấm công.',
        type: 'error',
      });
      return;
    }

    // Nhãn tiếng Việt cho từng slot điểm danh (hiển thị trong toast)
    const slotLabelMap: Record<string, string> = {
      timeInS: 'VÀO SÁNG',
      timeOutS: 'RA SÁNG',
      timeInC: 'VÀO CHIỀU',
      timeOutC: 'RA CHIỀU',
      timeInOT: 'VÀO TĂNG CA',
      timeOutOT: 'RA TĂNG CA',
    };
    const slotLabel = slotLabelMap[activePunchSlot] || activePunchSlot.toUpperCase();

    // ─── Lấy giờ server từ Supabase RPC (chống gian lận giờ client) ───
    const serverTs = await dbService.fetchServerTimestamp();
    const now = serverTs ? new Date(serverTs.datetime) : new Date();
    const punchedTime = serverTs ? serverTs.time : now.toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' });
    if (serverTs) {
      console.log('[Punch] Dùng giờ server:', serverTs.datetime);
    } else {
      console.warn('[Punch] Fallback giờ client — không lấy được giờ server!');
    }

    // Look for record for current user on 2026-06-06
    const updated = [...attendanceList];
    // QUAN TRỌNG: tìm theo empId + date (KHÔNG dùng empName).
    // Tìm bằng empName dễ trượt (tên lệch chuẩn hóa / state chưa cập nhật) → tạo bản ghi mới
    // có id khác → trùng lặp (2 bản ghi cùng empId + ngày). empId là khóa nghiệp vụ duy nhất.
    let todayLog = updated.find(a => a.empId === empId && a.date === todayVal);

    const selfPhoto = captureSelfieFromStream();

    // ─── GUARD 1: Bản ghi đã bị khóa (đã chốt công) thì không cho chấm nữa ───
    if (todayLog && todayLog.isLocked) {
      stopCameraStream();
      setShowPunchModal(false);
      setActivePunchSlot(null);
      addToast({ title: '🔒 Bản ghi đã chốt', message: 'Bản ghi chấm công ngày hôm nay đã được khóa. Vui lòng liên hệ HR/Admin nếu cần điều chỉnh.', type: 'warning' });
      return;
    }

    // ─── GUARD 2: Chặn re-punch (đã chấm slot này rồi) ───
    const slotAlreadyFilled = todayLog && todayLog[activePunchSlot] !== undefined &&
      todayLog[activePunchSlot] !== '--:--' && todayLog[activePunchSlot] !== '';
    if (slotAlreadyFilled) {
      stopCameraStream();
      setShowPunchModal(false);
      setActivePunchSlot(null);
      addToast({ title: '⚠️ Đã chấm rồi', message: `Bạn đã chấm [${slotLabel}] lúc ${todayLog![activePunchSlot]} rồi. Không thể chấm lại slot này.`, type: 'warning' });
      return;
    }

    // ─── GUARD 3: Kiểm tra khung giờ được phép chấm ───
    const sessionGuardCheck = getSessionInfoWithConfig(activePunchSlot, config);
    const currGuardMin = getCurrentMinute();
    if (!isTimeBetween(currGuardMin, sessionGuardCheck.sessionStartMin, sessionGuardCheck.sessionEndMin)) {
      stopCameraStream();
      setShowPunchModal(false);
      setActivePunchSlot(null);
      addToast({ title: '⛔ Ngoài khung giờ', message: `Không thể chấm [${slotLabel}]. Khung giờ cho phép: ${sessionGuardCheck.sessionStartStr} - ${sessionGuardCheck.sessionEndStr}.`, type: 'warning' });
      return;
    }

    // ─── GUARD 4: Không cho check-out trước khi check-in cùng ca ───
    const isOutSlot = activePunchSlot.toLowerCase().includes('out');
    if (isOutSlot) {
      const inSlot = activePunchSlot.replace('Out', 'In'); // timeOutS→timeInS, timeOutC→timeInC, timeOutOT→timeInOT
      const inFilled = todayLog && todayLog[inSlot] !== undefined &&
        todayLog[inSlot] !== '--:--' && todayLog[inSlot] !== '';
      if (!inFilled) {
        stopCameraStream();
        setShowPunchModal(false);
        setActivePunchSlot(null);
        addToast({ title: '⚠️ Chưa chấm vào ca', message: `Bạn chưa chấm [${slotLabelMap[inSlot] || inSlot.toUpperCase()}] (vào ca). Vui lòng chấm vào ca trước khi chấm ra ca.`, type: 'warning' });
        return;
      }
    }

    // ─── GUARD 5: BẮT BUỘC có ảnh FaceID THẬT (chụp trực tiếp lúc điểm danh) ───
    // Camera lỗi / chưa có frame → KHÔNG ghi nhận lượt chấm. Không bao giờ thay
    // thế bằng ảnh mẫu/ảnh giả (nguồn gốc ảnh "AI sinh ra" trước đây).
    if (!selfPhoto) {
      stopCameraStream();
      setShowPunchModal(false);
      setActivePunchSlot(null);
      addToast({
        title: '📷 Chưa có ảnh FaceID',
        message: 'Camera chưa chụp được ảnh khuôn mặt. Vui lòng cấp quyền truy cập camera, mở lại màn hình chấm công rồi bấm CHỤP ẢNH & CHẤM CÔNG. Mọi lượt chấm công bắt buộc có ảnh chụp trực tiếp lúc điểm danh.',
        type: 'error',
        duration: 8000,
      });
      return;
    }

    if (!todayLog) {
      todayLog = {
        // id XÁC ĐỊNH từ empId + ngày → mọi lần chấm (sáng/chiều) của cùng 1 NV trong ngày
        // đều trúng CÙNG dòng (upsert bởi id). Không còn id ngẫu nhiên → không sinh bản ghi trùng.
        // (dbService.attendance.save cũng chuẩn hóa về đúng id này nên nhất quán đầu cuối.)
        id: `AT-${empId}-${todayVal.replace(/-/g, '')}`,
        empId: empId,
        empName: currentUser.name,
        date: todayVal,
        timeInS: '--:--',
        timeOutS: '--:--',
        timeInC: '--:--',
        timeOutC: '--:--',
        timeInOT: '--:--',
        timeOutOT: '--:--',
        method: 'GPS',
        status: 'valid',
        otHours: 0,
        notes: 'Chấm công qua FaceID & định vị mạng trạm',
        photoIn: '',
        photoOut: '',
        locationIn: '',
        coordsIn: '',
        locationOut: '',
        coordsOut: '',
        punchMeta: {},
        isLocked: false
      };
      updated.unshift(todayLog);
    }

    // Set slot value
    todayLog[activePunchSlot] = punchedTime;
    todayLog.method = 'GPS/FaceID';

    // Đốt giờ chấm + GPS + tên NV vào ảnh selfie để tạo dấu vết audit
    // (chống sửa giờ trong localStorage: ảnh vẫn giữ giờ gốc). Dùng giờ máy chủ nếu có.
    const stampTime = serverTs ? serverTs.time : punchedTime;
    const burnedPhoto = selfPhoto
      ? await burnTimestampToPhoto(selfPhoto, {
          time: stampTime,
          gps: liveGpsCoords,
          empName: currentUser.name,
        })
      : '';

    // Upload ảnh đã đốt giờ lên Storage (bucket attendance-photos, migration 029)
    // rồi lưu public URL vào DB thay vì base64 — giữ bảng attendance_records nhẹ
    // (payload 1 tháng giảm từ MB xuống KB, đỡ nghẽn khi nhiều user mở app).
    // Nếu upload thất bại (offline/mất mạng) → giữ nguyên base64 để outbox đẩy lên sau.
    const storedPhoto = burnedPhoto
      ? ((await dbService.uploadAttendancePhoto(burnedPhoto)) ?? burnedPhoto)
      : '';

    const punchLocation = liveGpsAddr;
    const punchCoords = liveGpsCoords;

    // ─── Ghi ảnh + tọa độ RIÊNG cho lượt chấm này (không ghi đè lượt trước) ───
    // Mỗi ngày có tới 6 lượt: Vào/Ra sáng, Vào/Ra chiều, Vào/Ra tăng ca. Trước đây
    // tất cả lượt "Vào" dùng chung photoIn nên chấm Vào chiều xóa mất ảnh Vào sáng.
    todayLog.punchMeta = mergePunchMeta(todayLog.punchMeta, {
      [activePunchSlot]: {
        photo: storedPhoto,
        location: punchLocation,
        coords: punchCoords,
        at: punchedTime,
      },
    });

    // Vẫn ghi cặp trường CŨ (lượt vào/ra gần nhất) để các màn hình chưa nâng cấp
    // (tab Chấm công bên Nhân sự) tiếp tục hiển thị bình thường.
    const isInSlot = activePunchSlot.toLowerCase().includes('in');
    if (isInSlot) {
      todayLog.photoIn = storedPhoto;
      todayLog.locationIn = punchLocation;
      todayLog.coordsIn = punchCoords;
    } else {
      todayLog.photoOut = storedPhoto;
      todayLog.locationOut = punchLocation;
      todayLog.coordsOut = punchCoords;
    }

    // Check-in status setup
    if (activePunchSlot === 'timeInS') {
      const hh = now.getHours();
      const mm = now.getMinutes();
      const checkInMin = hh * 60 + mm;
      const limitMin = timeToMinutes(config.morningIn || '07:30');
      const allowedLateMorning = config.allowedLateMorning ?? config.allowedLateMinutes ?? 15;
      if (checkInMin > (limitMin + allowedLateMorning)) {
        todayLog.status = 'late';
        // Ghi phút muộn THỰC TẾ (không trừ dung sai) → khớp với badge "Muộn X'" trong chấm công ngày.
        todayLog.notes = `Đi muộn ${checkInMin - limitMin} phút sáng.`;
      } else {
        todayLog.status = 'valid';
        todayLog.notes = 'Chấm công vào sáng chuẩn mực';
      }
    } else if (activePunchSlot === 'timeInC') {
      const hh = now.getHours();
      const mm = now.getMinutes();
      const checkInMin = hh * 60 + mm;
      const limitMin = timeToMinutes(config.afternoonIn || '13:00');
      const allowedLateAfternoon = config.allowedLateAfternoon ?? config.allowedLateMinutes ?? 15;
      if (checkInMin > (limitMin + allowedLateAfternoon)) {
        todayLog.status = 'late';
        // Ghi phút muộn THỰC TẾ (không trừ dung sai) → khớp với badge "Muộn X'" trong chấm công ngày.
        todayLog.notes = `Đi muộn ${checkInMin - limitMin} phút chiều.`;
      } else {
        todayLog.status = 'valid';
        todayLog.notes = 'Chấm công vào chiều chuẩn mực';
      }
    }

    // ─── Tự ghi vi phạm "Đi muộn" (crit_A_3) khi số ngày đi muộn trong tháng vượt ngưỡng ───
    // Chỉ xét khi vừa chấm VÀO ca (timeInS / timeInC) và bản ghi bị flag là đi muộn.
    // Vi phạm ghi 1 bản DUY NHẤT cho mỗi NV-tháng (id deterministic → không nhân đôi dù chấm lại).
    if ((activePunchSlot === 'timeInS' || activePunchSlot === 'timeInC') && todayLog.status === 'late') {
      const allowedLateCount = config.allowedLateCount ?? 3;
      const monthKey = todayVal.substring(0, 7); // "2026-08"

      // Xác định 1 bản ghi có phải "ngày đi muộn" không.
      // Dùng CHUNG getLogAttendanceStats với bộ đếm hiển thị trên dashboard để 2 nơi
      // không lệch nhau (cùng bỏ qua ngày nghỉ tuần/lễ, ngày phép, ca đã duyệt đơn).
      const isLateDay = (log: any): boolean => {
        if (!log) return false;
        if (log.empId !== empId && log.empName !== currentUser.name) return false;
        return getLogAttendanceStats(log).lates > 0;
      };

      // Đếm số ngày đi muộn RIÊNG BIỆT trong tháng hiện tại (1 ngày dù muộn 2 buổi vẫn tính 1 lần)
      const lateDates = new Set<string>();
      [...attendanceList, todayLog].forEach((log: any) => {
        if (log.date && log.date.startsWith(monthKey) && isLateDay(log)) {
          lateDates.add(log.date);
        }
      });
      const lateCountInMonth = lateDates.size;

      // Vượt ngưỡng → ghi vi phạm đi muộn vào Bảng Hiệu suất (hrm_employee_errors)
      if (lateCountInMonth > allowedLateCount) {
        const violationId = `err_late_${empId}_${monthKey}`;
        const violation: any = {
          id: violationId,
          employeeId: empId,
          employeeName: currentUser.name,
          departmentCode: currentUser.department || 'A',
          departmentName: currentUser.department || '',
          criterionId: 'crit_A_3',
          criterionContent: 'Đi muộn không chấp hành giờ giấc làm việc',
          category: 'readiness',
          date: todayVal,
          notes: `Tự động ghi nhận: đi muộn ${lateCountInMonth} lần trong tháng ${monthKey} (ngưỡng cho phép: ${allowedLateCount}). Lần đi muộn gần nhất: ${punchedTime} (${slotLabel}).`,
          images: [],
          autoSource: `auto_late_${monthKey}_${empId}`
        };
        dbService.hrmEmployeeErrors.save(violation).catch(err =>
          console.warn('Ghi vi phạm đi muộn lên Supabase thất bại:', err)
        );
        // Thông báo cho tab Hiệu suất refresh
        try { window.dispatchEvent(new CustomEvent('hl-hrm-employee-errors-updated')); } catch {}
        addToast({
          title: '⚠️ Vi phạm đi muộn',
          message: `Bạn đã đi muộn ${lateCountInMonth} ngày trong tháng ${monthKey} (vượt ngưỡng ${allowedLateCount}). Vi phạm đi muộn đã được ghi vào bảng Hiệu suất.`,
          type: 'warning',
          duration: 5000,
        });
      }
    }

    // Calc OT hours if both OT slots are set
    if (todayLog.timeInOT !== '--:--' && todayLog.timeInOT !== '' && todayLog.timeOutOT !== '--:--' && todayLog.timeOutOT !== '') {
      try {
        const [inH, inM] = todayLog.timeInOT.split(':').map(Number);
        const [outH, outM] = todayLog.timeOutOT.split(':').map(Number);
        let diffMinutes = outH * 60 + outM - (inH * 60 + inM);
        // Xử lý ca đêm: nếu giờ ra < giờ vào (qua nửa đêm), cộng thêm 24h
        if (diffMinutes < 0) diffMinutes += 24 * 60;
        const diffHours = diffMinutes / 60;
        if (diffHours > 0) {
          todayLog.otHours = parseFloat(diffHours.toFixed(1));
        }
      } catch (err) {}
    }

    // Update local state for immediate UI feedback (loại bỏ _serverTime trước khi set state để tránh cache object)
    const { _serverTime, syncPending, ...logForState } = todayLog;
    setAttendanceList(updated.map(l => l.id === todayLog.id ? { ...logForState, syncPending: true } : l));

    // Stop camera and close
    stopCameraStream();
    setShowPunchModal(false);
    setActivePunchSlot(null);

    // ─── Lưu lên Supabase, có Outbox dự phòng khi mất mạng/RLS ───
    // Luôn đưa vào Outbox TRƯỚC khi thử đẩy, để không bao giờ mất dữ liệu chấm công
    // nếu đẩy thất bại. Khi đẩy thành công sẽ xóa khỏi Outbox.
    const opId = `${todayLog.id}:${activePunchSlot}:${Date.now()}`;
    const recordToSave = { ...todayLog, _serverTime: serverTs };
    enqueuePunch({ id: opId, record: recordToSave, punchSlot: activePunchSlot as any, serverTs, queuedAt: Date.now() });
    setPendingSync(outboxPendingCount());

    try {
      await dbService.attendance.save(recordToSave, activePunchSlot as any);
      removePunch(opId);
      setPendingSync(outboxPendingCount());
      addToast({
        title: '✅ Điểm danh thành công',
        message: `Đã ghi nhận [${slotLabel}] lúc ${punchedTime}.`,
        type: 'success',
      });
      // 📣 Nhóm chat "Điểm danh": người chấm ĐẦU TIÊN trong ca kích hoạt Hệ
      // Thống gửi tin nhắc vào nhóm (server-side atomic, chống race + ngày nghỉ).
      maybeSendAttendanceChatMessage({
        date: todayVal,
        slot: activePunchSlot,
        empId,
        empName: currentUser.name,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Lỗi không xác định';
      console.error('Lỗi khi lưu chấm công lên Supabase (đã lưu tạm vào Outbox):', err);
      addToast({
        title: '⏳ Đã lưu tạm',
        message: `Chấm [${slotLabel}] lúc ${punchedTime} chưa đẩy được lên hệ thống (${errMsg}). Đã lưu tạm và sẽ tự động đồng bộ khi có kết nối.`,
        type: 'warning',
        duration: 8000,
      });
    }
  };

  // Submit Leave Request
  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReasonText) {
      alert('Vui lòng nhập lý do xin nghỉ phép!');
      return;
    }

    // Quy định báo trước: số ngày lấy từ Cấu Hình Ca (trước đây viết cứng 2 ngày). Xin muộn → chặn (nếu công ty bật) hoặc cho nộp
    // nhưng đánh dấu "Xin muộn" trong lý do để người duyệt cân nhắc.
    const lateNotice = getLeaveNotice();
    if (lateNotice && config.leaveAdvanceBlock) {
      alert(`⚠️ Không thể nộp đơn nghỉ phép! Phải xin nghỉ phép trước ít nhất ${formatDays(lateNotice.requiredDays)} ngày (tính đến giờ vào ca ngày bắt đầu nghỉ).`);
      return;
    }

    const leaveShift: LeaveShift | undefined = supportsShiftLeave(leaveRequestType) && leaveShiftChoice !== 'full' ? leaveShiftChoice : undefined;
    if (leaveShift && leaveTo !== leaveFrom) {
      alert('⚠️ Nghỉ 1 ca chỉ được chọn trong 1 ngày.');
      return;
    }

    // Constraint: end date must be after or equal to start date
    if (new Date(leaveTo) < new Date(leaveFrom)) {
      alert("⚠️ Đến ngày không thể trước Từ ngày!");
      return;
    }

    // Hết phép năm → chặn tạo đơn "Nghỉ phép năm" (đã trừ số ngày của các đơn phép năm đang chờ duyệt); đơn vượt số phép còn lại cũng bị chặn.
    if (leaveRequestType === 'Nghỉ phép năm') {
      const { remaining, reserved, available } = getAnnualLeaveAvailability();
      if (available <= 0) {
        alert(reserved > 0
          ? `⚠️ Không thể nộp đơn nghỉ phép năm! Số phép năm còn lại (${formatDays(remaining)} ngày) đã được các đơn đang chờ duyệt của bạn dùng hết (${formatDays(reserved)} ngày).`
          : '⚠️ Không thể nộp đơn nghỉ phép năm! Bạn đã dùng hết số phép năm được cấp (còn lại: 0 ngày). Hãy chọn loại nghỉ khác.');
        return;
      }
      if (Number(leaveDays) > available) {
        alert(`⚠️ Không thể nộp đơn! Số ngày xin nghỉ phép năm (${formatDays(Number(leaveDays))} ngày) vượt quá số phép năm còn dùng được (${formatDays(available)} ngày${reserved > 0 ? `, đã trừ ${formatDays(reserved)} ngày của đơn đang chờ duyệt` : ''}).`);
        return;
      }
    }

    // Constraint: Do not allow leave requests on a Sunday
    try {
      const startD = new Date(leaveFrom);
      const endD = new Date(leaveTo);
      let tempD = new Date(startD);
      let hasSunday = false;
      const activeWeekends = config.weekendDays || [0];
      while (tempD <= endD) {
        if (activeWeekends.includes(tempD.getDay())) {
          hasSunday = true;
          break;
        }
        tempD.setDate(tempD.getDate() + 1);
      }
      if (hasSunday) {
        alert("⚠️ Không thể nộp đơn! Không cho phép xin nghỉ phép vào ngày nghỉ tuần của công ty để tránh cộng công sai. Vui lòng chọn lại khoảng thời gian không chứa ngày nghỉ tuần.");
        return;
      }
    } catch (e) {
      console.error(e);
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const submittedAtStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const newRequest = {
      id: generateLeaveId((dashLeaves || []).map((x: any) => x.id)),   // mã không trùng đơn có sẵn (mã cũ 3 số cuối đồng hồ có thể trùng và ghi đè đơn khác)
      empId: empId,
      empName: currentUser.name,
      type: leaveRequestType,
      fromDate: leaveFrom,
      toDate: leaveTo,
      daysCount: leaveShift ? 0.5 : Number(leaveDays),   // nghỉ 1 ca = 0,5 ngày (nghỉ phép năm: trừ 0,5 khi duyệt)
      ...(leaveShift ? { shift: leaveShift } : {}),
      reason: lateNotice ? tagLateNoticeReason(leaveReasonText, lateNotice) : leaveReasonText,
      status: 'pending',
      createdAt: todayVal,
      submittedAt: submittedAtStr,
      approverName: leaveApprover || 'Trương Hữu Long',
      approverId: leaveApproverId || '',
      approverPosition: leaveApproverPosition || ''
    };

    // Lưu lên Supabase (nguồn duy nhất) + cập nhật state
    dbService.hrmLeaves.save(newRequest)
      .then(() => setDashLeaves(prev => [newRequest, ...(prev || [])]))
      .catch(err => {
        console.warn('Push đơn nghỉ phép lên Supabase thất bại:', err);
        setDashLeaves(prev => [newRequest, ...(prev || [])]);
      });

    // 📩 Gửi tin nhắn xét duyệt vào HỘI THOẠI CÁ NHÂN (nhân viên → người duyệt)
    const approverEmp = hrmEmployees.find((e: any) => e.id === newRequest.approverId) || findEmployeeByName(hrmEmployees, newRequest.approverName);
    if (empId && approverEmp?.id && empId !== approverEmp.id) {
      sendApprovalDirectMessage({
        senderId: empId,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        recipientId: approverEmp.id,
        recipientName: approverEmp.name || newRequest.approverName,
        content: MT.canDuyetNghiPhep({ type: newRequest.type, shift: leaveShift || undefined, fromDate: newRequest.fromDate, toDate: newRequest.toDate, daysCount: newRequest.daysCount, reason: newRequest.reason }),
        relatedEntity: { type: 'leave', id: newRequest.id },
      });
    }

    setLeaveReasonText('');
    setLeaveShiftChoice('full');
    setLeaveModalOpen(false);
    alert(`📬 Đơn xin nghỉ phép đã được nộp sang HỆ THỐNG NHÂN SỰ thành công!\nNgười duyệt: ${(leaveApprover || 'Trương Hữu Long')}${leaveApproverPosition ? ` (${leaveApproverPosition})` : ''}\nTrạng thái: Đang chờ duyệt.${lateNotice ? '\n⚠️ Đơn được đánh dấu "XIN MUỘN" (chưa đủ thời gian báo trước) để người duyệt cân nhắc.' : ''}`);
  };

  // Submit attendance correction report
  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason) {
      alert("Vui lòng nhập lý do giải trình cụ thể!");
      return;
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const submittedAtStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    // Người xét duyệt: nếu là "Lỗi hệ thống chấm công" thì dùng người duyệt
    // Đơn Xin Nghỉ Phép (cấu hình Phân Quyền → Quyền Phê Duyệt), không cho sửa.
    const configuredLeaveApprover = getConfiguredApprover('leave');
    const useLockedApprover = isAttendanceReportType(reportType);
    const finalApproverName = (useLockedApprover && configuredLeaveApprover)
      ? configuredLeaveApprover.name
      : (reportApprover || 'Trương Hữu Long');
    const finalApproverId = (useLockedApprover && configuredLeaveApprover)
      ? (configuredLeaveApprover.id || '')
      : '';
    const finalApproverPosition = (useLockedApprover && configuredLeaveApprover)
      ? (configuredLeaveApprover.position || '')
      : '';

    // Gửi cho CẢ NGÀY: chỉ khi loại là "Báo cáo nghỉ ca", người dùng để bật lựa chọn và thật sự cả 2 ca đều vắng (xem wholeDayEligible).
    // Dữ liệu vẫn là 2 đơn (mỗi ca 1 đơn) để luồng tính công không đổi; người duyệt thấy và duyệt như 1 đơn "Cả ngày".
    const isWholeDay = reportType === 'Báo cáo nghỉ ca' && reportWholeDay && wholeDayEligible();
    const shiftsToSend: ('morning' | 'afternoon')[] = isWholeDay ? ['morning', 'afternoon'] : [reportShift as 'morning' | 'afternoon'];
    // Mã đơn chọn KHÔNG TRÙNG mã có sẵn (mã cũ chỉ 3 số cuối của đồng hồ → có thể trùng và ghi đè đơn khác)
    const usedLeaveIds = new Set<string>((dashLeaves || []).map((x: any) => x.id));
    const newRequests = shiftsToSend.map(sh => {
      const id = generateLeaveId(usedLeaveIds);
      usedLeaveIds.add(id);
      const statusText = isWholeDay
        ? `Vắng mặt / Không điểm danh (${sh === 'morning' ? 'Ca Sáng' : 'Ca Chiều'})`
        : reportStatusText;
      return {
        id,
        empId: empId,
        empName: currentUser.name,
        type: reportType || 'Báo cáo nghỉ ca',
        shift: sh,
        fromDate: selectedDayDetail!.date,
        toDate: selectedDayDetail!.date,
        daysCount: 1,
        reason: `[${statusText}] - Lý do: ${reportReason}`,
        status: 'pending',
        createdAt: todayVal,
        submittedAt: submittedAtStr,
        approverName: finalApproverName,
        approverId: finalApproverId,
        approverPosition: finalApproverPosition,
        isAttendanceCorrection: true
      };
    });
    const newRequest = newRequests[0];

    // Lưu lên Supabase (nguồn duy nhất) + cập nhật state
    newRequests.forEach(req => {
      dbService.hrmLeaves.save(req)
        .then(() => setDashLeaves(prev => [req, ...(prev || [])]))
        .catch(err => {
          console.warn('Push báo cáo nghỉ ca lên Supabase thất bại:', err);
          setDashLeaves(prev => [req, ...(prev || [])]);
        });
    });

    // 📩 Gửi tin nhắn xét duyệt vào HỘI THOẠI CÁ NHÂN (nhân viên → người duyệt) — 1 tin cho cả cặp
    const approverEmp = hrmEmployees.find((e: any) => e.id === finalApproverId) || findEmployeeByName(hrmEmployees, finalApproverName);
    if (empId && approverEmp?.id && empId !== approverEmp.id) {
      sendApprovalDirectMessage({
        senderId: empId,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        recipientId: approverEmp.id,
        recipientName: approverEmp.name || finalApproverName,
        content: MT.canDuyetChamCong({ type: newRequest.type, wholeDay: isWholeDay, shift: newRequest.shift, date: newRequest.fromDate, reason: newRequest.reason }),
        relatedEntity: { type: 'leave', id: newRequest.id },
      });
    }

    setShowReportForm(false);
    setReportReason('');
    setReportShift('');
    setReportType('');
    alert(`${isWholeDay ? 'Báo cáo CẢ NGÀY (ca sáng + ca chiều)' : 'Báo cáo'} đã được gửi tới ${finalApproverName}, trạng thái: Chờ duyệt`);
  };

  // Submit Salary Advance
  const handleAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceAmountVal) {
      alert('Vui lòng nhập số tiền đề xuất ứng trước!');
      return;
    }
    const amount = Number(advanceAmountVal);
    if (isNaN(amount) || amount <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ lớn hơn 0!');
      return;
    }

    // Validation: Kiểm tra người xét duyệt đã chọn chưa
    // Nếu có người duyệt được cấu hình trong Quyền Phê Duyệt, ưu tiên dùng người đó
    const configuredApprover = getConfiguredApprover('salary_advance');
    let finalApproverId = advanceApproverId || configuredApprover?.id || '';
    let finalApproverName = '';

    if (configuredApprover) {
      finalApproverName = configuredApprover.name;
      // Cập nhật state để dùng trong proposal
      setAdvanceApproverId(configuredApprover.id);
    } else if (advanceApproverId) {
      const approver = hrmEmployees.find(emp => emp.id === advanceApproverId);
      if (!approver) {
        alert('Người xét duyệt không hợp lệ!');
        return;
      }
      finalApproverName = approver.name;
    } else {
      alert('Vui lòng chọn người xét duyệt!');
      return;
    }

    // RÀ SOÁT 2026-09: trước đây bước này ghi thẳng vào bảng lương (hrmPayrollRecords)
    // NGAY KHI ĐỀ XUẤT ĐƯỢC GỬI — trong khi đề xuất vẫn ở trạng thái 'pending_approval',
    // chưa hề được duyệt. Khi đề xuất sau đó được duyệt và lập Phiếu Chi Ứng Lương,
    // updatePayrollWithAdvance() ở FinanceManagement.tsx (handleAddPaymentSubmitInner,
    // nhánh payCategory==='salary_advance') CỘNG DỒN tiếp vào payrollItem.advances —
    // khiến khoản ứng lương bị trừ 2 LẦN vào lương thực nhận (1 lần lúc gửi đề xuất,
    // 1 lần lúc thực sự chi tiền). Bảng lương chỉ nên được cập nhật đúng 1 lần, tại
    // thời điểm Phiếu Chi thực sự được lập (tiền đã chi) — không phải lúc mới đề xuất.

    // Tạo Đề Xuất Tạm Ứng Lương (SubcontractorAdvanceProposal) - Gửi sang Đề Xuất Thu Chi
    // Loại: project_expense_proposal (đề xuất chi phí dự án - ứng lương nhân sự)
    const proposalId = `DX-${todayVal.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const approvals = undefined;

    const newProposal: SubcontractorAdvanceProposal = {
      id: proposalId,
      subcontractorId: empId,
      subcontractorName: currentUser.name,
      // projectId/taskId: KHÔNG gán '' — 2 cột này có khóa ngoại tới projects(id)/tasks(id),
      // '' không khớp bản ghi nào nên bị Postgres từ chối (foreign key violation).
      // Phải để undefined (NULL) khi ứng lương không gắn dự án/công việc cụ thể.
      projectName: 'Ứng Lương Nhân Sự',
      taskName: `Ứng lương kỳ ${advancePeriod}`,
      amount: amount,
      reason: `Ứng lương kỳ ${advancePeriod}. Lý do: ${advanceReasonText || 'Chi tiêu cá nhân'}`,
      approver: finalApproverId, // ID người xét duyệt (từ cấu hình hoặc người dùng chọn)
      creator: currentUser.id,
      creatorName: currentUser.name,
      approverName: finalApproverName,
      status: 'pending_approval', // Chờ duyệt
      date: todayVal,
      proposalDate: todayVal,
      type: 'project_expense_proposal', // Loại: đề xuất chi phí dự án
      approvals, // Chuỗi duyệt nhiều cấp từ matrix
    };

    try {
      // Lưu lên Supabase (nguồn duy nhất)
      await dbService.subcontractorAdvances.save(newProposal);

      // Trigger custom event để các component khác (FinanceManagement) cập nhật
      window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated', { detail: newProposal }));

      // 📩 Gửi tin nhắn xét duyệt vào HỘI THOẠI CÁ NHÂN (người lập → người duyệt)
      const approverEmp = hrmEmployees.find((e: any) => e.id === finalApproverId) || findEmployeeByName(hrmEmployees, finalApproverName);
      if (empId && approverEmp?.id && empId !== approverEmp.id) {
        sendApprovalDirectMessage({
          senderId: empId,
          senderName: currentUser.name,
          senderRole: currentUser.role,
          recipientId: approverEmp.id,
          recipientName: approverEmp.name || finalApproverName,
          content: MT.canDuyetTamUngLuong({ code: proposalId, amount, reason: newProposal.reason }),
          relatedEntity: { type: 'advance', id: proposalId },
        });
      }
    } catch (err) {
      console.error('Lỗi khi lưu đề xuất tạm ứng lương:', err);
      alert('❌ Có lỗi xảy ra khi gửi đề xuất. Vui lòng thử lại!');
      return;
    }

    setAdvanceAmountVal('');
    setAdvanceReasonText('');
    setAdvanceApproverId('');
    setAdvanceModalOpen(false);

    alert(`💰 Đã gửi Đề Xuất Tạm Ứng Lương thành công!\nMã đề xuất: ${proposalId}\nSố tiền: ${amount.toLocaleString('vi-VN')} đ\nNgười xét duyệt: ${finalApproverName}\nTrạng thái: Chờ duyệt\n\nNgười xét duyệt sẽ thấy đề xuất trong "Đề Xuất Chi" và thực hiện duyệt để tạo Phiếu Chi Ứng Lương.`);
  };

  // Calc aggregated values for current employee
  // Lọc theo empId (khóa nghiệp vụ duy nhất), chỉ fallback sang empName cho bản ghi
  // cũ chưa có empId. Lọc thuần theo tên dễ trượt khi tên lệch chuẩn hóa (dấu cách
  // thừa, viết hoa/thường khác) → bảng thống kê hiện 0 dù vẫn có dữ liệu chấm công.
  const currentLogs = attendanceList.filter(a =>
    a.empId ? a.empId === empId : a.empName === currentUser.name
  );

  const dashWeekendDays = config.weekendDays || [0];

  // Filter logs strictly inside the current month of todayVal (e.g. "2026-06")
  const currentMonthYear = todayVal.substring(0, 7);
  const logsInMonth = currentLogs.filter(a => a.date && a.date.startsWith(currentMonthYear));

  // Map each log to its computed workday value and sum them up
  const countAccumulatedDays = Math.max(0, logsInMonth.reduce((sum, log) => {
    const res = computeDailyWorkday(log, dashCoefficients, dashHolidays, dashWeekendDays, dashLeaves);
    return sum + res.workday;
  }, 0));

  const countOvertimeHours = logsInMonth.reduce((sum, curr) => sum + (curr.otHours || 0), 0);
  const countOvertimeTimes = logsInMonth.filter(log => (log.otHours || 0) > 0).length;
  // Đi muộn / về sớm trong tháng: đếm theo LƯỢT (mỗi ca vi phạm là 1 lượt),
  // tách riêng 2 loại để hiển thị chi tiết thay vì gộp thành 1 con số khó hiểu.
  const monthLateEarly = logsInMonth.reduce(
    (acc, log) => {
      const stats = getLogAttendanceStats(log);
      acc.lates += stats.lates;
      acc.earlies += stats.earlies;
      if (stats.lates > 0) acc.lateDays.add(log.date);
      if (stats.earlies > 0) acc.earlyDays.add(log.date);
      return acc;
    },
    { lates: 0, earlies: 0, lateDays: new Set<string>(), earlyDays: new Set<string>() }
  );
  const countLateArrive = monthLateEarly.lates + monthLateEarly.earlies;

  // Real salary multiplier
  // Get current today slots
  // QUAN TRỌNG: tìm theo empId (không dùng empName) để đồng bộ với logic chấm công
  // (handleConfirmPunch) và currentLogs ở trên. Tìm theo tên dễ trượt nếu tên lệch
  // chuẩn hóa → dòng "Hôm nay" hiển thị rỗng dù bản ghi thực sự tồn tại.
  const userTodayLog = attendanceList.find(a =>
    (a.empId ? a.empId === empId : a.empName === currentUser.name) && a.date === todayVal
  ) || {
    timeInS: '--:--', timeOutS: '--:--', timeInC: '--:--', timeOutC: '--:--', timeInOT: '--:--', timeOutOT: '--:--'
  };

  /**
   * Xác định 1 ca ĐÃ được chấm (local) chưa — kể cả khi CSDL chưa cập nhật kịp
   * (lượt chấm đang nằm trong outbox chờ đồng bộ). Dùng để nút điểm danh KHÔNG
   * hiện lại "VÀO/RA" gây hiểu nhầm "mình chưa điểm danh" trong lúc 25 user ồ ạt
   * chấm và reload định kỳ (mỗi 2 phút) chưa kịp lấy dữ liệu mới từ server.
   *
   * Nguồn tra cứu (theo thứ tự ưu tiên):
   *   1. State local (đã cập nhật ngay khi bấm) — có giờ chính xác.
   *   2. Outbox (lượt đã bấm nhưng đang chờ đẩy lên DB) — có giờ đã chấm.
   * → Tái dùng chính outbox làm "cờ đã điểm danh ca đó" lưu local, không cần
   *   cấu trúc riêng. Trả về giờ chấm nếu đã chấm, ngược lại null.
   */
  const getLocalPunch = (slot: string): string | null => {
    const localVal = userTodayLog[slot];
    if (localVal && localVal !== '--:--' && localVal !== '') return localVal;
    try {
      const pending = getPendingPunches();
      const op = pending.find(
        o => o.record && o.record.empId === empId && o.record.date === todayVal && o.punchSlot === slot
      );
      if (op?.record?.[slot] && op.record[slot] !== '--:--' && op.record[slot] !== '') {
        return op.record[slot];
      }
    } catch { /* ignore */ }
    return null;
  };

  const isTimeBetween = (curr: number, start: number, end: number) => {
    if (start <= end) {
      return curr >= start && curr <= end;
    } else {
      // Crosses midnight
      return curr >= start || curr <= end;
    }
  };

  const getSessionInfo = (slot: string, cfg: any = config) => {
    let targetTimeStr = '07:30';
    let checkInSlot = '';
    let beforeMin = cfg.punchOpenBeforeMinutes !== undefined ? Number(cfg.punchOpenBeforeMinutes) : 30;
    let afterMin = cfg.punchCloseAfterMinutes !== undefined ? Number(cfg.punchCloseAfterMinutes) : 30;

    if (slot === 'timeInS') {
      targetTimeStr = cfg.morningIn || '07:30';
    } else if (slot === 'timeOutS') {
      targetTimeStr = cfg.morningOut || '11:30';
      checkInSlot = 'timeInS';
      beforeMin = cfg.punchOutOpenBeforeMinutes !== undefined ? Number(cfg.punchOutOpenBeforeMinutes) : 30;
      afterMin = cfg.punchOutCloseAfterMinutes !== undefined ? Number(cfg.punchOutCloseAfterMinutes) : 30;
    } else if (slot === 'timeInC') {
      targetTimeStr = cfg.afternoonIn || '13:00';
    } else if (slot === 'timeOutC') {
      targetTimeStr = cfg.afternoonOut || '17:00';
      checkInSlot = 'timeInC';
      beforeMin = cfg.punchOutOpenBeforeMinutes !== undefined ? Number(cfg.punchOutOpenBeforeMinutes) : 30;
      afterMin = cfg.punchOutCloseAfterMinutes !== undefined ? Number(cfg.punchOutCloseAfterMinutes) : 30;
    } else if (slot === 'timeInOT') {
      targetTimeStr = cfg.overtimeIn || '17:45';
      beforeMin = cfg.otPunchOpenBeforeMinutes !== undefined ? Number(cfg.otPunchOpenBeforeMinutes) : 30;
      afterMin = cfg.otPunchCloseAfterMinutes !== undefined ? Number(cfg.otPunchCloseAfterMinutes) : 30;
    } else if (slot === 'timeOutOT') {
      targetTimeStr = cfg.overtimeOut || '20:45';
      checkInSlot = 'timeInOT';
      beforeMin = cfg.otPunchOutOpenBeforeMinutes !== undefined ? Number(cfg.otPunchOutOpenBeforeMinutes) : 30;
      afterMin = cfg.otPunchOutCloseAfterMinutes !== undefined ? Number(cfg.otPunchOutCloseAfterMinutes) : 30;
    }

    const targetMin = timeToMinutes(targetTimeStr);
    const sessionStartMin = targetMin - beforeMin;
    const sessionEndMin = targetMin + afterMin;

    const formatMinutes = (m: number) => {
      const totalMin = (m + 1440) % 1440;
      const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
      const mm = String(totalMin % 60).padStart(2, '0');
      return `${hh}:${mm}`;
    };

    return {
      sessionStartMin,
      sessionEndMin,
      sessionStartStr: formatMinutes(sessionStartMin),
      sessionEndStr: formatMinutes(sessionEndMin),
      checkInSlot,
      isCheckIn: checkInSlot === '',
      targetTimeStr,
      formatMinutes,
    };
  };

  // Alias with explicit config param for guards (chống state lệch)
  const getSessionInfoWithConfig = (slot: string, cfg: any) => getSessionInfo(slot, cfg);

  const isSlotActive = (slot: string) => {
    const currMin = getCurrentMinute();

    const s = getSessionInfo(slot);
    const isBetween = isTimeBetween(currMin, s.sessionStartMin, s.sessionEndMin);

    if (!isBetween) return false;

    if (s.isCheckIn) return true;

    // For checkout slots: time window must be open AND check-in must be completed
    const checkInVal = userTodayLog[s.checkInSlot];
    const checkInCompleted = checkInVal !== '--:--' && checkInVal !== '' && checkInVal !== undefined;

    return checkInCompleted;
  };

  const isShiftActive = (shift: 'morning' | 'afternoon' | 'overtime') => {
    // 1. If any slot for this shift is active via isSlotActive, it is active
    if (shift === 'morning' && (isSlotActive('timeInS') || isSlotActive('timeOutS'))) return true;
    if (shift === 'afternoon' && (isSlotActive('timeInC') || isSlotActive('timeOutC'))) return true;
    if (shift === 'overtime' && (isSlotActive('timeInOT') || isSlotActive('timeOutOT'))) return true;

    // 2. Or if current time is within the shift's actual work hours
    const currMin = getCurrentMinute();

    if (shift === 'morning') {
      const startMin = timeToMinutes(config.morningIn || '07:30');
      const endMin = timeToMinutes(config.morningOut || '11:30');
      return currMin >= startMin && currMin <= endMin;
    } else if (shift === 'afternoon') {
      const startMin = timeToMinutes(config.afternoonIn || '13:00');
      const endMin = timeToMinutes(config.afternoonOut || '17:00');
      return currMin >= startMin && currMin <= endMin;
    } else {
      const startMin = timeToMinutes(config.overtimeIn || '17:45');
      const endMin = timeToMinutes(config.overtimeOut || '20:45');
      return currMin >= startMin && currMin <= endMin;
    }
  };

  const isShiftEnded30Min = (shift: 'morning' | 'afternoon') => {
    if (!selectedDayDetail) return false;
    if (selectedDayDetail.date < todayVal) return true;
    if (selectedDayDetail.date > todayVal) return false;

    // Same day, check clock
    const currMin = getCurrentMinute();
    
    if (shift === 'morning') {
      const endMin = timeToMinutes(config.morningOut || '11:30');
      return currMin >= endMin + 30;
    } else {
      const endMin = timeToMinutes(config.afternoonOut || '17:00');
      return currMin >= endMin + 30;
    }
  };

  /**
   * Tìm đơn giải trình chấm công của CHÍNH người đang đăng nhập cho 1 ngày + 1 ca.
   *
   * ⚠️ Trước đây hàm này KHÔNG lọc theo nhân viên → đơn của đồng nghiệp khác trùng
   * ngày/ca cũng bị coi là đơn của mình, khiến nút "Báo cáo lý do" biến mất và hiện
   * nhầm trạng thái "Đã duyệt". Nay lọc theo empId (fallback empName cho bản ghi cũ).
   */
  const getSubReport = (date: string, shift: 'morning' | 'afternoon') => {
    return (dashLeaves || []).find((l: any) => {
      if (l.fromDate !== date || l.shift !== shift) return false;
      if (!isAttendanceReportType(l.type)) return false;
      return l.empId ? l.empId === empId : l.empName === currentUser.name;
    });
  };

  /**
   * Phát hiện LỖI CHẤM CÔNG của 1 ngày để hiện cảnh báo trên lịch tháng.
   *
   * Coi là lỗi khi:
   *   - "missing": cả ca không có lịch sử check-in nào (vắng mặt không rõ lý do)
   *   - "faulty" : có chấm vào ca nhưng THIẾU chấm ra ca
   *
   * KHÔNG coi là lỗi (nên không cảnh báo):
   *   - Ngày nghỉ tuần / nghỉ lễ, ngày trong tương lai
   *   - Ca chưa kết thúc (hôm nay, ca chiều lúc 9h sáng thì chưa thể gọi là lỗi)
   *   - Ngày nghỉ phép đã duyệt / bản ghi mang ký hiệu nghỉ / đã chốt công
   *   - Ca ĐÃ GỬI báo cáo giải trình thành công (chờ duyệt hoặc đã duyệt)
   *     → đúng yêu cầu "báo cáo thành công thì không hiển thị cảnh báo nữa".
   *     Đơn bị TỪ CHỐI thì cảnh báo hiện lại để nhân viên báo cáo lần nữa.
   */
  const getDayAttendanceIssues = (dateStr: string, log: any) => {
    const issues: { shift: 'morning' | 'afternoon'; kind: 'missing' | 'faulty'; label: string }[] = [];
    if (!dateStr || dateStr > todayVal) return issues;
    if (isCalendarRestDay(dateStr)) return issues;
    if (log?.isLocked) return issues;

    // Ngày TRƯỚC khi nhân viên vào làm thì không thể có chấm công → không cảnh báo.
    // (Chỉ áp dụng khi hồ sơ lưu ngày vào làm đúng chuẩn YYYY-MM-DD.)
    const startDate = getCurrentEmployeeProfile()?.startDate;
    if (typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate) && dateStr < startDate) {
      return issues;
    }

    // Bản ghi mang ký hiệu nghỉ / được miễn → không phải lỗi chấm công
    if (log) {
      const symbol = normalizeTime(log.timeInS);
      if (LEAVE_SYMBOLS.includes(symbol)) return issues;
      if (log.status === 'excused') return issues;
      if (log.notes?.toLowerCase().includes('nghỉ') || log.notes?.toLowerCase().includes('off')) return issues;
    }

    // Ca đã kết thúc chưa? (ngày quá khứ thì luôn rồi)
    const shiftEnded = (shift: 'morning' | 'afternoon'): boolean => {
      if (dateStr < todayVal) return true;
      const endMin = timeToMinutes(
        shift === 'morning' ? (config.morningOut || '11:30') : (config.afternoonOut || '17:00')
      );
      // Cộng thêm cửa sổ cho phép chấm ra muộn để không báo lỗi khi ca vừa kết thúc
      return getCurrentMinute() >= endMin + (config.punchOutCloseAfterMinutes ?? 15);
    };

    const excused = getExcusedShifts({ ...(log || {}), date: dateStr, empId, empName: currentUser.name });

    const shifts: { shift: 'morning' | 'afternoon'; inKey: string; outKey: string; name: string }[] = [
      { shift: 'morning',   inKey: 'timeInS', outKey: 'timeOutS', name: 'Ca Sáng' },
      { shift: 'afternoon', inKey: 'timeInC', outKey: 'timeOutC', name: 'Ca Chiều' },
    ];

    for (const s of shifts) {
      if (!shiftEnded(s.shift)) continue;
      if (excused[s.shift]) continue;

      const hasIn = parsePunchMinutes(log?.[s.inKey]) !== null;
      const hasOut = parsePunchMinutes(log?.[s.outKey]) !== null;
      if (hasIn && hasOut) continue;

      // Đã gửi báo cáo thành công (chờ duyệt / đã duyệt) → coi như đã xử lý
      const report = getSubReport(dateStr, s.shift);
      if (report && (report.status === 'pending' || report.status === 'approved')) continue;

      if (hasIn && !hasOut) {
        issues.push({ shift: s.shift, kind: 'faulty', label: `${s.name}: thiếu chấm RA ca` });
      } else {
        issues.push({ shift: s.shift, kind: 'missing', label: `${s.name}: không có lịch sử check-in` });
      }
    }

    return issues;
  };

  const renderReportButtonAndStatus = (shift: 'morning' | 'afternoon', isFaulty: boolean, isMissing: boolean) => {
    if (!selectedDayDetail) return null;
    const subReport = getSubReport(selectedDayDetail.date, shift);
    // Ngày đã chốt công: ẩn toàn bộ nếu KHÔNG có báo cáo liên quan. Nếu có báo cáo
    // (đã duyệt/từ chối), vẫn hiển thị trạng thái để quản lý thấy rõ — không cho
    // gửi hay "báo cáo lại" khi ngày đã khóa.
    if (selectedDayDetail.log.isLocked && !subReport) return null;
    if (selectedDayDetail.log.timeInS === 'OFF' && !subReport) return null;

    const category: 'faulty' | 'missing' = isFaulty ? 'faulty' : 'missing';
    const statusLabel = isFaulty
      ? `Thiếu điểm danh ra ca (${shift === 'morning' ? 'Ca Sáng' : 'Ca Chiều'})`
      : `Vắng mặt / Không điểm danh (${shift === 'morning' ? 'Ca Sáng' : 'Ca Chiều'})`;


    if (subReport) {
      if (subReport.status === 'pending') {
        return (
          <span className="inline-flex bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider">
            ⏳ Chờ duyệt
          </span>
        );
      } else if (subReport.status === 'approved') {
        return (
          <span className="inline-flex bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider">
            ✅ Đã duyệt
          </span>
        );
      } else if (subReport.status === 'rejected') {
        return (
          <div className="flex flex-col sm:flex-row items-center gap-1.5 shrink-0 mt-1">
            <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
              ❌ Bị từ chối
            </span>
            {selectedDayDetail.log.isLocked ? null : (
              isShiftEnded30Min(shift) ? (
                <button
                  type="button"
                  onClick={() => handleTriggerReport(shift, category, statusLabel)}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[9px] font-black cursor-pointer ml-1"
                >
                  🔄 Báo cáo lại
                </button>
              ) : (
                <span className="text-[8px] text-slate-500 italic block mt-0.5">🔒 Đợi ca kết thúc 30p</span>
              )
            )}
          </div>
        );
      }
    }

    const ended30Min = isShiftEnded30Min(shift);
    if (ended30Min) {
      return (
        <button
          type="button"
          onClick={() => handleTriggerReport(shift, category, statusLabel)}
          className="bg-amber-600 hover:bg-amber-500 hover:text-white px-2.5 py-1 rounded transition-all active:scale-95 cursor-pointer flex items-center gap-1 text-[10px] font-black text-white"
        >
          📝 Báo cáo lý do
        </button>
      );
    } else {
      return (
        <span className="text-[9px] text-slate-500 bg-slate-950/40 px-2 py-1.5 rounded border border-slate-850 italic text-center">
          🔒 Đợi ca kết thúc 30p để báo cáo
        </span>
      );
    }
  };
  
  // Có thể báo cáo CẢ NGÀY không? — khi cả 2 ca của ngày đang xem đều "vắng/không có lịch sử check-in" (missing), cả 2 ca đã kết thúc đủ
  // 30 phút, và chưa ca nào có báo cáo chờ duyệt/đã duyệt (getDayAttendanceIssues đã loại các ca đó). Ca nào lỗi chấm RA (faulty) thì không gộp.
  const wholeDayEligible = (): boolean => {
    if (!selectedDayDetail) return false;
    const issues = getDayAttendanceIssues(selectedDayDetail.date, selectedDayDetail.log);
    const missing = (sh: 'morning' | 'afternoon') => issues.some(i => i.shift === sh && i.kind === 'missing');
    return missing('morning') && missing('afternoon') && isShiftEnded30Min('morning') && isShiftEnded30Min('afternoon');
  };

  // Ô chọn "báo cáo cả ngày" — hiện ở form Báo cáo nghỉ ca khi đủ điều kiện (dùng chung cho form ca sáng và ca chiều)
  const renderWholeDayOption = () => {
    if (reportType !== 'Báo cáo nghỉ ca' || reportCategory !== 'missing' || !wholeDayEligible()) return null;
    return (
      <label className="flex items-start gap-2 bg-slate-950 border border-slate-800 rounded px-2.5 py-2 cursor-pointer">
        <input type="checkbox" checked={reportWholeDay} onChange={(e) => setReportWholeDay(e.target.checked)} className="mt-0.5 cursor-pointer" />
        <span className="text-[10.5px] text-slate-300 leading-snug">
          <strong className="text-sky-400">Báo cáo cho CẢ NGÀY</strong> (ca sáng + ca chiều) — chỉ cần gửi 1 lần, người duyệt xem và duyệt như 1 đơn.
        </span>
      </label>
    );
  };

  const handleTriggerReport = (shift: 'morning' | 'afternoon', category: 'faulty' | 'missing', currentStatusText: string) => {
    setReportShift(shift);
    setReportCategory(category);
    setReportWholeDay(true);
    // Loại mặc định: lỗi chấm ra ca (faulty) hoặc nghỉ ca (missing).
    // Với ca missing, người dùng có thể đổi sang "Báo cáo lỗi hệ thống chấm công" trong form.
    setReportType(category === 'faulty' ? 'Báo cáo lỗi chấm ra ca' : 'Báo cáo nghỉ ca');
    setReportStatusText(currentStatusText);
    if (!reportApprover) {
      const approvers = getApproversList();
      if (approvers.length > 0) {
        setReportApprover(approvers[0].name);
      }
    }
    setReportReason('');
    setShowReportForm(true);
  };


  // Mở hộp "Xin nghỉ phép" (chọn sẵn người duyệt theo cấu hình) — dùng chung cho nút cũ và nút ở màn Tổng quan kiểu mới
  const openLeaveModal = () => {
    const configuredApprover = getConfiguredApprover('leave');
    if (configuredApprover) {
      setLeaveApprover(configuredApprover.name);
      setLeaveApproverId(configuredApprover.id);
      setLeaveApproverPosition(configuredApprover.position || '');
    } else {
      setLeaveApprover('Trương Hữu Long');
      setLeaveApproverId(findUniqueEmployeeByName(hrmEmployees as any[], 'Trương Hữu Long')?.id || '');   // mặc định cũ: có mã thì chọn theo mã
      setLeaveApproverPosition('');
    }
    setLeaveModalOpen(true);
  };

  // ─── DỮ LIỆU CHO MÀN TỔNG QUAN KIỂU MỚI (OverviewHome; công thức ở lib/overviewData.ts) ───
  const [showDetail, setShowDetail] = useState(false);           // lịch tháng & chi tiết chấm công (khối cũ) — thu gọn mặc định
  const [violationList, setViolationList] = useState<any[]>([]);
  const [advanceList, setAdvanceList] = useState<any[]>([]);
  const [companyLogs, setCompanyLogs] = useState<any[]>([]);
  const [projectNew, setProjectNew] = useState<Record<string, number>>({});

  // Vi phạm (Bảng Hiệu suất) và đề xuất tạm ứng lương của tôi: tải lúc mở, tải lại khi có thay đổi
  useEffect(() => {
    const loadViolations = () => dbService.hrmEmployeeErrors.list().then(l => { if (Array.isArray(l)) setViolationList(l); }).catch(() => {});
    const loadAdvances = () => dbService.subcontractorAdvances.list().then(l => { if (Array.isArray(l)) setAdvanceList(l); }).catch(() => {});
    loadViolations(); loadAdvances();
    window.addEventListener('hl-hrm-employee-errors-updated', loadViolations);
    window.addEventListener('hl-subcontractor-advances-updated', loadAdvances);
    return () => { window.removeEventListener('hl-hrm-employee-errors-updated', loadViolations); window.removeEventListener('hl-subcontractor-advances-updated', loadAdvances); };
  }, []);

  // Giám đốc: chấm công của TOÀN công ty hôm nay (cho khối "Toàn công ty hôm nay"), làm mới mỗi phút
  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    const load = () => dbService.attendance.listForRange(todayVal, todayVal).then(l => { if (alive && Array.isArray(l)) setCompanyLogs(l.map(normalizeRecord)); }).catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    return () => { alive = false; clearInterval(timer); };
  }, [isAdmin, todayVal]);

  const taskSum = summarizeTasks(tasks as any[], empId, todayVal);
  const myProjList = myProjects(projects as any[], tasks as any[], empId, 3);
  const myProjKey = myProjList.map(p => p.id).join(',');
  // Số hoạt động mới trong Nhật ký của từng dự án (cùng nguồn với chấm đỏ ở Tin nhắn)
  useEffect(() => {
    if (!empId || !myProjKey) { setProjectNew({}); return; }
    let alive = true;
    loadUnreadSummary(empId, myProjKey.split(',')).then(r => { if (alive) setProjectNew(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.count]))); }).catch(() => {});
    return () => { alive = false; };
  }, [empId, myProjKey]);

  const overviewData: OverviewHomeData = (() => {
    const hmOf = (v: any) => { const t = normalizeTime(v); return hasTime(t) ? t : ''; };
    const slotsOf = { morning: ['timeInS', 'timeOutS'], afternoon: ['timeInC', 'timeOutC'], overtime: ['timeInOT', 'timeOutOT'] } as const;
    const views: ShiftView[] = (['morning', 'afternoon', 'overtime'] as const).map(key => {
      const [sIn, sOut] = slotsOf[key];
      const inInfo = getSessionInfo(sIn), outInfo = getSessionInfo(sOut);
      return computeShiftView({
        key, inSlot: sIn, outSlot: sOut,
        inTime: hmOf(getLocalPunch(sIn) ?? userTodayLog[sIn]), outTime: hmOf(getLocalPunch(sOut) ?? userTodayLog[sOut]),
        inActive: isSlotActive(sIn), outActive: isSlotActive(sOut), currMin: getCurrentMinute(),
        inStartMin: inInfo.sessionStartMin, inStartStr: inInfo.sessionStartStr, inEndStr: inInfo.formatMinutes(inInfo.sessionEndMin),
        outStartMin: outInfo.sessionStartMin, outStartStr: outInfo.sessionStartStr, outEndStr: outInfo.formatMinutes(outInfo.sessionEndMin),
      });
    });
    const focus = pickFocusShift(views);
    const cfgRange = (key: 'morning' | 'afternoon' | 'overtime') => {
      const c: any = config;
      const [a, b] = key === 'morning' ? [c.morningIn || '07:30', c.morningOut || '11:30'] : key === 'afternoon' ? [c.afternoonIn || '13:00', c.afternoonOut || '17:00'] : [c.overtimeIn || '17:45', c.overtimeOut || '20:45'];
      return `${a}–${b}`;
    };
    const pm = (k: string) => hmOf(getLocalPunch(k) ?? userTodayLog[k]);
    const punches = { inS: pm('timeInS'), outS: pm('timeOutS'), inC: pm('timeInC'), outC: pm('timeOutC') };
    const doneParts = [punches.inS && punches.outS ? `Sáng ${punches.inS}→${punches.outS}` : '', punches.inC && punches.outC ? `Chiều ${punches.inC}→${punches.outC}` : ''].filter(Boolean);

    // Dải tuần: dựa vào chấm công trong tháng đã tải; tuần giao tháng thì ngày thuộc tháng trước chưa tải → coi như chưa có dữ liệu (không đánh dấu vắng sai)
    const approvedMine = (dashLeaves || []).filter((l: any) => l.status === 'approved' && (l.empId ? l.empId === empId : l.empName === currentUser.name));
    const loadedMonth = todayVal.slice(0, 7);
    const week = buildWeek(todayVal, (date) => {
      const log = currentLogs.find(l => l.date === date);
      const hasPunch = !!log && ['timeInS', 'timeOutS', 'timeInC', 'timeOutC', 'timeInOT', 'timeOutOT'].some(k => hasTime(normalizeTime(log[k])));
      const outsideLoaded = !date.startsWith(loadedMonth);
      return { hasPunch: hasPunch || outsideLoaded, lates: log ? getLogAttendanceStats(log).lates : 0, isRest: isCalendarRestDay(date), onLeave: approvedMine.some((l: any) => l.fromDate <= date && date <= (l.toDate || l.fromDate)) };
    });

    const profile = getCurrentEmployeeProfile();
    const allowedLate = config.allowedLateCount ?? 3;
    const proj = (id?: string) => projects.find(pr => pr.id === id)?.name || '';
    const daysLate = (deadline: string) => Math.max(1, Math.round((new Date(todayVal).getTime() - new Date(deadline).getTime()) / 86400000));
    // Ngày thiếu / lỗi chấm công cần báo cáo trong tháng (dùng đúng hàm của lịch tháng cũ: bỏ ngày nghỉ, ca chưa kết thúc, ngày đã chốt công và ca đã gửi báo cáo)
    const reportDays = (() => {
      const out: { date: string; label: string }[] = [];
      const [yy, mm] = currentMonthYear.split('-').map(Number);
      const lastDay = new Date(yy, mm, 0).getDate();
      for (let day = lastDay; day >= 1; day--) {
        const dateStr = `${currentMonthYear}-${String(day).padStart(2, '0')}`;
        if (dateStr > todayVal) continue;
        const issues = getDayAttendanceIssues(dateStr, currentLogs.find(l => l.date === dateStr));
        if (issues.length) out.push({ date: dateStr, label: issues.map(i => i.label).join(' · ') });
      }
      return out;   // mới nhất trước
    })();
    const todo: TodoItem[] = [
      ...reportDays.slice(0, 2).map(r => ({ id: `rp_${r.date}`, icon: '📝', title: `Báo cáo chấm công ngày ${r.date.slice(8, 10)}/${r.date.slice(5, 7)}`, sub: r.label, pill: 'Cần báo cáo', tone: 'warn' as const, dayDate: r.date })),
      ...taskSum.overdue.slice(0, 2).map(t => ({ id: `od_${t.id}`, icon: '⏰', title: t.name, sub: `Quá hạn ${daysLate(t.deadline)} ngày${proj(t.projectId) ? ` · ${proj(t.projectId)}` : ''}`, pill: 'Quá hạn', tone: 'bad' as const, taskId: t.id })),
      ...needingApprovalTasks.slice(0, 2).map(t => ({ id: `ap_${t.id}`, icon: '✅', title: `Duyệt: ${t.name}`, sub: proj(t.projectId) || 'Công việc chờ duyệt', pill: 'Duyệt', tone: 'vio' as const, taskId: t.id })),
      ...taskSum.dueToday.slice(0, 2).map(t => ({ id: `td_${t.id}`, icon: '📌', title: t.name, sub: `Hạn hôm nay${proj(t.projectId) ? ` · ${proj(t.projectId)}` : ''}`, pill: 'Hôm nay', tone: 'blue' as const, taskId: t.id })),
    ].slice(0, 5);

    const unread = (() => { try { return unreadForBadge(getUserConversations(getConversations(), empId), readPrefs(companyScopedKey(prefsKey(empId)))); } catch { return 0; } })();
    const viol = summarizeViolations(violationList, empId, todayVal);
    const onLeaveToday = new Set<string>((dashLeaves || []).filter((l: any) => l.status === 'approved' && l.fromDate <= todayVal && todayVal <= (l.toDate || l.fromDate)).map((l: any) => String(l.empId)));
    const company = isAdmin ? summarizeCompanyToday({ employees: hrmEmployees as any[], logs: companyLogs, today: todayVal, latesOf: (log: any) => getLogAttendanceStats(log).lates, onLeaveIds: onLeaveToday, isRestDay: isCalendarRestDay(todayVal) }) : null;

    return {
      user: { name: currentUser.name, roleLabel: isAdmin ? 'Giám đốc' : isAccountant ? 'Kế toán' : currentUser?.role === 'pm' ? 'QL Dự án' : 'Thành viên' },
      todayLabel: `${['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][new Date(todayVal).getDay()]}, ${todayVal.slice(8, 10)}/${todayVal.slice(5, 7)}`,
      nowStr: digitalTime ? digitalTime.slice(0, 5) : '',
      focus, focusRange: focus ? cfgRange(focus.key) : '', allDoneTimes: doneParts.join(' · '), punches, pendingSync,
      week, reportDays,
      kpi: { dueToday: taskSum.dueToday.length, overdue: taskSum.overdue.length, toApprove: needingApprovalTasks.length, unread },
      month: { days: countAccumulatedDays, standard: standardWorkdays(currentMonthYear, isCalendarRestDay), phep: profile?.phepNam !== undefined ? String(profile.phepNam) : null, phepReserved: getAnnualLeaveAvailability().reserved, lateDays: monthLateEarly.lateDays.size, earlies: monthLateEarly.earlies, allowedLate, otHours: countOvertimeHours },
      perf: { rate: taskSum.rate, done: taskSum.monthDone, total: taskSum.monthTotal, violations: viol.count, lastViolation: viol.last },
      todo,
      leaves: summarizeLeaves(dashLeaves as any[], { id: empId, name: currentUser.name }, todayVal, isRealLeaveType),
      ctp: summarizeCtp((travelExpensesSummary || []).filter((item: any) => isTravelExpenseBeneficiary(item, currentUser)), todayVal),
      advance: summarizeAdvances(advanceList, empId, todayVal),
      projects: myProjList.map(pr => ({ id: pr.id, name: pr.name, progress: Number(pr.progress || 0), newCount: projectNew[pr.id] || 0 })),
      company,
    };
  })();

  // ─── CHI TIẾT NGÀY + BÁO CÁO LỖI CHẤM CA (kiểu LoLo): mở từ dải tuần / mục "Cần báo cáo" / lịch tháng cũ ───
  // Mở chi tiết 1 ngày (cùng cách dựng bản ghi như khi bấm vào lịch tháng cũ): ngày không có bản ghi thì dựng bản rỗng để vẫn báo cáo được.
  const openDay = (dateStr: string) => {
    const log = currentLogs.find(l => l.date === dateStr);
    const holidayMatch = (dashHolidays || []).find((h: any) => h?.date === `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}/${dateStr.slice(0, 4)}`);
    setSelectedDayDetail({
      date: dateStr,
      log: log ? normalizeRecord(log) : {
        id: `AT-${empId}-${dateStr.replace(/-/g, '')}`, empId, empName: currentUser.name, date: dateStr,
        timeInS: '--:--', timeOutS: '--:--', timeInC: '--:--', timeOutC: '--:--', timeInOT: '--:--', timeOutOT: '--:--',
        status: 'invalid', otHours: 0, notes: 'Không có dữ liệu chấm công cho ngày này.', isLocked: false,
      },
      holidayName: holidayMatch?.name,
    });
  };

  // Biểu mẫu báo cáo (giải trình) cho 1 ca — cùng trường, cùng kiểm tra và cùng hàm gửi (handleReportSubmit) như bản cũ
  const renderReportForm = () => {
    const configuredLeaveApprovers = getConfiguredApprovers('leave');
    const useLockedApprover = isAttendanceReportType(reportType);
    return (
      <form onSubmit={handleReportSubmit} className="space-y-3 pt-3 mt-2 border-t border-slate-200 animate-fadeIn" data-testid="report-form">
        <div className="text-[12px] font-extrabold text-[#0d47c9]">📝 Gửi báo cáo giải trình</div>
        <Field label="Loại báo cáo">
          {reportCategory === 'missing' ? (
            <select value={reportType} onChange={(e) => setReportType(e.target.value as any)} className={inputCls}>
              <option value="Báo cáo nghỉ ca">Báo cáo nghỉ ca (vắng thật / không có mặt)</option>
              <option value="Báo cáo lỗi hệ thống chấm công">Lỗi hệ thống không chấm được ca (app / GPS lỗi)</option>
            </select>
          ) : (
            <input type="text" value={reportType} readOnly className={`${inputCls} font-bold`} />
          )}
        </Field>
        {renderWholeDayOption()}
        {configuredLeaveApprovers.length > 0 && useLockedApprover ? (
          <div>
            <span className="block text-[11.5px] font-extrabold text-slate-600 mb-1">Người xét duyệt</span>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] flex items-center justify-between gap-2">
              <span className="font-bold">{configuredLeaveApprovers.map(a => a.position ? `${a.name} (${a.position})` : a.name).join(', ')}</span>
              <span className="text-[10.5px] font-bold bg-blue-50 text-[#0d47c9] border border-blue-200 px-2 py-0.5 rounded-full shrink-0">Tự động</span>
            </div>
          </div>
        ) : (
          <Field label="Người xét duyệt">
            <select value={reportApprover} onChange={(e) => setReportApprover(e.target.value)} className={inputCls}>
              {getApproversList().map((ap, idx) => <option key={idx} value={ap.name}>{ap.name} ({ap.role})</option>)}
            </select>
          </Field>
        )}
        <Field label="Lý do giải trình">
          <textarea required placeholder="Giải thích lý do quên chấm công hoặc lý do vắng ca…" value={reportReason} onChange={(e) => setReportReason(e.target.value)} className={`${inputCls} h-24 resize-none`} />
        </Field>
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <button type="button" onClick={() => { setShowReportForm(false); setReportShift(''); setReportType(''); }} className="py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-[13px] font-extrabold cursor-pointer" data-testid="report-cancel">Hủy</button>
          <button type="submit" className="py-2.5 rounded-xl text-[13px] font-extrabold cursor-pointer" style={{ background: 'linear-gradient(135deg,#1f6bff,#0a4fd8)', color: '#ffffff' }} data-testid="report-submit">Gửi báo cáo</button>
        </div>
      </form>
    );
  };

  // Khối 1 ca trong chi tiết ngày (sáng / chiều dùng CHUNG một đoạn mã; trước đây hai đoạn gần như trùng nhau)
  const renderDayShift = (shift: 'morning' | 'afternoon') => {
    if (!selectedDayDetail) return null;
    const log = selectedDayDetail.log;
    const c = shift === 'morning'
      ? { icon: '🌅', title: 'Ca sáng', name: 'Ca Sáng', inKey: 'timeInS', outKey: 'timeOutS', cfgIn: config.morningIn || '07:30', cfgOut: config.morningOut || '11:30', allowed: config.allowedLateMorning ?? config.allowedLateMinutes ?? 15 }
      : { icon: '🌇', title: 'Ca chiều', name: 'Ca Chiều', inKey: 'timeInC', outKey: 'timeOutC', cfgIn: config.afternoonIn || '13:00', cfgOut: config.afternoonOut || '17:00', allowed: config.allowedLateAfternoon ?? config.allowedLateMinutes ?? 15 };
    const leave = approvedShiftLeavesOnDay(dashLeaves, { empId, empName: currentUser.name }, selectedDayDetail.date).find(l => l.shift === shift);
    const inVal = normalizeTime(log[c.inKey]), outVal = normalizeTime(log[c.outKey]);
    const hasIn = !(!log[c.inKey] || log[c.inKey] === '--:--' || log[c.inKey] === '');
    const hasOut = !(!log[c.outKey] || log[c.outKey] === '--:--' || log[c.outKey] === '');
    const isOff = log.timeInS === 'OFF';
    const lateInfo = hasIn ? (() => {
      const inMin = timeToMinutes(inVal), limitMin = timeToMinutes(c.cfgIn);
      return inMin > limitMin + c.allowed ? { late: true, text: `Đi muộn ${inMin - limitMin} phút` } : { late: false, text: 'Đúng giờ' };
    })() : null;
    const missing = !hasIn && !hasOut, faulty = hasIn && !hasOut;
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-3" data-testid={`day-shift-${shift}`} data-state={isOff ? 'off' : missing ? 'missing' : faulty ? 'faulty' : 'ok'}>
        <div className="flex items-center justify-between mb-2">
          <b className="text-[13px]">{c.icon} {c.title}</b><span className="text-[11px] text-slate-500 font-mono">Định mức {c.cfgIn} – {c.cfgOut}</span>
        </div>
        {leave && <div className="mb-2"><Notice tone="info">🏖 {shiftLeaveFullLabel(leave)} — đã được duyệt nghỉ</Notice></div>}
        {isOff ? <Notice tone="warn">Đăng ký nghỉ phép / Off</Notice> : missing ? (
          <div className="rounded-xl border border-dashed border-rose-300 bg-rose-50/60 p-3 text-center space-y-2">
            <div className="text-[12px] text-slate-600">Không có lịch sử chấm công {c.name}</div>
            <div className="flex justify-center">{renderReportButtonAndStatus(shift, false, true)}</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-[10.5px] font-bold text-slate-500">Giờ vào</div><b className="font-mono text-lg">{inVal}</b>
              {lateInfo && <div className={`text-[11px] font-bold ${lateInfo.late ? 'text-amber-600' : 'text-emerald-600'}`}>{lateInfo.late ? '⏱️' : '✅'} {lateInfo.text}</div>}</div>
            <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-[10.5px] font-bold text-slate-500">Giờ ra</div><b className="font-mono text-lg">{hasOut ? outVal : '--:--'}</b>
              {faulty && <div className="mt-1">{renderReportButtonAndStatus(shift, true, false)}</div>}</div>
          </div>
        )}
        {showReportForm && reportShift === shift && renderReportForm()}
      </section>
    );
  };

  // Các ô của lịch tháng: cùng cách nhận biết "có chấm công / đi muộn / nghỉ phép / ngày lễ / lỗi chấm công chưa báo cáo" như dải tuần và hộp chi tiết ngày
  const monthDays = buildMonth(currentMonthYear, todayVal, (date) => {
    const log = currentLogs.find(l => l.date === date);
    const hasPunch = !!log && ['timeInS', 'timeOutS', 'timeInC', 'timeOutC', 'timeInOT', 'timeOutOT'].some(k => hasTime(normalizeTime(log[k])));
    const holiday = (dashHolidays || []).find((h: any) => h?.date === `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`);
    const onLeave = (dashLeaves || []).some((l: any) => l.status === 'approved' && (l.empId ? l.empId === empId : l.empName === currentUser.name) && l.fromDate <= date && date <= (l.toDate || l.fromDate));
    const workLabel = log ? (computeDailyWorkday(log, dashCoefficients, dashHolidays, dashWeekendDays, dashLeaves).label || '✓') : '';
    return {
      hasPunch, lates: log ? getLogAttendanceStats(log).lates : 0, isRest: isCalendarRestDay(date), onLeave, holiday: holiday?.name, workLabel,
      ot: !!log && (hasTime(normalizeTime(log.timeInOT)) || Number(log.otHours) > 0),
      issue: date <= todayVal && getDayAttendanceIssues(date, log).length > 0,
    };
  });

  const openDetail = () => { setShowDetail(true); setTimeout(() => document.getElementById('overview_detail')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 60); };

  return (
    <div className="space-y-6" id="personalized_dashboard">
      
      {/* TỔNG QUAN KIỂU MỚI (mẫu A + D): điểm danh gọn, dải tuần, chỉ số, hiệu suất, việc cần làm, đơn, công tác phí, tạm ứng, dự án */}
      <OverviewHome d={overviewData} a={{
        onPunch: handlePunchClick, onGo: onNavigateTab,
        onOpenTask: (taskId: string) => window.dispatchEvent(new CustomEvent('hl-open-task', { detail: { taskId } })),
        onRequestLeave: openLeaveModal, onRequestAdvance: () => setAdvanceModalOpen(true), onOpenDetail: openDetail, onOpenDay: openDay,
      }} />

      {/* LỊCH CHẤM CÔNG THÁNG (kiểu LoLo): chỉ còn giao diện lịch; bấm ngày mở hộp "Chi tiết ngày" (xem giờ chấm + báo cáo lý do) */}
      {showDetail && (
        <MonthCalendar ym={currentMonthYear} days={monthDays} userName={currentUser.name} onOpenDay={openDay} onClose={() => setShowDetail(false)} />
      )}

      {/* HỘP CHI TIẾT NGÀY + BÁO CÁO LỖI CHẤM CA (kiểu LoLo: trượt từ dưới lên). Mở từ dải tuần, mục "Cần báo cáo" hoặc lịch tháng. */}
      {selectedDayDetail && (() => {
        const log = selectedDayDetail.log;
        const st = getAttendanceStatusText(log, readHrmConfigFromStorage());
        const valid = st.isValid && log.statusMsg !== 'Không hợp lệ' && log.status !== 'invalid';
        const dd = selectedDayDetail.date;
        const dow = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][new Date(dd).getDay()];
        const hasOT = (log.timeInOT && log.timeInOT !== '--:--') || (log.otHours && log.otHours > 0);
        return (
          <Sheet testid="day-detail-sheet" title={`Chi tiết ngày ${dd.slice(8, 10)}/${dd.slice(5, 7)}/${dd.slice(0, 4)}`} subtitle={`${dow} · ${currentUser.name}`}
            onClose={() => setSelectedDayDetail(null)}
            footer={<button type="button" onClick={() => setSelectedDayDetail(null)} className="w-full py-3 rounded-xl text-[14px] font-extrabold cursor-pointer" style={{ background: 'linear-gradient(135deg,#1f6bff,#0a4fd8)', color: '#ffffff' }} data-testid="day-close">Đóng</button>}>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
              <span className="text-[12px] font-bold text-slate-600">Trạng thái chấm công</span>
              <span className={`text-[12px] font-extrabold ${valid ? 'text-emerald-600' : 'text-rose-600'}`}>{log.statusMsg || (st.isValid ? 'Hợp lệ' : 'Không hợp lệ')}</span>
            </div>
            {selectedDayDetail.holidayName && <Notice tone="info">🎉 {selectedDayDetail.holidayName}</Notice>}

            {renderDayShift('morning')}
            {renderDayShift('afternoon')}

            {hasOT ? (
              <section className="rounded-2xl border border-violet-200 bg-violet-50 p-3" data-testid="day-ot">
                <div className="flex items-center justify-between mb-2"><b className="text-[13px] text-violet-700">🌌 Tăng ca</b><span className="text-[11px] font-bold text-violet-600">Tích lũy {log.otHours || 0} giờ</span></div>
                <div className="grid grid-cols-2 gap-3 text-violet-800">
                  <div><div className="text-[10.5px] font-bold text-violet-500">Giờ vào</div><b className="font-mono">{normalizeTime(log.timeInOT) || '--:--'}</b></div>
                  <div><div className="text-[10.5px] font-bold text-violet-500">Giờ ra</div><b className="font-mono">{normalizeTime(log.timeOutOT) || '--:--'}</b></div>
                </div>
              </section>
            ) : null}

            {/* Ảnh FaceID & tọa độ GPS của TỪNG lượt chấm: Vào/Ra sáng, chiều, tăng ca */}
            <PunchMediaList log={log} onZoomImage={setZoomedImage} variant="full" />

            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
              <div className="text-[10.5px] font-extrabold text-slate-500 uppercase">Ghi chú từ hệ thống</div>
              <p className="text-[12px] text-slate-700 mt-0.5 leading-relaxed">{log.notes || 'Không có ghi chú đặc biệt.'}</p>
              {log.isLocked && <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 mt-1.5 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">🔒 Bản ghi đã khóa chốt công</span>}
            </div>
          </Sheet>
        );
      })()}

      {/* MODAL 4: XEM CHI TIẾT CHẤM CÔNG CHUYỂN TỪ TẤM BẢNG STATIC RA DẠNG MODAL */}
      {showDetailLogsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn" id="faceid_detailed_logs_modal">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl relative">
            
            <div className="p-4 bg-slate-950 border-b border-slate-850 flex items-center justify-between">
              <span className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                🕒 NHẬT KÝ FACEID & GPS CHI TIẾT CỦA {currentUser.name.toUpperCase()}
              </span>
              <button
                type="button"
                onClick={() => setShowDetailLogsModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer bg-slate-800 hover:bg-slate-705 p-1 px-2.5 rounded transition-all font-black text-xs border border-transparent hover:border-slate-700"
              >
                ĐÓNG [X]
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <span className="text-xs font-bold text-slate-400">
                  Lịch sử điểm danh chi tiết qua hệ thống định dạng khuôn mặt FaceID 3D Mesh
                </span>
                <span className="text-[10px] text-slate-500 font-mono font-bold">
                  Ca định mức chuẩn: {config.morningIn} - {config.morningOut} | {config.afternoonIn} - {config.afternoonOut}
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/20">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-950/60 uppercase">
                      <th className="p-3">NGÀY</th>
                      <th className="p-3">SÁNG ({config.morningIn}-{config.morningOut})</th>
                      <th className="p-3">CHIỀU ({config.afternoonIn}-{config.afternoonOut})</th>
                      <th className="p-3">OT ({config.overtimeIn}-{config.overtimeOut})</th>
                      <th className="p-3">TRẠNG THÁI / CHI TIẾT GPS / LƯƠNG PHỤ PHÍ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-800 hover:bg-slate-850/40 transition-colors bg-emerald-950/10">
                      <td className="p-3 font-black text-emerald-400">{todayVal} (Hôm nay)</td>
                      <td className="p-3 font-mono text-slate-300 font-bold">{normalizeTime(userTodayLog.timeInS) || '--:--'} - {normalizeTime(userTodayLog.timeOutS) || '--:--'}</td>
                      <td className="p-3 font-mono text-slate-300 font-bold">{normalizeTime(userTodayLog.timeInC) || '--:--'} - {normalizeTime(userTodayLog.timeOutC) || '--:--'}</td>
                      <td className="p-3 font-mono text-slate-300 font-bold">{normalizeTime(userTodayLog.timeInOT) || '--:--'} - {normalizeTime(userTodayLog.timeOutOT) || '--:--'}</td>
                      <td className="p-3 text-slate-400 leading-tight">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black px-1.5 py-0.2 rounded uppercase tracking-wide">
                            Live Session
                          </span>
                          <span>{userTodayLog.notes || `Chưa thực hiện chấm công ca hôm nay.`}</span>
                        </div>
                        
                        {/* Ảnh + tọa độ của TỪNG lượt chấm hôm nay (tối đa 6 lượt) */}
                        <PunchMediaList
                          log={userTodayLog}
                          onZoomImage={setZoomedImage}
                          variant="compact"
                        />
                      </td>
                    </tr>
                    {currentLogs.filter(a => a.date !== todayVal).map((log, index) => (
                      <tr key={index} className="border-b border-slate-800/60 hover:bg-slate-850/20 transition-colors">
                        <td className="p-3 font-bold text-slate-300 font-mono">{log.date}</td>
                        <td className="p-3 font-mono text-slate-400">{normalizeTime(log.timeInS) || '07:25'} - {normalizeTime(log.timeOutS) || '11:32'}</td>
                        <td className="p-3 font-mono text-slate-400">{normalizeTime(log.timeInC) || '12:55'} - {normalizeTime(log.timeOutC) || '17:05'}</td>
                        <td className="p-3 font-mono text-slate-400">{log.timeInOT && log.timeInOT !== '--:--' ? `${normalizeTime(log.timeInOT)} - ${normalizeTime(log.timeOutOT)}` : 'Không OT'}</td>
                        <td className="p-3 text-slate-400">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            {(() => {
                              const st = getAttendanceStatusText(log, readHrmConfigFromStorage());
                              return (
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase select-none ${
                                  st.isValid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}>
                                  {st.text}
                                </span>
                              );
                            })()}
                            <span>{log.notes || `Chấm công FaceID & định vị tọa độ`} • OT {log.otHours || 0}H</span>
                          </div>

                          {/* Ảnh + tọa độ của TỪNG lượt chấm trong ngày (tối đa 6 lượt) */}
                          <PunchMediaList
                            log={log}
                            onZoomImage={setZoomedImage}
                            variant="compact"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDetailLogsModal(false)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-5 py-2 rounded-xl text-xs flex justify-center items-center cursor-pointer text-white shadow-md transition-all font-mono"
                >
                  XÁC NHẬN & ĐÓNG
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* MODAL 1: CHỤP ẢNH XÁC THỰC FACEID & GPS MOBILE APP */}
      {pendingSync > 0 && (
        <div className="fixed bottom-4 left-4 z-[60] bg-amber-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 pointer-events-none">
          <span className="animate-pulse">⏳</span> {pendingSync} bản ghi chờ đồng bộ
        </div>
      )}

      {showPunchModal && activePunchSlot && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn" id="biometric_webcam_modal">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative">
            
            <div className="p-4 bg-slate-950 border-b border-slate-850 flex items-center justify-between">
              <span className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                🛡️ XÁC THỰC BIOMETRIC FACEID & GPS LÂM ĐỒNG
              </span>
              <button
                onClick={() => { stopCameraStream(); setShowPunchModal(false); }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              
              {/* CAMERA FEED (hoặc cảnh báo khi camera không hoạt động) */}
              <div className="relative rounded-xl border border-slate-750 bg-black overflow-hidden h-48 flex flex-col items-center justify-center">
                {webcamActive && !webcamError ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
                    />
                    {/* Laser scanning line animation overlay */}
                    <div className="absolute left-0 right-0 h-[2px] bg-sky-500 shadow-[0_0_8px_#0ea5e9] animate-bounce top-1/4 pointer-events-none"></div>
                    <div className="absolute inset-2 border-2 border-dashed border-sky-500/30 rounded-lg pointer-events-none"></div>
                    <span className="absolute bottom-2 left-2 bg-slate-950/85 border border-slate-800 text-[10px] text-sky-400 font-mono px-2 py-0.5 rounded flex items-center gap-1">
                      <Camera className="w-3 h-3 text-sky-400 animate-pulse" /> Live Feed
                    </span>
                  </>
                ) : (
                  // Camera lỗi/không có → cảnh báo rõ ràng (KHÔNG giả lập ảnh AI)
                  <div className="text-center p-5 space-y-3 w-full h-full flex flex-col justify-center items-center bg-red-50 border border-red-200">
                    <div className="relative">
                      <AlertCircle className="w-14 h-14 text-rose-500 mx-auto" />
                    </div>
                    <div>
                      <p className="text-xs text-rose-700 font-black">KHÔNG TRUY CẬP ĐƯỢC CAMERA</p>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        Chấm công bắt buộc có ảnh khuôn mặt chụp trực tiếp lúc điểm danh.
                        Vui lòng cấp quyền truy cập camera, mở qua HTTPS và thử lại.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={startCameraStream}
                      className="mt-1 bg-sky-500 hover:bg-sky-400 text-white text-[10px] py-1.5 px-3 rounded-lg font-bold cursor-pointer"
                    >
                      🔄 Thử lại camera
                    </button>
                  </div>
                )}
              </div>

              {/* GPS STATE INFO */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850 text-left space-y-1.5 text-[11px]">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-slate-500 font-bold shrink-0">TỌA ĐỘ GPS THỰC TẾ:</span>
                  {gpsLoading ? (
                    <span className="text-sky-450 font-mono font-black flex items-center gap-1 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping"></span>
                      Đang định vị chính xác...
                    </span>
                  ) : gpsErrorMsg ? (
                    <span className="text-rose-500 font-mono font-bold text-right">{gpsErrorMsg}</span>
                  ) : (
                    <span className="text-emerald-400 font-black font-mono text-right">{liveGpsCoords || 'Chưa nhận dạng'}</span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 pt-0.5 border-t border-slate-850/40">
                  <span className="text-slate-500 font-bold">VỊ TRÍ THỰC TẾ PHÁT HIỆN:</span>
                  {gpsLoading ? (
                    <span className="text-slate-500 italic text-[10px]">Đang giải mã bản đồ phản xạ...</span>
                  ) : (
                    <span className="text-xs text-indigo-300 font-semibold">{liveGpsAddr || 'Không lấy được thông tin vị trí thực tế'}</span>
                  )}
                </div>
                <div className="flex justify-between pt-1.5 border-t border-slate-850/60 text-[10px]">
                  <span className="text-slate-500 font-bold">NHÂN VIÊN:</span>
                  <span className="text-slate-200 font-bold">{currentUser.name}</span>
                </div>
              </div>

              {/* ACTION BTNS */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { stopCameraStream(); setShowPunchModal(false); }}
                  className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs py-2 rounded-xl border border-slate-700 font-bold text-center cursor-pointer"
                >
                  HUY BỎ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPunch}
                  disabled={webcamError}
                  className={`flex-1 text-xs py-2 rounded-xl font-black text-center flex items-center justify-center gap-1.5 ${
                    webcamError
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-sky-500 hover:bg-sky-400 text-white cursor-pointer'
                  }`}
                >
                  <Camera className={`w-4 h-4 ${webcamError ? 'text-slate-600' : 'text-white'}`} />
                  CHỤP ẢNH & CHẤM CÔNG
                </button>
              </div>

            </div>

          </div>
        </div>
      )}


      {/* HỘP XIN NGHỈ PHÉP (kiểu LoLo: trượt từ dưới lên; logic, kiểm tra và hàm nộp đơn giữ nguyên như bản cũ) */}
      {leaveModalOpen && (() => {
        const profile = getCurrentEmployeeProfile();
        const remainingDays = profile?.phepNam !== undefined ? profile.phepNam : 12;
        const avail = getAnnualLeaveAvailability();
        const outOfLeave = leaveRequestType === 'Nghỉ phép năm' && avail.available <= 0;   // hết phép năm → chặn tạo đơn
        const configuredApprovers = getConfiguredApprovers('leave');
        return (
          <Sheet id="leave_request_submission_modal" title="Xin nghỉ phép" subtitle={`${currentUser.name} · Phép năm còn ${remainingDays} ngày`}
            onClose={() => setLeaveModalOpen(false)} onSubmit={handleLeaveSubmit}
            footer={<SheetActions onCancel={() => setLeaveModalOpen(false)} submitLabel="Gửi đơn nghỉ phép" disabled={outOfLeave} />}>
            <Field label="Loại phép">
              <select value={leaveRequestType} onChange={(e) => setLeaveRequestType(e.target.value)} className={inputCls}>
                {leaveTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </Field>

            {/* Thống kê phép năm: còn lại + số ngày đang bị các đơn chờ duyệt giữ chỗ */}
            <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[12px]" data-testid="leave-balance">
              <span className="font-bold text-slate-600">Phép năm của bạn</span>
              <span className="font-extrabold text-emerald-600">Còn {formatDays(avail.available)} ngày{avail.reserved > 0 ? <span className="text-slate-500 font-semibold"> · {formatDays(avail.reserved)} ngày đang chờ duyệt</span> : null}</span>
            </div>
            {outOfLeave && <Notice tone="bad">⚠️ Bạn đã hết phép năm{avail.reserved > 0 ? ' (số còn lại đã được các đơn đang chờ duyệt dùng hết)' : ''} nên không thể tạo đơn</Notice>}

            {/* Nghỉ cả ngày hay chỉ 1 ca — chỉ cho Nghỉ phép năm và Nghỉ không lương có xin phép */}
            {supportsShiftLeave(leaveRequestType) && (
              <div>
                <span className="block text-[11.5px] font-extrabold text-slate-600 mb-1">Thời gian nghỉ</span>
                <Segmented value={leaveShiftChoice} onChange={(v) => setLeaveShiftChoice(v as 'full' | LeaveShift)}
                  options={[{ value: 'full', label: 'Cả ngày' }, { value: 'morning', label: 'Ca sáng (0,5)' }, { value: 'afternoon', label: 'Ca chiều (0,5)' }]} />
                {leaveShiftChoice !== 'full' && leaveRequestType === 'Nghỉ phép năm' && <p className="text-[11px] text-slate-500 mt-1">Nghỉ 1 ca chỉ trong 1 ngày và trừ 0,5 ngày phép năm khi được duyệt.</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Từ ngày">
                <input type="date" value={leaveFrom} className={`${inputCls} font-mono ${leaveDateWarningMessage ? '!border-amber-500 ring-2 ring-amber-100' : ''}`}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLeaveFrom(val);
                    try {
                      const d = new Date(val);
                      if (leaveShiftChoice === 'full') d.setDate(d.getDate() + 1);   // nghỉ 1 ca: ngày kết thúc = ngày bắt đầu
                      setLeaveTo(d.toISOString().split('T')[0]);
                    } catch (err) {}
                  }} />
              </Field>
              <Field label="Đến ngày">
                <input type="date" value={leaveTo} onChange={(e) => setLeaveTo(e.target.value)} disabled={leaveShiftChoice !== 'full'}
                  title={leaveShiftChoice !== 'full' ? 'Nghỉ 1 ca chỉ trong 1 ngày' : undefined} className={`${inputCls} font-mono`} />
              </Field>
            </div>
            {leaveDateWarningMessage && <Notice tone="warn">{leaveDateWarningMessage}</Notice>}

            <div className="flex items-center justify-between rounded-xl bg-blue-50 border border-blue-200 px-3 py-2" data-testid="leave-days">
              <span className="text-[12px] font-bold text-slate-600">Tổng số ngày đề nghị</span><b className="text-[#0d47c9]">{formatDays(leaveDays)} ngày</b>
            </div>

            {/* Người xét duyệt: nhiều người được cấu hình → liệt kê đủ tên (bất kỳ ai trong số họ đều duyệt được) */}
            {configuredApprovers.length > 0 ? (
              <div>
                <span className="block text-[11.5px] font-extrabold text-slate-600 mb-1">Người xét duyệt</span>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] flex items-center justify-between gap-2">
                  <span className="font-bold">{configuredApprovers.map(a => a.position ? `${a.name} (${a.position})` : a.name).join(', ')}</span>
                  <span className="text-[10.5px] font-bold bg-blue-50 text-[#0d47c9] border border-blue-200 px-2 py-0.5 rounded-full shrink-0">Tự động</span>
                </div>
              </div>
            ) : (
              <Field label="Người xét duyệt">
                <select value={leaveApproverId} className={inputCls}
                  onChange={(e) => {
                    const emp = hrmEmployees.find((em: any) => em.id === e.target.value);   // chọn theo MÃ nhân viên (không theo tên)
                    setLeaveApprover(emp?.name || '');
                    setLeaveApproverId(emp?.id || '');
                    setLeaveApproverPosition(emp?.position || '');
                  }}>
                  <option value="">Chọn người xét duyệt...</option>
                  {hrmEmployees.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.name} ({emp.position || emp.role})</option>)}
                </select>
              </Field>
            )}

            <Field label="Lý do xin phép">
              <textarea required placeholder="Nhập lý do cụ thể (vd: giải quyết việc gia đình, đi khám bệnh…)" value={leaveReasonText} onChange={(e) => setLeaveReasonText(e.target.value)} className={`${inputCls} h-24 resize-none`} />
            </Field>
          </Sheet>
        );
      })()}


      {/* HỘP ĐỀ XUẤT TẠM ỨNG LƯƠNG (kiểu LoLo; logic và hàm gửi đề xuất giữ nguyên như bản cũ) */}
      {advanceModalOpen && (() => {
        const configuredApprovers = getConfiguredApprovers('salary_advance');
        return (
          <Sheet id="salary_advance_proposal_modal" title="Đề xuất tạm ứng lương" subtitle={currentUser.name}
            onClose={() => setAdvanceModalOpen(false)} onSubmit={handleAdvanceSubmit}
            footer={<SheetActions onCancel={() => setAdvanceModalOpen(false)} submitLabel="Gửi đề xuất" />}>
            <Field label="Kỳ lương áp dụng">
              <select value={advancePeriod} onChange={(e) => setAdvancePeriod(e.target.value)} className={inputCls}>
                {getPeriodOptions().map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </Field>

            <div>
              <Field label="Số tiền tạm ứng (đồng)">
                <input type="number" inputMode="numeric" placeholder="Nhập số tiền, vd: 3000000" value={advanceAmountVal} onChange={(e) => setAdvanceAmountVal(e.target.value)} className={`${inputCls} font-mono font-bold`} required />
              </Field>
              <div className="flex gap-1.5 mt-2" data-testid="advance-quick">
                {[1_000_000, 2_000_000, 3_000_000, 5_000_000].map(n => (
                  <button key={n} type="button" onClick={() => setAdvanceAmountVal(String(n))} data-amount={n}
                    className={`flex-1 py-1.5 rounded-lg border text-[12px] font-extrabold cursor-pointer ${Number(advanceAmountVal) === n ? 'bg-blue-50 border-[#0d47c9] text-[#0d47c9]' : 'bg-white border-slate-300 text-slate-600'}`}>{n / 1_000_000} triệu</button>))}
              </div>
              {advanceAmountVal && <div className="mt-2 text-[15px] text-[#0d47c9] font-extrabold" data-testid="advance-preview">{Number(advanceAmountVal).toLocaleString('vi-VN')} đ</div>}
            </div>

            <Field label="Lý do đề xuất">
              <textarea required placeholder="vd: Chi tiêu cá nhân đột xuất, việc gia đình…" value={advanceReasonText} onChange={(e) => setAdvanceReasonText(e.target.value)} className={`${inputCls} h-24 resize-none`} />
            </Field>

            {/* Người xét duyệt: nhiều người được cấu hình → liệt kê đủ tên (bất kỳ ai trong số họ đều duyệt được) */}
            {configuredApprovers.length > 0 ? (
              <div>
                <span className="block text-[11.5px] font-extrabold text-slate-600 mb-1">Người xét duyệt</span>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] flex items-center justify-between gap-2">
                  <span className="font-bold">{configuredApprovers.map(a => a.position ? `${a.name} (${a.position})` : a.name).join(', ')}</span>
                  <span className="text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">Tự động</span>
                </div>
              </div>
            ) : (
              <Field label="Người xét duyệt (nhóm kế toán)">
                <select value={advanceApproverId} onChange={(e) => setAdvanceApproverId(e.target.value)} className={inputCls}>
                  <option value="">Chọn người xét duyệt...</option>
                  {hrmEmployees.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.name} ({emp.position || emp.role})</option>)}
                </select>
              </Field>
            )}
          </Sheet>
        );
      })()}

      {zoomedImage && (
        <div 
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 z-[100] animate-fadeIn cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
          id="zoomed_image_overlay"
        >
          <div className="relative max-w-3xl max-h-[85vh] w-full flex items-center justify-center p-1 bg-slate-800 rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <img 
              src={zoomedImage} 
              className="max-w-full max-h-[80vh] rounded-xl object-contain shadow-inner" 
              alt="Ảnh chấm công phóng lớn" 
              referrerPolicy="no-referrer"
            />
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-4 right-4 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:text-white text-slate-300 rounded-full p-2 cursor-pointer z-50 transition-all font-bold text-xs"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="mt-4 text-xs font-semibold text-slate-400 font-mono">Bấm nhấp ngoài vùng để đóng xem phóng to</p>
        </div>
      )}

    </div>
  );
}
