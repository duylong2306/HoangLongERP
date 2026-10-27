#!/usr/bin/env node
// CHUYỂN ẢNH / TỆP base64 NHÚNG TRONG TIN NHẮN CŨ → Supabase Storage (bucket chat-attachments, migration 20261101).
// Sau khi chuyển, trong tin chỉ còn đường dẫn → mở hội thoại có ảnh hết bị chậm. Ảnh JPEG/PNG/WebP lớn được nén (cùng thông số lib/imageCompress.ts).
// Lõi thuần có test: scripts/lib/chat-attachments-core.mjs
//
// Cần tệp khóa (trong .gitignore, KHÔNG dán vào chat): VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Cần chạy trước migration 20261101_chat_attachments_bucket.sql.
//   1) CHẠY THỬ (mặc định, không ghi gì): node scripts/migrate-chat-attachments-to-storage.mjs --cong-ty=<mã công ty>
//   2) CHUYỂN THẬT (sao lưu ra tệp → tải lên → kiểm tra → sửa tin): ... --cong-ty=<mã công ty> --ghi
//   3) ĐƯỜNG LUI (đưa đính kèm cũ về nguyên trạng):                   node scripts/migrate-chat-attachments-to-storage.mjs --khoi-phuc=<tệp sao lưu>
// Tùy chọn: --env=<tệp> (mặc định .env.staging.local) · BACKUP_DIR=<thư mục> chứa tệp sao lưu (mặc định migration-snapshot/)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { parseDataUrl, extOf, needsMigration, messageNeedsMigration, rebuildAttachments, storagePath } from './lib/chat-attachments-core.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : []; }).filter((x) => x.length));
const BUCKET = 'chat-attachments';
const envFile = typeof args.env === 'string' ? args.env : '.env.staging.local';
const env = {};
for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) { console.error(`Tệp ${envFile} thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.`); process.exit(1); }
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = (r, what) => { if (r.error) { console.error(`LỖI ${what}: ${r.error.message}`); process.exit(1); } return r.data; };
// Tin chứa ảnh base64 nặng hàng MB nên đôi khi đứt kết nối giữa chừng ("terminated") → thử lại tối đa 5 lần, chờ lâu dần
async function retry(fn, what) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= 5) { console.error(`LỖI ${what} sau 5 lần thử: ${e.message}`); process.exit(1); }
      console.log(`  (${what}: ${e.message} — thử lại lần ${i + 1})`);
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}
const kb = (n) => Math.round(n / 1024) + 'KB';
const dir = process.env.BACKUP_DIR || 'migration-snapshot';

// ---- Đường lui ----
if (typeof args['khoi-phuc'] === 'string') {
  const bk = JSON.parse(fs.readFileSync(args['khoi-phuc'], 'utf8'));
  for (const r of bk.rows) {
    must(await sb.from('chat_messages').update({ attachments: r.old }).eq('company_id', bk.companyId).eq('id', r.id), `khôi phục ${r.id}`);
    console.log('đã khôi phục', r.id);
  }
  console.log(`XONG. Đã đưa ${bk.rows.length} tin về nguyên trạng (tệp đã tải lên Storage vẫn còn, không ảnh hưởng).`);
  process.exit(0);
}

const company = typeof args['cong-ty'] === 'string' ? args['cong-ty'] : '';
if (!/^[0-9a-f-]{36}$/i.test(company)) { console.error('Thiếu --cong-ty=<mã công ty (uuid)> hoặc --khoi-phuc=<tệp>.'); process.exit(1); }
const apply = !!args.ghi;
console.log(`Project: ${env.VITE_SUPABASE_URL} · công ty: ${company} · chế độ: ${apply ? 'CHUYỂN THẬT' : 'CHẠY THỬ'}`);

if (apply) { const b = await sb.storage.getBucket(BUCKET); if (b.error) { console.error(`Chưa có bucket "${BUCKET}" — chạy migration 20261101_chat_attachments_bucket.sql trước.`); process.exit(1); } }

// sharp (thư viện nén ảnh) là gói phụ của dự án: có thì nén, không có thì tải lên bản gốc (vẫn đúng, chỉ không nén)
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { console.log('(Không có thư viện sharp → tải lên ảnh gốc, không nén)'); }

// Nén ảnh giống lib/imageCompress.ts: cạnh dài ≤ 1920, JPEG chất lượng 80 (giữ PNG nếu có nền trong suốt); chỉ dùng bản nén nếu NHỎ HƠN và ảnh > 200 KB
async function compress(p) {
  if (!sharp || !['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(p.mime) || p.buf.length <= 200 * 1024) return p;
  try {
    const img = sharp(p.buf, { failOn: 'none' }).rotate().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true });
    const hasAlpha = (await sharp(p.buf).metadata()).hasAlpha;
    const out = hasAlpha ? await img.png().toBuffer() : await img.jpeg({ quality: 80 }).toBuffer();
    return out.length < p.buf.length ? { mime: hasAlpha ? 'image/png' : 'image/jpeg', buf: out } : p;
  } catch { return p; }
}

// Danh sách mã tin có đính kèm (chỉ lấy mã — nhẹ), rồi tải TỪNG tin (mỗi tin có thể nặng hàng MB)
const ids = must(await sb.from('chat_messages').select('id').eq('company_id', company).neq('attachments', '[]').limit(5000), 'liệt kê tin có đính kèm').map((r) => r.id);
console.log(`Tin có đính kèm: ${ids.length}`);
const backup = { companyId: company, at: new Date().toISOString(), rows: [] };
const backupFile = path.join(dir, `backup_chat_attachments_${company}_${backup.at.replace(/[:.]/g, '-')}.json`);
let migrated = 0, before = 0, after = 0;

for (const id of ids) {
  const row = await retry(async () => must(await sb.from('chat_messages').select('id,conversation_id,attachments').eq('company_id', company).eq('id', id).single(), `đọc ${id}`), `đọc ${id}`);
  if (!messageNeedsMigration(row.attachments)) continue;
  const resolved = [];
  let b = 0, a = 0;
  for (let i = 0; i < row.attachments.length; i++) {
    const att = row.attachments[i];
    if (!needsMigration(att)) continue;
    const parsed = parseDataUrl(att.url); if (!parsed) continue;
    b += att.url.length;
    const p = await compress(parsed);
    const hash = crypto.createHash('sha1').update(p.buf).digest('hex').slice(0, 12);
    const filePath = storagePath(company, row.conversation_id, row.id, i, hash, extOf(att.name, p.mime));
    a += p.buf.length;
    if (!apply) { resolved[i] = null; continue; }
    // Tải lên có thử lại (lỗi mạng "fetch failed" hay gặp với tệp lớn); upsert + tên theo nội dung → thử lại hay chạy lại đều an toàn
    await retry(async () => { const r = await sb.storage.from(BUCKET).upload(filePath, p.buf, { contentType: p.mime, upsert: true }); if (r.error) throw new Error(r.error.message); }, `tải lên ${path.basename(filePath)}`);
    resolved[i] = { url: sb.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl, size: p.buf.length };
  }
  console.log(`${row.conversation_id} · ${row.id}: ${row.attachments.filter(needsMigration).length} tệp, ${kb(b)} → ${kb(a)}`);
  before += b; after += a;
  if (!apply) continue;
  // Tệp tải lên phải mở được trước khi sửa tin
  for (const r of resolved) if (r) { const h = await retry(() => fetch(r.url, { method: 'HEAD' }), 'kiểm tra tệp mở được'); if (!h.ok) { console.error(`  DỪNG: ${r.url} không mở được (${h.status}). Chưa sửa tin ${row.id}.`); process.exit(1); } }
  // Chỉ sửa nếu tin chưa bị ai đổi giữa chừng
  const cur = await retry(async () => must(await sb.from('chat_messages').select('attachments').eq('company_id', company).eq('id', id).single(), `đọc lại ${id}`), `đọc lại ${id}`);
  if (JSON.stringify(cur.attachments) !== JSON.stringify(row.attachments)) { console.log('  ⚠ tin đã thay đổi trong lúc chạy → bỏ qua'); continue; }
  fs.mkdirSync(dir, { recursive: true });
  backup.rows.push({ id: row.id, old: row.attachments });
  fs.writeFileSync(backupFile, JSON.stringify(backup));   // ghi sao lưu TRƯỚC khi sửa
  must(await sb.from('chat_messages').update({ attachments: rebuildAttachments(row.attachments, resolved) }).eq('company_id', company).eq('id', id), `sửa ${id}`);
  migrated++;
}
console.log(apply
  ? `\nXONG. Đã chuyển ${migrated} tin; dữ liệu trong tin giảm ${kb(before)} → ~${kb(after)} (tệp trong kho). Tệp sao lưu: ${backupFile}\nĐường lui: node scripts/migrate-chat-attachments-to-storage.mjs --khoi-phuc=${backupFile}`
  : `\n(Chạy thử — chưa ghi gì.) Tổng ${kb(before)} base64 → ~${kb(after)} sau khi nén. Ổn thì chạy lại với --ghi.`);
