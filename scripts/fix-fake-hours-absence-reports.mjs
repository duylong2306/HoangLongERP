#!/usr/bin/env node
// SỬA GIỜ LÀM ẢO do chức năng duyệt "Báo cáo nghỉ ca" CŨ tạo ra (đã sửa lỗi trong mã ngày 08/10/2026).
// Lỗi cũ: duyệt "Báo cáo nghỉ ca" mà ngày đó chưa có bản ghi chấm công thì hệ thống TỰ ĐIỀN giờ chuẩn (07:30–11:30 / 13:00–17:00) cho ca
// không được báo cáo → người báo nghỉ CẢ NGÀY vẫn bị cộng +0,5 công.
//
// Phạm vi mặc định: 6 ngày–người RÕ RÀNG (báo nghỉ cả 2 ca vì việc riêng, bản ghi vẫn có giờ ảo). 6 ngày "cần hỏi" (NV009 ngày mưa, NV005 "Đổi phép năm")
// chỉ sửa khi thêm --gom-ca-nhom-can-hoi. KHÔNG bao giờ đụng 2 ngày "cần xác minh" (NV012 18/08, NV008 25/09: có thể đi làm thật 1 ca).
//
// AN TOÀN:
//   • Mặc định CHẠY THỬ: chỉ in ra trước/sau, không ghi gì.
//   • Mỗi ngày–người được KIỂM TRA LẠI ngay lúc chạy; thiếu một điều kiện là BỎ QUA và báo lý do:
//       – bản ghi do duyệt tạo ra (kiểu "Duyệt công"), không có ảnh/tọa độ/dấu vết chấm thật;
//       – mọi giờ có mặt đều là giờ chuẩn (07:30, 11:30, 13:00, 17:00);
//       – ngày đó có "Báo cáo nghỉ ca" ĐÃ DUYỆT cho CẢ HAI ca (sáng + chiều);
//       – không có đơn nghỉ phép thật đã duyệt phủ ngày đó; bản ghi chưa chốt công (trừ khi có --ca-ban-ghi-da-chot).
//   • Trước khi ghi: SAO LƯU nguyên bản ghi ra ổ đĩa (migration-snapshot/sua-gio-ao-<giờ>/sao-luu.json). Hoàn tác: --khoi-phuc=<thư mục> --ghi.
//   • Chỉ ĐỔI 4 ô giờ (sáng vào/ra, chiều vào/ra) thành trống "--:--"; không xóa bản ghi, không đổi trạng thái/ghi chú.
//   • KHÔNG đụng bảng lương. Cuối cùng in ra bảng lương nào cần tính lại (tháng nào đã khóa thì phải mở khóa rồi tính lại).
//
// Sau khi sửa: ngày báo nghỉ cả 2 ca đã duyệt và không có giờ → tính 0 công (mã P), không còn +0,5.
// Dùng:
//   node scripts/fix-fake-hours-absence-reports.mjs                       # chạy thử
//   node scripts/fix-fake-hours-absence-reports.mjs --ghi                 # sửa thật (hỏi gõ cụm xác nhận)
//   node scripts/fix-fake-hours-absence-reports.mjs --khoi-phuc=migration-snapshot/sua-gio-ao-... --ghi   # hoàn tác
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';

const args = {};
for (const a of process.argv.slice(2)) { const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (m) args[m[1]] = m[2] === undefined ? true : m[2]; }
const die = (m) => { console.error(`\n⛔ ${m}\n`); process.exit(1); };

function loadEnv(file) {
  if (!fs.existsSync(file)) die(`Thiếu tệp ${file}.`);
  const e = {};
  for (const l of fs.readFileSync(file, 'utf8').split(/\r?\n/)) { if (l.trim().startsWith('#')) continue; const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) e[m[1]] = m[2].replace(/^['"]|['"]$/g, ''); }
  if (!e.VITE_SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) die(`${file} thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.`);
  return e;
}
const env = loadEnv('.env.staging.local');
const refOf = (u) => new URL(u).hostname.split('.')[0];
if (fs.existsSync('.env.production.local') && refOf(loadEnv('.env.production.local').VITE_SUPABASE_URL) === refOf(env.VITE_SUPABASE_URL)) die('Project đích trùng production cũ — dừng.');
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: co, error: coErr } = await sb.from('companies').select('id,name').eq('slug', 'hoanglong').single();
if (coErr || !co) die('Không tìm thấy doanh nghiệp hoanglong.');
const CID = co.id;

// ─── Hoàn tác từ bản sao lưu ───
if (args['khoi-phuc']) {
  const dir = String(args['khoi-phuc']); const f = path.join(dir, 'sao-luu.json');
  if (!fs.existsSync(f)) die(`Không thấy ${f}.`);
  const rows = JSON.parse(fs.readFileSync(f, 'utf8'));
  console.log(`▶ HOÀN TÁC ${rows.length} bản ghi từ ${f} ${args.ghi ? '' : '— CHẠY THỬ (không ghi)'}`);
  if (!args.ghi) process.exit(0);
  let ok = 0;
  for (const r of rows) {
    const { error } = await sb.from('attendance_records').update({ time_in_s: r.time_in_s, time_out_s: r.time_out_s, time_in_c: r.time_in_c, time_out_c: r.time_out_c }).eq('company_id', CID).eq('id', r.id);
    if (error) console.error('  ✗', r.id, error.message); else ok++;
  }
  console.log(`✅ Đã khôi phục ${ok}/${rows.length} bản ghi.`); process.exit(0);
}

// 12 ngày–người "chắc chắn cao" (kết quả quét ngày 08/10/2026), chia 2 nhóm theo LÝ DO của báo cáo:
//  • RÕ RÀNG (6 ngày): lý do là nghỉ việc riêng/ốm/việc gia đình/đi học → thực sự vắng, giờ chuẩn là do hệ thống tự điền → sửa mặc định.
//  • CẦN HỎI (6 ngày): lý do không phải "nghỉ không lương" thuần túy → CHƯA sửa mặc định, phải hỏi người duyệt trước:
//      – NV009 20/08: "Trời mưa, công nhân nghỉ nên không chấm công" (có thể công ty có chế độ trả công ngày mưa);
//      – NV005 08–12/09: "Đổi phép năm" (có thể là nghỉ phép năm được hưởng lương — khi đó phải tạo đơn Nghỉ phép năm, không phải xóa giờ).
//    Muốn sửa luôn nhóm này (sau khi đã hỏi): thêm --gom-ca-nhom-can-hoi.
const TARGETS_CLEAR = [
  ['2026-08-19', 'NV014'], ['2026-08-19', 'NV017'], ['2026-09-09', 'NV014'], ['2026-09-23', 'NV016'], ['2026-09-28', 'NV004'], ['2026-10-06', 'NV019'],
];
const TARGETS_ASK = [
  ['2026-08-20', 'NV009'],
  ['2026-09-08', 'NV005'], ['2026-09-09', 'NV005'], ['2026-09-10', 'NV005'], ['2026-09-11', 'NV005'], ['2026-09-12', 'NV005'],
];
const TARGETS = args['gom-ca-nhom-can-hoi'] ? [...TARGETS_CLEAR, ...TARGETS_ASK] : TARGETS_CLEAR;
const STD = new Set(['07:30', '11:30', '13:00', '17:00']);
const real = (v) => v && v !== '--:--' && v !== 'OFF' && v !== '';
const hasEvidence = (a) => !!(a.photo_in || a.photo_out || a.coords_in || a.coords_out || a.location_in || a.location_out ||
  Object.values(a.punch_meta || {}).some((m) => m && (m.photo || m.coords || m.location)));
const NON_REAL = ['Báo cáo nghỉ ca', 'Báo cáo lỗi chấm ra ca', 'Báo cáo lỗi hệ thống chấm công', 'Yêu cầu xét duyệt công'];

const { data: leaves, error: lvErr } = await sb.from('hrm_leaves').select('id,emp_id,type,shift,from_date,to_date,status').eq('company_id', CID);
if (lvErr) die('Không đọc được hrm_leaves: ' + lvErr.message);

const ok = [], skipped = [];
for (const [date, emp] of TARGETS) {
  const { data: a } = await sb.from('attendance_records').select('*').eq('company_id', CID).eq('emp_id', emp).eq('date', date).maybeSingle();
  const why = [];
  if (!a) why.push('không có bản ghi chấm công');
  else {
    if (a.method !== 'Duyệt công') why.push(`kiểu chấm công là "${a.method}" (không phải do duyệt tạo ra)`);
    if (hasEvidence(a)) why.push('có ảnh/tọa độ chấm thật');
    const times = [a.time_in_s, a.time_out_s, a.time_in_c, a.time_out_c].filter(real);
    if (times.length === 0) why.push('không còn giờ nào (đã sạch)');
    if (times.some((t) => !STD.has(t))) why.push('có giờ không phải giờ chuẩn (có thể là giờ thật)');
    if (a.is_locked && !args['ca-ban-ghi-da-chot']) why.push('bản ghi đã chốt công (thêm --ca-ban-ghi-da-chot nếu chắc chắn)');
  }
  const reps = leaves.filter((l) => l.emp_id === emp && l.type === 'Báo cáo nghỉ ca' && l.status === 'approved' && l.from_date === date);
  const shifts = new Set(reps.map((l) => l.shift));
  if (!(shifts.has('morning') && shifts.has('afternoon'))) why.push('không có "Báo cáo nghỉ ca" đã duyệt cho CẢ HAI ca');
  const cover = leaves.find((l) => l.emp_id === emp && l.status === 'approved' && !NON_REAL.includes(l.type) && date >= l.from_date && date <= l.to_date);
  if (cover) why.push(`đã có đơn "${cover.type}" phủ ngày này`);
  (why.length ? skipped : ok).push({ date, emp, a, why });
}

console.log(`${args.ghi ? '▶ SỬA THẬT' : '▶ CHẠY THỬ (không ghi gì)'} — ${co.name}`);
console.log(`\nSẼ SỬA ${ok.length}/${TARGETS.length} ngày–người${args['gom-ca-nhom-can-hoi'] ? ' (kể cả nhóm CẦN HỎI)' : ' (nhóm RÕ RÀNG; nhóm cần hỏi chưa gồm)'}:`);
for (const r of ok) console.log(`  ${r.date} ${r.emp}: S ${r.a.time_in_s}–${r.a.time_out_s} | C ${r.a.time_in_c}–${r.a.time_out_c}  →  trống  (công 0,5 → 0)`);
if (skipped.length) { console.log(`\nBỎ QUA ${skipped.length}:`); for (const r of skipped) console.log(`  ${r.date} ${r.emp}: ${r.why.join('; ')}`); }

// Bảng lương cần tính lại (không tự đổi)
const months = [...new Set(ok.map((r) => `${r.date.slice(5, 7)}/${r.date.slice(0, 4)}`))];
const { data: pr } = await sb.from('hrm_payroll_records').select('emp_id,month,worked_days,status,locked').eq('company_id', CID);
console.log('\nBẢNG LƯƠNG CẦN TÍNH LẠI SAU KHI SỬA (script KHÔNG đụng vào bảng lương):');
for (const emp of [...new Set(ok.map((r) => r.emp))]) for (const m of months) {
  const days = ok.filter((r) => r.emp === emp && `${r.date.slice(5, 7)}/${r.date.slice(0, 4)}` === m).length; if (!days) continue;
  const p = (pr || []).find((x) => x.emp_id === emp && x.month === m);
  console.log(`  ${emp} tháng ${m}: giảm ${days * 0.5} công  |  ${p ? `đang ${p.worked_days} công, ${p.status}, ${p.locked ? 'ĐÃ KHÓA (phải mở khóa)' : 'chưa khóa'}` : 'chưa có bảng lương'}`);
}
if (!args.ghi) { console.log('\nCHẠY THỬ: chưa ghi gì. Thêm --ghi để sửa thật.'); process.exit(0); }
if (ok.length === 0) die('Không có ngày nào đủ điều kiện để sửa.');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const phrase = 'SUA-GIO-AO';
const ans = await rl.question(`\nSẽ xóa giờ ảo của ${ok.length} ngày–người (có sao lưu trước). Gõ đúng "${phrase}" để tiếp tục: `);
rl.close();
if (ans.trim() !== phrase) die('Không đúng cụm xác nhận — dừng, chưa ghi gì.');

const dir = path.join('migration-snapshot', `sua-gio-ao-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'sao-luu.json'), JSON.stringify(ok.map((r) => r.a), null, 1));   // sao lưu NGUYÊN bản ghi trước khi sửa
console.log(`Đã sao lưu ${ok.length} bản ghi vào ${dir}/sao-luu.json`);

let done = 0;
for (const r of ok) {
  const { error } = await sb.from('attendance_records').update({ time_in_s: '--:--', time_out_s: '--:--', time_in_c: '--:--', time_out_c: '--:--' }).eq('company_id', CID).eq('id', r.a.id);
  if (error) { console.error(`  ✗ ${r.date} ${r.emp}: ${error.message}`); continue; }
  const { data: chk } = await sb.from('attendance_records').select('time_in_s,time_out_s,time_in_c,time_out_c').eq('company_id', CID).eq('id', r.a.id).single();
  const sach = chk && [chk.time_in_s, chk.time_out_s, chk.time_in_c, chk.time_out_c].every((v) => !real(v));
  if (sach) done++; else console.error(`  ✗ ${r.date} ${r.emp}: kiểm tra sau ghi chưa thấy sạch`);
}
console.log(`\n✅ Đã sửa ${done}/${ok.length} bản ghi. Hoàn tác: node scripts/fix-fake-hours-absence-reports.mjs --khoi-phuc=${dir} --ghi`);
console.log('Việc tiếp theo: tính lại bảng lương các người/tháng ở danh sách phía trên (tháng đã khóa thì mở khóa trước).');
