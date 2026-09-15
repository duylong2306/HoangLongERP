// _inspect_floating_conversations.cjs — Tìm "hội thoại trôi nổi":
//  1) Tin nhắn có conversation_id KHÔNG tồn tại trong bảng conversations (orphan messages)
//  2) Conversations KHÔNG có tin nhắn nào (dead/empty)
//  3) conversations.last_message_at KHÔNG khớp với tin nhắn mới nhất thực tế
// Usage: node scripts/_inspect_floating_conversations.cjs
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

async function getAll(table, columns) {
  let all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  console.log('Đang tải conversations và chat_messages...\n');
  const convs = await getAll('conversations', 'id, type, name, last_message_at, participant_ids, pinned');
  const msgs = await getAll('chat_messages', 'id, conversation_id, created_at, content, sender_name');

  const convIds = new Set(convs.map(c => c.id));
  console.log(`Tổng conversations: ${convs.length}`);
  console.log(`Tổng chat_messages: ${msgs.length}\n`);

  // (1) Orphan messages: conversation_id không có trong conversations
  const orphanMsgConvIds = new Set();
  const orphanMsgs = [];
  for (const m of msgs) {
    if (!convIds.has(m.conversation_id)) {
      orphanMsgConvIds.add(m.conversation_id);
      orphanMsgs.push(m);
    }
  }
  console.log('=== (1) TIN NHẮN TRÔI NỔI (conversation_id không tồn tại) ===');
  if (orphanMsgs.length === 0) {
    console.log('  ✅ Không có (FK đang phát huy tác dụng, mọi message đều có conversation).');
  } else {
    console.log(`  ⚠️ CÓ ${orphanMsgs.length} tin nhắn trôi nổi, thuộc ${orphanMsgConvIds.size} conversation_id giả:`);
    [...orphanMsgConvIds].forEach(cid => {
      const list = orphanMsgs.filter(m => m.conversation_id === cid);
      console.log(`    - ${cid} (${list.length} tin nhắn, mới nhất: ${list[list.length-1]?.created_at})`);
    });
  }

  // (2) Conversations không có tin nhắn nào (dead/empty)
  const msgCountByConv = {};
  const latestByConv = {};
  for (const m of msgs) {
    msgCountByConv[m.conversation_id] = (msgCountByConv[m.conversation_id] || 0) + 1;
    if (!latestByConv[m.conversation_id] || m.created_at > latestByConv[m.conversation_id]) {
      latestByConv[m.conversation_id] = m.created_at;
    }
  }
  const dead = convs.filter(c => !msgCountByConv[c.id]);
  console.log('\n=== (2) CONVERSATIONS KHÔNG CÓ TIN NHẮN (dead/empty) ===');
  if (dead.length === 0) {
    console.log('  ✅ Mọi conversation đều có ít nhất 1 tin nhắn.');
  } else {
    console.log(`  ⚠️ CÓ ${dead.length} conversation rỗng:`);
    dead.forEach(c => console.log(`    - ${c.id} | type=${c.type} | name=${c.name} | last_message_at=${c.last_message_at}`));
  }

  // (3) last_message_at không khớp với tin nhắn mới nhất
  console.log('\n=== (3) last_message_at KHÔNG KHỚP với tin nhắn mới nhất ===');
  let mismatch = 0;
  for (const c of convs) {
    const actual = latestByConv[c.id]; // undefined nếu không có tin nhắn (đã liệt kê ở (2))
    if (!actual) continue;
    const stored = c.last_message_at || null;
    if (stored !== actual) {
      mismatch++;
      if (mismatch <= 25) {
        console.log(`    - ${c.id}\n        stored : ${stored}\n        actual : ${actual}`);
      }
    }
  }
  if (mismatch === 0) console.log('  ✅ Tất cả last_message_at khớp với tin nhắn mới nhất.');
  else console.log(`  ⚠️ CÓ ${mismatch} conversation có last_message_at sai lệch.`);

  // Tóm tắt phân bố số tin nhắn / conversation
  console.log('\n=== Phân bố số tin nhắn theo conversation (top 15 nhiều nhất) ===');
  const ranked = convs
    .map(c => ({ id: c.id, type: c.type, n: msgCountByConv[c.id] || 0 }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 15);
  ranked.forEach(r => console.log(`    ${String(r.n).padStart(4)}  [${r.type}]  ${r.id}`));
}

main().catch(e => { console.error(e); process.exit(1); });
