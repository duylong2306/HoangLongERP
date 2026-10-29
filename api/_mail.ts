// GỬI EMAIL (qua Resend, gọi REST — không cần thêm thư viện) cho trang quản trị nền tảng: hiện chỉ dùng cho "Quên mật khẩu".
// File bắt đầu bằng "_" nên Vercel không coi là endpoint. KHÔNG import từ src/ (xem api/login.ts).
//
// Cấu hình bằng biến môi trường TRÊN MÁY CHỦ (không bao giờ gửi xuống trình duyệt, không ghi vào DB/nhật ký):
//   RESEND_API_KEY — khóa API của Resend (resend.com)
//   MAIL_FROM      — địa chỉ gửi, vd: "LoLo <no-reply@lolo.io.vn>" (tên miền phải đã xác minh ở Resend)
// Thiếu 1 trong 2 → coi như CHƯA cấu hình (không lỗi, chỉ không gửi được).

export interface MailResult { configured: boolean; ok: boolean; error?: string }

export function mailConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return !!(env.RESEND_API_KEY && env.MAIL_FROM);
}

export async function sendMail(
  msg: { to: string; subject: string; html: string; text: string },
  env: Record<string, string | undefined> = process.env,
): Promise<MailResult> {
  const key = env.RESEND_API_KEY, from = env.MAIL_FROM;
  if (!key || !from) return { configured: false, ok: false };
  // Giới hạn chờ 8 giây để không treo yêu cầu nếu nhà cung cấp chậm.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (!r.ok) {
      const j: any = await r.json().catch(() => ({}));
      // Chỉ ghi mô tả lỗi — KHÔNG ghi khóa API hay nội dung thư (có liên kết đặt lại).
      const error = `Resend trả lỗi ${r.status}${j?.message ? `: ${j.message}` : ''}`;
      console.error('[mail]', error);
      return { configured: true, ok: false, error };
    }
    return { configured: true, ok: true };
  } catch (e: any) {
    const error = e?.name === 'AbortError' ? 'Máy chủ gửi thư không phản hồi (quá thời gian chờ).' : 'Không kết nối được tới máy chủ gửi thư.';
    console.error('[mail]', error);
    return { configured: true, ok: false, error };
  } finally { clearTimeout(timer); }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Nội dung thư đặt lại mật khẩu (tiếng Việt, đơn giản). `minutes` = thời hạn liên kết.
export function resetMailContent(name: string, link: string, minutes: number) {
  const hello = name ? `Chào ${name},` : 'Xin chào,';
  const text = `${hello}\n\nCó yêu cầu đặt lại mật khẩu cho tài khoản quản trị nền tảng LoLo của bạn. Mở liên kết sau để đặt mật khẩu mới (có hiệu lực ${minutes} phút, chỉ dùng được 1 lần):\n\n${link}\n\nNếu không phải bạn yêu cầu, hãy bỏ qua thư này — mật khẩu hiện tại vẫn giữ nguyên.`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.6">
<p>${esc(hello)}</p>
<p>Có yêu cầu đặt lại mật khẩu cho tài khoản quản trị nền tảng LoLo của bạn. Bấm nút dưới đây để đặt mật khẩu mới (có hiệu lực ${minutes} phút, chỉ dùng được 1 lần):</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#0d47c9;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 20px;border-radius:8px">Đặt mật khẩu mới</a></p>
<p style="color:#64748b;font-size:12px">Nếu nút không bấm được, dán liên kết này vào trình duyệt:<br>${esc(link)}</p>
<p style="color:#64748b;font-size:12px">Nếu không phải bạn yêu cầu, hãy bỏ qua thư này — mật khẩu hiện tại vẫn giữ nguyên.</p></div>`;
  return { subject: 'Đặt lại mật khẩu quản trị LoLo', text, html };
}
