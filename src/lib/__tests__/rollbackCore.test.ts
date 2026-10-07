import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FakeDb } from './helpers/fakeSupabase';
// @ts-ignore — tệp .mjs ở thư mục scripts (không có kiểu)
import { rollback, makeReverseUrlRewriter, diffTable, SINGLETON_PROD_IDS } from '../../../scripts/lib/rollback-core.mjs';

const CID = 'cid-hoanglong', OTHER = 'cid-khac';
const T = '2026-01-01T00:00:00+00:00';
const L_URL = (b: string, p: string) => `https://loloxyz.supabase.co/storage/v1/object/public/${b}/${p}`;
const P_URL = (b: string, p: string) => `https://prodabc.supabase.co/storage/v1/object/public/${b}/${p}`;

// ─── Hàm thuần ───────────────────────────────────────────────────────────────────────────────────
describe('makeReverseUrlRewriter', () => {
  const mk = () => { const refs: any[] = [], skipped: string[] = []; return { refs, skipped, f: makeReverseUrlRewriter({ loloRef: 'loloxyz', prodRef: 'prodabc', companyId: CID, buckets: ['avatars', 'quote-images'], onRef: (r: any) => refs.push(r), onSkip: (u: string) => skipped.push(u) }) }; };
  it('đổi project về production và BỎ thư mục <company_id>/; giữ query; ghi nhận tệp được nhắc tới (đường dẫn đã giải mã)', () => {
    const { f, refs } = mk();
    expect(f(`xem ${L_URL('avatars', `${CID}/u1/a%20b.jpg`)}?t=1 xong`)).toBe(`xem ${P_URL('avatars', 'u1/a%20b.jpg')}?t=1 xong`);
    expect(refs).toEqual([{ bucket: 'avatars', path: 'u1/a b.jpg' }]);
  });
  it('đệ quy qua mảng / đối tượng / chuỗi JSON lồng nhau', () => {
    const { f } = mk();
    const v = f({ a: [L_URL('avatars', `${CID}/x.png`), 7], b: { c: JSON.stringify({ i: L_URL('quote-images', `${CID}/y.png`) }) } });
    expect(v.a[0]).toBe(P_URL('avatars', 'x.png')); expect(JSON.parse(v.b.c).i).toBe(P_URL('quote-images', 'y.png'));
  });
  it('tệp trong thư mục CỦA CÔNG TY KHÁC, bucket lạ, kiểu ký tên → KHÔNG đụng, báo skip', () => {
    const { f, skipped } = mk();
    const khac = L_URL('avatars', `${OTHER}/z.png`), la = L_URL('purchase-order-pdfs', `${CID}/p.pdf`);
    expect(f(khac)).toBe(khac); expect(f(la)).toBe(la);
    expect(skipped).toEqual([khac, la]);
  });
});

describe('diffTable', () => {
  it('phân loại thêm / sửa / xóa / giống theo khóa chính', () => {
    const d = diffTable([{ id: 1, v: 'a' }, { id: 2, v: 'MOI' }, { id: 4, v: 'd' }], [{ id: 1, v: 'a' }, { id: 2, v: 'cu' }, { id: 3, v: 'c' }], ['id']);
    expect(d.inserts).toEqual([{ id: 4, v: 'd' }]); expect(d.updates).toEqual([{ id: 2, v: 'MOI' }]); expect(d.deletes).toEqual([{ id: 3, v: 'c' }]); expect(d.same).toBe(1);
  });
  it('thứ tự khóa trong dòng không tạo ra "khác biệt" giả', () => {
    expect(diffTable([{ id: 1, a: 1, b: 2 }], [{ b: 2, id: 1, a: 1 }], ['id'])).toMatchObject({ inserts: [], updates: [], deletes: [], same: 1 });
  });
});

// ─── Luồng chính ─────────────────────────────────────────────────────────────────────────────────
const col = (...c: string[]) => ({ columns: c, pk: ['id'], fks: [] as any[] });
const prodSchema: any = {
  projects: col('id', 'name', 'cover', 'created_at'),
  tasks: { columns: ['id', 'project_id', 'title', 'created_at'], pk: ['id'], fks: [{ column: 'project_id', refTable: 'projects', refColumn: 'id' }] },
  employees: col('id', 'name', 'created_at'),
  push_subscriptions: { columns: ['id', 'user_id', 'endpoint', 'created_at'], pk: ['id'], fks: [{ column: 'user_id', refTable: 'employees', refColumn: 'id' }] },
  business_profile: col('id', 'name', 'logo', 'created_at'),
};
const loloSchema: any = Object.fromEntries(Object.entries(prodSchema).map(([t, s]: any) => [t, { ...s, columns: [...s.columns, 'company_id'], pk: t === 'business_profile' ? ['id'] : ['company_id', 'id'] }]));

function makeStorage(loloFiles: Record<string, Buffer>, prodFiles: Record<string, Buffer>) {
  const calls = { uploads: [] as string[] };
  const split = (k: string) => { const i = k.indexOf('/'); return [k.slice(0, i), k.slice(i + 1)]; };
  return {
    prodFiles, calls,
    listLolo: async (bucket: string, prefix: string) => Object.entries(loloFiles).filter(([k]) => k.startsWith(`${bucket}/${prefix}`)).map(([k, b]) => ({ path: split(k)[1], size: b.length, contentType: 'image/jpeg' })),
    listProd: async (bucket: string) => Object.entries(prodFiles).filter(([k]) => k.startsWith(bucket + '/')).map(([k, b]) => ({ path: split(k)[1], size: b.length, contentType: 'image/jpeg' })),
    download: async (bucket: string, key: string) => loloFiles[`${bucket}/${key}`],
    upload: async (bucket: string, p: string, buf: Buffer) => { calls.uploads.push(`${bucket}/${p}`); prodFiles[`${bucket}/${p}`] = buf; },
  };
}
const readOnly = (db: FakeDb) => {
  const base = db.client();
  return { ...base, from: (t: string) => { const q: any = base.from(t); for (const m of ['insert', 'update', 'upsert', 'delete']) q[m] = () => { throw new Error(`GHI TRONG CHẠY THỬ (${m} ${t})!`); }; return q; } };
};

describe('rollback — luồng đầy đủ', () => {
  let prodDb: FakeDb, loloDb: FakeDb, dir: string;
  const mkCtx = (over: any = {}, files?: { lolo?: Record<string, Buffer>; prod?: Record<string, Buffer> }, dryRun = false) => {
    const storage = makeStorage(files?.lolo ?? {
      [`avatars/${CID}/u1/me.png`]: Buffer.from('anh-cu'),         // đã có ở production (cùng kích thước) → không chép
      [`quote-images/${CID}/q/moi.png`]: Buffer.from('anh-moi'),   // MỚI tạo ở LoLo → phải chép về
    }, files?.prod ?? { 'avatars/u1/me.png': Buffer.from('anh-cu') });
    return { storage, ctx: {
      prod: dryRun ? readOnly(prodDb) : prodDb.client(), lolo: loloDb.client(), prodSchema, loloSchema, storage,
      source: { id: CID, slug: 'hoanglong' }, urls: { prodRef: 'prodabc', loloRef: 'loloxyz' },
      opts: { ghi: false, snapshotDir: dir, concurrency: 2, ...over },
    } };
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-'));
    prodDb = new FakeDb(); loloDb = new FakeDb();
    // Production hiện tại (hệ thống cũ, không có company_id)
    prodDb.seed('projects', [{ id: 'p1', name: 'Tên cũ', cover: P_URL('avatars', 'u1/me.png'), created_at: T }, { id: 'p2', name: 'Sẽ bị xóa ở LoLo', cover: null, created_at: T }]);
    prodDb.seed('tasks', [{ id: 't1', project_id: 'p1', title: 'Việc 1', created_at: T }, { id: 't2', project_id: 'p2', title: 'Việc của p2', created_at: T }]);
    prodDb.seed('employees', [{ id: 'e1', name: 'A', created_at: T }, { id: 'e2', name: 'B (nghỉ ở LoLo)', created_at: T }]);
    prodDb.seed('push_subscriptions', [{ id: 's1', user_id: 'e1', endpoint: 'ep-e1', created_at: T }, { id: 's2', user_id: 'e2', endpoint: 'ep-e2', created_at: T }]);
    prodDb.seed('business_profile', [{ id: 'current', name: 'Tên DN cũ', logo: null, created_at: T }]);
    // LoLo: dữ liệu của hoanglong SAU thời gian dùng thử + dữ liệu của công ty KHÁC (không được lọt về production)
    loloDb.seed('companies', [{ id: CID, slug: 'hoanglong' }, { id: OTHER, slug: 'khac' }]);
    loloDb.seed('projects', [
      { id: 'p1', name: 'Tên MỚI', cover: L_URL('avatars', `${CID}/u1/me.png`), created_at: T, company_id: CID },
      { id: 'p3', name: 'Dự án mới tạo ở LoLo', cover: L_URL('quote-images', `${CID}/q/moi.png`), created_at: T, company_id: CID },
      { id: 'px', name: 'CỦA CÔNG TY KHÁC', cover: null, created_at: T, company_id: OTHER },
    ]);
    loloDb.seed('tasks', [
      { id: 't1', project_id: 'p1', title: 'Việc 1', created_at: T, company_id: CID },
      { id: 't3', project_id: 'p3', title: 'Việc mới', created_at: T, company_id: CID },
      { id: 'tx', project_id: 'px', title: 'khác', created_at: T, company_id: OTHER },
    ]);
    loloDb.seed('employees', [{ id: 'e1', name: 'A', created_at: T, company_id: CID }, { id: 'ex', name: 'NV công ty khác', created_at: T, company_id: OTHER }]);
    loloDb.seed('push_subscriptions', [{ id: 'sl', user_id: 'e1', endpoint: 'ep-lolo', created_at: T, company_id: CID }]);
    loloDb.seed('business_profile', [
      { id: CID, name: 'Tên DN MỚI', logo: L_URL('avatars', `${CID}/u1/me.png`), created_at: T, company_id: CID },
      { id: OTHER, name: 'Cấu hình công ty khác', logo: null, created_at: T, company_id: OTHER },
    ]);
  });

  it('CHẠY THỬ: không ghi gì (production chặn mọi lệnh ghi), chỉ báo khác biệt đúng; không đọc/đụng công ty khác', async () => {
    const { ctx, storage } = mkCtx({}, undefined, true);
    const r = await rollback(ctx);
    expect(r.ghi).toBe(false);
    expect(r.tables.projects).toMatchObject({ loLo: 2, production: 2, them_moi: 1, sua: 1, xoa: 1 });     // p3 mới, p1 sửa, p2 xóa
    expect(r.tables.tasks).toMatchObject({ them_moi: 1, sua: 0, xoa: 1 });                              // t3 mới, t2 xóa
    expect(r.tables.employees).toMatchObject({ them_moi: 0, sua: 0, xoa: 1 });                          // e2 nghỉ ở LoLo
    expect(r.tables.business_profile).toMatchObject({ them_moi: 0, sua: 1, xoa: 0 });                   // id 'current' ↔ id = company_id
    expect(r.tong).toEqual({ them_moi: 2, sua: 2, xoa: 3 });
    expect(r.storage['quote-images']).toMatchObject({ can_chep: 1 }); expect(r.storage.avatars).toMatchObject({ can_chep: 0 });
    expect(storage.calls.uploads).toEqual([]);
    expect(fs.readFileSync(path.join(dir, 'projects.jsonl'), 'utf8')).toContain('Sẽ bị xóa ở LoLo');    // đã sao lưu bản production hiện tại
  });

  it('GHI THẬT: production khớp LoLo (thêm/sửa/xóa), bỏ company_id, id cấu hình về lại "current", URL về production, ảnh mới được chép về', async () => {
    const { ctx, storage } = mkCtx({ ghi: true });
    const r = await rollback(ctx);
    expect(r.dat).toBe(true);
    const ids = (t: string) => prodDb.table(t).map(x => x.id).sort();
    expect(ids('projects')).toEqual(['p1', 'p3']); expect(ids('tasks')).toEqual(['t1', 't3']); expect(ids('employees')).toEqual(['e1']);
    expect(prodDb.table('projects').find(x => x.id === 'p1')!.name).toBe('Tên MỚI');
    expect(JSON.stringify(prodDb.tables)).not.toContain('company_id');                                    // production không có cột này
    expect(JSON.stringify(prodDb.tables)).not.toContain('loloxyz');                                       // không còn địa chỉ LoLo
    expect(prodDb.table('projects').find(x => x.id === 'p3')!.cover).toBe(P_URL('quote-images', 'q/moi.png'));
    // Công ty khác KHÔNG lọt về production
    expect(JSON.stringify(prodDb.tables)).not.toMatch(/CỦA CÔNG TY KHÁC|khác|Cấu hình công ty khác/);
    // Cấu hình 1 dòng: id về lại như production, nội dung theo LoLo
    expect(prodDb.table('business_profile')).toEqual([{ id: 'current', name: 'Tên DN MỚI', logo: P_URL('avatars', 'u1/me.png'), created_at: T }]);
    expect(SINGLETON_PROD_IDS.business_profile).toBe('current');
    // Storage
    expect(storage.calls.uploads).toEqual(['quote-images/q/moi.png']);
    expect(storage.prodFiles['quote-images/q/moi.png'].toString()).toBe('anh-moi');
  });

  it('thông báo đẩy của production giữ nguyên; chỉ xóa đăng ký MỒ CÔI của nhân viên bị xóa (nếu không sẽ chặn xóa nhân viên)', async () => {
    const { ctx } = mkCtx({ ghi: true });
    // giả lập khóa ngoại thật: không xóa employees khi còn push_subscriptions trỏ tới
    const base = prodDb.client();
    ctx.prod = { ...base, from: (tb: string) => { const q: any = base.from(tb); if (tb === 'employees') { const del = q.delete.bind(q); q.delete = () => { const d: any = del(); const inn = d.in.bind(d);
      d.in = (c: string, ids: string[]) => (prodDb.table('push_subscriptions').some(s => ids.includes(s.user_id)) ? { then: (res: any) => Promise.resolve({ data: null, error: { code: '23503', message: 'fk' } }).then(res) } : inn(c, ids)); return d; }; } return q; } };
    const r = await rollback(ctx);
    expect(r.dat).toBe(true);
    expect(prodDb.table('push_subscriptions').map(s => s.id)).toEqual(['s1']);        // s1 (e1 còn) giữ; s2 (e2 bị xóa) dọn
  });

  it('thứ tự: xóa bảng con trước bảng cha; thêm/sửa bảng cha trước bảng con', async () => {
    const { ctx } = mkCtx({ ghi: true });
    await rollback(ctx);
    const log = prodDb.log;
    expect(log.indexOf('delete:tasks')).toBeLessThan(log.indexOf('delete:projects'));
    expect(log.indexOf('upsert:projects')).toBeLessThan(log.indexOf('upsert:tasks'));
  });

  it('chạy lại lần 2: không còn khác biệt nào; tệp đã có đúng kích thước thì không chép lại', async () => {
    const a = mkCtx({ ghi: true }); await rollback(a.ctx);
    const b = mkCtx({}, { lolo: undefined, prod: { ...a.storage.prodFiles } });
    const r = await rollback(b.ctx);
    expect(r.tong).toEqual({ them_moi: 0, sua: 0, xoa: 0 });
    expect(r.storage['quote-images'].can_chep).toBe(0);
  });

  it('DỪNG nếu đích có bảng companies (là LoLo chứ không phải production cũ) — chốt chặn chống ghi nhầm', async () => {
    const { ctx } = mkCtx({ ghi: true }); ctx.prodSchema = { ...prodSchema, companies: col('id', 'slug') };
    await expect(rollback(ctx)).rejects.toThrow(/KHÔNG phải production cũ/);
    expect(prodDb.log.some(l => /^(insert|upsert|delete|update):/.test(l))).toBe(false);
  });

  it('DỪNG nếu 2 project trùng nhau, hoặc doanh nghiệp nguồn sai / không có', async () => {
    let c = mkCtx({ ghi: true }); c.ctx.urls = { prodRef: 'x', loloRef: 'x' };
    await expect(rollback(c.ctx)).rejects.toThrow(/trùng nhau/);
    c = mkCtx({ ghi: true }); c.ctx.source = { id: 'id-sai', slug: 'hoanglong' };
    await expect(rollback(c.ctx)).rejects.toThrow(/không khớp/);
    c = mkCtx({ ghi: true }); c.ctx.source = { id: CID, slug: 'khong-co' };
    await expect(rollback(c.ctx)).rejects.toThrow(/không khớp/);
  });

  it('DỪNG nếu LoLo có CỘT mà production chưa có (quay về sẽ mất dữ liệu cột đó) — không ghi gì', async () => {
    const { ctx } = mkCtx({ ghi: true });
    ctx.loloSchema = { ...loloSchema, projects: { ...loloSchema.projects, columns: [...loloSchema.projects.columns, 'cot_moi_o_lolo'] } };
    await expect(rollback(ctx)).rejects.toThrow(/cot_moi_o_lolo/);
    expect(prodDb.log.some(l => /^(insert|upsert|delete|update):/.test(l))).toBe(false);
  });

  it('dòng mồ côi (vướng khóa ngoại): dừng và ghi rõ vào báo cáo, không bỏ âm thầm; bản sao lưu production đã có', async () => {
    loloDb.seed('tasks', [{ id: 't9', project_id: 'khong-co', title: 'mồ côi', created_at: T, company_id: CID }]);
    const { ctx } = mkCtx({ ghi: true });
    const base = prodDb.client();
    ctx.prod = { ...base, from: (tb: string) => { const q: any = base.from(tb); const up = q.upsert.bind(q);
      q.upsert = (p: any, o: any) => { const rows = Array.isArray(p) ? p : [p]; if (tb === 'tasks' && rows.some((r: any) => !prodDb.table('projects').some(x => x.id === r.project_id))) return { then: (res: any) => Promise.resolve({ data: null, error: { code: '23503', message: 'fk' } }).then(res) }; return up(p, o); }; return q; } };
    let err: any; try { await rollback(ctx); } catch (e) { err = e; }
    expect(err.message).toMatch(/KHÔNG ghi được/);
    expect(err.report.dong_mo_coi[0].bang).toBe('tasks');
    expect(fs.existsSync(path.join(dir, 'tasks.jsonl'))).toBe(true);
  });

  it('kiểm chứng PHÁT HIỆN lệch dữ liệu sau khi ghi (báo không đạt)', async () => {
    const { ctx } = mkCtx({ ghi: true });
    const base = prodDb.client();
    // làm sai lệch dữ liệu ghi vào bảng tasks (bảng này có dòng thêm mới) để kiểm tra bước kiểm chứng phát hiện được
    ctx.prod = { ...base, from: (tb: string) => { const q: any = base.from(tb); const up = q.upsert.bind(q); q.upsert = (p: any, o: any) => up(Array.isArray(p) ? p.map((r: any) => (tb === 'tasks' ? { ...r, title: r.title + '!' } : r)) : p, o); return q; } };
    const r = await rollback(ctx);
    expect(r.dat).toBe(false);
    expect(r.kiem_chung.find((k: any) => k.ten.startsWith('Bảng tasks'))!.ok).toBe(false);
  });

  it('tệp được dữ liệu nhắc tới nhưng không có ở cả hai nơi → cảnh báo rõ ràng', async () => {
    const { ctx } = mkCtx({}, { lolo: { [`avatars/${CID}/u1/me.png`]: Buffer.from('anh-cu') }, prod: { 'avatars/u1/me.png': Buffer.from('anh-cu') } });
    const r = await rollback(ctx);
    expect(r.tep_nhac_toi_nhung_mat).toBe(1);
    expect(r.canh_bao.join(' ')).toMatch(/KHÔNG có ở cả production lẫn LoLo/);
  });
});
