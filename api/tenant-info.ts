// ============================================================================
// Vercel Serverless Function — Thông tin CÔNG KHAI của doanh nghiệp theo tên miền (Giai đoạn 1 subdomain).
// ============================================================================
// Trang đăng nhập gọi endpoint này (chưa đăng nhập) để biết: địa chỉ đang truy cập là doanh nghiệp nào,
// doanh nghiệp đó CÓ TỒN TẠI/đang hoạt động không, tên hiển thị là gì — từ đó hiện "Đăng nhập — <tên>"
// hoặc "Doanh nghiệp không tồn tại" thay vì để người dùng nhập mã công ty.
//
// Bảng `companies` bị khoá với anon (chỉ service_role đọc được — xem api/admin-companies.ts) nên phải đi qua
// server. CHỈ trả đúng những gì cần cho trang đăng nhập: kind, slug, exists, name. KHÔNG trả id công ty,
// ngày tạo hay bất kỳ thông tin nội bộ nào.
//
// Quy tắc xác định công ty (giống api/login.ts): địa chỉ là subdomain thật → theo tên miền; địa chỉ khác
// (vercel.app, localhost...) → theo tham số ?slug= (người dùng nhập "Mã công ty").
//
// KHÔNG import từ src/ (xem giải thích ở api/login.ts).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveHost, getRequestHostname, getServerBaseDomains, SLUG_PATTERN } from './_tenant';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  // Thông tin này gần như không đổi nhưng phải phản ánh ngay khi tạo/ngừng công ty → không cache dài.
  res.setHeader('Cache-Control', 'no-store');

  const hostInfo = resolveHost(getRequestHostname(req), getServerBaseDomains());
  if (hostInfo.kind === 'root') {
    res.status(200).json({ kind: 'root' });
    return;
  }

  const slug = hostInfo.kind === 'tenant'
    ? hostInfo.slug
    : String(req.query.slug || '').trim().toLowerCase();

  // Mã không đúng dạng thì chắc chắn không tồn tại — khỏi tốn 1 lượt truy vấn DB.
  // (Công ty cũ có thể có mã ngắn/dài ngoài chuẩn subdomain → ở chế độ "other" chỉ kiểm tra dạng cơ bản.)
  const dangHopLe = hostInfo.kind === 'tenant' ? SLUG_PATTERN.test(slug) : /^[a-z0-9-]{2,40}$/.test(slug);
  if (!slug || !dangHopLe) {
    res.status(200).json({ kind: hostInfo.kind, slug, exists: false });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[api/tenant-info] Thiếu biến môi trường server (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
    res.status(500).json({ error: 'Server chưa được cấu hình đầy đủ. Liên hệ quản trị viên.' });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: company, error } = await supabase
    .from('companies')
    .select('name, slug, active')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('[api/tenant-info] Lỗi tra công ty:', error.message);
    res.status(500).json({ error: 'Lỗi hệ thống, vui lòng thử lại.' });
    return;
  }
  if (!company || !company.active) {
    res.status(200).json({ kind: hostInfo.kind, slug, exists: false });
    return;
  }
  res.status(200).json({ kind: hostInfo.kind, slug: company.slug, exists: true, name: company.name });
}
