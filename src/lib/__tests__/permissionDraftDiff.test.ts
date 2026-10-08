import { describe, it, expect } from 'vitest';
import { countSetChanges, countRoleGroupMatrixChanges, isRoleGroupCellChanged, countProjectMatrixChanges, isProjectCellChanged, countListChangesById, countJsonChanges } from '../permissionDraftDiff';

describe('Đếm thay đổi chưa lưu của màn hình phân quyền', () => {
  it('tập: thêm và bớt đều tính', () => {
    expect(countSetChanges(['a', 'b'], ['a', 'b'])).toBe(0);
    expect(countSetChanges(['a', 'b', 'c'], ['a'])).toBe(2);   // thêm b, c
    expect(countSetChanges(['a'], ['a', 'b'])).toBe(1);        // bớt b
    expect(countSetChanges(['a', 'x'], ['a', 'y'])).toBe(2);   // đổi x → y
    expect(countSetChanges(undefined, undefined)).toBe(0);
  });
  it('ma trận Vai trò nhóm HRM: đếm đúng số ô đã đổi — đúng tình huống Kế toán Ngọc Thịnh (đã lưu 3 quyền, tích thêm 4)', () => {
    const saved = { roleGroupActions: { kt: ['createProject', 'editProjectInfo', 'viewProjectFinance'] } };
    const draft = { roleGroupActions: { kt: ['createProject', 'editProjectInfo', 'viewProjectFinance', 'deleteProject', 'exportProject', 'createColumn', 'editColumn'] } };
    expect(countRoleGroupMatrixChanges(draft, saved)).toBe(4);
    expect(isRoleGroupCellChanged(draft, saved, 'kt', 'deleteProject')).toBe(true);
    expect(isRoleGroupCellChanged(draft, saved, 'kt', 'createProject')).toBe(false);
    expect(countRoleGroupMatrixChanges(saved, saved)).toBe(0);
  });
  it('nhóm mới được thêm vào nháp cũng được đếm; nhóm bị bỏ hết tích cũng đếm', () => {
    expect(countRoleGroupMatrixChanges({ roleGroupActions: { a: ['x'], b: ['y', 'z'] } }, { roleGroupActions: { a: ['x'] } })).toBe(2);
    expect(countRoleGroupMatrixChanges({ roleGroupActions: { a: [] } }, { roleGroupActions: { a: ['x', 'y'] } })).toBe(2);
    expect(countRoleGroupMatrixChanges(null, undefined)).toBe(0);
  });
  it('ma trận Theo vị trí: ô, tầm nhìn và công tắc kế thừa', () => {
    const saved = { actions: { createCard: ['director', 'pm'], deleteProject: ['director'] }, visibility: { pm: 'all', teamMember: 'related' }, inheritBelow: true };
    const draft = { actions: { createCard: ['director', 'pm', 'accountant'], deleteProject: [] }, visibility: { pm: 'all', teamMember: 'all' }, inheritBelow: false };
    expect(countProjectMatrixChanges(draft, saved)).toBe(1 + 1 + 1 + 1);   // +accountant, bỏ director khỏi deleteProject, tầm nhìn teamMember, kế thừa
    expect(isProjectCellChanged(draft, saved, 'createCard', 'accountant')).toBe(true);
    expect(isProjectCellChanged(draft, saved, 'createCard', 'pm')).toBe(false);
    expect(countProjectMatrixChanges(saved, saved)).toBe(0);
  });
  it('danh sách có id: thêm / xóa / sửa', () => {
    const saved = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }];
    expect(countListChangesById([{ id: '1', name: 'A' }, { id: '2', name: 'B2' }, { id: '3', name: 'C' }], saved)).toBe(2);   // sửa 2, thêm 3
    expect(countListChangesById([{ id: '1', name: 'A' }], saved)).toBe(1);                                                   // xóa 2
    expect(countListChangesById(saved, saved)).toBe(0);
  });
  it('JSON lồng nhau: đếm số giá trị khác', () => {
    expect(countJsonChanges({ a: 1, b: { c: [1, 2] } }, { a: 1, b: { c: [1, 2] } })).toBe(0);
    expect(countJsonChanges({ a: 1, b: { c: [1, 2] } }, { a: 2, b: { c: [1, 3] } })).toBe(3);   // a đổi + c: bớt 2 thêm 3 = 2... tổng 3
  });
});
