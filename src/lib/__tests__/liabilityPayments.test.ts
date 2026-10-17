import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { isPaymentForNamedLiability as ok } from '../liabilityPayments';

// Ca thật: CÔNG TY TNHH HƯNG NGUYÊN KHANG vừa là Thầu phụ (CTTHNK_11) vừa là NCC (NCC_IMP_..._7)
const ncc: any = { id: 'opbal_sup_NCC_IMP_1785742333287_7', category: 'Nhà Cung Cấp' };
const thau: any = { id: 'opbal_sub_CTTHNK_11', category: 'Thầu Phụ' };
const pNcc: any = { category: 'supplier_payment', supplierId: 'NCC_IMP_1785742333287_7' };         // PC-2026-916 — 93.520.000
const pThau: any = { category: 'subcontractor_advance', subcontractorId: 'CTTHNK_11' };           // PC-2026-247 — 171.990.000

describe('phiếu chi khớp theo tên — công nợ NCC / Thầu phụ cùng tên', () => {
  it('công nợ NCC nhận phiếu trả NCC, KHÔNG nhận phiếu tạm ứng thầu phụ cùng tên', () => {
    expect(ok(ncc, pNcc)).toBe(true);
    expect(ok(ncc, pThau)).toBe(false);
  });
  it('công nợ Thầu phụ nhận phiếu thầu phụ, KHÔNG nhận phiếu trả NCC cùng tên', () => {
    expect(ok(thau, pThau)).toBe(true);
    expect(ok(thau, pNcc)).toBe(false);
  });
  it('NCC: phiếu có mã thầu phụ bị loại dù hạng mục khác; phiếu gắn mã NCC khác (trùng tên) bị loại; phiếu không mã vẫn nhận', () => {
    expect(ok(ncc, { category: 'supplier_payment', subcontractorId: 'X' } as any)).toBe(false);
    expect(ok(ncc, { category: 'supplier_payment', supplierId: 'NCC_KHAC' } as any)).toBe(false);
    expect(ok(ncc, { category: 'supplier_payment' } as any)).toBe(true);
    expect(ok(ncc, { category: 'other' } as any)).toBe(true);
  });
  it('loại công nợ "Khác" và mã công nợ không phải đầu kỳ NCC: giữ cách khớp cũ', () => {
    expect(ok({ id: 'x', category: 'Khác' } as any, pThau)).toBe(true);
    expect(ok({ id: 'tay', category: 'Nhà Cung Cấp' } as any, { category: 'supplier_payment', supplierId: 'BAT_KY' } as any)).toBe(true);
  });
  it('số thật: NCC nợ đầu kỳ 93,52tr chỉ trừ phiếu 93,52tr → còn 0 (trước đây −171,99tr)', () => {
    const payments = [{ amount: 93_520_000, ...pNcc }, { amount: 171_990_000, ...pThau }];
    const paidNcc = payments.filter(p => ok(ncc, p)).reduce((s, p) => s + p.amount, 0);
    const paidThau = payments.filter(p => ok(thau, p)).reduce((s, p) => s + p.amount, 0);
    expect(93_520_000 - paidNcc).toBe(0);
    expect(573_300_000 - paidThau).toBe(401_310_000);
  });
  it('FinanceManagement dùng hàm này ở công nợ khớp theo tên và ở tự phân bổ đơn hàng', () => {
    const src = fs.readFileSync('src/components/FinanceManagement.tsx', 'utf8');
    expect(src).toMatch(/isPaymentForNamedLiability\(liab, p\)/);
    expect(src).toMatch(/p\.recipient === supplierName && p\.id !== paymentId && !p\.subcontractorId && p\.category !== 'subcontractor_advance'/);
  });
});
