// TIÊU ĐỀ + NỘI DUNG THÔNG BÁO ĐẨY của tin hệ thống: nhìn thông báo là biết việc gì, ở đâu, của ai — không cần mở.
//   Tiêu đề = "Biểu tượng + Loại việc" (+ " · Tên nhóm" nếu là nhóm), VD "🔔 Cần duyệt nghỉ phép", "📌 Giao việc · Nhà anh Tuấn".
//   Nội dung = phần còn lại của dòng đầu (+ các dòng sau, VD "Lý do: …"); tin riêng thêm tên người gửi để biết ai nhờ/giao.
// Chỉ áp dụng cho TIN HỆ THỐNG (người gửi 'system' hoặc tin có thực thể liên quan = tin do mẫu messageTemplates sinh ra);
// tin người dùng tự gõ giữ nguyên: tiêu đề = tên người gửi, nội dung = lời nhắn.
export interface PushTextMsg { senderId?: string; senderName?: string; content?: string; relatedEntity?: unknown }
export interface PushTextConv { type?: string; name?: string }

const LEAD_SYMBOLS = /^[^\p{L}\p{N}"“\[\(]+/u;

export function buildPushText(msg: PushTextMsg, conv?: PushTextConv): { title: string; body: string } {
  const content = String(msg.content || '');
  const isSystem = msg.senderId === 'system' || !!msg.relatedEntity;
  const human = { title: msg.senderName || 'Tin nhắn mới', body: content };
  if (!isSystem) return human;

  const [head, ...rest] = content.split('\n');
  const symbol = (head.match(LEAD_SYMBOLS)?.[0] || '').trim();
  const line = head.replace(LEAD_SYMBOLS, '').trim();
  if (!symbol || !line) return human;

  const groupName = conv?.type === 'group' && conv.name ? conv.name : '';
  // Dạng "Loại: nội dung" → loại làm tiêu đề; không có dấu ":" (VD tin báo nghỉ) → tiêu đề là tên nhóm, nội dung là cả câu
  const colon = line.indexOf(':');
  const hasLabel = colon > 1 && colon <= 40;
  const label = hasLabel ? line.slice(0, colon).trim() : '';
  const first = hasLabel ? line.slice(colon + 1).trim() : line;
  const title = `${symbol} ${label || groupName || msg.senderName || 'Thông báo'}${label && groupName ? ` · ${groupName}` : ''}`;

  // Tin riêng: thêm người gửi (người lập đơn / người giao) vì nội dung không còn nhắc tên
  const who = conv?.type !== 'group' && msg.senderId !== 'system' && msg.senderName ? `${msg.senderName} · ` : '';
  const body = [`${who}${first}`, ...rest.filter(l => l.trim())].join('\n');
  return { title, body };
}
