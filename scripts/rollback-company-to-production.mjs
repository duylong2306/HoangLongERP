#!/usr/bin/env node
// ĐƯỜNG LUI: đưa dữ liệu doanh nghiệp trên LoLo QUAY VỀ production Hoàng Long cũ (nhánh main).
// Kế hoạch: docs/ke-hoach-di-chuyen-du-lieu-hoanglong.md · Lõi + giải thích an toàn: scripts/lib/rollback-core.mjs
//
// Cần 2 tệp khóa (.gitignore, KHÔNG dán vào chat):
//   .env.staging.local     → VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY của LoLo        (chỉ ĐỌC)
//   .env.production.local  → VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY của PRODUCTION (nơi ghi khi dùng --ghi)
//
// Dùng:
//   node scripts/rollback-company-to-production.mjs --slug hoanglong
//        CHẠY THỬ (mặc định): chỉ liệt kê "từ lúc chuyển đến nay LoLo khác production những gì" — KHÔNG ghi gì. Dùng được bất cứ lúc nào
//        để theo dõi tuần thử nghiệm.
//   node scripts/rollback-company-to-production.mjs --slug hoanglong --ghi --xac-nhan-production
//        GHI THẬT vào production (có sao lưu production trước, hỏi gõ lại câu xác nhận).
// Trước khi ghi thật: production nên đang ở chế độ ĐÓNG BĂNG GHI (nhân viên không nhập thêm) để không có dữ liệu mới bị ghi đè.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';
import { parseOpenApi, withRetry, DEFAULT_SKIP_TABLES } from './lib/migration-core.mjs';
import { rollback } from './lib/rollback-core.mjs';

const FLAGS_BOOL = new Set(['ghi', 'xac-nhan-production']);
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
if (!/^[a-z0-9-]{2,40}$/.test(slug)) die('Thiếu hoặc sai --slug (doanh nghiệp nguồn trên LoLo, ví dụ hoanglong).');
if (args.ghi && !args['xac-nhan-production']) die('Ghi vào PRODUCTION sẽ thay đổi dữ liệu thật của hệ thống cũ. Thêm --xac-nhan-production nếu chắc chắn (script vẫn sẽ sao lưu và hỏi lại).');

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
// Chỉ xét các bảng nghiệp vụ = các bảng production có
const loloSchema = loloSchemaAll, prodSchema = prodSchemaAll;

const { data: co, error: coErr } = await lolo.from('companies').select('id, slug').eq('slug', slug).maybeSingle();
if (coErr) die(`Không đọc được bảng companies trên LoLo: ${coErr.message}`);
if (!co) die(`Không thấy doanh nghiệp "${slug}" trên LoLo.`);

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
const retry = (fn) => withRetry(fn, { onRetry: (i, e) => console.log(`  ↻ mạng chập chờn (${String(e.message).slice(0, 60)}) — thử lại lần ${i}...`) });
const storage = {
  listLolo: (bucket, prefix) => retry(async () => { try { return await walk(lolo.storage, bucket, prefix.replace(/\/$/, '')); } catch (e) { if (/not found|does not exist/i.test(e.message)) return []; throw e; } }),
  listProd: (bucket) => retry(async () => { try { return await walk(prod.storage, bucket); } catch (e) { if (/not found|does not exist/i.test(e.message)) return []; throw e; } }),
  download: (bucket, key) => retry(async () => { const { data, error } = await lolo.storage.from(bucket).download(key); if (error) throw new Error(`Tải ${bucket}/${key}: ${error.message}`); return Buffer.from(await data.arrayBuffer()); }),
  upload: (bucket, p, buf, ct) => retry(async () => { const { error } = await prod.storage.from(bucket).upload(p, buf, { contentType: ct, upsert: true }); if (error) throw new Error(`Tải lên production ${bucket}/${p}: ${error.message}`); }),
};

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const snapshotDir = String(args.snapshot || path.join('migration-snapshot', `rollback-${slug}-${stamp}`));

if (args.ghi) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await rl.question(`\n⚠️ SẮP GHI vào PRODUCTION (${urls.prodRef}) từ doanh nghiệp "${slug}" trên LoLo: thêm/sửa/xóa dữ liệu thật của hệ thống cũ.\n   Bản sao lưu production sẽ lưu ở ${snapshotDir}.\n   Gõ đúng chữ  KHOI-PHUC production  để tiếp tục: `);
  rl.close();
  if (ans.trim() !== 'KHOI-PHUC production') die('Không khớp — đã hủy, chưa ghi gì.');
}
console.log(`\n▶ ${args.ghi ? 'GHI THẬT vào PRODUCTION' : 'CHẠY THỬ (không ghi gì)'} — nguồn: ${slug} trên LoLo (${urls.loloRef}) → production (${urls.prodRef})\n  Thư mục sao lưu/báo cáo: ${snapshotDir}\n`);

let report;
try {
  report = await rollback({
    prod, lolo, prodSchema, loloSchema, storage, source: { id: co.id, slug: co.slug }, urls,
    opts: { ghi: !!args.ghi, snapshotDir, concurrency: Number(args['song-song']) || 4, skipTables: [...DEFAULT_SKIP_TABLES, ...String(args['bo-bang'] || '').split(',').filter(Boolean)] },
    log: (m) => console.log('  ·', m),
  });
} catch (e) { report = e.report || { loi: e.message }; report.loi = report.loi || e.message; }
fs.mkdirSync(snapshotDir, { recursive: true });
fs.writeFileSync(path.join(snapshotDir, 'bao-cao.json'), JSON.stringify(report, null, 2));

if (report.loi) { console.error(`\n⛔ DỪNG: ${report.loi}\n   (Báo cáo chi tiết: ${path.join(snapshotDir, 'bao-cao.json')})\n`); process.exit(1); }
const co_thay_doi = Object.entries(report.tables).filter(([, v]) => v.them_moi || v.sua || v.xoa);
console.log('\n── Bảng có thay đổi giữa LoLo và production ──');
if (co_thay_doi.length) console.table(co_thay_doi.map(([bang, v]) => ({ bang, loLo: v.loLo, production: v.production, them_moi: v.them_moi, sua: v.sua, xoa: v.xoa })));
else console.log('  (không có — hai bên giống hệt nhau)');
console.log(`Tổng: +${report.tong.them_moi} mới · ~${report.tong.sua} sửa · -${report.tong.xoa} xóa`);
console.log('── Storage ──'); console.table(report.storage);
if (report.canh_bao.length) { console.log('── Cảnh báo ──'); report.canh_bao.forEach(c => console.log('  ⚠️', c)); }
if (report.ghi) {
  console.log('\n── Kiểm chứng ──');
  report.kiem_chung.forEach(k => console.log(`  ${k.ok ? '✅' : '❌'} ${k.ten}${k.chi_tiet ? ' — ' + k.chi_tiet : ''}`));
  console.log(report.dat ? '\n✅ ĐẠT TẤT CẢ kiểm chứng. Production đã khớp LoLo.\n' : `\n❌ CÓ MỤC KHÔNG ĐẠT — xem bao-cao.json. Bản sao lưu production: ${snapshotDir}\n`);
  process.exit(report.dat ? 0 : 1);
}
console.log(`\n${report.ghi_chu}\n`);
