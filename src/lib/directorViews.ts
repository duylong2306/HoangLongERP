// ─── Hàm thuần dùng chung cho các tab phòng ban của Dashboard Giám đốc (lọc, tìm kiếm, khoảng ngày, phân trang) ─────────────────
// Tách riêng khỏi giao diện để kiểm thử được. Ngày luôn là chuỗi 'YYYY-MM-DD' theo giờ địa phương (xem executiveDashboard.toDay).
import { toDay, addDays } from './executiveDashboard';

/** Bỏ dấu tiếng Việt + chữ thường — để gõ "nguyen" vẫn tìm thấy "Nguyễn", "dong" tìm thấy "Đồng". */
export function normalizeText(s?: string | null): string {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .toLowerCase().trim();
}

/** Chuỗi tìm kiếm khớp với BẤT KỲ trường nào (không dấu, không phân biệt hoa thường). Chuỗi tìm rỗng → khớp tất cả. */
export function matchesQuery(query: string, ...fields: (string | number | null | undefined)[]): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  return fields.some(f => normalizeText(String(f ?? '')).includes(q));
}

// ─── Khoảng ngày ────────────────────────────────────────────────────────────────────────────────
export type DatePreset = 'today' | '7d' | '30d' | 'month' | 'all' | 'custom';
export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Hôm nay', '7d': '7 ngày qua', '30d': '30 ngày qua', month: 'Tháng này', all: 'Tất cả', custom: 'Chọn khoảng ngày',
};

/** Trả về [từ, đến] (YYYY-MM-DD, gồm cả hai đầu); '' nghĩa là không giới hạn phía đó. */
export function rangeOf(preset: DatePreset, today: string, from = '', to = ''): { from: string; to: string } {
  switch (preset) {
    case 'today': return { from: today, to: today };
    case '7d': return { from: addDays(today, -6), to: today };
    case '30d': return { from: addDays(today, -29), to: today };
    case 'month': return { from: `${today.slice(0, 7)}-01`, to: today };
    case 'custom': return { from: toDay(from), to: toDay(to) };
    default: return { from: '', to: '' };
  }
}

/** Ngày `value` có nằm trong khoảng không (value rỗng/không hiểu được → chỉ khớp khi khoảng không giới hạn). */
export function inRange(value: string | undefined | null, range: { from: string; to: string }): boolean {
  if (!range.from && !range.to) return true;
  const d = toDay(value);
  if (!d) return false;
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

// ─── Phân trang ──────────────────────────────────────────────────────────────────────────────────
export const PAGE_SIZES = [10, 20, 50, 100] as const;
export interface PageInfo { page: number; pageSize: number; total: number; totalPages: number; from: number; to: number }
/** Tính thông tin trang; `page` quá lớn (do bộ lọc thu hẹp danh sách) tự kéo về trang cuối. */
export function pageInfo(total: number, page: number, pageSize: number): PageInfo {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (p - 1) * pageSize + 1;
  return { page: p, pageSize, total, totalPages, from, to: Math.min(total, p * pageSize) };
}
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const info = pageInfo(items.length, page, pageSize);
  return items.slice((info.page - 1) * pageSize, info.page * pageSize);
}

// ─── Thầu phụ: tổng hợp theo từng thầu phụ ───────────────────────────────────────────────────────
export interface SubcontractorRow {
  sub: any;
  /** Số hợp đồng (mọi trạng thái) và số đã duyệt */
  contracts: number; approvedContracts: number;
  /** Tổng giá trị hợp đồng ĐÃ DUYỆT */
  contractValue: number;
  /** Đã chi cho thầu phụ (phiếu chi đã duyệt có subcontractorId) và phần chờ duyệt */
  paid: number; pendingPaid: number;
  /** Còn phải chi theo hợp đồng = hợp đồng đã duyệt − đã chi (không âm) */
  remaining: number;
  /** Công nợ ghi trên hồ sơ thầu phụ */
  debt: number;
  projectIds: string[];
  pendingProposals: number;
}
const contractAmount = (q: any) => Number(q?.contractValue ?? q?.totalAmount ?? 0) || 0;
export function buildSubcontractorRows(subs: any[], contracts: any[], payments: any[], advances: any[]): SubcontractorRow[] {
  return (subs || []).map(sub => {
    const mine = (contracts || []).filter(c => c.subcontractorId === sub.id);
    const approved = mine.filter(c => c.isApproved === true);
    const pays = (payments || []).filter(p => p.subcontractorId === sub.id);
    const paid = pays.filter(p => p.status === 'approved').reduce((s, p) => s + (p.amount || 0), 0);
    const contractValue = approved.reduce((s, c) => s + contractAmount(c), 0);
    return {
      sub, contracts: mine.length, approvedContracts: approved.length, contractValue, paid,
      pendingPaid: pays.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0),
      remaining: Math.max(0, contractValue - paid), debt: Number(sub.debt) || 0,
      projectIds: Array.from(new Set(mine.map(c => c.projectId).filter(Boolean))),
      pendingProposals: (advances || []).filter(a => a.subcontractorId === sub.id && (a.status === 'pending_approval' || a.status === 'pending_payment' || a.status === 'awaiting_voucher_update')).length,
    };
  });
}
export { contractAmount };
