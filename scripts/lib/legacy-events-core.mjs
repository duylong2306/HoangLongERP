// LÕI THUẦN (không đụng mạng/CSDL) của công cụ chuyển tin hệ thống cũ trong nhóm chat dự án → Nhật ký dự án.
// Dùng bởi scripts/migrate-project-chat-events.mjs và được kiểm thử trong src/lib/__tests__/legacyEventMigration.test.ts.
//
// Bối cảnh: trước đây mọi thao tác của dự án được gửi vào nhóm chat DƯỚI TÊN NGƯỜI THAO TÁC (cờ system = false),
// nên không thể nhận dạng tin hệ thống bằng cờ — chỉ nhận dạng được bằng BIỂU TƯỢNG đứng đầu câu (xem EVENT_ICONS).

/** Biểu tượng đứng đầu câu của các tin hệ thống cũ cần chuyển thành sự kiện nhật ký */
export const EVENT_ICONS = new Set([
  '📝', '👤', '➕', '➖', '🙋', '✅', '❌', '🗑', '💾', '🎉', '🔔', '🔓', '✏', '📦', '🛒', '🚚', '💰', '⚠', '🔄', '🧩', '📌',
]);
/** Tin hệ thống nhưng KHÔNG đáng vào nhật ký (nhiễu): "đã đồng bộ N nhân sự vào nhóm chat" — chỉ xóa khỏi nhóm chat (có sao lưu) */
export const NOISE_ICONS = new Set(['👥']);

const VS16 = /️/g; // ký tự "dạng biểu tượng màu" đi kèm một số emoji (✏️, ⚠️, 🗑️) — bỏ đi khi so khớp

/** Biểu tượng đầu câu (đã bỏ ký tự phụ) hoặc '' */
export const leadingIcon = (content) => (Array.from((content || '').trim().replace(VS16, ''))[0]) || '';

/**
 * BẢN SAO của classifyEvent trong src/lib/projectEvents.ts (script .mjs không import được file TypeScript).
 * Có test đối chiếu hai bản — sửa một bên phải sửa cả bên kia.
 */
export function classifyEvent(content) {
  const s = (content || '').trim();
  const lower = s.toLowerCase();
  const first = Array.from(s)[0] || '';
  let type = 'khac';
  if (/xóa|hủy|bị hủy/.test(lower) || first === '🗑') type = 'xoa';
  else if (/hạn|ưu tiên/.test(lower) && /đổi|cập nhật/.test(lower)) type = 'han';
  else if (first === '✅' || first === '❌' || first === '🔔' || /duyệt|từ chối|xét duyệt/.test(lower)) type = 'duyet';
  else if (first === '💰' || first === '📦' || first === '🛒' || first === '🚚' || /phiếu chi|tạm ứng|vật tư|công tác phí/.test(lower)) type = 'tc';
  else if (['📌', '🧩', '👤', '🔓', '➖'].includes(first) || /giao cho|phụ trách|thêm .* vào|chuyển trưởng/.test(lower)) type = 'giao';
  else if (first === '🔄' || first === '🙋' || first === '🎉' || /hoàn thành|nhận việc|trạng thái|giai đoạn/.test(lower)) type = 'tt';
  else if (first === '📝' || first === '➕' || /khởi tạo|tạo /.test(lower)) type = 'tao';
  const text = s.replace(/^[^\p{L}\p{N}"“\[\(]+/u, '').trim();
  return { type, text: text || s };
}

/**
 * Phân loại cho tin CŨ: bỏ phần chữ trong dấu nháy kép (tên công việc / nhiệm vụ / dự án) trước khi dò từ khóa, vì tên đối tượng
 * hay chứa từ khóa gây xếp nhầm — vd. công việc "KÝ HỢP ĐỒNG NHẬN TẠM ỨNG" bị coi là tin Tài chính. Văn bản hiển thị vẫn giữ nguyên.
 */
export function classifyLegacy(content) {
  const stripped = (content || '').replace(/["“][^"”]*["”]/g, '""');
  return { type: classifyEvent(stripped).type, text: classifyEvent(content).text };
}

/** Tách tin nhiều dòng: dòng đầu = tóm tắt, các dòng sau = chi tiết; bỏ tên người làm đứng đầu câu (giao diện đã in đậm tên) */
export function splitEventMessage(content, actorName) {
  const [head, ...rest] = (content || '').split('\n');
  const cls = classifyLegacy(head);
  let text = cls.text;
  const name = (actorName || '').trim();
  if (name && text.toLowerCase().startsWith(name.toLowerCase() + ' ')) text = text.slice(name.length).trim();
  return { type: cls.type, text, detail: rest.join('\n').trim() || undefined };
}

/** Đoán đối tượng của sự kiện (cột obj_kind) và tên đối tượng (chữ trong dấu nháy kép đầu tiên) */
export function guessObject(icon, text) {
  const lower = text.toLowerCase();
  let kind;
  if (icon === '📦' || icon === '🛒' || icon === '🚚') kind = 'material';
  else if (icon === '💰' || /phiếu chi|tạm ứng|công tác phí/.test(lower)) kind = 'payment';
  else if (/nhiệm vụ/.test(lower)) kind = 'mission';
  else if (/công việc/.test(lower)) kind = 'task';
  else if (/đề xuất/.test(lower)) kind = 'proposal';
  else if (/dự án/.test(lower)) kind = 'project';
  const m = text.match(/["“]([^"”]{1,120})["”]/);
  return { kind, name: m ? m[1] : undefined };
}

/** Mã dự án từ mã hội thoại `conv_project_<mã dự án>`; undefined nếu không phải nhóm dự án */
export const projectIdOfConversationId = (id) => (typeof id === 'string' && id.startsWith('conv_project_') ? id.slice('conv_project_'.length) : undefined);

/**
 * Lập kế hoạch cho 1 danh sách tin (đã lọc theo công ty). Với mỗi tin trong nhóm dự án trả về 1 trong:
 *   • { action: 'event', msg, event }  — chuyển thành dòng nhật ký (event đã đúng tên cột bảng project_events, trừ company_id do nơi gọi gắn);
 *   • { action: 'drop', msg }          — tin nhiễu: chỉ xóa khỏi chat (sau sao lưu), không ghi nhật ký;
 *   • { action: 'keep', msg, why }     — GIỮ trong chat (người chat thật, tệp người dùng đăng, tin đã xóa, biểu tượng lạ).
 */
export function planMigration(messages) {
  return (messages || []).map((msg) => {
    const projectId = projectIdOfConversationId(msg.conversation_id);
    if (!projectId) return { action: 'keep', msg, why: 'không thuộc nhóm dự án' };
    if (msg.deleted) return { action: 'keep', msg, why: 'đã xóa mềm' };
    const icon = leadingIcon(msg.content);
    if (NOISE_ICONS.has(icon)) return { action: 'drop', msg };
    if (!EVENT_ICONS.has(icon)) return { action: 'keep', msg, why: icon ? 'biểu tượng không thuộc tin hệ thống (người chat / tệp đăng)' : 'tin chữ thường (người chat)' };
    const { type, text, detail } = splitEventMessage(msg.content, msg.sender_name);
    const obj = guessObject(icon, text);
    const re = msg.related_entity && typeof msg.related_entity === 'object' ? msg.related_entity : null;
    const atts = Array.isArray(msg.attachments) && msg.attachments.length ? msg.attachments : null;
    return {
      action: 'event', msg,
      event: {
        project_id: projectId,
        task_id: re?.type === 'task' ? re.id : null,
        mission_id: re?.type === 'mission' ? re.id : null,
        actor_id: msg.sender_id || null,
        actor_name: msg.sender_name || null,
        type, obj_kind: obj.kind ?? null, obj_name: obj.name ?? null,
        text, detail: detail ?? null, from_val: null, to_val: null,
        attachments: atts,
        // Giữ NGUYÊN thời điểm gốc của tin (cột created_at của chat là chuỗi ISO)
        created_at: msg.created_at,
        // Khóa chống trùng: chạy lại công cụ nhiều lần không sinh thêm dòng
        source_msg_id: msg.id,
      },
    };
  });
}

/** Tóm tắt kế hoạch để in báo cáo chạy thử: đếm theo hành động / loại, vài mẫu mỗi loại, danh sách tin giữ lại có biểu tượng */
export function summarizePlan(plan, samplesPerType = 3) {
  const out = { total: plan.length, event: 0, drop: 0, keep: 0, byType: {}, samples: {}, withAttachments: 0, keptIcons: {} };
  for (const p of plan) {
    out[p.action]++;
    if (p.action === 'event') {
      const t = p.event.type;
      out.byType[t] = (out.byType[t] || 0) + 1;
      (out.samples[t] ||= []);
      if (out.samples[t].length < samplesPerType) out.samples[t].push(`${p.event.actor_name || '?'}: ${p.event.text}`.slice(0, 140));
      if (p.event.attachments) out.withAttachments++;
    } else if (p.action === 'keep') {
      // Chỉ phân nhóm theo biểu tượng; tin bắt đầu bằng chữ/số gộp chung thành "(chữ)"
      const lead = leadingIcon(p.msg.content);
      const ic = lead && /\p{Extended_Pictographic}/u.test(lead) ? lead : '(chữ)';
      out.keptIcons[ic] = (out.keptIcons[ic] || 0) + 1;
    }
  }
  return out;
}

/**
 * Tính lại số chưa đọc & tin cuối của 1 hội thoại SAU KHI xóa tin hệ thống.
 * remaining = các tin còn lại (đã sắp tăng dần theo thời gian). unread mới của mỗi người = nhỏ hơn của (số cũ, số tin còn lại không phải do họ gửi)
 * → không bao giờ tăng, và không còn đếm các tin đã xóa.
 */
export function recomputeConversation(conv, remaining) {
  const last = remaining.length ? remaining[remaining.length - 1] : null;
  const unread = {};
  for (const [uid, old] of Object.entries(conv.unread_counts || {})) {
    const cap = remaining.filter((m) => m.sender_id !== uid).length;
    unread[uid] = Math.min(Number(old) || 0, cap);
  }
  return {
    last_message: last
      ? { content: last.content, deleted: !!last.deleted, senderId: last.sender_id, createdAt: last.created_at, senderName: last.sender_name }
      : null,
    last_message_at: last ? last.created_at : conv.created_at,
    unread_counts: unread,
  };
}
