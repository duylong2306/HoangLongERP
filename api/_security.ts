// Bảo mật theo từng nhân viên (Giai đoạn A): khóa đăng nhập tạm khi nhập sai nhiều lần, cờ bắt đổi mật khẩu, phiên bản token.
// Dữ liệu nằm trong bảng employee_security (migration 20261021a) — CHỈ service_role truy cập được.
// An toàn khi triển khai lệch thứ tự: nếu bảng CHƯA tồn tại (chưa chạy SQL) thì mọi hàm ở đây coi như "không có tính năng"
// (không khóa, token_version = 0) — đăng nhập vẫn hoạt động như trước, không bị hỏng.
import type { SupabaseClient } from '@supabase/supabase-js';

export const MAX_FAILED_ATTEMPTS = 5;   // sai quá số lần này → khóa tạm
export const LOCK_MINUTES = 15;         // thời gian khóa tạm
export const DEFAULT_PASSWORD = '123';  // mật khẩu mặc định cũ — nhắc/bắt đổi

export interface SecurityRow {
  failed_attempts: number;
  locked_until: string | null;
  must_change_password: boolean;
  last_login_at: string | null;
  token_version: number;
}
export interface SecurityState {
  available: boolean;       // false = bảng chưa có (chưa chạy SQL) → bỏ qua toàn bộ tính năng
  row: SecurityRow | null;  // null = chưa có dòng (mặc định: 0 lần sai, không khóa, token_version 0)
}

// Lỗi "bảng không tồn tại" của Postgres/PostgREST.
const isMissingTable = (e: any) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(String(e.message || '')));

export async function loadSecurity(sb: SupabaseClient, companyId: string, employeeId: string): Promise<SecurityState> {
  const { data, error } = await sb
    .from('employee_security')
    .select('failed_attempts, locked_until, must_change_password, last_login_at, token_version')
    .eq('company_id', companyId)
    .eq('employee_id', employeeId)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return { available: false, row: null };
    // Lỗi khác: không chặn đăng nhập vì lỗi phụ, nhưng coi như không khả dụng cho lần này.
    console.error('[security] Lỗi đọc employee_security:', error.message);
    return { available: false, row: null };
  }
  return { available: true, row: (data as SecurityRow) || null };
}

// Số phút còn bị khóa (làm tròn lên); 0 nếu không bị khóa.
export function lockMinutesLeft(row: SecurityRow | null, now = Date.now()): number {
  if (!row?.locked_until) return 0;
  const left = new Date(row.locked_until).getTime() - now;
  return left > 0 ? Math.ceil(left / 60000) : 0;
}

async function upsertSecurity(sb: SupabaseClient, companyId: string, employeeId: string, patch: Record<string, any>) {
  const { error } = await sb
    .from('employee_security')
    .upsert({ company_id: companyId, employee_id: employeeId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'company_id,employee_id' });
  if (error && !isMissingTable(error)) console.error('[security] Lỗi ghi employee_security:', error.message);
}

// Ghi nhận 1 lần nhập SAI mật khẩu. Trả về số phút bị khóa nếu lần này vừa chạm ngưỡng (0 = chưa khóa).
export async function recordFailure(sb: SupabaseClient, companyId: string, employeeId: string, state: SecurityState): Promise<number> {
  if (!state.available) return 0;
  const failed = (state.row?.failed_attempts || 0) + 1;
  if (failed >= MAX_FAILED_ATTEMPTS) {
    await upsertSecurity(sb, companyId, employeeId, {
      failed_attempts: 0,
      locked_until: new Date(Date.now() + LOCK_MINUTES * 60000).toISOString(),
    });
    return LOCK_MINUTES;
  }
  await upsertSecurity(sb, companyId, employeeId, { failed_attempts: failed });
  return 0;
}

// Đăng nhập thành công: xóa bộ đếm sai, mở khóa, ghi thời điểm đăng nhập.
export async function recordSuccess(sb: SupabaseClient, companyId: string, employeeId: string, state: SecurityState) {
  if (!state.available) return;
  await upsertSecurity(sb, companyId, employeeId, { failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() });
}

// Đổi mật khẩu xong: bỏ cờ bắt đổi, tăng token_version (mọi token cũ — kể cả trên máy khác — bị RLS chặn ngay). Trả token_version mới.
export async function bumpTokenVersion(sb: SupabaseClient, companyId: string, employeeId: string, state: SecurityState): Promise<number> {
  if (!state.available) return 0;
  const tv = (state.row?.token_version || 0) + 1;
  await upsertSecurity(sb, companyId, employeeId, { token_version: tv, must_change_password: false, failed_attempts: 0, locked_until: null });
  return tv;
}

// Quy tắc mật khẩu mới. Trả về thông báo lỗi (tiếng Việt) hoặc null nếu hợp lệ.
export const MIN_PASSWORD_LENGTH = 6;
export function validateNewPassword(newPassword: string, oldPassword: string, username?: string | null): string | null {
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) return `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
  if (newPassword === DEFAULT_PASSWORD) return 'Không được dùng mật khẩu mặc định.';
  if (newPassword === oldPassword) return 'Mật khẩu mới phải khác mật khẩu hiện tại.';
  if (username && newPassword.toLowerCase() === String(username).toLowerCase()) return 'Mật khẩu mới không được trùng tên đăng nhập.';
  return null;
}

// Quản trị viên ĐẶT LẠI mật khẩu cho nhân viên: tăng token_version (đăng xuất mọi máy của người đó), BẬT cờ bắt đổi mật khẩu ở lần
// đăng nhập kế tiếp, xóa khóa tạm. Trả false nếu bảng employee_security chưa có (khi đó mật khẩu vẫn đổi được nhưng không ép đổi/không thu hồi phiên).
export async function revokeAndForceChange(sb: SupabaseClient, companyId: string, employeeId: string, state: SecurityState): Promise<boolean> {
  if (!state.available) return false;
  await upsertSecurity(sb, companyId, employeeId, { token_version: (state.row?.token_version || 0) + 1, must_change_password: true, failed_attempts: 0, locked_until: null });
  return true;
}

// Mật khẩu tạm ngẫu nhiên (không dùng ký tự dễ nhầm 0/O/1/l/I): 10 ký tự gồm chữ hoa, chữ thường, số.
export function generateTempPassword(randomInt: (max: number) => number): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789'];
  const all = sets.join('');
  const out = sets.map(set => set[randomInt(set.length)]);           // mỗi loại ít nhất 1 ký tự
  while (out.length < 10) out.push(all[randomInt(all.length)]);
  for (let i = out.length - 1; i > 0; i--) { const j = randomInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join('');
}
