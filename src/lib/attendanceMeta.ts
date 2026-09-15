// ============================================================================
// attendanceMeta.ts
// Tiện ích dùng chung cho ẢNH FaceID + TỌA ĐỘ GPS theo TỪNG LƯỢT chấm công.
//
// Mỗi ngày nhân viên chấm tối đa 6 lượt (slot):
//   timeInS (Vào sáng) · timeOutS (Ra sáng)
//   timeInC (Vào chiều) · timeOutC (Ra chiều)
//   timeInOT (Vào tăng ca) · timeOutOT (Ra tăng ca)
//
// Trước đây record chỉ có 1 cặp photoIn/photoOut cho cả ngày nên lượt chấm sau
// GHI ĐÈ lượt trước. Nay metadata được lưu trong `punchMeta` (map theo slot),
// tương ứng cột jsonb `punch_meta` trên Supabase (migration 024).
// ============================================================================

export type PunchSlotKey =
  | 'timeInS' | 'timeOutS'
  | 'timeInC' | 'timeOutC'
  | 'timeInOT' | 'timeOutOT';

export interface PunchMetaEntry {
  /** Ảnh selfie đã "đốt giờ" (data URL hoặc URL) */
  photo?: string;
  /** Địa chỉ đọc ngược từ GPS hoặc tên công trình */
  location?: string;
  /** Tọa độ "lat, lng" */
  coords?: string;
  /** Giờ chấm "HH:MM" tại thời điểm ghi metadata */
  at?: string;
}

export type PunchMeta = Partial<Record<PunchSlotKey, PunchMetaEntry>>;

export interface PunchSlotDef {
  key: PunchSlotKey;
  /** Nhãn tiếng Việt hiển thị cho người dùng */
  label: string;
  /** Nhãn ngắn dùng trong bảng chật chỗ */
  shortLabel: string;
  shift: 'morning' | 'afternoon' | 'overtime';
  direction: 'in' | 'out';
  icon: string;
}

/** Danh sách 6 slot theo đúng thứ tự thời gian trong ngày. */
export const PUNCH_SLOTS: PunchSlotDef[] = [
  { key: 'timeInS',   label: 'Vào sáng',     shortLabel: 'V.Sáng', shift: 'morning',   direction: 'in',  icon: '🌅' },
  { key: 'timeOutS',  label: 'Ra sáng',      shortLabel: 'R.Sáng', shift: 'morning',   direction: 'out', icon: '🌤️' },
  { key: 'timeInC',   label: 'Vào chiều',    shortLabel: 'V.Chiều', shift: 'afternoon', direction: 'in',  icon: '🌇' },
  { key: 'timeOutC',  label: 'Ra chiều',     shortLabel: 'R.Chiều', shift: 'afternoon', direction: 'out', icon: '🌆' },
  { key: 'timeInOT',  label: 'Vào tăng ca',  shortLabel: 'V.TC',   shift: 'overtime',  direction: 'in',  icon: '🌌' },
  { key: 'timeOutOT', label: 'Ra tăng ca',   shortLabel: 'R.TC',   shift: 'overtime',  direction: 'out', icon: '🌃' },
];

export const PUNCH_SLOT_LABELS: Record<PunchSlotKey, string> = PUNCH_SLOTS.reduce(
  (acc, s) => { acc[s.key] = s.label; return acc; },
  {} as Record<PunchSlotKey, string>
);

const isFilled = (v: unknown): v is string =>
  typeof v === 'string' && v.trim() !== '' && v !== '--:--';

/** Metadata của slot có dữ liệu thật sự không (ảnh hoặc tọa độ). */
export function hasSlotMeta(entry?: PunchMetaEntry | null): boolean {
  if (!entry) return false;
  return isFilled(entry.photo) || isFilled(entry.coords) || isFilled(entry.location);
}

/** Chuẩn hóa punchMeta lấy từ DB/localStorage (có thể là chuỗi JSON hoặc null). */
export function parsePunchMeta(raw: any): PunchMeta {
  if (!raw) return {};
  let obj: any = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return {}; }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out: PunchMeta = {};
  for (const slot of PUNCH_SLOTS) {
    const e = obj[slot.key];
    if (e && typeof e === 'object' && hasSlotMeta(e)) {
      out[slot.key] = {
        photo: isFilled(e.photo) ? e.photo : undefined,
        location: isFilled(e.location) ? e.location : undefined,
        coords: isFilled(e.coords) ? e.coords : undefined,
        at: isFilled(e.at) ? e.at : undefined,
      };
    }
  }
  return out;
}

/**
 * Gộp 2 punchMeta theo từng slot. `next` thắng ở những slot nó có dữ liệu;
 * các slot chỉ có trong `prev` được GIỮ LẠI (không bị xóa).
 * Dùng khi: merge bản ghi trùng, hoặc merge state client với dữ liệu đã có trên DB.
 */
export function mergePunchMeta(prev: any, next: any): PunchMeta {
  const a = parsePunchMeta(prev);
  const b = parsePunchMeta(next);
  const out: PunchMeta = { ...a };
  for (const slot of PUNCH_SLOTS) {
    const nb = b[slot.key];
    if (!hasSlotMeta(nb)) continue;
    const na = a[slot.key];
    out[slot.key] = {
      photo: isFilled(nb!.photo) ? nb!.photo : na?.photo,
      location: isFilled(nb!.location) ? nb!.location : na?.location,
      coords: isFilled(nb!.coords) ? nb!.coords : na?.coords,
      at: isFilled(nb!.at) ? nb!.at : na?.at,
    };
  }
  return out;
}

/** Bản ghi có metadata theo slot nào không (để quyết định fallback dữ liệu cũ). */
export function hasAnyPunchMeta(log: any): boolean {
  const meta = parsePunchMeta(log?.punchMeta);
  return PUNCH_SLOTS.some(s => hasSlotMeta(meta[s.key]));
}

export interface SlotView extends PunchSlotDef {
  /** Giờ chấm lấy từ chính cột thời gian của bản ghi ("--:--" nếu chưa chấm) */
  time: string;
  punched: boolean;
  photo?: string;
  location?: string;
  coords?: string;
}

/**
 * Trả về danh sách slot ĐÃ CHẤM kèm ảnh/tọa độ tương ứng.
 * Chỉ đọc từ punchMeta — KHÔNG suy đoán từ cặp photoIn/photoOut cũ, vì cặp cũ
 * không cho biết nó thuộc lượt nào (ảnh "Vào" có thể là vào sáng hoặc vào chiều).
 * Dữ liệu cũ được UI hiển thị riêng qua getLegacyMedia().
 */
export function getSlotViews(log: any, opts?: { onlyWithMedia?: boolean }): SlotView[] {
  const meta = parsePunchMeta(log?.punchMeta);
  const views: SlotView[] = [];
  for (const slot of PUNCH_SLOTS) {
    const rawTime = log?.[slot.key];
    const time = isFilled(rawTime) ? String(rawTime) : '--:--';
    const entry = meta[slot.key];
    const punched = time !== '--:--';
    if (!punched && !hasSlotMeta(entry)) continue;
    if (opts?.onlyWithMedia && !hasSlotMeta(entry)) continue;
    views.push({
      ...slot,
      time: time !== '--:--' ? time : (entry?.at || '--:--'),
      punched,
      photo: entry?.photo,
      location: entry?.location,
      coords: entry?.coords,
    });
  }
  return views;
}

export interface LegacyMedia {
  photoIn?: string;
  photoOut?: string;
  coordsIn?: string;
  coordsOut?: string;
  locationIn?: string;
  locationOut?: string;
}

/**
 * Ảnh/tọa độ theo định dạng CŨ (1 cặp vào/ra cho cả ngày).
 * Chỉ dùng để hiển thị cho bản ghi ghi TRƯỚC khi có punchMeta.
 * Trả về null nếu bản ghi đã có metadata theo slot (tránh hiển thị trùng).
 */
export function getLegacyMedia(log: any): LegacyMedia | null {
  if (!log) return null;
  if (hasAnyPunchMeta(log)) return null;
  const out: LegacyMedia = {};
  if (isFilled(log.photoIn)) out.photoIn = log.photoIn;
  if (isFilled(log.photoOut)) out.photoOut = log.photoOut;
  if (isFilled(log.coordsIn)) out.coordsIn = log.coordsIn;
  if (isFilled(log.coordsOut)) out.coordsOut = log.coordsOut;
  if (isFilled(log.locationIn)) out.locationIn = log.locationIn;
  if (isFilled(log.locationOut)) out.locationOut = log.locationOut;
  return Object.keys(out).length > 0 ? out : null;
}

/** Link Google Maps cho 1 chuỗi tọa độ. */
export function mapsUrl(coords: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords)}`;
}

// ============================================================================
// CÁC LOẠI ĐƠN GIẢI TRÌNH CHẤM CÔNG
// ----------------------------------------------------------------------------
// Dùng chung giữa Dashboard (gửi), HRM và TaskManagement (duyệt) để tránh
// rải rác chuỗi literal. Thêm loại mới ("lỗi hệ thống chấm công") phải thêm
// vào đây và xử lý ở cả 3 nơi (Dashboard form, HRM + TaskManagement approve).
// ============================================================================

export const ATTENDANCE_REPORT_TYPES = [
  'Báo cáo nghỉ ca',
  'Báo cáo lỗi chấm ra ca',
  'Báo cáo lỗi hệ thống chấm công',
] as const;

export type AttendanceReportType = typeof ATTENDANCE_REPORT_TYPES[number];

/** Đơn có phải là một trong các loại giải trình chấm công không. */
export function isAttendanceReportType(type?: string): boolean {
  return !!type && (ATTENDANCE_REPORT_TYPES as readonly string[]).includes(type);
}
