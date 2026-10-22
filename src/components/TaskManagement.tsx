import React, { useState, useEffect } from 'react';
import { Task, TaskUpdatePayload, Project, Employee, Customer, Quote, LeaveRequest, Payment, SubcontractorAdvanceProposal } from '../types';
import { CheckSquare } from 'lucide-react';
import TaskDetailModal from './TaskDetailModal';
import { findPairedAbsenceReport, groupPendingAbsencePairs } from '../lib/leaveRequests';
import { resolveShiftTimes } from '../lib/standardShiftTimes';
import { isShiftLeave, shiftLabel } from '../lib/leaveShift';
import ConnectedToolsModal from './ConnectedToolsModal';
import { dbService } from '../lib/dbService';
import { companyScopedKey } from '../lib/supabase';
import { sendApprovalDirectMessage, findEmployeeByName } from '../lib/chatStore';
import { useNotification, getMaterialApprovers, getMaterialCoordinators, isRoleAdmin, isAccountingGroupMember, isAdminFallbackApprover, isAdminFallbackForPayment, isAdminFallbackForProposal, canSeeTravelExpenseApproval, isConfiguredApproverForProposal, isConfiguredApproverForPayment, canApproveTravelExpense as canApproveTravelExpenseCfg, isLeaveApproverFor } from '../context';
import { isAttendanceReportType } from '../lib/attendanceMeta';
import { isPaymentPendingForUser, isAdvancePendingForUser, isVoucherPendingForUser } from '../lib/approvalInbox';
import { materialInboxFor, materialProposalTotal, COORDINATOR_STATUS_LABEL } from '../lib/materialApproval';
import MyWorkOverview, { type InboxItem } from './MyWorkOverview';
import { buildMyWorkItems, assignedByMe, pinsStorageKey, todayYmd, type MyWorkItem } from '../lib/myWork';
import { canDoTaskAction, loadTaskPermissionMatrix, isTaskReadOnlyFor } from './hr/hrTaskPermissions';

interface TaskManagementProps {
  tasks: Task[];
  projects: Project[];
  employees: Employee[];
  currentUser: Employee;
  onAddTask: (newTask: Task) => void;
  onUpdateTask: (id: string, updates: TaskUpdatePayload) => Promise<boolean> | void;
  onUpdateProject?: (id: string, updates: Partial<Project>) => void;
  onDeleteTask?: (id: string) => void;
  onDeleteMultipleTasks?: (ids: string[]) => void;
  customers?: Customer[];
  quotes?: Quote[];
  onRedirectToQuote?: (projectId: string) => void;
  onRedirectToSubcontractor?: (projectId: string, subcontractorId: string, workName: string) => void;
  onRedirectToHrLeaves?: () => void; // Điều hướng sang menu Phòng Nhân Sự > Đơn nghỉ phép
  /** Điều hướng sang Tài Chính > Đề xuất thu chi và tự động mở form lập phiếu cho đề xuất có id tương ứng. */
  onOpenFinanceVoucher?: (proposalId: string) => void;
  /** Điều hướng sang Điều Phối Vật Tư và mở chi tiết đề xuất vật tư có id tương ứng (để duyệt). */
  onOpenMaterialProposal?: (proposalId: string) => void;
  subcontractorAdvances?: SubcontractorAdvanceProposal[]; // Đề xuất tạm ứng / Thu Chi từ Tài Chính
  /** Công việc cần bung modal chi tiết ngay khi vào tab (deep link từ thông báo đẩy). */
  initialTaskId?: string;
  /** Gọi lại sau khi đã mở `initialTaskId`, để App reset state deep link. */
  onInitialTaskOpened?: () => void;
  /** Phạm vi khởi tạo (deep link từ tin nhắn xét duyệt → mở thẳng bảng "Công việc phải duyệt"). */
  initialTaskScope?: 'assigned' | 'all' | 'toreview';
  /** Gọi lại sau khi đã áp dụng `initialTaskScope`, để App reset state deep link. */
  onInitialTaskScopeOpened?: () => void;
}

export default function TaskManagement({
  tasks,
  projects,
  employees,
  currentUser,
  onAddTask,
  onUpdateTask,
  onUpdateProject,
  onDeleteTask,
  onDeleteMultipleTasks,
  customers,
  quotes,
  onRedirectToQuote,
  onRedirectToSubcontractor,
  onRedirectToHrLeaves,
  onOpenFinanceVoucher,
  onOpenMaterialProposal,
  subcontractorAdvances = [],
  initialTaskId,
  onInitialTaskOpened,
  initialTaskScope,
  onInitialTaskScopeOpened
}: TaskManagementProps) {
  const { addToast } = useNotification();
  // Trạng thái cho Chi tiết công việc chọn Xem
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // ── Deep link từ thông báo đẩy ──────────────────────────────────────────
  // App truyền `initialTaskId` khi người dùng bấm vào thông báo đẩy của một
  // công việc → bung thẳng modal chi tiết. Đồng thời nới bộ lọc về "tất cả"
  // để công việc đó chắc chắn nằm trong danh sách phía sau modal (VD việc do
  // người khác làm sẽ không có trong scope mặc định "Công việc được giao").
  useEffect(() => {
    if (!initialTaskId) return;
    const task = tasks.find(t => t.id === initialTaskId);
    if (!task) return;

    setSelectedTaskId(initialTaskId);
    onInitialTaskOpened?.();
  }, [initialTaskId, tasks, currentUser?.id, onInitialTaskOpened]);

  // Deep link xét duyệt → trang Việc của tôi chỉ còn 1 kiểu (Tổng quan, đã có mục "Chờ tôi xử lý") nên chỉ cần báo App đã nhận để xóa trạng thái deep link
  useEffect(() => {
    if (!initialTaskScope) return;
    onInitialTaskScopeOpened?.();
  }, [initialTaskScope, onInitialTaskScopeOpened]);

  // States cho Công cụ liên thông (Connected Tools) trong Việc của tôi
  const [activeConnectedTool, setActiveConnectedTool] = useState<'approval' | 'cost' | 'material' | 'quotation' | 'contract' | 'acceptance' | 'liquidation' | null>(null);
  const [activeConnectedToolTaskId, setActiveConnectedToolTaskId] = useState<string | null>(null);

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  // Công Tác Phí (hrm_travel_expenses) chờ duyệt — hiển thị trong cột Phòng Kế toán
  const [travelExpenses, setTravelExpenses] = useState<any[]>([]);
  // Đề xuất VẬT TƯ (material_proposals) — loại đề xuất còn lại, cần Người xét duyệt vật tư duyệt
  const [materialProposals, setMaterialProposals] = useState<any[]>([]);

  // Tải leaves & payments từ Supabase ngay khi mount (để badge "Công việc phải duyệt"
  // hiển thị đúng số ngay từ đầu, không phải chờ mở tab), và tải lại khi chuyển tab.
  React.useEffect(() => {
    const loadLeaves = () => dbService.hrmLeaves.list().then(data => setLeaves(data || [])).catch(console.error);
    const loadPayments = () => dbService.payments.list().then(data => setPayments(data || [])).catch(console.error);
    const loadTravelExpenses = () => dbService.hrmTravelExpenses.list().then(data => setTravelExpenses(data || [])).catch(console.error);
    const loadMaterial = () => dbService.materialProposals.list().then(data => setMaterialProposals(data || [])).catch(console.error);
    loadLeaves();
    loadPayments();
    loadTravelExpenses();
    loadMaterial();
    window.addEventListener('hl-material-proposals-updated', loadMaterial);
    // Trước đây chỉ tải lại khi chuyển tab (đổi taskScope) hoặc remount — nếu ai
    // đó duyệt/tạo đơn nghỉ phép, phiếu chi, công tác phí ở tab khác trong lúc
    // người dùng đang xem "Việc của tôi", badge "Công việc phải duyệt" sẽ hiện
    // sai số cho tới khi họ tự chuyển tab. Nghe đúng 3 event tương ứng (payments
    // vừa được App.tsx bắn thêm khi Realtime cập nhật; hrm_leaves core Realtime;
    // hrm_travel_expenses polling 5 phút) để tự làm mới theo thời gian thực.
    window.addEventListener('hl-payments-updated', loadPayments);
    window.addEventListener('hl-hrm-leaves-updated', loadLeaves);
    window.addEventListener('hl-hrm-travel-expenses-updated', loadTravelExpenses);
    return () => {
      window.removeEventListener('hl-payments-updated', loadPayments);
      window.removeEventListener('hl-hrm-leaves-updated', loadLeaves);
      window.removeEventListener('hl-hrm-travel-expenses-updated', loadTravelExpenses);
      window.removeEventListener('hl-material-proposals-updated', loadMaterial);
    };
  }, []);   // tải 1 lần khi mở trang, sau đó tự cập nhật theo sự kiện

  const handleApproveLeave = async (id: string, status: 'approved' | 'rejected') => {
    if (!myPendingLeaves.some(l => l.id === id)) {
      addToast({ title: '⛔ Không đủ quyền', message: 'Bạn không có quyền duyệt đơn nghỉ phép này.', type: 'warning' });
      return;
    }
    const getLeaveSymbol = (type: string) => {
      try {
        const coefsSaved = localStorage.getItem(companyScopedKey('hl_hrm_leave_coefs_v6'));
        if (coefsSaved) {
          const coefs = JSON.parse(coefsSaved);
          if (Array.isArray(coefs)) {
            const found = coefs.find((c: any) => c.type === type);
            if (found) return found.id || 'OFF';
          }
        }
      } catch (e) {
        console.error(e);
      }
      if (type === 'Nghỉ phép năm') return 'PN';
      if (type === 'Nghỉ không lương có xin phép') return 'P';
      if (type === 'Nghỉ không lương không xin phép') return 'KP';
      if (type.includes('lễ')) return 'NL';
      if (type.includes('hiếu') || type.includes('ma chay')) return 'T';
      if (type.includes('cưới')) return 'C';
      return 'OFF';
    };

    const getDaysDiffList = (fromStr: string, toStr: string) => {
      const dates: string[] = [];
      try {
        const start = new Date(fromStr);
        const end = new Date(toStr);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(d.toISOString().split('T')[0]);
        }
      } catch (err) {
        console.error(err);
      }
      return dates;
    };

    // Tìm leave cần xử lý
    const targetLeave = leaves.find(l => l.id === id);
    if (!targetLeave) return;

    // Thực hiện async work trước (cập nhật phepNam, attendance trên Supabase)
    if (status === 'approved') {
      // A. Trừ ngày phép năm nếu là nghỉ phép năm
      if (targetLeave.type === 'Nghỉ phép năm' && targetLeave.status !== 'approved') {
        try {
          const empsList = await dbService.employees.list();
          if (Array.isArray(empsList)) {
            const changedEmp = empsList.find((emp: any) => emp.id === targetLeave.empId);
            if (changedEmp) {
              const currentPhep = (changedEmp as any).phepNam !== undefined ? (changedEmp as any).phepNam : 12;
              const leaveDays = targetLeave.daysCount !== undefined ? targetLeave.daysCount : 1;
              const updatedEmp = { ...changedEmp, phepNam: Math.max(0, Number((currentPhep - leaveDays).toFixed(1))) } as any;
              await dbService.employees.save(updatedEmp).catch(() => {});
            }
          }
        } catch (e) {
          console.error("Lỗi khi cập nhật số ngày phép năm:", e);
        }
      }

      // B. Cập nhật attendance trên Supabase
      try {
        // Giờ chuẩn của ca khi tự điền lúc duyệt báo cáo chấm công: đọc từ CẤU HÌNH CA của doanh nghiệp (lỗi/chưa có → giờ mặc định)
        const shiftTimes = resolveShiftTimes(await dbService.shiftConfig.get().catch(() => null));
        const symbol = getLeaveSymbol(targetLeave.type);
        const leaveDates = getDaysDiffList(targetLeave.fromDate, targetLeave.toDate);
        // Chỉ tải KHOẢNG NGÀY NGHỈ (thay vì toàn bộ lịch sử) để tìm/sửa bản ghi tương ứng.
        const attendance = leaveDates.length > 0
          ? await dbService.attendance.listForRange(leaveDates[0], leaveDates[leaveDates.length - 1])
          : [];
        const toSave: any[] = [];

        leaveDates.forEach(dStr => {
          const idx = attendance.findIndex((at: any) => at.empId === targetLeave.empId && at.date === dStr);
          if (idx !== -1) {
            if (targetLeave.isAttendanceCorrection || targetLeave.type === 'Yêu cầu xét duyệt công' || isAttendanceReportType(targetLeave.type)) {
              const currentAt = attendance[idx];
              let timeInS = currentAt.timeInS, timeOutS = currentAt.timeOutS, timeInC = currentAt.timeInC, timeOutC = currentAt.timeOutC;
              if (targetLeave.type === 'Báo cáo lỗi chấm ra ca') {
                if (targetLeave.shift === 'morning') timeOutS = shiftTimes.morningOut;
                else if (targetLeave.shift === 'afternoon') timeOutC = shiftTimes.afternoonOut;
              } else if (targetLeave.type === 'Báo cáo lỗi hệ thống chấm công') {
                // Lỗi hệ thống: điền ĐỦ giờ chuẩn CA ĐƯỢC BÁO CÁO (giữ ca còn lại nguyên).
                if (targetLeave.shift === 'morning') { timeInS = shiftTimes.morningIn; timeOutS = shiftTimes.morningOut; }
                else if (targetLeave.shift === 'afternoon') { timeInC = shiftTimes.afternoonIn; timeOutC = shiftTimes.afternoonOut; }
              } else if (targetLeave.type !== 'Báo cáo nghỉ ca') {
                timeInS = currentAt.timeInS && currentAt.timeInS !== '--:--' && currentAt.timeInS !== '' ? currentAt.timeInS : shiftTimes.morningIn;
                timeOutS = currentAt.timeOutS && currentAt.timeOutS !== '--:--' && currentAt.timeOutS !== '' ? currentAt.timeOutS : shiftTimes.morningOut;
                timeInC = currentAt.timeInC && currentAt.timeInC !== '--:--' && currentAt.timeInC !== '' ? currentAt.timeInC : shiftTimes.afternoonIn;
                timeOutC = currentAt.timeOutC && currentAt.timeOutC !== '--:--' && currentAt.timeOutC !== '' ? currentAt.timeOutC : shiftTimes.afternoonOut;
              }
              attendance[idx] = { ...currentAt, timeInS, timeOutS, timeInC, timeOutC, status: 'valid', statusMsg: 'Hợp lệ', leaveSymbol: undefined, notes: targetLeave.reason };
              toSave.push(attendance[idx]);
            } else if (isShiftLeave(targetLeave)) {
              // Nghỉ 1 CA: không ghi ký hiệu nghỉ đè cả 4 ô giờ (sẽ xóa giờ chấm của ca còn lại); công do công thức tính từ đơn nghỉ + giờ chấm
              attendance[idx] = { ...attendance[idx], notes: `Nghỉ phép được duyệt: ${targetLeave.type} (${symbol}) — ${shiftLabel(targetLeave.shift)}` };
              toSave.push(attendance[idx]);
            } else {
              attendance[idx] = { ...attendance[idx], timeInS: symbol, timeOutS: symbol, timeInC: symbol, timeOutC: symbol, status: 'excused', leaveSymbol: symbol, notes: `Nghỉ phép được duyệt: ${targetLeave.type} (${symbol})` };
              toSave.push(attendance[idx]);
            }
          } else {
            let timeInS = symbol, timeOutS = symbol, timeInC = symbol, timeOutC = symbol, method = 'Hành chính phép', st = 'excused';
            if (targetLeave.isAttendanceCorrection || targetLeave.type === 'Yêu cầu xét duyệt công' || isAttendanceReportType(targetLeave.type)) {
              method = 'Duyệt công'; st = 'valid';
              timeInS = shiftTimes.morningIn; timeOutS = shiftTimes.morningOut; timeInC = shiftTimes.afternoonIn; timeOutC = shiftTimes.afternoonOut;
              if (targetLeave.type === 'Báo cáo lỗi chấm ra ca') {
                if (targetLeave.shift === 'morning') { timeInC = ''; timeOutC = ''; }
                else { timeInS = ''; timeOutS = ''; }
              } else if (targetLeave.type === 'Báo cáo nghỉ ca') {
                // Nghỉ ca = KHÔNG làm → không tự điền giờ chuẩn cho ca còn lại (trước đây làm công ảo +0,5 cho người nghỉ cả ngày)
                timeInS = ''; timeOutS = ''; timeInC = ''; timeOutC = '';
              } else if (targetLeave.type === 'Báo cáo lỗi hệ thống chấm công') {
                if (targetLeave.shift === 'morning') { timeInS = shiftTimes.morningIn; timeOutS = shiftTimes.morningOut; timeInC = ''; timeOutC = ''; }
                else { timeInS = ''; timeOutS = ''; timeInC = shiftTimes.afternoonIn; timeOutC = shiftTimes.afternoonOut; }
              }
            }
            if (isShiftLeave(targetLeave)) {
              // Nghỉ 1 CA: bản ghi để TRỐNG giờ, không đặt ký hiệu nghỉ cho cả ngày
              timeInS = ''; timeOutS = ''; timeInC = ''; timeOutC = ''; st = 'valid';
            }
            const newLog = { id: `AT-${Date.now().toString().slice(-3)}-${Math.random().toString().slice(-2)}`, empId: targetLeave.empId, empName: targetLeave.empName, date: dStr, timeInS, timeOutS, timeInC, timeOutC, timeInOT: '', timeOutOT: '', method, status: st, statusMsg: st === 'valid' ? 'Hợp lệ' : undefined, otHours: 0, leaveSymbol: st === 'excused' ? symbol : undefined, notes: targetLeave.reason || `Nghỉ phép được duyệt: ${targetLeave.type} (${symbol})` };
            attendance.unshift(newLog);
            toSave.push(newLog);
          }
        });

        for (const rec of toSave) {
          await dbService.attendance.save(rec).catch(() => {});
        }
      } catch (e) {
        console.error(e);
      }
    } else if (status === 'rejected') {
      // Cập nhật attendance khi từ chối
      if (isAttendanceReportType(targetLeave.type)) {
        try {
          const leaveDates = getDaysDiffList(targetLeave.fromDate, targetLeave.toDate);
          // Chỉ tải KHOẢNG NGÀY NGHỈ (thay vì toàn bộ lịch sử) để tìm/sửa bản ghi tương ứng.
          const attendance = leaveDates.length > 0
            ? await dbService.attendance.listForRange(leaveDates[0], leaveDates[leaveDates.length - 1])
            : [];
          const toSave: any[] = [];

          leaveDates.forEach(dStr => {
            const idx = attendance.findIndex((at: any) => at.empId === targetLeave.empId && at.date === dStr);
            if (idx !== -1) {
              attendance[idx] = { ...attendance[idx], status: 'invalid', statusMsg: 'Không hợp lệ', notes: `Bị từ chối duyệt: ${targetLeave.reason || ''}` };
              toSave.push(attendance[idx]);
            } else {
              // Từ chối = coi như chưa có báo cáo: để trống giờ (không ghi 'OFF' vì OFF bị tính 0 công, tha phạt dù đơn bị từ chối)
              const newLog = { id: `AT-${Date.now().toString().slice(-3)}-${Math.random().toString().slice(-2)}`, empId: targetLeave.empId, empName: targetLeave.empName, date: dStr, timeInS: '', timeOutS: '', timeInC: '', timeOutC: '', timeInOT: '', timeOutOT: '', method: 'Duyệt công', status: 'invalid', statusMsg: 'Không hợp lệ', otHours: 0, notes: `Bị từ chối duyệt: ${targetLeave.reason || ''}` };
              attendance.unshift(newLog);
              toSave.push(newLog);
            }
          });

          for (const rec of toSave) {
            await dbService.attendance.save(rec).catch(() => {});
          }
        } catch (e) {
          console.error(e);
        }
      }
    }

    // Cập nhật state leaves (đồng bộ)
    const updated = leaves.map(l => l.id === id ? { ...l, status } : l);
    pairedArmedRef.current = pairedLeaveQueueRef.current.length > 0;   // cho phép xử lý đơn đi cùng (cặp "Cả ngày") ở render kế tiếp
    setLeaves(updated);
    // Lưu đơn đã duyệt/từ chối lên Supabase
    const changed = updated.find(l => l.id === id);
    if (changed) dbService.hrmLeaves.save(changed).catch(() => {});
    // 📩 Gửi tin nhắn xét duyệt vào HỘI THOẠI CÁ NHÂN giữa người duyệt và nhân viên nộp đơn
    if (currentUser.id && targetLeave.empId && currentUser.id !== targetLeave.empId) {
      sendApprovalDirectMessage({
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        recipientId: targetLeave.empId,
        recipientName: targetLeave.empName,
        content: status === 'approved'
          ? `✅ Đã duyệt đơn nghỉ phép "${targetLeave.type}" của ${targetLeave.empName} (${targetLeave.fromDate} → ${targetLeave.toDate}).`
          : `❌ Đã từ chối đơn nghỉ phép "${targetLeave.type}" của ${targetLeave.empName} (${targetLeave.fromDate} → ${targetLeave.toDate}).`,
        relatedEntity: { type: 'leave', id: targetLeave.id },
      });
    }
    if (status === 'approved') {
      addToast({ title: 'ℹ️ Thông báo', message: "Đã duyệt", type: 'info' });
    } else {
      addToast({ title: 'ℹ️ Thông báo', message: "Từ chối", type: 'info' });
    }
  };

  // DUYỆT / TỪ CHỐI CẢ CẶP "Báo cáo nghỉ ca" (ca sáng + ca chiều cùng ngày): bấm 1 lần xử lý cả hai đơn.
  // handleApproveLeave dựa vào state `leaves` của lần render hiện tại → không gọi 2 lần liền (lần 2 dùng state cũ, ghi đè lần 1).
  // Xử lý đơn thứ nhất ngay, đơn thứ hai chờ ở hàng đợi và chỉ chạy khi `leaves` đã cập nhật (effect bên dưới, ở render mới).
  // handleApproveLeave ở đây chạy BẤT ĐỒNG BỘ (chờ ghi chấm công lên Supabase) nên hàng đợi chỉ được "kích hoạt" (pairedArmedRef) khi đơn
  // thứ nhất đã tới bước cập nhật state `leaves` — tránh trường hợp `leaves` đổi vì lý do khác (realtime) làm đơn thứ hai chạy sớm.
  const pairedLeaveQueueRef = React.useRef<{ id: string; status: 'approved' | 'rejected' }[]>([]);
  const pairedArmedRef = React.useRef(false);
  const handleApproveLeaveWithPair = (id: string, status: 'approved' | 'rejected') => {
    const sibling = findPairedAbsenceReport(leaves.find(l => l.id === id), leaves);
    pairedLeaveQueueRef.current = sibling ? [{ id: sibling.id, status }] : [];
    pairedArmedRef.current = false;
    handleApproveLeave(id, status);
  };
  useEffect(() => {
    if (!pairedArmedRef.current) return;
    pairedArmedRef.current = false;
    const next = pairedLeaveQueueRef.current.shift();
    if (next) handleApproveLeave(next.id, next.status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaves]);
  const handleApprovePayment = (id: string, status: 'approved' | 'rejected') => {
    // RÀ SOÁT 2026-09: nút Duyệt/Từ chối chỉ hiện cho phiếu chi nằm trong
    // myPendingPayments (đã lọc đúng thẩm quyền, không còn tự duyệt) — gate lại ở
    // đây để không có đường vòng nếu hàm được gọi ngoài danh sách đã lọc.
    if (!myPendingPayments.some(p => p.id === id)) {
      addToast({ title: '⛔ Không đủ quyền', message: 'Bạn không có quyền duyệt phiếu chi này.', type: 'warning' });
      return;
    }
    const updatedPayment = payments.find(p => p.id === id);
    const updated = payments.map(p => p.id === id ? { ...p, status } : p);
    setPayments(updated);
    if (updatedPayment) {
      dbService.payments.save({ ...updatedPayment, status }).catch(err =>
        console.warn('Lỗi khi lưu trạng thái duyệt thanh toán lên Supabase:', err));
      // 📩 Gửi tin nhắn xét duyệt vào HỘI THOẠI CÁ NHÂN giữa người duyệt và người đề xuất
      const proposerEmp = (updatedPayment.proposerId ? employees.find(e => e.id === updatedPayment.proposerId) : undefined) || findEmployeeByName(employees, updatedPayment.proposer);   // mã người lập trước, tên dự phòng
      if (currentUser.id && proposerEmp?.id && currentUser.id !== proposerEmp.id) {
        sendApprovalDirectMessage({
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderRole: currentUser.role,
          recipientId: proposerEmp.id,
          recipientName: proposerEmp.name || updatedPayment.proposer,
          content: status === 'approved'
            ? `✅ Đã duyệt phiếu chi ${updatedPayment.code} (${updatedPayment.recipient}) ${updatedPayment.amount.toLocaleString('vi-VN')}đ.`
            : `❌ Đã từ chối phiếu chi ${updatedPayment.code} (${updatedPayment.recipient}) ${updatedPayment.amount.toLocaleString('vi-VN')}đ.`,
          relatedEntity: { type: 'payment', id: updatedPayment.id },
        });
      }
    }
    addToast({ title: '✅ Đã cập nhật', message: `Đã cập nhật đề xuất thanh toán [${id}] sang trạng thái: ${status === 'approved' ? 'Phê duyệt ✅' : 'Từ chối ❌'}`, type: 'success' });
  };

  // Xử lý duyệt Đề Xuất Thu Chi (Subcontractor Advance Proposal)
  // Trạng thái: 'pending_approval' (Chờ Duyệt BGĐ) -> 'pending_payment' (Chờ Lập Phiếu KT) | 'rejected'
  const handleApproveAdvance = async (id: string, decision: 'approved' | 'rejected') => {
    if (!myPendingAdvances.some(a => a.id === id)) {
      addToast({ title: '⛔ Không đủ quyền', message: 'Bạn không có quyền duyệt đề xuất này.', type: 'warning' });
      return;
    }
    const adv = subcontractorAdvances.find(a => a.id === id);
    if (!adv) return;
    const newStatus = decision === 'approved' ? 'pending_payment' : 'rejected';
    const updated: SubcontractorAdvanceProposal = { ...adv, status: newStatus };
    try {
      await dbService.subcontractorAdvances.save(updated);
      window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated', { detail: updated }));
      // 📩 Gửi tin nhắn xét duyệt vào HỘI THOẠI CÁ NHÂN giữa người duyệt và người lập đề xuất
      const creatorEmp = adv.creator ? employees.find(e => e.id === adv.creator) : findEmployeeByName(employees, adv.creatorName);
      if (currentUser.id && creatorEmp?.id && currentUser.id !== creatorEmp.id) {
        sendApprovalDirectMessage({
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderRole: currentUser.role,
          recipientId: creatorEmp.id,
          recipientName: creatorEmp.name || adv.creatorName || 'Người lập đề xuất',
          content: decision === 'approved'
            ? `✅ Đã duyệt đề xuất tạm ứng ${adv.id} (${adv.taskName || adv.subcontractorName}) ${adv.amount.toLocaleString('vi-VN')}đ.`
            : `❌ Đã từ chối đề xuất tạm ứng ${adv.id} (${adv.taskName || adv.subcontractorName}) ${adv.amount.toLocaleString('vi-VN')}đ.`,
          relatedEntity: { type: 'advance', id: adv.id },
        });
      }
      addToast({
        title: decision === 'approved' ? '✅ Đã phê duyệt' : '❌ Đã từ chối',
        message: `Đề xuất ${id} → ${decision === 'approved' ? 'Chờ Lập Phiếu (KT)' : 'Từ Chối'}`,
        type: decision === 'approved' ? 'success' : 'info'
      });
    } catch (err) {
      addToast({ title: '❌ Lỗi', message: `Thất bại: ${err instanceof Error ? err.message : String(err)}`, type: 'error' });
    }
  };

  // Xử lý duyệt CÔNG TÁC PHÍ (cột Phòng Kế toán) — đồng bộ với handler trong
  // HumanResourcesManagement.handleApproveTravelExpense: cập nhật status, upsert
  // Supabase, fire sự kiện làm mới toàn cục + gửi tin nhắn cá nhân trả kết quả
  // cho NGƯỜI KHỞI TẠO (creatorId/creatorName) của công tác phí.
  const handleApproveTravelExpense = (rowId: string, decision: 'approved' | 'rejected') => {
    // RÀ SOÁT 2026-09: myPendingTravelExpenses chỉ lọc theo boolean canApproveTravelExpense
    // dùng chung cho MỌI công tác phí (không lọc theo từng bản ghi) — gate lại ở đây để
    // không có đường vòng nếu hàm này được gọi từ nơi khác ngoài danh sách đã lọc.
    if (!canApproveTravelExpense) {
      addToast({ title: '⛔ Không đủ quyền', message: 'Bạn không có quyền duyệt công tác phí.', type: 'warning' });
      return;
    }
    const target = travelExpenses.find((s: any) => s.rowId === rowId || s.id === rowId);
    if (!target) return;

    const updated = travelExpenses.map((s: any) =>
      (s.rowId === rowId || s.id === rowId) ? { ...s, status: decision } : s
    );
    setTravelExpenses(updated);

    dbService.hrmTravelExpenses.save({ ...target, status: decision }, { rowId })
      .then(() => window.dispatchEvent(new CustomEvent('hl-hrm-travel-expenses-updated')))
      .catch((e) => console.warn('[TravelExpense] ⚠️ Lưu trạng thái duyệt CTP thất bại:', e?.message || e));

    // 📩 Gửi tin nhắn CÁ NHÂN trả kết quả về cho NGƯỜI KHỞI TẠO công tác phí.
    let recipientId = target.creatorId || target.employeeId || target.empId;
    if (!recipientId) recipientId = findEmployeeByName(employees, target.employeeName)?.id || '';
    if (currentUser?.id && recipientId && currentUser.id !== recipientId) {
      const decisionText = decision === 'approved'
        ? `✅ Đã duyệt công tác phí "${target.content || 'Công tác phí'}" (${Number(target.amount || 0).toLocaleString('vi-VN')} đ) của ${target.employeeName || ''}${target.missionName ? ` — nhiệm vụ "${target.missionName}".` : '.'}`
        : `❌ Đã từ chối công tác phí "${target.content || 'Công tác phí'}" (${Number(target.amount || 0).toLocaleString('vi-VN')} đ) của ${target.employeeName || ''}${target.missionName ? ` — nhiệm vụ "${target.missionName}".` : '.'}`;
      sendApprovalDirectMessage({
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        recipientId,
        recipientName: target.employeeName || 'Người khởi tạo',
        content: decisionText,
        relatedEntity: { type: 'travel_expense', id: rowId },
      }).catch((e) => console.warn('[TravelExpense] ⚠️ Gửi tin kết quả duyệt thất bại:', e?.message || e));
    }

    addToast({
      title: decision === 'approved' ? '✅ Đã duyệt' : '❌ Đã từ chối',
      message: decision === 'approved'
        ? `Đã duyệt công tác phí ${target.content || ''} của ${target.employeeName || ''}.`
        : `Đã từ chối công tác phí ${target.content || ''} của ${target.employeeName || ''}.`,
      type: decision === 'approved' ? 'success' : 'info',
    });
  };

  // Map tra cứu O(1) cho project/customer — dùng trong relatedMissions bên dưới
  // để tránh .find() lồng bên trong .flatMap()/.map() (O(N×M) cũ).
  const projectsById = React.useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  // RÀ SOÁT 2026-09: danh sách "Việc của tôi" bên dưới dùng isAssignee/isAssigner cục bộ
  // (không xét director/PM/tùy biến riêng dự án), khác với ma trận canDoTaskAction đã dùng
  // đúng ở TaskDetailModal.tsx — cùng 1 người có thể thấy 2 kết quả khác nhau giữa danh sách
  // và modal chi tiết. Nạp ma trận 1 lần, dùng canDoTaskAction cho từng dòng công việc.
  const taskMatrix = React.useMemo(() => loadTaskPermissionMatrix(), []);

  // Đơn nghỉ phép chờ duyệt mà user hiện tại là NGƯỜI ĐƯỢC CHỈ ĐỊNH xét duyệt (lọc theo ID lẫn tên,
  // tương tự logic công việc phải duyệt ở trên — vì một số đơn fallback chỉ lưu tên người duyệt)
  // isLeaveApproverFor: khớp người duyệt ghi trên đơn HOẶC là một trong những người được cấu hình duyệt (Quyền Phê Duyệt) — đơn chỉ lưu 1 người duyệt nhưng
  // cấu hình cho phép nhiều người, nên các người còn lại cũng phải thấy và duyệt được.
  const myPendingLeaves = React.useMemo(() => leaves.filter(l =>
    l.status === 'pending' && isLeaveApproverFor(currentUser?.id, currentUser?.name, l as any)
  ), [leaves, currentUser]);

  // Danh sách hiển thị: cặp chờ duyệt gộp thành 1 thẻ "Cả ngày" (ẩn thẻ ca chiều)
  const { visible: visiblePendingLeaves } = React.useMemo(
    () => groupPendingAbsencePairs(myPendingLeaves), [myPendingLeaves]);

  // Đề xuất TÀI CHÍNH chờ duyệt mà user hiện tại có quyền xét duyệt:
  // (a) được CHỈ ĐỊNH làm người duyệt (approver theo ID/tên, kể cả chuỗi duyệt approvals), HOẶC
  // (b) là Giám đốc (role_admin) → xem & duyệt toàn bộ.
  // ⚠️ RÀ SOÁT 2026-09 (lần 2): trước đây (b) còn gồm CẢ nhóm Kế toán (isRoleAccounting) — khiến
  // BẤT KỲ ai thuộc phòng Kế toán đều thấy & duyệt được MỌI đề xuất tài chính đang chờ, kể cả loại
  // họ KHÔNG được add riêng trong "Quyền Phê Duyệt" (VD thực tế: 1 nhân viên Kế toán chỉ được add
  // vào "Người Điều Phối Vật Tư" lại nhìn thấy cả "Tạm Ứng Lương Nhanh" trong "Việc của tôi", dù
  // không được add riêng cho loại đó). Bỏ isFinanceApprover dùng chung, thay bằng kiểm tra ĐÚNG
  // loại hồ sơ của từng item (isConfiguredApproverForProposal/isConfiguredApproverForPayment) —
  // đồng bộ với canApproveProposal đã sửa cùng nguyên tắc trong FinanceManagement.tsx.
  const isFinanceAdmin = isRoleAdmin(currentUser?.id);
  // RÀ SOÁT 2026-09: trước đây điều kiện còn có p.proposer === currentUser?.name ||
  // p.recipient === currentUser?.name — khiến người ĐỀ XUẤT hoặc người NHẬN TIỀN của
  // chính phiếu chi đó cũng thấy nút Duyệt/Từ chối, dù họ không có thẩm quyền duyệt
  // (tự duyệt chi tiền cho chính mình). Bỏ 2 điều kiện đó — chỉ còn thẩm quyền THẬT
  // (finance approver / được chỉ định duyệt), đúng như comment mô tả và đúng nguyên
  // tắc "không tự duyệt" đã áp dụng ở canApproveProposal (FinanceManagement.tsx).
  // Quy tắc DÙNG CHUNG với huy hiệu menu (lib/approvalInbox.ts): khớp theo MÃ người duyệt, tên chỉ dự phòng cho bản ghi cũ chưa có mã
  const employeeIdSet = React.useMemo(() => new Set(employees.map(e => e.id)), [employees]);
  const myPendingPayments = React.useMemo(() => payments.filter(p =>
    isPaymentPendingForUser(p, currentUser, { isAdmin: isAdminFallbackForPayment(currentUser?.id, p), isConfiguredApprover: isConfiguredApproverForPayment(currentUser?.id, p) })
  ), [payments, currentUser, isFinanceAdmin]);
  const myPendingAdvances = React.useMemo(() => subcontractorAdvances.filter(a =>
    isAdvancePendingForUser(a, currentUser, { isAdmin: isAdminFallbackForProposal(currentUser?.id, a), isConfiguredApprover: isConfiguredApproverForProposal(currentUser?.id, a), employeeIds: employeeIdSet })
  ), [subcontractorAdvances, currentUser, isFinanceAdmin, employeeIdSet]);
  // CÔNG TÁC PHÍ chờ duyệt: user hiện tại được cấu hình xét duyệt CTP (Quyền Phê Duyệt → Công Tác
  // Phí). ⚠️ Bỏ fallback "thuộc nhóm Kế toán → duyệt tất cả" (isRoleAccounting) — cùng lý do rà
  // soát ở trên, chỉ người được add riêng cho "Công Tác Phí" (hoặc admin) mới được duyệt.
  const canApproveTravelExpense = React.useMemo(() => {
    // Quy tắc DÙNG CHUNG ở 3 nơi (xem canApproveTravelExpense trong SettingsContext)
    return canSeeTravelExpenseApproval(currentUser?.id);
  }, [currentUser]);
  const myPendingTravelExpenses = React.useMemo(() => travelExpenses.filter((t: any) =>
    t.status === 'pending' && canApproveTravelExpense
  ), [travelExpenses, canApproveTravelExpense]);
  // ĐỀ XUẤT THU CHI chờ LẬP PHIẾU (KT) — status 'pending_payment' = "Chờ Lập Phiếu (KT)".
  // Đây là bước "Kế toán lập phiếu chi", KHÔNG phải bước xét duyệt — vẫn giữ cho CẢ phòng Kế toán
  // thấy (isRoleAccounting), vì mặc định người lập phiếu là "Kế Toán" nói chung, không gắn với
  // 1 loại hồ sơ "Quyền Phê Duyệt" cụ thể như bước duyệt ở trên.
  // Chỉ Kế toán (thành viên thật của nhóm) hoặc người lập mới thấy — Giám đốc/Siêu Admin không thấy.
  const isVoucherAccountant = isAccountingGroupMember(currentUser?.id);
  const myPendingVouchers = React.useMemo(() => subcontractorAdvances.filter(a =>
    isVoucherPendingForUser(a, { id: currentUser?.id, name: currentUser?.name }, { isAccountingMember: isVoucherAccountant })
  ), [subcontractorAdvances, currentUser, isVoucherAccountant]);
  // ĐỀ XUẤT VẬT TƯ: (1) chờ DUYỆT — Người xét duyệt vật tư / Giám đốc; (2) việc ĐIỀU PHỐI (Tìm nhà cung cấp / Chờ đặt hàng) — Người điều phối vật tư
  const materialInbox = React.useMemo(() => materialInboxFor(materialProposals, currentUser, {
    isAdmin: isAdminFallbackApprover(currentUser?.id, 'material_approver'),
    approverIds: getMaterialApprovers().map(a => a.id),
    coordinatorIds: getMaterialCoordinators().map(c => c.id),
  }), [materialProposals, currentUser, isFinanceAdmin]);
  // ─── Kiểu xem TỔNG QUAN: gom việc/nhiệm vụ của tôi + các mục chờ xử lý (dùng đúng bộ lọc quyền và đúng hàm duyệt của kiểu Cột) ───
  const todayStr = React.useMemo(() => todayYmd(), []);
  const overviewItems = React.useMemo<MyWorkItem[]>(() => buildMyWorkItems(tasks, {
    userId: currentUser?.id, userName: currentUser?.name,
    projectName: (id) => (id ? projectsById.get(id)?.name || '' : ''),
    canReceiveTask: (t) => canDoTaskAction(currentUser, t, t.projectId ? projectsById.get(t.projectId) : undefined, 'receiveTask', taskMatrix),
    includeCompleted: true,   // như kiểu Cột: có cả việc/nhiệm vụ đã hoàn thành (gom trong nhóm "Đã hoàn thành")
  }), [tasks, currentUser, projectsById, taskMatrix]);
  const overviewByMe = React.useMemo(() => assignedByMe(tasks, {
    userId: currentUser?.id, userName: currentUser?.name,
    projectName: (id) => (id ? projectsById.get(id)?.name || '' : ''),
    employeeName: (id) => employees.find(e => e.id === id)?.name || '—',
  }), [tasks, currentUser, projectsById, employees]);
  // "Nhận việc" — cùng hành vi nút "Nhận Việc"/"Nhận NV" của kiểu Cột
  const receiveOverviewItem = (it: MyWorkItem) => {
    const t = tasks.find(x => x.id === it.taskId); if (!t) return;
    if (it.kind === 'task') {
      onUpdateTask(t.id, {
        status: 'doing', completionRate: 20,
        workLogs: [...(t.workLogs || []), { id: `wl_start_${Date.now()}`, actorId: currentUser.id, actorName: currentUser.name, action: 'Nhận Việc', timestamp: new Date().toISOString(), notes: `${currentUser.name} đã Nhận Việc từ danh sách việc.` }],
      });
    } else {
      onUpdateTask(t.id, { missions: (t.missions || []).map(m => m.id === it.missionId ? { ...m, status: 'doing' as const } : m) });
      addToast({ title: '✅ Đã nhận nhiệm vụ', message: `Nhiệm vụ "${it.title}" đã chuyển sang trạng thái Đang làm.`, type: 'success' });
    }
  };
  const overviewInbox = React.useMemo<InboxItem[]>(() => {
    const out: InboxItem[] = [];
    // Công việc chờ tôi duyệt kết quả (mở chi tiết để duyệt — cần xem báo cáo)
    tasks.filter(t => t.status === 'reviewing' && (t.assignerId === currentUser?.id || t.assignerId === currentUser?.name || t.approvals?.some(ap => ap.approverId === currentUser?.id || ap.approverId === currentUser?.name)))
      .forEach(t => out.push({ key: `rv:${t.id}`, chip: 'Duyệt việc', chipTone: 'sky', title: t.name, meta: `${t.projectId ? projectsById.get(t.projectId)?.name || '' : 'Nhiệm vụ nội bộ'} · chờ duyệt kết quả`, actions: [{ label: 'Mở & duyệt', tone: 'main', onClick: () => setSelectedTaskId(t.id) }] }));
    visiblePendingLeaves.forEach(l => out.push({ key: `lv:${l.id}`, chip: 'Nghỉ phép', chipTone: 'rose', title: `${l.empName} — ${l.type}`, meta: `${l.fromDate} → ${l.toDate}`, actions: [{ label: 'Từ chối', tone: 'no', onClick: () => handleApproveLeaveWithPair(l.id, 'rejected') }, { label: 'Duyệt', tone: 'ok', onClick: () => handleApproveLeaveWithPair(l.id, 'approved') }] }));
    myPendingPayments.forEach(p => out.push({ key: `pm:${p.id}`, chip: 'Phiếu chi', chipTone: 'amber', title: `Phát cho ${p.recipient}`, meta: `${p.notes || ''}`.slice(0, 90), amount: p.amount, actions: [{ label: 'Từ chối', tone: 'no', onClick: () => handleApprovePayment(p.id, 'rejected') }, { label: 'Duyệt', tone: 'ok', onClick: () => handleApprovePayment(p.id, 'approved') }] }));
    myPendingAdvances.forEach(a => out.push({ key: `ad:${a.id}`, chip: 'Duyệt chi', chipTone: 'amber', title: (a.reason || a.id).slice(0, 90), meta: `${a.projectName || '—'} · ${a.creatorName || a.creator || ''} · ${a.id}`, amount: a.amount, actions: [{ label: 'Từ chối', tone: 'no', onClick: () => handleApproveAdvance(a.id, 'rejected') }, { label: 'Duyệt', tone: 'ok', onClick: () => handleApproveAdvance(a.id, 'approved') }] }));
    myPendingTravelExpenses.forEach((t: any) => out.push({ key: `tr:${t.rowId || t.id}`, chip: 'Công tác phí', chipTone: 'emerald', title: `${t.creatorName || t.employeeName || 'Nhân viên'} — ${t.code || t.id}`, meta: `${t.completedDate || t.createdAt || ''}`, amount: Number(t.amount || 0), actions: [{ label: 'Từ chối', tone: 'no', onClick: () => handleApproveTravelExpense(t.rowId || t.id, 'rejected') }, { label: 'Duyệt', tone: 'ok', onClick: () => handleApproveTravelExpense(t.rowId || t.id, 'approved') }] }));
    myPendingVouchers.forEach(v => out.push({ key: `vc:${v.id}`, chip: 'Lập phiếu', chipTone: 'orange', title: (v.reason || v.id).slice(0, 90), meta: `${v.projectName || '—'} · ${v.creatorName || v.creator || 'Kế Toán'} · ${v.id}`, amount: v.amount, actions: [{ label: 'Lập phiếu (KT)', tone: 'main', onClick: () => onOpenFinanceVoucher?.(v.id) }] }));
    materialInbox.toApprove.forEach((m: any) => out.push({ key: `mp:${m.id}`, chip: 'Vật tư', chipTone: 'violet', title: `${m.code || m.id} — chờ duyệt`, meta: `${m.projectName || 'Không gắn dự án'} · ${m.createdByName || ''} · ${(m.items || []).length} dòng`, amount: materialProposalTotal(m), actions: [{ label: 'Xem & duyệt', tone: 'main', onClick: () => onOpenMaterialProposal?.(m.id) }] }));
    materialInbox.toCoordinate.forEach((m: any) => out.push({ key: `mc:${m.id}`, chip: 'Vật tư', chipTone: 'violet', title: `${m.code || m.id} — ${COORDINATOR_STATUS_LABEL[m.status] || m.status}`, meta: `${m.projectName || 'Không gắn dự án'} · ${m.createdByName || ''} · ${(m.items || []).length} dòng`, right: m.status === 'find_supplier' ? 'Tìm NCC' : 'Chờ đặt hàng', actions: [{ label: 'Mở & xử lý', tone: 'main', onClick: () => onOpenMaterialProposal?.(m.id) }] }));
    return out;
  }, [tasks, currentUser, projectsById, visiblePendingLeaves, myPendingPayments, myPendingAdvances, myPendingTravelExpenses, myPendingVouchers, materialInbox, onOpenFinanceVoucher, onOpenMaterialProposal]);

  // 3. Nhiệm vụ liên quan chưa hoàn thành (mission.status !== 'completed')

  // Nhóm công việc theo từng Dự Án

  // Nhóm nhiệm vụ được giao theo từng Dự Án (cùng cách nhóm với groupedTasks ở trên)
  // để thẻ "Nhiệm vụ được giao" có bố cục giống "Công việc được giao".

  return (
    <div className="space-y-4 text-slate-100">
      {/* KHU VỰC TIÊU ĐỀ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-xs gap-3">
        <div className="flex items-center gap-3">
          <div className="w-[42px] h-[42px] rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 grid place-items-center text-white shadow-lg shadow-orange-500/30">
            <CheckSquare className="w-[22px] h-[22px]" />
          </div>
          <div>
            <h2 className="text-[19px] font-extrabold tracking-tight text-slate-900 leading-tight">Việc của tôi</h2>
            <p className="text-[12px] text-slate-500 font-medium">Nhận việc được giao, xét duyệt theo yêu cầu.</p>
          </div>
        </div>
      </div>

      {/* VIỆC CỦA TÔI: chỉ còn kiểu Tổng quan (kiểu Cột/Kanban cũ đã bỏ) */}
      <MyWorkOverview
          today={todayStr}
          user={currentUser}
          items={overviewItems}
          inbox={overviewInbox}
          byMe={overviewByMe}
          employees={employees}
          pinKey={companyScopedKey(pinsStorageKey(currentUser?.id))}
          onOpenTask={(id) => setSelectedTaskId(id)}
          onReceive={receiveOverviewItem}
        />

      {/* MODAL CHI TIẾT CÔNG VIỆC CHUYÊN SÂU HOÀN CHỈNH */}
      {selectedTaskId && (() => {
        const openedTaskObj = tasks.find(t => t.id === selectedTaskId);
        const isReadOnlyTask = openedTaskObj
          ? isTaskReadOnlyFor(currentUser as any, openedTaskObj, projects.find(p => p.id === openedTaskObj.projectId), loadTaskPermissionMatrix())
          : false;
          
        return (
          <TaskDetailModal
            taskId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
            tasks={tasks}
            projects={projects}
            employees={employees}
            currentUser={currentUser}
            onUpdateTask={onUpdateTask}
            isReadOnly={isReadOnlyTask}
            customers={customers}
            onRedirectToSubcontractor={onRedirectToSubcontractor}
            onOpenConnectedTool={(tool) => {
              if (tool === 'quotation' && onRedirectToQuote) {
                const task = tasks.find(t => t.id === selectedTaskId);
                if (task && task.projectId) {
                  setSelectedTaskId(null); // Close the detail modal
                  onRedirectToQuote(task.projectId);
                  return;
                }
              }
              setActiveConnectedTool(tool);
              setActiveConnectedToolTaskId(selectedTaskId);
            }}
          />
        );
      })()}

      {/* HỆ THỐNG LIÊN THÔNG ĐA CHIỀU CHUYÊN SÂU */}
      {activeConnectedTool && activeConnectedToolTaskId && (
        <ConnectedToolsModal
          currentUser={currentUser}
          employees={employees}
          tasks={tasks}
          selectedProject={projects.find(p => p.id === (tasks.find(t => t.id === activeConnectedToolTaskId)?.projectId)) || null}
          activeConnectedTool={activeConnectedTool}
          setActiveConnectedTool={setActiveConnectedTool}
          connectedTaskId={activeConnectedToolTaskId}
          setConnectedTaskId={setActiveConnectedToolTaskId}
          overlayTaskId={null}
          customers={customers || []}
          updateProjectWithRule={onUpdateProject || (() => {})}
          localUpdateTask={onUpdateTask}
        />
      )}
    </div>
  );
}
