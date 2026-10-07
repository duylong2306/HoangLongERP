import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FakeDb } from './helpers/fakeSupabase';
// @ts-ignore — tệp .mjs ở thư mục scripts (không có kiểu)
import { migrate, parseOpenApi, topoOrder, splitBatches, canonical, diffRowSets, makeUrlRewriter, countHostLeft, readAll, parseFkMigrations, SINGLETON_ID_TABLES, withRetry, isTransient } from '../../../scripts/lib/migration-core.mjs';

// ─── Hàm thuần ───────────────────────────────────────────────────────────────────────────────────
describe('parseOpenApi', () => {
  it('đọc cột, khóa chính <pk/>, khóa ngoại <fk .../>', () => {
    const t = parseOpenApi({ definitions: {
      projects: { properties: { id: { description: 'Note:\nThis is a Primary Key.<pk/>' }, name: {} } },
      tasks: { properties: { id: { description: 'Note:\nThis is a Primary Key.<pk/>' }, company_id: { description: "This is a Foreign Key to `companies.id`.<fk table='companies' column='id'/>" }, project_id: { description: "This is a Foreign Key to `projects.id`.<fk table='projects' column='id'/>" } } },
    } });
    expect(t.projects).toEqual({ columns: ['id', 'name'], pk: ['id'], fks: [] });
    expect(t.tasks.pk).toEqual(['id']);
    expect(t.tasks.fks).toEqual([{ column: 'company_id', refTable: 'companies', refColumn: 'id' }, { column: 'project_id', refTable: 'projects', refColumn: 'id' }]);
  });
});

describe('topoOrder', () => {
  it('bảng cha trước bảng con; bỏ qua tham chiếu tới chính nó và bảng ngoài danh sách', () => {
    const fks = { tasks: [{ refTable: 'projects' }, { refTable: 'companies' }], chat: [{ refTable: 'conversations' }], conversations: [{ refTable: 'tasks' }, { refTable: 'projects' }], projects: [{ refTable: 'projects' }] };
    const o = topoOrder(['chat', 'tasks', 'projects', 'conversations', 'customers'], fks);
    expect(o.indexOf('projects')).toBeLessThan(o.indexOf('tasks'));
    expect(o.indexOf('tasks')).toBeLessThan(o.indexOf('conversations'));
    expect(o.indexOf('conversations')).toBeLessThan(o.indexOf('chat'));
    expect([...o].sort()).toEqual(['chat', 'conversations', 'customers', 'projects', 'tasks']);   // không mất bảng nào
  });
  it('vòng phụ thuộc không làm treo, vẫn trả đủ bảng', () => {
    const o = topoOrder(['a', 'b', 'c'], { a: [{ refTable: 'b' }], b: [{ refTable: 'a' }] });
    expect([...o].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('parseFkMigrations', () => {
  it('đọc khóa ngoại ghép (company_id, x) → bảng cha từ SQL migration, nhiều dòng/hoa thường đều được', () => {
    const sql = `alter table public.tasks add constraint tasks_project_id_fkey
      foreign key (company_id, project_id) references public.projects (company_id, id) on delete cascade;
      ALTER TABLE ONLY public.chat_messages ADD CONSTRAINT x FOREIGN KEY (company_id, conversation_id) REFERENCES public.conversations(company_id, id);
      alter table public.foo add column bar int;`;
    expect(parseFkMigrations(sql)).toEqual([{ table: 'tasks', column: 'project_id', refTable: 'projects' }, { table: 'chat_messages', column: 'conversation_id', refTable: 'conversations' }]);
  });
});

describe('splitBatches / canonical / diffRowSets', () => {
  it('chia lô theo số dòng và dung lượng, không mất dòng', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ i, x: 'x'.repeat(100) }));
    expect(splitBatches(rows, 4).map(b => b.length)).toEqual([4, 4, 2]);
    expect(splitBatches(rows, 100, 250).flat()).toEqual(rows);
    expect(splitBatches(rows, 100, 250).length).toBeGreaterThan(1);
    expect(splitBatches([{ a: 'y'.repeat(5000) }], 10, 100)).toHaveLength(1);   // 1 dòng quá nặng vẫn thành 1 lô riêng
  });
  it('canonical không phụ thuộc thứ tự khóa; diffRowSets phát hiện thiếu/thừa/khác nội dung', () => {
    expect(canonical({ b: 1, a: { d: [1, 2], c: null } })).toBe(canonical({ a: { c: null, d: [1, 2] }, b: 1 }));
    expect(diffRowSets([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 1 }]).equal).toBe(true);
    const d = diffRowSets([{ id: 1, v: 'a' }, { id: 2 }], [{ id: 1, v: 'b' }, { id: 2 }, { id: 3 }]);
    expect(d).toMatchObject({ equal: false, missing: 1, extra: 2 });
    expect(diffRowSets([{ id: 1 }, { id: 1 }], [{ id: 1 }]).equal).toBe(false);   // trùng lặp cũng được đếm
  });
});

describe('makeUrlRewriter', () => {
  const rw = (extra: any = {}) => {
    const refs: any[] = [], skipped: string[] = [];
    const f = makeUrlRewriter({ prodRef: 'prodabc', loloRef: 'loloxyz', companyId: 'CID', buckets: ['avatars', 'quote-images'], onRef: (r: any) => refs.push(r), onSkip: (u: string) => skipped.push(u), ...extra });
    return { f, refs, skipped };
  };
  const U = (b: string, p: string) => `https://prodabc.supabase.co/storage/v1/object/public/${b}/${p}`;
  it('đổi project, thêm thư mục <company_id>/, giữ nguyên phần còn lại của chuỗi và query', () => {
    const { f, refs } = rw();
    expect(f(`xem ${U('avatars', 'u1/a%20b.jpg')}?t=5 xong`)).toBe('xem https://loloxyz.supabase.co/storage/v1/object/public/avatars/CID/u1/a%20b.jpg?t=5 xong');
    expect(refs).toEqual([{ bucket: 'avatars', path: 'u1/a b.jpg' }]);   // đường dẫn Storage thật (đã giải mã %20)
  });
  it('đệ quy: mảng, đối tượng lồng nhau, JSON bị nhét dạng chuỗi; không đụng số/null/boolean/khóa', () => {
    const { f, refs } = rw();
    const v = f({ a: [U('quote-images', 'x.png'), 5, null, true], b: { c: JSON.stringify({ img: U('avatars', 'y.png') }) } });
    expect(v.a[0]).toContain('loloxyz.supabase.co/storage/v1/object/public/quote-images/CID/x.png');
    expect(v.a.slice(1)).toEqual([5, null, true]);
    expect(JSON.parse(v.b.c).img).toContain('/avatars/CID/y.png');
    expect(refs).toHaveLength(2);
  });
  it('địa chỉ ngoài danh sách bucket, kiểu ký tên, host khác: KHÔNG sửa và báo skip (host khác thì lặng lẽ giữ nguyên)', () => {
    const { f, skipped } = rw();
    const legacy = U('purchase-order-pdfs', 'p.pdf'), signed = 'https://prodabc.supabase.co/storage/v1/object/sign/avatars/a.png?token=1', other = 'https://example.com/prodabc/x.png';
    expect(f(legacy)).toBe(legacy); expect(f(signed)).toBe(signed); expect(f(other)).toBe(other);
    expect(skipped).toEqual([legacy, 'https://prodabc.supabase.co/storage/v1/object/sign/avatars/a.png']);   // báo phần địa chỉ (không kèm ?token)
  });
  it('đổi nhiều địa chỉ trong 1 chuỗi; chuỗi đã là địa chỉ LoLo không bị đổi lần 2; countHostLeft đếm đúng', () => {
    const { f } = rw();
    const out = f(`${U('avatars', 'a.png')} và ${U('avatars', 'b.png')}`);
    expect(out.match(/loloxyz/g)).toHaveLength(2);
    expect(f(out)).toBe(out);
    expect(countHostLeft({ a: [U('avatars', 'a.png'), 'prodabc'], b: 'x' }, 'prodabc')).toBe(2);
    expect(countHostLeft(out, 'prodabc')).toBe(0);
  });
});

// ─── Luồng chính với CSDL giả ─────────────────────────────────────────────────────────────────────
const CID = 'cid-hltest', OTHER = 'cid-khac';
const URL_P = (b: string, p: string) => `https://prodabc.supabase.co/storage/v1/object/public/${b}/${p}`;
const col = (...c: string[]) => ({ columns: c, pk: ['id'], fks: [] as any[] });
const prodSchema = {
  projects: col('id', 'name', 'cover', 'created_at'),
  tasks: { columns: ['id', 'project_id', 'title', 'meta', 'created_at'], pk: ['id'], fks: [{ column: 'project_id', refTable: 'projects', refColumn: 'id' }] },
  employees: col('id', 'name', 'password', 'created_at'),
  push_subscriptions: col('id', 'endpoint', 'created_at'),
  business_profile: col('id', 'name', 'logo', 'created_at'),
  project_permissions: col('id', 'matrix', 'created_at'),
};
const loloSchema: any = Object.fromEntries(Object.entries(prodSchema).map(([t, s]: any) => [t, { ...s, columns: [...s.columns, 'company_id'], pk: ['company_id', 'id'] }]));

// Storage giả (trong bộ nhớ)
function makeStorage(prodFiles: Record<string, Buffer>, opts: { badSize?: string } = {}) {
  const lolo = new Map<string, Buffer>();
  const calls = { uploads: [] as string[], downloads: [] as string[] };
  const split = (k: string) => { const i = k.indexOf('/'); return [k.slice(0, i), k.slice(i + 1)]; };
  return {
    lolo, calls,
    listProd: async (bucket: string) => Object.entries(prodFiles).filter(([k]) => k.startsWith(bucket + '/')).map(([k, b]) => ({ path: split(k)[1], size: opts.badSize === k ? b.length + 1 : b.length, contentType: 'image/jpeg' })),
    listLolo: async (bucket: string, prefix: string) => [...lolo.entries()].filter(([k]) => k.startsWith(`${bucket}/${prefix}`)).map(([k, b]) => ({ path: split(k)[1], size: b.length })),
    download: async (bucket: string, p: string) => { calls.downloads.push(`${bucket}/${p}`); return prodFiles[`${bucket}/${p}`]; },
    upload: async (bucket: string, key: string, buf: Buffer) => { calls.uploads.push(`${bucket}/${key}`); lolo.set(`${bucket}/${key}`, buf); },
  };
}

// Production chỉ được ĐỌC: mọi lệnh ghi đều ném lỗi
const readOnly = (db: FakeDb) => {
  const base = db.client();
  return { ...base, from: (t: string) => { const q: any = base.from(t); for (const m of ['insert', 'update', 'upsert', 'delete']) q[m] = () => { throw new Error(`PRODUCTION BỊ GHI (${m} ${t})!`); }; return q; } };
};

describe('migrate — luồng đầy đủ', () => {
  let prodDb: FakeDb, loloDb: FakeDb, dir: string;
  const logs: string[] = [];
  const mkCtx = (over: any = {}, files?: Record<string, Buffer>, storageOpts: any = {}) => {
    const storage = makeStorage(files ?? {
      'quote-images/q/a b.jpg': Buffer.from('anh-1'), 'attendance-photos/e1/x.jpg': Buffer.from('anh-2'), 'avatars/u1/me.png': Buffer.from('anh-3'),
      'purchase-order-pdfs/p.pdf': Buffer.from('pdf'),
    }, storageOpts);
    return { storage, ctx: {
      prod: readOnly(prodDb), lolo: loloDb.client(), prodSchema, loloSchema, storage,
      target: { id: CID, slug: 'hltest' }, urls: { prodRef: 'prodabc', loloRef: 'loloxyz' },
      opts: { ghi: false, snapshotDir: dir, concurrency: 2, ...over }, log: (m: string) => logs.push(m),
    } };
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
    prodDb = new FakeDb(); loloDb = new FakeDb();
    const t = '2026-01-01T00:00:00+00:00';
    prodDb.seed('projects', [
      { id: 'p1', name: 'DA 1', cover: URL_P('quote-images', 'q/a%20b.jpg') + '?x=1', created_at: t },
      { id: 'p2', name: 'DA 2', cover: null, created_at: t },
    ]);
    prodDb.seed('tasks', [
      { id: 't1', project_id: 'p1', title: 'Việc 1', meta: { imgs: [URL_P('attendance-photos', 'e1/x.jpg')], note: JSON.stringify({ av: URL_P('avatars', 'u1/me.png') }) }, created_at: t },
      { id: 't2', project_id: 'p2', title: 'Việc 2', meta: {}, created_at: t },
    ]);
    prodDb.seed('employees', [{ id: 'e1', name: 'A', password: '$2a$10$hash', created_at: t }, { id: 'e2', name: 'B', password: '$2a$10$hash2', created_at: t }]);
    prodDb.seed('push_subscriptions', [{ id: 's1', endpoint: 'https://push/x', created_at: t }]);
    prodDb.seed('business_profile', [{ id: 'current', name: 'Công ty Hoàng Long', logo: URL_P('avatars', 'u1/me.png'), created_at: t }]);
    prodDb.seed('project_permissions', [{ id: 'global', matrix: { a: 1 }, created_at: t }]);
    loloDb.seed('companies', [{ id: CID, slug: 'hltest' }, { id: OTHER, slug: 'khac' }]);
    // LoLo: dữ liệu CŨ của công ty đích (phải bị xóa sạch) + dữ liệu của công ty KHÁC (không được đụng tới)
    loloDb.seed('projects', [{ id: 'cu', name: 'DA cũ', cover: null, created_at: t, company_id: CID }, { id: 'p1', name: 'CỦA CÔNG TY KHÁC', cover: null, created_at: t, company_id: OTHER }]);
    loloDb.seed('tasks', [{ id: 'tcu', project_id: 'cu', title: 'Việc cũ', meta: {}, created_at: t, company_id: CID }, { id: 't9', project_id: 'p1', title: 'khác', meta: {}, created_at: t, company_id: OTHER }]);
    loloDb.seed('employees', [{ id: 'ex', name: 'NV công ty khác', password: 'h', created_at: t, company_id: OTHER }]);
    loloDb.seed('push_subscriptions', []);
    loloDb.seed('business_profile', [{ id: OTHER, name: 'Công ty khác', logo: null, created_at: t, company_id: OTHER }]);
    loloDb.seed('project_permissions', []);
    logs.length = 0;
  });

  it('CHẠY THỬ: không ghi gì lên LoLo, không chép tệp; báo cáo đủ số dòng và tệp; sao lưu bản xuất ra thư mục', async () => {
    const { ctx, storage } = mkCtx();
    const before = JSON.stringify(loloDb.tables);
    const r = await migrate(ctx);
    expect(JSON.stringify(loloDb.tables)).toBe(before);                         // LoLo y nguyên
    expect(storage.calls.uploads).toEqual([]);
    expect(loloDb.log.some(l => /^(insert|update|upsert|delete):/.test(l))).toBe(false);
    expect(r.ghi).toBe(false);
    expect(r.tables).toMatchObject({ projects: { production: 2 }, tasks: { production: 2 }, employees: { production: 2 } });
    expect(r.bang_bo_qua).toEqual(['push_subscriptions']);
    expect(r.tables.push_subscriptions).toBeUndefined();
    expect(r.tep_duoc_nhac_toi).toBe(3);
    expect(fs.readFileSync(path.join(dir, 'projects.jsonl'), 'utf8').trim().split('\n')).toHaveLength(2);
    expect(r.thu_tu_nap.indexOf('projects')).toBeLessThan(r.thu_tu_nap.indexOf('tasks'));
  });

  it('GHI THẬT: xóa dữ liệu cũ CHỈ của công ty đích, nạp đúng dữ liệu + company_id, viết lại URL, chép tệp vào <company_id>/, mọi kiểm chứng đạt', async () => {
    const { ctx, storage } = mkCtx({ ghi: true });
    const r = await migrate(ctx);
    expect(r.dat).toBe(true);
    expect(r.kiem_chung.every((k: any) => k.ok)).toBe(true);
    // dữ liệu đích
    const mine = (t: string) => loloDb.table(t).filter(x => x.company_id === CID);
    expect(mine('projects').map(x => x.id).sort()).toEqual(['p1', 'p2']);       // 'cu' (dữ liệu cũ) đã bị xóa
    expect(mine('tasks').map(x => x.id).sort()).toEqual(['t1', 't2']);
    expect(mine('employees').map(x => x.password).sort()).toEqual(['$2a$10$hash', '$2a$10$hash2']);   // mật khẩu băm chép nguyên
    expect(loloDb.table('push_subscriptions')).toEqual([]);                      // bảng bị bỏ qua không được chép
    // URL
    expect(mine('projects').find(x => x.id === 'p1')!.cover).toBe(`https://loloxyz.supabase.co/storage/v1/object/public/quote-images/${CID}/q/a%20b.jpg?x=1`);
    const t1 = mine('tasks').find(x => x.id === 't1')!;
    expect(t1.meta.imgs[0]).toBe(`https://loloxyz.supabase.co/storage/v1/object/public/attendance-photos/${CID}/e1/x.jpg`);
    expect(JSON.parse(t1.meta.note).av).toContain(`/avatars/${CID}/u1/me.png`);
    expect(JSON.stringify(loloDb.tables)).not.toContain('prodabc');
    // Storage: đúng đường dẫn, đúng nội dung, bucket di sản KHÔNG chép
    expect([...storage.lolo.keys()].sort()).toEqual([`attendance-photos/${CID}/e1/x.jpg`, `avatars/${CID}/u1/me.png`, `quote-images/${CID}/q/a b.jpg`]);
    expect(storage.lolo.get(`quote-images/${CID}/q/a b.jpg`)!.toString()).toBe('anh-1');
    expect(fs.existsSync(path.join(dir, 'legacy', 'purchase-order-pdfs', 'p.pdf'))).toBe(true);   // chỉ sao lưu về máy
    // CÔNG TY KHÁC y nguyên
    expect(loloDb.table('projects').find(x => x.company_id === OTHER)).toMatchObject({ id: 'p1', name: 'CỦA CÔNG TY KHÁC' });
    expect(loloDb.table('tasks').filter(x => x.company_id === OTHER)).toHaveLength(1);
    expect(loloDb.table('employees').filter(x => x.company_id === OTHER)).toHaveLength(1);
    expect(loloDb.table('projects').every(x => x.company_id)).toBe(true);
  });

  it('thứ tự xóa: bảng con trước bảng cha; thứ tự nạp: bảng cha trước bảng con', async () => {
    const { ctx } = mkCtx({ ghi: true });
    await migrate(ctx);
    const log = loloDb.log;
    expect(log.indexOf('delete:tasks')).toBeLessThan(log.indexOf('delete:projects'));
    expect(log.indexOf('insert:projects')).toBeLessThan(log.indexOf('insert:tasks'));
  });

  it('chạy lại lần 2 ra đúng kết quả cũ (không nhân đôi dòng); tệp đã có đúng kích thước thì không tải lại', async () => {
    const a = mkCtx({ ghi: true }); await migrate(a.ctx);
    const b = mkCtx({ ghi: true }, undefined); b.ctx.storage = a.storage; b.ctx.lolo = loloDb.client();
    a.storage.calls.uploads.length = 0;
    const r = await migrate(b.ctx);
    expect(r.dat).toBe(true);
    expect(loloDb.table('projects').filter(x => x.company_id === CID)).toHaveLength(2);
    expect(a.storage.calls.uploads).toEqual([]);
    expect(r.storage['avatars'].bo_qua_vi_da_co).toBe(1);
  });

  it('DỪNG nếu production có cột mà LoLo chưa có — không ghi gì', async () => {
    const lolo2 = { ...loloSchema, projects: { ...loloSchema.projects, columns: loloSchema.projects.columns.filter((c: string) => c !== 'cover') } };
    const { ctx } = mkCtx({ ghi: true }); ctx.loloSchema = lolo2;
    await expect(migrate(ctx)).rejects.toThrow(/cột mà LoLo chưa có \(cover\)/);
    expect(loloDb.log.some(l => /^(insert|delete):/.test(l))).toBe(false);
  });

  it('DỪNG nếu production có bảng LoLo chưa có, hoặc 2 project trùng nhau, hoặc công ty đích sai/không có', async () => {
    let c = mkCtx({ ghi: true }); c.ctx.loloSchema = { ...loloSchema }; delete c.ctx.loloSchema.tasks;
    await expect(migrate(c.ctx)).rejects.toThrow(/LoLo chưa có: tasks/);
    c = mkCtx({ ghi: true }); c.ctx.urls = { prodRef: 'x', loloRef: 'x' };
    await expect(migrate(c.ctx)).rejects.toThrow(/trùng nhau/);
    c = mkCtx({ ghi: true }); c.ctx.target = { id: 'id-sai', slug: 'hltest' };
    await expect(migrate(c.ctx)).rejects.toThrow(/id khác/);
    c = mkCtx({ ghi: true }); c.ctx.target = { id: CID, slug: 'khong-co' };
    await expect(migrate(c.ctx)).rejects.toThrow(/chưa có trên LoLo/);
    expect(loloDb.log.some(l => /^(insert|delete):/.test(l))).toBe(false);
  });

  it('dữ liệu production thay đổi giữa lúc đếm và lúc đọc → dừng, không ghi', async () => {
    const { ctx } = mkCtx({ ghi: true });
    const real = ctx.prod.from;
    ctx.prod = { ...ctx.prod, from: (t: string) => { const q: any = real(t); const rg = q.range.bind(q); q.range = (a: number, b: number) => { const r: any = rg(a, b); return { then: (res: any) => r.then((x: any) => res({ ...x, data: (x.data || []).slice(1) })) }; }; return q; } };
    await expect(migrate(ctx)).rejects.toThrow(/đóng băng ghi/);
    expect(loloDb.log.some(l => /^(insert|delete):/.test(l))).toBe(false);
  });

  it('tải tệp về sai kích thước → dừng TRƯỚC khi xóa dữ liệu cũ (dữ liệu cũ của công ty đích còn nguyên)', async () => {
    const { ctx } = mkCtx({ ghi: true }, undefined, { badSize: 'avatars/u1/me.png' });
    await expect(migrate(ctx)).rejects.toThrow(/tải về/);
    expect(loloDb.table('projects').find(x => x.id === 'cu')).toBeTruthy();       // dữ liệu cũ chưa bị xóa
  });

  it('tệp được dữ liệu nhắc tới nhưng đã mất sẵn ở production → cảnh báo rõ ràng (không báo lỗi giả, không im lặng)', async () => {
    const { ctx } = mkCtx({ ghi: false }, { 'avatars/u1/me.png': Buffer.from('a') });   // thiếu 2 tệp so với dữ liệu nhắc tới
    const r = await migrate(ctx);
    expect(r.tep_nhac_toi_nhung_thieu).toBe(2);
    expect(r.canh_bao.join(' ')).toMatch(/2 tệp .* KHÔNG có trong Storage production/);
  });

  it('dòng mồ côi (vướng khóa ngoại): KHÔNG bị bỏ âm thầm — dừng và ghi rõ vào báo cáo', async () => {
    prodDb.seed('tasks', [{ id: 't3', project_id: 'khong-co', title: 'mồ côi', meta: {}, created_at: '2026-01-01T00:00:00+00:00' }]);
    const { ctx } = mkCtx({ ghi: true });
    const base = loloDb.client();
    ctx.lolo = { ...base, from: (t: string) => { const q: any = base.from(t); const ins = q.insert.bind(q);
      q.insert = (p: any) => { const rows = Array.isArray(p) ? p : [p]; if (t === 'tasks' && rows.some(r => !loloDb.table('projects').some(x => x.id === r.project_id && x.company_id === r.company_id))) return { then: (res: any) => Promise.resolve({ data: null, error: { code: '23503', message: 'fk' } }).then(res) }; return ins(p); }; return q; } };
    let err: any; try { await migrate(ctx); } catch (e) { err = e; }
    expect(err.message).toMatch(/KHÔNG nạp được/);
    expect(err.report.dong_mo_coi).toHaveLength(1);
    expect(err.report.dong_mo_coi[0].bang).toBe('tasks');
    expect(loloDb.table('tasks').filter(x => x.company_id === CID).map(x => x.id).sort()).toEqual(['t1', 't2']);   // các dòng hợp lệ vẫn vào
  });

  it('kiểm chứng PHÁT HIỆN dữ liệu bị sai lệch khi nạp (báo không đạt)', async () => {
    const { ctx } = mkCtx({ ghi: true });
    const base = loloDb.client();
    ctx.lolo = { ...base, from: (t: string) => { const q: any = base.from(t); const ins = q.insert.bind(q); q.insert = (p: any) => ins(Array.isArray(p) ? p.map((r: any) => (t === 'employees' ? { ...r, name: r.name + '!' } : r)) : p); return q; } };
    const r = await migrate(ctx);
    expect(r.dat).toBe(false);
    expect(r.kiem_chung.find((k: any) => k.ten.startsWith('Bảng employees'))!.ok).toBe(false);
  });

  it('PRODUCTION chỉ bị đọc: toàn bộ luồng chạy mà không có lệnh ghi nào (đã chặn bằng cách ném lỗi)', async () => {
    const { ctx } = mkCtx({ ghi: true });
    await expect(migrate(ctx)).resolves.toMatchObject({ dat: true });
  });

  it('phân trang xuất >1000 dòng: không sót, không trùng', async () => {
    const t = '2026-01-01T00:00:00+00:00';
    prodDb.seed('employees', Array.from({ length: 2500 }, (_, i) => ({ id: `n${String(i).padStart(5, '0')}`, name: `N${i}`, password: 'h', created_at: t })));
    const { ctx } = mkCtx({ ghi: true });
    const r = await migrate(ctx);
    expect(r.dat).toBe(true);
    expect(loloDb.table('employees').filter(x => x.company_id === CID)).toHaveLength(2502);
  });

  it('bảng có dòng rất nặng gây quá giờ: tự giảm cỡ trang, đọc đủ mọi dòng, không sót không trùng', async () => {
    const t = '2026-01-01T00:00:00+00:00';
    prodDb.seed('employees', Array.from({ length: 300 }, (_, i) => ({ id: `n${String(i).padStart(4, '0')}`, name: `N${i}`, password: 'h', created_at: t })));
    const tried: number[] = [];
    const base = prodDb.client();
    const slow = { from: (tb: string) => { const q: any = base.from(tb); const rg = q.range.bind(q); q.range = (a: number, b: number) => { tried.push(b - a + 1); return b - a + 1 > 50 ? { then: (res: any) => Promise.resolve({ data: null, error: { message: 'canceling statement due to statement timeout' } }).then(res) } : rg(a, b); }; return q; } };
    const rows = await readAll(slow, 'employees', ['id'], (m: string) => { throw new Error(m); });
    expect(rows).toHaveLength(302);
    expect(new Set(rows.map((r: any) => r.id)).size).toBe(302);
    expect(tried[0]).toBe(1000); expect(Math.min(...tried)).toBeLessThanOrEqual(50);
  });

  it('lỗi KHÁC (không phải quá giờ) khi đọc → dừng ngay, báo rõ', async () => {
    const bad = { from: () => ({ select: () => ({ order: () => ({ range: () => Promise.resolve({ data: null, error: { message: 'permission denied' } }) }) }) }) };
    let msg = '';
    await readAll(bad, 'x', ['id'], (m: string) => { msg = m; });
    expect(msg).toBe('permission denied');
  });

  it('5 bảng cấu hình "mỗi doanh nghiệp 1 dòng": id đổi từ chuỗi cố định sang company_id đích (ứng dụng đọc bằng id = company_id); công ty khác không bị đụng', async () => {
    expect(SINGLETON_ID_TABLES).toEqual(['business_profile', 'shift_config', 'hrm_task_permissions', 'project_permissions', 'document_templates']);
    const { ctx } = mkCtx({ ghi: true });
    const r = await migrate(ctx);
    expect(r.dat).toBe(true);
    const bp = loloDb.table('business_profile').filter(x => x.company_id === CID);
    expect(bp).toHaveLength(1);
    expect(bp[0].id).toBe(CID);                                                 // KHÔNG còn là 'current'
    expect(bp[0].name).toBe('Công ty Hoàng Long');
    expect(bp[0].logo).toContain(`/avatars/${CID}/u1/me.png`);                  // URL trong bảng cấu hình cũng được viết lại
    expect(loloDb.table('project_permissions').find(x => x.company_id === CID)!.id).toBe(CID);
    expect(loloDb.table('business_profile').find(x => x.company_id === OTHER)).toMatchObject({ id: OTHER, name: 'Công ty khác' });
    expect(r.id_doi).toEqual(expect.arrayContaining([{ bang: 'business_profile', tu: 'current', den: CID }, { bang: 'project_permissions', tu: 'global', den: CID }]));
  });

  it('bảng cấu hình 1-dòng mà production có >1 dòng → dừng (không đoán dòng nào đúng)', async () => {
    prodDb.seed('business_profile', [{ id: 'khac', name: 'Dòng thứ hai', logo: null, created_at: '2026-01-01T00:00:00+00:00' }]);
    const { ctx } = mkCtx({ ghi: true });
    await expect(migrate(ctx)).rejects.toThrow(/mỗi doanh nghiệp 1 dòng/);
    expect(loloDb.log.some(l => /^(insert|delete):/.test(l))).toBe(false);
  });

  it('thứ tự nạp dùng cả khóa ngoại ghép đọc từ migration (extraFks) — bảng con chỉ có khóa ngoại ở LoLo vẫn nạp sau bảng cha', async () => {
    const { ctx } = mkCtx({ ghi: false });
    ctx.extraFks = [{ table: 'projects', column: 'x', refTable: 'employees' }];       // giả lập: projects phụ thuộc employees
    const r = await migrate(ctx);
    expect(r.thu_tu_nap.indexOf('employees')).toBeLessThan(r.thu_tu_nap.indexOf('projects'));
    expect(r.thu_tu_nap.indexOf('projects')).toBeLessThan(r.thu_tu_nap.indexOf('tasks'));
  });

  it('withRetry: lỗi mạng thoáng qua thì thử lại và thành công; lỗi khác thì ném ngay; quá số lần thì bỏ cuộc', async () => {
    const sleep = async () => {};
    let n = 0;
    expect(await withRetry(async () => { if (++n < 3) throw new Error('terminated'); return 'xong'; }, { sleep })).toBe('xong');
    expect(n).toBe(3);
    let m = 0;
    await expect(withRetry(async () => { m++; throw new Error('permission denied'); }, { sleep })).rejects.toThrow('permission denied');
    expect(m).toBe(1);                                                    // lỗi không phải mạng → không thử lại
    let k = 0;
    await expect(withRetry(async () => { k++; throw new Error('fetch failed'); }, { sleep, tries: 4 })).rejects.toThrow('fetch failed');
    expect(k).toBe(4);
    expect(['terminated', 'fetch failed', 'ECONNRESET', 'Gateway 502', 'socket hang up'].every(isTransient)).toBe(true);
    expect(isTransient('violates foreign key')).toBe(false);
  });

  it('đọc bảng gặp lỗi mạng giữa chừng: thử lại đúng trang đó, không sót không trùng', async () => {
    const t = '2026-01-01T00:00:00+00:00';
    prodDb.seed('employees', Array.from({ length: 120 }, (_, i) => ({ id: `n${String(i).padStart(4, '0')}`, name: `N${i}`, password: 'h', created_at: t })));
    const base = prodDb.client(); let calls = 0;
    const flaky = { from: (tb: string) => { const q: any = base.from(tb); const rg = q.range.bind(q); q.range = (a: number, b: number) => (++calls === 2 || calls === 3) ? { then: (res: any) => Promise.resolve({ data: null, error: { message: 'TypeError: fetch failed' } }).then(res) } : rg(a, b); return q; } };
    const rows = await readAll(flaky, 'employees', ['id'], (m: string) => { throw new Error(m); }, 50, async () => {});
    expect(rows).toHaveLength(122);
    expect(new Set(rows.map((r: any) => r.id)).size).toBe(122);
  });

  it('bảng BỊ BỎ QUA khi chép (push_subscriptions → employees) vẫn được dọn khi xóa dữ liệu cũ, nếu không sẽ chặn xóa bảng cha', async () => {
    const t = '2026-01-01T00:00:00+00:00';
    loloDb.seed('push_subscriptions', [{ id: 'ps1', endpoint: 'cu', created_at: t, company_id: CID }, { id: 'ps2', endpoint: 'cua-cong-ty-khac', created_at: t, company_id: OTHER }]);
    const { ctx } = mkCtx({ ghi: true });
    const base = loloDb.client();
    // Giả lập khóa ngoại thật: xóa employees của công ty đích khi push_subscriptions của công ty đó còn → lỗi 23503
    ctx.lolo = { ...base, from: (tb: string) => { const q: any = base.from(tb); if (tb === 'employees') { const del = q.delete.bind(q); q.delete = () => { const d: any = del(); const eq = d.eq.bind(d);
      d.eq = (c: string, v: string) => (loloDb.table('push_subscriptions').some(r => r.company_id === v) ? { then: (res: any) => Promise.resolve({ data: null, error: { code: '23503', message: 'fk push_subscriptions_user_id_fkey' } }).then(res) } : eq(c, v)); return d; }; } return q; } };
    const r = await migrate(ctx);
    expect(r.dat).toBe(true);
    expect(loloDb.table('push_subscriptions').filter(x => x.company_id === CID)).toEqual([]);          // đã dọn, không nạp lại
    expect(loloDb.table('push_subscriptions').filter(x => x.company_id === OTHER)).toHaveLength(1);    // công ty khác y nguyên
  });

  it('không xóa sạch được thì thông báo RÕ bảng nào còn vướng và vì sao', async () => {
    const { ctx } = mkCtx({ ghi: true });
    const base = loloDb.client();
    ctx.lolo = { ...base, from: (tb: string) => { const q: any = base.from(tb); if (tb === 'employees') { const del = q.delete.bind(q); q.delete = () => { const d: any = del(); d.eq = () => ({ then: (res: any) => Promise.resolve({ data: null, error: { code: '23503', message: 'bang_la_con_tro_toi_employees' } }).then(res) }); return d; }; } return q; } };
    await expect(migrate(ctx)).rejects.toThrow(/Bảng còn vướng: employees \(bang_la_con_tro_toi_employees\)/);
  });
});
