import { describe, it, expect } from 'vitest';
import { stageRange, computeProjectProgress, columnsForProject } from '../projectProgress';
import { getDefaultColumns } from '../kanbanLogic';

const cols = getDefaultColumns();   // 7 cột: thiết kế, đấu thầu, chờ KQ, thi công, nghiệm thu, khắc phục, hoàn thành
const proj = (o: any = {}): any => ({ id: 'p1', type: 'construction', status: 'processing', progress: 40, kanbanColumnId: 'col_active', ...o });
const tk = (status: string, projectId = 'p1') => ({ projectId, status }) as any;

describe('khoảng % của giai đoạn', () => {
  it('chia đều các cột trước cột cuối; cột Hoàn thành luôn 100', () => {
    expect(stageRange(cols, 'col_design')).toMatchObject({ from: 0, to: 17, index: 0, total: 7 });
    expect(stageRange(cols, 'col_active')).toMatchObject({ from: 50, to: 67, index: 3 });
    expect(stageRange(cols, 'col_fix')).toMatchObject({ from: 83, to: 100 });
    expect(stageRange(cols, 'col_done')).toMatchObject({ from: 100, to: 100 });
  });
  it('cột có cấu hình riêng (progressFrom/progressTo) thì theo cấu hình', () => {
    const custom = cols.map(c => c.id === 'col_active' ? { ...c, automation: { ...c.automation!, progressFrom: 30, progressTo: 80 } } : c);
    expect(stageRange(custom, 'col_active')).toMatchObject({ from: 30, to: 80 });
  });
  it('cột không tồn tại → về cột đầu', () => {
    expect(stageRange(cols, 'khong-co').index).toBe(0);
  });
});

describe('tiến độ tự tính', () => {
  it('= đầu khoảng + (cuối − đầu) × việc xong / tổng việc', () => {
    // Thi công 50–67%: xong 5/9 việc → 50 + 17×5/9 ≈ 59
    const tasks = [...Array(5).fill(0).map(() => tk('completed')), ...Array(4).fill(0).map(() => tk('doing'))];
    const r = computeProjectProgress(proj(), tasks, cols);
    expect(r).toMatchObject({ value: 59, auto: 59, source: 'auto', done: 5, total: 9 });
    expect(r.stage.name).toBe('GIỚI ĐOẠN THI CÔNG');
  });
  it('chưa có việc con → đứng ở đầu khoảng; xong hết → cuối khoảng', () => {
    expect(computeProjectProgress(proj(), [], cols).value).toBe(50);
    expect(computeProjectProgress(proj(), [tk('completed'), tk('completed')], cols).value).toBe(67);
  });
  it('chỉ tính việc của đúng dự án', () => {
    expect(computeProjectProgress(proj(), [tk('completed', 'p2'), tk('doing')], cols)).toMatchObject({ done: 0, total: 1 });
  });
  it('trạng thái Hoàn thành → 100%, kể cả có ghi đè', () => {
    expect(computeProjectProgress(proj({ status: 'completed', progressManual: 30 }), [], cols)).toMatchObject({ value: 100, source: 'completed' });
  });
});

describe('PM ghi đè', () => {
  it('có số ghi đè → hiện số đó, vẫn giữ số tự tính để đối chiếu', () => {
    expect(computeProjectProgress(proj({ progressManual: 80 }), [tk('doing')], cols)).toMatchObject({ value: 80, auto: 50, source: 'manual' });
  });
  it('ghi đè 0 vẫn là ghi đè; null/undefined = tự động', () => {
    expect(computeProjectProgress(proj({ progressManual: 0 }), [], cols)).toMatchObject({ value: 0, source: 'manual' });
    expect(computeProjectProgress(proj({ progressManual: null }), [], cols).source).toBe('auto');
    expect(computeProjectProgress(proj(), [], cols).source).toBe('auto');
  });
  it('số ghi đè ngoài 0–100 bị kẹp lại', () => {
    expect(computeProjectProgress(proj({ progressManual: 150 }), [], cols).value).toBe(100);
  });
});

describe('bộ cột theo lĩnh vực', () => {
  it('theo type của dự án; thiếu thì dùng xây dựng rồi mặc định', () => {
    const f = cols.slice(0, 3);
    expect(columnsForProject({ type: 'furniture' } as any, { furniture: f })).toBe(f);
    expect(columnsForProject({ type: 'mechanical' } as any, { construction: f })).toBe(f);
    expect(columnsForProject({ type: 'general' } as any, {}).length).toBe(7);
  });
});

import { stageIdOf, buildPipeline } from '../projectProgress';

describe('phễu giai đoạn', () => {
  const P = (id: string, col: string, o: any = {}): any => ({ id, type: 'construction', status: 'processing', contractValue: 1_000_000, kanbanColumnId: col, ...o });
  it('đếm số dự án, tổng giá trị và tiến độ TB theo từng cột; bỏ dự án đã hủy và lĩnh vực khác', () => {
    const projects = [
      P('a', 'col_active'), P('b', 'col_active', { contractValue: 2_000_000 }), P('c', 'col_design'),
      P('x', 'col_active', { status: 'cancelled' }), P('y', 'col_active', { type: 'furniture' }),
    ];
    const tasks = [{ projectId: 'a', status: 'completed' }, { projectId: 'a', status: 'doing' }] as any;
    const f = buildPipeline(projects, tasks, cols, 'construction');
    expect(f).toHaveLength(7);
    const active = f.find(s => s.id === 'col_active')!;
    expect(active).toMatchObject({ count: 2, value: 3_000_000, projectIds: ['a', 'b'] });
    expect(active.avgProgress).toBe(Math.round((59 - 0 + 50) / 2));   // a: 50+17×1/2≈59 (làm tròn 58,5→59); b: 50
    expect(f.find(s => s.id === 'col_design')!.count).toBe(1);
    expect(f.find(s => s.id === 'col_done')!.count).toBe(0);
  });
  it('dự án đã Hoàn thành luôn tính vào cột cuối dù thẻ còn nằm cột cũ', () => {
    expect(stageIdOf(P('d', 'col_active', { status: 'completed' }), cols)).toBe('col_done');
    expect(buildPipeline([P('d', 'col_active', { status: 'completed' })], [], cols, 'construction').find(s => s.id === 'col_done')!.count).toBe(1);
  });
  it('thẻ trỏ cột đã bị xóa → về cột đầu', () => {
    expect(stageIdOf(P('e', 'col_khong_co'), cols)).toBe('col_design');
  });
});

import { finalIndexOf, progressTone } from '../projectProgress';

describe('cột "Hoàn thành" không nằm cuối & màu theo mức', () => {
  // Công ty có thêm cột Bảo hành sau cột Hoàn thành: cột "HOÀN THÀNH" phải là mốc 100%, không phải coi cột Bảo hành là cuối
  const custom = [
    { id: 'a', name: 'THIẾT KẾ', color: '', iconColor: '', automation: { type: 'none' } },
    { id: 'b', name: 'THI CÔNG', color: '', iconColor: '', automation: { type: 'none' } },
    { id: 'c', name: 'Hoàn thành', color: '', iconColor: '', automation: { type: 'none' } },
    { id: 'd', name: 'BẢO HÀNH', color: '', iconColor: '', automation: { type: 'none' } },
  ] as any[];
  it('nhận cột theo tên; từ cột đó trở đi là 100%', () => {
    expect(finalIndexOf(custom)).toBe(2);
    expect(stageRange(custom, 'c')).toMatchObject({ from: 100, to: 100 });
    expect(stageRange(custom, 'd')).toMatchObject({ from: 100, to: 100 });
    expect(stageRange(custom, 'a')).toMatchObject({ from: 0, to: 50 });   // 2 giai đoạn làm việc chia đều
    expect(stageRange(custom, 'b')).toMatchObject({ from: 50, to: 100 });
  });
  it('dự án ở cột Hoàn thành, xong hết việc → 100%, không bị báo lệch/kẹt', () => {
    const p: any = { id: 'p', type: 'construction', status: 'processing', kanbanColumnId: 'c' };
    expect(computeProjectProgress(p, [{ projectId: 'p', status: 'completed' }] as any, custom).value).toBe(100);
  });
  it('không có cột nào tên/quy tắc hoàn thành → cột cuối là hoàn thành', () => {
    expect(finalIndexOf(custom.slice(0, 2))).toBe(1);
  });
  it('màu theo mức: <30 đỏ, <60 vàng, <100 xanh dương, 100 xanh lá', () => {
    expect([0, 29, 30, 59, 60, 99, 100].map(progressTone)).toEqual(['bad', 'bad', 'warn', 'warn', 'blue', 'blue', 'ok']);
  });
});
