#!/usr/bin/env node
// BÙ MÃ CÔNG VIỆC / NHIỆM VỤ cho các dòng nhật ký đã chuyển từ chat bằng bản đầu của scripts/migrate-project-chat-events.mjs.
// Lỗi bản đầu: related_entity của tin chat là CHUỖI JSON nhưng bị đọc như đối tượng → mọi dòng chuyển sang thiếu task_id / mission_id
// → nút "Mở công việc / Mở nhiệm vụ" ở dòng nhật ký cũ không dùng được. Bản này đọc lại related_entity từ BẢN SAO LƯU (chat_messages_legacy_backup)
// và điền: tin về công việc → task_id; tin về nhiệm vụ → mission_id + task_id (tra bảng task_missions). Chỉ điền dòng còn TRỐNG cả hai, không đè dữ liệu có sẵn.
//   1) CHẠY THỬ (mặc định, không ghi gì): node scripts/backfill-project-event-links.mjs --cong-ty=<mã công ty>
//   2) GHI:                                ... --cong-ty=<mã công ty> --ghi
// Tùy chọn: --env=<tệp> (mặc định .env.staging.local)
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { parseEntity } from './lib/legacy-events-core.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : []; }).filter((x) => x.length));
const company = typeof args['cong-ty'] === 'string' ? args['cong-ty'] : '';
if (!/^[0-9a-f-]{36}$/i.test(company)) { console.error('Thiếu --cong-ty=<mã công ty (uuid)>.'); process.exit(1); }
const envFile = typeof args.env === 'string' ? args.env : '.env.staging.local';
const env = {};
for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) { console.error(`Tệp ${envFile} thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.`); process.exit(1); }
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const apply = !!args.ghi;
console.log(`Project: ${env.VITE_SUPABASE_URL} · công ty: ${company} · chế độ: ${apply ? 'GHI' : 'CHẠY THỬ'}`);
const must = (r, what) => { if (r.error) { console.error(`LỖI ${what}: ${r.error.message}`); process.exit(1); } return r.data; };
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// 1) Dòng nhật ký chuyển từ chat mà chưa có mã công việc / nhiệm vụ
const evs = [];
for (let from = 0; ; from += 1000) {
  const rows = must(await sb.from('project_events').select('id,source_msg_id').eq('company_id', company).not('source_msg_id', 'is', null)
    .is('task_id', null).is('mission_id', null).order('id').range(from, from + 999), 'tải dòng nhật ký');
  evs.push(...rows); if (rows.length < 1000) break;
}
console.log(`Dòng nhật ký chuyển từ chat còn thiếu mã: ${evs.length}`);

// 2) related_entity gốc lấy từ bản sao lưu (chỉ cột này, không kéo cả dòng — tin có thể mang ảnh nặng)
const relByMsg = new Map();
for (const part of chunks(evs.map((e) => e.source_msg_id), 150)) {
  for (const b of must(await sb.from('chat_messages_legacy_backup').select('id,rel:data->>related_entity').eq('company_id', company).in('id', part), 'đọc bản sao lưu')) {
    relByMsg.set(b.id, parseEntity(b.rel));
  }
}

// 3) Nhiệm vụ → công việc chứa nó
const missionIds = [...new Set([...relByMsg.values()].filter((r) => r?.type === 'mission').map((r) => r.id))];
const taskOfMission = new Map();
for (const part of chunks(missionIds, 150)) {
  // Khóa chính của task_missions là "<mã công việc>::<mã nhiệm vụ>" (không phải mã nhiệm vụ trơn) → tra theo data.id
  for (const m of must(await sb.from('task_missions').select('task_id,mid:data->>id').eq('company_id', company).in('data->>id', part), 'tra nhiệm vụ')) taskOfMission.set(m.mid, m.task_id);
}

// 4) Gom theo (task_id, mission_id) để cập nhật theo nhóm
const groups = new Map(); const stat = { task: 0, mission: 0, missionNoTask: 0, none: 0 };
for (const e of evs) {
  const re = relByMsg.get(e.source_msg_id);
  let task = null, mission = null;
  if (re?.type === 'task') { task = re.id; stat.task++; }
  else if (re?.type === 'mission') { mission = re.id; task = taskOfMission.get(re.id) || null; stat.mission++; if (!task) stat.missionNoTask++; }
  else { stat.none++; continue; }   // dự án / đề xuất / không có → không có công việc để mở
  const k = JSON.stringify([task, mission]);
  (groups.get(k) || groups.set(k, { task, mission, ids: [] }).get(k)).ids.push(e.id);
}
console.log(`Sẽ điền: về công việc ${stat.task} · về nhiệm vụ ${stat.mission} (trong đó ${stat.missionNoTask} nhiệm vụ không còn tìm thấy công việc — chỉ điền mã nhiệm vụ) · không có công việc/nhiệm vụ để gắn ${stat.none}`);
if (!apply) { console.log('\n(Chạy thử — chưa ghi gì. Ổn thì chạy lại với --ghi.)'); process.exit(0); }

let done = 0;
for (const g of groups.values()) {
  for (const part of chunks(g.ids, 150)) {
    must(await sb.from('project_events').update({ task_id: g.task, mission_id: g.mission }).eq('company_id', company).in('id', part)
      .is('task_id', null).is('mission_id', null), 'cập nhật');   // điều kiện is-null: không đè dòng đã có mã
    done += part.length;
  }
}
console.log(`\nXONG. Đã điền mã cho ${done} dòng nhật ký.`);
