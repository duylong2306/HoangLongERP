#!/usr/bin/env node
// DI CHUYỂN DỮ LIỆU production Hoàng Long (nhánh main) → 1 doanh nghiệp trên LoLo (nhánh multi-tenant).
// Kế hoạch đầy đủ: docs/ke-hoach-di-chuyen-du-lieu-hoanglong.md   ·   Lõi + giải thích an toàn: scripts/lib/migration-core.mjs
//
// Cần 2 tệp khóa (nằm trong .gitignore, KHÔNG dán khóa vào chat):
//   .env.production.local → VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY của project PRODUCTION  (chỉ được ĐỌC)
//   .env.staging.local    → VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY của project LoLo        (nơi ghi)
//
// Cách dùng:
//   node scripts/migrate-production-to-company.mjs --slug hltest --tao-cong-ty          # CHẠY THỬ (không ghi gì lên LoLo)
//   node scripts/migrate-production-to-company.mjs --slug hltest --tao-cong-ty --ghi     # DIỄN TẬP thật vào công ty thử hltest
//   node scripts/migrate-production-to-company.mjs --slug hoanglong --ghi --xac-nhan-hoanglong   # CHUYỂN CHÍNH THỨC (xóa dữ liệu cũ của hoanglong rồi nạp lại)
// Tùy chọn: --bo-bang=a,b (bỏ thêm bảng) · --snapshot=<thư mục> (mặc định migration-snapshot/<slug>-<giờ>)
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';
import { migrate, parseOpenApi, parseFkMigrations, withRetry, DEFAULT_SKIP_TABLES } from './lib/migration-core.mjs';

// Đọc tham số dạng `--khoa=giatri`, `--khoa giatri` hoặc cờ `--khoa`. Cờ không có giá trị = true.
const FLAGS_BOOL = new Set(['ghi', 'tao-cong-ty', 'xac-nhan-hoanglong']);   // cờ không nhận giá trị đứng sau
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
const die = (msg) => { console.error(`\n⛔ ${msg}\n`); process.exit(1); };

function loadEnv(file) {
  if (!fs.existsSync(file)) die(`Thiếu tệp ${file}.`);
  const e = {};
  for (const l of fs.readFileSync(file, 'utf8').split(/\r?\n/)) { if (l.trim().startsWith('#')) continue; const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) e[m[1]] = m[2].replace(/^['"]|['"]$/g, ''); }
  if (!e.VITE_SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) die(`${file} thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.`);
  return e;
}
const refOf = (url) => new URL(url).hostname.split('.')[0];

const slug = String(args.slug || '');
if (!/^[a-z0-9-]{2,40}$/.test(slug)) die('Thiếu hoặc sai --slug (công ty đích, ví dụ hltest hoặc hoanglong).');
if (args.ghi && slug === 'hoanglong' && !args['xac-nhan-hoanglong']) die('Ghi vào "hoanglong" sẽ XÓA toàn bộ dữ liệu hiện có của công ty này rồi nạp lại. Thêm --xac-nhan-hoanglong nếu chắc chắn.');

const P = loadEnv('.env.production.local'), L = loadEnv('.env.staging.local');
const urls = { prodRef: refOf(P.VITE_SUPABASE_URL), loloRef: refOf(L.VITE_SUPABASE_URL) };
if (urls.prodRef === urls.loloRef) die('Hai tệp khóa trỏ cùng một project — dừng.');
const mk = (E) => createClient(E.VITE_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const prod = mk(P), lolo = mk(L);

async function schemaOf(E) {
  const r = await fetch(E.VITE_SUPABASE_URL + '/rest/v1/', { headers: { apikey: E.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + E.SUPABASE_SERVICE_ROLE_KEY } });
  if (!r.ok) die(`Không đọc được cấu trúc bảng (${r.status}).`);
  return parseOpenApi(await r.json());
}
const prodSchemaAll = await schemaOf(P), loloSchemaAll = await schemaOf(L);
// Chỉ xét các bảng nghiệp vụ = các bảng production có (production không có bảng nền tảng)
const prodSchema = prodSchemaAll, loloSchema = loloSchemaAll;

// Công ty đích
let { data: co, error: coErr } = await lolo.from('companies').select('id, slug').eq('slug', slug).maybeSingle();
if (coErr) die(`Không đọc được bảng companies: ${coErr.message}`);
if (!co) {
  if (!args['tao-cong-ty']) die(`Công ty "${slug}" chưa có trên LoLo. Thêm --tao-cong-ty để tạo công ty thử (không dùng cho hoanglong).`);
  if (slug === 'hoanglong') die('Công ty hoanglong phải có sẵn, không tạo mới.');
  const ins = await lolo.from('companies').insert({ slug, name: `Diễn tập ${slug}`, active: true, expires_at: null, is_trial: false }).select('id, slug').maybeSingle();
  if (ins.error) die(`Không tạo được công ty ${slug}: ${ins.error.message}`);
  co = ins.data; console.log(`Đã tạo công ty thử "${slug}" (id ${co.id}).`);
}

// Storage: liệt kê đệ quy, tải về, tải lên
const prodStorage = prod.storage, loloStorage = lolo.storage;
async function walk(client, bucket, prefix = '') {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await client.from(bucket).list(prefix, { limit: 1000, offset: off });
    if (error) throw new Error(`Storage ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const it of data) {
      const full = prefix ? `${prefix}/${it.name}` : it.name;
      if (it.id === null) out.push(...await walk(client, bucket, full));
      else out.push({ path: full, size: it.metadata?.size ?? 0, contentType: it.metadata?.mimetype || 'application/octet-stream' });
    }
    if (data.length < 1000) break;
  }
  return out;
}
// Mọi thao tác Storage tự thử lại khi mạng chập chờn (đã từng bị "terminated" giữa chừng khi tải tệp lớn)
const retry = (fn) => withRetry(fn, { onRetry: (i, e) => console.log(`  ↻ mạng chập chờn (${String(e.message).slice(0, 60)}) — thử lại lần ${i}...`) });
const storage = {
  listProd: (bucket) => retry(() => walk(prodStorage, bucket)),
  listLolo: (bucket, prefix) => retry(async () => { try { return await walk(loloStorage, bucket, prefix.replace(/\/$/, '')); } catch (e) { if (/not found|does not exist/i.test(e.message)) return []; throw e; } }),
  download: (bucket, p) => retry(async () => { const { data, error } = await prodStorage.from(bucket).download(p); if (error) throw new Error(`Tải ${bucket}/${p}: ${error.message}`); return Buffer.from(await data.arrayBuffer()); }),
  upload: (bucket, key, buf, ct) => retry(async () => { const { error } = await loloStorage.from(bucket).upload(key, buf, { contentType: ct, upsert: true }); if (error) throw new Error(`Tải lên ${bucket}/${key}: ${error.message}`); }),
};

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const snapshotDir = String(args.snapshot || path.join('migration-snapshot', `${slug}-${stamp}`));

if (args.ghi && slug === 'hoanglong') {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await rl.question(`\n⚠️ SẮP XÓA toàn bộ dữ liệu hiện có của "hoanglong" trên LoLo và nạp lại từ production.\n   Gõ đúng chữ  XOA-VA-NAP hoanglong  để tiếp tục: `);
  rl.close();
  if (ans.trim() !== 'XOA-VA-NAP hoanglong') die('Không khớp — đã hủy, chưa ghi gì.');
}

console.log(`\n▶ ${args.ghi ? 'GHI THẬT' : 'CHẠY THỬ (không ghi gì lên LoLo)'} — công ty đích: ${slug} (${co.id})\n  Production: ${urls.prodRef}  →  LoLo: ${urls.loloRef}\n  Thư mục lưu bản xuất/báo cáo: ${snapshotDir}\n`);

// Khóa ngoại ghép của LoLo: đọc từ các tệp migration trong repo (PostgREST không báo)
const extraFks = fs.readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).flatMap(f => parseFkMigrations(fs.readFileSync(path.join('supabase/migrations', f), 'utf8')));

let report;
try {
  report = await migrate({
    prod, lolo, prodSchema, loloSchema, extraFks, storage, target: { id: co.id, slug: co.slug }, urls,
    opts: { ghi: !!args.ghi, snapshotDir, concurrency: Number(args['song-song']) || 4, skipTables: [...DEFAULT_SKIP_TABLES, ...String(args['bo-bang'] || '').split(',').filter(Boolean)] },
    log: (m) => console.log('  ·', m),
  });
} catch (e) {
  report = e.report || { loi: e.message };
  report.loi = report.loi || e.message;
}
fs.mkdirSync(snapshotDir, { recursive: true });
fs.writeFileSync(path.join(snapshotDir, 'bao-cao.json'), JSON.stringify(report, null, 2));

if (report.loi) { console.error(`\n⛔ DỪNG: ${report.loi}\n   (Báo cáo chi tiết: ${path.join(snapshotDir, 'bao-cao.json')})\n`); process.exit(1); }
console.log('\n── Số dòng từng bảng ──');
console.table(Object.entries(report.tables).map(([bang, v]) => ({ bang, production: v.production, ...(v.loLo !== undefined ? { LoLo: v.loLo } : {}) })));
console.log('── Storage ──'); console.table(report.storage);
if (report.canh_bao.length) { console.log('── Cảnh báo ──'); report.canh_bao.forEach(c => console.log('  ⚠️', c)); }
if (report.ghi) {
  console.log('\n── Kiểm chứng ──');
  report.kiem_chung.forEach(k => console.log(`  ${k.ok ? '✅' : '❌'} ${k.ten}${k.chi_tiet ? ' — ' + k.chi_tiet : ''}`));
  console.log(report.dat ? '\n✅ ĐẠT TẤT CẢ kiểm chứng.\n' : '\n❌ CÓ MỤC KHÔNG ĐẠT — xem bao-cao.json, đừng dùng dữ liệu này.\n');
  process.exit(report.dat ? 0 : 1);
}
console.log(`\n${report.ghi_chu}\n`);
