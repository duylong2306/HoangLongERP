// _inspect_chat_createdat.cjs — Kiểm tra format created_at của chat_messages
// Mục đích: xác định vì sao tin nhắn gần đây (5/8 trở lại) không load được.
// Vì created_at là cột TEXT, filter gte() của Supabase là so sánh chuỗi (lexicographic),
// không phải so sánh thời gian. Nếu format không đồng nhất -> lọc sai.
// Usage: node scripts/_inspect_chat_createdat.cjs
const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const { resolve } = require('path');

function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env');
  const raw = readFileSync(envPath, 'utf-8');
  const vars = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    vars[key] = val;
  }
  return vars;
}

const env = loadEnv();
const URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;
if (!URL || !KEY) { console.error('❌ Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY'); process.exit(1); }
const sb = createClient(URL, KEY);

function classifyFormat(s) {
  if (!s) return 'NULL/empty';
  if (s.includes('T') && /Z$/.test(s)) return 'ISO-UTC-Z (e.g. 2026-08-07T13:00:00.000Z)';
  if (s.includes('T') && /[+-]\d{2}:\d{2}$/.test(s)) return 'ISO-offset (e.g. 2026-08-07T20:00:00+07:00)';
  if (s.includes('T') && !/Z$/.test(s)) return 'ISO-no-tz (e.g. 2026-08-07T13:00:00)';
  if (s.includes(' ') && /\d{2}:\d{2}/.test(s)) return 'SPACE-format (e.g. 2026-08-07 13:00:00)';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'DATE-only (e.g. 2026-08-07)';
  return 'OTHER: ' + s;
}

async function main() {
  console.log('Đang lấy mẫu chat_messages...');
  const { data, error } = await sb
    .from('chat_messages')
    .select('id, conversation_id, created_at, sender_name')
    .order('created_at', { ascending: false })
    .limit(3000);

  if (error) { console.error('❌ Query error:', error.message); process.exit(1); }
  if (!data || data.length === 0) { console.log('⚠️ Không có tin nhắn nào.'); return; }

  console.log(`\n=== TỔNG: ${data.length} dòng (mẫu mới nhất trước) ===\n`);

  // Phân loại format created_at
  const fmtCount = {};
  for (const m of data) {
    const f = classifyFormat(m.created_at);
    fmtCount[f] = (fmtCount[f] || 0) + 1;
  }
  console.log('--- Format created_at (phân bố) ---');
  for (const [k, v] of Object.entries(fmtCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(5)}  ${k}`);
  }

  // Phân bố theo ngày (prefix YYYY-MM-DD)
  const byDate = {};
  for (const m of data) {
    const d = (m.created_at || '').slice(0, 10);
    byDate[d] = (byDate[d] || 0) + 1;
  }
  console.log('\n--- Số tin nhắn theo ngày (top 20 mới nhất) ---');
  const dates = Object.keys(byDate).sort().reverse().slice(0, 20);
  for (const d of dates) console.log(`  ${d}  ${String(byDate[d]).padStart(5)}`);

  // So sánh: lọc bằng gte('created_at', fromIso) (string so sánh) vs lọc bằng Date thực tế
  // Giả lập fromIso = 2 ngày trước (UTC) như code MessagesView
  const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
  const fromIso = new Date(Date.now() - TWO_DAYS).toISOString();
  console.log(`\n--- Giả lập lazy-load: fromIso = ${fromIso} ---`);
  let viaStringGte = 0, viaRealDate = 0;
  for (const m of data) {
    if (m.created_at >= fromIso) viaStringGte++;          // cách Supabase TEXT gte hoạt động
    const t = new Date(m.created_at).getTime();
    if (!isNaN(t) && t >= Date.now() - TWO_DAYS) viaRealDate++; // cách đúng theo thời gian
  }
  console.log(`  Qua string comparison (Supabase TEXT gte): ${viaStringGte} tin nhắn >= fromIso`);
  console.log(`  Qua Date thực tế (đúng):                     ${viaRealDate} tin nhắn trong 2 ngày qua`);
  if (viaStringGte !== viaRealDate) {
    console.log(`  ⚠️ CHÊNH LỆCH: string gte bỏ sót ${viaRealDate - viaStringGte} tin nhắn gần đây!`);
  }

  // In 10 dòng có created_at "lạ" (không phải ISO-UTC-Z)
  const weird = data.filter(m => classifyFormat(m.created_at) !== 'ISO-UTC-Z (e.g. 2026-08-07T13:00:00.000Z)').slice(0, 15);
  if (weird.length) {
    console.log('\n--- 15 dòng created_at KHÔNG phải ISO-UTC-Z (có thể gây lỗi lọc) ---');
    weird.forEach((m, i) => console.log(`  [${i + 1}] ${m.created_at}  | fmt=${classifyFormat(m.created_at)} | conv=${m.conversation_id}`));
  }

  // Kiểm tra 1 conversation cụ thể gần nhất
  const newest = data[0];
  console.log(`\n--- Conversation mới nhất theo created_at: ${newest.conversation_id} ---`);
  const { data: convMsgs, error: e2 } = await sb
    .from('chat_messages')
    .select('id, created_at, sender_name, content')
    .eq('conversation_id', newest.conversation_id)
    .order('created_at', { ascending: false })
    .limit(10);
  if (e2) { console.error('err', e2.message); }
  else {
    console.log(`  ${convMsgs.length} tin nhắn mới nhất của conversation này:`);
    convMsgs.forEach((m, i) => console.log(`    [${i + 1}] ${m.created_at} | ${m.sender_name}: ${(m.content || '').slice(0, 40)}`));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
