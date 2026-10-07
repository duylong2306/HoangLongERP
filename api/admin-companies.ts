// ============================================================================
// Vercel Serverless Function — Quản lý Doanh nghiệp (Giai đoạn 7 multi-tenant).
// ============================================================================
// Bảng `companies` bị khoá hoàn toàn với anon/authenticated (Giai đoạn 3, chỉ
// service_role đọc/ghi được) — vì việc thêm/xem danh sách công ty là thao tác
// "chủ nền tảng" (platform owner), không phải nghiệp vụ trong phạm vi 1 công
// ty như mọi bảng khác. Endpoint này chạy trên server, dùng SERVICE ROLE KEY,
// và TỰ kiểm tra quyền qua JWT gửi lên (Authorization: Bearer <token>):
//   - JWT phải hợp lệ (đúng chữ ký SUPABASE_JWT_SECRET).
//   - company_id trong JWT phải là công ty gốc (Hoàng Long) — công ty này
//     đóng vai "chủ nền tảng", chỉ admin của công ty này được quản lý danh
//     sách công ty khác. Quyết định phạm vi này đã được xác nhận với chủ dự
//     án khi lên kế hoạch Giai đoạn 7 (không mở cho admin của MỌI công ty).
//   - Nhân viên đó phải nằm trong nhóm role_admin (tra bảng employees +
//     hrm_role_groups bằng service role, không tin roleGroupIds client gửi
//     lên vì có thể bị giả mạo).
//
// KHÔNG import từ src/ (xem giải thích tương tự ở api/login.ts).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { createCompanyWithAdmin } from './_company.js'; // ⚠️ bắt buộc đuôi .js (Node ESM — xem api/login.ts)
import { slugProblem, SLUG_MESSAGES } from './_signup.js'; // ⚠️ bắt buộc đuôi .js (Node ESM — xem api/login.ts)

// Công ty gốc (seed ở migration 20260928_multi_tenant_company_id.sql) — đóng
// vai "chủ nền tảng" duy nhất được quản lý danh sách công ty.
const PLATFORM_OWNER_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

async function verifyPlatformAdmin(req: VercelRequest, supabaseUrl: string, serviceRoleKey: string, jwtSecret: string) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return { ok: false as const, status: 401, error: 'Thiếu token xác thực.' };

  let payload: any;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch {
    return { ok: false as const, status: 401, error: 'Token không hợp lệ hoặc đã hết hạn.' };
  }

  if (payload.company_id !== PLATFORM_OWNER_COMPANY_ID) {
    return { ok: false as const, status: 403, error: 'Chỉ quản trị viên của công ty chủ nền tảng mới truy cập được chức năng này.' };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('id, role_group_ids')
    .eq('id', payload.sub)
    .eq('company_id', PLATFORM_OWNER_COMPANY_ID)
    .maybeSingle();

  if (empErr || !emp) {
    return { ok: false as const, status: 403, error: 'Không xác định được tài khoản.' };
  }

  // Chỉ kiểm tra id nhóm cố định trên chính employees.role_group_ids — KHÔNG
  // replicate logic "nhóm tuỳ chỉnh gán loại = admin" của isRoleAdmin() phía
  // client (src/context/SettingsContext.tsx, đọc marker trong permissions
  // jsonb của hrm_role_groups) vì đó là quy ước UI-side, rủi ro lệch/vỡ nếu
  // đổi ở 1 chỗ mà quên chỗ kia. Tài khoản admin thật (bootstrap ADMIN_EMPLOYEE)
  // luôn có 'role_admin' trực tiếp trong role_group_ids nên vẫn qua được.
  const roleGroupIds: string[] = emp.role_group_ids || [];
  const isAdmin = roleGroupIds.includes('role_admin') || roleGroupIds.includes('role_superadmin');

  if (!isAdmin) {
    return { ok: false as const, status: 403, error: 'Chỉ quản trị viên (role_admin) mới quản lý được danh sách công ty.' };
  }

  return { ok: true as const, supabase };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;

  if (!supabaseUrl || !serviceRoleKey || !jwtSecret) {
    console.error('[api/admin-companies] Thiếu biến môi trường server.');
    res.status(500).json({ error: 'Server chưa được cấu hình đầy đủ.' });
    return;
  }

  const auth = await verifyPlatformAdmin(req, supabaseUrl, serviceRoleKey, jwtSecret);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }
  const supabase = auth.supabase;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('companies')
      .select('id, slug, name, active, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ companies: data || [] });
    return;
  }

  if (req.method === 'POST') {
    const { slug, name, adminUsername, adminPassword } = (req.body || {}) as {
      slug?: string; name?: string; adminUsername?: string; adminPassword?: string;
    };

    const cleanSlug = (slug || '').trim().toLowerCase();
    const cleanName = (name || '').trim();
    const cleanAdminUsername = (adminUsername || '').trim().toLowerCase();
    const cleanAdminPassword = (adminPassword || '').trim();

    // Mã công ty giờ là SUBDOMAIN (<mã>.<tên-miền>) nên áp đúng quy tắc của đăng ký công khai: định dạng nhãn DNS
    // (không bắt đầu/kết thúc bằng gạch ngang) và không trùng tên dành cho hệ thống (www, api, admin...).
    const slugErr = slugProblem(cleanSlug);
    if (slugErr) {
      res.status(400).json({ error: SLUG_MESSAGES[slugErr] });
      return;
    }
    if (!cleanName) {
      res.status(400).json({ error: 'Thiếu tên công ty.' });
      return;
    }
    if (!cleanAdminUsername || cleanAdminPassword.length < 4) {
      res.status(400).json({ error: 'Thiếu tài khoản quản trị hoặc mật khẩu quá ngắn (tối thiểu 4 ký tự).' });
      return;
    }

    // Tạo công ty + tài khoản quản trị: dùng chung với đăng ký công khai (api/_company.ts) để 2 luồng
    // luôn giống hệt nhau (kể cả quy ước admin id 'emp_admin' và dọn dẹp khi lỗi giữa chừng).
    const created = await createCompanyWithAdmin(supabase, {
      slug: cleanSlug, name: cleanName, adminUsername: cleanAdminUsername, adminPassword: cleanAdminPassword,
    });
    if (!created.ok) {
      res.status(created.status).json({ error: created.error });
      return;
    }
    res.status(201).json({ company: created.company });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
