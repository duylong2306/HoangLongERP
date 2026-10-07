import { describe, it, expect, beforeEach } from 'vitest';
import {
  decodeJwtClaims, sanitizeIds, pgIn, isUuid, authenticateCaller, pushToUsers, handleSendPush,
} from '../../../supabase/functions/_shared/tenant-core';
import { runAttendanceReminders, shiftWindow, vnDateParts } from '../../../supabase/functions/_shared/attendance-core';

// Test các hàm Edge đa doanh nghiệp bằng "máy chủ REST giả" trong bộ nhớ: kiểm tra đúng tình huống nguy hiểm — 2 công ty cùng có
// mã nhân viên "emp_admin" — thông báo/đăng ký/xóa KHÔNG được vượt sang công ty khác.

const A = '11111111-1111-4111-8111-111111111111';   // công ty A
const B = '22222222-2222-4222-8222-222222222222';   // công ty B
const SERVICE = 'service-key-bi-mat', ANON = 'anon-key-cong-khai';
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (claims: object) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.chu-ky`;
const tokA = jwt({ role: 'authenticated', company_id: A, sub: 'emp_admin' });
const tokB = jwt({ role: 'authenticated', company_id: B, sub: 'emp_admin' });
const tokAnon = jwt({ role: 'anon' });

type Row = Record<string, any>;
// Máy chủ REST giả: GET/PATCH/DELETE/POST theo bộ lọc PostgREST (eq / in / lt / neq); mô phỏng RLS cho token người dùng
function makeRest(db: Record<string, Row[]>, validTokens: string[]) {
  const calls: { method: string; table: string; query: string; body?: any }[] = [];
  const parseVal = (s: string) => { const m = s.match(/^in\.\((.*)\)$/); return m ? { op: 'in', v: m[1].split(',').map(x => x.replace(/^"|"$/g, '')) } : { op: s.slice(0, s.indexOf('.')), v: s.slice(s.indexOf('.') + 1) }; };
  const fetchFn = async (url: string, init: any = {}) => {
    const u = new URL(url); const table = u.pathname.split('/rest/v1/')[1]; const method = (init.method || 'GET').toUpperCase();
    const auth = String(init.headers?.Authorization || '').replace('Bearer ', '');
    calls.push({ method, table, query: u.search, body: init.body ? JSON.parse(init.body) : undefined });
    let rows = db[table] || (db[table] = []);
    if (auth !== SERVICE) {                                       // người dùng: phải là token hợp lệ; RLS chỉ cho thấy công ty của token
      if (!validTokens.includes(auth)) return { ok: false, status: 401, json: async () => ({ message: 'invalid jwt' }), text: async () => 'invalid jwt' };
      const cid = decodeJwtClaims(auth)?.company_id; rows = rows.filter(r => r.company_id === cid);
    }
    const filters = [...u.searchParams.entries()].filter(([k]) => !['select', 'limit', 'order'].includes(k));
    const match = (r: Row) => filters.every(([k, raw]) => {
      const { op, v } = parseVal(raw as string);
      if (op === 'eq') return String(r[k]) === v; if (op === 'neq') return String(r[k]) !== v;
      if (op === 'in') return (v as string[]).includes(String(r[k])); if (op === 'lt') return String(r[k]) < (v as string);
      return true;
    });
    const ok = (data: any) => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) });
    if (method === 'GET') { let out = rows.filter(match); const lim = u.searchParams.get('limit'); if (lim) out = out.slice(0, Number(lim)); return ok(out); }
    if (method === 'DELETE') { db[table] = (db[table] || []).filter(r => !match(r)); return ok([]); }
    if (method === 'PATCH') { (db[table] || []).filter(match).forEach(r => Object.assign(r, JSON.parse(init.body))); return ok([]); }
    if (method === 'POST') { const b = JSON.parse(init.body); if ((db[table] || []).some(r => r.id === b.id)) return { ok: false, status: 409, json: async () => ({}), text: async () => 'duplicate' }; (db[table] = db[table] || []).push(b); return ok([]); }
    return ok([]);
  };
  return { fetchFn, calls };
}
function makeWebPush(opts: { dead?: string[]; flaky?: string[] } = {}) {
  const sent: { endpoint: string; payload: string }[] = [];
  return { sent, webPush: { sendNotification: async (sub: any, payload: string) => {
    if (opts.dead?.includes(sub.endpoint)) throw Object.assign(new Error('gone'), { statusCode: 410 });
    if (opts.flaky?.includes(sub.endpoint)) throw Object.assign(new Error('tam thoi'), { statusCode: 503 });
    sent.push({ endpoint: sub.endpoint, payload }); } } };
}
const ENV = { SUPABASE_URL: 'https://x.supabase.co', SERVICE_KEY: SERVICE, ANON_KEY: ANON, VAPID_PRIV: 'p', VAPID_PUB: 'q' };

describe('hàm thuần', () => {
  it('decodeJwtClaims đọc được phần dữ liệu (cả tiếng Việt), trả null nếu rác', () => {
    expect(decodeJwtClaims(tokA)).toMatchObject({ role: 'authenticated', company_id: A, sub: 'emp_admin' });
    expect(decodeJwtClaims(jwt({ name: 'Nguyễn Văn Đạt' }))?.name).toBe('Nguyễn Văn Đạt');
    expect(decodeJwtClaims('rac')).toBeNull(); expect(decodeJwtClaims('a.%%%.c')).toBeNull();
  });
  it('sanitizeIds: chỉ giữ mã an toàn, bỏ trùng, chặn mã chứa dấu nháy/phẩy (chống phá bộ lọc), giới hạn số lượng', () => {
    expect(sanitizeIds(['a', 'a', 'emp_1', 'x"y', 'a,b', '', 5, null, 'ok:1@x-2'])).toEqual(['a', 'emp_1', 'ok:1@x-2']);
    expect(sanitizeIds('khong-phai-mang')).toEqual([]);
    expect(sanitizeIds(Array.from({ length: 900 }, (_, i) => `u${i}`))).toHaveLength(500);
    expect(pgIn(['a', 'b'])).toBe('in.("a","b")');
    expect(isUuid(A)).toBe(true); expect(isUuid('abc')).toBe(false); expect(isUuid(null)).toBe(false);
  });
});

describe('authenticateCaller', () => {
  let db: Record<string, Row[]>; let rest: ReturnType<typeof makeRest>;
  beforeEach(() => {
    db = { employees: [{ id: 'emp_admin', company_id: A }, { id: 'emp_admin', company_id: B }, { id: 'nv_chi_o_A', company_id: A }] };
    rest = makeRest(db, [tokA, tokB, jwt({ role: 'authenticated', company_id: A, sub: 'nv_khong_co' }), jwt({ role: 'authenticated', company_id: B, sub: 'nv_chi_o_A' })]);
  });
  const call = (authorization: string | null) => authenticateCaller({ authorization, serviceKey: SERVICE, anonKey: ANON, supabaseUrl: ENV.SUPABASE_URL, fetchFn: rest.fetchFn as any });

  it('nhân viên đăng nhập hợp lệ → công ty lấy TỪ TOKEN', async () => {
    expect(await call(`Bearer ${tokA}`)).toEqual({ ok: true, caller: { kind: 'user', companyId: A, userId: 'emp_admin' } });
    expect(await call(`Bearer ${tokB}`)).toEqual({ ok: true, caller: { kind: 'user', companyId: B, userId: 'emp_admin' } });
  });
  it('khóa service_role khớp chính xác → máy chủ', async () => { expect(await call(`Bearer ${SERVICE}`)).toEqual({ ok: true, caller: { kind: 'service' } }); });
  it('KHÓA ANON công khai / thiếu token / token rác / nhân viên không có thật / sub của công ty khác → 401', async () => {
    for (const a of [`Bearer ${ANON}`, `Bearer ${tokAnon}`, null, '', 'Bearer rac.rac.rac', `Bearer ${jwt({ role: 'authenticated', company_id: A, sub: 'nv_khong_co' })}`, `Bearer ${jwt({ role: 'authenticated', company_id: B, sub: 'nv_chi_o_A' })}`]) {
      const r = await call(a as any); expect(r.ok).toBe(false); expect((r as any).status).toBe(401);
    }
  });
  it('token đúng dạng nhưng chữ ký sai (PostgREST từ chối) → 401', async () => {
    const r = await call(`Bearer ${jwt({ role: 'authenticated', company_id: A, sub: 'emp_admin' })}X`); expect(r.ok).toBe(false);
  });
  it('công ty bị khóa (RLS không trả dòng nào) → 401', async () => {
    db.employees = db.employees.filter(e => e.company_id !== A);   // giả lập company_live chặn đọc
    expect((await call(`Bearer ${tokA}`)).ok).toBe(false);
  });
});

describe('send-push đa doanh nghiệp', () => {
  let db: Record<string, Row[]>; let rest: ReturnType<typeof makeRest>;
  beforeEach(() => {
    db = {
      employees: [{ id: 'emp_admin', company_id: A }, { id: 'emp_admin', company_id: B }],
      push_subscriptions: [
        { id: 'sa', company_id: A, user_id: 'emp_admin', endpoint: 'https://push/A-admin', p256dh: 'k', auth: 'a', created_at: new Date().toISOString() },
        { id: 'sb', company_id: B, user_id: 'emp_admin', endpoint: 'https://push/B-admin', p256dh: 'k', auth: 'a', created_at: new Date().toISOString() },
        { id: 'sa2', company_id: A, user_id: 'nv2', endpoint: 'https://push/A-nv2', p256dh: 'k', auth: 'a', created_at: new Date().toISOString() },
      ],
    };
    rest = makeRest(db, [tokA, tokB]);
  });
  const send = (token: string, body: any, wp = makeWebPush(), env: any = ENV) =>
    handleSendPush({ method: 'POST', authorization: `Bearer ${token}`, body }, env, { fetchFn: rest.fetchFn as any, webPush: wp.webPush }).then(r => ({ ...r, wp }));

  it('NHÂN VIÊN CÔNG TY A gửi cho "emp_admin" → CHỈ thiết bị của A nhận, công ty B (cũng có emp_admin) KHÔNG nhận', async () => {
    const r = await send(tokA, { userIds: ['emp_admin'], title: 'Xin chào', body: 'nội dung' });
    expect(r.status).toBe(200); expect(r.json.successCount).toBe(1);
    expect(r.wp.sent.map(s => s.endpoint)).toEqual(['https://push/A-admin']);
    const r2 = await send(tokB, { userIds: ['emp_admin'] });
    expect(r2.wp.sent.map(s => s.endpoint)).toEqual(['https://push/B-admin']);
  });
  it('client gửi companyId của công ty KHÁC trong body → bị bỏ qua, vẫn theo công ty trong token', async () => {
    const r = await send(tokA, { userIds: ['emp_admin'], companyId: B });
    expect(r.wp.sent.map(s => s.endpoint)).toEqual(['https://push/A-admin']);
  });
  it('khóa anon công khai / không đăng nhập → 401 và KHÔNG gửi gì', async () => {
    const wp = makeWebPush();
    for (const t of [ANON, tokAnon]) { const r = await send(t, { userIds: ['emp_admin'] }, wp); expect(r.status).toBe(401); }
    expect(wp.sent).toEqual([]);
  });
  it('máy chủ (service_role) phải nói rõ companyId; có thì gửi đúng công ty đó', async () => {
    expect((await send(SERVICE, { userIds: ['emp_admin'] })).status).toBe(400);
    const r = await send(SERVICE, { userIds: ['emp_admin'], companyId: B });
    expect(r.wp.sent.map(s => s.endpoint)).toEqual(['https://push/B-admin']);
  });
  it('thiếu/bậy userIds → 400; mã chứa ký tự phá bộ lọc bị loại; sai phương thức → 405; thiếu biến môi trường → 500', async () => {
    expect((await send(tokA, { userIds: [] })).status).toBe(400);
    expect((await send(tokA, { userIds: ['x"),a=eq.1', 'a,b'] })).status).toBe(400);
    expect((await handleSendPush({ method: 'GET', authorization: null, body: {} }, ENV, { fetchFn: rest.fetchFn as any, webPush: makeWebPush().webPush })).status).toBe(405);
    expect((await send(tokA, { userIds: ['a'] }, makeWebPush(), { ...ENV, VAPID_PRIV: undefined })).status).toBe(500);
  });
  it('endpoint chết thật (410) bị xóa CHỈ trong công ty gửi; lỗi tạm thời (503) giữ lại; endpoint cùng tên ở công ty khác không đụng', async () => {
    db.push_subscriptions.push({ id: 'sb-trung', company_id: B, user_id: 'emp_admin', endpoint: 'https://push/A-admin', p256dh: 'k', auth: 'a', created_at: new Date().toISOString() });   // trùng endpoint nhưng ở công ty B
    db.push_subscriptions.push({ id: 'sa3', company_id: A, user_id: 'emp_admin', endpoint: 'https://push/A-tam', p256dh: 'k', auth: 'a', created_at: new Date().toISOString() });
    const r = await send(tokA, { userIds: ['emp_admin'] }, makeWebPush({ dead: ['https://push/A-admin'], flaky: ['https://push/A-tam'] }));
    expect(r.json).toMatchObject({ successCount: 0, failureCount: 2, removedSubscriptions: 1 });
    expect(db.push_subscriptions.find(s => s.id === 'sa')).toBeUndefined();            // đã xóa (chết thật)
    expect(db.push_subscriptions.find(s => s.id === 'sa3')).toBeDefined();             // lỗi tạm thời: giữ
    expect(db.push_subscriptions.find(s => s.id === 'sb-trung')).toBeDefined();        // công ty khác y nguyên
  });
  it('dọn đăng ký quá 90 ngày CHỈ trong công ty gửi', async () => {
    const cu = new Date(Date.now() - 100 * 86400000).toISOString();
    db.push_subscriptions.push({ id: 'cuA', company_id: A, user_id: 'x', endpoint: 'e1', p256dh: 'k', auth: 'a', created_at: cu }, { id: 'cuB', company_id: B, user_id: 'x', endpoint: 'e2', p256dh: 'k', auth: 'a', created_at: cu });
    await send(tokA, { userIds: ['emp_admin'] });
    expect(db.push_subscriptions.find(s => s.id === 'cuA')).toBeUndefined();
    expect(db.push_subscriptions.find(s => s.id === 'cuB')).toBeDefined();
  });
  it('không có thiết bị nào → 200 note, không lỗi', async () => {
    const r = await send(tokA, { userIds: ['khong_ai'] });
    expect(r.status).toBe(200); expect(r.json.note).toBe('no subscriptions');
  });
  it('pushToUsers: mọi truy vấn có bộ lọc company_id', async () => {
    const wp = makeWebPush();
    await pushToUsers({ supabaseUrl: ENV.SUPABASE_URL, serviceKey: SERVICE, fetchFn: rest.fetchFn as any, webPush: wp.webPush }, A, ['emp_admin'], '{}');
    expect(rest.calls.filter(c => c.table === 'push_subscriptions').every(c => c.query.includes(`company_id=eq.${A}`))).toBe(true);
  });
});

describe('nhắc điểm danh đa doanh nghiệp', () => {
  // 07:10 giờ VN, Thứ Hai 5/10/2026 = 00:10 UTC
  const THU_HAI_7H10 = new Date('2026-10-05T00:10:00Z');
  let db: Record<string, Row[]>; let rest: ReturnType<typeof makeRest>;
  const run = (now: Date, wp = makeWebPush()) => runAttendanceReminders({ supabaseUrl: ENV.SUPABASE_URL, serviceKey: SERVICE, fetchFn: rest.fetchFn as any, webPush: wp.webPush, now }).then(r => ({ r, wp }));
  const sub = (company: string, user: string, ep: string) => ({ id: `${company}-${user}`, company_id: company, user_id: user, endpoint: ep, p256dh: 'k', auth: 'a', created_at: new Date().toISOString() });

  beforeEach(() => {
    db = {
      companies: [{ id: A, slug: 'cong-ty-a', active: true, expires_at: null }, { id: B, slug: 'cong-ty-b', active: true, expires_at: null }],
      shift_config: [{ id: A, company_id: A, weekend_days: [0] }, { id: B, company_id: B, weekend_days: [0, 1] }],   // công ty B nghỉ cả Thứ Hai
      hrm_holidays: [],
      employees: [
        { id: 'emp_admin', name: 'Admin A', department: 'P1', status: 'working', company_id: A, last_attendance_reminder_sent: '' },
        { id: 'nv2', name: 'NV2 A', department: 'P1', status: 'working', company_id: A, last_attendance_reminder_sent: '' },
        { id: 'nghi', name: 'Nghỉ việc', department: 'P1', status: 'resigned', company_id: A, last_attendance_reminder_sent: '' },
        { id: 'emp_admin', name: 'Admin B', department: 'P9', status: 'working', company_id: B, last_attendance_reminder_sent: '' },
      ],
      push_subscriptions: [sub(A, 'emp_admin', 'https://push/A1'), sub(A, 'nv2', 'https://push/A2'), sub(B, 'emp_admin', 'https://push/B1')],
      notifications: [],
    };
    rest = makeRest(db, []);
  });

  it('khung giờ: 07:00–07:30 và 12:30–13:00 (giờ VN); ngoài khung thì bỏ qua', () => {
    expect(shiftWindow(new Date('2026-10-05T00:00:00Z')).shift).toBe('morning');
    expect(shiftWindow(new Date('2026-10-05T00:30:00Z')).shift).toBe('morning');
    expect(shiftWindow(new Date('2026-10-05T00:31:00Z')).shift).toBeNull();
    expect(shiftWindow(new Date('2026-10-05T05:30:00Z')).shift).toBe('afternoon');
    expect(shiftWindow(new Date('2026-10-05T06:01:00Z')).shift).toBeNull();
    expect(vnDateParts(new Date('2026-10-05T00:10:00Z'))).toMatchObject({ dow: 1, ddmm: '05/10', today: '2026-10-05' });
  });

  it('ngoài khung giờ → không làm gì', async () => {
    const { r, wp } = await run(new Date('2026-10-05T03:00:00Z'));
    expect(r).toMatchObject({ success: false, reason: 'outside_time_window' }); expect(wp.sent).toEqual([]);
  });

  it('MỖI công ty theo ngày nghỉ RIÊNG: Thứ Hai A đi làm (được nhắc), B nghỉ (bỏ qua). Mã emp_admin trùng nhau nhưng KHÔNG lẫn', async () => {
    const { r, wp } = await run(THU_HAI_7H10);
    expect(r.companies).toEqual([
      expect.objectContaining({ company: 'cong-ty-a', needsReminder: 2, pushSent: 2 }),
      { company: 'cong-ty-b', skipped: 'weekend' },
    ]);
    expect(wp.sent.map(s => s.endpoint).sort()).toEqual(['https://push/A1', 'https://push/A2']);   // B1 KHÔNG được gửi
    expect(wp.sent.every(s => JSON.parse(s.payload).title === '⏰ Điểm danh Ca Sáng')).toBe(true);
  });

  it('đánh dấu "đã nhắc hôm nay" CHỈ cho nhân viên của đúng công ty (emp_admin của B không bị đánh dấu); người nghỉ việc không được nhắc', async () => {
    await run(THU_HAI_7H10);
    const a = db.employees.filter(e => e.company_id === A);
    expect(a.find(e => e.id === 'emp_admin')!.last_attendance_reminder_sent).toBe('2026-10-05');
    expect(a.find(e => e.id === 'nghi')!.last_attendance_reminder_sent).toBe('');
    expect(db.employees.find(e => e.company_id === B)!.last_attendance_reminder_sent).toBe('');
  });

  it('thông báo trong ứng dụng ghi kèm company_id đúng; chạy lại cùng ngày KHÔNG nhắc trùng (đã sửa lỗi cũ)', async () => {
    await run(THU_HAI_7H10);
    expect(db.notifications.map(n => n.company_id)).toEqual([A, A]);
    expect(db.notifications.every(n => n.category === 'attendance' && n.id.includes(A.slice(0, 8)))).toBe(true);
    const wp2 = makeWebPush();
    const again = await run(new Date('2026-10-05T00:20:00Z'), wp2);
    expect(wp2.sent).toEqual([]);
    expect(again.r.companies![0]).toMatchObject({ company: 'cong-ty-a', needsReminder: 0 });
  });

  it('ngày lễ riêng của công ty: A có lễ hôm nay thì A bỏ qua, B (không lễ) vẫn được nhắc nếu đi làm', async () => {
    db.hrm_holidays = [{ id: 'h1', company_id: A, date: '06/10' }];
    const { r, wp } = await run(new Date('2026-10-06T00:10:00Z'));   // Thứ Ba 6/10
    expect(r.companies).toEqual([{ company: 'cong-ty-a', skipped: 'holiday' }, expect.objectContaining({ company: 'cong-ty-b', needsReminder: 1, pushSent: 1 })]);
    expect(wp.sent.map(s => s.endpoint)).toEqual(['https://push/B1']);
  });

  it('công ty bị khóa hoặc hết hạn KHÔNG được nhắc', async () => {
    db.companies[0].active = false; db.companies[1].expires_at = '2026-10-05T00:00:00Z';   // đã hết hạn so với giờ giả lập 6/10
    const { r } = await run(new Date('2026-10-06T00:10:00Z'));
    expect(r.companies).toEqual([]);
  });

  it('lỗi ở 1 công ty không chặn công ty khác', async () => {
    const real = rest.fetchFn;
    const flaky = async (url: string, init?: any) => (url.includes('employees?') && url.includes(`company_id=eq.${A}`) && (init?.method || 'GET') === 'GET' ? { ok: false, status: 500, json: async () => ({}), text: async () => 'boom' } : real(url, init));
    const r = await runAttendanceReminders({ supabaseUrl: ENV.SUPABASE_URL, serviceKey: SERVICE, fetchFn: flaky as any, webPush: makeWebPush().webPush, now: new Date('2026-10-06T00:10:00Z') });
    expect(r.companies![0]).toMatchObject({ company: 'cong-ty-a' }); expect(r.companies![0].error).toMatch(/employees/);
    expect(r.companies![1]).toMatchObject({ company: 'cong-ty-b', pushSent: 1 });
  });

  it('thiếu cấu hình ca → mặc định nghỉ Chủ nhật (như cũ); Chủ nhật bị bỏ qua', async () => {
    db.shift_config = [];
    expect((await run(new Date('2026-10-04T00:10:00Z'))).r.companies).toEqual([{ company: 'cong-ty-a', skipped: 'weekend' }, { company: 'cong-ty-b', skipped: 'weekend' }]);   // 4/10 = Chủ nhật
    expect((await run(THU_HAI_7H10)).r.companies![0]).toMatchObject({ pushSent: 2 });
  });
});
