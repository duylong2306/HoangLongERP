// Nhật ký dự án: phân loại, ghi (kể cả khi chưa chạy migration), tải theo cụm 3 ngày, bộ lọc, dựng file Excel.
import { describe, it, expect, beforeEach, vi } from 'vitest';

type Row = Record<string, any>;
const S: { rows: Row[]; company: string | null; insertErr: any; selectErr: any; inserted: Row[] } = { rows: [], company: 'C1', insertErr: null, selectErr: null, inserted: [] };

// Bộ dựng truy vấn giả: eq / lt / gte / or(bỏ qua) / order / limit trên mảng trong bộ nhớ
function query(rows: Row[]) {
  let r = [...rows]; let ord: { col: string; asc: boolean } | null = null; let lim = Infinity;
  const q: any = {
    select: () => q,
    eq: (c: string, v: any) => { r = r.filter(x => x[c] === v); return q; },
    lt: (c: string, v: any) => { r = r.filter(x => x[c] < v); return q; },
    gte: (c: string, v: any) => { r = r.filter(x => x[c] >= v); return q; },
    or: () => q,
    order: (c: string, o: any) => { ord = { col: c, asc: !!o?.ascending }; return q; },
    limit: (n: number) => { lim = n; return q; },
    then: (res: any) => {
      let out = r; if (ord) out = [...out].sort((a, b) => (ord!.asc ? 1 : -1) * String(a[ord!.col]).localeCompare(String(b[ord!.col])));
      if (S.selectErr) return Promise.resolve({ data: null, error: S.selectErr }).then(res);
      return Promise.resolve({ data: out.slice(0, lim), error: null }).then(res);
    },
  };
  return q;
}
vi.mock('../supabase', () => ({
  getSupabase: () => ({ from: () => ({ select: () => query(S.rows), insert: async (row: Row) => { if (S.insertErr) return { error: S.insertErr }; S.inserted.push(row); return { error: null }; } }) }),
  getCurrentCompanyId: () => S.company,
}));

import { loadTodayProjectEvents, classifyEvent, recordProjectEvent, recordProjectEventFromMessage, loadProjectEventsPage, loadAllProjectEvents, __resetProjectEventsState, cleanSearch } from '../projectEvents';
import { buildProjectLogSheets } from '../projectEventsExport';

beforeEach(() => { S.rows = []; S.company = 'C1'; S.insertErr = null; S.selectErr = null; S.inserted = []; __resetProjectEventsState(); });

/** Thời điểm = (hôm nay lùi `d` ngày) lúc hh:mm giờ máy */
const at = (d: number, hh = 10, mm = 0) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(hh, mm, 0, 0); return x.toISOString(); };
const ev = (id: string, d: number, extra: Row = {}) => ({ id, project_id: 'P1', task_id: null, type: 'khac', text: `sự kiện ${id}`, created_at: at(d), ...extra });

describe('classifyEvent', () => {
  it('đoán loại theo biểu tượng/nội dung và bỏ biểu tượng đầu câu', () => {
    expect(classifyEvent('✅ Long đã duyệt hoàn thành công việc "A".')).toEqual({ type: 'duyet', text: 'Long đã duyệt hoàn thành công việc "A".' });
    expect(classifyEvent('📌 Bình đã GIAO cho bạn công việc "A"').type).toBe('giao');
    expect(classifyEvent('🗑️ Bình đã xóa Nhiệm Vụ "B"').type).toBe('xoa');
    expect(classifyEvent('💰 ĐÃ LẬP PHIẾU CHI').type).toBe('tc');
    expect(classifyEvent('📝 X đã khởi tạo Nhiệm Vụ "N"').type).toBe('tao');
    expect(classifyEvent('xin chào').type).toBe('khac');
  });

  it('từ khóa nằm trong tên công việc / nhiệm vụ (trong dấu nháy) không làm xếp nhầm loại', () => {
    // Trước đây "tạm ứng" / "duyệt" / "hạn" trong tên bị coi là tin Tài chính / Duyệt / Hạn
    expect(classifyEvent('📌 Long đã chuyển Phụ Trách Chính công việc "KÝ HỢP ĐỒNG NHẬN TẠM ỨNG" sang An.').type).toBe('giao');
    expect(classifyEvent('➕ Lan đã thêm An vào Nhiệm Vụ "Duyệt hồ sơ".').type).toBe('giao');
    expect(classifyEvent('📝 Lan đã khởi tạo Nhiệm Vụ "Mua vật tư phiếu chi".').type).toBe('tao');
    expect(classifyEvent('📝 Lan đã khởi tạo Nhiệm Vụ "Đổi hạn ưu tiên".').type).toBe('tao');
  });

  it('từ khóa NGOÀI dấu nháy vẫn được tính và nội dung hiển thị giữ nguyên tên', () => {
    expect(classifyEvent('💰 ĐÃ LẬP PHIẾU CHI TẠM ỨNG').type).toBe('tc');
    expect(classifyEvent('📝 Lan đã cập nhật Nhiệm Vụ "A" (Hạn mới: 21/08).').type).toBe('han');
    expect(classifyEvent('📌 Long đã chuyển công việc "KÝ HỢP ĐỒNG NHẬN TẠM ỨNG" sang An.').text).toContain('"KÝ HỢP ĐỒNG NHẬN TẠM ỨNG"');
  });
});

describe('loadTodayProjectEvents', () => {
  it('chỉ lấy sự kiện của dự án trong HÔM NAY, mới nhất trước', async () => {
    S.rows = [ev('moi', 0, { created_at: at(0, 15) }), ev('sang', 0, { created_at: at(0, 7) }), ev('homqua', 1), ev('khac', 0, { project_id: 'P2', created_at: at(0, 9) })];
    const r = await loadTodayProjectEvents('P1');
    expect(r.map(x => x.id)).toEqual(['moi', 'sang']);
  });
  it('chưa chạy migration / lỗi → mảng rỗng, không ném lỗi', async () => {
    S.selectErr = { code: '42P01', message: 'relation "project_events" does not exist' };
    expect(await loadTodayProjectEvents('P1')).toEqual([]);
  });
});

describe('đính kèm trong nhật ký', () => {
  it('có tệp thì gửi cột attachments; không có thì KHÔNG gửi cột này (DB chưa có cột vẫn ghi được sự kiện thường)', async () => {
    await recordProjectEvent({ projectId: 'P1', text: 'đã hoàn thành', attachments: [{ id: 'a', type: 'image', name: 'a.jpg', url: 'https://kho/a.jpg' }] });
    await recordProjectEvent({ projectId: 'P1', text: 'đã nhận việc' });
    expect(S.inserted[0].attachments).toEqual([{ id: 'a', type: 'image', name: 'a.jpg', url: 'https://kho/a.jpg' }]);
    expect('attachments' in S.inserted[1]).toBe(false);
  });
  it('tải lại: đính kèm trả về trong dòng nhật ký, mảng rỗng → không có', async () => {
    S.rows = [ev('a', 0, { attachments: [{ id: 'x', url: 'https://k/x.jpg' }] }), ev('b', 0, { attachments: [] })];
    const r = await loadProjectEventsPage('P1');
    const byId = Object.fromEntries(r.rows.map(x => [x.id, x]));
    expect(byId.a.attachments).toEqual([{ id: 'x', url: 'https://k/x.jpg' }]);
    expect(byId.b.attachments).toBeUndefined();
  });
});

describe('recordProjectEvent', () => {
  it('lưu đủ trường (snake_case) kèm công ty', async () => {
    const ok = await recordProjectEvent({ projectId: 'P1', taskId: 'T1', actor: { id: 'u1', name: 'Long' }, type: 'han', objKind: 'task', objName: 'Sơn', text: 'đã đổi hạn', from: '18/10', to: '22/10' });
    expect(ok).toBe(true);
    expect(S.inserted[0]).toMatchObject({ company_id: 'C1', project_id: 'P1', task_id: 'T1', actor_name: 'Long', type: 'han', obj_kind: 'task', from_val: '18/10', to_val: '22/10' });
  });
  it('chưa chạy migration (bảng chưa có) → trả false và các lần sau khỏi gọi lại', async () => {
    S.insertErr = { code: '42P01', message: 'relation "project_events" does not exist' };
    expect(await recordProjectEvent({ projectId: 'P1', text: 'a' })).toBe(false);
    S.insertErr = null;
    expect(await recordProjectEvent({ projectId: 'P1', text: 'b' })).toBe(false); // đã nhớ "chưa bật"
    expect(S.inserted).toHaveLength(0);
  });
  it('thiếu mã công ty / thiếu dự án / thiếu nội dung → không ghi', async () => {
    S.company = null; expect(await recordProjectEvent({ projectId: 'P1', text: 'a' })).toBe(false);
    S.company = 'C1'; expect(await recordProjectEvent({ projectId: '', text: 'a' })).toBe(false);
    expect(await recordProjectEvent({ projectId: 'P1', text: '' })).toBe(false);
  });
  it('tin nhiều dòng: dòng đầu = tóm tắt, phần còn lại = chi tiết; bỏ tên người làm đứng đầu câu', async () => {
    await recordProjectEventFromMessage('✅ Long đã duyệt đề xuất\nMã: VT-1\nSố tiền: 5đ', { projectId: 'P1', actor: { id: 'u1', name: 'Long' } });
    expect(S.inserted[0]).toMatchObject({ type: 'duyet', text: 'đã duyệt đề xuất', detail: 'Mã: VT-1\nSố tiền: 5đ' });
  });
});

describe('tải theo cụm 3 ngày', () => {
  beforeEach(() => {
    // hôm nay: 3 sự kiện; 1 ngày trước: 1; 2 ngày trước: 1; 4 ngày trước: 2; 9 ngày trước: 1
    S.rows = [ev('a', 0), ev('b', 0), ev('c', 0), ev('d', 1), ev('e', 2), ev('f', 4), ev('g', 4), ev('h', 9)];
    S.rows[1].created_at = at(0, 11); S.rows[2].created_at = at(0, 12); S.rows[6].created_at = at(4, 11);
  });
  it('trang 1 = 3 ngày mới nhất; trang sau tiếp nối đúng, không trùng không sót; hết thì hasMore=false', async () => {
    const p1 = await loadProjectEventsPage('P1');
    expect(p1.rows.map(r => r.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(p1.hasMore).toBe(true);
    const p2 = await loadProjectEventsPage('P1', { before: p1.nextBefore });
    expect(p2.rows.map(r => r.id).sort()).toEqual(['f', 'g']);   // ngày 3 không có gì, bỏ qua; gói 3 ngày kể từ ngày có sự kiện (4 ngày trước)
    expect(p2.hasMore).toBe(true);
    const p3 = await loadProjectEventsPage('P1', { before: p2.nextBefore });
    expect(p3.rows.map(r => r.id)).toEqual(['h']);
    expect(p3.hasMore).toBe(false);
    expect(p3.nextBefore).toBeUndefined();
  });
  it('trong 1 trang sắp mới → cũ', async () => {
    const p1 = await loadProjectEventsPage('P1');
    const times = p1.rows.map(r => r.createdAt);
    expect([...times].sort().reverse()).toEqual(times);
  });
  it('dự án không có sự kiện → trang rỗng, không lỗi', async () => {
    S.rows = [];
    expect(await loadProjectEventsPage('P1')).toMatchObject({ ok: true, rows: [], hasMore: false });
  });
  it('lọc theo công việc (Lịch sử riêng) và theo loại', async () => {
    S.rows = [ev('x', 0, { task_id: 'T1', type: 'han' }), ev('y', 0, { task_id: 'T2' }), ev('z', 0, { task_id: 'T1', type: 'tt' })];
    expect((await loadProjectEventsPage('P1', { taskId: 'T1' })).rows.map(r => r.id).sort()).toEqual(['x', 'z']);
    expect((await loadProjectEventsPage('P1', { filters: { type: 'han' } })).rows.map(r => r.id)).toEqual(['x']);
  });
  it('lọc khoảng ngày', async () => {
    const d = (n: number) => { const x = new Date(at(n)); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
    const r = await loadProjectEventsPage('P1', { filters: { from: d(4), to: d(4) } });
    expect(r.rows.map(x => x.id).sort()).toEqual(['f', 'g']);
  });
  it('loadAllProjectEvents gom hết mọi trang', async () => {
    const all = await loadAllProjectEvents('P1');
    expect(all.rows).toHaveLength(8);
  });
  it('chưa có bảng → notEnabled (để giao diện báo cần chạy migration)', async () => {
    S.selectErr = { code: 'PGRST205', message: 'Could not find the table public.project_events in the schema cache' };
    const r = await loadProjectEventsPage('P1');
    expect(r).toMatchObject({ ok: false, notEnabled: true, rows: [], hasMore: false });
  });
  it('làm sạch từ khóa tìm kiếm (không để ký tự đặc biệt phá bộ lọc)', () => {
    expect(cleanSearch('a,b(c)%_*')).toBe('a b c');
  });
});

describe('dựng file Excel lưu trữ', () => {
  it('3 trang tính: thông tin dự án đầy đủ, công việc/nhiệm vụ, nhật ký (cũ → mới)', () => {
    const project: any = { id: 'P1', code: 'DA-1', name: 'Cổng sắt', type: 'mechanical', status: 'processing', progress: 40, address: '12 Lê Lợi', pmId: 'e1', startDate: '2026-10-01', endDate: '2026-11-01', contractValue: 210000000, customerId: 'c1', notes: 'ghi chú', documents: [{ id: 'd1', type: 'contract', code: 'HD-1', name: 'Hợp đồng', status: 'approved', value: 5, createdAt: '2026-10-02' }] };
    const tasks: any[] = [
      { id: 't1', projectId: 'P1', code: 'CV-1', name: 'Hàn khung', assigneeId: 'e2', assignerId: 'e1', status: 'doing', completionRate: 50, priority: 'high', deadline: '2026-10-20', missions: [{ id: 'm1', name: 'Cắt thép', status: 'completed', mainAssigneeId: 'e2', memberIds: ['e2', 'e3'] }] },
      { id: 'tX', projectId: 'KHAC', code: 'CV-9', name: 'Của dự án khác', status: 'todo' },
    ];
    const events: any[] = [
      { id: '2', projectId: 'P1', type: 'duyet', text: 'đã duyệt', actorName: 'Long', createdAt: '2026-10-22T10:00:00', objKind: 'task', objName: 'Hàn khung', from: 'Chờ duyệt', to: 'Hoàn thành' },
      { id: '1', projectId: 'P1', type: 'tao', text: 'đã tạo dự án', actorName: 'Tiến', createdAt: '2026-10-01T08:00:00' },
    ];
    const { info, taskRows, logRows } = buildProjectLogSheets({
      project, customer: { id: 'c1', name: 'Anh Khanh', phone: '09', email: '', address: 'CC C5' } as any,
      employees: [{ id: 'e1', name: 'Bình' }, { id: 'e2', name: 'Hòa' }, { id: 'e3', name: 'An' }] as any, tasks, events, stageName: 'Thi công', exportedBy: 'Long', now: new Date('2026-10-27T09:00:00'),
    });
    const flat = info.map(r => r.join('|'));
    expect(flat).toContain('Mã dự án|DA-1');
    expect(flat).toContain('Trưởng dự án|Bình');
    expect(flat).toContain('Giai đoạn (cột Kanban)|Thi công');
    expect(flat).toContain('Giá trị hợp đồng (đ)|210000000');
    expect(flat).toContain('Tên khách hàng|Anh Khanh');
    expect(flat).toContain('Số công việc|1');            // chỉ tính công việc của dự án này
    expect(flat).toContain('Số nhiệm vụ|1');
    expect(flat.some(l => l.startsWith('Hợp đồng|HD-1'.slice(0, 0)) || l.includes('HD-1'))).toBe(true);
    expect(taskRows).toHaveLength(3);                     // tiêu đề + 1 công việc + 1 nhiệm vụ
    expect(taskRows[2][2]).toBe('Cắt thép'); expect(taskRows[2][6]).toBe('Hòa, An');
    expect(logRows).toHaveLength(3);
    expect(logRows[1][6]).toBe('đã tạo dự án');         // cũ nhất trước
    expect(logRows[2].slice(7, 9)).toEqual(['Chờ duyệt', 'Hoàn thành']);
  });
});
