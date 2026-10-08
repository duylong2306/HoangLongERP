#!/usr/bin/env node
// NÉN HÀNG LOẠT ẢNH CŨ trong Storage của 1 doanh nghiệp trên LoLo (ảnh tải lên TRƯỚC khi có tính năng nén tự động).
// Bối cảnh: ảnh báo cáo nhiệm vụ của Hoàng Long ~1,26 GB / 836 tệp (trung bình 1,5 MB, lớn nhất 13 MB).
//
// AN TOÀN:
//   • Mặc định CHẠY THỬ: tải ảnh về, tính xem nén được bao nhiêu, KHÔNG ghi gì lên Storage.
//   • Ghi đè GIỮ NGUYÊN đường dẫn + định dạng + loại nội dung → địa chỉ ảnh (URL) trong cơ sở dữ liệu không đổi, không hỏng liên kết.
//   • Trước khi ghi đè từng tệp: SAO LƯU bản gốc ra ổ đĩa (migration-snapshot/nen-anh-<giờ>/…, nằm trong .gitignore + .vercelignore).
//   • Chỉ thay khi bản nén nhỏ hơn bản gốc ít nhất 15%. Sau khi ghi: tải lại kiểm tra đúng kích thước; sai → khôi phục ngay bản gốc.
//   • Chỉ đụng JPEG/PNG/WebP; GIF/SVG/PDF/Word/video bỏ qua. Chỉ trong thư mục <company_id>/ của doanh nghiệp được chọn.
//   • Hoàn tác: --khoi-phuc=<thư mục sao lưu> --ghi (tải lại bản gốc từ ổ đĩa lên đúng đường dẫn cũ).
//
// Cần: .env.staging.local (VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY của LoLo) và gói sharp (cài tạm: npm i --no-save sharp).
// Dùng:
//   node scripts/compress-storage-images.mjs --slug hoanglong                  # chạy thử toàn bộ
//   node scripts/compress-storage-images.mjs --slug hoanglong --limit 20        # chạy thử 20 tệp lớn nhất
//   node scripts/compress-storage-images.mjs --slug hoanglong --ghi             # nén thật (hỏi gõ lại cụm xác nhận)
//   node scripts/compress-storage-images.mjs --slug hoanglong --khoi-phuc=migration-snapshot/nen-anh-... --ghi
// Tùy chọn: --buckets=a,b · --min-kb=300 (bỏ qua tệp nhỏ hơn) · --max-edge=1920 · --quality=80 · --limit=N
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';

const FLAGS_BOOL = new Set(['ghi']);
const args = {};
{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const m = argv[i].match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) continue;
    if (m[2] !== undefined) args[m[1]] = m[2];
    else if (!FLAGS_BOOL.has(m[1]) && argv[i + 1] && !argv[i + 1].startsWith('--')) args[m[1]] = argv[++i];
    else args[m[1]] = true;
  }
}
const die = (m) => { console.error(`\n⛔ ${m}\n`); process.exit(1); };
const fmtMB = (b) => (b / 1048576).toFixed(1) + ' MB';

function loadEnv(file) {
  if (!fs.existsSync(file)) die(`Thiếu tệp ${file}.`);
  const e = {};
  for (const l of fs.readFileSync(file, 'utf8').split(/\r?\n/)) { if (l.trim().startsWith('#')) continue; const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) e[m[1]] = m[2].replace(/^['"]|['"]$/g, ''); }
  if (!e.VITE_SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) die(`${file} thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.`);
  return e;
}

const slug = String(args.slug || '');
if (!slug) die('Thiếu --slug <doanh nghiệp> (VD --slug hoanglong).');
const env = loadEnv('.env.staging.local');
// Chốt chặn: tuyệt đối không chạy nhầm lên production cũ
const refOf = (u) => new URL(u).hostname.split('.')[0];
if (fs.existsSync('.env.production.local') && refOf(loadEnv('.env.production.local').VITE_SUPABASE_URL) === refOf(env.VITE_SUPABASE_URL)) die('Project đích trùng production cũ — dừng.');
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const BUCKETS = String(args.buckets || 'mission-report-images,quote-images,avatars,product-catalog-images').split(',').map(s => s.trim()).filter(Boolean);
const MIN_BYTES = Number(args['min-kb'] ?? 300) * 1024;
const MAX_EDGE = Number(args['max-edge'] ?? 1920);
const QUALITY = Number(args.quality ?? 80);
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const MIN_SAVING = 0.15;           // chỉ thay khi nhỏ hơn ≥ 15%
const CONCURRENCY = 3;

const { data: co, error: coErr } = await sb.from('companies').select('id,slug,name').eq('slug', slug).single();
if (coErr || !co) die(`Không tìm thấy doanh nghiệp "${slug}".`);

// ─── Chế độ KHÔI PHỤC từ thư mục sao lưu ───
if (args['khoi-phuc']) {
  const dir = String(args['khoi-phuc']);
  if (!fs.existsSync(dir)) die(`Không thấy thư mục sao lưu ${dir}.`);
  const files = [];
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name !== 'bao-cao.json') files.push(p); } };
  walk(dir);
  console.log(`▶ KHÔI PHỤC ${files.length} tệp từ ${dir} lên LoLo (${co.name}) ${args.ghi ? '' : '— CHẠY THỬ (không ghi)'}`);
  if (!args.ghi) process.exit(0);
  let ok = 0;
  for (const f of files) {
    const rel = path.relative(dir, f).split(path.sep);
    const bucket = rel[0], objPath = rel.slice(1).join('/');
    if (!objPath.startsWith(co.id + '/')) { console.warn('  bỏ qua (không thuộc doanh nghiệp này):', objPath); continue; }
    const ext = path.extname(f).toLowerCase();
    const type = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const { error } = await sb.storage.from(bucket).upload(objPath, fs.readFileSync(f), { contentType: type, upsert: true });
    if (error) console.error('  ✗', bucket, objPath, error.message); else ok++;
  }
  console.log(`✅ Đã khôi phục ${ok}/${files.length} tệp.`);
  process.exit(0);
}

let sharp;
try { sharp = (await import('sharp')).default; } catch { die('Thiếu gói sharp. Cài tạm bằng: npm i --no-save sharp'); }

// ─── Liệt kê tệp ảnh của doanh nghiệp ───
async function walk(bucket, prefix, acc) {
  for (let off = 0; ; off += 1000) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000, offset: off });
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
    if (!data?.length) break;
    for (const o of data) {
      if (o.id === null) await walk(bucket, `${prefix}/${o.name}`, acc);
      else acc.push({ bucket, path: `${prefix}/${o.name}`, size: o.metadata?.size || 0, mime: o.metadata?.mimetype || '' });
    }
    if (data.length < 1000) break;
  }
}
const all = [];
for (const b of BUCKETS) { try { await walk(b, co.id, all); } catch (e) { console.warn('⚠️ ', e.message); } }
const typeOf = (f) => {
  const ext = path.extname(f.path).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'jpeg';
  if (ext === '.png') return 'png';
  if (ext === '.webp') return 'webp';
  return null;
};
const candidates = all.filter(f => typeOf(f) && f.size >= MIN_BYTES).sort((a, b) => b.size - a.size).slice(0, LIMIT);
const totalAll = all.reduce((s, f) => s + f.size, 0);
console.log(`${args.ghi ? '▶ NÉN THẬT' : '▶ CHẠY THỬ (không ghi gì)'} — ${co.name} (${slug}) trên LoLo`);
console.log(`  Tổng ${all.length} tệp / ${fmtMB(totalAll)} ở ${BUCKETS.join(', ')}; cần xét ${candidates.length} ảnh ≥ ${MIN_BYTES / 1024} KB (${fmtMB(candidates.reduce((s, f) => s + f.size, 0))}).`);
if (candidates.length === 0) process.exit(0);

let backupDir = null;
if (args.ghi) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const phrase = `NEN-ANH ${slug}`;
  const ans = await rl.question(`\nSẽ GHI ĐÈ ${candidates.length} ảnh trên Storage của "${co.name}" (có sao lưu bản gốc ra ổ đĩa trước). Gõ đúng "${phrase}" để tiếp tục: `);
  rl.close();
  if (ans.trim() !== phrase) die('Không đúng cụm xác nhận — dừng, chưa ghi gì.');
  backupDir = args.snapshot ? String(args.snapshot) : path.join('migration-snapshot', `nen-anh-${slug}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`);
  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`  Sao lưu bản gốc vào: ${backupDir}`);
}

// ─── Nén (giữ định dạng/đường dẫn) ───
async function compress(buf, kind) {
  let p = sharp(buf, { failOn: 'none' }).rotate()   // rotate() = xoay đúng chiều theo EXIF rồi bỏ cờ xoay (tránh ảnh nghiêng)
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true });
  if (kind === 'jpeg') p = p.jpeg({ quality: QUALITY, mozjpeg: true });
  else if (kind === 'png') p = p.png({ compressionLevel: 9, effort: 7 });
  else p = p.webp({ quality: QUALITY });
  return p.toBuffer();
}
// Thử lại tối đa 3 lần khi lỗi mạng thoáng qua (VD "terminated", "fetch failed") — chờ 1s, 2s giữa các lần
const withRetry = async (fn, tries = 3) => {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) { if (i >= tries) throw e; await new Promise(r => setTimeout(r, i * 1000)); }
  }
};
const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

const report = [];
let before = 0, after = 0, changed = 0, skipped = 0, failed = 0, done = 0;
async function handle(f) {
  const kind = typeOf(f);
  try {
    const orig = await withRetry(async () => {
      const { data: blob, error } = await sb.storage.from(f.bucket).download(f.path);
      if (error) throw new Error('tải về: ' + error.message);
      return Buffer.from(await blob.arrayBuffer());
    });
    const out = await compress(orig, kind);
    before += orig.length;
    if (out.length > orig.length * (1 - MIN_SAVING)) { after += orig.length; skipped++; report.push({ ...f, action: 'giữ', before: orig.length, after: orig.length }); return; }
    after += out.length;
    if (args.ghi) {
      // 1) sao lưu bản gốc  2) ghi đè  3) tải lại kiểm tra; sai → khôi phục
      const bp = path.join(backupDir, f.bucket, f.path);
      fs.mkdirSync(path.dirname(bp), { recursive: true });
      fs.writeFileSync(bp, orig);
      await withRetry(async () => {
        const { error: upErr } = await sb.storage.from(f.bucket).upload(f.path, out, { contentType: MIME[kind], upsert: true, cacheControl: '3600' });
        if (upErr) throw new Error('ghi đè: ' + upErr.message);
      });
      // Kiểm tra bằng địa chỉ CÔNG KHAI + tham số chống bộ nhớ đệm. KHÔNG dùng storage.download(): hàm đó trả về BẢN CŨ còn nằm trong bộ nhớ đệm
      // ngay sau khi ghi đè (đã thử: ghi đè 300000→50000 byte nhưng download() vẫn đọc ra 300000) → sẽ báo sai và khôi phục nhầm.
      const pub = sb.storage.from(f.bucket).getPublicUrl(f.path).data.publicUrl;
      let okSize = false;
      try {
        okSize = await withRetry(async () => {
          const resp = await fetch(`${pub}?nocache=${Date.now()}_${Math.random().toString(36).slice(2)}`);
          return resp.ok && (await resp.arrayBuffer()).byteLength === out.length;
        }, 2);
      } catch { okSize = false; }
      if (!okSize) {
        await withRetry(() => sb.storage.from(f.bucket).upload(f.path, orig, { contentType: MIME[kind], upsert: true }));
        throw new Error('kiểm tra sau ghi không khớp — đã khôi phục bản gốc');
      }
    }
    changed++; report.push({ ...f, action: args.ghi ? 'đã nén' : 'sẽ nén', before: orig.length, after: out.length });
  } catch (e) {
    failed++; report.push({ ...f, action: 'lỗi', error: String(e.message || e) });
    console.error(`  ✗ ${f.bucket}/${f.path}: ${e.message || e}`);
  } finally {
    done++;
    if (done % 25 === 0 || done === candidates.length) process.stdout.write(`  … ${done}/${candidates.length}\r`);
  }
}
const queue = [...candidates];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => { for (let f; (f = queue.shift());) await handle(f); }));
console.log('');

console.log(`\n── Kết quả ${args.ghi ? '' : '(ước tính, chưa ghi)'} ──`);
console.log(`  Nén được: ${changed} ảnh · giữ nguyên (nén không lợi): ${skipped} · lỗi: ${failed}`);
console.log(`  Dung lượng các ảnh đã xét: ${fmtMB(before)} → ${fmtMB(after)}  (tiết kiệm ${fmtMB(before - after)}, ${before ? Math.round((1 - after / before) * 100) : 0}%)`);
const dir = backupDir || path.join('migration-snapshot', `nen-anh-bao-cao-${slug}`);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'bao-cao.json'), JSON.stringify(report, null, 1));
console.log(`  Báo cáo chi tiết: ${path.join(dir, 'bao-cao.json')}`);
if (!args.ghi) console.log('\nCHẠY THỬ: chưa ghi gì. Thêm --ghi để nén thật.');
else console.log(`\n✅ Xong. Bản gốc đã sao lưu ở ${backupDir}. Hoàn tác: node scripts/compress-storage-images.mjs --slug ${slug} --khoi-phuc=${backupDir} --ghi`);
