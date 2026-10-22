// ============================================================================
// Vercel Serverless Function — QUẢN TRỊ VIÊN ĐẶT LẠI MẬT KHẨU CHO NHÂN VIÊN.
// ============================================================================
// Mật khẩu được băm (bcrypt) và cột password không đọc được từ trình duyệt → việc đặt lại PHẢI chạy ở máy chủ bằng service_role.
// Quy tắc an toàn:
//   • Chỉ người gọi là quản trị viên của CÙNG công ty (nhóm role_admin / role_superadmin hoặc admin gốc emp_admin) và token còn đúng phiên bản.
//   • Không đặt lại cho chính mình (đổi mật khẩu của mình phải qua api/change-password có hỏi mật khẩu cũ) và không đặt lại cho admin gốc emp_admin.
//   • Máy chủ TỰ SINH mật khẩu tạm ngẫu nhiên, chỉ trả về MỘT LẦN cho quản trị viên; không lưu dạng rõ ở bất cứ đâu.
//   • Người bị đặt lại bị đăng xuất mọi máy (tăng token_version) và BẮT PHẢI đổi mật khẩu ở lần đăng nhập kế tiếp; khóa đăng nhập tạm (nếu có) được gỡ.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomInt } from 'node:crypto';
import { loadSecurity, revokeAndForceChange, generateTempPassword } from './_security.js'; // ⚠️ bắt buộc đuôi .js (Node ESM)

const fail = (res: VercelResponse, status: number, error: string) => { res.status(status).json({ error }); };
const isAdminEmp = (emp: any) => {
  const groups: string[] = Array.isArray(emp?.role_group_ids) ? emp.role_group_ids : [];
  return emp?.id === 'emp_admin' || groups.includes('role_admin') || groups.includes('role_superadmin');   // cùng quy ước admin với ERP
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');
  const supabaseUrl = process.env.VITE_SUPABASE_URL, serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY, jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!supabaseUrl || !serviceRoleKey || !jwtSecret) return fail(res, 500, 'Server chưa được cấu hình đầy đủ. Liên hệ quản trị viên.');

  // 1. Token công ty hợp lệ (token khóa/hết hạn gói hoặc token quản trị nền tảng không có company_id + role authenticated → bị từ chối)
  const auth = String(req.headers?.authorization || '');
  const raw = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  let claims: any;
  try { claims = jwt.verify(raw, jwtSecret, { algorithms: ['HS256'] }); } catch { claims = null; }
  if (!claims || claims.role !== 'authenticated' || !claims.sub || !claims.company_id) return fail(res, 401, 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');

  const employeeId = String((req.body || {}).employeeId || '').trim();
  if (!employeeId) return fail(res, 400, 'Thiếu nhân viên cần đặt lại mật khẩu.');

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // 2. Người gọi: còn tồn tại, còn tài khoản, đúng phiên bản token, là quản trị viên
  const { data: caller, error: cErr } = await supabase.from('employees').select('id, role_group_ids, has_system_account, status')
    .eq('company_id', claims.company_id).eq('id', claims.sub).maybeSingle();
  if (cErr) return fail(res, 500, 'Lỗi hệ thống, vui lòng thử lại.');
  if (!caller || caller.has_system_account === false || caller.status === 'retired') return fail(res, 403, 'Tài khoản không còn hiệu lực.');
  const callerSec = await loadSecurity(supabase, claims.company_id, caller.id);
  if (callerSec.available && (callerSec.row?.token_version || 0) !== (Number(claims.tv) || 0)) return fail(res, 401, 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.');
  if (!isAdminEmp(caller)) return fail(res, 403, 'Chỉ quản trị viên mới được đặt lại mật khẩu.');

  // 3. Người bị đặt lại
  if (employeeId === caller.id) return fail(res, 400, 'Không đặt lại mật khẩu của chính mình ở đây. Hãy dùng "Đổi mật khẩu" trong hồ sơ cá nhân.');
  if (employeeId === 'emp_admin') return fail(res, 403, 'Không thể đặt lại mật khẩu của tài khoản quản trị gốc.');
  const { data: target, error: tErr } = await supabase.from('employees').select('id, name, has_system_account, status')
    .eq('company_id', claims.company_id).eq('id', employeeId).maybeSingle();
  if (tErr) return fail(res, 500, 'Lỗi hệ thống, vui lòng thử lại.');
  if (!target || target.has_system_account === false || target.status === 'retired') return fail(res, 404, 'Không tìm thấy tài khoản của nhân viên này.');

  // 4. Sinh mật khẩu tạm, băm, ghi; thu hồi phiên + bắt đổi mật khẩu
  const tempPassword = generateTempPassword(randomInt);
  const hash = await bcrypt.hash(tempPassword, 10);
  const { error: upErr } = await supabase.from('employees').update({ password: hash }).eq('company_id', claims.company_id).eq('id', target.id);
  if (upErr) return fail(res, 500, 'Không lưu được mật khẩu mới, vui lòng thử lại.');
  const targetSec = await loadSecurity(supabase, claims.company_id, target.id);
  const forced = await revokeAndForceChange(supabase, claims.company_id, target.id, targetSec);
  console.info(`[reset-password] ${caller.id} đã đặt lại mật khẩu cho ${target.id} (công ty ${claims.company_id})`);   // chỉ ghi mã người, KHÔNG ghi mật khẩu

  res.setHeader?.('Cache-Control', 'no-store');
  res.status(200).json({ ok: true, tempPassword, forced, employeeName: target.name });
}
