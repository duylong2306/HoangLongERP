// ─── HRM pure utility functions ────────────────────────────────────────
// Tách từ HumanResourcesManagement.tsx
// Các hàm thuần (pure) — không phụ thuộc React hook hay component state.
import { dbService } from '../../lib/dbService';
import { isAttendanceReportType } from '../../lib/attendanceMeta';

/** Helper trả về ngày local (UTC+7) theo định dạng YYYY-MM-DD. */
export function getLocalYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const r = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${r}`;
}

/** Tính số phút chênh lệch giữa 2 giờ dạng "HH:MM". Trả về số nguyên (âm = sớm, dương = trễ). */
export function minutesDiff(timeActual: string, timeStandard: string): number {
  const parse = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  return parse(timeActual) - parse(timeStandard);
}

// ─── Module-level cache cho shift config (đọc đồng bộ từ Supabase cache) ───────
const HRM_CONFIG_DEFAULTS = {
  morningIn: '07:30', morningOut: '11:30',
  afternoonIn: '13:00', afternoonOut: '17:00',
  allowedLateMinutes: 15,
  allowedLateMorning: 15,
  allowedLateAfternoon: 15,
  punchOutOpenBeforeMinutes: 15,
  punchOutCloseAfterMinutes: 15,
};

let _hrmConfigCache: typeof HRM_CONFIG_DEFAULTS = { ...HRM_CONFIG_DEFAULTS };

/**
 * Nạp shift config từ Supabase vào cache đồng bộ.
 * Gọi 1 lần khi app mount (SettingsContext hoặc App.tsx).
 */
export async function refreshHrmConfigCache(): Promise<void> {
  try {
    const shiftConfig = dbService.shiftConfig;
    const cloud = await shiftConfig.get();
    if (cloud) {
      _hrmConfigCache = {
        morningIn:        cloud.morningIn        ?? HRM_CONFIG_DEFAULTS.morningIn,
        morningOut:       cloud.morningOut       ?? HRM_CONFIG_DEFAULTS.morningOut,
        afternoonIn:      cloud.afternoonIn      ?? HRM_CONFIG_DEFAULTS.afternoonIn,
        afternoonOut:     cloud.afternoonOut     ?? HRM_CONFIG_DEFAULTS.afternoonOut,
        allowedLateMinutes:          cloud.allowedLateMinutes          ?? HRM_CONFIG_DEFAULTS.allowedLateMinutes,
        allowedLateMorning:          cloud.allowedLateMorning          ?? HRM_CONFIG_DEFAULTS.allowedLateMorning,
        allowedLateAfternoon:        cloud.allowedLateAfternoon        ?? HRM_CONFIG_DEFAULTS.allowedLateAfternoon,
        punchOutOpenBeforeMinutes:   cloud.punchOutOpenBeforeMinutes   ?? HRM_CONFIG_DEFAULTS.punchOutOpenBeforeMinutes,
        punchOutCloseAfterMinutes:   cloud.punchOutCloseAfterMinutes   ?? HRM_CONFIG_DEFAULTS.punchOutCloseAfterMinutes,
      };
    }
  } catch { /* defaults */ }
}

/** Đọc cấu hình HrmConfig từ cache (đã load từ Supabase). Trả về defaults nếu cache chưa sẵn sàng. */
export function readHrmConfigFromStorage(): typeof HRM_CONFIG_DEFAULTS {
  return _hrmConfigCache;
}

/**
 * Kiểm tra trạng thái chấm công, có xét cấu hình giờ ca từ HrmConfig.
 * @param hrmConfig Cấu hình giờ ca (tùy chọn – nếu bỏ qua dùng logic cũ).
 */
export function getAttendanceStatusText(
  log: any,
  hrmConfig?: {
    morningIn?: string; morningOut?: string;
    afternoonIn?: string; afternoonOut?: string;
    allowedLateMinutes?: number;
    allowedLateMorning?: number;
    allowedLateAfternoon?: number;
    punchOutOpenBeforeMinutes?: number;
    punchOutCloseAfterMinutes?: number;
  }
): {
  text: 'Hợp Lệ' | 'Không Hợp Lệ';
  isValid: boolean;
  lateMinutes: number;
  earlyMinutes: number;
} {
  const empty = { text: 'Hợp Lệ' as const, isValid: true, lateMinutes: 0, earlyMinutes: 0 };
  if (!log) return empty;

  if (log.status === 'invalid' || log.statusMsg === 'Không hợp lệ') {
    return { text: 'Không Hợp Lệ', isValid: false, lateMinutes: 0, earlyMinutes: 0 };
  }

  const isExcused = log.status === 'excused' || log.status === 'valid' || ['PN', 'P', 'KP', 'NL', 'T', 'C', 'OFF'].includes(log.timeInS);
  if (isExcused) return empty;

  const hasInS  = !(!log.timeInS  || log.timeInS  === '--:--' || log.timeInS  === '');
  const hasOutS = !(!log.timeOutS || log.timeOutS === '--:--' || log.timeOutS === '');
  const hasInC  = !(!log.timeInC  || log.timeInC  === '--:--' || log.timeInC  === '');
  const hasOutC = !(!log.timeOutC || log.timeOutC === '--:--' || log.timeOutC === '');

  const morningWorked  = hasInS && hasOutS;
  const afternoonWorked = hasInC && hasOutC;
  const morningFaulty  = hasInS && !hasOutS;
  const afternoonFaulty = hasInC && !hasOutC;

  const cfg = hrmConfig ?? readHrmConfigFromStorage();
  const punchOutOpenMin = cfg.punchOutOpenBeforeMinutes    ?? 15;

  // Dung sai "Cho phép đi muộn" tách RIÊNG theo từng ca (migration 036):
  //   - Ca Sáng  → allowedLateMorning  (lấy từ ô "⏱️ Cho phép đi muộn" của CA SÁNG)
  //   - Ca Chiều → allowedLateAfternoon (lấy từ ô "⏱️ Cho phép đi muộn" của CA CHIỀU)
  // `allowedLateMinutes` (global) chỉ còn là fallback khi chưa có giá trị per-shift.
  const allowedLateMorning   = cfg.allowedLateMorning   ?? cfg.allowedLateMinutes ?? 5;
  const allowedLateAfternoon = cfg.allowedLateAfternoon ?? cfg.allowedLateMinutes ?? 5;

  // Dung sai làm NGƯỠNG: điểm danh trong khoảng dung sai → KHÔNG tính đi muộn (0).
  // Vượt ngưỡng → hiển thị phút lệch THỰC TẾ, KHÔNG trừ dung sai (vd 76').
  // Về sớm dùng dung sai `punchOutOpenBeforeMinutes` (chung cả 2 ca).
  const rawLateS = (hasInS && cfg.morningIn) ? minutesDiff(log.timeInS, cfg.morningIn) : 0;
  const rawLateC = (hasInC && cfg.afternoonIn) ? minutesDiff(log.timeInC, cfg.afternoonIn) : 0;
  const lateMinutesS = rawLateS > allowedLateMorning ? Math.max(0, rawLateS) : 0;
  const earlyMinutesS = (hasOutS && cfg.morningOut)
    ? Math.max(0, minutesDiff(cfg.morningOut, log.timeOutS) - punchOutOpenMin) : 0;
  const lateMinutesC = rawLateC > allowedLateAfternoon ? Math.max(0, rawLateC) : 0;
  const earlyMinutesC = (hasOutC && cfg.afternoonOut)
    ? Math.max(0, minutesDiff(cfg.afternoonOut, log.timeOutC) - punchOutOpenMin) : 0;

  const totalLate  = lateMinutesS + lateMinutesC;
  const totalEarly = earlyMinutesS + earlyMinutesC;

  if (morningFaulty || afternoonFaulty) {
    return { text: 'Không Hợp Lệ', isValid: false, lateMinutes: totalLate, earlyMinutes: totalEarly };
  }
  if (morningWorked && afternoonWorked) {
    return { text: 'Hợp Lệ', isValid: true, lateMinutes: totalLate, earlyMinutes: totalEarly };
  }
  if (!hasInS && !hasOutS && !hasInC && !hasOutC) {
    return { text: 'Hợp Lệ', isValid: true, lateMinutes: totalLate, earlyMinutes: totalEarly };
  }
  return { text: 'Không Hợp Lệ', isValid: false, lateMinutes: totalLate, earlyMinutes: totalEarly };
}

/** Loại bỏ dấu tiếng Việt (dùng trong tìm kiếm). */
export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/** Gộp các tiêu chí đánh giá trùng nội dung từ nhiều phòng ban. */
export function getDeduplicatedCriteria(originalDepts: { criteria: { id: string; category: string; content: string }[] }[]): { id: string; category: 'readiness' | 'progress' | 'reporting'; content: string }[] {
  const seenContent = new Set<string>();
  const uniqueCriteria: { id: string; category: 'readiness' | 'progress' | 'reporting'; content: string }[] = [];
  originalDepts.forEach(dept => {
    dept.criteria.forEach(crit => {
      const normalized = crit.content.trim().toLowerCase();
      if (!seenContent.has(normalized)) {
        seenContent.add(normalized);
        uniqueCriteria.push({
          id: crit.id,
          category: crit.category as 'readiness' | 'progress' | 'reporting',
          content: crit.content.trim()
        });
      }
    });
  });
  return uniqueCriteria;
}

/**
 * Tính công ngày cho một bản ghi chấm công.
 * Đây là hàm thuần — mọi tham số đều truyền vào.
 */
export function computeDailyWorkday(
  log: any,
  coefs: any[],
  holidays: any[],
  weekendDays: number[] = [0],
  leaves: any[] = [],
  opts: { applyMultiplier?: boolean } = {}
): {
  workday: number;
  label: string;
  details: string;
} {
  const activeCoefs = Array.isArray(coefs) ? coefs : [];
  const activeHolidays = Array.isArray(holidays) ? holidays : [];
  const activeLeaves = Array.isArray(leaves) ? leaves : [];
  // Mặc định áp dụng hệ số nhân (dùng hiển thị & tính lương). Truyền
  // { applyMultiplier: false } nếu cần "công cơ sở" (0.5/1.0) không nhân hệ số.
  const applyMultiplier = opts.applyMultiplier !== false;

  const getCoefVal = (id: string, def: number): number => {
    const found = activeCoefs.find((c: any) => c.id === id);
    return found ? Number(found.coefficient) : def;
  };

  const logInS = log.timeInS || '';
  let activeSymbol = logInS;
  let activeReason = '';

  const approvedLeave = activeLeaves.find((l: any) => {
    if (l.status !== 'approved') return false;
    if (l.isAttendanceCorrection || l.type === 'Yêu cầu xét duyệt công' || isAttendanceReportType(l.type)) return false;
    const sameEmp = (l.empId && log.empId && l.empId === log.empId) || (l.empName && log.empName && l.empName === log.empName);
    if (!sameEmp) return false;
    return log.date >= l.fromDate && log.date <= l.toDate;
  });

  if (approvedLeave) {
    const matchedCoef = activeCoefs.find((c: any) => c.type === approvedLeave.type || c.id === approvedLeave.type);
    if (matchedCoef) {
      activeSymbol = matchedCoef.id;
      activeReason = matchedCoef.type;
    } else {
      const tLower = approvedLeave.type.toLowerCase();
      if (tLower.includes('phép năm') || tLower.includes('pn')) activeSymbol = 'PN';
      else if (tLower.includes('không lương có') || tLower.includes('có phép') || tLower === 'p') activeSymbol = 'P';
      else if (tLower.includes('không phép') || tLower === 'kp') activeSymbol = 'KP';
      else if (tLower.includes('ma chay') || tLower.includes('hiếu') || tLower === 't') activeSymbol = 'T';
      else if (tLower.includes('cưới') || tLower === 'c') activeSymbol = 'C';
      else activeSymbol = 'OFF';
    }
  }

  const leaveSymbols = activeCoefs
    .filter((c: any) => !['TC', 'TCL', 'MSHID', 'ASHID'].includes(c.id))
    .map((c: any) => c.id)
    .concat(['P', 'KP', 'PN', 'NL', 'T', 'C', 'OFF']);

  const isLeave = leaveSymbols.includes(activeSymbol);

  if (isLeave) {
    if (activeSymbol === 'OFF') {
      return { workday: 0, label: 'OFF', details: 'Nghỉ ca / Ngày nghỉ' };
    }
    const val = getCoefVal(activeSymbol, 0);
    const coefObj = activeCoefs.find((c: any) => c.id === activeSymbol);
    const name = coefObj ? coefObj.type : (activeReason || 'Nghỉ phép');
    return { workday: val, label: `${val > 0 ? '+' : ''}${val}`, details: `${name} (${activeSymbol})` };
  }

  let isHoliday = false;
  let holidayName = '';
  if (log.date) {
    try {
      const parts = log.date.split('-');
      if (parts.length === 3) {
        const dd_mm_yyyy = `${parts[2]}/${parts[1]}/${parts[0]}`;
        const foundHoliday = activeHolidays.find((h: any) => h.date === dd_mm_yyyy);
        if (foundHoliday) { isHoliday = true; holidayName = foundHoliday.name; }
      }
    } catch (e) { console.error('Error parsing log date for holiday checks:', e); }
  }

  let dayOfWeek = 0;
  try { dayOfWeek = new Date(log.date).getDay(); } catch (e) {}

  const isWeekend = weekendDays.includes(dayOfWeek);

  const hasInS = log.timeInS && log.timeInS !== '--:--' && log.timeInS !== '';
  const hasOutS = log.timeOutS && log.timeOutS !== '--:--' && log.timeOutS !== '';
  const hasInC = log.timeInC && log.timeInC !== '--:--' && log.timeInC !== '';
  const hasOutC = log.timeOutC && log.timeOutC !== '--:--' && log.timeOutC !== '';

  const morningWorked = hasInS && hasOutS;
  const afternoonWorked = hasInC && hasOutC;

  const morningBaseVal = getCoefVal('MSHID', 0.5);
  const afternoonBaseVal = getCoefVal('ASHID', 0.5);

  const morningWorkVal = morningWorked ? morningBaseVal : 0;
  const afternoonWorkVal = afternoonWorked ? afternoonBaseVal : 0;
  const totalBaseShifts = morningWorkVal + afternoonWorkVal;

  let multiplier = 1.0;
  let multiplierType = 'Ngày thường';

  if (isHoliday) {
    multiplier = getCoefVal('TCL', 3.0);
    multiplierType = 'Lễ/Tết';
  } else if (dayOfWeek === 0) {
    multiplier = getCoefVal('TC', 2.0);
    multiplierType = 'Chủ Nhật';
  } else if (isWeekend) {
    multiplier = getCoefVal('TC', 2.0);
    multiplierType = 'Cuối tuần';
  }

  if (morningWorked || afternoonWorked) {
    const finalVal = totalBaseShifts * (applyMultiplier ? multiplier : 1);
    const detailsText = `${morningWorked ? 'Sáng' : ''}${morningWorked && afternoonWorked ? '+' : ''}${afternoonWorked ? 'Chiều' : ''} (Nhân ${multiplier}x ${multiplierType})`;
    // Bỏ phạt -0.25 công khi đi muộn (MDLATE): đi muộn vẫn ghi nhận đủ công.
    // Vi phạm đi muộn giờ được xử lý qua bảng Hiệu suất (hrm_employee_errors)
    // khi số lần đi muộn trong tháng vượt quá ngưỡng cho phép (allowedLateCount).
    return {
      workday: finalVal,
      label: `+${finalVal}`,
      details: detailsText
    };
  } else {
    const hasAnyPunch = hasInS || hasOutS || hasInC || hasOutC ||
      (log.timeInOT && log.timeInOT !== '--:--' && log.timeInOT !== '') ||
      (log.timeOutOT && log.timeOutOT !== '--:--' && log.timeOutOT !== '');
    if (hasAnyPunch) return { workday: 0, label: '0', details: 'Đang làm việc (chờ chốt ca)' };

    if (!isHoliday && !isWeekend) {
      // Hệ số vắng không phép = công cơ sở (MSHID + ASHID) nhân với hệ số KP
      // (mã 'KP' trong tab Hệ Số Chấm Công). Mặc định: 1.0 × (-1.0) = -1.0.
      const baseDay = getCoefVal('MSHID', 0.5) + getCoefVal('ASHID', 0.5);
      const kpCoef = getCoefVal('KP', -1.0);
      const penaltyVal = baseDay * kpCoef;
      return { workday: penaltyVal, label: `${penaltyVal}`, details: 'Vắng không phép (KP)' };
    } else {
      return { workday: 0, label: '0', details: isHoliday ? `Nghỉ Lễ (${holidayName})` : 'Nghỉ cuối tuần' };
    }
  }
}

/**
 * Tính điểm hiệu suất % theo số lỗi vi phạm trong kỳ.
 * Được dùng chung ở tab Hiệu suất (PerformanceTab) và Tính Lương Tự Động
 * (handleCalculatePayroll) để hai nơi cho ra cùng một con số %.
 * 0→100, 1→97, 2→95, 3→90, 4→85, 5→80, ≥6→50.
 */
export function calculateScoreFromErrorCount(count: number): number {
  if (count === 0) return 100;
  if (count === 1) return 97;
  if (count === 2) return 95;
  if (count === 3) return 90;
  if (count === 4) return 85;
  if (count === 5) return 80;
  return 50; // count >= 6
}

/**
 * Tính tổng Công Tác Phí (CTP) ĐÃ DUYỆT của một nhân viên trong đúng kỳ lương
 * (tháng/năm). Được dùng trong Tính Lương Tự Động (handleCalculatePayroll).
 * - CHỈ cộng `status === 'approved'` (duyệt qua nút Duyệt) HOẶC
 *   `status === 'completed'` (CTP legacy của cơ chế cũ — tự động "Đã duyệt" khi
 *   hoàn thành, hiển thị như Đã duyệt). CTP "Chờ duyệt"/"Từ chối" KHÔNG tính.
 * - Match nhân viên theo `empId` khi có; fallback theo `employeeName` cho dữ
 *   liệu cũ (trước đây chỉ lưu tên, không lưu empId).
 * - Khớp tháng-năm theo `completedDate` (dd/mm/yyyy hoặc ISO) — mỗi khoản chỉ
 *   tính vào đúng kỳ lương của chuyến đi.
 */
export function sumApprovedTravelExpenses(
  travelExpenses: any[],
  emp: { id?: string; name?: string },
  payrollMonth: string,
  payrollYear: string,
): number {
  const monthNum = String(Number(payrollMonth));
  return (travelExpenses || []).reduce((sum, s: any) => {
    if (s.status !== 'approved' && s.status !== 'completed') return sum;
    const empMatch = s.empId
      ? s.empId === emp.id
      : (s.employeeName || '') === (emp.name || '');
    if (!empMatch) return sum;
    if (!s.completedDate) return sum;
    let cMonth = '';
    let cYear = '';
    const parts = String(s.completedDate).split('/');
    if (parts.length === 3) {
      cMonth = String(parseInt(parts[1], 10));
      cYear = parts[2];
    } else {
      const dateObj = new Date(s.completedDate);
      if (!isNaN(dateObj.getTime())) {
        cMonth = String(dateObj.getMonth() + 1);
        cYear = String(dateObj.getFullYear());
      }
    }
    if (cMonth !== monthNum || cYear !== payrollYear) return sum;
    return sum + (Number(s.amount) || 0);
  }, 0);
}

// ─── Báo cáo vắng mặt (ngày không có bản ghi chấm công) ───────────────────
// Hàm thuần: liệt kê các ngày mà nhân viên Đang làm KHÔNG có bản ghi chấm
// công, để HR duyệt thủ công (gán KP / phép / bù công / bỏ qua).
//
// Đã loại trừ:
//  - Nhân viên không ở trạng thái "working" (đã nghỉ việc…).
//  - excludedIds / excludedRoles (mặc định: admin / giám đốc — không tự động
//    phạt KP cho người không chấm công hàng ngày).
//  - Ngày trước ngày vào làm (emp.startDate).
//  - Ngày được bao phủ bởi đơn nghỉ ĐÃ DUYỆT (không tính đơn báo cáo/chốt công).
//  - Ngày tương lai (chưa tới kỳ chấm công).

export interface MissingAttendanceEntry {
  empId: string;
  empName: string;
  date: string;        // YYYY-MM-DD
  dayOfWeek: number;
  isHoliday: boolean;
  isWeekend: boolean;
  type: 'absent' | 'holiday' | 'weekend';
}

function matchHolidayDate(dateStr: string, holidays: any[]): boolean {
  if (!dateStr || !Array.isArray(holidays)) return false;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const ddMmYyyy = `${parts[2]}/${parts[1]}/${parts[0]}`;
  return holidays.some((h: any) => {
    if (h.inputMode === 'single') return h.singleDate === dateStr;
    return dateStr >= h.fromDate && dateStr <= h.toDate;
  });
}

function eachDateInRange(from: string, to: string): string[] {
  const out: string[] = [];
  if (!from || !to) return out;
  const cur = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (isNaN(cur.getTime()) || isNaN(end.getTime())) return out;
  while (cur <= end) {
    out.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    );
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function getMissingAttendanceReport(params: {
  employees: any[];
  attendance: any[];
  leaves: any[];
  holidays: any[];
  weekendDays: number[];
  month: string;   // '1'..'12'
  year: string;    // '2026'
  excludedIds?: string[];
  excludedRoles?: string[];
}): MissingAttendanceEntry[] {
  const {
    employees, attendance, leaves, holidays, weekendDays,
    month, year, excludedIds = [], excludedRoles = [],
  } = params;

  const result: MissingAttendanceEntry[] = [];
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (!Array.isArray(employees) || !m || !y) return result;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const excludedIdSet = new Set(excludedIds);
  const excludedRoleSet = new Set(excludedRoles);

  const existing = new Set(
    (attendance || []).map((a: any) => `${a.empId}|${a.date}`)
  );

  // Ngày được bao phủ bởi đơn nghỉ ĐÃ DUYỆT (không tính đơn báo cáo/chốt công).
  const leaveCov = new Set<string>();
  (leaves || []).forEach((l: any) => {
    if (l.status !== 'approved') return;
    if (l.isAttendanceCorrection || l.type === 'Yêu cầu xét duyệt công' || isAttendanceReportType(l.type)) return;
    eachDateInRange(l.fromDate, l.toDate).forEach((d) => {
      if (l.empId) leaveCov.add(`${l.empId}|${d}`);
      if (l.empName) leaveCov.add(`${l.empName}|${d}`);
    });
  });

  const daysInMonth = new Date(y, m, 0).getDate();

  (employees || []).forEach((emp: any) => {
    if (emp.status !== 'working') return;
    if (excludedIdSet.has(emp.id)) return;
    if (emp.role && excludedRoleSet.has(emp.role)) return;

    const startDate = (typeof emp.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(emp.startDate))
      ? emp.startDate
      : null;
    const empName = emp.name || emp.empName || emp.id || '';

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (dateStr > todayStr) continue;               // bỏ ngày tương lai
      if (startDate && dateStr < startDate) continue;  // bỏ trước ngày vào làm
      if (existing.has(`${emp.id}|${dateStr}`)) continue;
      if (leaveCov.has(`${emp.id}|${dateStr}`)) continue;

      const dow = new Date(`${dateStr}T00:00:00`).getDay();
      const isHoliday = matchHolidayDate(dateStr, holidays);
      const isWeekend = (weekendDays || []).includes(dow);
      const type: MissingAttendanceEntry['type'] = isHoliday ? 'holiday' : isWeekend ? 'weekend' : 'absent';

      result.push({ empId: emp.id, empName, date: dateStr, dayOfWeek: dow, isHoliday, isWeekend, type });
    }
  });

  result.sort((a, b) => a.empName.localeCompare(b.empName) || (a.date < b.date ? -1 : 1));
  return result;
}

/**
 * Tính lương cho 1 nhân viên (thuần).
 * @param emp           thông tin nhân viên
 * @param monthStr      chuỗi "MM/YYYY"
 * @param inputs        các đầu vào số
 * @param salaryScales  danh sách thang lương
 * @param standardWorkDays số công chuẩn
 * @returns PayrollItem-like data (thiếu id, empId, empName, month, status)
 */
export function calculateSingleEmployeePayroll(
  emp: any,
  monthStr: string,
  inputs: {
    workedDays: number;
    kpiScore: number;
    otSunday: number;
    otHoliday: number;
    otHours: number;
    otCount: number;
    bonusHoliday: number;
    bonusCreative: number;
    otherDeductions: number;
    advances: number;
    expenses: number;
  },
  salaryScales: any[],
  standardWorkDays: number,
) {
  const scale = salaryScales.find((s: any) => s.id === emp.salaryCode);
  const baseSalary = scale ? scale.baseSalary : (emp.baseSalary || 5200000);
  const performanceSalary = scale ? scale.performanceSalary : 0;
  const kpiScore = inputs.kpiScore;

  const kpiBonus = (performanceSalary * kpiScore) / 100;
  const salaryPerDay = (baseSalary + kpiBonus) / standardWorkDays;
  const daySalary = salaryPerDay * inputs.workedDays;

  const otSundayCount = inputs.otSunday;
  const otSundaySalary = salaryPerDay * otSundayCount;

  const otHolidayCount = inputs.otHoliday;
  const otHolidaySalary = salaryPerDay * otHolidayCount;

  const otHours = inputs.otHours;
  const otCount = inputs.otCount;
  const otHoursSalary = ((salaryPerDay / 8) * otHours * 1.5) + (otCount * 40000);

  const expenses = inputs.expenses;
  const bonusHoliday = inputs.bonusHoliday;
  const bonusCreative = inputs.bonusCreative;

  const totalIncome = daySalary + otSundaySalary + otHolidaySalary + otHoursSalary + expenses + bonusHoliday + bonusCreative;

  const bhxhAmount = baseSalary * 0.105;
  const otherDeductions = inputs.otherDeductions;
  const advances = inputs.advances;

  const netSalaryRaw = totalIncome - bhxhAmount - otherDeductions - advances;
  const netSalary = parseFloat(netSalaryRaw.toFixed(4));

  const bluCode = `BLU-${emp.id}-${monthStr.replace('/', '')}`;

  return {
    bluCode,
    workedDays: inputs.workedDays,
    baseSalary,
    performanceSalary,
    kpiScore,
    kpiBonus,
    salaryPerDay,
    daySalary,
    otSunday: otSundayCount,
    otSundaySalary,
    otHoliday: otHolidayCount,
    otHolidaySalary,
    otHours,
    otCount,
    otHoursSalary,
    expenses,
    bonusHoliday,
    bonusCreative,
    totalIncome,
    insurance: bhxhAmount,
    otherDeductions,
    advances,
    netSalary
  };
}
