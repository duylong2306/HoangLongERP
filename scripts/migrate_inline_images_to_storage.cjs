// Chuyển ảnh base64 (data:...) nhúng trong dòng dữ liệu sang Supabase Storage, trong dòng chỉ giữ đường dẫn → giảm dung lượng
// load_all_core_data (Hoàng Long: tasks/missions ~1,85MB, logo báo giá lặp 21 lần ~1,2MB).
//   node scripts/migrate_inline_images_to_storage.cjs plan  <slug>   → CHỈ ĐỌC, liệt kê sẽ làm gì
//   node scripts/migrate_inline_images_to_storage.cjs apply <slug>   → sao lưu ra tệp → tải lên Storage → cập nhật dòng (kiểm tra lại từng dòng)
//   node scripts/migrate_inline_images_to_storage.cjs restore <tệp-sao-lưu>  → đưa giá trị cũ về (đường lui)
// Đối tượng: task_missions.data (reportImages[], evidence) và quotes / archived_quotes / quotation_configs .company_logo_img.
const fs = require('fs'), crypto = require('crypto'), path = require('path');
for (const f of ['.env', '.env.local', '.env.staging.local']) { try { for (const l of fs.readFileSync(f, 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, ''); } } catch {} }
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const [mode, arg] = process.argv.slice(2);
const MISSION_BUCKET = 'mission-report-images', QUOTE_BUCKET = 'quote-images';
const EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };
const parse = (s) => { const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(s); if (!m) return null; return { mime: m[1], buf: m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3])) }; };
const hash = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
const safe = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '_');
const kb = (n) => Math.round(n / 1024) + 'KB';

// Duyệt đệ quy, gom mọi chuỗi data: trong 1 giá trị (kèm đường dẫn) và trả về bản đã thay thế qua hàm `rep`.
function mapDataUrls(v, rep) {
  if (typeof v === 'string') return v.startsWith('data:') ? rep(v) : v;
  if (Array.isArray(v)) return v.map(x => mapDataUrls(x, rep));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapDataUrls(x, rep)]));
  return v;
}

async function upload(bucket, p, buf, mime) {
  const { error } = await sb.storage.from(bucket).upload(p, buf, { contentType: mime, upsert: true });
  if (error) throw new Error(`Upload ${bucket}/${p}: ${error.message}`);
  return sb.storage.from(bucket).getPublicUrl(p).data.publicUrl;
}

(async () => {
  if (mode === 'restore') {
    const bk = JSON.parse(fs.readFileSync(arg, 'utf8'));
    for (const b of bk.rows) {
      const r = await sb.from(b.table).update({ [b.column]: b.old }).eq('company_id', bk.companyId).eq('id', b.id);
      console.log('restore', b.table, b.id, r.error ? 'LỖI ' + r.error.message : 'ok');
    }
    return;
  }
  const slug = arg;
  const company = (await sb.from('companies').select('id').eq('slug', slug).single()).data;
  if (!company) throw new Error('Không thấy công ty ' + slug);
  const cid = company.id;
  const apply = mode === 'apply';
  const backup = { companyId: cid, slug, at: new Date().toISOString(), rows: [] };
  const urlCache = new Map();   // sha1 nội dung → url (dùng chung ảnh trùng)
  let saved = 0;

  // 1) task_missions.data
  const ms = (await sb.from('task_missions').select('id,task_id,data').eq('company_id', cid)).data || [];
  for (const row of ms) {
    const before = JSON.stringify(row.data);
    if (!before.includes('"data:')) continue;
    let n = 0, bytes = 0;
    const missionKey = row.id;
    const newData = mapDataUrls(row.data, (s) => {
      const p = parse(s); if (!p) return s;
      n++; bytes += s.length;
      const h = hash(p.buf);
      if (!apply) return s;
      urlCache.set(h, urlCache.get(h) || { p, row });
      return 'PENDING:' + h;
    });
    console.log(`task_missions ${row.id}: ${n} ảnh, ${kb(bytes)}`);
    if (!apply) continue;
    const resolved = {};
    for (const [h, { p }] of urlCache) {
      if (!resolved[h]) resolved[h] = null;
    }
    // tải lên từng ảnh của dòng này
    const urls = {};
    const uploadsForRow = [...JSON.stringify(newData).matchAll(/PENDING:([0-9a-f]{12})/g)].map(m => m[1]);
    for (const h of new Set(uploadsForRow)) {
      const { p } = urlCache.get(h);
      const ext = EXT[p.mime] || 'bin';
      urls[h] = await upload(MISSION_BUCKET, `${cid}/${safe(row.task_id || 'task')}/${safe(missionKey)}_migrated_${h}.${ext}`, p.buf, p.mime);
    }
    const finalData = JSON.parse(JSON.stringify(newData).replace(/PENDING:([0-9a-f]{12})/g, (_, h) => urls[h]));
    // Kiểm tra lại: dòng chưa bị người dùng sửa giữa chừng thì mới ghi
    const cur = (await sb.from('task_missions').select('data').eq('company_id', cid).eq('id', row.id).single()).data;
    if (JSON.stringify(cur.data) !== before) { console.log('  ⚠ dòng đã thay đổi trong lúc chạy → bỏ qua'); continue; }
    backup.rows.push({ table: 'task_missions', column: 'data', id: row.id, old: row.data });
    fs.writeFileSync(backupFile(), JSON.stringify(backup)); // ghi sao lưu TRƯỚC khi sửa
    const u = await sb.from('task_missions').update({ data: finalData }).eq('company_id', cid).eq('id', row.id);
    if (u.error) { console.log('  LỖI', u.error.message); continue; }
    saved += before.length - JSON.stringify(finalData).length;
  }

  // 2) logo trong quotes / archived_quotes / quotation_configs
  for (const table of ['quotes', 'archived_quotes', 'quotation_configs']) {
    const r = await sb.from(table).select('id,company_logo_img').eq('company_id', cid);
    if (r.error) { console.log(table, 'bỏ qua:', r.error.message); continue; }
    const rows = (r.data || []).filter(x => typeof x.company_logo_img === 'string' && x.company_logo_img.startsWith('data:'));
    const total = rows.reduce((a, x) => a + x.company_logo_img.length, 0);
    console.log(`${table}: ${rows.length} dòng có logo base64, ${kb(total)}, ${new Set(rows.map(x => x.company_logo_img)).size} ảnh khác nhau`);
    if (!apply) continue;
    const urls = new Map();
    for (const x of rows) {
      const p = parse(x.company_logo_img); if (!p) continue;
      const h = hash(p.buf);
      if (!urls.has(h)) urls.set(h, await upload(QUOTE_BUCKET, `${cid}/logo/company_logo_${h}.${EXT[p.mime] || 'png'}`, p.buf, p.mime));
      const cur = (await sb.from(table).select('company_logo_img').eq('company_id', cid).eq('id', x.id).single()).data;
      if (cur.company_logo_img !== x.company_logo_img) { console.log('  ⚠', x.id, 'đã thay đổi → bỏ qua'); continue; }
      backup.rows.push({ table, column: 'company_logo_img', id: x.id, old: x.company_logo_img });
      fs.writeFileSync(backupFile(), JSON.stringify(backup));
      const u = await sb.from(table).update({ company_logo_img: urls.get(h) }).eq('company_id', cid).eq('id', x.id);
      if (u.error) { console.log('  LỖI', u.error.message); continue; }
      saved += x.company_logo_img.length - urls.get(h).length;
    }
  }
  if (apply) console.log(`XONG. Giảm khoảng ${kb(saved)}. Tệp sao lưu: ${backupFile()}`);
  else console.log('(plan: chưa ghi gì)');

  function backupFile() { return path.join(process.env.BACKUP_DIR || '.', `backup_inline_images_${slug}_${backup.at.replace(/[:.]/g, '-')}.json`); }
})().catch(e => { console.error('LỖI:', e.message); process.exit(1); });
