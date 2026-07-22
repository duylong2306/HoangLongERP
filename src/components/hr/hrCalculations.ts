// ─── HRM pure utility functions ────────────────────────────────────────
// Tách từ HumanResourcesManagement.tsx
// Các hàm thuần (pure) — không phụ thuộc React hook hay component state.

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
    const { dbService } = await import('../../lib/dbService');
    const shiftConfig = dbService.shiftConfig;
    const cloud = await shiftConfig.get();
    if (cloud) {
      _hrmConfigCache = {
        morningIn:        cloud.morningIn        ?? HRM_CONFIG_DEFAULTS.morningIn,
        morningOut:       cloud.morningOut       ?? HRM_CONFIG_DEFAULTS.morningOut,
        afternoonIn:      cloud.afternoonIn      ?? HRM_CONFIG_DEFAULTS.afternoonIn,
        afternoonOut:     cloud.afternoonOut     ?? HRM_CONFIG_DEFAULTS.afternoonOut,
        allowedLateMinutes:          cloud.allowedLateMinutes          ?? HRM_CONFIG_DEFAULTS.allowedLateMinutes,
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
  const allowedLate     = cfg.allowedLateMinutes           ?? 15;
  const punchOutOpenMin = cfg.punchOutOpenBeforeMinutes    ?? 15;

  const lateMinutesS = (hasInS && cfg.morningIn)
    ? Math.max(0, minutesDiff(log.timeInS, cfg.morningIn) - allowedLate) : 0;
  const earlyMinutesS = (hasOutS && cfg.morningOut)
    ? Math.max(0, minutesDiff(cfg.morningOut, log.timeOutS) - punchOutOpenMin) : 0;
  const lateMinutesC = (hasInC && cfg.afternoonIn)
    ? Math.max(0, minutesDiff(log.timeInC, cfg.afternoonIn) - allowedLate) : 0;
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
  leaves: any[] = []
): {
  workday: number;
  label: string;
  details: string;
} {
  const activeCoefs = Array.isArray(coefs) ? coefs : [];
  const activeHolidays = Array.isArray(holidays) ? holidays : [];
  const activeLeaves = Array.isArray(leaves) ? leaves : [];

  const getCoefVal = (id: string, def: number): number => {
    const found = activeCoefs.find((c: any) => c.id === id);
    return found ? Number(found.coefficient) : def;
  };

  const logInS = log.timeInS || '';
  let activeSymbol = logInS;
  let activeReason = '';

  const approvedLeave = activeLeaves.find((l: any) => {
    if (l.status !== 'approved') return false;
    if (l.isAttendanceCorrection || l.type === 'Yêu cầu xét duyệt công' || l.type === 'Báo cáo nghỉ ca' || l.type === 'Báo cáo lỗi chấm ra ca') return false;
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
    const finalVal = totalBaseShifts * multiplier;
    const detailsText = `${morningWorked ? 'Sáng' : ''}${morningWorked && afternoonWorked ? '+' : ''}${afternoonWorked ? 'Chiều' : ''} (Nhân ${multiplier}x ${multiplierType})`;
    let latePenalty = 0;
    let lateNote = '';
    if (log.status === 'late' && !isHoliday && !isWeekend) {
      latePenalty = getCoefVal('MDLATE', -0.25);
      lateNote = ` • Phạt muộn ${latePenalty}`;
    }
    return {
      workday: finalVal + latePenalty,
      label: `+${finalVal + latePenalty}`,
      details: detailsText + lateNote
    };
  } else {
    const hasAnyPunch = hasInS || hasOutS || hasInC || hasOutC ||
      (log.timeInOT && log.timeInOT !== '--:--' && log.timeInOT !== '') ||
      (log.timeOutOT && log.timeOutOT !== '--:--' && log.timeOutOT !== '');
    if (hasAnyPunch) return { workday: 0, label: '0', details: 'Đang làm việc (chờ chốt ca)' };

    if (!isHoliday && !isWeekend) {
      const penaltyVal = getCoefVal('KP', -1.0);
      return { workday: penaltyVal, label: `${penaltyVal}`, details: 'Vắng không phép (KP)' };
    } else {
      return { workday: 0, label: '0', details: isHoliday ? `Nghỉ Lễ (${holidayName})` : 'Nghỉ cuối tuần' };
    }
  }
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
