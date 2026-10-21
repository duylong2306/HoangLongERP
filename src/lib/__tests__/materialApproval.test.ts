import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { isMaterialApprover, pendingMaterialForApprover, materialProposalTotal } from '../materialApproval';

describe('đề xuất vật tư chờ duyệt ở Việc của tôi', () => {
  it('người xét duyệt vật tư / Giám đốc / admin được xem; người khác không', () => {
    expect(isMaterialApprover('u1', 'x', false, ['u1', 'u2'])).toBe(true);
    expect(isMaterialApprover('u3', 'x', false, ['u1', 'u2'])).toBe(false);
    expect(isMaterialApprover('u3', 'x', true, [])).toBe(true);
    expect(isMaterialApprover('u3', 'admin', false, [])).toBe(true);
    expect(isMaterialApprover(undefined, 'admin', true, ['u1'])).toBe(false);
  });
  it('chỉ lấy đề xuất ở trạng thái CHỜ DUYỆT, và chỉ khi có quyền duyệt', () => {
    const list = [{ id: 'a', status: 'waiting_approval' }, { id: 'b', status: 'find_supplier' }, { id: 'c', status: 'waiting_order' }, { id: 'd', status: 'waiting_approval' }];
    expect(pendingMaterialForApprover(list, true).map(p => p.id)).toEqual(['a', 'd']);
    expect(pendingMaterialForApprover(list, false)).toEqual([]);
  });
  it('tổng giá trị: ưu tiên báo giá đã chọn, nếu không cộng các dòng vật tư', () => {
    expect(materialProposalTotal({ id: 'a', chosenQuoteId: 'q1', quotes: [{ id: 'q1', total: 900 }], items: [{ qty: 1, price: 5 }] })).toBe(900);
    expect(materialProposalTotal({ id: 'a', items: [{ totalPrice: 300 }, { qty: 2, price: 50 }] })).toBe(400);
    expect(materialProposalTotal({ id: 'a' })).toBe(0);
  });
});

describe('TaskManagement — nối đề xuất vật tư', () => {
  const src = fs.readFileSync('src/components/TaskManagement.tsx', 'utf8');
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  it('tải đề xuất vật tư, nghe sự kiện cập nhật, đếm vào "cần xử lý" và có nút mở Điều Phối Vật Tư', () => {
    expect(src).toMatch(/dbService\.materialProposals\.list\(\)/);
    expect(src).toMatch(/hl-material-proposals-updated/);
    expect(src).toMatch(/materialInbox\.toApprove\.forEach/);   // đề xuất vật tư chờ duyệt vào danh sách "Chờ tôi xử lý"
    expect(src).toMatch(/materialInbox\.toCoordinate\.forEach/);   // và việc điều phối
    expect(src).toMatch(/onOpenMaterialProposal\?\.\(m\.id\)/);
  });
  it('App truyền onOpenMaterialProposal cho TaskManagement', () => {
    const i = app.indexOf('<TaskManagement\n');   // thẻ mở (không phải chú thích có chữ <TaskManagement)
    expect(app.slice(i, i + 2500)).toContain('onOpenMaterialProposal={openMaterialProposal}');
  });
});

import { pendingMaterialForCoordinator, materialInboxFor } from '../materialApproval';
describe('việc điều phối vật tư', () => {
  const list = [
    { id: 'a', status: 'find_supplier' }, { id: 'b', status: 'waiting_order' }, { id: 'c', status: 'waiting_approval' },
    { id: 'd', status: 'ordered' }, { id: 'e', status: 'received' }, { id: 'f', status: 'cancelled' },
  ];
  it('người điều phối được chỉ định thấy đề xuất đang Tìm nhà cung cấp và Chờ đặt hàng', () => {
    expect(pendingMaterialForCoordinator(list, 'u1', ['u1']).map(p => p.id)).toEqual(['a', 'b']);
  });
  it('người không được chỉ định điều phối (kể cả admin) không thấy; không có uid thì rỗng', () => {
    expect(pendingMaterialForCoordinator(list, 'u9', ['u1'])).toEqual([]);
    expect(pendingMaterialForCoordinator(list, undefined, ['u1'])).toEqual([]);
    expect(pendingMaterialForCoordinator(list, 'u1', [])).toEqual([]);
  });
  it('gộp: vừa người duyệt vừa người điều phối → đếm cả hai nhóm; huy hiệu = tổng', () => {
    const r = materialInboxFor(list, { id: 'u1', username: 'x' }, { isAdmin: false, approverIds: ['u1'], coordinatorIds: ['u1'] });
    expect(r.toApprove.map(p => p.id)).toEqual(['c']);
    expect(r.toCoordinate.map(p => p.id)).toEqual(['a', 'b']);
    expect(r.count).toBe(3);
  });
  it('chỉ là người điều phối → không thấy việc chờ duyệt; không có vai trò nào → 0', () => {
    expect(materialInboxFor(list, { id: 'u2' }, { isAdmin: false, approverIds: [], coordinatorIds: ['u2'] }).count).toBe(2);
    expect(materialInboxFor(list, { id: 'u3' }, { isAdmin: false, approverIds: [], coordinatorIds: [] }).count).toBe(0);
    expect(materialInboxFor(list, null, { isAdmin: true, approverIds: [], coordinatorIds: [] }).count).toBe(0);
  });
  it('App (huy hiệu) và TaskManagement dùng chung materialInboxFor và cộng vào số cần xử lý', () => {
    const app = fs.readFileSync('src/App.tsx', 'utf8');
    const tm = fs.readFileSync('src/components/TaskManagement.tsx', 'utf8');
    expect(app).toMatch(/materialInboxFor\(materialProposalsForBadge/);
    expect(app).toMatch(/\+ materialInbox\.count;/);
    expect(app).toMatch(/hl-material-proposals-updated/);
    expect(tm).toMatch(/materialInboxFor\(materialProposals/);
    expect(tm).toMatch(/materialInbox\.toCoordinate/);   // việc điều phối cũng nằm trong "Chờ tôi xử lý" (kiểu Kanban có tab riêng đã bỏ)
  });
});
