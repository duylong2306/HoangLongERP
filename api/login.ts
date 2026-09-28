// ============================================================================
// Vercel Serverless Function — đăng nhập multi-tenant, ký JWT chứa company_id.
// ============================================================================
// Vì auth hiện tại KHÔNG dùng Supabase Auth (tự xác thực qua bảng `employees`
// + bcrypt), RLS không có cách nào biết "request này của công ty nào" nếu chỉ
// dựa vào code phía trình duyệt — ai cũng dùng chung 1 anon key, dễ giả mạo.
// Endpoint này chạy TRÊN SERVER (Vercel Node runtime), dùng SERVICE ROLE KEY
// (không bao giờ lộ ra trình duyệt) để:
//   1. Tra đúng công ty theo subdomain.
//   2. Tra đúng nhân viên theo company_id + username (bcrypt so khớp mật khẩu
//      NGAY TẠI SERVER — không còn gửi password hash về trình duyệt như luồng
//      cũ ở Login.tsx, vá luôn lỗ hổng đó).
//   3. Ký 1 JWT (HS256, cùng thuật toán/secret Supabase dùng cho JWT hợp lệ)
//      chứa claim company_id — RLS ở Giai đoạn 3 sẽ đọc claim này qua
//      auth.jwt() ->> 'company_id' để chặn truy vấn chéo công ty.
//
// KHÔNG import bất kỳ module nào từ src/ — code trong src/ có thể phụ thuộc
// window/localStorage (chỉ chạy được trên trình duyệt), trong khi file này
// chạy trên server (Node), tách biệt hoàn toàn khỏi bundle Vite.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Chuyển 1 object snake_case (row thô từ Postgres) sang camelCase — bản rút
// gọn, tự chứa trong file này (KHÔNG import từ dbService.ts, xem lý do ở trên).
function rowToCamel<T = any>(row: Record<string, any>): T {
  const out: Record<string, any> = {};
  for (const key of Object.keys(row)) {
    const camelKey = key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
    out[camelKey] = row[key];
  }
  return out as T;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { username, password, subdomain } = (req.body || {}) as {
    username?: string;
    password?: string;
    subdomain?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: 'Thiếu tài khoản hoặc mật khẩu' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;

  if (!supabaseUrl || !serviceRoleKey || !jwtSecret) {
    console.error('[api/login] Thiếu biến môi trường server (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_JWT_SECRET)');
    res.status(500).json({ error: 'Server chưa được cấu hình đầy đủ. Liên hệ quản trị viên.' });
    return;
  }

  // service_role key — chỉ dùng ở server, bỏ qua RLS để tra cứu company_id/
  // employee ĐÚNG (RLS ở Giai đoạn 3 chỉ áp dụng cho request từ trình duyệt
  // dùng anon/authenticated key, không áp dụng cho service_role).
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // 1. Xác định công ty theo subdomain. Chưa có domain riêng (Giai đoạn 7) nên
  //    mặc định về công ty gốc 'hoanglong' khi không truyền/không khớp subdomain.
  const slug = (subdomain || 'hoanglong').trim().toLowerCase();
  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .select('id, name, slug, active')
    .eq('slug', slug)
    .maybeSingle();

  if (companyErr) {
    console.error('[api/login] Lỗi tra công ty:', companyErr.message);
    res.status(500).json({ error: 'Lỗi hệ thống, vui lòng thử lại.' });
    return;
  }
  if (!company || !company.active) {
    res.status(404).json({ error: 'Không tìm thấy doanh nghiệp hoặc doanh nghiệp đã ngừng hoạt động.' });
    return;
  }

  // 2. Tra nhân viên ĐÚNG công ty này theo username (không phân biệt hoa/thường).
  const cleanUsername = username.trim().toLowerCase();
  const { data: rows, error: empErr } = await supabase
    .from('employees')
    .select('*')
    .eq('company_id', company.id)
    .ilike('username', cleanUsername);

  if (empErr) {
    console.error('[api/login] Lỗi tra nhân viên:', empErr.message);
    res.status(500).json({ error: 'Lỗi hệ thống, vui lòng thử lại.' });
    return;
  }

  const employeeRow = (rows || [])[0];
  if (!employeeRow) {
    res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không đúng!' });
    return;
  }

  // 3. So khớp mật khẩu NGAY TẠI SERVER (bcrypt, có fallback so sánh chuỗi
  //    thường cho dữ liệu cũ chưa hash — giữ đúng hành vi verifyPasswordSync
  //    đã dùng ở Login.tsx trước đây, chỉ chuyển vị trí chạy sang server).
  const storedPassword: string = employeeRow.password || '123';
  const passwordOk = storedPassword.startsWith('$2')
    ? await bcrypt.compare(password, storedPassword)
    : password === storedPassword;

  if (!passwordOk) {
    res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không đúng!' });
    return;
  }

  // 4. Ký JWT chứa company_id — thời hạn 7 ngày (khớp thói quen "Tự động đăng
  //    nhập" hiện có, giữ phiên lâu dài trên thiết bị cá nhân).
  const token = jwt.sign(
    {
      sub: employeeRow.id,
      role: 'authenticated',
      company_id: company.id,
    },
    jwtSecret,
    { expiresIn: '7d' }
  );

  // 5. Trả về nhân viên (camelCase, ĐÃ loại bỏ password) + JWT cho client.
  const { password: _pw, ...safeRow } = employeeRow;
  const employee = rowToCamel(safeRow);

  res.status(200).json({
    token,
    employee,
    company: { id: company.id, name: company.name, slug: company.slug },
  });
}
