import { describe, it, expect, vi, beforeEach } from 'vitest';

const S = vi.hoisted(() => ({ insert: vi.fn(), select: vi.fn(), company: 'C1' as string | null, client: true }));
vi.mock('../supabase', () => ({
  getCurrentCompanyId: () => S.company,
  getSupabase: () => (S.client ? { from: () => ({ insert: S.insert, select: () => ({ order: () => ({ limit: S.select }) }) }) } : null),
}));
import { diffProjectPosition, diffProjectGroup, diffRoleGroups, diffApproval, recordPermissionAudit, loadPermissionAudit } from '../permissionAudit';

beforeEach(() => { S.insert.mockReset(); S.select.mockReset(); S.company = 'C1'; S.client = true; });

describe('diff — Quyền Dự Án theo vị trí', () => {
  it('thêm/bỏ tick từng ô và công tắc kế thừa được ghi đúng "từ → sang"', () => {
    const d = diffProjectPosition(
      { inheritBelow: true, actions: { createProject: ['director', 'pm'], deleteProject: ['director', 'pm'] } },
      { inheritBelow: false, actions: { createProject: ['director', 'pm', 'accountant'], deleteProject: ['director'] } },
      a => ({ createProject: 'Tạo dự án mới', deleteProject: 'Xóa dự án' } as any)[a] || a,
    )!;
    expect(d.changes).toContainEqual({ label: 'Tạo dự án mới — Kế toán', from: 'Không', to: 'Có' });
    expect(d.changes).toContainEqual({ label: 'Xóa dự án — Trưởng DA', from: 'Có', to: 'Không' });
    expect(d.changes).toContainEqual({ label: 'Kế thừa quyền xuống vai trò thấp hơn', from: 'Bật', to: 'Tắt' });
    expect(d.summary).toBe('Theo vị trí: +1 quyền, −1 quyền');
  });
  it('không đổi gì → null (không ghi nhật ký rỗng)', () => {
    const m = { inheritBelow: false, actions: { a: ['pm'] } };
    expect(diffProjectPosition(m, JSON.parse(JSON.stringify(m)))).toBeNull();
  });
});

describe('diff — Quyền Dự Án theo nhóm HRM', () => {
  it('đúng tình huống Kế toán Ngọc Thịnh: tích thêm 2 quyền, bỏ 1', () => {
    const d = diffProjectGroup({ roleGroupActions: { kt: ['createProject', 'viewProjectFinance'] } }, { roleGroupActions: { kt: ['createProject', 'createCard', 'exportProject'] } }, g => (g === 'kt' ? 'Kế toán' : g))!;
    expect(d.target).toBe('Kế toán');
    expect(d.summary).toBe('Kế toán: +2 quyền, −1 quyền');
    expect(d.changes).toContainEqual({ label: 'Kế toán — viewProjectFinance', from: 'Có', to: 'Không' });
  });
  it('không đổi → null', () => { expect(diffProjectGroup({ roleGroupActions: { a: ['x'] } }, { roleGroupActions: { a: ['x'] } })).toBeNull(); });
});

describe('diff — nhóm vai trò', () => {
  const nhom = (over: any = {}) => ({ id: 'g1', name: 'Kế toán', permissions: { finance: { view: true, create: false, edit: false, delete: false } }, memberIds: ['A'], ...over });
  it('quyền phân hệ đổi, thành viên vào/ra, loại nhóm đổi', () => {
    const after = nhom({ permissions: { finance: { view: true, create: true, edit: true, delete: false }, __role_kind__accounting: { view: true } }, memberIds: ['B'] });
    const [d] = diffRoleGroups([nhom()], [after], m => m, id => ({ A: 'Nguyễn A', B: 'Trần B' } as any)[id]);
    expect(d.changes).toContainEqual({ label: 'Phân hệ finance', from: 'Xem', to: 'Xem/Thêm/Sửa' });
    expect(d.changes).toContainEqual({ label: 'Loại nhóm "accounting"', from: 'Không', to: 'Có' });
    expect(d.changes).toContainEqual({ label: 'Thành viên Trần B', from: 'Chưa thuộc nhóm', to: 'Thêm vào nhóm' });
    expect(d.changes).toContainEqual({ label: 'Thành viên Nguyễn A', from: 'Thuộc nhóm', to: 'Bỏ khỏi nhóm' });
  });
  it('thêm nhóm mới và xóa nhóm đều có dòng riêng; không đổi → mảng rỗng', () => {
    expect(diffRoleGroups([], [nhom()])[0].summary).toBe('Thêm nhóm "Kế toán"');
    expect(diffRoleGroups([nhom()], [])[0].summary).toBe('Xóa nhóm "Kế toán"');
    expect(diffRoleGroups([nhom()], [nhom()])).toEqual([]);
  });
});

describe('diff — Quyền Phê Duyệt', () => {
  it('đổi người duyệt của một loại chứng từ', () => {
    const d = diffApproval([{ documentType: 'leave', documentTypeLabel: 'Nghỉ phép', approverName: 'A', canApprove: true }], [{ documentType: 'leave', documentTypeLabel: 'Nghỉ phép', approverName: 'B', canApprove: false }])!;
    expect(d.changes).toEqual([{ label: 'Nghỉ phép — người duyệt', from: 'A', to: 'B' }, { label: 'Nghỉ phép — quyền duyệt', from: 'Bật', to: 'Tắt' }]);
  });
  it('không đổi → null', () => { const c = [{ documentType: 'leave', approverName: 'A' }]; expect(diffApproval(c, c)).toBeNull(); });
});

describe('ghi / đọc nhật ký — không bao giờ làm hỏng việc lưu', () => {
  const diff = { target: 'Kế toán', summary: 's', changes: [{ label: 'x', from: 'Không', to: 'Có' }] };
  it('ghi đủ trường, kèm công ty và người sửa', async () => {
    S.insert.mockResolvedValue({ error: null });
    expect(await recordPermissionAudit('project_group', diff, { id: 'NV1', name: 'Long' })).toBe(true);
    expect(S.insert).toHaveBeenCalledWith(expect.objectContaining({ company_id: 'C1', actor_id: 'NV1', actor_name: 'Long', area: 'project_group', target: 'Kế toán', changes: diff.changes }));
  });
  it('không có thay đổi → không ghi', async () => {
    expect(await recordPermissionAudit('approval', null)).toBe(false);
    expect(S.insert).not.toHaveBeenCalled();
  });
  it('chưa chạy migration / lỗi mạng / không có công ty → trả false, KHÔNG ném lỗi', async () => {
    S.insert.mockResolvedValue({ error: { message: 'relation does not exist', code: '42P01' } });
    expect(await recordPermissionAudit('approval', diff)).toBe(false);
    S.insert.mockRejectedValue(new Error('network'));
    expect(await recordPermissionAudit('approval', diff)).toBe(false);
    S.company = null; expect(await recordPermissionAudit('approval', diff)).toBe(false);
  });
  it('đọc: bảng chưa có → notEnabled; có dữ liệu → map đúng trường', async () => {
    S.select.mockResolvedValue({ data: null, error: { message: 'x', code: 'PGRST205' } });
    expect(await loadPermissionAudit()).toMatchObject({ ok: false, notEnabled: true });
    S.select.mockResolvedValue({ data: [{ id: '1', actor_name: 'Long', area: 'approval', target: 't', summary: 's', changes: [{ label: 'a', from: 'b', to: 'c' }], created_at: '2026-10-09T01:00:00Z' }], error: null });
    const r: any = await loadPermissionAudit();
    expect(r.ok).toBe(true); expect(r.rows[0]).toMatchObject({ id: '1', actorName: 'Long', area: 'approval', createdAt: '2026-10-09T01:00:00Z' });
  });
});

import { diffTaskMatrix } from '../permissionAudit';
describe('diff — Quyền Công việc', () => {
  it('thêm/bỏ tick được ghi với nhãn thao tác và vai trò', () => {
    const d = diffTaskMatrix({ actions: { editTask: ['director', 'pm'], deleteTask: ['director', 'assigner'] } }, { actions: { editTask: ['director', 'pm', 'assigner'], deleteTask: ['director'] } }, a => ({ editTask: 'Sửa công việc', deleteTask: 'Xóa công việc' } as any)[a] || a)!;
    expect(d.changes).toContainEqual({ label: 'Sửa công việc — Người giao việc', from: 'Không', to: 'Có' });
    expect(d.changes).toContainEqual({ label: 'Xóa công việc — Người giao việc', from: 'Có', to: 'Không' });
    expect(d.summary).toBe('Quyền Công việc: +1 quyền, −1 quyền');
    expect(diffTaskMatrix({ actions: { a: ['pm'] } }, { actions: { a: ['pm'] } })).toBeNull();
  });
});
