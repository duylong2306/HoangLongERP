// ============================================================================
// Vercel Serverless Function — NHÂN VIÊN TỰ ĐỔI MẬT KHẨU (Giai đoạn A bảo mật tài khoản).
// ============================================================================
// Trước đây giao diện tự băm mật khẩu mới rồi ghi thẳng vào bảng employees từ trình duyệt, KHÔNG hỏi mật khẩu cũ → ai mượn được máy
// đang đăng nhập là đổi được mật khẩu. Nay: bắt buộc nhập mật khẩu hiện tại, kiểm tra ở máy chủ (bcrypt), ghi hash bằng service_role,
// bỏ cờ "bắt đổi mật khẩu", TĂNG token_version (mọi token cũ ở máy khác bị chặn ngay) và trả token MỚI cho máy đang đổi.
// Chỉ nhận token công ty hợp lệ (do api/login.ts ký); token khóa (hết hạn gói) hoặc token quản trị nền tảng bị từ chối.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getSubscriptionState, tokenTtlSeconds } from './_subscription.js'; // ⚠️ bắt buộc đuôi .js (Node ESM)
import { loadSecurity, bumpTokenVersion, validateNewPassword } from './_security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!supabaseUrl || !serviceRoleKey || !jwtSecret) {
    res.status(500).json({ error: 'Server chưa được cấu hình đầy đủ. Liên hệ quản trị viên.' });
    return;
  }

  // 1. Xác thực token công ty (Bearer). Phải có sub + company_id và role 'authenticated'.
  const auth = String(req.headers?.authorization || '');
  const raw = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  let claims: any;
  try { claims = jwt.verify(raw, jwtSecret, { algorithms: ['HS256'] }); } catch { claims = null; }
  if (!claims || claims.role !== 'authenticated' || !claims.sub || !claims.company_id) {
    res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.' });
    return;
  }

  const { oldPassword, newPassword } = (req.body || {}) as { oldPassword?: string; newPassword?: string };
  if (!oldPassword || !newPassword) { res.status(400).json({ error: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.' }); return; }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // 2. Nhân viên phải còn tồn tại, còn tài khoản, chưa nghỉ việc (cùng điều kiện với đăng nhập).
  const { data: emp, error: empErr } = await supabase
    .from('employees').select('id, username, password, has_system_account, status')
    .eq('company_id', claims.company_id).eq('id', claims.sub).maybeSingle();
  if (empErr) { res.status(500).json({ error: 'Lỗi hệ thống, vui lòng thử lại.' }); return; }
  if (!emp || emp.has_system_account === false || emp.status === 'retired') {
    res.status(403).json({ error: 'Tài khoản không còn hiệu lực.' });
    return;
  }

  // 3. Token phải còn đúng phiên bản (đã đổi mật khẩu/thu hồi ở nơi khác thì token này cũ rồi).
  const security = await loadSecurity(supabase, claims.company_id, emp.id);
  if (security.available && (security.row?.token_version || 0) !== (Number(claims.tv) || 0)) {
    res.status(401).json({ error: 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.' });
    return;
  }

  // 4. Mật khẩu hiện tại phải đúng (cùng cách so với đăng nhập; hồ sơ rỗng không đổi được qua đây).
  const stored: string = emp.password || '';
  const okOld = !!stored && (stored.startsWith('$2') ? await bcrypt.compare(oldPassword, stored) : oldPassword === stored);
  if (!okOld) { res.status(401).json({ error: 'Mật khẩu hiện tại không đúng.' }); return; }

  // 5. Quy tắc mật khẩu mới.
  const bad = validateNewPassword(newPassword, oldPassword, emp.username);
  if (bad) { res.status(400).json({ error: bad }); return; }

  // 6. Ghi hash mới (bcrypt, 10 vòng như phần còn lại của ứng dụng).
  const hash = await bcrypt.hash(newPassword, 10);
  const { error: upErr } = await supabase.from('employees').update({ password: hash }).eq('company_id', claims.company_id).eq('id', emp.id);
  if (upErr) { res.status(500).json({ error: 'Không lưu được mật khẩu mới, vui lòng thử lại.' }); return; }

  // 7. Tăng token_version (thu hồi mọi token cũ) + cấp token mới cùng thời hạn theo gói của công ty.
  const tv = await bumpTokenVersion(supabase, claims.company_id, emp.id, security);
  let company: any = null;
  {
    const r = await supabase.from('companies').select('expires_at, is_trial').eq('id', claims.company_id).maybeSingle();
    company = r.error ? {} : r.data || {};
  }
  const sub = getSubscriptionState(company);
  if (sub.locked) { res.status(403).json({ error: 'Gói dịch vụ đã hết hạn.' }); return; }
  const token = jwt.sign(
    { sub: emp.id, role: 'authenticated', company_id: claims.company_id, tv },
    jwtSecret,
    { expiresIn: tokenTtlSeconds(sub.expiresAt) }
  );
  res.status(200).json({ ok: true, token });
}
