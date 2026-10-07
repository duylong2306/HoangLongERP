// LOGIC THUẦN về GÓI DỊCH VỤ / HẠN DÙNG / ĐƠN ĐĂNG KÝ — dùng chung cho api/login.ts, api/subscription.ts, api/platform.ts.
// Không gọi DB/mạng (dễ test). File bắt đầu bằng "_" nên Vercel không coi là endpoint. KHÔNG import từ src/ (xem api/login.ts).
import { randomInt } from 'crypto';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_TOKEN_SECONDS = 7 * 24 * 60 * 60;   // JWT đăng nhập tối đa 7 ngày (như trước)

// ─── Trạng thái hạn dùng của 1 doanh nghiệp ───────────────────────────────────────────────────────
export type SubStatus = 'unlimited' | 'trial' | 'active' | 'expired';

export interface CompanySubInput {
  expires_at?: string | null;   // null/thiếu = không giới hạn
  is_trial?: boolean | null;
}
export interface SubState {
  status: SubStatus;
  expiresAt: string | null;
  daysLeft: number | null;      // số ngày còn lại (làm tròn LÊN); null nếu không giới hạn; 0 nếu đã hết
  isTrial: boolean;
  locked: boolean;              // true = đã hết hạn → chỉ được vào trang gia hạn
}

export function getSubscriptionState(c: CompanySubInput, now: Date = new Date()): SubState {
  if (!c.expires_at) {
    return { status: 'unlimited', expiresAt: null, daysLeft: null, isTrial: false, locked: false };
  }
  const exp = new Date(c.expires_at);
  if (isNaN(exp.getTime())) {
    // Dữ liệu hạn hỏng: coi như đã hết hạn (khóa) thay vì mở khóa nhầm.
    return { status: 'expired', expiresAt: c.expires_at, daysLeft: 0, isTrial: !!c.is_trial, locked: true };
  }
  const left = exp.getTime() - now.getTime();
  if (left <= 0) {
    return { status: 'expired', expiresAt: exp.toISOString(), daysLeft: 0, isTrial: !!c.is_trial, locked: true };
  }
  return {
    status: c.is_trial ? 'trial' : 'active',
    expiresAt: exp.toISOString(),
    daysLeft: Math.ceil(left / DAY_MS),
    isTrial: !!c.is_trial,
    locked: false,
  };
}

// Thời hạn JWT = nhỏ hơn giữa 7 ngày và thời gian còn lại tới lúc hết hạn gói — để token TỰ HẾT HẠN đúng lúc gói hết,
// nên doanh nghiệp hết hạn không thể tiếp tục đọc/ghi dữ liệu bằng token cũ. Tối thiểu 60 giây (tránh token chết ngay).
export function tokenTtlSeconds(expiresAt: string | null, now: Date = new Date()): number {
  if (!expiresAt) return MAX_TOKEN_SECONDS;
  const left = Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 1000);
  if (isNaN(left)) return 60;
  return Math.max(60, Math.min(MAX_TOKEN_SECONDS, left));
}

// ─── Cộng tháng lịch / gia hạn ────────────────────────────────────────────────────────────────────
// Cộng n THÁNG LỊCH (UTC), kẹp về cuối tháng nếu ngày không tồn tại: 31/01 + 1 tháng = 28 (hoặc 29)/02.
export function addMonths(date: Date, n: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

// Ngày bắt đầu/kết thúc kỳ mới khi xác nhận đơn: tính TIẾP từ hạn hiện tại nếu còn hạn (không mất ngày đã có, kể cả
// ngày dùng thử còn lại); đã hết hạn hoặc không giới hạn thì tính từ BÂY GIỜ.
export function computeRenewal(currentExpiresAt: string | null | undefined, months: number, now: Date = new Date()): { start: Date; end: Date } {
  const cur = currentExpiresAt ? new Date(currentExpiresAt) : null;
  const start = cur && !isNaN(cur.getTime()) && cur.getTime() > now.getTime() ? cur : now;
  return { start, end: addMonths(start, months) };
}

// ─── Đơn đăng ký ──────────────────────────────────────────────────────────────────────────────────
export type Period = 'month' | 'year';
export const PERIOD_MONTHS: Record<Period, number> = { month: 1, year: 12 };

export interface PlanPrices { price_monthly: number; price_yearly: number }

// Số tiền + số tháng của đơn theo kỳ hạn. null nếu kỳ hạn sai hoặc gói chưa có giá cho kỳ đó (giá 0 = chưa đặt giá).
export function orderAmount(plan: PlanPrices, period: string): { months: number; amount: number } | null {
  if (period !== 'month' && period !== 'year') return null;
  const amount = Number(period === 'month' ? plan.price_monthly : plan.price_yearly);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { months: PERIOD_MONTHS[period], amount: Math.round(amount) };
}

// Mã chuyển khoản: LOLO + 8 ký tự in hoa/số, bỏ ký tự dễ nhầm (0/O, 1/I) — ngân hàng thường bỏ dấu gạch nên KHÔNG dùng gạch ngang.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeOrderCode(): string {
  let s = 'LOLO';
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

// ─── Kiểm tra dữ liệu gói (trang quản trị) ───────────────────────────────────────────────────────
// Một dòng mô tả quyền lợi của gói: "included" = được nhận (✓) hoặc không được nhận (✗) — để khách so sánh các gói.
export interface PlanFeature { text: string; included: boolean }
export const MAX_PLAN_FEATURES = 30;

// Chuẩn hóa danh sách quyền lợi từ dữ liệu bất kỳ (client gửi / DB jsonb): bỏ dòng rỗng, cắt dài, tối đa 30 dòng.
export function cleanFeatures(v: unknown): PlanFeature[] {
  if (!Array.isArray(v)) return [];
  const out: PlanFeature[] = [];
  for (const it of v) {
    const text = String((it as any)?.text ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
    if (text) out.push({ text, included: (it as any)?.included !== false });   // mặc định = được nhận
    if (out.length >= MAX_PLAN_FEATURES) break;
  }
  return out;
}

export interface CleanPlan {
  id: string; name: string; description: string; badge: string; features: PlanFeature[];
  price_monthly: number; price_yearly: number;
  max_employees: number | null; active: boolean; sort_order: number;
}
export interface PlanValidation { ok: boolean; data?: CleanPlan; errors?: Record<string, string> }

const intOrNull = (v: unknown): number | null | 'bad' => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : 'bad';
};

export function validatePlan(input: Record<string, unknown>): PlanValidation {
  const errors: Record<string, string> = {};
  const id = String(input.id ?? '').trim().toLowerCase();
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ');
  const description = String(input.description ?? '').trim();
  const badge = String(input.badge ?? '').trim().replace(/\s+/g, ' ');
  const pm = intOrNull(input.priceMonthly);
  const py = intOrNull(input.priceYearly);
  const me = intOrNull(input.maxEmployees);
  const so = intOrNull(input.sortOrder);

  if (!/^[a-z0-9-]{2,40}$/.test(id)) errors.id = 'Mã gói chỉ gồm chữ thường không dấu, số, dấu gạch ngang (2–40 ký tự).';
  if (name.length < 1 || name.length > 60) errors.name = 'Tên gói từ 1 đến 60 ký tự.';
  if (description.length > 300) errors.description = 'Mô tả tối đa 300 ký tự.';
  if (badge.length > 20) errors.badge = 'Nhãn nổi bật tối đa 20 ký tự.';
  if (Array.isArray(input.features) && input.features.length > MAX_PLAN_FEATURES) errors.features = `Tối đa ${MAX_PLAN_FEATURES} dòng quyền lợi.`;
  if (pm === 'bad' || pm === null || pm < 0 || pm > 10_000_000_000) errors.priceMonthly = 'Giá theo tháng phải là số nguyên từ 0 đến 10 tỷ.';
  if (py === 'bad' || py === null || py < 0 || py > 10_000_000_000) errors.priceYearly = 'Giá theo năm phải là số nguyên từ 0 đến 10 tỷ.';
  if (me === 'bad' || (me !== null && (me < 1 || me > 100000))) errors.maxEmployees = 'Số nhân viên tối đa phải là số nguyên từ 1 đến 100000 (để trống = không giới hạn).';
  if (so === 'bad' || (so !== null && Math.abs(so) > 100000)) errors.sortOrder = 'Thứ tự phải là số nguyên.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      id, name, description, badge, features: cleanFeatures(input.features),
      price_monthly: pm as number, price_yearly: py as number,
      max_employees: me as number | null,
      active: input.active === true,
      sort_order: (so as number | null) ?? 0,
    },
  };
}

// ─── Cấu hình dùng thử / ngân hàng ───────────────────────────────────────────────────────────────
export interface TrialSettings { days: number; maxEmployees: number | null }
// bankBin = mã BIN 6 số của ngân hàng (chuẩn VietQR/Napas) — cần để tạo mã QR chuyển khoản; rỗng = chưa cấu hình, không hiện QR.
export interface BankSettings { bankName: string; bankBin: string; accountNumber: string; accountName: string; note: string }

export const DEFAULT_TRIAL: TrialSettings = { days: 7, maxEmployees: null };
export const DEFAULT_BANK: BankSettings = { bankName: '', bankBin: '', accountNumber: '', accountName: '', note: '' };

// Đọc giá trị cấu hình từ DB (jsonb) về dạng an toàn; sai/thiếu thì dùng mặc định.
export function readTrial(v: any): TrialSettings {
  const days = Number(v?.days);
  const me = v?.maxEmployees;
  return {
    days: Number.isInteger(days) && days >= 1 && days <= 365 ? days : DEFAULT_TRIAL.days,
    maxEmployees: Number.isInteger(me) && me >= 1 ? me : null,
  };
}
export function readBank(v: any): BankSettings {
  const s = (x: unknown, max: number) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
  return {
    // Mã BIN: đúng 6 chữ số, KHÔNG tự cắt bớt (7 số là sai, không được tự cắt thành 6 rồi chấp nhận)
    bankName: s(v?.bankName, 80), bankBin: /^\d{6}$/.test(s(v?.bankBin, 20)) ? s(v?.bankBin, 20) : '', accountNumber: s(v?.accountNumber, 40),
    accountName: s(v?.accountName, 80), note: s(v?.note, 300),
  };
}
