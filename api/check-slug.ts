// ============================================================================
// Vercel Serverless Function — Kiểm tra địa chỉ (subdomain) doanh nghiệp còn trống không (Giai đoạn 2).
// ============================================================================
// Form đăng ký gọi endpoint này khi người dùng gõ địa chỉ mong muốn, để báo ngay "dùng được / đã có người
// dùng / dành cho hệ thống / sai định dạng" trước khi bấm Đăng ký. Công khai (chưa đăng nhập).
// CHỈ trả available + lý do — không trả thông tin gì về công ty đã có (khác api/tenant-info.ts).
// Chỉ chạy ở địa chỉ gốc hoặc địa chỉ "other" (vercel.app/localhost); từ subdomain doanh nghiệp thì từ chối.
//
// KHÔNG import từ src/ (xem giải thích ở api/login.ts).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveHost, getRequestHostname, getServerBaseDomains } from './_tenant.js'; // ⚠️ bắt buộc đuôi .js (Node ESM — xem api/login.ts)
import { slugProblem, SLUG_MESSAGES } from './_signup.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');

  if (resolveHost(getRequestHostname(req), getServerBaseDomains()).kind === 'tenant') {
    res.status(403).json({ error: 'Không khả dụng tại địa chỉ doanh nghiệp.' });
    return;
  }

  const slug = String(req.query.slug || '').trim().toLowerCase();
  const problem = slugProblem(slug);
  if (problem) {
    res.status(200).json({ available: false, reason: problem, message: SLUG_MESSAGES[problem] });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[api/check-slug] Thiếu biến môi trường server (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
    res.status(500).json({ error: 'Server chưa được cấu hình đầy đủ. Liên hệ quản trị viên.' });
    return;
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.from('companies').select('id').eq('slug', slug).maybeSingle();
  if (error) {
    console.error('[api/check-slug] Lỗi tra công ty:', error.message);
    res.status(500).json({ error: 'Lỗi hệ thống, vui lòng thử lại.' });
    return;
  }
  if (data) {
    res.status(200).json({ available: false, reason: 'taken', message: SLUG_MESSAGES.taken });
    return;
  }
  res.status(200).json({ available: true });
}
