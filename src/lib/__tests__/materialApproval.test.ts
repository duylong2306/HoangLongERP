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
    expect(src).toMatch(/myPendingMaterial\.length\s*\n\s*\} cần xử lý/);
    expect(src).toMatch(/onOpenMaterialProposal\?\.\(m\.id\)/);
  });
  it('App truyền onOpenMaterialProposal cho TaskManagement', () => {
    const i = app.indexOf('<TaskManagement\n');   // thẻ mở (không phải chú thích có chữ <TaskManagement)
    expect(app.slice(i, i + 2500)).toContain('onOpenMaterialProposal={openMaterialProposal}');
  });
});
