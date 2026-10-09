import { describe, it, expect } from 'vitest';
import { employeesToCleanAfterGroupDelete } from '../roleGroupCleanup';

// Xóa nhóm vai trò phải gỡ mã nhóm khỏi nhân viên (trước đây để lại mã "ma" trong employees.role_group_ids).
describe('employeesToCleanAfterGroupDelete', () => {
  const ds = [
    { id: 'A', roleGroupIds: ['g1'] },
    { id: 'B', roleGroupIds: ['g1', 'g2'] },
    { id: 'C', roleGroupIds: ['g2'] },
    { id: 'D', roleGroupIds: [] },
    { id: 'E' },
    { roleGroupIds: ['g1'] },           // không có id → bỏ qua, không lỗi
  ] as any[];
  it('chỉ trả về nhân viên đang trỏ tới nhóm bị xóa, và giữ lại các nhóm khác của họ', () => {
    expect(employeesToCleanAfterGroupDelete(ds, 'g1')).toEqual([
      { empId: 'A', roleGroupIds: [] },
      { empId: 'B', roleGroupIds: ['g2'] },
    ]);
  });
  it('nhóm không ai thuộc về → không có gì để dọn', () => {
    expect(employeesToCleanAfterGroupDelete(ds, 'g9')).toEqual([]);
  });
  it('danh sách rỗng/undefined không gây lỗi', () => {
    expect(employeesToCleanAfterGroupDelete([], 'g1')).toEqual([]);
    expect(employeesToCleanAfterGroupDelete(undefined as any, 'g1')).toEqual([]);
  });
});
