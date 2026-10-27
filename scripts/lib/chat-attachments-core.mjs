// LÕI THUẦN của công cụ chuyển ảnh/tệp base64 trong tin nhắn cũ sang Storage (scripts/migrate-chat-attachments-to-storage.mjs).
// Có test: src/lib/__tests__/chatAttachmentsMigration.test.ts

const EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'application/pdf': 'pdf' };

/** Tách chuỗi data:<mime>;base64,<dữ liệu> → { mime, buf }; null nếu không phải data URL */
export function parseDataUrl(s) {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(typeof s === 'string' ? s : '');
  if (!m) return null;
  return { mime: m[1], buf: m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3])) };
}

/** Đuôi tệp: ưu tiên đuôi trong tên tệp, không có thì theo loại nội dung */
export function extOf(name, mime) {
  const fromName = (String(name || '').split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return (fromName && fromName.length <= 5 ? fromName : '') || EXT[mime] || 'bin';
}

/** Đoạn tên an toàn cho đường dẫn Storage */
export const safeSeg = (s) => String(s || 'x').replace(/[^a-zA-Z0-9_-]/g, '_');

/** Tệp đính kèm nào cần chuyển: url là data URL (base64 nhúng trong tin) */
export const needsMigration = (att) => !!att && typeof att.url === 'string' && att.url.startsWith('data:');

/** Tin có ít nhất 1 tệp cần chuyển? */
export const messageNeedsMigration = (atts) => Array.isArray(atts) && atts.some(needsMigration);

/**
 * Dựng danh sách đính kèm MỚI: tệp cần chuyển được thay url (và kích thước nếu có) bằng kết quả của `resolved[chỉ số]`;
 * tệp khác (đã là đường dẫn) và mọi trường còn lại giữ nguyên. resolved[i] = { url, size? }.
 */
export function rebuildAttachments(atts, resolved) {
  return atts.map((a, i) => (needsMigration(a) && resolved[i] ? { ...a, url: resolved[i].url, ...(resolved[i].size ? { size: resolved[i].size } : {}) } : a));
}

/** Đường dẫn trong kho: <công ty>/<hội thoại>/<mã tin>_<số thứ tự>_<băm nội dung>.<đuôi> — cố định theo nội dung nên chạy lại không sinh tệp trùng */
export function storagePath(companyId, conversationId, messageId, index, hash, ext) {
  return `${companyId}/${safeSeg(conversationId)}/${safeSeg(messageId)}_${index}_${hash}.${ext}`;
}
