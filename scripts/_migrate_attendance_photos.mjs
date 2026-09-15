// ─────────────────────────────────────────────────────────────────────────────
// Di dời ảnh chấm công CŨ (base64 data URL trong attendance_records) lên Storage.
//
// CHẠY SAU KHI: migration 029_attendance_photos_to_storage.sql đã được áp trên
// Supabase SQL Editor (tạo bucket 'attendance-photos' + policies).
//
// CÁCH CHẠY:
//   node scripts/_migrate_attendance_photos.mjs
//
// ĐIỀU GÌ XẢY RA:
//   * Đọc mọi attendance_records có ảnh base64 trong photo_in / photo_out /
//     punch_meta.photo.
//   * Với mỗi ảnh: decode base64 → upload lên 'attendance-photos' với tên object
//     UUID ngẫu nhiên (không lộ mã NV / ngày, khó đoán URL).
//   * Chỉ khi upload THÀNH CÔNG mới update dòng: thay base64 bằng public URL.
//   * Upload thất bại → GIỮ NGUYÊN base64 (không mất dữ liệu, log để xem lại).
//
// Dùng anon key từ .env (public). Không cần service_role — bucket có policy cho anon.
// Đây là thao tác GHI vào production: nên chạy 1 lần, ngoài giờ cao điểm.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnv(p) {
  const env = {};
  try {
    const txt = fs.readFileSync(path.join(root, p), 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?(.*?)"?\s*$/.exec(line);
      if (m) env[m[1]] = m[2];
    }
  } catch { /* không có file */ }
  return env;
}

const env = { ...loadEnv('.env'), ...process.env };
const URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;
const BUCKET = 'attendance-photos';

if (!URL || !KEY) {
  console.error('Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY trong .env');
  process.exit(1);
}

const sb = createClient(URL, KEY);

// ── Helpers ảnh ─────────────────────────────────────────────────────────────
const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s;

/** Bóc base64 từ data URL; trả { mime, buffer } hoặc null. */
function decodeDataUrl(s) {
  if (typeof s !== 'string') return null;
  const m = DATA_URL_RE.exec(s);
  if (!m) return null;
  try {
    return { mime: m[1], buffer: Buffer.from(m[2], 'base64') };
  } catch {
    return null;
  }
}

/** Có phải ảnh đã là public URL (không cần chuyển)? */
function isAlreadyUrl(s) {
  return typeof s === 'string' && !s.startsWith('data:');
}

const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

/** Upload 1 buffer lên bucket, trả public URL hoặc null. */
async function uploadPhoto(buf, mime) {
  const ext = EXT_BY_MIME[mime] || 'jpg';
  const name = `${crypto.randomUUID()}.${ext}`;
  const path = `attendance/${name}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, buf, {
    contentType: mime,
    upsert: false,
  });
  if (error) {
    console.warn(`    ⚠️ Upload thất bại ${path}: ${error.message}`);
    return null;
  }
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Thu thập mọi ảnh base64 trong 1 dòng. */
function collectBase64Photos(row) {
  const out = [];
  const push = (field, dataUrl, slotKey) => {
    const dec = decodeDataUrl(dataUrl);
    if (dec) out.push({ field, slotKey, dataUrl, mime: dec.mime, buffer: dec.buffer });
  };
  if (row.photo_in) push('photo_in', row.photo_in);
  if (row.photo_out) push('photo_out', row.photo_out);
  if (row.punch_meta && typeof row.punch_meta === 'object') {
    for (const [slot, entry] of Object.entries(row.punch_meta)) {
      if (entry && typeof entry === 'object' && entry.photo) push('punch_meta', entry.photo, slot);
    }
  }
  return out;
}

// ── Chạy ────────────────────────────────────────────────────────────────────
console.log(`Bucket: ${BUCKET}`);
console.log('Đọc attendance_records...');

const { data: rows, error: listErr } = await sb
  .from('attendance_records')
  .select('id, photo_in, photo_out, punch_meta');

if (listErr) {
  console.error('Lỗi đọc attendance_records:', listErr.message);
  process.exit(1);
}

console.log(`Tổng số dòng: ${rows?.length ?? 0}`);

let rowsChanged = 0;
let photosUploaded = 0;
let failures = 0;

for (const row of rows || []) {
  const photos = collectBase64Photos(row);
  if (photos.length === 0) continue;

  const uploaded = {};
  for (const p of photos) {
    const key = p.slotKey ? `slot:${p.slotKey}` : `field:${p.field}`;
    if (uploaded[key]) continue;
    const url = await uploadPhoto(p.buffer, p.mime);
    if (!url) { failures++; continue; }
    uploaded[key] = url;
    photosUploaded++;
  }

  // Chỉ update nếu upload được ÍT NHẤT 1 ảnh của dòng (không đụng gì nếu fail hết)
  const urlKeys = Object.keys(uploaded);
  if (urlKeys.length === 0) continue;

  const patch = { id: row.id };
  let punchMeta = row.punch_meta;

  for (const p of photos) {
    const url = uploaded[p.slotKey ? `slot:${p.slotKey}` : `field:${p.field}`];
    if (!url) continue;
    if (p.slotKey) {
      // punch_meta: thay photo của slot bằng URL
      if (!punchMeta || typeof punchMeta !== 'object') punchMeta = {};
      const entry = { ...(punchMeta[p.slotKey] || {}) };
      entry.photo = url;
      punchMeta[p.slotKey] = entry;
    } else {
      patch[p.field] = url;
    }
  }
  if (punchMeta) patch.punch_meta = punchMeta;

  const { error: updErr } = await sb.from('attendance_records').update(patch).eq('id', row.id);
  if (updErr) {
    console.warn(`  ❌ Update dòng ${row.id} lỗi: ${updErr.message}`);
    failures++;
  } else {
    rowsChanged++;
    console.log(`  ✅ ${row.id}: ${urlKeys.length} ảnh → storage`);
  }
}

console.log('\n── KẾT QUẢ ──');
console.log(`  Dòng đã chuyển sang URL: ${rowsChanged}`);
console.log(`  Ảnh đã upload lên Storage: ${photosUploaded}`);
console.log(`  Lần thất bại (giữ base64): ${failures}`);
console.log('\nXONG. Nếu failures > 0, hãy chạy lại script (idempotent — ảnh đã upload sẽ bỏ qua vì không còn base64).');
