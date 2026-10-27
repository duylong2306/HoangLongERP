// Công cụ chuyển tin hệ thống cũ trong nhóm chat dự án → Nhật ký: nhận dạng, tách tin, tính lại nhóm, đối chiếu classifyEvent, migration.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../supabase', () => ({ getSupabase: () => null, getCurrentCompanyId: () => null }));

// @ts-expect-error — module .mjs của script, không có kiểu
import * as core from '../../../scripts/lib/legacy-events-core.mjs';
import { classifyEvent as classifyTs, EVENT_TYPE_META } from '../projectEvents';

const msg = (over: Record<string, any> = {}) => ({
  id: 'm1', conversation_id: 'conv_project_P1', sender_id: 'NV1', sender_name: 'Lan', content: '✅ Lan đã duyệt phiếu chi',
  created_at: '2026-10-01T03:00:00.000Z', deleted: false, attachments: null, related_entity: null, ...over,
});

describe('nhận dạng tin hệ thống', () => {
  it('tin có biểu tượng hệ thống → chuyển; chữ thường / 😊 / 📎 tệp người đăng → giữ lại', () => {
    const plan = core.planMigration([
      msg({ id: 'a' }), msg({ id: 'b', content: 'hôm nay thợ vào chưa em?' }), msg({ id: 'c', content: '😊' }),
      msg({ id: 'd', content: '📎 anh_1.jpg' }), msg({ id: 'e', content: '⚠️ ĐÃ CHỐT THIẾU HÀNG cho đơn PO-1' }),
    ]);
    expect(plan.map((p: any) => p.action)).toEqual(['event', 'keep', 'keep', 'keep', 'event']);
  });

  it('biểu tượng có ký tự phụ (✏️ 🗑️) vẫn nhận ra', () => {
    expect(core.leadingIcon('✏️ Đức đã cập nhật')).toBe('✏');
    expect(core.planMigration([msg({ content: '🗑️ Đức đã xóa công việc "A"' })])[0].action).toBe('event');
  });

  it('"👥 đã đồng bộ N nhân sự" là nhiễu: chỉ xóa khỏi chat, không vào nhật ký', () => {
    const [p] = core.planMigration([msg({ content: '👥 Long đã đồng bộ 4 nhân sự dự án vào nhóm chat.' })]);
    expect(p.action).toBe('drop');
    expect(p.event).toBeUndefined();
  });

  it('chỉ đụng nhóm dự án; tin ở nhóm khác hoặc đã xóa mềm được giữ', () => {
    const plan = core.planMigration([
      msg({ conversation_id: 'conv_personal_A_B' }), msg({ conversation_id: 'conv_work_x' }), msg({ deleted: true }),
    ]);
    expect(plan.every((p: any) => p.action === 'keep')).toBe(true);
  });
});

describe('dựng dòng nhật ký từ tin cũ', () => {
  it('giữ thời điểm gốc, người làm, mã tin gốc; bỏ biểu tượng và tên người đứng đầu câu', () => {
    const [p] = core.planMigration([msg({ content: '✅ Lan đã duyệt phiếu chi PC-1', id: 'm9' })]);
    expect(p.event).toMatchObject({
      project_id: 'P1', actor_id: 'NV1', actor_name: 'Lan', text: 'đã duyệt phiếu chi PC-1',
      created_at: '2026-10-01T03:00:00.000Z', source_msg_id: 'm9', type: 'duyet',
    });
  });

  it('tin nhiều dòng: dòng đầu = tóm tắt, phần sau = chi tiết', () => {
    const [p] = core.planMigration([msg({ content: '💰 ĐÃ LẬP PHIẾU CHI\nMã đề xuất: DX-1\nSố tiền: 5.000.000đ' })]);
    expect(p.event.text).toBe('ĐÃ LẬP PHIẾU CHI');
    expect(p.event.detail).toBe('Mã đề xuất: DX-1\nSố tiền: 5.000.000đ');
    expect(p.event.obj_kind).toBe('payment');
  });

  it('related_entity task → task_id; đính kèm được giữ nguyên (báo cáo hoàn thành kèm ảnh)', () => {
    const att = [{ id: 'f1', type: 'image', name: 'a.jpg', url: 'https://x/a.jpg' }];
    const [p] = core.planMigration([msg({ content: '✅ Công đã Xác Nhận Hoàn Thành Nhiệm Vụ "THI CÔNG".\n\n📋 Báo cáo: xong', related_entity: { type: 'task', id: 'T7' }, attachments: att })]);
    expect(p.event.task_id).toBe('T7');
    expect(p.event.attachments).toEqual(att);
    expect(p.event.obj_name).toBe('THI CÔNG');
    expect(p.event.obj_kind).toBe('mission');
  });

  it('vật tư 📦🛒🚚 → loại tài chính, đối tượng vật tư', () => {
    for (const ic of ['📦', '🛒', '🚚']) {
      const [p] = core.planMigration([msg({ content: `${ic} ĐỀ XUẤT VẬT TƯ VT-1 ĐÃ NHẬN HÀNG` })]);
      expect(p.event.type).toBe('tc');
      expect(p.event.obj_kind).toBe('material');
    }
  });

  it('tên công việc chứa từ khóa không làm xếp nhầm loại (vd. "KÝ HỢP ĐỒNG NHẬN TẠM ỨNG" không phải tin tài chính)', () => {
    const [a, b, c] = core.planMigration([
      msg({ id: '1', content: '📌 Long đã chuyển Phụ Trách Chính công việc "KÝ HỢP ĐỒNG NHẬN TẠM ỨNG" sang An.' }),
      msg({ id: '2', content: '🎉 Long (Phụ Trách Chính) đã HOÀN THÀNH công việc "KÝ HỢP ĐỒNG NHẬN TẠM ỨNG".' }),
      msg({ id: '3', content: '💰 ĐÃ LẬP PHIẾU CHI TẠM ỨNG' }),
    ]);
    expect(a.event.type).toBe('giao');
    expect(b.event.type).not.toBe('tc'); // trước đây bị xếp nhầm vào Tài chính vì tên công việc có "tạm ứng"
    expect(c.event.type).toBe('tc'); // từ khóa NGOÀI dấu nháy vẫn được tính
    expect(a.event.text).toContain('"KÝ HỢP ĐỒNG NHẬN TẠM ỨNG"'); // nội dung hiển thị giữ nguyên
  });

  it('chạy lại cùng dữ liệu cho cùng kết quả (khóa source_msg_id ổn định)', () => {
    const m = [msg({ id: 'x1' }), msg({ id: 'x2', content: '➕ Lan đã thêm An vào Nhiệm Vụ "B".' })];
    expect(core.planMigration(m)).toEqual(core.planMigration(m));
  });
});

describe('đối chiếu bản sao classifyEvent với bản TypeScript', () => {
  const samples = [
    '✅ Lan đã duyệt phiếu chi', '❌ Lan đã từ chối đề xuất', '🗑️ Đức đã xóa công việc "A"', '🎉 Đức đã HOÀN THÀNH công việc "B".',
    '📝 Lan đã tạo Nhiệm Vụ "C"', '➕ Lan đã thêm An vào Nhiệm Vụ "B".', '🙋 An đã nhận việc "D"', '🔔 Long đã gửi Yêu cầu phê duyệt',
    '📦 ĐỀ XUẤT VẬT TƯ VT-1 ĐÃ NHẬN HÀNG', '💰 ĐÃ LẬP PHIẾU CHI', '👤 Long chuyển trưởng dự án', '🔄 Đổi giai đoạn', 'đổi hạn công việc "Sơn"', 'tin thường',
  ];
  it.each(samples)('%s', (s) => {
    expect(core.classifyLegacy(s)).toEqual(classifyTs(s));   // bản của công cụ chuyển (đã bỏ phần trong nháy) phải trùng bản trong ứng dụng
  });
  it('cả hai bản đều không xếp nhầm theo từ khóa nằm trong tên đối tượng', () => {
    for (const s of [
      '📌 Long đã chuyển Phụ Trách Chính công việc "KÝ HỢP ĐỒNG NHẬN TẠM ỨNG" sang An.',
      '🎉 Long đã HOÀN THÀNH công việc "Mua vật tư phiếu chi".',
      '➕ Lan đã thêm An vào Nhiệm Vụ "Duyệt hồ sơ".',
    ]) expect(core.classifyLegacy(s)).toEqual(classifyTs(s));
  });
  it('mọi loại do bản .mjs trả về đều có trong EVENT_TYPE_META', () => {
    for (const s of samples) expect(EVENT_TYPE_META[core.classifyEvent(s).type as keyof typeof EVENT_TYPE_META]).toBeTruthy();
  });
});

describe('tính lại nhóm sau khi xóa tin hệ thống', () => {
  const conv = { created_at: '2026-10-01T00:00:00Z', unread_counts: { A: 5, B: 1, C: 0 } };
  const rest = [
    { sender_id: 'A', sender_name: 'An', content: 'chào', created_at: '2026-10-02T00:00:00Z', deleted: false },
    { sender_id: 'B', sender_name: 'Bình', content: 'ok anh', created_at: '2026-10-03T00:00:00Z', deleted: false },
  ];
  it('tin cuối = tin người thật cuối cùng; số chưa đọc không tăng và bị chặn bởi số tin còn lại không phải của mình', () => {
    const r = core.recomputeConversation(conv, rest);
    expect(r.last_message).toMatchObject({ content: 'ok anh', senderId: 'B', senderName: 'Bình' });
    expect(r.last_message_at).toBe('2026-10-03T00:00:00Z');
    expect(r.unread_counts).toEqual({ A: 1, B: 1, C: 0 }); // A: còn 1 tin của người khác; B: 1 tin của An (cũ 1)
  });
  it('nhóm hết tin → không còn tin cuối, mốc thời gian = lúc tạo nhóm, chưa đọc về 0', () => {
    const r = core.recomputeConversation(conv, []);
    expect(r.last_message).toBeNull();
    expect(r.last_message_at).toBe('2026-10-01T00:00:00Z');
    expect(Object.values(r.unread_counts)).toEqual([0, 0, 0]);
  });
});

describe('báo cáo chạy thử', () => {
  it('đếm đúng theo hành động và loại', () => {
    const s = core.summarizePlan(core.planMigration([
      msg({ id: '1' }), msg({ id: '2', content: '👥 đã đồng bộ' }), msg({ id: '3', content: 'chào' }), msg({ id: '4', content: '📎 a.jpg' }),
    ]));
    expect(s).toMatchObject({ total: 4, event: 1, drop: 1, keep: 2 });
    expect(s.keptIcons).toEqual({ '(chữ)': 1, '📎': 1 });
  });
});

describe('migration và giao diện', () => {
  const root = path.resolve(__dirname, '../../..');
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261031_project_events_attachments.sql'), 'utf8');
  it('migration thêm cột đính kèm, khóa chống trùng, bảng sao lưu không có chính sách truy cập', () => {
    expect(sql).toMatch(/add column if not exists attachments jsonb/);
    expect(sql).toMatch(/create unique index if not exists project_events_source_msg\s+on public\.project_events \(company_id, source_msg_id\)/);
    expect(sql).toMatch(/create table if not exists public\.chat_messages_legacy_backup/);
    expect(sql).toMatch(/alter table public\.chat_messages_legacy_backup enable row level security/);
    expect(sql).not.toMatch(/create policy/i);
  });
  it('script có 3 chế độ và chỉ xóa tin đã sao lưu + đã có nhật ký', () => {
    const js = fs.readFileSync(path.join(root, 'scripts/migrate-project-chat-events.mjs'), 'utf8');
    expect(js).toMatch(/args\.ghi/); expect(js).toMatch(/args\.xoa/);
    expect(js).toMatch(/backedUp\.has\(p\.msg\.id\)/); expect(js).toMatch(/logged\.has\(p\.msg\.id\)/);
    expect(js).toMatch(/onConflict: 'company_id,source_msg_id', ignoreDuplicates: true/);
  });
  it('Nhật ký hiển thị ảnh/tệp đính kèm', () => {
    const tsx = fs.readFileSync(path.join(root, 'src/components/ProjectActivityModal.tsx'), 'utf8');
    expect(tsx).toMatch(/activity-attachments/);
    expect(fs.readFileSync(path.join(root, 'src/lib/projectEvents.ts'), 'utf8')).toMatch(/attachments: Array\.isArray\(r\.attachments\)/);
  });
});
