import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Project, Task, Receipt, Payment, Quote, SubcontractorAdvanceProposal } from '../types';
import { computeDailyWorkday, getAttendanceStatusText, readHrmConfigFromStorage } from './hr/hrCalculations';
import { isUserInRoleGroup, loadHrmRoleGroups, getConfiguredApprover } from '../context';
import { dbService } from '../lib/dbService';
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
  Check,
  AlertCircle,
  CalendarCheck,
  Settings,
  Lock,
  Sun,
  Moon,
  Compass
} from 'lucide-react';
import { Employee } from '../types';

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
}: DashboardProps) {

  // --- PHẦN 1: BỘ LỌC CÔNG VIỆC THEO USER ĐANG ĐĂNG NHẬP (& PHÂN QUYỀN TRUY CẬP) ---
  const getTodayString = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const r = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${r}`;
  };
  const [todayVal, setTodayVal] = useState(getTodayString());

  // 1.1 Công việc cần duyệt (Tasks needing approval)
  // Director & Accountant có thể duyệt tất cả Reviewing tasks hoặc pending approvals.
  // PM duyệt cho dự án của họ hoặc nếu được gán là approver.
  // Các vai trò khác duyệt nếu họ được chỉ định approver.
  const isAdmin = currentUser ? isUserInRoleGroup(currentUser.id, 'role_admin') : false;
  const isAccountant = currentUser ? isUserInRoleGroup(currentUser.id, 'role_accounting') : false;
  const isPM = currentUser ? isUserInRoleGroup(currentUser.id, 'role_office') : false;

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
    const isInvolved = t.involvedEmployeeIds?.includes(currentUser.id);
    const isNotCompleted = t.status !== 'completed';
    return (isAssignee || isInvolved) && isNotCompleted;
  });

  // 1.3 Công việc quá hạn (Overdue tasks)
  const myOverdueTasks = tasks.filter(t => {
    const isAssignee = t.assigneeId === currentUser.id;
    const isInvolved = t.involvedEmployeeIds?.includes(currentUser.id);
    const isCompleted = t.status === 'completed';
    const isOverdueStatus = t.status === 'overdue';
    const isPastDeadline = t.deadline < todayVal;
    return (isAssignee || isInvolved) && !isCompleted && (isOverdueStatus || isPastDeadline);
  });


  // --- PHẦN 2: BỘ LỌC ĐỀ XUẤT TÀI CHÍNH (VẬT TƯ & TẠM ỨNG) ---

  // 2.1 Yêu cầu vật tư (Material requests)
  // Lấy từ danh sách payments có category là 'material'
  const materialRequests = payments.filter(p => p.category === 'material');
  const filteredMaterialRequests = materialRequests.filter(mr => {
    if (isAdmin || isAccountant) {
      return true; // Sếp / kế toán thấy tất cả để duyệt
    }
    const isPM = currentUser ? isUserInRoleGroup(currentUser.id, 'role_office') : false;
    if (isPM) {
      const isProjectPM = projects.find(p => p.id === mr.projectId)?.pmId === currentUser.id;
      return isProjectPM || mr.proposer === currentUser.name;
    }
    return mr.proposer === currentUser.name;
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

  // --- ACTIONS XỬ LÝ (INTERACTIVE APPROVALS) ---
  const handleApproveTaskItem = (taskId: string, actionStatus: 'completed' | 'doing' | 'todo') => {
    if (onUpdateTask) {
      onUpdateTask(taskId, { status: actionStatus as any });
      alert(`Đã cập nhật trạng thái công việc sang: ${actionStatus.toUpperCase()}`);
    }
  };

  const handleApproveTaskStep = (taskId: string, stepId: string, status: 'approved' | 'rejected') => {
    if (onUpdateTask) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.approvals) {
        const updatedSteps = task.approvals.map(step => 
          step.id === stepId ? { ...step, status, updatedAt: todayVal } : step
        );
        onUpdateTask(taskId, { approvals: updatedSteps });
        alert(`Đã duyệt phê duyệt nội bộ của công việc thành công!`);
      }
    }
  };

  const handleApproveMaterialRequest = (payId: string, status: 'approved' | 'rejected') => {
    if (onApprovePayment) {
      onApprovePayment(payId, status);
      alert(`Đã cập nhật trạng thái mua vật tư: ${status.toUpperCase()}`);
    }
  };

  const handleApproveAdvanceRequest = (advanceItem: typeof filteredAdvances[0], status: 'approved' | 'rejected') => {
    if (advanceItem.originType === 'payment_advance') {
      if (onApprovePayment) {
        onApprovePayment(advanceItem.id, status);
        alert(`Đã duyệt đề xuất tạm ứng chi tài chính thành công nhãn: ${status.toUpperCase()}`);
      }
    } else if (advanceItem.originType === 'task_advance') {
      if (onUpdateTask) {
        const task = tasks.find(t => t.id === advanceItem.taskId);
        if (task && task.advanceRequests) {
          const updated = task.advanceRequests.map(r => 
            r.id === advanceItem.id ? { ...r, status } : r
          );
          onUpdateTask(advanceItem.taskId, { advanceRequests: updated });
          alert(`Đã duyệt đề xuất tạm ứng thợ mộc của công việc thành công nhãn: ${status.toUpperCase()}`);
        }
      }
    }
  };

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
  interface SystemConfig {
    morningIn: string; morningOut: string; afternoonIn: string; afternoonOut: string;
    overtimeIn: string; overtimeOut: string;
    gpsRadiusAllowed: number; antiFakeCam: boolean; otMultiplier: number;
    directorBaseSalary: number; pmBaseSalary: number; accountantBaseSalary: number; staffBaseSalary: number;
    punchOpenBeforeMinutes: number; punchCloseAfterMinutes: number;
    punchOutOpenBeforeMinutes: number; punchOutCloseAfterMinutes: number;
    otPunchOpenBeforeMinutes: number; otPunchCloseAfterMinutes: number;
    otPunchOutOpenBeforeMinutes: number; otPunchOutCloseAfterMinutes: number;
    allowedLateMinutes: number; weekendDays: number[];
    constructionSites: string[];
  }
  const [config, setConfig] = useState<SystemConfig>(() => {
    const saved = localStorage.getItem('hl_system_settings_v3');
    const baseConfig = {
      morningIn: '07:30',
      morningOut: '11:30',
      afternoonIn: '13:00',
      afternoonOut: '17:00',
      overtimeIn: '17:45',
      overtimeOut: '20:45',
      gpsRadiusAllowed: 50,
      antiFakeCam: true,
      otMultiplier: 1.5,
      directorBaseSalary: 45000000,
      pmBaseSalary: 22000000,
      accountantBaseSalary: 18000000,
      staffBaseSalary: 14000000,
      punchOpenBeforeMinutes: 30,
      punchCloseAfterMinutes: 30,
      punchOutOpenBeforeMinutes: 30,
      punchOutCloseAfterMinutes: 30,
      otPunchOpenBeforeMinutes: 30,
      otPunchCloseAfterMinutes: 30,
      otPunchOutOpenBeforeMinutes: 30,
      otPunchOutCloseAfterMinutes: 30,
      allowedLateMinutes: 15,
      weekendDays: [0], // 0 represents Sunday
      constructionSites: [
        'Công trình Blue Sky',
        'Xưởng mộc Hoàng Long',
        'Bộ phận văn phòng chính',
        'Biệt thự SS400 Cát Lái'
      ]
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.weekendDays) {
          parsed.weekendDays = [0];
        }
        if (parsed.allowedLateMinutes === undefined) {
          parsed.allowedLateMinutes = 15;
        }
        if (parsed.punchOutOpenBeforeMinutes === undefined) {
          parsed.punchOutOpenBeforeMinutes = 15;
        }
        if (parsed.punchOutCloseAfterMinutes === undefined) {
          parsed.punchOutCloseAfterMinutes = 15;
        }
        return { ...baseConfig, ...parsed };
      } catch (e) {
        console.error(e);
      }
    }
    return baseConfig;
  });

  // Listen for configuration changes (e.g. from the custom settings tab)
  useEffect(() => {
    const handleSettingsUpdate = () => {
      const saved = localStorage.getItem('hl_system_settings_v3');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setConfig(prev => {
            const next = { ...prev, ...parsed };
            if (next.allowedLateMinutes === undefined) {
              next.allowedLateMinutes = 15;
            }
            if (next.punchOutOpenBeforeMinutes === undefined) {
              next.punchOutOpenBeforeMinutes = 15;
            }
            if (next.punchOutCloseAfterMinutes === undefined) {
              next.punchOutCloseAfterMinutes = 15;
            }
            return next;
          });
        } catch (e) {
          console.error(e);
        }
      }
    };
    window.addEventListener('storage', handleSettingsUpdate);
    // Custom trigger for cross-tab or component updates
    window.addEventListener('hl_system_settings_updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('storage', handleSettingsUpdate);
      window.removeEventListener('hl_system_settings_updated', handleSettingsUpdate);
    };
  }, []);

  const [attendanceList, setAttendanceList] = useState<any[]>(() => {
    const wiped = localStorage.getItem('hl_hrm_attendance_force_wiped_v7');
    if (!wiped) {
      localStorage.removeItem('hl_hrm_attendance_v3');
      localStorage.setItem('hl_hrm_attendance_force_wiped_v7', 'true');
      return [];
    }
    const saved = localStorage.getItem('hl_hrm_attendance_v3');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn("Error parsing saved attendance data in dashboard overview", e);
      }
    }
    return [];
  });

  // Load attendance from Supabase on mount (dbService.attendance.list hits Supabase first)
  useEffect(() => {
    let mounted = true;
    dbService.attendance.list()
      .then(list => {
        if (mounted && Array.isArray(list) && list.length > 0) {
          setAttendanceList(list);
        }
      })
      .catch(err => console.warn('Lỗi khi tải chấm công từ Supabase:', err));
    return () => { mounted = false; };
  }, []);

  // Persist attendanceList changes to both dbService.attendance (Supabase+cache) and localStorage
  useEffect(() => {
    if (!attendanceList || attendanceList.length === 0) return;
    localStorage.setItem('hl_hrm_attendance_v3', JSON.stringify(attendanceList));
    // Non-blocking save each record to Supabase (debounce via last-write-wins on next effect)
    attendanceList.forEach((rec, i) => {
      if (i === attendanceList.length - 1) {
        dbService.attendance.save(rec).catch(err =>
          console.warn('Lỗi khi lưu chấm công lên Supabase:', err));
      }
    });
  }, [attendanceList]);

  const [selectedDayDetail, setSelectedDayDetail] = useState<{ date: string; log: any; holidayName?: string } | null>(null);

  // Listen for real-time changes to the attendance logs from the HRM module
  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setAttendanceList(customEvent.detail.attendance || customEvent.detail);
        // Persist synced data to Supabase
        const list = customEvent.detail.attendance || customEvent.detail;
        dbService.attendance.save(list[list.length - 1]).catch(() => {});
      }
    };
    window.addEventListener('hl-attendance-updated', handleSync);
    window.addEventListener('hl_attendance_changed_from_hrm', handleSync);
    return () => {
      window.removeEventListener('hl-attendance-updated', handleSync);
      window.removeEventListener('hl_attendance_changed_from_hrm', handleSync);
    };
  }, []);

  // Dispatch changes made dynamically within the Dashboard module to the HRM module
  useEffect(() => {
    if (attendanceList) {
      window.dispatchEvent(new CustomEvent('hl_attendance_changed_from_dashboard', { detail: attendanceList }));
    }
  }, [attendanceList]);

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
      const empDataStr = localStorage.getItem('hl_hrm_employees_v3');
      if (empDataStr) {
        const list = JSON.parse(empDataStr);
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
      }
    } catch (err) {
      console.error("Error loading approvers list:", err);
    }
    return defaultList;
  };

  const getLogAttendanceStats = (log: any) => {
    let lates = 0;
    let earlies = 0;
    let isLateMorning = false;
    let isEarlyMorning = false;
    let isLateAfternoon = false;
    let isEarlyAfternoon = false;

    if (!log) return { lates, earlies, isLateMorning, isEarlyMorning, isLateAfternoon, isEarlyAfternoon };

    // Ignore leave days and off symbols
    const isLeave = ['PN', 'P', 'KP', 'NL', 'T', 'C', 'OFF'].includes(log.timeInS) || 
                    log.status === 'excused' || 
                    log.notes?.toLowerCase().includes('nghỉ') || 
                    log.notes?.toLowerCase().includes('off');
    if (isLeave) return { lates, earlies, isLateMorning, isEarlyMorning, isLateAfternoon, isEarlyAfternoon };

    const targetInS = timeToMinutes(config.morningIn || '07:30');
    const targetOutS = timeToMinutes(config.morningOut || '11:30');
    const targetInC = timeToMinutes(config.afternoonIn || '13:00');
    const targetOutC = timeToMinutes(config.afternoonOut || '17:00');
    const allowedLates = config.allowedLateMinutes ?? 15;

    // 1. Ca Sáng
    if (log.timeInS && log.timeInS !== '--:--' && log.timeInS !== '' && !['PN', 'P', 'KP', 'NL', 'T', 'C', 'OFF'].includes(log.timeInS)) {
      const min = timeToMinutes(log.timeInS);
      if (min > (targetInS + allowedLates)) {
        lates++;
        isLateMorning = true;
      }
    }
    if (log.timeOutS && log.timeOutS !== '--:--' && log.timeOutS !== '') {
      const min = timeToMinutes(log.timeOutS);
      if (min < targetOutS) {
        earlies++;
        isEarlyMorning = true;
      }
    }

    // 2. Ca Chiều
    if (log.timeInC && log.timeInC !== '--:--' && log.timeInC !== '') {
      const min = timeToMinutes(log.timeInC);
      if (min > (targetInC + allowedLates)) {
        lates++;
        isLateAfternoon = true;
      }
    }
    if (log.timeOutC && log.timeOutC !== '--:--' && log.timeOutC !== '') {
      const min = timeToMinutes(log.timeOutC);
      if (min < targetOutC) {
        earlies++;
        isEarlyAfternoon = true;
      }
    }

    return { lates, earlies, isLateMorning, isEarlyMorning, isLateAfternoon, isEarlyAfternoon };
  };


  const getEmployeeId = (name: string): string => {
    const empDataStr = localStorage.getItem('hl_hrm_employees_v3');
    if (empDataStr) {
      try {
        const list = JSON.parse(empDataStr);
        const match = list.find((e: any) => e.name.toLowerCase() === name.toLowerCase());
        if (match) return match.id;
      } catch (e) {}
    }
    if (name.includes('Long')) return 'NV001';
    if (name.includes('Anh') || name.includes('Mai') || name.includes('Ngọc')) return 'NV002';
    if (name.includes('Sơn')) return 'NV019';
    if (name.includes('Quân')) return 'NV005';
    if (name.includes('Hà') || name.includes('Thảo')) return 'NV006';
    if (name.includes('Tiến')) return 'NV003';
    return 'NV999';
  };

  const empId = getEmployeeId(currentUser.name);

  const [hrmEmployees, setHrmEmployees] = useState<any[]>(() => {
    const saved = localStorage.getItem('hl_hrm_employees_v3');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const handleSyncEmployees = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setHrmEmployees(customEvent.detail);
      } else {
        const saved = localStorage.getItem('hl_hrm_employees_v3');
        if (saved) {
          setHrmEmployees(JSON.parse(saved));
        }
      }
    };
    window.addEventListener('hl_employees_changed_from_hrm', handleSyncEmployees);
    window.addEventListener('hl-employees-updated', handleSyncEmployees);
    window.addEventListener('storage', handleSyncEmployees);
    return () => {
      window.removeEventListener('hl_employees_changed_from_hrm', handleSyncEmployees);
      window.removeEventListener('hl-employees-updated', handleSyncEmployees);
      window.removeEventListener('storage', handleSyncEmployees);
    };
  }, []);

  const getCurrentEmployeeProfile = (): any => {
    const match = hrmEmployees.find((e: any) => e.name.toLowerCase() === currentUser.name.toLowerCase() || e.id === empId);
    if (match) return match;
    return null;
  };

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
  }, []);

  // Automatic 6 AM reset
  useEffect(() => {
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
                  if (l.isAttendanceCorrection || l.type === 'Yêu cầu xét duyệt công' || l.type === 'Báo cáo nghỉ ca' || l.type === 'Báo cáo lỗi chấm ra ca') return false;
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

        setAttendanceList(updatedList);
        localStorage.setItem('hl_hrm_attendance_v3', JSON.stringify(updatedList));
        localStorage.setItem('hl_attendance_last_reset_day_v3', todayVal);
        console.log(`⏱️ Đã tự động reset điểm danh đầu ca mới 6 AM ngày ${todayVal}`);
      }
    }
  }, [digitalTime, todayVal, attendanceList]);

  const [selectedSite, setSelectedSite] = useState(config.constructionSites[0] || 'Công trình Blue Sky');
  const [activePunchSlot, setActivePunchSlot] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [liveGpsCoords, setLiveGpsCoords] = useState<string>('');
  const [liveGpsAddr, setLiveGpsAddr] = useState<string>('');
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string>('');
  const [showPunchModal, setShowPunchModal] = useState(false);
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

  useEffect(() => {
    if (leaveModalOpen) {
      try {
        const saved = localStorage.getItem('hl_hrm_leave_coefs_v5');
        if (saved) {
          const parsed = JSON.parse(saved);
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
  }, [leaveModalOpen, todayVal]);

  const [leaveFrom, setLeaveFrom] = useState('2026-06-08');
  const [leaveTo, setLeaveTo] = useState('2026-06-09');
  const [leaveDays, setLeaveDays] = useState(2);

  // Auto-sync leaveDays when leaveFrom or leaveTo changes
  useEffect(() => {
    try {
      const start = new Date(leaveFrom);
      const end = new Date(leaveTo);
      const diff = end.getTime() - start.getTime();
      if (diff >= 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
        setLeaveDays(days);
      } else {
        setLeaveDays(0);
      }
    } catch (e) {
      setLeaveDays(0);
    }
  }, [leaveFrom, leaveTo]);

  const [leaveReasonText, setLeaveReasonText] = useState('');
  const [leaveApprover, setLeaveApprover] = useState('Trương Hữu Long');
  const [leaveApproverId, setLeaveApproverId] = useState('');
  const [leaveApproverPosition, setLeaveApproverPosition] = useState('');

  // Report Form state
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportApprover, setReportApprover] = useState('');
  const [reportStatusText, setReportStatusText] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportType, setReportType] = useState<'Báo cáo nghỉ ca' | 'Báo cáo lỗi chấm ra ca' | ''>('');
  const [reportShift, setReportShift] = useState<'morning' | 'afternoon' | ''>('');

  // Leaves list state
  const [dashLeaves, setDashLeaves] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('hl_hrm_leaves_v3');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const refreshDashLeaves = () => {
    try {
      const saved = localStorage.getItem('hl_hrm_leaves_v3');
      if (saved) {
        setDashLeaves(JSON.parse(saved));
      } else {
        setDashLeaves([]);
      }
    } catch (e) {}
  };

  // Listen for real-time leave updates
  useEffect(() => {
    const handleSyncLeaves = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setDashLeaves(customEvent.detail);
      }
    };
    window.addEventListener('hl_leaves_changed_from_hrm', handleSyncLeaves);
    return () => window.removeEventListener('hl_leaves_changed_from_hrm', handleSyncLeaves);
  }, []);

  useEffect(() => {
    if (dashLeaves) {
      window.dispatchEvent(new CustomEvent('hl_leaves_changed_from_dashboard', { detail: dashLeaves }));
    }
  }, [dashLeaves]);

  // Reset/initialize report states on day selection
  useEffect(() => {
    if (selectedDayDetail) {
      setShowReportForm(false);
      setReportReason('');
      
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
  const getLeaveDateWarningText = () => {
    try {
      if (!leaveFrom || !todayVal) return null;
      const todayMidnight = new Date(todayVal);
      todayMidnight.setHours(0,0,0,0);
      const fromMidnight = new Date(leaveFrom);
      fromMidnight.setHours(0,0,0,0);
      
      const timeDiff = fromMidnight.getTime() - todayMidnight.getTime();
      const diffDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      
      if (diffDays < 2) {
        return `⚠️ Bản đăng ký lỗi hạn! Phải xin nghỉ phép trước ít nhất 2 ngày kể từ ngày chấm hôm nay (Hôm nay: ${todayVal}).`;
      }
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
      // Nếu không tìm thấy, thử tìm theo ID từ hl_erp_employees (emp_xxx) qua tên
      if (!emp) {
        const erpEmpsStr = localStorage.getItem('hl_erp_employees');
        if (erpEmpsStr) {
          try {
            const erpEmps = JSON.parse(erpEmpsStr);
            const erpEmp = erpEmps.find((e: any) => e.id === memberId);
            if (erpEmp) {
              emp = hrmEmployees.find(e => e.name.toLowerCase() === erpEmp.name.toLowerCase());
            }
          } catch (e) {}
        }
      }
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

  const getSiteGpsInfo = (siteName: string) => {
    switch (siteName) {
      case 'Công trình Blue Sky':
        return { coords: '10.771142, 106.698031', location: '100 Lê Lợi, Bến Nghé, Quận 1, Tp. HCM' };
      case 'Xưởng mộc Hoàng Long':
        return { coords: '10.849409, 106.753705', location: '45 Đường số 9, Linh Tây, Thủ Đức, Tp. HCM' };
      case 'Bộ phận văn phòng chính':
        return { coords: '10.762622, 106.660172', location: '230 Ba Tháng Hai, Phường 12, Quận 10, Tp. HCM' };
      case 'Biệt thự SS400 Cát Lái':
        return { coords: '10.776101, 106.781812', location: 'Khu SS400 Nguyễn Thị Định, Cát Lái, Quận 2, Tp. HCM' };
      default:
        return { coords: '10.770000, 106.690000', location: 'Khu vực Công trình Ngoại vi' };
    }
  };

  useEffect(() => {
    if (showPunchModal) {
      setGpsLoading(true);
      setGpsErrorMsg('');
      setLiveGpsCoords('');
      setLiveGpsAddr('');

      if (!navigator.geolocation) {
        setGpsErrorMsg('Trình duyệt không hỗ trợ định vị GPS.');
        setGpsLoading(false);
        const defaultSite = config.constructionSites[0] || 'Công trình Blue Sky';
        setSelectedSite(defaultSite);
        const sInfo = getSiteGpsInfo(defaultSite);
        setLiveGpsCoords(sInfo.coords);
        setLiveGpsAddr(sInfo.location);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const coordsText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          setLiveGpsCoords(coordsText);

          const sites = [
            { name: 'Công trình Blue Sky', lat: 10.771142, lng: 106.698031, location: '100 Lê Lợi, Bến Nghé, Quận 1, Tp. HCM' },
            { name: 'Xưởng mộc Hoàng Long', lat: 10.849409, lng: 106.753705, location: '45 Đường số 9, Linh Tây, Thủ Đức, Tp. HCM' },
            { name: 'Bộ phận văn phòng chính', lat: 10.762622, lng: 106.660172, location: '230 Ba Tháng Hai, Phường 12, Quận 10, Tp. HCM' },
            { name: 'Biệt thự SS400 Cát Lái', lat: 10.776101, lng: 106.781812, location: 'Khu SS400 Nguyễn Thị Định, Cát Lái, Quận 2, Tp. HCM' }
          ];

          const calculateDist = (la1: number, lo1: number, la2: number, lo2: number) => {
            const R = 6371000;
            const dLa = (la2 - la1) * Math.PI / 180;
            const dLo = (lo2 - lo1) * Math.PI / 180;
            const a = Math.sin(dLa/2) * Math.sin(dLa/2) +
                      Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) *
                      Math.sin(dLo/2) * Math.sin(dLo/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
          };

          let nearestSite = sites[0];
          let minDist = calculateDist(lat, lng, sites[0].lat, sites[0].lng);

          for (let i = 1; i < sites.length; i++) {
            const dist = calculateDist(lat, lng, sites[i].lat, sites[i].lng);
            if (dist < minDist) {
              minDist = dist;
              nearestSite = sites[i];
            }
          }

          if (minDist <= 1500) {
            setSelectedSite(nearestSite.name);
          } else {
            setSelectedSite('Công trình Ngoại vi');
          }

          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi`);
            if (res.ok) {
              const resData = await res.json();
              if (resData && resData.display_name) {
                setLiveGpsAddr(resData.display_name);
              } else {
                setLiveGpsAddr(nearestSite.location);
              }
            } else {
              setLiveGpsAddr(nearestSite.location);
            }
          } catch (osmErr) {
            console.error('Nominatim call failed:', osmErr);
            setLiveGpsAddr(nearestSite.location);
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
          
          const defaultSite = config.constructionSites[0] || 'Công trình Blue Sky';
          setSelectedSite(defaultSite);
          const sInfo = getSiteGpsInfo(defaultSite);
          setLiveGpsCoords(sInfo.coords);
          setLiveGpsAddr(sInfo.location);
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    }
  }, [showPunchModal]);

  const captureSelfieFromStream = (): string => {
    if (videoRef.current && cameraStream) {
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
        console.error("Webcam capture error fallback to profile", e);
      }
    }
    
    // Customized placeholder based on current user
    if (currentUser.name?.toLowerCase().includes('long')) {
      return 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=150&auto=format&fit=crop&q=80';
    } else if (currentUser.name?.toLowerCase().includes('ngọc')) {
      return currentUser.gender === 'Nữ' 
        ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80';
    } else if (currentUser.name?.toLowerCase().includes('tiến')) {
      return 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80';
    } else if (currentUser.name?.toLowerCase().includes('ny')) {
      return 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80';
    }
    return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
  };

  // Confirm Punching slot
  const handleConfirmPunch = () => {
    if (!activePunchSlot) return;

    // Time punch format e.g. "07:30"
    const now = new Date();
    const punchedTime = now.toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' });

    // Look for record for current user on 2026-06-06
    const updated = [...attendanceList];
    let todayLog = updated.find(a => a.empName === currentUser.name && a.date === todayVal);

    const siteInfo = getSiteGpsInfo(selectedSite);
    const selfPhoto = captureSelfieFromStream();

    // ─── GUARD 1: Bản ghi đã bị khóa (đã chốt công) thì không cho chấm nữa ───
    if (todayLog && todayLog.isLocked) {
      stopCameraStream();
      setShowPunchModal(false);
      setActivePunchSlot(null);
      alert('🔒 Bản ghi chấm công ngày hôm nay đã được chốt (khóa). Vui lòng liên hệ HR/Admin nếu cần điều chỉnh.');
      return;
    }

    // ─── GUARD 2: Chặn re-punch (đã chấm slot này rồi) ───
    const slotAlreadyFilled = todayLog && todayLog[activePunchSlot] !== undefined &&
      todayLog[activePunchSlot] !== '--:--' && todayLog[activePunchSlot] !== '';
    if (slotAlreadyFilled) {
      stopCameraStream();
      setShowPunchModal(false);
      setActivePunchSlot(null);
      alert(`⚠️ Bạn đã chấm ${activePunchSlot.toUpperCase()} lúc ${todayLog![activePunchSlot]} rồi. Không thể chấm lại slot này.`);
      return;
    }

    // ─── GUARD 3: Kiểm tra khung giờ được phép chấm ───
    // Đọc cấu hình mới nhất từ localStorage để tránh state React bị trễ so với cài đặt
    const freshConfig = (() => {
      try {
        const saved = localStorage.getItem('hl_system_settings_v3');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    })();
    const mergedConfig = { ...config, ...freshConfig };
    const sessionGuardCheck = getSessionInfoWithConfig(activePunchSlot, mergedConfig);
    const currGuardMin = getCurrentMinute();
    if (!isTimeBetween(currGuardMin, sessionGuardCheck.sessionStartMin, sessionGuardCheck.sessionEndMin)) {
      stopCameraStream();
      setShowPunchModal(false);
      setActivePunchSlot(null);
      alert(`⛔ Ngoài khung giờ cho phép chấm công [${activePunchSlot.toUpperCase()}]. Khung giờ: ${sessionGuardCheck.sessionStartStr} - ${sessionGuardCheck.sessionEndStr}.`);
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
        alert(`⚠️ Chưa chấm ${inSlot.toUpperCase()} (vào ca). Vui lòng chấm vào ca trước khi chấm ra ca.`);
        return;
      }
    }

    if (!todayLog) {
      todayLog = {
        id: `AT-${Date.now().toString().slice(-4)}`,
        empId: empId,
        empName: currentUser.name,
        date: todayVal,
        timeInS: '--:--',
        timeOutS: '--:--',
        timeInC: '--:--',
        timeOutC: '--:--',
        timeInOT: '--:--',
        timeOutOT: '--:--',
        method: `GPS (${selectedSite})`,
        status: 'valid',
        otHours: 0,
        notes: 'Chấm công qua FaceID & định vị mạng trạm',
        photoIn: '',
        photoOut: '',
        locationIn: '',
        coordsIn: '',
        locationOut: '',
        coordsOut: '',
        isLocked: false
      };
      updated.unshift(todayLog);
    }

    // Set slot value
    todayLog[activePunchSlot] = punchedTime;
    todayLog.method = `GPS/FaceID (${selectedSite})`;

    // Check if slot name is an In slot or Out slot
    const isInSlot = activePunchSlot.toLowerCase().includes('in');
    if (isInSlot) {
      todayLog.photoIn = selfPhoto;
      todayLog.locationIn = liveGpsAddr || selectedSite;
      todayLog.coordsIn = liveGpsCoords || siteInfo.coords;
    } else {
      todayLog.photoOut = selfPhoto;
      todayLog.locationOut = liveGpsAddr || selectedSite;
      todayLog.coordsOut = liveGpsCoords || siteInfo.coords;
    }

    // Check-in status setup
    if (activePunchSlot === 'timeInS') {
      const hh = now.getHours();
      const mm = now.getMinutes();
      const checkInMin = hh * 60 + mm;
      const limitMin = timeToMinutes(config.morningIn || '07:30');
      const allowedLates = config.allowedLateMinutes ?? 15;
      if (checkInMin > (limitMin + allowedLates)) {
        todayLog.status = 'late';
        todayLog.notes = `Đi muộn ${checkInMin - limitMin} phút sáng. Địa điểm: ${selectedSite}`;
      } else {
        todayLog.status = 'valid';
        todayLog.notes = `Chấm công vào sáng chuẩn mực tại ${selectedSite}`;
      }
    } else if (activePunchSlot === 'timeInC') {
      const hh = now.getHours();
      const mm = now.getMinutes();
      const checkInMin = hh * 60 + mm;
      const limitMin = timeToMinutes(config.afternoonIn || '13:00');
      const allowedLates = config.allowedLateMinutes ?? 15;
      if (checkInMin > (limitMin + allowedLates)) {
        todayLog.status = 'late';
        todayLog.notes = `Đi muộn ${checkInMin - limitMin} phút chiều. Địa điểm: ${selectedSite}`;
      } else {
        todayLog.status = 'valid';
        todayLog.notes = `Chấm công vào chiều chuẩn mực tại ${selectedSite}`;
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

    // Save to local storage
    localStorage.setItem('hl_hrm_attendance_v3', JSON.stringify(updated));
    setAttendanceList(updated);

    // Stop camera and close
    stopCameraStream();
    setShowPunchModal(false);
    setActivePunchSlot(null);
    alert(`🎉 Đã chấm công [${activePunchSlot.toUpperCase()}] thành công lúc ${punchedTime} tại ${selectedSite}!`);
  };

  // Submit Leave Request
  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReasonText) {
      alert('Vui lòng nhập lý do xin nghỉ phép!');
      return;
    }

    // Constraint: must apply at least 2 days in advance of todayVal
    try {
      const todayMidnight = new Date(todayVal);
      todayMidnight.setHours(0,0,0,0);
      const fromMidnight = new Date(leaveFrom);
      fromMidnight.setHours(0,0,0,0);
      
      const timeDiff = fromMidnight.getTime() - todayMidnight.getTime();
      const diffDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      
      if (diffDays < 2) {
        alert("⚠️ Không thể nộp đơn nghỉ phép! Bạn không được phép nộp đơn xin nghỉ ngay trong ngày làm đơn hoặc ngày hôm sau (phép nghỉ bắt buộc phải đăng ký trước ít nhất 2 ngày).");
        return;
      }
    } catch (err) {
      console.error(err);
    }

    // Constraint: end date must be after or equal to start date
    if (new Date(leaveTo) < new Date(leaveFrom)) {
      alert("⚠️ Đến ngày không thể trước Từ ngày!");
      return;
    }

    // Constraint: Check if leaveRequestType is annual leave but user runs out or doesn't have enough remaining annual leave days
    if (leaveRequestType === 'Nghỉ phép năm') {
      const profile = getCurrentEmployeeProfile();
      const remainingDays = profile?.phepNam !== undefined ? profile.phepNam : 12;
      if (remainingDays <= 0) {
        alert("⚠️ Không thể nộp đơn! Bạn đã dùng hết số lượng phép năm được cấp (số ngày phép còn lại: 0).");
        return;
      }
      if (Number(leaveDays) > remainingDays) {
        alert(`⚠️ Không thể nộp đơn! Số ngày xin nghỉ phép năm (${leaveDays} ngày) vượt quá số ngày phép năm còn lại của bạn (${remainingDays} ngày).`);
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

    // Read stored leaves
    let currentLeaves: any[] = [];
    const saved = localStorage.getItem('hl_hrm_leaves_v3');
    if (saved) {
      try { currentLeaves = JSON.parse(saved); } catch (e) {}
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const submittedAtStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const newRequest = {
      id: `LR-${Date.now().toString().slice(-3)}`,
      empId: empId,
      empName: currentUser.name,
      type: leaveRequestType,
      fromDate: leaveFrom,
      toDate: leaveTo,
      daysCount: Number(leaveDays),
      reason: leaveReasonText,
      status: 'pending',
      createdAt: todayVal,
      submittedAt: submittedAtStr,
      approverName: leaveApprover || 'Trương Hữu Long',
      approverId: leaveApproverId || '',
      approverPosition: leaveApproverPosition || ''
    };

    const updated = [newRequest, ...currentLeaves];
    localStorage.setItem('hl_hrm_leaves_v3', JSON.stringify(updated));
    refreshDashLeaves();
    
    setLeaveReasonText('');
    setLeaveModalOpen(false);
    alert(`📬 Đơn xin nghỉ phép đã được nộp sang HỆ THỐNG NHÂN SỰ thành công!\nNgười duyệt: ${(leaveApprover || 'Trương Hữu Long')}${leaveApproverPosition ? ` (${leaveApproverPosition})` : ''}\nTrạng thái: Đang chờ duyệt.`);
  };

  // Submit attendance correction report
  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason) {
      alert("Vui lòng nhập lý do giải trình cụ thể!");
      return;
    }

    let currentLeaves: any[] = [];
    const saved = localStorage.getItem('hl_hrm_leaves_v3');
    if (saved) {
      try { currentLeaves = JSON.parse(saved); } catch (e) {}
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const submittedAtStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const newRequest = {
      id: `LR-${Date.now().toString().slice(-3)}`,
      empId: empId,
      empName: currentUser.name,
      type: reportType || 'Báo cáo nghỉ ca',
      shift: reportShift,
      fromDate: selectedDayDetail!.date,
      toDate: selectedDayDetail!.date,
      daysCount: 1,
      reason: `[${reportStatusText}] - Lý do: ${reportReason}`,
      status: 'pending',
      createdAt: todayVal,
      submittedAt: submittedAtStr,
      approverName: reportApprover || 'Trương Hữu Long',
      isAttendanceCorrection: true
    };

    const updated = [newRequest, ...currentLeaves];
    localStorage.setItem('hl_hrm_leaves_v3', JSON.stringify(updated));
    refreshDashLeaves();

    setShowReportForm(false);
    setReportReason('');
    setReportShift('');
    setReportType('');
    alert(`Báo cáo đã được gửi tới ${reportApprover || 'Trương Hữu Long'}, trạng thái: Chờ duyệt`);
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

    // 1. Ghi nhận dữ liệu sang chi tiết lương (Hệ thống nhân sự)
    let currentPayroll: any[] = [];
    const savedPayroll = localStorage.getItem('hl_hrm_payroll_v3');
    if (savedPayroll) {
      try { currentPayroll = JSON.parse(savedPayroll); } catch (err) {}
    }

    // Tìm xem đã có bản ghi bảng lương tháng của nhân sự này chưa
    let payrollItem = currentPayroll.find((p: any) => p.empName === currentUser.name && p.month === advancePeriod);
    if (payrollItem) {
      payrollItem.advances = (payrollItem.advances || 0) + amount;
      payrollItem.netSalary = payrollItem.netSalary - amount; // trừ tạm ứng trực tiếp
    } else {
      // Tạo mới
      payrollItem = {
        id: `PL-${Date.now().toString().slice(-4)}`,
        empId: empId,
        empName: currentUser.name,
        month: advancePeriod,
        baseSalary: isAdmin ? 45000000 : currentUser?.role === 'pm' ? 22000000 : isAccountant ? 18000000 : 14000000,
        workedDays: 22,
        otHours: 12,
        allowance: 3000000,
        kpiBonus: 1000000,
        advances: amount,
        tax: 0,
        insurance: 1500000,
        expenses: 0,
        netSalary: (isAdmin ? 45000000 : 14000000) - amount,
        status: 'unpaid'
      };
      currentPayroll.push(payrollItem);
    }

    localStorage.setItem('hl_hrm_payroll_v3', JSON.stringify(currentPayroll));

    // 2. Tạo Đề Xuất Tạm Ứng Lương (SubcontractorAdvanceProposal) - Gửi sang Đề Xuất Thu Chi
    // Loại: project_expense_proposal (đề xuất chi phí dự án - ứng lương nhân sự)
    const proposalId = `DX-${todayVal.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const approvals = undefined;

    const newProposal: SubcontractorAdvanceProposal = {
      id: proposalId,
      subcontractorId: empId,
      subcontractorName: currentUser.name,
      projectId: '', // Ứng lương nhân sự không gán dự án cụ thể
      projectName: 'Ứng Lương Nhân Sự',
      taskId: '',
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
      // Lưu vào IndexedDB qua dbService
      await dbService.subcontractorAdvances.save(newProposal);

      // Cập nhật localStorage để đồng bộ với FinanceManagement
      let existingProposals: SubcontractorAdvanceProposal[] = [];
      const savedProposals = localStorage.getItem('hl_subcontractor_advances');
      if (savedProposals) {
        try { existingProposals = JSON.parse(savedProposals); } catch (err) {}
      }
      existingProposals.unshift(newProposal); // Thêm lên đầu
      localStorage.setItem('hl_subcontractor_advances', JSON.stringify(existingProposals));

      // Trigger custom event để các component khác (FinanceManagement) cập nhật
      window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated', { detail: newProposal }));
    } catch (err) {
      console.error('Lỗi khi lưu đề xuất tạm ứng lương:', err);
      alert('❌ Có lỗi xảy ra khi gửi đề xuất. Vui lòng thử lại!');
      return;
    }

    setAdvanceAmountVal('');
    setAdvanceReasonText('');
    setAdvanceApproverId('');
    setAdvanceModalOpen(false);

    alert(`💰 Đã gửi Đề Xuất Tạm Ứng Lương thành công!\nMã đề xuất: ${proposalId}\nSố tiền: ${amount.toLocaleString('vi-VN')} đ\nNgười xét duyệt: ${finalApproverName}\nTrạng thái: Chờ duyệt\n\nNgười xét duyệt sẽ thấy đề xuất trong "Đề Xuất Thu Chi" và thực hiện duyệt để tạo Phiếu Chi Ứng Lương.`);
  };

  // Calc aggregated values for current employee
  const currentLogs = attendanceList.filter(a => a.empName === currentUser.name);

  // Load coefficients and holidays for unified workday calculation
  const dashCoefficients = (() => {
    try {
      const saved = localStorage.getItem('hl_hrm_leave_coefs_v6');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  })();

  const dashHolidays = (() => {
    try {
      const saved = localStorage.getItem('hl_hrm_holidays_v3');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  })();

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
  const countLateArrive = logsInMonth.reduce((sum, log) => {
    const stats = getLogAttendanceStats(log);
    return sum + stats.lates + stats.earlies;
  }, 0);

  // Real salary multiplier
  const userBaseSalary = isAdmin
    ? config.directorBaseSalary
    : currentUser?.role === 'pm'
      ? config.pmBaseSalary
      : isAccountant
        ? config.accountantBaseSalary
        : config.staffBaseSalary;
  const standardDailyRate = userBaseSalary / 26;
  const calcEstimatedSalary = Math.round((standardDailyRate * countAccumulatedDays) + (countOvertimeHours * (userBaseSalary / 26 / 8) * config.otMultiplier));

  // Get current today slots
  const userTodayLog = attendanceList.find(a => a.empName === currentUser.name && a.date === todayVal) || {
    timeInS: '--:--', timeOutS: '--:--', timeInC: '--:--', timeOutC: '--:--', timeInOT: '--:--', timeOutOT: '--:--'
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

  const getSubReport = (date: string, shift: 'morning' | 'afternoon') => {
    return (dashLeaves || []).find((l: any) => 
      l.fromDate === date && 
      l.shift === shift && 
      (l.type === 'Báo cáo nghỉ ca' || l.type === 'Báo cáo lỗi chấm ra ca')
    );
  };

  const renderReportButtonAndStatus = (shift: 'morning' | 'afternoon', isFaulty: boolean, isMissing: boolean) => {
    if (!selectedDayDetail) return null;
    if (selectedDayDetail.log.isLocked) return null;
    if (selectedDayDetail.log.timeInS === 'OFF') return null;

    const type = isFaulty ? ('Báo cáo lỗi chấm ra ca' as const) : ('Báo cáo nghỉ ca' as const);
    const statusLabel = isFaulty 
      ? `Thiếu điểm danh ra ca (${shift === 'morning' ? 'Ca Sáng' : 'Ca Chiều'})` 
      : `Vắng mặt / Không điểm danh (${shift === 'morning' ? 'Ca Sáng' : 'Ca Chiều'})`;
    
    const subReport = getSubReport(selectedDayDetail.date, shift);

    if (subReport) {
      if (subReport.status === 'pending') {
        return (
          <span className="inline-flex bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider">
            ⏳ Chờ duyệt
          </span>
        );
      } else if (subReport.status === 'approved') {
        return (
          <span className="inline-flex bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider">
            ✅ Đã duyệt
          </span>
        );
      } else if (subReport.status === 'rejected') {
        return (
          <div className="flex flex-col sm:flex-row items-center gap-1.5 shrink-0 mt-1">
            <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
              ❌ Bị từ chối
            </span>
            {isShiftEnded30Min(shift) ? (
              <button
                type="button"
                onClick={() => handleTriggerReport(shift, type, statusLabel)}
                className="bg-slate-800 hover:bg-slate-755 text-rose-405 border border-rose-500/20 px-2 py-0.5 rounded text-[9px] font-black cursor-pointer ml-1"
              >
                🔄 Báo cáo lại
              </button>
            ) : (
              <span className="text-[8px] text-slate-500 italic block mt-0.5">🔒 Đợi ca kết thúc 30p</span>
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
          onClick={() => handleTriggerReport(shift, type, statusLabel)}
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
  
  const handleTriggerReport = (shift: 'morning' | 'afternoon', type: 'Báo cáo nghỉ ca' | 'Báo cáo lỗi chấm ra ca', currentStatusText: string) => {
    setReportShift(shift);
    setReportType(type);
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


  return (
    <div className="space-y-6" id="personalized_dashboard">
      
      {/* CARD CHÀO MỪNG TIỂU SỬ KHÁCH HÀNG */}
      <div className={`${
        'bg-white border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
      } p-4 sm:p-6 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-200`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 ${
            'bg-emerald-50 text-emerald-700 border-emerald-200'
          } border rounded-full flex items-center justify-center font-extrabold text-lg shadow-inner`}>
            {currentUser.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-lg font-black tracking-tight ${'text-slate-800'}`}>Xin chào, {currentUser.name} 🧑‍💼</h2>
              <span className={`border text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${
                'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {isAdmin ? 'Giám Đốc' : isAccountant ? 'Kế Toán' : currentUser?.role === 'pm' ? 'QL Dự Án' : 'Thành Viên'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* --- HỆ THỐNG ĐIỂM DANH SINH TRẮC & ĐỊNH VỊ GPS REAL-TIME (Tích hợp như yêu cầu) --- */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6" id="realtime_biometric_timekeeping">
        
        {/* KHU VỰC QUÉT CHIA SẺ CAMERA VÀ GPS */}
        <div className="xl:col-span-2 bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                  HỆ THỐNG ĐIỂM DANH SINH TRẮC & GPS
                </span>
              </div>
            </div>
          </div>

          {/* CLOCK VÀ THỜI GIAN THỰC */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-850 text-center relative overflow-hidden backdrop-blur-sm shadow-inner">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none">
              <Fingerprint className="w-32 h-32 text-slate-450" />
            </div>
            
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">
              Thời gian hệ thống định chuẩn
            </span>
            <div className="text-4xl sm:text-5xl font-black text-white tracking-widest font-mono text-center select-all drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              {digitalTime || '16:43:39'}
            </div>
            <div className="text-xs font-black text-sky-400 uppercase tracking-widest text-center mt-2 block font-mono">
              {digitalDate || 'THỨ BẢY, 6 THÁNG 6'}
            </div>
          </div>
          {/* SLOTS CHẤM CÔNG THEO TỪNG CA (MỖI CA MỘT HÀNG GỌN GÀNG, TRỰC QUAN) */}
          <div className="space-y-4" id="shift-rows-container">
            
            {/* ===== HÀNG 1-3: CA SÁNG / CA CHIỀU / TĂNG CA — 1 nút trạng thái mỗi ca ===== */}
            {[
              {
                key: 'morning', slotIn: 'timeInS', slotOut: 'timeOutS',
                configIn: 'morningIn', configOut: 'morningOut',
                icon: Sun, label: 'Ca Sáng (Ca 1)', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
              },
              {
                key: 'afternoon', slotIn: 'timeInC', slotOut: 'timeOutC',
                configIn: 'afternoonIn', configOut: 'afternoonOut',
                icon: Compass, label: 'Ca Chiều (Ca 2)', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
              },
              {
                key: 'overtime', slotIn: 'timeInOT', slotOut: 'timeOutOT',
                configIn: 'overtimeIn', configOut: 'overtimeOut',
                icon: Moon, label: 'Tăng ca tối (OT)', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
              },
            ].map((item) => {
              const { key, slotIn, slotOut, configIn, configOut, icon: Icon, label, color } = item;
              const inVal = userTodayLog[slotIn];
              const outVal = userTodayLog[slotOut];
              const inCompleted = inVal !== '--:--' && inVal !== '';
              const outCompleted = outVal !== '--:--' && outVal !== '';
              const shiftActive = isShiftActive(key as any);

              // ─── Tính toán trạng thái nút theo khung giờ cấu hình ───
              const inInfo = getSessionInfo(slotIn);
              const outInfo = getSessionInfo(slotOut);
              const currMin = getCurrentMinute();

              // Determine single button label + action + sub-status
              let btnLabel: string;
              let btnSub: string;
              let btnAction: string;
              let isDisabled = false;
              let isLockedState = false;

              if (!inCompleted) {
                // Chưa vào ca → button VÀO
                if (isSlotActive(slotIn)) {
                  // Trong khung giờ → cho phép chấm
                  btnLabel = key === 'overtime' ? '🌙 VÀO TĂNG CA' : `🟢 VÀO ${key === 'morning' ? 'SÁNG' : 'CHIỀU'}`;
                  btnSub = '🕐 Trong khung giờ';
                  btnAction = slotIn;
                  isDisabled = false;
                } else if (currMin < inInfo.sessionStartMin) {
                  // Chưa đến giờ mở → chờ
                  btnLabel = key === 'overtime' ? '🌙 VÀO TĂNG CA' : `🟢 VÀO ${key === 'morning' ? 'SÁNG' : 'CHIỀU'}`;
                  btnSub = `⏳ Mở lúc ${inInfo.sessionStartStr}`;
                  btnAction = '';
                  isDisabled = true;
                  isLockedState = true;
                } else {
                  // Đã qua khung giờ → đóng
                  btnLabel = key === 'overtime' ? '🌙 VÀO TĂNG CA' : `🟢 VÀO ${key === 'morning' ? 'SÁNG' : 'CHIỀU'}`;
                  btnSub = `🔒 Hết giờ vào ca (${inInfo.sessionEndStr})`;
                  btnAction = '';
                  isDisabled = true;
                  isLockedState = true;
                }
              } else if (inCompleted && !outCompleted) {
                // Đã vào, chưa ra → button RA
                if (isSlotActive(slotOut)) {
                  // Trong khung giờ → cho phép chấm ra
                  btnLabel = key === 'overtime' ? '🌙 KẾT THÚC TĂNG CA' : `🔴 RA ${key === 'morning' ? 'SÁNG' : 'CHIỀU'}`;
                  btnSub = '🕐 Trong khung giờ';
                  btnAction = slotOut;
                  isDisabled = false;
                } else if (currMin < outInfo.sessionStartMin) {
                  // Chưa đến giờ mở ra ca → chờ đến giờ
                  btnLabel = key === 'overtime' ? '🌙 KẾT THÚC TĂNG CA' : `🔴 RA ${key === 'morning' ? 'SÁNG' : 'CHIỀU'}`;
                  btnSub = `⏳ Sẵn sàng lúc ${outInfo.sessionStartStr}`;
                  btnAction = '';
                  isDisabled = true;
                  isLockedState = true;
                } else {
                  // Đã qua khung giờ ra ca → đóng
                  btnLabel = key === 'overtime' ? '🌙 KẾT THÚC TĂNG CA' : `🔴 RA ${key === 'morning' ? 'SÁNG' : 'CHIỀU'}`;
                  btnSub = `🔒 Hết giờ ra ca (${outInfo.sessionEndStr})`;
                  btnAction = '';
                  isDisabled = true;
                  isLockedState = true;
                }
              } else {
                // Cả vào + ra đều đã chấm
                btnLabel = key === 'overtime'
                  ? `✅ Tăng ca: ${inVal} → ${outVal}`
                  : `✅ ${key === 'morning' ? 'Sáng' : 'Chiều'}: ${inVal} → ${outVal}`;
                btnSub = 'Đã chốt';
                btnAction = '';
                isDisabled = true;
                isLockedState = true;
              }

              // Nếu đã hoàn thành cả 2, show time + không cần xử lý
              return (
                <div
                  key={key}
                  className={`rounded-2xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 transition-all duration-300 border ${
                    shiftActive
                      ? 'bg-emerald-950/15 border-emerald-500/80 ring-2 ring-emerald-500/35 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                      : 'bg-slate-900 border-slate-800/80 hover:border-slate-700/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                          {label === 'Ca Sáng (Ca 1)' ? '🌅' : label === 'Ca Chiều (Ca 2)' ? '☀️' : '🌙'} {label}
                        </span>
                        {shiftActive && (
                          <span className="bg-emerald-500 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest flex items-center gap-1 animate-pulse">
                            <span className="w-1 h-1 rounded-full bg-slate-950 animate-ping"></span>
                            HIỆN TẠI
                          </span>
                        )}
                      </div>
                      <span className={`text-lg font-black font-mono block leading-none mt-1.5 ${
                        key === 'morning' ? 'text-sky-400' : key === 'afternoon' ? 'text-amber-450' : 'text-purple-400'
                      }`}>
                        {(config as any)[configIn] || (key === 'morning' ? '07:30' : key === 'afternoon' ? '13:00' : '17:45')}
                        {' — '}
                        {(config as any)[configOut] || (key === 'morning' ? '11:30' : key === 'afternoon' ? '17:00' : '20:45')}
                      </span>
                    </div>
                  </div>

                  {/* SINGLE CONTEXT-AWARE BUTTON */}
                  <div className="sm:w-80 w-full shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (btnAction) handlePunchClick(btnAction);
                      }}
                      disabled={isDisabled}
                      aria-disabled={isDisabled}
                      className={`w-full py-3 px-4 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all group ${
                        isDisabled
                          ? 'bg-slate-950/50 border-slate-800 text-slate-500 cursor-not-allowed pointer-events-none select-none opacity-70'
                          : shiftActive
                            ? 'bg-slate-950 hover:bg-slate-850 border-slate-700 text-slate-200 cursor-pointer hover:scale-[1.01] active:scale-[0.99] hover:border-sky-500/40'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 cursor-pointer hover:text-slate-200 hover:border-amber-400/40 hover:bg-slate-900'
                      }`}
                    >
                      <span className={`text-[11px] font-black uppercase tracking-wider ${
                        isDisabled ? '' : 'group-hover:text-white'
                      }`}>{btnLabel}</span>
                      <span className={`text-[8px] font-bold ${
                        isDisabled
                          ? (isLockedState && btnSub.includes('Hết giờ') ? 'text-rose-500/70' : 'text-amber-500/70')
                          : 'text-emerald-400/70'
                      }`}>{btnSub}</span>
                    </button>
                  </div>
                </div>
              );
            })}
            
          </div>
        </div>

        {/* CỘT BẢO CÁO CHỐNG CÔNG CÁ NHÂN & CHỨC NĂNG XIN PHÉP / ỨNG LƯƠNG */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-4 shadow-xl relative overflow-hidden">
          
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                BÁO CÁO CHẤM CÔNG CÁ NHÂN
              </span>
              <Fingerprint className="w-5 h-5 text-sky-400" />
            </div>

            <div className="space-y-4 py-4">
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-bold">NGÀY CÔNG TÍCH LŨY</span>
                <span className="text-sm font-black text-white font-mono">{countAccumulatedDays} ngày</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-bold">TĂNG CA THỰC TẾ</span>
                <span className="text-sm font-black text-amber-400 font-mono">{countOvertimeHours}h ({countOvertimeTimes} lần)</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-bold">VÀO MUỘN / VỀ SỚM</span>
                <span className="text-sm font-black text-rose-400 font-mono">{countLateArrive} lần</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-bold">NGHỈ PHÉP NĂM DUYỆT</span>
                <span className="text-sm font-black text-sky-400 font-mono">
                  {(() => {
                    const profile = getCurrentEmployeeProfile();
                    const remainingDays = profile?.phepNam !== undefined ? profile.phepNam : 12;
                    return `${remainingDays} / 12 lần`;
                  })()}
                </span>
              </div>

            </div>

            {/* LỊCH CHẤM CÔNG THÁNG HIỆN TẠI */}
            <div className="mt-2 border-t border-slate-800/80 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
                  📅 LỊCH THÁNG {todayVal.split('-')[1]}/{todayVal.split('-')[0]}
                </span>
                <span className="text-[10px] text-sky-400 font-bold font-mono">
                  {currentUser.name}
                </span>
              </div>
              
              <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-slate-500 mb-1">
                <div>T2</div>
                <div>T3</div>
                <div>T4</div>
                <div>T5</div>
                <div>T6</div>
                <div>T7</div>
                <div className="text-rose-450 font-extrabold text-[10px]">CN</div>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const [yStr, mStr] = todayVal.split('-');
                  const y = parseInt(yStr || '2026', 10);
                  const m = parseInt(mStr || '06', 10);
                  const daysInM = new Date(y, m, 0).getDate();
                  const firstDayIdx = new Date(y, m - 1, 1).getDay();
                  const startOffset = (firstDayIdx + 6) % 7;
                  
                  const getDayDots = (dateStr: string, log: any) => {
                    const dots: { color: string; label: string }[] = [];
                    const dObj = new Date(dateStr);
                    const dayOfWeek = dObj.getDay(); // 0 corresponds to Sunday, 6 to Saturday
                    const activeWeekends = config.weekendDays || [0];
                    const isWeekend = activeWeekends.includes(dayOfWeek);

                    if (log) {
                      // 1. Ca Sáng (Morning Shift)
                      if (log.timeInS === 'OFF') {
                        dots.push({ color: 'bg-rose-500', label: 'Sáng: Nghỉ' });
                      } else if (log.timeInS && log.timeInS !== '--:--' && log.timeInS !== '') {
                        const checkInMin = timeToMinutes(log.timeInS);
                        const limitMin = timeToMinutes(config.morningIn || '07:30');
                        const allowedLates = config.allowedLateMinutes ?? 15;
                        if (checkInMin > (limitMin + allowedLates)) {
                          dots.push({ color: 'bg-amber-500', label: 'Sáng: Muộn' });
                        } else {
                          dots.push({ color: 'bg-emerald-500', label: 'Sáng: Đúng giờ' });
                        }
                      } else {
                        if (dateStr < todayVal) {
                          dots.push({ color: 'bg-rose-500', label: 'Sáng: Không phép' });
                        }
                      }

                      // 2. Ca Chiều (Afternoon Shift)
                      if (log.timeInS === 'OFF') {
                        dots.push({ color: 'bg-rose-500', label: 'Chiều: Nghỉ' });
                      } else if (log.timeInC && log.timeInC !== '--:--' && log.timeInC !== '') {
                        const checkInMin = timeToMinutes(log.timeInC);
                        const limitMin = timeToMinutes(config.afternoonIn || '13:00');
                        const allowedLates = config.allowedLateMinutes ?? 15;
                        if (checkInMin > (limitMin + allowedLates)) {
                          dots.push({ color: 'bg-amber-500', label: 'Chiều: Muộn' });
                        } else {
                          dots.push({ color: 'bg-emerald-500', label: 'Chiều: Đúng giờ' });
                        }
                      } else {
                        if (dateStr < todayVal) {
                          dots.push({ color: 'bg-rose-500', label: 'Chiều: Không phép' });
                        }
                      }

                      // 3. Ca OT (Overtime Shift)
                      const hasOT = (log.timeInOT && log.timeInOT !== '--:--' && log.timeInOT !== '') || (log.otHours && log.otHours > 0);
                      if (hasOT) {
                        dots.push({ color: 'bg-purple-500', label: `OT: Hoàn thành (${log.otHours || 0}h)` });
                      }
                    } else {
                      // No log
                      if (dateStr < todayVal) {
                        if (!isWeekend) {
                          dots.push({ color: 'bg-rose-500', label: 'Sáng: Vắng mặt' });
                          dots.push({ color: 'bg-rose-500', label: 'Chiều: Vắng mặt' });
                        }
                      }
                    }
                    return dots.slice(0, 3);
                  };

                  const cells = [];
                  for (let i = 0; i < startOffset; i++) {
                    cells.push(<div key={`empty-${i}`} className="h-9 rounded bg-slate-950/20"></div>);
                  }

                  const holidayListRaw = localStorage.getItem('hl_hrm_holidays_v3');
                  const savedHolidays: { id: string; date: string; name: string }[] = holidayListRaw ? JSON.parse(holidayListRaw) : [];
                  
                  for (let d = 1; d <= daysInM; d++) {
                    const formattedD = String(d).padStart(2, '0');
                    const dateStr = `${y}-${mStr}-${formattedD}`;
                    
                    const holidayKey = `${formattedD}/${mStr}/${y}`;
                    const holidayMatch = savedHolidays.find(h => h.date === holidayKey);
                    
                    const log = currentLogs.find(a => a.date === dateStr);
                    const dObjCell = new Date(dateStr);
                    const activeWeekends = config.weekendDays || [0];
                    const isWeekendDay = activeWeekends.includes(dObjCell.getDay());
                    const weekdaysVN = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
                    const weekdayName = weekdaysVN[dObjCell.getDay()];

                    let cellClass = isWeekendDay 
                      ? "bg-rose-950/20 text-rose-300 border border-dashed border-rose-900/30 hover:bg-rose-950/25" 
                      : "bg-slate-950/50 text-slate-500 hover:bg-slate-850/50";
                    let titleText = isWeekendDay ? `Ngày ${d}/${m}: ${weekdayName} (Ngày nghỉ tuần)` : `Ngày ${d}/${m}: Chưa có dữ liệu`;
                    
                    if (holidayMatch) {
                      cellClass = "bg-amber-500/15 text-yellow-400 border border-amber-500/35 hover:bg-amber-500/25 font-bold";
                      titleText = `Ngày ${d}/${m}: Nghỉ Lễ (${holidayMatch.name})`;
                      if (log && ((log.timeInOT && log.timeInOT !== '--:--') || (log.otHours && log.otHours > 0))) {
                        cellClass = "bg-purple-500/20 text-purple-350 border border-purple-550/35 hover:bg-purple-500/30 font-bold";
                        titleText = `Ngày ${d}/${m}: Đi làm Lễ OT (${holidayMatch.name}) - ${log.otHours || 0}h`;
                      }
                    } else if (log) {
                      const isLeaveDay = log.status !== 'valid' && (log.status === 'excused' || ['PN', 'P', 'KP', 'NL', 'T', 'C', 'OFF'].includes(log.timeInS) || log.notes?.toLowerCase().includes('nghỉ') || log.notes?.toLowerCase().includes('off'));
                      const hasOT = (log.timeInOT && log.timeInOT !== '--:--' && log.timeInOT !== '') || (log.otHours && log.otHours > 0);
                      const stats = getLogAttendanceStats(log);
                      const isLate = stats.lates > 0 || log.status === 'late' || log.notes?.toLowerCase().includes('muộn') || log.notes?.toLowerCase().includes('trễ');
                      const hasTimeIn = log.timeInS && log.timeInS !== '--:--' && log.timeInS !== '' && !['PN', 'P', 'KP', 'NL', 'T', 'C', 'OFF'].includes(log.timeInS);
                      
                      if (isLeaveDay) {
                        cellClass = isWeekendDay
                          ? "bg-rose-900/25 text-rose-300 border border-rose-500/40 hover:bg-rose-900/30 font-bold"
                          : "bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25";
                        const sSymbol = log.leaveSymbol || (['PN', 'P', 'KP', 'NL', 'T', 'C', 'OFF'].includes(log.timeInS) ? log.timeInS : 'P');
                        titleText = `Ngày ${d}/${m}: Nghỉ phép được duyệt (${sSymbol})`;
                      } else if (hasOT) {
                        cellClass = "bg-purple-500/15 text-purple-350 border border-purple-550/30 hover:bg-purple-500/25";
                        titleText = `Ngày ${d}/${m}: Tăng ca OT (${log.otHours} giờ)`;
                      } else if (isLate) {
                        cellClass = "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25";
                        titleText = `Ngày ${d}/${m}: Đi làm muộn`;
                      } else if (hasTimeIn) {
                        cellClass = "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25";
                        titleText = `Ngày ${d}/${m}: Đi làm đúng giờ`;
                      }
                    } else {
                      const dObj = new Date(dateStr);
                      const dayOfWeek = dObj.getDay();
                      if (dateStr < todayVal) {
                        const isAWeekend = activeWeekends.includes(dayOfWeek);
                        if (!isAWeekend) {
                          cellClass = "bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 font-bold";
                          titleText = `Ngày ${d}/${m}: Nghỉ không phép / Vắng mặt`;
                        } else {
                          cellClass = "bg-rose-950/25 text-rose-400/90 border border-rose-800/40 hover:bg-rose-950/35 font-medium";
                          titleText = `Ngày ${d}/${m}: ${weekdayName} (Ngày nghỉ tuần)`;
                        }
                      } else if (dateStr === todayVal) {
                        const isAWeekend = activeWeekends.includes(dayOfWeek);
                        cellClass = isAWeekend
                          ? "border-2 border-dashed border-rose-500 bg-rose-950/30 text-rose-405 font-black animate-pulse"
                          : "border-2 border-dashed border-sky-500/50 bg-sky-950/20 text-sky-400 animate-pulse font-extrabold";
                        titleText = `Ngày ${d}/${m}: Hôm nay`;
                      } else {
                        const isAWeekend = activeWeekends.includes(dayOfWeek);
                        if (isAWeekend) {
                          cellClass = "bg-rose-950/15 text-rose-400/60 border border-dashed border-rose-900/25 hover:bg-rose-950/20 font-medium";
                          titleText = `Ngày ${d}/${m}: ${weekdayName} (Ngày nghỉ tuần)`;
                        } else {
                          titleText = `Ngày ${d}/${m}: Tương lai`;
                        }
                      }
                    }
                    
                    const dayDots = getDayDots(dateStr, log);
                    
                    const isClickable = !!log;
                    const isToday = dateStr === todayVal;
                    
                    cells.push(
                      <div
                        key={`day-${d}`}
                        onClick={() => {
                          if (log) {
                            setSelectedDayDetail({ date: dateStr, log, holidayName: holidayMatch?.name });
                          }
                        }}
                        className={`h-12 flex flex-col items-center justify-between py-1 rounded text-[10px] font-mono transition-all relative ${cellClass} ${
                          isClickable 
                            ? 'cursor-pointer hover:bg-emerald-900/35 hover:scale-105 active:scale-95 duration-100 border-2 border-emerald-500/10' 
                            : 'cursor-help'
                        } ${
                          isToday
                            ? 'ring-2 ring-emerald-500 ring-offset-1 ring-offset-slate-900 shadow-[0_0_15px_rgba(16,185,129,0.75)] border-emerald-400/80 z-20 scale-102 font-black'
                            : ''
                        }`}
                        title={isClickable ? `${titleText} - Nhấp để xem chi tiết ca 1, ca 2, đi muộn, tăng ca` : titleText}
                      >
                        {holidayMatch ? (
                          <span className="absolute top-0 right-0 text-[8px] text-amber-305 font-semibold bg-amber-950 px-0.5 rounded-bl border-b border-l border-amber-800/60 leading-none h-[11px] flex items-center uppercase tracking-tight z-10" title={`Nghỉ Lễ: ${holidayMatch.name}`}>
                            L
                          </span>
                        ) : log && (log.leaveSymbol || ['PN', 'P', 'KP', 'NL', 'T', 'C', 'OFF'].includes(log.timeInS)) ? (
                          <span className="absolute top-0 right-0 text-[7.5px] font-semibold text-rose-200 bg-rose-950 px-0.5 rounded-bl border-b border-l border-rose-800/60 leading-none h-[11px] flex items-center uppercase z-10">
                            {log.leaveSymbol || log.timeInS}
                          </span>
                        ) : null}
                        
                        <div className="flex items-center justify-center gap-1.5 leading-none mt-0.5">
                          {isToday && (
                            <span className="relative flex h-1.5 w-1.5 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                            </span>
                          )}
                          <span className={`font-bold text-[10.5px] leading-none ${isToday ? 'text-emerald-400 font-extrabold' : ''}`}>{d}</span>
                        </div>
                        
                        {log ? (
                          (() => {
                            const resDetail = computeDailyWorkday(
                              log,
                              dashCoefficients,
                              dashHolidays,
                              dashWeekendDays,
                              dashLeaves
                            );
                            return (
                              <div className="text-[10.5px] font-black text-emerald-400 whitespace-nowrap leading-none uppercase tracking-tighter">
                                {resDetail.label}
                              </div>
                            );
                          })()
                        ) : (
                          <span className="text-[7px] text-slate-650 leading-none">-</span>
                        )}
                      </div>
                    );
                  }
                  
                  return cells;
                })()}
              </div>

              <div className="mt-2 text-[9px] font-mono border-t border-slate-800/40 pt-2 shrink-0 flex items-center justify-center gap-1.5 text-emerald-400">
                <span className="h-2 w-2 relative flex shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-bold">🟢 Click vào ô xanh lá (số công) để xem chi tiết ca 1, ca 2, đi muộn, tăng ca.</span>
              </div>
            </div>

          </div>

          {/* QUICK ACTIONS: XIN NGHỈ PHÉP, ỨNG LƯƠNG NHANH, CHI TIẾT CHẤM CÔNG */}
          <div className="space-y-2.5 pt-3 border-t border-slate-800/80">
            <button
              onClick={() => {
                const configuredApprover = getConfiguredApprover('leave');
                if (configuredApprover) {
                  setLeaveApprover(configuredApprover.name);
                  setLeaveApproverId(configuredApprover.id);
                  setLeaveApproverPosition(configuredApprover.position || '');
                } else {
                  setLeaveApprover('Trương Hữu Long');
                  setLeaveApproverId('');
                  setLeaveApproverPosition('');
                }
                setLeaveModalOpen(true);
              }}
              className="w-full bg-slate-950 hover:bg-slate-850 text-slate-200 border border-slate-800 hover:border-slate-700 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <CalendarCheck className="w-4 h-4 text-sky-400" />
              XIN NGHỈ PHÉP
            </button>
            
            <button
              onClick={() => setAdvanceModalOpen(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-955 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md text-white"
            >
              <DollarSign className="w-4 h-4" />
              ĐỀ XUẤT ỨNG LƯƠNG NHANH
            </button>

            <button
              type="button"
              onClick={() => setShowDetailLogsModal(true)}
              className="w-full bg-slate-950 hover:bg-slate-850 text-slate-200 border border-slate-800 hover:border-slate-700 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Clock className="w-4 h-4 text-sky-450" />
              XEM CHI TIẾT CHẤM CÔNG
            </button>
          </div>

        </div>

      </div>

      {/* MODAL CHI TIẾT CHẤM CÔNG CỦA NGÀY (KHI CLICK VÀO NGÀY CÓ LOG) */}
      {selectedDayDetail && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn pointer-events-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative">
            
            <div className="p-4 bg-slate-950 border-b border-slate-850 flex items-center justify-between">
              <span className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                📅 CHI TIẾT NGÀY {selectedDayDetail.date}
              </span>
              <button
                type="button"
                onClick={() => setSelectedDayDetail(null)}
                className="text-slate-400 hover:text-white cursor-pointer bg-slate-800 hover:bg-slate-705 p-1 px-2.5 rounded transition-all font-black text-xs border border-transparent hover:border-slate-700"
              >
                ĐÓNG [X]
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto text-left">
              {/* Thông tin nhân viên */}
              <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-850/50 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-400 font-medium block">Nhân viên:</span>
                  <span className="text-white font-extrabold">{currentUser.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 font-medium block">Trạng thái chấm công:</span>
                  {(() => {
                    const st = getAttendanceStatusText(selectedDayDetail.log, readHrmConfigFromStorage());
                    const isGreen = st.isValid && selectedDayDetail.log.statusMsg !== 'Không hợp lệ' && selectedDayDetail.log.status !== 'invalid';
                    return (
                      <span className={`font-black uppercase tracking-wider text-[10px] ${
                        isGreen ? 'text-emerald-450' : 'text-rose-455'
                      }`}>
                        {selectedDayDetail.log.statusMsg || (st.isValid ? 'Hợp lệ' : 'Không hợp lệ')}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Ca 1 / Sáng */}
              <div className="bg-slate-950/30 p-3.5 rounded-xl border border-slate-850/60 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-850/50 pb-1.5">
                  <span className="font-extrabold text-[11px] text-emerald-400 tracking-wide">🌅 CA 1 (SÁNG)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Định mức: {config.morningIn} - {config.morningOut}</span>
                </div>
                {(() => {
                  if (selectedDayDetail.log.timeInS === 'OFF') {
                    return <div className="text-rose-455 font-bold text-center py-1">Đăng ký nghỉ phép / Off</div>;
                  }

                  const hasInS = !(!selectedDayDetail.log.timeInS || selectedDayDetail.log.timeInS === '--:--' || selectedDayDetail.log.timeInS === '');
                  const hasOutS = !(!selectedDayDetail.log.timeOutS || selectedDayDetail.log.timeOutS === '--:--' || selectedDayDetail.log.timeOutS === '');

                  const isMissingS = !hasInS && !hasOutS;
                  const isFaultyS = hasInS && !hasOutS;

                  if (isMissingS) {
                    return (
                      <div className="flex flex-col items-center justify-center p-3 bg-red-950/10 border border-dashed border-red-900/20 rounded-xl space-y-2 py-2.5">
                        <span className="text-slate-500 italic text-[11px]">Không có lịch sử check-in Ca Sáng</span>
                        {renderReportButtonAndStatus('morning', false, true)}
                      </div>
                    );
                  }

                  if (isFaultyS) {
                    return (
                      <div className="grid grid-cols-2 gap-2 text-slate-350 font-mono items-center">
                        <div>
                          <span className="text-slate-505 block text-[10px]">Giờ vào:</span>
                          <strong className="text-white font-mono text-sm">{selectedDayDetail.log.timeInS}</strong>
                          {(() => {
                            const inMin = timeToMinutes(selectedDayDetail.log.timeInS);
                            const limitMin = timeToMinutes(config.morningIn || '07:30');
                            const allowedLates = config.allowedLateMinutes ?? 15;
                            return inMin > (limitMin + allowedLates) ? (
                              <span className="text-amber-400 font-bold text-[9px] block">⏱️ Đi muộn {inMin - limitMin}p</span>
                            ) : (
                              <span className="text-emerald-450 font-bold text-[9px] block">✅ Đúng giờ</span>
                            );
                          })()}
                        </div>
                        <div className="space-y-1">
                          <div>
                            <span className="text-slate-505 block text-[10px]">Giờ ra:</span>
                            <strong className="text-white font-mono text-sm">--:--</strong>
                          </div>
                          <div className="pt-0.5">
                            {renderReportButtonAndStatus('morning', true, false)}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-2 gap-2 text-slate-350 font-mono">
                      <div>
                        <span className="text-slate-505 block text-[10px]">Giờ vào:</span>
                        <strong className="text-white font-mono text-sm">{selectedDayDetail.log.timeInS}</strong>
                        {(() => {
                          const inMin = timeToMinutes(selectedDayDetail.log.timeInS);
                          const limitMin = timeToMinutes(config.morningIn || '07:30');
                          const allowedLates = config.allowedLateMinutes ?? 15;
                          return inMin > (limitMin + allowedLates) ? (
                            <span className="text-amber-400 font-bold text-[9px] block">⏱️ Đi muộn {inMin - limitMin}p</span>
                          ) : (
                            <span className="text-emerald-450 font-bold text-[9px] block">✅ Đúng giờ</span>
                          );
                        })()}
                      </div>
                      <div>
                        <span className="text-slate-505 block text-[10px]">Giờ ra:</span>
                        <strong className="text-white font-mono text-sm">{selectedDayDetail.log.timeOutS || '--:--'}</strong>
                      </div>
                    </div>
                  );
                })()}

                {showReportForm && reportShift === 'morning' && (
                  <form onSubmit={handleReportSubmit} className="space-y-3 pt-3 border-t border-slate-800/60 animate-fadeIn text-left mt-2">
                    <div>
                      <label className="block text-[9px] text-slate-400 font-bold mb-1 uppercase tracking-wider">Loại đơn báo cáo</label>
                      <input
                        type="text"
                        value={reportType}
                        readOnly
                        className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-sky-400 outline-none cursor-not-allowed font-extrabold"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[9px] text-slate-400 font-bold mb-1 uppercase tracking-wider">NGƯỜI XÉT DUYỆT</label>
                      <select
                        value={reportApprover}
                        onChange={(e) => setReportApprover(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none font-bold"
                      >
                        {getApproversList().map((ap, idx) => (
                          <option key={idx} value={ap.name} className="bg-slate-900">
                            {ap.name} ({ap.role})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-400 font-bold mb-1 uppercase tracking-wider">LÝ DO GIẢI TRÌNH CỤ THỂ</label>
                      <textarea
                        required
                        placeholder="Giải thích lý do quên chấm công hoặc lý do vắng ca chi tiết..."
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none h-16 resize-none"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowReportForm(false);
                          setReportShift('');
                          setReportType('');
                        }}
                        className="bg-slate-800 hover:bg-slate-755 text-slate-300 text-[10px] px-2.5 py-1 rounded font-bold cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="bg-sky-500 hover:bg-sky-450 text-white text-[10px] px-3 py-1 rounded font-black cursor-pointer shadow-md"
                      >
                        Gửi yêu cầu giải trình 🚀
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Ca 2 / Chiều */}
              <div className="bg-slate-950/30 p-3.5 rounded-xl border border-slate-850/60 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-850/50 pb-1.5">
                  <span className="font-extrabold text-[11px] text-sky-400 tracking-wide">🌇 CA 2 (CHIỀU)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Định mức: {config.afternoonIn} - {config.afternoonOut}</span>
                </div>
                
                {(() => {
                  if (selectedDayDetail.log.timeInS === 'OFF') {
                    return <div className="text-rose-455 font-bold text-center py-1">Đăng ký nghỉ phép / Off</div>;
                  }

                  const hasInC = !(!selectedDayDetail.log.timeInC || selectedDayDetail.log.timeInC === '--:--' || selectedDayDetail.log.timeInC === '');
                  const hasOutC = !(!selectedDayDetail.log.timeOutC || selectedDayDetail.log.timeOutC === '--:--' || selectedDayDetail.log.timeOutC === '');

                  const isMissingC = !hasInC && !hasOutC;
                  const isFaultyC = hasInC && !hasOutC;

                  if (isMissingC) {
                    return (
                      <div className="flex flex-col items-center justify-center p-3 bg-red-950/10 border border-dashed border-red-900/20 rounded-xl space-y-2 py-2.5">
                        <span className="text-slate-505 italic text-[11px]">Không có lịch sử check-in Ca Chiều</span>
                        {renderReportButtonAndStatus('afternoon', false, true)}
                      </div>
                    );
                  }

                  if (isFaultyC) {
                    return (
                      <div className="grid grid-cols-2 gap-2 text-slate-350 font-mono items-center">
                        <div>
                          <span className="text-slate-505 block text-[10px]">Giờ vào:</span>
                          <strong className="text-white font-mono text-sm">{selectedDayDetail.log.timeInC}</strong>
                          {(() => {
                            const inMin = timeToMinutes(selectedDayDetail.log.timeInC);
                            const limitMin = timeToMinutes(config.afternoonIn || '13:00');
                            const allowedLates = config.allowedLateMinutes ?? 15;
                            return inMin > (limitMin + allowedLates) ? (
                              <span className="text-amber-400 font-bold text-[9px] block">⏱️ Đi muộn {inMin - limitMin}p</span>
                            ) : (
                              <span className="text-emerald-455 font-bold text-[9px] block">✅ Đúng giờ</span>
                            );
                          })()}
                        </div>
                        <div className="space-y-1">
                          <div>
                            <span className="text-slate-505 block text-[10px]">Giờ ra:</span>
                            <strong className="text-white font-mono text-sm">--:--</strong>
                          </div>
                          <div className="pt-0.5">
                            {renderReportButtonAndStatus('afternoon', true, false)}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-2 gap-2 text-slate-350 font-mono">
                      <div>
                        <span className="text-slate-505 block text-[10px]">Giờ vào:</span>
                        <strong className="text-white font-mono text-sm">{selectedDayDetail.log.timeInC}</strong>
                        {(() => {
                          const inMin = timeToMinutes(selectedDayDetail.log.timeInC);
                          const limitMin = timeToMinutes(config.afternoonIn || '13:00');
                          const allowedLates = config.allowedLateMinutes ?? 15;
                          return inMin > (limitMin + allowedLates) ? (
                            <span className="text-amber-400 font-bold text-[9px] block">⏱️ Đi muộn {inMin - limitMin}p</span>
                          ) : (
                            <span className="text-emerald-455 font-bold text-[9px] block">✅ Đúng giờ</span>
                          );
                        })()}
                      </div>
                      <div>
                        <span className="text-slate-505 block text-[10px]">Giờ ra:</span>
                        <strong className="text-white font-mono text-sm">{selectedDayDetail.log.timeOutC || '--:--'}</strong>
                      </div>
                    </div>
                  );
                })()}

                {showReportForm && reportShift === 'afternoon' && (
                  <form onSubmit={handleReportSubmit} className="space-y-3 pt-3 border-t border-slate-800/60 animate-fadeIn text-left mt-2">
                    <div>
                      <label className="block text-[9px] text-slate-400 font-bold mb-1 uppercase tracking-wider">Loại đơn báo cáo</label>
                      <input
                        type="text"
                        value={reportType}
                        readOnly
                        className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-sky-400 outline-none cursor-not-allowed font-extrabold"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[9px] text-slate-400 font-bold mb-1 uppercase tracking-wider">NGƯỜI XÉT DUYỆT</label>
                      <select
                        value={reportApprover}
                        onChange={(e) => setReportApprover(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none font-bold"
                      >
                        {getApproversList().map((ap, idx) => (
                          <option key={idx} value={ap.name} className="bg-slate-900">
                            {ap.name} ({ap.role})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-400 font-bold mb-1 uppercase tracking-wider">LÝ DO GIẢI TRÌNH CỤ THỂ</label>
                      <textarea
                        required
                        placeholder="Giải thích lý do quên chấm công hoặc lý do vắng ca chi tiết..."
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none h-16 resize-none"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowReportForm(false);
                          setReportShift('');
                          setReportType('');
                        }}
                        className="bg-slate-800 hover:bg-slate-755 text-slate-300 text-[10px] px-2.5 py-1 rounded font-bold cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="bg-sky-500 hover:bg-sky-450 text-white text-[10px] px-3 py-1 rounded font-black cursor-pointer shadow-md"
                      >
                        Gửi yêu cầu giải trình 🚀
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Tăng ca (OT) */}
              {((selectedDayDetail.log.timeInOT && selectedDayDetail.log.timeInOT !== '--:--') || (selectedDayDetail.log.otHours && selectedDayDetail.log.otHours > 0)) ? (
                <div className="bg-purple-950/20 p-3.5 rounded-xl border border-purple-500/20 space-y-2 mt-2">
                  <div className="flex items-center justify-between border-b border-purple-500/10 pb-1.5">
                    <span className="font-extrabold text-[11px] text-purple-400 tracking-wide">🌌 TĂNG CA (OVERTIME)</span>
                    <span className="text-[10px] text-purple-300 font-mono font-bold">Tích lũy: {selectedDayDetail.log.otHours || 0} giờ</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-purple-200">
                    <div>
                      <span className="text-purple-400/60 block text-[10px]">Giờ vào OT:</span>
                      <strong className="font-mono text-sm">{selectedDayDetail.log.timeInOT || '--:--'}</strong>
                    </div>
                    <div>
                      <span className="text-purple-400/60 block text-[10px]">Giờ ra OT:</span>
                      <strong className="font-mono text-sm">{selectedDayDetail.log.timeOutOT || '--:--'}</strong>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Ảnh chấm công & GPS thiết bị nếu có */}
              {(selectedDayDetail.log.photoIn || selectedDayDetail.log.photoOut || selectedDayDetail.log.coordsIn || selectedDayDetail.log.coordsOut) && (
                <div className="bg-slate-950/45 p-3.5 rounded-xl border border-slate-850/60 space-y-2 mt-2">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">HÌNH ẢNH & ĐỊA ĐIỂM XÁC THỰC:</span>
                  <div className="flex flex-wrap items-center gap-3">
                    {selectedDayDetail.log.photoIn && (
                      <button 
                        type="button"
                        className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 cursor-zoom-in hover:border-sky-500/50 transition-all text-left"
                        onClick={() => setZoomedImage(selectedDayDetail.log.photoIn)}
                      >
                        <img src={selectedDayDetail.log.photoIn} className="w-8 h-8 rounded-md object-cover border border-slate-700" alt="Selfie Vào" referrerPolicy="no-referrer" />
                        <span className="text-slate-300 font-medium text-[10px]">Ảnh Vào</span>
                      </button>
                    )}
                    {selectedDayDetail.log.photoOut && (
                      <button 
                        type="button"
                        className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 cursor-zoom-in hover:border-sky-500/50 transition-all text-left"
                        onClick={() => setZoomedImage(selectedDayDetail.log.photoOut)}
                      >
                        <img src={selectedDayDetail.log.photoOut} className="w-8 h-8 rounded-md object-cover border border-slate-700" alt="Selfie Ra" referrerPolicy="no-referrer" />
                        <span className="text-slate-300 font-medium text-[10px]">Ảnh Ra</span>
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 mt-1 text-[10px] text-slate-400">
                    {selectedDayDetail.log.coordsIn && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedDayDetail.log.coordsIn)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline flex items-center gap-1 text-sky-400"
                        title="Xem trên Google Maps"
                      >
                        🗺️ Vào: {selectedDayDetail.log.locationIn || 'Công trình'} ({selectedDayDetail.log.coordsIn})
                      </a>
                    )}
                    {selectedDayDetail.log.coordsOut && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedDayDetail.log.coordsOut)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline flex items-center gap-1 text-sky-455"
                        title="Xem trên Google Maps"
                      >
                        🗺️ Ra: {selectedDayDetail.log.locationOut || 'Công trình'} ({selectedDayDetail.log.coordsOut})
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Ghi chú & Trạng thái hệ thống */}
              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-850/40 text-slate-400">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">Ghi chú từ hệ thống:</span>
                <p className="italic mt-1 leading-relaxed text-slate-300 text-[11px]">
                  {selectedDayDetail.log.notes || "Không có ghi chú đặc biệt."}
                </p>
                {selectedDayDetail.log.isLocked && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 mt-2 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/20">
                    🔒 BẢN GHI ĐÃ KHÓA CHỐT CÔNG
                  </span>
                )}
              </div>

            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-850 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDayDetail(null)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-955 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md text-white active:scale-95"
              >
                Xác nhận & Đóng
              </button>
            </div>

          </div>
        </div>
      )}

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
                      <td className="p-3 font-mono text-slate-300 font-bold">{userTodayLog.timeInS || '--:--'} - {userTodayLog.timeOutS || '--:--'}</td>
                      <td className="p-3 font-mono text-slate-300 font-bold">{userTodayLog.timeInC || '--:--'} - {userTodayLog.timeOutC || '--:--'}</td>
                      <td className="p-3 font-mono text-slate-300 font-bold">{userTodayLog.timeInOT || '--:--'} - {userTodayLog.timeOutOT || '--:--'}</td>
                      <td className="p-3 text-slate-400 leading-tight">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black px-1.5 py-0.2 rounded uppercase tracking-wide">
                            Live Session
                          </span>
                          <span>{userTodayLog.notes || `Chưa thực hiện chấm công ca hôm nay.`}</span>
                        </div>
                        
                        {/* Live Session Photo & GPS links */}
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {userTodayLog.photoIn && (
                            <button 
                              type="button" 
                              onClick={() => setZoomedImage(userTodayLog.photoIn)}
                              className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-[10px] cursor-zoom-in hover:border-sky-500/50 transition-colors"
                            >
                              <img src={userTodayLog.photoIn} className="w-4.5 h-4.5 rounded object-cover border border-slate-705" alt="Selfie Vào" referrerPolicy="no-referrer" />
                              <span className="text-slate-400">Ảnh Vào</span>
                            </button>
                          )}
                          {userTodayLog.photoOut && (
                            <button 
                              type="button" 
                              onClick={() => setZoomedImage(userTodayLog.photoOut)}
                              className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-[10px] cursor-zoom-in hover:border-sky-500/50 transition-colors"
                            >
                              <img src={userTodayLog.photoOut} className="w-4.5 h-4.5 rounded object-cover border border-slate-705" alt="Selfie Ra" referrerPolicy="no-referrer" />
                              <span className="text-slate-400">Ảnh Ra</span>
                            </button>
                          )}
                          {userTodayLog.coordsIn && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(userTodayLog.coordsIn)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-400 hover:underline bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono text-[9px]"
                              title="Click để xem trên Google Maps"
                            >
                              🗺️ Vào: {userTodayLog.locationIn || selectedSite} ({userTodayLog.coordsIn})
                            </a>
                          )}
                          {userTodayLog.coordsOut && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(userTodayLog.coordsOut)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-400 hover:underline bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono text-[9px]"
                              title="Click để xem trên Google Maps"
                            >
                              🗺️ Ra: {userTodayLog.locationOut || selectedSite} ({userTodayLog.coordsOut})
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                    {currentLogs.filter(a => a.date !== todayVal).map((log, index) => (
                      <tr key={index} className="border-b border-slate-800/60 hover:bg-slate-850/20 transition-colors">
                        <td className="p-3 font-bold text-slate-300 font-mono">{log.date}</td>
                        <td className="p-3 font-mono text-slate-400">{log.timeInS || '07:25'} - {log.timeOutS || '11:32'}</td>
                        <td className="p-3 font-mono text-slate-400">{log.timeInC || '12:55'} - {log.timeOutC || '17:05'}</td>
                        <td className="p-3 font-mono text-slate-400">{log.timeInOT && log.timeInOT !== '--:--' ? `${log.timeInOT} - ${log.timeOutOT}` : 'Không OT'}</td>
                        <td className="p-3 text-slate-400">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            {(() => {
                              const st = getAttendanceStatusText(log, readHrmConfigFromStorage());
                              return (
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase select-none ${
                                  st.isValid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                  'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}>
                                  {st.text}
                                </span>
                              );
                            })()}
                            <span>{log.notes || `Chấm công FaceID & định vị tọa độ`} • OT {log.otHours || 0}H</span>
                          </div>

                          {/* Historical Log Photo & GPS Links */}
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {log.photoIn && (
                              <button 
                                type="button" 
                                onClick={() => setZoomedImage(log.photoIn)}
                                className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-[10px] cursor-zoom-in hover:border-sky-500/50 transition-colors"
                              >
                                <img src={log.photoIn} className="w-4.5 h-4.5 rounded object-cover border border-slate-705" alt="Selfie Vào" referrerPolicy="no-referrer" />
                                <span className="text-slate-400">Ảnh Vào</span>
                              </button>
                            )}
                            {log.photoOut && (
                              <button 
                                type="button" 
                                onClick={() => setZoomedImage(log.photoOut)}
                                className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-[10px] cursor-zoom-in hover:border-sky-500/50 transition-colors"
                              >
                                <img src={log.photoOut} className="w-4.5 h-4.5 rounded object-cover border border-slate-705" alt="Selfie Ra" referrerPolicy="no-referrer" />
                                <span className="text-slate-400">Ảnh Ra</span>
                              </button>
                            )}
                            {log.coordsIn && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(log.coordsIn)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-400 hover:underline bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono text-[9px]"
                                title="Click để xem trên Google Maps"
                              >
                                🗺️ Vào: {log.locationIn || 'Công trình'} ({log.coordsIn})
                              </a>
                            )}
                            {log.coordsOut && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(log.coordsOut)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-450 hover:underline bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono text-[9px]"
                                title="Click để xem trên Google Maps"
                              >
                                🗺️ Ra: {log.locationOut || 'Công trình'} ({log.coordsOut})
                              </a>
                            )}
                          </div>
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
              
              {/* CAMERA FEED OR SIMULATOR */}
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
                  // Animated fall-back simulator
                  <div className="text-center p-5 space-y-3 w-full h-full flex flex-col justify-center items-center bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-850">
                    <div className="relative">
                      <Fingerprint className="w-16 h-16 text-sky-400 animate-pulse mx-auto" />
                      <div className="absolute inset-0 border-2 border-sky-400/20 rounded-full animate-ping scale-125"></div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-300 font-black">QUÉT SINH TRẮC HỌC HOÀNG LONG ERP</p>
                      <p className="text-[10px] text-slate-500 mt-1">Đang giả lập nhận dạng khuôn mặt bằng AI 3D Mesh...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* GPS STATE INFO */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850 text-left space-y-1.5 text-[11px]">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-slate-500 font-bold shrink-0">ĐỊA ĐIỂM DỰ KIẾN:</span>
                  <span className="text-slate-300 font-black font-mono uppercase text-sky-400 text-right">{selectedSite}</span>
                </div>
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
                  className="flex-1 bg-sky-500 hover:bg-sky-400 text-white text-xs py-2 rounded-xl font-black text-center flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-white" />
                  CHỤP ẢNH & CHẤM CÔNG
                </button>
              </div>

            </div>

          </div>
        </div>
      )}


      {/* MODAL 2: XIN NGHỈ PHÉP (NỘP HỆ THỐNG NHÂN SỰ) */}
      {leaveModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn" id="leave_request_submission_modal">
          <form onSubmit={handleLeaveSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative">
            
            <div className="p-4 bg-slate-950 border-b border-slate-850 flex items-center justify-between">
              <span className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                📅 LẬP ĐƠN NGHỈ PHÉP & CHI TIẾT NHÂN SỰ
              </span>
              <button
                type="button"
                onClick={() => setLeaveModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto pr-2">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Người làm đơn</label>
                  <input
                    type="text"
                    value={currentUser.name}
                    readOnly
                    className="w-full bg-slate-950 border border-slate-805 rounded-lg px-3 py-1.5 text-xs text-slate-400 font-bold outline-none cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Loại phép</label>
                  <select
                    value={leaveRequestType}
                    onChange={(e) => setLeaveRequestType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
                  >
                    {leaveTypes.map((type) => (
                      <option key={type} value={type} className="bg-slate-900">
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Thống kê phép năm */}
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-bold">Thống kê phép năm của bạn:</span>
                <span className="font-mono text-cyan-400 font-extrabold">
                  {(() => {
                    const profile = getCurrentEmployeeProfile();
                    const remainingDays = profile?.phepNam !== undefined ? profile.phepNam : 12;
                    return `Còn dư: ${remainingDays} / 12 lần`;
                  })()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">TỪ NGÀY</label>
                  <input
                    type="date"
                    value={leaveFrom}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLeaveFrom(val);
                      try {
                        const d = new Date(val);
                        d.setDate(d.getDate() + 1);
                        setLeaveTo(d.toISOString().split('T')[0]);
                      } catch (err) {}
                    }}
                    className={`w-full bg-slate-950 border rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500 font-mono ${leaveDateWarningMessage ? 'border-amber-500/80 ring-1 ring-amber-500/20' : 'border-slate-800'}`}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">ĐẾN NGÀY</label>
                  <input
                    type="date"
                    value={leaveTo}
                    onChange={(e) => setLeaveTo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500 font-mono"
                  />
                </div>
              </div>

              {leaveDateWarningMessage && (
                <div className="bg-amber-550/10 border border-amber-500/20 text-amber-500 p-2.5 rounded-lg text-[10.5px] font-bold leading-normal animate-fadeIn">
                  {leaveDateWarningMessage}
                </div>
              )}

              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">TỔNG SỐ NGÀY ĐỀ NGHỊ</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={leaveDays}
                  readOnly
                  disabled
                  className="w-full bg-slate-950/70 border border-slate-805 rounded-lg px-3 py-1.5 text-xs text-slate-400 font-bold outline-none cursor-not-allowed font-mono shadow-inner"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">NGƯỜI XÉT DUYỆT</label>
                {(() => {
                  const configuredApprover = getConfiguredApprover('leave');
                  if (configuredApprover) {
                    const approverPos = configuredApprover.position ? ` (${configuredApprover.position})` : '';
                    return (
                      <div className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 flex items-center justify-between">
                        <span className="font-bold">{configuredApprover.name}{approverPos}</span>
                        <span className="text-[10px] bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded">Đã khóa · Tự động</span>
                      </div>
                    );
                  }
                  return (
                    <select
                      value={leaveApprover}
                      onChange={(e) => {
                        const emp = hrmEmployees.find((em: any) => em.name === e.target.value);
                        setLeaveApprover(e.target.value);
                        setLeaveApproverId(emp?.id || '');
                        setLeaveApproverPosition(emp?.position || '');
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500 cursor-pointer"
                    >
                      <option value="">Chọn người xét duyệt...</option>
                      {hrmEmployees.map((emp: any) => (
                        <option key={emp.id} value={emp.name}>
                          {emp.name} ({emp.position || emp.role})
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">LÝ DO XIN PHÉP THUYẾT PHỤC BAN GIÁM ĐỐC</label>
                <textarea
                  placeholder="Nhập lý do cụ thể (vd: giải quyết việc đất cát ở Bảo Lộc, đi đám cưới em gái ruột, vv.)"
                  value={leaveReasonText}
                  onChange={(e) => setLeaveReasonText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500 h-20"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLeaveModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs py-2 rounded-xl font-bold text-center cursor-pointer border border-slate-700"
                >
                  ĐÓNG
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-sky-500 hover:bg-sky-400 text-white text-xs py-2 rounded-xl font-black text-center cursor-pointer"
                >
                  NỘP ĐƠN NGHỈ PHÉP
                </button>
              </div>

            </div>

          </form>
        </div>
      )}


      {/* MODAL 3: ĐỀ XUẤT ỨNG LƯƠNG NHANH */}
      {advanceModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn" id="salary_advance_proposal_modal">
          <form onSubmit={handleAdvanceSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative">
            
            <div className="p-4 bg-slate-950 border-b border-slate-850 flex items-center justify-between">
              <span className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                💸 ĐỀ XUẤT TẠM ỨNG LƯƠNG NHÂN SỰ
              </span>
              <button
                type="button"
                onClick={() => setAdvanceModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">NHÂN SỰ ĐỀ NGHỊ</label>
                  <input
                    type="text"
                    value={currentUser.name}
                    readOnly
                    className="w-full bg-slate-950 border border-slate-805 rounded-lg px-3 py-1.5 text-xs text-slate-400 font-bold outline-none cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">KỲ LƯƠNG ÁP DỤNG</label>
                  <select
                    value={advancePeriod}
                    onChange={(e) => setAdvancePeriod(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
                  >
                    {getPeriodOptions().map((opt: any) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">TIỀN LƯƠNG TẠM ỨNG ĐỀ XUẤT (VNĐ)</label>
                <input
                  type="number"
                  placeholder="Nhập số tiền ứng, vd: 3000000"
                  value={advanceAmountVal}
                  onChange={(e) => setAdvanceAmountVal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-emerald-500 font-mono font-bold"
                  required
                />
                {advanceAmountVal && (
                  <div className="mt-2 text-xs text-emerald-400 font-mono font-bold">
                    {Number(advanceAmountVal).toLocaleString('vi-VN')} đ
                  </div>
                )}
                <span className="block text-[10px] text-slate-500 mt-1 italic">
                  * Số tiền ứng tối đa đề xuất: &lt;= 50% mức lương cơ bản ({userBaseSalary.toLocaleString('vi-VN')} đ)
                </span>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">LÝ DO ĐỀ XUẤT TẠM ỨNG CHI TIẾT</label>
                <textarea
                  placeholder="vd: Chi tiêu cá nhân đột xuất phục vụ hiếu hỉ, mua sắm máy tính làm việc"
                  value={advanceReasonText}
                  onChange={(e) => setAdvanceReasonText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500 h-20"
                  required
                />
              </div>

              <div>
                {(() => {
                  const configuredApprover = getConfiguredApprover('salary_advance');
                  if (configuredApprover) {
                    const approverPos = configuredApprover.position ? ` (${configuredApprover.position})` : '';
                    return (
                      <div className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 flex items-center justify-between">
                        <span className="font-bold">{configuredApprover.name}{approverPos}</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">Đã khóa · Tự động</span>
                      </div>
                    );
                  }
                  return (
                    <>
                      <label className="block text-[10px] text-slate-500 font-bold mb-1">NGƯỜI XÉT DUYỆT (NHÓM KẾ TOÁN)</label>
                      <select
                        value={advanceApproverId}
                        onChange={(e) => setAdvanceApproverId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="">Chọn người xét duyệt...</option>
                        {hrmEmployees.map((emp: any) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} ({emp.position || emp.role})
                          </option>
                        ))}
                      </select>
                    </>
                  );
                })()}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdvanceModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs py-2 rounded-xl font-bold text-center cursor-pointer border border-slate-700"
                >
                  ĐÓNG
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs py-2 rounded-xl font-black text-center cursor-pointer text-white"
                >
                  GỬI ĐỆ TRÌNH ỨNG LƯƠNG
                </button>
              </div>

            </div>

          </form>
        </div>
      )}

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
