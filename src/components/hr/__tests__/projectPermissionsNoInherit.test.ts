import { describe, it, expect, vi } from 'vitest';

// Hồi quy "kế thừa quyền": trước đây inheritBelow=true khiến quyền cấp cho director/pm lan xuống MỌI vai trò thấp hơn,
// kể cả nhân viên thường (teamMember) → nhân viên thường tạo/xóa được dự án. Nay mặc định TẮT: mỗi vai trò chỉ có đúng quyền được tick.
vi.mock('../../../lib/dbService', () => ({ dbService: { projectPermissions: { get: vi.fn(async () => null), save: vi.fn() } } }));
vi.mock('../../../context', () => ({ isUserInRoleGroup: () => false, isRoleAdmin: () => false, isRoleAccounting: () => false }));
import { can, DEFAULT_PROJECT_PERMISSIONS } from '../hrProjectPermissions';

const nhanVien = { id: 'NV022', name: 'Nhân viên', role: 'worker', roleGroupIds: ['role_factory_mwood'] } as any;
const duAn = { id: 'p1', pmId: 'NV_khac', type: 'construction' } as any;
const duAnCuaPm = { id: 'p2', pmId: 'NV022', type: 'construction' } as any;

describe('Ma trận quyền dự án — không kế thừa xuống vai trò thấp', () => {
  it('mặc định inheritBelow = false', () => {
    expect(DEFAULT_PROJECT_PERMISSIONS.inheritBelow).toBe(false);
  });
  it('quyền chỉ cấp cho director/pm KHÔNG lan xuống nhân viên thường', () => {
    const m = { ...DEFAULT_PROJECT_PERMISSIONS, actions: { ...DEFAULT_PROJECT_PERMISSIONS.actions, createProject: ['director', 'pm'], deleteProject: ['director', 'pm'] } } as any;
    expect(can('createProject', nhanVien, duAn, undefined, m)).toBe(false);
    expect(can('deleteProject', nhanVien, duAn, undefined, m)).toBe(false);
  });
  it('đúng vai trò thì vẫn được (PM của dự án)', () => {
    const m = { ...DEFAULT_PROJECT_PERMISSIONS, actions: { ...DEFAULT_PROJECT_PERMISSIONS.actions, deleteProject: ['director', 'pm'] } } as any;
    expect(can('deleteProject', nhanVien, duAnCuaPm, undefined, m)).toBe(true);
  });
  it('vẫn bật được kế thừa nếu ma trận đặt rõ inheritBelow=true (hành vi cũ không bị xóa)', () => {
    const m = { ...DEFAULT_PROJECT_PERMISSIONS, inheritBelow: true, actions: { ...DEFAULT_PROJECT_PERMISSIONS.actions, createProject: ['director'] } } as any;
    expect(can('createProject', nhanVien, duAn, undefined, m)).toBe(true);
  });
});

// "Thành viên nhóm" (teamMember): ở công việc cụ thể phải THỰC SỰ có tên trong nhiệm vụ, không phải mọi nhân viên.
describe('Vai trò "Thành viên" theo công việc cụ thể', () => {
  const m = { ...DEFAULT_PROJECT_PERMISSIONS, actions: { ...DEFAULT_PROJECT_PERMISSIONS.actions, uploadAttachment: ['teamMember'] } } as any;
  const task = (memberIds: string[]) => ({ id: 't1', assignerId: 'A', assigneeId: 'B', missions: [{ id: 'm1', name: 'x', memberIds, status: 'todo' }] }) as any;
  it('có tên trong nhiệm vụ → được quyền của "Thành viên"', () => {
    expect(can('uploadAttachment', nhanVien, duAn, task(['NV022']), m)).toBe(true);
  });
  it('KHÔNG có tên trong công việc → không được (trước đây mọi nhân viên đều được)', () => {
    expect(can('uploadAttachment', nhanVien, duAn, task(['NV_khac']), m)).toBe(false);
    expect(can('uploadAttachment', nhanVien, duAn, { ...task([]), missions: undefined } as any, m)).toBe(false);
  });
  it('cấp dự án/bảng (không có công việc) → giữ cách cũ: mọi nhân viên là "Thành viên"', () => {
    expect(can('uploadAttachment', nhanVien, duAn, undefined, m)).toBe(true);
  });
});

// Kanban kiểm tra quyền theo ĐÚNG dự án/công việc (canOn) → vai trò theo vị trí mới có tác dụng.
describe('Quyền theo đúng dự án / công việc đang thao tác', () => {
  const m = DEFAULT_PROJECT_PERMISSIONS as any; // mặc định: editTask = giám đốc, trưởng DA, người giao việc
  const congViec = { id: 't1', assignerId: 'NV022', assigneeId: 'B', missions: [] } as any;
  it('Người giao việc của CHÍNH công việc đó được sửa; không truyền công việc thì không (trước đây Kanban không truyền)', () => {
    expect(can('editTask', nhanVien, duAn, congViec, m)).toBe(true);
    expect(can('editTask', nhanVien, duAn, undefined, m)).toBe(false);
  });
  it('công việc của người khác → không được', () => {
    expect(can('editTask', nhanVien, duAn, { ...congViec, assignerId: 'NV_khac' }, m)).toBe(false);
  });
  it('Trưởng DA chỉ có quyền ở dự án MÌNH quản lý, không phải dự án khác', () => {
    expect(can('editProjectInfo', nhanVien, duAnCuaPm, undefined, m)).toBe(true);
    expect(can('editProjectInfo', nhanVien, duAn, undefined, m)).toBe(false);
  });
});

// Đã gỡ "Tầm nhìn": giá trị 'readonly' còn sót trong dữ liệu cũ KHÔNG được khóa quyền nữa (trước đây khóa mọi quyền theo vị trí của vai trò đó,
// kể cả người có nhiều vai trò).
describe('Dữ liệu cũ còn trường visibility không còn ảnh hưởng quyền', () => {
  const m = { ...DEFAULT_PROJECT_PERMISSIONS, visibility: { pm: 'readonly', teamMember: 'readonly' }, actions: { ...DEFAULT_PROJECT_PERMISSIONS.actions, deleteProject: ['pm'] } } as any;
  it('Trưởng DA có tick vẫn được dù visibility cũ ghi readonly', () => {
    expect(can('deleteProject', nhanVien, duAnCuaPm, undefined, m)).toBe(true);
  });
});
