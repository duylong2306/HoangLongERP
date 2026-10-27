#!/usr/bin/env node
// CHUYỂN TIN HỆ THỐNG CŨ TRONG NHÓM CHAT DỰ ÁN → NHẬT KÝ DỰ ÁN (bảng project_events).
// Lõi nhận dạng/chuyển đổi (có test): scripts/lib/legacy-events-core.mjs
//
// Cần tệp khóa (nằm trong .gitignore, KHÔNG dán khóa vào chat): VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY của project LoLo.
// Cần chạy trước migration supabase/migrations/20261031_project_events_attachments.sql (thêm cột đính kèm + bảng sao lưu).
//
// 3 chế độ (chạy lần lượt, mỗi bước tự kiểm tra bước trước):
//   1) CHẠY THỬ (mặc định, không ghi gì):  node scripts/migrate-project-chat-events.mjs --cong-ty=<mã công ty>
//   2) GHI: sao lưu tin + chép vào nhật ký + đặt mốc "đã xem":   ... --cong-ty=<mã công ty> --ghi
//        (tin vẫn CÒN trong nhóm chat — kiểm tra Nhật ký xong mới sang bước 3)
//   3) XÓA tin hệ thống khỏi nhóm chat (chỉ tin đã có bản sao lưu + đã có dòng nhật ký):  ... --cong-ty=<mã công ty> --xoa
// Tùy chọn: --env=<tệp> (mặc định .env.staging.local)
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { planMigration, summarizePlan, recomputeConversation, projectIdOfConversationId } from './lib/legacy-events-core.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : []; }).filter((x) => x.length));
const company = typeof args['cong-ty'] === 'string' ? args['cong-ty'] : '';
if (!/^[0-9a-f-]{36}$/i.test(company)) { console.error('Thiếu --cong-ty=<mã công ty (uuid)>. Lấy mã: select id, slug from public.companies;'); process.exit(1); }
if (args.ghi && args.xoa) { console.error('Chỉ chọn MỘT trong --ghi hoặc --xoa mỗi lần chạy.'); process.exit(1); }

// Đọc tệp khóa (cú pháp KEY=VALUE từng dòng)
const envFile = typeof args.env === 'string' ? args.env : '.env.staging.local';
const env = {};
for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) { console.error(`Tệp ${envFile} thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.`); process.exit(1); }
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
console.log(`Project: ${env.VITE_SUPABASE_URL} · công ty: ${company} · chế độ: ${args.ghi ? 'GHI' : args.xoa ? 'XÓA' : 'CHẠY THỬ'}`);

const must = (r, what) => { if (r.error) { console.error(`LỖI ${what}: ${r.error.message}`); process.exit(1); } return r.data; };
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// Tải toàn bộ tin của các nhóm dự án thuộc công ty (phân trang 1000 dòng, sắp ổn định theo thời gian rồi mã)
async function loadMessages() {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const r = await sb.from('chat_messages').select('*').eq('company_id', company).like('conversation_id', 'conv_project_%')
      .order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, from + 999);
    const rows = must(r, 'tải tin nhắn');
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}

const messages = await loadMessages();
const plan = planMigration(messages);
const sum = summarizePlan(plan);
console.log(`\nTổng ${sum.total} tin trong nhóm dự án → chuyển vào nhật ký: ${sum.event} · chỉ xóa (nhiễu): ${sum.drop} · giữ lại trong chat: ${sum.keep}`);
console.log('Theo loại sự kiện:', sum.byType, '· có đính kèm:', sum.withAttachments);
console.log('Biểu tượng của tin được GIỮ LẠI:', sum.keptIcons);
for (const [t, s] of Object.entries(sum.samples)) console.log(`  [${t}]`, s);

const toMove = plan.filter((p) => p.action !== 'keep');

if (!args.ghi && !args.xoa) {
  console.log('\n(Chạy thử — chưa ghi gì. Xem kỹ "Biểu tượng của tin được GIỮ LẠI" và các mẫu; ổn thì chạy lại với --ghi.)');
  process.exit(0);
}

if (args.ghi) {
  // 1) SAO LƯU nguyên dòng của mọi tin sắp xóa (kể cả tin nhiễu) — khôi phục được khi cần
  for (const part of chunks(toMove, 200)) {
    must(await sb.from('chat_messages_legacy_backup').upsert(
      part.map((p) => ({ id: p.msg.id, company_id: company, conversation_id: p.msg.conversation_id, data: p.msg })), { onConflict: 'id' }), 'sao lưu');
  }
  // 2) CHÉP vào nhật ký (khóa company_id + source_msg_id chống trùng → chạy lại không sinh thêm dòng)
  const events = plan.filter((p) => p.action === 'event').map((p) => ({ ...p.event, company_id: company }));
  for (const part of chunks(events, 200)) {
    must(await sb.from('project_events').upsert(part, { onConflict: 'company_id,source_msg_id', ignoreDuplicates: true }), 'ghi nhật ký');
  }
  // 3) Đặt mốc "đã xem" = bây giờ cho những ai đã có mốc, để không báo "hàng nghìn hoạt động mới" (người chưa có mốc sẽ được đặt mốc lần đầu mở)
  must(await sb.from('project_event_reads').update({ last_seen_at: new Date().toISOString() }).eq('company_id', company), 'đặt mốc đã xem');
  console.log(`\nĐã sao lưu ${toMove.length} tin, ghi ${events.length} dòng nhật ký (dòng đã có sẽ được bỏ qua). Tin vẫn còn trong chat — kiểm tra Nhật ký rồi mới chạy --xoa.`);
  process.exit(0);
}

// ---- --xoa: chỉ xóa tin ĐÃ có bản sao lưu và (với tin sự kiện) ĐÃ có dòng nhật ký ----
const backedUp = new Set(); const logged = new Set();
for (const part of chunks(toMove.map((p) => p.msg.id), 200)) {
  must(await sb.from('chat_messages_legacy_backup').select('id').in('id', part), 'kiểm tra sao lưu').forEach((r) => backedUp.add(r.id));
  must(await sb.from('project_events').select('source_msg_id').eq('company_id', company).in('source_msg_id', part), 'kiểm tra nhật ký').forEach((r) => logged.add(r.source_msg_id));
}
const safe = toMove.filter((p) => backedUp.has(p.msg.id) && (p.action === 'drop' || logged.has(p.msg.id)));
if (safe.length !== toMove.length) {
  console.error(`\nDỪNG: chỉ ${safe.length}/${toMove.length} tin có đủ sao lưu + nhật ký. Chạy lại bước --ghi rồi thử lại. Chưa xóa gì.`);
  process.exit(1);
}
const affected = new Set(safe.map((p) => p.msg.conversation_id));
for (const part of chunks(safe.map((p) => p.msg.id), 200)) {
  must(await sb.from('chat_messages').delete().eq('company_id', company).in('id', part), 'xóa tin');
}
// Tính lại tin cuối + số chưa đọc của từng nhóm bị ảnh hưởng
let fixed = 0;
for (const convId of affected) {
  const conv = must(await sb.from('conversations').select('*').eq('company_id', company).eq('id', convId).maybeSingle(), 'đọc nhóm');
  if (!conv) continue;
  const remaining = must(await sb.from('chat_messages').select('*').eq('company_id', company).eq('conversation_id', convId)
    .order('created_at', { ascending: true }).order('id', { ascending: true }), 'đọc tin còn lại').filter((m) => !m.deleted);
  must(await sb.from('conversations').update(recomputeConversation(conv, remaining)).eq('company_id', company).eq('id', convId), 'cập nhật nhóm');
  fixed++;
}
console.log(`\nĐã xóa ${safe.length} tin khỏi nhóm chat (có sao lưu trong chat_messages_legacy_backup); cập nhật ${fixed} nhóm. Mã dự án mẫu: ${projectIdOfConversationId([...affected][0] || '')}`);
