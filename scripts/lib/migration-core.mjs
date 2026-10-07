// LÕI DI CHUYỂN DỮ LIỆU: production Hoàng Long (nhánh main) → 1 doanh nghiệp trên nền tảng LoLo (nhánh multi-tenant).
// Xem kế hoạch đầy đủ: docs/ke-hoach-di-chuyen-du-lieu-hoanglong.md
//
// File này KHÔNG tự kết nối mạng: mọi thứ bên ngoài (2 CSDL, Storage, thư mục sao lưu) được truyền vào qua `ctx`, nên test được
// bằng CSDL giả (src/lib/__tests__/migrationCore.test.ts). Bộ chạy thật nằm ở scripts/migrate-production-to-company.mjs.
//
// NGUYÊN TẮC AN TOÀN (đừng nới lỏng):
//   1. Production CHỈ ĐỌC (không có lệnh ghi nào nhắm vào `ctx.prod`).
//   2. Mọi lệnh ghi/xóa lên LoLo đều có điều kiện company_id = công ty ĐÍCH — không bao giờ đụng công ty khác;
//      sau khi chạy phải chứng minh số dòng của mọi công ty khác y nguyên.
//   3. Chạy thử (mặc định) KHÔNG ghi gì lên LoLo. Chỉ `ghi: true` mới ghi, và chỉ sau khi xuất + biến đổi + kiểm tra xong.
//   4. Không âm thầm bỏ dữ liệu: cột/bảng lạ, dòng mồ côi, tệp thiếu → DỪNG hoặc ghi rõ vào báo cáo.
import fs from 'node:fs';
import path from 'node:path';

// ─── Hàm thuần ───────────────────────────────────────────────────────────────────────────────────

// Đọc bản mô tả OpenAPI của PostgREST (GET /rest/v1/) → { tên bảng: { columns, pk, fks:[{column, refTable}] } }.
// PostgREST ghi dấu <pk/> và <fk table='...' column='...'/> trong phần mô tả của từng cột.
export function parseOpenApi(json) {
  const tables = {};
  for (const [name, def] of Object.entries(json?.definitions || {})) {
    const columns = [], pk = [], fks = [];
    for (const [col, p] of Object.entries(def.properties || {})) {
      columns.push(col);
      const d = String(p?.description || '');
      if (d.includes('<pk/>')) pk.push(col);
      const m = d.match(/<fk table='([^']+)' column='([^']+)'\/>/);
      if (m) fks.push({ column: col, refTable: m[1], refColumn: m[2] });
    }
    tables[name] = { columns, pk, fks };
  }
  return tables;
}

// PostgREST KHÔNG báo các khóa ngoại GHÉP (company_id, x) của LoLo trong OpenAPI → đọc thêm từ các tệp migration:
//   alter table <con> add constraint ... foreign key (...) references <cha> (...)   →  [{ table: con, refTable: cha }]
export function parseFkMigrations(sqlText) {
  const out = [];
  const re = /alter\s+table\s+(?:only\s+)?(?:public\.)?(\w+)\s+add\s+constraint\s+\w+\s+foreign\s+key\s*\(([^)]*)\)\s*references\s+(?:public\.)?(\w+)/gi;
  let m;
  while ((m = re.exec(sqlText))) out.push({ table: m[1], column: m[2].split(',').pop().trim(), refTable: m[3] });
  return out;
}

// Các bảng "cấu hình, mỗi doanh nghiệp đúng 1 dòng": ứng dụng multi-tenant đọc/ghi dòng đó bằng id = company_id
// (xem dbService.ts: `.eq('id', getCurrentCompanyId() || 'current')` và migration 20260930). Ở production id là chuỗi cố định
// ('current', 'global', 'task_permission_matrix_v1') → BẮT BUỘC đổi thành company_id đích, nếu không ứng dụng không tìm thấy dòng cấu hình.
export const SINGLETON_ID_TABLES = ['business_profile', 'shift_config', 'hrm_task_permissions', 'project_permissions', 'document_templates'];

// Thứ tự nạp: bảng CHA trước bảng CON (Kahn). Tham chiếu vòng/tham chiếu chính nó không làm hỏng — phần còn lại nối vào cuối
// (khi nạp, dòng nào vướng khóa ngoại sẽ được thử lại ở lượt sau).
export function topoOrder(tableNames, fksByTable) {
  const set = new Set(tableNames);
  const deps = new Map(tableNames.map(t => [t, new Set((fksByTable[t] || []).map(f => f.refTable).filter(r => r !== t && set.has(r)))]));
  const out = [];
  const pending = new Set(tableNames);
  while (pending.size) {
    const ready = [...pending].filter(t => [...deps.get(t)].every(d => !pending.has(d))).sort();
    if (ready.length === 0) { out.push(...[...pending].sort()); break; }   // vòng phụ thuộc: nối nốt
    for (const t of ready) { out.push(t); pending.delete(t); }
  }
  return out;
}

// Chia lô theo số dòng VÀ dung lượng (một số dòng chứa ảnh base64 rất nặng).
export function splitBatches(rows, maxRows = 200, maxBytes = 2_000_000) {
  const out = []; let cur = [], bytes = 0;
  for (const r of rows) {
    const size = JSON.stringify(r).length;
    if (cur.length && (cur.length >= maxRows || bytes + size > maxBytes)) { out.push(cur); cur = []; bytes = 0; }
    cur.push(r); bytes += size;
  }
  if (cur.length) out.push(cur);
  return out;
}

// JSON ổn định (khóa sắp xếp) để so sánh 2 dòng bất kể thứ tự khóa.
export function canonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
}

// Viết lại địa chỉ tệp Storage: project production → LoLo, đường dẫn thêm thư mục gốc `<company_id>/` (RLS Storage của LoLo
// bắt buộc). Duyệt ĐỆ QUY mọi giá trị (chuỗi, mảng, đối tượng JSON lồng nhau; cả JSON bị nhét dạng chuỗi vẫn là chuỗi nên cũng được thay).
// onRef({bucket, path}) được gọi cho mỗi tệp được nhắc tới (để sau này kiểm tra tệp có thật); onSkip(url) cho địa chỉ KHÔNG viết lại được
// (bucket ngoài danh sách, kiểu ký tên...).
export function makeUrlRewriter({ prodRef, loloRef, companyId, buckets, onRef = () => {}, onSkip = () => {} }) {
  const re = new RegExp(`https://${prodRef.replace(/\./g, '\\.')}\\.supabase\\.co/storage/v1/object/(public|authenticated|sign)/([A-Za-z0-9._-]+)/([^\\s"'\\\\<>)?#]*)`, 'g');
  const bucketSet = new Set(buckets);
  const rewriteString = (s) => s.replace(re, (whole, kind, bucket, p) => {
    if (kind !== 'public' || !bucketSet.has(bucket)) { onSkip(whole); return whole; }
    let decoded = p; try { decoded = decodeURIComponent(p); } catch { /* giữ nguyên */ }
    onRef({ bucket, path: decoded });
    return `https://${loloRef}.supabase.co/storage/v1/object/public/${bucket}/${companyId}/${p}`;
  });
  const walk = (v) => {
    if (typeof v === 'string') return v.includes(prodRef) ? rewriteString(v) : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = walk(v[k]); return o; }
    return v;
  };
  return walk;
}

// Đếm số lần còn xuất hiện địa chỉ project production trong 1 giá trị (kiểm tra sau biến đổi / sau khi nạp).
export function countHostLeft(v, prodRef) {
  if (typeof v === 'string') return v.split(prodRef).length - 1;
  if (Array.isArray(v)) return v.reduce((s, x) => s + countHostLeft(x, prodRef), 0);
  if (v && typeof v === 'object') return Object.values(v).reduce((s, x) => s + countHostLeft(x, prodRef), 0);
  return 0;
}

// So sánh 2 tập dòng (không phân biệt thứ tự): trả { equal, missing, extra } kèm vài mẫu để dễ điều tra.
export function diffRowSets(expected, actual, sample = 3) {
  const m = new Map();
  for (const r of expected) { const k = canonical(r); m.set(k, (m.get(k) || 0) + 1); }
  const extra = [];
  for (const r of actual) {
    const k = canonical(r);
    const n = m.get(k);
    if (n) { if (n === 1) m.delete(k); else m.set(k, n - 1); } else extra.push(k);
  }
  const missing = [...m.entries()].flatMap(([k, n]) => Array(n).fill(k));
  return { equal: missing.length === 0 && extra.length === 0, missing: missing.length, extra: extra.length, missingSample: missing.slice(0, sample), extraSample: extra.slice(0, sample) };
}

// ─── Luồng chính ─────────────────────────────────────────────────────────────────────────────────
export const DEFAULT_SKIP_TABLES = ['push_subscriptions', 'fcm_tokens'];   // gắn tên miền/Firebase cũ — không dùng được ở địa chỉ mới
export const DEFAULT_BUCKETS = ['avatars', 'attendance-photos', 'mission-report-images', 'quote-images', 'product-catalog-images'];
export const LEGACY_BUCKETS = ['purchase-order-pdfs'];                       // di sản (đã bị xóa khỏi mã nguồn): chỉ sao lưu về máy

const PAGE = 1000;

export async function migrate(ctx) {
  const { prod, lolo, prodSchema, loloSchema, storage, target, urls, opts = {}, log = () => {} } = ctx;
  const ghi = opts.ghi === true;
  const skipTables = new Set(opts.skipTables ?? DEFAULT_SKIP_TABLES);
  const buckets = opts.buckets ?? DEFAULT_BUCKETS;
  const snap = opts.snapshotDir;
  const report = { muc_tieu: target.slug, ghi, bat_dau: new Date().toISOString(), tables: {}, storage: {}, kiem_chung: [], dong_mo_coi: [], canh_bao: [] };
  const fail = (msg) => { report.loi = msg; throw Object.assign(new Error(msg), { report }); };

  // ── 0. Kiểm tra an toàn ban đầu ───────────────────────────────────────────────────────────────
  if (!urls.prodRef || !urls.loloRef || urls.prodRef === urls.loloRef) fail('Hai project production và LoLo trùng nhau hoặc thiếu mã project — dừng để tránh ghi nhầm.');
  if (!target?.id || !target?.slug) fail('Thiếu công ty đích.');
  const { data: co, error: coErr } = await lolo.from('companies').select('id, slug').eq('slug', target.slug).maybeSingle();
  if (coErr) fail(`Không đọc được bảng companies trên LoLo: ${coErr.message}`);
  if (!co) fail(`Công ty đích "${target.slug}" chưa có trên LoLo.`);
  if (co.id !== target.id) fail(`Công ty "${target.slug}" trên LoLo có id khác id được truyền vào — dừng.`);

  // ── 1. Đối chiếu cấu trúc hai bên ─────────────────────────────────────────────────────────────
  const prodTables = Object.keys(prodSchema).sort();
  const missingInLolo = prodTables.filter(t => !loloSchema[t]);
  if (missingInLolo.length) fail(`Production có bảng LoLo chưa có: ${missingInLolo.join(', ')}`);
  for (const t of prodTables) {
    const thieuCot = prodSchema[t].columns.filter(c => !loloSchema[t].columns.includes(c));
    if (thieuCot.length) fail(`Bảng ${t}: production có cột mà LoLo chưa có (${thieuCot.join(', ')}) — sẽ mất dữ liệu nếu tiếp tục.`);
    if (!loloSchema[t].columns.includes('company_id')) fail(`Bảng ${t} trên LoLo không có cột company_id.`);
  }
  const tables = prodTables.filter(t => !skipTables.has(t));
  // Quan hệ cha–con = khóa ngoại production + khóa ngoại LoLo (OpenAPI) + khóa ngoại ghép đọc từ migration (ctx.extraFks)
  const fksByTable = Object.fromEntries(tables.map(t => [t, [
    ...(prodSchema[t].fks || []), ...(loloSchema[t].fks || []), ...(ctx.extraFks || []).filter(f => f.table === t),
  ]]));
  const order = topoOrder(tables, fksByTable);
  report.thu_tu_nap = order; report.bang_bo_qua = [...skipTables].filter(t => prodSchema[t]);
  log(`Bảng sẽ chép: ${tables.length} (bỏ qua: ${report.bang_bo_qua.join(', ') || 'không'})`);

  // ── 2. Chụp số dòng của MỌI công ty khác (để chứng minh không bị đụng tới) ────────────────────────
  const countOthers = async () => {
    const out = {};
    for (const t of tables) {
      const { count, error } = await lolo.from(t).select('*', { count: 'exact', head: true }).neq('company_id', target.id);
      if (error) fail(`Không đếm được dòng công ty khác ở bảng ${t}: ${error.message}`);
      out[t] = count ?? 0;
    }
    return out;
  };
  const othersBefore = await countOthers();

  // ── 3. Xuất production (chỉ đọc) ─────────────────────────────────────────────────────────────
  const refs = new Map(), skipped = new Set();   // tệp được dữ liệu nhắc tới / địa chỉ không viết lại được
  const rewrite = makeUrlRewriter({
    prodRef: urls.prodRef, loloRef: urls.loloRef, companyId: target.id, buckets,
    onRef: (r) => refs.set(`${r.bucket}/${r.path}`, r), onSkip: (u) => skipped.add(u),
  });
  const data = {};   // bảng → các dòng ĐÃ biến đổi, sẵn sàng nạp
  if (snap) fs.mkdirSync(snap, { recursive: true });
  for (const t of order) {
    const pk = prodSchema[t].pk.length ? prodSchema[t].pk : [prodSchema[t].columns[0]];
    const { count: expected, error: ce } = await prod.from(t).select('*', { count: 'exact', head: true });
    if (ce) fail(`Không đếm được bảng ${t} trên production: ${ce.message}`);
    const rows = await readAll(prod, t, pk, (m) => fail(`Không đọc được bảng ${t} trên production: ${m}`));
    if (rows.length !== expected) fail(`Bảng ${t}: đọc được ${rows.length} dòng nhưng đếm được ${expected} — dữ liệu có thể đang thay đổi, hãy đóng băng ghi rồi chạy lại.`);
    let outRows = rows.map(r => ({ ...rewrite(r), company_id: target.id }));
    if (SINGLETON_ID_TABLES.includes(t)) {   // dòng cấu hình duy nhất: id → company_id đích (xem chú thích SINGLETON_ID_TABLES)
      if (outRows.length > 1) fail(`Bảng ${t} là bảng cấu hình mỗi doanh nghiệp 1 dòng nhưng production có ${outRows.length} dòng — không biết dòng nào là dòng đúng.`);
      outRows = outRows.map(r => { report.id_doi = [...(report.id_doi || []), { bang: t, tu: r.id, den: target.id }]; return { ...r, id: target.id }; });
    }
    data[t] = outRows;
    report.tables[t] = { production: expected };
    if (snap) fs.writeFileSync(path.join(snap, `${t}.jsonl`), rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
  }
  const conLai = Object.values(data).reduce((s, rows) => s + rows.reduce((a, r) => a + countHostLeft(r, urls.prodRef), 0), 0);
  report.tep_duoc_nhac_toi = refs.size; report.dia_chi_khong_viet_lai = [...skipped].slice(0, 20);
  if (conLai > 0) report.canh_bao.push(`Còn ${conLai} chỗ nhắc tới project production sau khi biến đổi (địa chỉ ngoài danh sách bucket hoặc kiểu ký tên): ${[...skipped].slice(0, 3).join(' | ')}`);
  log(`Đã xuất ${Object.values(data).reduce((s, r) => s + r.length, 0)} dòng; ${refs.size} tệp được nhắc tới trong dữ liệu.`);

  // ── 4. Kiểm kê Storage ───────────────────────────────────────────────────────────────────────
  const objects = {};   // bucket → [{path,size,contentType}] trên production
  for (const b of buckets) {
    objects[b] = await storage.listProd(b);
    const existing = await storage.listLolo(b, `${target.id}/`);
    report.storage[b] = { production: objects[b].length, kich_thuoc_MB: +(objects[b].reduce((s, o) => s + (o.size || 0), 0) / 1048576).toFixed(1), loLo_da_co: existing.length };
  }
  const thieuTep = [...refs.values()].filter(r => !(objects[r.bucket] || []).some(o => o.path === r.path));
  if (thieuTep.length) report.canh_bao.push(`${thieuTep.length} tệp được dữ liệu nhắc tới nhưng KHÔNG có trong Storage production (ảnh đã mất từ trước): ${thieuTep.slice(0, 3).map(r => `${r.bucket}/${r.path}`).join(', ')}`);
  report.tep_nhac_toi_nhung_thieu = thieuTep.length;

  if (!ghi) {
    report.ket_thuc = new Date().toISOString();
    report.ghi_chu = 'CHẠY THỬ: chưa ghi gì lên LoLo. Thêm --ghi để thực hiện.';
    return report;
  }

  // ── 5. GHI: chép Storage → xóa dữ liệu cũ của công ty đích → nạp → kiểm chứng ──────────────────
  // 5a. Chép Storage (chạy lại được: tệp đã có đúng kích thước thì bỏ qua)
  for (const b of buckets) {
    const existing = new Map((await storage.listLolo(b, `${target.id}/`)).map(o => [o.path, o.size]));
    let done = 0, skip = 0;
    await runPool(objects[b], opts.concurrency ?? 6, async (o) => {
      const key = `${target.id}/${o.path}`;
      if (existing.get(key) === o.size) { skip++; return; }
      const buf = await storage.download(b, o.path);
      if (buf.length !== o.size) fail(`Tệp ${b}/${o.path}: tải về ${buf.length} byte nhưng Storage báo ${o.size}.`);
      await storage.upload(b, key, buf, o.contentType);
      done++;
    });
    const after = new Map((await storage.listLolo(b, `${target.id}/`)).map(o => [o.path, o.size]));
    const sai = objects[b].filter(o => after.get(`${target.id}/${o.path}`) !== o.size);
    report.storage[b].da_chep = done; report.storage[b].bo_qua_vi_da_co = skip; report.storage[b].sai_hoac_thieu = sai.length;
    if (sai.length) fail(`Storage ${b}: ${sai.length} tệp thiếu/sai kích thước sau khi chép (vd ${sai[0].path}).`);
    log(`Storage ${b}: chép ${done}, bỏ qua ${skip}.`);
  }
  for (const b of LEGACY_BUCKETS) {   // bucket di sản: chỉ sao lưu về máy, không chuyển sang LoLo
    if (!snap) continue;
    let objs = [];
    try { objs = await storage.listProd(b); } catch { report.canh_bao.push(`Không liệt kê được bucket di sản ${b}.`); }
    for (const o of objs) { const p = path.join(snap, 'legacy', b, o.path); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, await storage.download(b, o.path)); }
    report.storage[b] = { sao_luu_ve_may: objs.length };
  }

  // 5b. Xóa dữ liệu CŨ của công ty đích (chỉ company_id = đích; con trước cha sau; nhiều lượt)
  const del = [...order].reverse();
  for (let pass = 1; ; pass++) {
    let remaining = 0;
    for (const t of del) {
      const { error } = await lolo.from(t).delete().eq('company_id', target.id);
      if (error) {
        if (error.code !== '23503') fail(`Không xóa được dữ liệu cũ bảng ${t}: ${error.message}`);
        remaining++;
      }
    }
    if (remaining === 0) break;
    if (pass >= 10) fail('Không xóa sạch dữ liệu cũ của công ty đích sau 10 lượt (vướng khóa ngoại).');
  }

  // 5c. Nạp theo thứ tự cha → con; lô nào lỗi thì tách từng dòng; dòng vướng khóa ngoại thử lại ở lượt sau
  let pending = {};   // bảng → các dòng còn phải nạp (vì vướng khóa ngoại ở lượt trước)
  const nap = async (t, rows) => {
    const retry = [];
    for (const batch of splitBatches(rows, opts.batchRows ?? 200)) {
      const { error } = await lolo.from(t).insert(batch);
      if (!error) continue;
      for (const r of batch) {
        const { error: e1 } = await lolo.from(t).insert(r);
        if (!e1) continue;
        if (e1.code === '23503') retry.push(r);
        else fail(`Bảng ${t}: không nạp được dòng (${e1.message}). Mẫu: ${canonical(r).slice(0, 200)}`);
      }
    }
    return retry;
  };
  for (const t of order) { const r = await nap(t, data[t]); if (r.length) pending[t] = r; }
  for (let pass = 1; Object.keys(pending).length && pass <= 5; pass++) {
    const before = Object.values(pending).reduce((s, r) => s + r.length, 0);
    const next = {};
    for (const [t, rows] of Object.entries(pending)) { const r = await nap(t, rows); if (r.length) next[t] = r; }
    pending = next;
    if (Object.values(pending).reduce((s, r) => s + r.length, 0) === before) break;   // không tiến triển thêm
  }
  for (const [t, rows] of Object.entries(pending)) for (const r of rows) report.dong_mo_coi.push({ bang: t, dong: canonical(r).slice(0, 300) });
  if (report.dong_mo_coi.length) fail(`${report.dong_mo_coi.length} dòng KHÔNG nạp được vì vướng khóa ngoại (dòng cha không tồn tại) — xem báo cáo; không có dòng nào bị bỏ âm thầm.`);

  // 5d. Kiểm chứng tự động
  const add = (ten, ok, chiTiet = '') => report.kiem_chung.push({ ten, ok, chi_tiet: chiTiet });
  for (const t of order) {
    const back = await readAll({ from: (tt) => ({ select: (c) => lolo.from(tt).select(c).eq('company_id', target.id) }) }, t,
      loloSchema[t].pk.length ? loloSchema[t].pk : [loloSchema[t].columns[0]], (m) => fail(`Không đọc lại được bảng ${t} từ LoLo: ${m}`));
    const d = diffRowSets(data[t], back);
    report.tables[t].loLo = back.length;
    add(`Bảng ${t}: số dòng và nội dung từng dòng khớp (${back.length}/${report.tables[t].production})`, d.equal && back.length === report.tables[t].production,
      d.equal ? '' : `thiếu ${d.missing}, thừa ${d.extra}; mẫu thiếu: ${d.missingSample[0]?.slice(0, 160)}`);
  }
  const othersAfter = await countOthers();
  const khac = tables.filter(t => othersBefore[t] !== othersAfter[t]);
  add('Công ty khác: số dòng mọi bảng y nguyên trước/sau', khac.length === 0, khac.map(t => `${t}: ${othersBefore[t]}→${othersAfter[t]}`).join(', '));
  let nullCount = 0;
  for (const t of tables) { const { count } = await lolo.from(t).select('*', { count: 'exact', head: true }).is('company_id', null); nullCount += count ?? 0; }
  add('Không có dòng nào thiếu company_id', nullCount === 0, `${nullCount} dòng`);
  const hostLeft = Object.values(data).reduce((s, rows) => s + rows.reduce((a, r) => a + countHostLeft(r, urls.prodRef), 0), 0);
  add('Không còn địa chỉ nào trỏ về project production trong dữ liệu đã nạp', hostLeft === 0, `${hostLeft} chỗ`);
  const loloKeys = new Set();
  for (const b of buckets) for (const o of await storage.listLolo(b, `${target.id}/`)) loloKeys.add(`${b}/${o.path.slice(target.id.length + 1)}`);
  const refMat = [...refs.keys()].filter(k => !loloKeys.has(k));
  // Tệp thiếu ở LoLo chỉ chấp nhận được nếu CHÍNH là các tệp đã thiếu sẵn ở production (ảnh mất từ trước, đã nêu ở cảnh báo)
  add('Mọi tệp được dữ liệu nhắc tới đều có thật trong Storage LoLo (trừ các tệp đã thiếu sẵn từ production)', refMat.length === thieuTep.length, refMat.length ? `${refMat.length} tệp thiếu, trong đó ${thieuTep.length} đã thiếu từ production` : '');
  report.ket_thuc = new Date().toISOString();
  report.dat = report.kiem_chung.every(k => k.ok);
  return report;
}

// Lỗi mạng thoáng qua (kết nối bị ngắt, quá giờ, cổng 5xx...) → đáng thử lại; lỗi khác (quyền, dữ liệu sai...) → báo ngay.
export const isTransient = (msg) => /terminated|fetch failed|econn|etimedout|socket|network|timeout|timed out|und_err|502|503|504|temporar/i.test(String(msg || ''));

// Chạy fn, thử lại tối đa `tries` lần với thời gian chờ tăng dần khi gặp lỗi mạng thoáng qua. Lỗi khác ném ra ngay.
export async function withRetry(fn, { tries = 5, base = 1500, sleep = (ms) => new Promise(r => setTimeout(r, ms)), onRetry = () => {} } = {}) {
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (e) {
      if (i >= tries || !isTransient(e?.message)) throw e;
      onRetry(i, e);
      await sleep(base * i);
    }
  }
}

// Đọc TOÀN BỘ 1 bảng theo trang. Bảng có dòng rất nặng (ảnh base64 nhúng trong dữ liệu) dễ vượt giới hạn thời gian của máy chủ khi đọc
// nhiều dòng một lúc → tự GIẢM cỡ trang (÷4, tối thiểu 1 dòng) khi gặp lỗi quá giờ rồi thử lại đúng vị trí đó; không bao giờ bỏ sót dòng.
export async function readAll(client, table, pk, onFatal, startSize = PAGE, sleep) {
  const rows = [];
  let size = startSize, from = 0, netTries = 0;
  for (;;) {
    let q = client.from(table).select('*');
    for (const c of pk) q = q.order(c, { ascending: true });
    const { data: page, error } = await q.range(from, from + size - 1);
    if (error) {
      if (/statement timeout|too large/i.test(error.message) && size > 1) { size = Math.max(1, Math.floor(size / 4)); continue; }
      if (isTransient(error.message) && ++netTries <= 5) { await (sleep || ((ms) => new Promise(r => setTimeout(r, ms))))(1500 * netTries); continue; }   // mạng chập chờn: thử lại đúng trang đó
      onFatal(error.message); return rows;
    }
    netTries = 0;
    rows.push(...(page || []));
    if (!page || page.length < size) break;
    from += size;
  }
  return rows;
}

// Chạy hàm bất đồng bộ trên danh sách với số luồng song song giới hạn.
export async function runPool(items, size, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(size, items.length || 1)) }, async () => {
    for (;;) { const idx = i++; if (idx >= items.length) return; await fn(items[idx], idx); }
  });
  await Promise.all(workers);
}
