// LÕI DI CHUYỂN NGƯỢC (ĐƯỜNG LUI): doanh nghiệp trên LoLo (multi-tenant) → production Hoàng Long cũ (nhánh main, không có company_id).
// Dùng khi sau lúc chuyển sang nền tảng mới nhân viên đã nhập dữ liệu mới mà phải quay về hệ thống cũ. Chiều xuôi: scripts/lib/migration-core.mjs.
//
// KHÁC chiều xuôi: production có dữ liệu THẬT đang cần giữ → KHÔNG xóa trắng rồi nạp lại, mà ĐỒNG BỘ CÓ SO SÁNH:
//   • dòng mới ở LoLo → thêm vào production;  • dòng đã sửa ở LoLo → cập nhật production;  • dòng đã xóa ở LoLo → xóa khỏi production;
//   • dòng giống nhau → không đụng. Báo cáo cho biết từng bảng có bao nhiêu dòng mới/sửa/xóa ("từ lúc chuyển đến nay đã thay đổi gì").
//
// NGUYÊN TẮC AN TOÀN:
//   1. LoLo CHỈ ĐỌC, và chỉ đọc đúng company_id của doanh nghiệp nguồn (không bao giờ đọc/ghi công ty khác).
//   2. Chạy thử (mặc định) KHÔNG ghi gì lên production. Ghi chỉ khi `ghi: true`, và LUÔN lưu bản sao lưu production trước khi ghi.
//   3. Đích phải đúng là production cũ: không có bảng `companies`/`platform_admins` (nếu có thì đó là LoLo — dừng ngay).
//   4. Không âm thầm mất dữ liệu: LoLo có cột production chưa có, dòng vướng khóa ngoại → DỪNG và báo rõ.
//   5. Các bảng bỏ qua (push_subscriptions, fcm_tokens) của production giữ nguyên; chỉ xóa dòng mồ côi nếu nhân viên tương ứng bị xóa.
import fs from 'node:fs';
import path from 'node:path';
import { topoOrder, splitBatches, canonical, diffRowSets, readAll, runPool, countHostLeft, DEFAULT_SKIP_TABLES, DEFAULT_BUCKETS } from './migration-core.mjs';

// Id gốc ở production của 5 bảng cấu hình "mỗi doanh nghiệp 1 dòng" (ở LoLo id = company_id) — ngược lại với chiều xuôi.
export const SINGLETON_PROD_IDS = {
  business_profile: 'current', shift_config: 'current', hrm_task_permissions: 'task_permission_matrix_v1',
  project_permissions: 'global', document_templates: 'global',
};

// Viết lại địa chỉ ảnh: LoLo (có thư mục <company_id>/) → production (không có thư mục đó). Đường dẫn KHÔNG nằm trong thư mục của chính
// doanh nghiệp nguồn (vd của công ty khác) thì KHÔNG đụng và báo skip.
export function makeReverseUrlRewriter({ loloRef, prodRef, companyId, buckets, onRef = () => {}, onSkip = () => {} }) {
  const re = new RegExp(`https://${loloRef.replace(/\./g, '\\.')}\\.supabase\\.co/storage/v1/object/(public|authenticated|sign)/([A-Za-z0-9._-]+)/([^\\s"'\\\\<>)?#]*)`, 'g');
  const bucketSet = new Set(buckets), prefix = `${companyId}/`;
  const str = (s) => s.replace(re, (whole, kind, bucket, p) => {
    if (kind !== 'public' || !bucketSet.has(bucket) || !p.startsWith(prefix)) { onSkip(whole); return whole; }
    const rel = p.slice(prefix.length);
    let decoded = rel; try { decoded = decodeURIComponent(rel); } catch { /* giữ nguyên */ }
    onRef({ bucket, path: decoded });
    return `https://${prodRef}.supabase.co/storage/v1/object/public/${bucket}/${rel}`;
  });
  const walk = (v) => {
    if (typeof v === 'string') return v.includes(loloRef) ? str(v) : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = walk(v[k]); return o; }
    return v;
  };
  return walk;
}

const pkOf = (schema, t) => (schema[t].pk.length ? schema[t].pk : [schema[t].columns[0]]);
const keyOf = (row, pk) => JSON.stringify(pk.map(c => row[c]));

// So sánh LoLo (đã biến đổi) với production hiện tại theo khóa chính → dòng cần thêm / sửa / xóa.
export function diffTable(source, current, pk) {
  const cur = new Map(current.map(r => [keyOf(r, pk), r]));
  const seen = new Set(), inserts = [], updates = [];
  for (const r of source) {
    const k = keyOf(r, pk); seen.add(k);
    const c = cur.get(k);
    if (!c) inserts.push(r); else if (canonical(c) !== canonical(r)) updates.push(r);
  }
  const deletes = current.filter(r => !seen.has(keyOf(r, pk)));
  return { inserts, updates, deletes, same: source.length - inserts.length - updates.length };
}

export async function rollback(ctx) {
  const { prod, lolo, prodSchema, loloSchema, storage, source, urls, opts = {}, log = () => {} } = ctx;
  const ghi = opts.ghi === true, snap = opts.snapshotDir;
  const skipTables = new Set(opts.skipTables ?? DEFAULT_SKIP_TABLES);
  const buckets = opts.buckets ?? DEFAULT_BUCKETS;
  const report = { nguon: source.slug, ghi, bat_dau: new Date().toISOString(), tables: {}, storage: {}, kiem_chung: [], canh_bao: [] };
  const fail = (msg) => { report.loi = msg; throw Object.assign(new Error(msg), { report }); };

  // ── 0. An toàn ban đầu ────────────────────────────────────────────────────────────────────────
  if (!urls.prodRef || !urls.loloRef || urls.prodRef === urls.loloRef) fail('Hai project trùng nhau hoặc thiếu mã project — dừng.');
  if (prodSchema.companies || prodSchema.platform_admins) fail('Đích có bảng companies/platform_admins — đây KHÔNG phải production cũ (có vẻ là LoLo). Dừng để không ghi nhầm.');
  const { data: co, error: coErr } = await lolo.from('companies').select('id, slug').eq('slug', source.slug).maybeSingle();
  if (coErr) fail(`Không đọc được companies trên LoLo: ${coErr.message}`);
  if (!co || co.id !== source.id) fail(`Doanh nghiệp nguồn "${source.slug}" không khớp trên LoLo.`);

  // ── 1. Đối chiếu cấu trúc ─────────────────────────────────────────────────────────────────────
  const prodTables = Object.keys(prodSchema).sort();
  for (const t of prodTables) {
    if (!loloSchema[t]) fail(`LoLo thiếu bảng ${t} mà production có.`);
    const thua = loloSchema[t].columns.filter(c => c !== 'company_id' && !prodSchema[t].columns.includes(c));
    if (thua.length) fail(`Bảng ${t}: LoLo có cột production CHƯA có (${thua.join(', ')}) — quay về production sẽ mất dữ liệu cột này. Thêm cột vào production trước.`);
  }
  const tables = prodTables.filter(t => !skipTables.has(t));
  const order = topoOrder(tables, Object.fromEntries(tables.map(t => [t, [...(prodSchema[t].fks || []), ...(ctx.extraFks || []).filter(f => f.table === t)]])));
  report.thu_tu = order; report.bang_bo_qua = [...skipTables].filter(t => prodSchema[t]);

  // ── 2. Đọc LoLo (chỉ doanh nghiệp nguồn) và biến đổi về dạng production ──────────────────────
  const refs = new Map(), skipped = new Set();
  const rewrite = makeReverseUrlRewriter({ loloRef: urls.loloRef, prodRef: urls.prodRef, companyId: source.id, buckets, onRef: (r) => refs.set(`${r.bucket}/${r.path}`, r), onSkip: (u) => skipped.add(u) });
  const wanted = {}, current = {};
  if (snap) fs.mkdirSync(snap, { recursive: true });
  for (const t of order) {
    const pkL = pkOf(loloSchema, t), pkP = pkOf(prodSchema, t);
    const src = await readAll({ from: (tt) => ({ select: (c) => lolo.from(tt).select(c).eq('company_id', source.id) }) }, t, pkL, (m) => fail(`Không đọc được bảng ${t} từ LoLo: ${m}`));
    let rows = src.map(r => { const { company_id, ...rest } = r; return rewrite(rest); });
    if (SINGLETON_PROD_IDS[t]) {
      if (rows.length > 1) fail(`Bảng ${t} là bảng cấu hình 1 dòng nhưng LoLo có ${rows.length} dòng.`);
      rows = rows.map(r => ({ ...r, id: SINGLETON_PROD_IDS[t] }));
    }
    wanted[t] = rows;
    // Production hiện tại: đọc để so sánh VÀ làm bản sao lưu
    current[t] = await readAll(prod, t, pkP, (m) => fail(`Không đọc được bảng ${t} từ production: ${m}`));
    if (snap) fs.writeFileSync(path.join(snap, `${t}.jsonl`), current[t].map(r => JSON.stringify(r)).join('\n') + (current[t].length ? '\n' : ''));
  }
  const hostConLai = Object.values(wanted).reduce((s, rows) => s + rows.reduce((a, r) => a + countHostLeft(r, urls.loloRef), 0), 0);
  if (hostConLai > 0) report.canh_bao.push(`Còn ${hostConLai} chỗ nhắc tới project LoLo sau khi biến đổi (địa chỉ ngoài bucket/ngoài thư mục của doanh nghiệp): ${[...skipped].slice(0, 3).join(' | ')}`);

  // ── 3. Tính khác biệt ─────────────────────────────────────────────────────────────────────────
  const diffs = {};
  for (const t of order) {
    diffs[t] = diffTable(wanted[t], current[t], pkOf(prodSchema, t));
    report.tables[t] = { loLo: wanted[t].length, production: current[t].length, them_moi: diffs[t].inserts.length, sua: diffs[t].updates.length, xoa: diffs[t].deletes.length };
  }
  report.tong = Object.values(report.tables).reduce((a, v) => ({ them_moi: a.them_moi + v.them_moi, sua: a.sua + v.sua, xoa: a.xoa + v.xoa }), { them_moi: 0, sua: 0, xoa: 0 });
  log(`Khác biệt LoLo ↔ production: +${report.tong.them_moi} mới, ~${report.tong.sua} sửa, -${report.tong.xoa} xóa.`);

  // ── 4. Kiểm kê Storage (tệp mới/đổi ở LoLo cần chép về production) ────────────────────────────
  const toCopy = {}, prodHas = {}, loloHas = {};
  for (const b of buckets) {
    const prefix = `${source.id}/`;
    const loloObjs = (await storage.listLolo(b, prefix)).map(o => ({ ...o, rel: o.path.slice(prefix.length) }));
    const prodObjs = new Map((await storage.listProd(b)).map(o => [o.path, o.size]));
    toCopy[b] = loloObjs.filter(o => prodObjs.get(o.rel) !== o.size);
    prodHas[b] = new Set(prodObjs.keys()); loloHas[b] = new Set(loloObjs.map(o => o.rel));
    report.storage[b] = { loLo: loloObjs.length, production: prodObjs.size, can_chep: toCopy[b].length };
  }
  // Tệp được dữ liệu nhắc tới phải có ở production (đã có sẵn) hoặc ở LoLo (sẽ chép về) — nếu không, ảnh đó sẽ gãy sau khi quay lại
  const mat = [...refs.values()].filter(r => !(prodHas[r.bucket]?.has(r.path) || loloHas[r.bucket]?.has(r.path)));
  report.tep_nhac_toi_nhung_mat = mat.length;
  if (mat.length) report.canh_bao.push(`${mat.length} tệp được dữ liệu nhắc tới nhưng KHÔNG có ở cả production lẫn LoLo (ảnh đã mất từ trước): ${mat.slice(0, 3).map(r => `${r.bucket}/${r.path}`).join(', ')}`);

  if (!ghi) {
    report.ket_thuc = new Date().toISOString();
    report.ghi_chu = 'CHẠY THỬ: chưa ghi gì lên production (chỉ liệt kê khác biệt). Thêm --ghi để thực hiện.';
    return report;
  }

  // ── 5. GHI: chép Storage → xóa → thêm/sửa → kiểm chứng. Bản sao lưu production đã lưu ở bước 2. ──
  for (const b of buckets) {
    let done = 0;
    await runPool(toCopy[b], opts.concurrency ?? 4, async (o) => {
      const buf = await storage.download(b, o.path);
      if (buf.length !== o.size) fail(`Tệp ${b}/${o.path}: tải về ${buf.length} byte nhưng Storage báo ${o.size}.`);
      await storage.upload(b, o.rel, buf, o.contentType); done++;
    });
    const after = new Map((await storage.listProd(b)).map(o => [o.path, o.size]));
    const sai = toCopy[b].filter(o => after.get(o.rel) !== o.size);
    report.storage[b].da_chep = done; report.storage[b].sai_hoac_thieu = sai.length;
    if (sai.length) fail(`Storage ${b}: ${sai.length} tệp thiếu/sai kích thước sau khi chép (vd ${sai[0].rel}).`);
  }

  // 5a. Dọn dòng mồ côi ở các bảng bỏ qua (vd push_subscriptions) trỏ tới dòng sắp bị xóa — nếu không sẽ chặn việc xóa bảng cha
  const deletedIds = (t) => diffs[t]?.deletes.map(r => r[pkOf(prodSchema, t)[0]]) ?? [];
  for (const st of report.bang_bo_qua) {
    for (const fk of (prodSchema[st].fks || [])) {
      const ids = deletedIds(fk.refTable);
      for (let i = 0; i < ids.length; i += 100) {
        const { error } = await prod.from(st).delete().in(fk.column, ids.slice(i, i + 100));
        if (error) fail(`Không dọn được ${st}.${fk.column} (${error.message}).`);
      }
    }
  }

  // 5b. Xóa dòng không còn ở LoLo: con trước cha sau; dòng vướng khóa ngoại để lại làm lượt cuối (sau khi thêm/sửa xong)
  const stuck = {};
  const xoa = async (t, rows) => {
    const pk = pkOf(prodSchema, t), left = [];
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const q = pk.length === 1 ? prod.from(t).delete().in(pk[0], chunk.map(r => r[pk[0]])) : null;
      if (q) { const { error } = await q; if (error) { if (error.code === '23503') left.push(...chunk); else fail(`Không xóa được bảng ${t}: ${error.message}`); } continue; }
      for (const r of chunk) { let d = prod.from(t).delete(); for (const c of pk) d = d.eq(c, r[c]); const { error } = await d; if (error) { if (error.code === '23503') left.push(r); else fail(`Không xóa được bảng ${t}: ${error.message}`); } }
    }
    return left;
  };
  for (const t of [...order].reverse()) { const left = await xoa(t, diffs[t].deletes); if (left.length) stuck[t] = left; }

  // 5c. Thêm / sửa: cha trước con sau; lô lỗi tách từng dòng, dòng vướng khóa ngoại thử lại ở lượt sau
  let pending = {};
  const ghiBang = async (t, rows) => {
    const retry = [], onConflict = pkOf(prodSchema, t).join(',');
    for (const batch of splitBatches(rows, opts.batchRows ?? 200)) {
      const { error } = await prod.from(t).upsert(batch, { onConflict });
      if (!error) continue;
      for (const r of batch) {
        const { error: e1 } = await prod.from(t).upsert(r, { onConflict });
        if (!e1) continue;
        if (e1.code === '23503') retry.push(r); else fail(`Bảng ${t}: không ghi được dòng (${e1.message}). Mẫu: ${canonical(r).slice(0, 200)}`);
      }
    }
    return retry;
  };
  for (const t of order) { const r = await ghiBang(t, [...diffs[t].inserts, ...diffs[t].updates]); if (r.length) pending[t] = r; }
  for (let pass = 1; Object.keys(pending).length && pass <= 5; pass++) {
    const before = Object.values(pending).reduce((s, r) => s + r.length, 0), next = {};
    for (const [t, rows] of Object.entries(pending)) { const r = await ghiBang(t, rows); if (r.length) next[t] = r; }
    pending = next;
    if (Object.values(pending).reduce((s, r) => s + r.length, 0) === before) break;
  }
  const mocoi = Object.entries(pending).flatMap(([t, rows]) => rows.map(r => ({ bang: t, dong: canonical(r).slice(0, 300) })));
  if (mocoi.length) { report.dong_mo_coi = mocoi; fail(`${mocoi.length} dòng KHÔNG ghi được vì vướng khóa ngoại — xem báo cáo; production đã có bản sao lưu ở ${snap}.`); }

  // 5d. Lượt cuối cho các dòng cần xóa mà trước đó còn bị tham chiếu
  for (let pass = 1; Object.keys(stuck).length; pass++) {
    const next = {};
    for (const t of [...order].reverse()) if (stuck[t]) { const left = await xoa(t, stuck[t]); if (left.length) next[t] = left; }
    if (JSON.stringify(Object.keys(next)) === JSON.stringify(Object.keys(stuck)) && Object.values(next).reduce((s, r) => s + r.length, 0) === Object.values(stuck).reduce((s, r) => s + r.length, 0)) { fail(`Không xóa được ${Object.values(next).reduce((s, r) => s + r.length, 0)} dòng vướng khóa ngoại: ${Object.keys(next).join(', ')}.`); }
    Object.keys(stuck).forEach(k => delete stuck[k]); Object.assign(stuck, next);
    if (pass >= 10) fail('Không xóa sạch các dòng thừa sau 10 lượt.');
  }

  // ── 6. Kiểm chứng ───────────────────────────────────────────────────────────────────────────
  const add = (ten, ok, chiTiet = '') => report.kiem_chung.push({ ten, ok, chi_tiet: chiTiet });
  for (const t of order) {
    const back = await readAll(prod, t, pkOf(prodSchema, t), (m) => fail(`Không đọc lại được bảng ${t} từ production: ${m}`));
    const d = diffRowSets(wanted[t], back);
    report.tables[t].production_sau = back.length;
    add(`Bảng ${t}: production khớp LoLo (${back.length}/${wanted[t].length})`, d.equal, d.equal ? '' : `thiếu ${d.missing}, thừa ${d.extra}; mẫu: ${d.missingSample[0]?.slice(0, 160) || d.extraSample[0]?.slice(0, 160)}`);
  }
  add('Không còn địa chỉ nào trỏ về project LoLo trong dữ liệu production', hostConLai === 0, `${hostConLai} chỗ`);
  const prodSau = {};
  for (const b of buckets) prodSau[b] = new Set((await storage.listProd(b)).map(o => o.path));
  const matSau = [...refs.values()].filter(r => !prodSau[r.bucket]?.has(r.path));
  add('Mọi tệp được dữ liệu nhắc tới đều có thật trong Storage production (trừ tệp đã mất từ trước ở cả hai nơi)', matSau.length === mat.length, matSau.length ? `${matSau.length} tệp thiếu, trong đó ${mat.length} đã mất từ trước` : '');
  report.ket_thuc = new Date().toISOString();
  report.dat = report.kiem_chung.every(k => k.ok);
  return report;
}
