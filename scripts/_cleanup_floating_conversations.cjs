// _cleanup_floating_conversations.cjs — Xóa 2 hội thoại dự án RỖNG (không có tin nhắn).
// Chỉ xóa khi conversation THỰC SỰ rỗng (0 tin nhắn) để an toàn.
// FK ON DELETE CASCADE sẽ xóa kèm tin nhắn (nếu có, nhưng ở đây là 0).
// KHÔNG xóa dự án gốc — chỉ xóa nhóm chat.
// Usage: node scripts/_cleanup_floating_conversations.cjs
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

const TARGETS = ['conv_project_proj_1785918446721', 'conv_project_proj_1785981598726'];

async function main() {
  for (const cid of TARGETS) {
    const { count, error } = await sb.from('chat_messages').select('*', { count: 'exact' }).eq('conversation_id', cid);
    if (error) { console.error(`  ${cid}: lỗi đếm tin nhắn: ${error.message}`); continue; }
    console.log(`${cid} => tin nhắn: ${count}`);
    if (count && count > 0) {
      console.log(`  ⚠️ BỎ QUA: hội thoại không rỗng (có ${count} tin nhắn).`);
      continue;
    }
    const del = await sb.from('conversations').delete().eq('id', cid);
    if (del.error) { console.error(`  ❌ XÓA THẤT BẠI: ${del.error.message}`); continue; }
    const { data } = await sb.from('conversations').select('id').eq('id', cid);
    console.log(`  ✅ Đã xóa (còn tồn tại? ${data && data.length ? 'CÓ' : 'KHÔNG'}).`);
  }
  console.log('\nXong. Lưu ý: nếu mở lại dự án tương ứng, nhóm chat sẽ được tạo lại (rỗng) bởi ensureProjectChatGroup.');
}

main().catch(e => { console.error(e); process.exit(1); });
