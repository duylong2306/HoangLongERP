// GỬI TIN NHẮN TELEGRAM cho quản trị nền tảng (báo "khách đã chuyển khoản, cần duyệt đơn").
// File bắt đầu bằng "_" nên Vercel không coi là endpoint. KHÔNG import từ src/ (xem api/login.ts).
//
// Cấu hình bằng 2 biến môi trường TRÊN MÁY CHỦ (không bao giờ gửi xuống trình duyệt, không ghi vào DB/nhật ký):
//   TELEGRAM_BOT_TOKEN — token của bot (tạo qua @BotFather)
//   TELEGRAM_CHAT_ID   — id của người/nhóm/kênh nhận tin (bot phải đã được nhắn / thêm vào nhóm đó)
// Thiếu 1 trong 2 → coi như CHƯA cấu hình (không lỗi, chỉ không gửi được).

export interface TelegramResult { configured: boolean; ok: boolean; error?: string }

export function telegramConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
}

// Thoát ký tự đặc biệt của HTML (parse_mode=HTML) — tên công ty/mã đơn do người dùng nhập, không được chèn thẻ vào tin nhắn.
export const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function sendTelegram(html: string, env: Record<string, string | undefined> = process.env): Promise<TelegramResult> {
  const token = env.TELEGRAM_BOT_TOKEN, chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { configured: false, ok: false };
  // Giới hạn thời gian chờ 6 giây để không treo yêu cầu của khách nếu Telegram chậm.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ chat_id: chatId, text: html.slice(0, 3500), parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!r.ok) {
      const j: any = await r.json().catch(() => ({}));
      // Chỉ ghi mô tả lỗi của Telegram — KHÔNG ghi URL (có chứa token).
      const error = `Telegram trả lỗi ${r.status}${j?.description ? `: ${j.description}` : ''}`;
      console.error('[telegram]', error);
      return { configured: true, ok: false, error };
    }
    return { configured: true, ok: true };
  } catch (e: any) {
    const error = e?.name === 'AbortError' ? 'Telegram không phản hồi (quá thời gian chờ).' : 'Không kết nối được tới Telegram.';
    console.error('[telegram]', error);
    return { configured: true, ok: false, error };
  } finally {
    clearTimeout(timer);
  }
}
