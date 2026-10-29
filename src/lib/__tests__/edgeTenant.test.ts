import { describe, it, expect, beforeEach } from 'vitest';
import {
  decodeJwtClaims, sanitizeIds, pgIn, isUuid, authenticateCaller, isServiceToken, pushToUsers, handleSendPush,
} from '../../../supabase/functions/_shared/tenant-core';
import { runAttendanceReminders, reminderPlan, openLeadMinutes, vnDateParts } from '../../../supabase/functions/_shared/attendance-core';

// Test các hàm Edge đa doanh nghiệp bằng "máy chủ REST giả" trong bộ nhớ: kiểm tra đúng tình huống nguy hiểm — 2 công ty cùng có
// mã nhân viên "emp_admin" — thông báo/đăng ký/xóa KHÔNG được vượt sang công ty khác.

const A = '11111111-1111-4111-8111-111111111111';   // công ty A
const B = '22222222-2222-4222-8222-222222222222';   // công ty B
const SERVICE = 'service-key-bi-mat', ANON = 'anon-key-cong-khai';
const SERVICE_KHAC = 'sb_secret_dinh-dang-moi';                                   // khóa cấp máy chủ HỢP LỆ nhưng khác chuỗi mà hàm Edge nhận
const tokServiceJwt = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from('{"role":"service_role"}').toString('base64url')}.chu-ky`;   // tự nhận service_role nhưng chữ ký GIẢ
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (claims: object) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.chu-ky`;
const tokA = jwt({ role: 'authenticated', company_id: A, sub: 'emp_admin' });
const tokB = jwt({ role: 'authenticated', company_id: B, sub: 'emp_admin' });
const tokAnon = jwt({ role: 'anon' });

type Row = Record<string, any>;
// Máy chủ REST giả: GET/PATCH/DELETE/POST theo bộ lọc PostgREST (eq / in / lt / neq); mô phỏng RLS cho token người dùng
function makeRest(db: Record<string, Row[]>, validTokens: string[]) {
  db.companies ||= [{ id: 'c-bat-ky', slug: 'bat-ky' }];   // bảng companies luôn có dòng (đọc được chỉ với khóa cấp máy chủ)
  const calls: { method: string; table: string; query: string; body?: any }[] = [];
  const parseVal = (s: string) => { const m = s.match(/^in\.\((.*)\)$/); return m ? { op: 'in', v: m[1].split(',').map(x => x.replace(/^"|"$/g, '')) } : { op: s.slice(0, s.indexOf('.')), v: s.slice(s.indexOf('.') + 1) }; };
  const fetchFn = async (url: string, init: any = {}) => {
    const u = new URL(url); const table = u.pathname.split('/rest/v1/')[1]; const method = (init.method || 'GET').toUpperCase();
    const auth = String(init.headers?.Authorization || '').replace('Bearer ', '');
    calls.push({ method, table, query: u.search, body: init.body ? JSON.parse(init.body) : undefined });
    let rows = db[table] || (db[table] = []);
    if (auth !== SERVICE && auth !== SERVICE_KHAC) {                                       // người dùng: phải là token hợp lệ; RLS chỉ cho thấy công ty của token
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
    if (method === 'POST') { const b = JSON.parse(init.body); const same = (r: Row) => (table === 'attendance_chat_notified' ? r.company_id === b.company_id && r.date === b.date && r.slot === b.slot : r.id === b.id);   // khóa chính của bảng claim = (company_id, date, slot)
    if ((db[table] || []).some(same)) return { ok: false, status: 409, json: async () => ({}), text: async () => 'duplicate' }; (db[table] = db[table] || []).push(b); return ok([]); }
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
  it('khóa service_role khớp chính xác → máy chủ; khóa máy chủ dạng khác (sb_secret_) cũng được nhận qua xác nhận của cơ sở dữ liệu', async () => {
    expect(await call(`Bearer ${SERVICE}`)).toEqual({ ok: true, caller: { kind: 'service' } });
    expect(await call(`Bearer ${SERVICE_KHAC}`)).toEqual({ ok: true, caller: { kind: 'service' } });
  });
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

describe('isServiceToken — nhận diện khóa cấp máy chủ', () => {
  const rest = makeRest({}, []);
  const chk = (token: string) => isServiceToken({ token, serviceKey: SERVICE, supabaseUrl: ENV.SUPABASE_URL, fetchFn: rest.fetchFn as any });
  it('khớp chính xác → có; khóa dạng khác nhưng cơ sở dữ liệu xác nhận (đọc được companies) → có', async () => {
    expect(await chk(SERVICE)).toBe(true);
    expect(await chk(SERVICE_KHAC)).toBe(true);
  });
  it('khóa anon, token đăng nhập, chuỗi rác, token TỰ NHẬN service_role nhưng chữ ký giả, rỗng → không', async () => {
    for (const t of [ANON, tokA, tokAnon, 'rac', '', tokServiceJwt]) expect(await chk(t)).toBe(false);
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
    // thiếu khóa VAPID nhưng người gọi CHƯA đăng nhập → vẫn 401 (không lộ cấu hình thiếu gì)
    expect((await send(ANON, { userIds: ['a'] }, makeWebPush(), { ...ENV, VAPID_PRIV: undefined, VAPID_PUB: undefined })).status).toBe(401);
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

describe('nhắc điểm danh đa doanh nghiệp (giờ nhắc theo cấu hình ca từng công ty)', () => {
  // 07:20 giờ VN, Thứ Hai 5/10/2026 = 00:20 UTC. Công ty A: vào ca 07:30, mở điểm danh trước 15 phút → cửa sổ nhắc 07:15–07:30
  const THU_HAI_7H20 = new Date('2026-10-05T00:20:00Z');
  const THU_HAI_12H50 = new Date('2026-10-05T05:50:00Z');   // cửa sổ ca chiều (vào ca 13:00 → 12:45–13:00)
  let db: Record<string, Row[]>; let rest: ReturnType<typeof makeRest>;
  const run = (now: Date, wp = makeWebPush()) => runAttendanceReminders({ supabaseUrl: ENV.SUPABASE_URL, serviceKey: SERVICE, fetchFn: rest.fetchFn as any, webPush: wp.webPush, now }).then(r => ({ r, wp }));
  const sub = (company: string, user: string, ep: string) => ({ id: `${company}-${user}`, company_id: company, user_id: user, endpoint: ep, p256dh: 'k', auth: 'a', created_at: new Date().toISOString() });
  const cfgA = { id: A, company_id: A, weekend_days: [0], morning_in: '07:30', morning_out: '11:30', afternoon_in: '13:00', afternoon_out: '17:00', punch_open_before_minutes: 15 };

  beforeEach(() => {
    db = {
      companies: [{ id: A, slug: 'cong-ty-a', active: true, expires_at: null }, { id: B, slug: 'cong-ty-b', active: true, expires_at: null }],
      shift_config: [cfgA, { id: B, company_id: B, weekend_days: [0, 1] }],   // công ty B nghỉ cả Thứ Hai
      hrm_holidays: [],
      attendance_records: [],
      hrm_leaves: [],
      employees: [
        { id: 'emp_admin', name: 'Admin A', status: 'working', company_id: A, last_attendance_reminder_sent: '' },
        { id: 'nv2', name: 'NV2 A', status: 'working', company_id: A, last_attendance_reminder_sent: '' },
        { id: 'nghi', name: 'Nghỉ việc', status: 'resigned', company_id: A, last_attendance_reminder_sent: '' },
        { id: 'emp_admin', name: 'Admin B', status: 'working', company_id: B, last_attendance_reminder_sent: '' },
      ],
      push_subscriptions: [sub(A, 'emp_admin', 'https://push/A1'), sub(A, 'nv2', 'https://push/A2'), sub(B, 'emp_admin', 'https://push/B1')],
    };
    rest = makeRest(db, []);
  });

  it('cửa sổ nhắc = [giờ vào ca − số phút mở điểm danh, giờ vào ca); đọc từ cấu hình, kẹp 5–60 phút, thiếu cấu hình thì mặc định', () => {
    expect(reminderPlan(cfgA, 7 * 60 + 14)).toBeNull();
    expect(reminderPlan(cfgA, 7 * 60 + 15)).toMatchObject({ shift: 'morning', inTime: '07:30', outTime: '11:30', openTime: '07:15' });
    expect(reminderPlan(cfgA, 7 * 60 + 29)?.shift).toBe('morning');
    expect(reminderPlan(cfgA, 7 * 60 + 30)).toBeNull();                                    // đã đến giờ vào ca thì thôi nhắc
    expect(reminderPlan(cfgA, 12 * 60 + 45)).toMatchObject({ shift: 'afternoon', inTime: '13:00', openTime: '12:45' });
    // công ty đổi giờ ca: vào ca 08:00, mở trước 30 phút → nhắc từ 07:30
    expect(reminderPlan({ morning_in: '08:00', punch_open_before_minutes: 30 }, 7 * 60 + 30)).toMatchObject({ inTime: '08:00', openTime: '07:30' });
    expect(reminderPlan(null, 7 * 60 + 20)).toMatchObject({ shift: 'morning', inTime: '07:30' });   // chưa có cấu hình → 07:30 / 13:00, mở trước 15 phút
    expect(openLeadMinutes({ punch_open_before_minutes: 1 })).toBe(5); expect(openLeadMinutes({ punch_open_before_minutes: 600 })).toBe(60); expect(openLeadMinutes({})).toBe(15);
    expect(vnDateParts(THU_HAI_7H20)).toMatchObject({ dow: 1, ddmm: '05/10', today: '2026-10-05', minutes: 440 });
  });

  describe('tin nhắc đăng vào nhóm chat "Điểm danh" (thay cho cách "ai chấm trước thì gửi")', () => {
    const conv = (company: string) => ({ id: 'conv_attendance', company_id: company, participant_ids: ['emp_admin', 'nv2'], unread_counts: { nv2: 1 } });
    const msgs = () => db.chat_messages || [];

    it('đúng lúc mở điểm danh: đăng 1 tin hệ thống vào nhóm của ĐÚNG công ty, nêu giờ vào ca thật; cập nhật tin cuối + chưa đọc cho từng thành viên', async () => {
      db.conversations = [conv(A), conv(B)];
      const { r } = await run(THU_HAI_7H20);
      expect(r.companies[0]).toMatchObject({ company: 'cong-ty-a', chat: 'posted' });
      expect(msgs()).toHaveLength(1);
      expect(msgs()[0]).toMatchObject({ conversation_id: 'conv_attendance', company_id: A, sender_id: 'system', sender_name: 'Hệ Thống', system: true, content: '⏰ Đã mở điểm danh ca sáng. Mời chấm công trước 07:30.' });
      const ca = db.conversations.find(c => c.company_id === A)!;
      expect(ca.unread_counts).toEqual({ nv2: 2, emp_admin: 1 });
      expect(ca.last_message.content).toBe(msgs()[0].content);
      expect(db.conversations.find(c => c.company_id === B)!.unread_counts).toEqual({ nv2: 1 });   // công ty B (nghỉ Thứ Hai) không bị đụng tới
    });

    it('chạy lại 5 phút sau (cùng ca, cùng ngày) KHÔNG đăng trùng; sang ca chiều thì đăng tin mới', async () => {
      db.conversations = [conv(A)];
      await run(THU_HAI_7H20);
      const { r } = await run(new Date('2026-10-05T00:25:00Z'));
      expect(r.companies[0]).toMatchObject({ chat: 'already' });
      expect(msgs()).toHaveLength(1);
      await run(THU_HAI_12H50);
      expect(msgs().map(m => m.content)).toEqual(['⏰ Đã mở điểm danh ca sáng. Mời chấm công trước 07:30.', '⏰ Đã mở điểm danh ca chiều. Mời chấm công trước 13:00.']);
    });

    it('vẫn đăng dù mọi người đã chấm công rồi (tin là của cả nhóm, không phụ thuộc ai chưa chấm)', async () => {
      db.conversations = [conv(A)];
      db.attendance_records = [{ emp_id: 'emp_admin', company_id: A, date: '2026-10-05', time_in_s: '07:10' }, { emp_id: 'nv2', company_id: A, date: '2026-10-05', time_in_s: '07:12' }];
      const { r } = await run(THU_HAI_7H20);
      expect(r.companies[0]).toMatchObject({ needsReminder: 0, chat: 'posted' });
    });

    it('chưa có nhóm → bỏ qua (không tự tạo, không ném lỗi, push vẫn gửi); ngày lễ / ngoài cửa sổ → không đăng', async () => {
      const { r, wp } = await run(THU_HAI_7H20);
      expect(r.companies[0]).toMatchObject({ chat: 'no_group', pushSent: 2 }); expect(wp.sent).toHaveLength(2); expect(msgs()).toHaveLength(0);
      db.conversations = [conv(A)]; db.hrm_holidays = [{ company_id: A, date: '05/10/2026' }];
      await run(THU_HAI_7H20); expect(msgs()).toHaveLength(0);
      db.hrm_holidays = [];
      await run(new Date('2026-10-05T03:00:00Z')); expect(msgs()).toHaveLength(0);
    });

    it('đăng tin lỗi → trả lượt lại để lần chạy sau thử lại; lỗi đăng tin không chặn thông báo đẩy', async () => {
      db.conversations = [conv(A)];
      const orig = rest.fetchFn;
      let fail = true;
      const flaky = async (url: string, init: any = {}) => (fail && /\/chat_messages/.test(url) && init.method === 'POST' ? { ok: false, status: 500, json: async () => ({}), text: async () => 'loi' } : orig(url, init));
      const wp = makeWebPush();
      const r1 = await runAttendanceReminders({ supabaseUrl: ENV.SUPABASE_URL, serviceKey: SERVICE, fetchFn: flaky as any, webPush: wp.webPush, now: THU_HAI_7H20 });
      expect(r1.companies[0]).toMatchObject({ chat: 'post_error', pushSent: 2 });
      expect(db.attendance_chat_notified || []).toHaveLength(0);
      fail = false;
      const r2 = await runAttendanceReminders({ supabaseUrl: ENV.SUPABASE_URL, serviceKey: SERVICE, fetchFn: flaky as any, webPush: makeWebPush().webPush, now: new Date('2026-10-05T00:25:00Z') });
      expect(r2.companies[0]).toMatchObject({ chat: 'posted' }); expect(msgs()).toHaveLength(1);
    });
  });

  it('ngoài cửa sổ → không gửi gì, không ghi gì', async () => {
    const { r, wp } = await run(new Date('2026-10-05T03:00:00Z'));   // 10:00 VN
    expect(r.companies).toEqual([expect.objectContaining({ company: 'cong-ty-a', skipped: 'outside_window' }), { company: 'cong-ty-b', skipped: 'weekend' }]);
    expect(wp.sent).toEqual([]);
    expect(db.employees.every(e => e.last_attendance_reminder_sent === '')).toBe(true);
  });

  it('MỖI công ty theo ngày nghỉ RIÊNG: Thứ Hai A đi làm (được nhắc), B nghỉ (bỏ qua). Mã emp_admin trùng nhau nhưng KHÔNG lẫn', async () => {
    const { r, wp } = await run(THU_HAI_7H20);
    expect(r.companies).toEqual([
      expect.objectContaining({ company: 'cong-ty-a', shift: 'morning', needsReminder: 2, pushSent: 2 }),
      { company: 'cong-ty-b', skipped: 'weekend' },
    ]);
    expect(wp.sent.map(s => s.endpoint).sort()).toEqual(['https://push/A1', 'https://push/A2']);   // B1 KHÔNG được gửi
  });

  it('nội dung ghi đúng GIỜ CA của công ty (không còn viết cứng 07:30 / 13:00)', async () => {
    db.shift_config[0] = { ...cfgA, morning_in: '08:00', morning_out: '12:00', punch_open_before_minutes: 30 };
    const { wp } = await run(new Date('2026-10-05T00:40:00Z'));   // 07:40 VN, nằm trong 07:30–08:00
    const pl = JSON.parse(wp.sent[0].payload);
    expect(pl.title).toBe('⏰ Điểm danh ca sáng · 08:00');
    expect(pl.body).toContain('trước 08:00');
    expect(pl.data.detailedContent).toBe('Ca sáng: 08:00 – 12:00. Mở điểm danh từ 07:30.');
    expect(pl.tag).toBe('attendance-morning-2026-10-05');
  });

  it('đánh dấu "đã nhắc ca này" CHỈ cho nhân viên của đúng công ty; người nghỉ việc không được nhắc; chạy lại 5 phút sau KHÔNG nhắc trùng', async () => {
    await run(THU_HAI_7H20);
    const a = db.employees.filter(e => e.company_id === A);
    expect(a.find(e => e.id === 'emp_admin')!.last_attendance_reminder_sent).toBe('2026-10-05:morning');
    expect(a.find(e => e.id === 'nghi')!.last_attendance_reminder_sent).toBe('');
    expect(db.employees.find(e => e.company_id === B)!.last_attendance_reminder_sent).toBe('');
    const wp2 = makeWebPush();
    const again = await run(new Date('2026-10-05T00:25:00Z'), wp2);
    expect(wp2.sent).toEqual([]);
    expect(again.r.companies![0]).toMatchObject({ company: 'cong-ty-a', needsReminder: 0 });
  });

  it('ca sáng và ca chiều nhắc ĐỘC LẬP (lỗi cũ: nhắc sáng đánh dấu cả ngày nên buổi chiều không bao giờ được nhắc)', async () => {
    await run(THU_HAI_7H20);
    const { wp } = await run(THU_HAI_12H50);
    expect(wp.sent.map(s => s.endpoint).sort()).toEqual(['https://push/A1', 'https://push/A2']);
    expect(db.employees.find(e => e.id === 'nv2')!.last_attendance_reminder_sent).toBe('2026-10-05:afternoon');
  });

  it('bỏ người đã điểm danh vào ca này; bỏ người đang nghỉ phép được duyệt hôm nay (cả ngày hoặc đúng ca), nhưng KHÔNG bỏ báo cáo chấm công', async () => {
    db.attendance_records = [{ emp_id: 'emp_admin', company_id: A, date: '2026-10-05', time_in_s: '07:10', time_in_c: null }];
    db.hrm_leaves = [
      { emp_id: 'nv2', company_id: A, type: 'Nghỉ phép năm', status: 'approved', from_date: '2026-10-05', to_date: '2026-10-06', shift: null },
    ];
    let { r } = await run(THU_HAI_7H20);
    expect(r.companies![0]).toMatchObject({ needsReminder: 0 });   // emp_admin đã vào ca, nv2 nghỉ phép
    // nghỉ phép CA SÁNG thì buổi chiều vẫn nhắc; "Báo cáo nghỉ ca" không phải nghỉ thật nên vẫn nhắc
    db.hrm_leaves = [{ emp_id: 'nv2', company_id: A, type: 'Nghỉ phép năm', status: 'approved', from_date: '2026-10-05', to_date: '2026-10-05', shift: 'morning' },
                     { emp_id: 'emp_admin', company_id: A, type: 'Báo cáo nghỉ ca', status: 'approved', from_date: '2026-10-05', to_date: '2026-10-05', shift: null, is_attendance_correction: true }];
    ({ r } = await run(THU_HAI_12H50));
    expect(r.companies![0]).toMatchObject({ shift: 'afternoon', needsReminder: 2 });
  });

  it('ngày lễ riêng của công ty: A có lễ hôm nay thì A bỏ qua, B (không lễ) vẫn được nhắc nếu đi làm', async () => {
    db.hrm_holidays = [{ id: 'h1', company_id: A, date: '06/10' }];
    db.shift_config[1] = { id: B, company_id: B, weekend_days: [0] };
    const { r, wp } = await run(new Date('2026-10-06T00:20:00Z'));   // Thứ Ba 6/10
    expect(r.companies).toEqual([{ company: 'cong-ty-a', shift: 'morning', skipped: 'holiday' }, expect.objectContaining({ company: 'cong-ty-b', needsReminder: 1, pushSent: 1 })]);
    expect(wp.sent.map(s => s.endpoint)).toEqual(['https://push/B1']);
  });

  it('công ty bị khóa hoặc hết hạn KHÔNG được nhắc', async () => {
    db.companies[0].active = false; db.companies[1].expires_at = '2026-10-05T00:00:00Z';   // đã hết hạn so với giờ giả lập 6/10
    const { r } = await run(new Date('2026-10-06T00:20:00Z'));
    expect(r.companies).toEqual([]);
  });

  it('lỗi ở 1 công ty không chặn công ty khác', async () => {
    db.shift_config[1] = { id: B, company_id: B, weekend_days: [0] };
    const real = rest.fetchFn;
    const flaky = async (url: string, init?: any) => (url.includes('employees?') && url.includes(`company_id=eq.${A}`) && (init?.method || 'GET') === 'GET' ? { ok: false, status: 500, json: async () => ({}), text: async () => 'boom' } : real(url, init));
    const r = await runAttendanceReminders({ supabaseUrl: ENV.SUPABASE_URL, serviceKey: SERVICE, fetchFn: flaky as any, webPush: makeWebPush().webPush, now: new Date('2026-10-06T00:20:00Z') });
    expect(r.companies![0]).toMatchObject({ company: 'cong-ty-a' }); expect(r.companies![0].error).toMatch(/employees/);
    expect(r.companies![1]).toMatchObject({ company: 'cong-ty-b', pushSent: 1 });
  });

  it('thiếu cấu hình ca → mặc định nghỉ Chủ nhật, vào ca 07:30 / 13:00; Chủ nhật bị bỏ qua', async () => {
    db.shift_config = [];
    expect((await run(new Date('2026-10-04T00:20:00Z'))).r.companies).toEqual([{ company: 'cong-ty-a', skipped: 'weekend' }, { company: 'cong-ty-b', skipped: 'weekend' }]);   // 4/10 = Chủ nhật
    expect((await run(THU_HAI_7H20)).r.companies![0]).toMatchObject({ pushSent: 2 });
  });
});
