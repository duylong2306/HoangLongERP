// ============================================================================
// Vercel Serverless Function — ĐĂNG KÝ DOANH NGHIỆP công khai (Giai đoạn 2 — website kiểu KiotViet).
// ============================================================================
// Khách tự đăng ký: nhập tên doanh nghiệp + địa chỉ (subdomain) + thông tin người quản trị → hệ thống tạo
// công ty + tài khoản quản trị (tên đăng nhập 'admin') và trả về địa chỉ riêng <slug>.<tên-miền-gốc>.
//
// Vì là endpoint CÔNG KHAI tạo dữ liệu nên có nhiều lớp chống lạm dụng (theo thứ tự chạy):
//   1) Chỉ nhận từ địa chỉ gốc / địa chỉ "other" — không nhận từ subdomain doanh nghiệp.
//   2) Honeypot: trường ẩn `website` phải rỗng (bot tự điền → từ chối).
//   3) Kiểm tra dữ liệu (api/_signup.ts) — tên địa chỉ cấm/sai định dạng bị chặn.
//   4) CAPTCHA Cloudflare Turnstile — BẮT BUỘC khi đã đặt TURNSTILE_SECRET_KEY (chưa đặt thì bỏ qua, chỉ để chạy
//      thử trên staging; production phải đặt).
//   5) Giới hạn số lượt theo IP (băm, bảng signup_attempts): tối đa 3/giờ, 10/ngày.
//   6) Kiểm tra trùng địa chỉ + tạo công ty dùng chung với màn quản trị (api/_company.ts).
//
// Bảng signup_attempts chưa tạo → trả lỗi cấu hình (từ chối, KHÔNG bỏ qua giới hạn): xem migration
// 20261010_signup_attempts.sql.
//
// KHÔNG import từ src/ (xem giải thích ở api/login.ts).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveHost, getRequestHostname, getServerBaseDomains } from './_tenant.js'; // ⚠️ bắt buộc đuôi .js (Node ESM — xem api/login.ts)
import { validateSignup, getClientIp, hashIp, SLUG_MESSAGES, SIGNUP_LIMIT_PER_HOUR, SIGNUP_LIMIT_PER_DAY } from './_signup.js';
import { createCompanyWithAdmin } from './_company.js';
import { readTrial, DAY_MS } from './_subscription.js';

// Tên đăng nhập quản trị mặc định của mọi công ty mới (mỗi công ty có không gian tên riêng nên không đụng nhau).
const ADMIN_USERNAME = 'admin';

async function verifyTurnstile(secret: string, token: string, ip: string): Promise<boolean> {
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, ...(ip !== 'unknown' ? { remoteip: ip } : {}) }).toString(),
    });
    const body: any = await r.json();
    return body?.success === true;
  } catch (e) {
    console.error('[api/register-company] Không gọi được Turnstile:', e);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');

  // 1) Không đăng ký từ trong 1 doanh nghiệp
  const hostInfo = resolveHost(getRequestHostname(req), getServerBaseDomains());
  if (hostInfo.kind === 'tenant') {
    res.status(403).json({ error: 'Không khả dụng tại địa chỉ doanh nghiệp.' });
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;

  // 2) Honeypot — người thật không thấy ô này nên không bao giờ điền
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    res.status(400).json({ error: 'Yêu cầu không hợp lệ.' });
    return;
  }

  // 3) Dữ liệu
  const v = validateSignup(body);
  if (!v.ok) {
    res.status(400).json({ error: 'Thông tin chưa hợp lệ.', errors: v.errors });
    return;
  }
  const data = v.data!;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[api/register-company] Thiếu biến môi trường server (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
    res.status(500).json({ error: 'Server chưa được cấu hình đầy đủ. Liên hệ quản trị viên.' });
    return;
  }

  const ip = getClientIp(req);

  // 4) CAPTCHA (nếu đã cấu hình)
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    const token = typeof body.captchaToken === 'string' ? body.captchaToken : '';
    if (!token || !(await verifyTurnstile(turnstileSecret, token, ip))) {
      res.status(400).json({ error: 'Xác minh CAPTCHA không thành công. Vui lòng thử lại.' });
      return;
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // 5) Giới hạn số lượt theo IP. Muối lấy từ SUPABASE_JWT_SECRET (đã là bí mật phía server) để không phải thêm biến mới.
  const ipHash = hashIp(ip, process.env.SUPABASE_JWT_SECRET || 'signup');
  const now = Date.now();
  const sinceHour = new Date(now - 60 * 60 * 1000).toISOString();
  const sinceDay = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const [hourRes, dayRes] = await Promise.all([
    supabase.from('signup_attempts').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', sinceHour),
    supabase.from('signup_attempts').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', sinceDay),
  ]);
  if (hourRes.error || dayRes.error) {
    console.error('[api/register-company] Lỗi bảng signup_attempts (đã chạy migration 20261010_signup_attempts.sql chưa?):', (hourRes.error || dayRes.error)?.message);
    res.status(500).json({ error: 'Hệ thống đăng ký chưa sẵn sàng. Vui lòng thử lại sau.' });
    return;
  }
  if ((hourRes.count || 0) >= SIGNUP_LIMIT_PER_HOUR || (dayRes.count || 0) >= SIGNUP_LIMIT_PER_DAY) {
    res.status(429).json({ error: 'Bạn đã đăng ký quá nhiều lần. Vui lòng thử lại sau.' });
    return;
  }
  // Ghi nhận lượt NGAY (trước khi tạo) để 2 yêu cầu song song cũng bị đếm; thất bại thì từ chối luôn (không bỏ qua giới hạn).
  const { error: attemptErr } = await supabase.from('signup_attempts').insert({ ip_hash: ipHash });
  if (attemptErr) {
    console.error('[api/register-company] Không ghi được signup_attempts:', attemptErr.message);
    res.status(500).json({ error: 'Hệ thống đăng ký chưa sẵn sàng. Vui lòng thử lại sau.' });
    return;
  }

  // 6) Tạo công ty + tài khoản quản trị. Doanh nghiệp mới được DÙNG THỬ số ngày cấu hình ở trang quản trị
  // (mặc định 7); hết hạn thì chỉ vào được trang gia hạn (xem api/login.ts).
  const { data: trialRow } = await supabase.from('platform_settings').select('value').eq('key', 'trial').maybeSingle();
  const trial = readTrial(trialRow?.value);
  const trialEndsAt = new Date(Date.now() + trial.days * DAY_MS).toISOString();
  const created = await createCompanyWithAdmin(supabase, {
    expiresAt: trialEndsAt,
    isTrial: true,
    slug: data.slug,
    name: data.companyName,
    adminUsername: ADMIN_USERNAME,
    adminPassword: data.password,
    adminName: data.adminName,
    adminEmail: data.email,
    adminPhone: data.phone,
  });
  if (!created.ok) {
    if (created.status === 409) {
      res.status(409).json({ error: SLUG_MESSAGES.taken, errors: { slug: SLUG_MESSAGES.taken } });
    } else {
      console.error('[api/register-company] Tạo công ty thất bại:', created.error);
      res.status(500).json({ error: 'Không tạo được doanh nghiệp. Vui lòng thử lại sau.' });
    }
    return;
  }

  res.status(201).json({
    company: { slug: created.company!.slug, name: created.company!.name },
    adminUsername: ADMIN_USERNAME,
    trial: { days: trial.days, endsAt: trialEndsAt },
  });
}
