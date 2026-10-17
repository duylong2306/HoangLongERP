import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { isPaymentForNamedLiability as ok, liabilityKeys } from '../liabilityPayments';

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
    expect(src).toMatch(/p\.supplierId === proposal\.subcontractorId/);   // tự phân bổ: khớp theo MÃ NCC
  });
  it('FinanceManagement khớp công nợ theo MÃ trước (mã NCC, mã thầu phụ), tên chỉ dự phòng', () => {
    const src = fs.readFileSync('src/components/FinanceManagement.tsx', 'utf8');
    expect(src).toMatch(/paymentsBySupplierId\.get\(keys\.supplierId\)/);
    expect(src).toMatch(/paymentsBySubcontractorId\.get\(keys\.subcontractorId\)/);
    expect(src).toMatch(/liabilityKeys\(l\)/);
  });
});

describe('liabilityKeys — mã của công nợ', () => {
  it('ưu tiên cột subcontractorId; công nợ đầu kỳ lấy mã từ id; công nợ nhập tay không có mã', () => {
    expect(liabilityKeys({ id: 'x', subcontractorId: 'TP1' } as any)).toEqual({ subcontractorId: 'TP1' });
    expect(liabilityKeys({ id: 'opbal_sub_CTTHNK_11' } as any)).toEqual({ subcontractorId: 'CTTHNK_11' });
    expect(liabilityKeys({ id: 'opbal_sup_NCC_IMP_1785742333287_7' } as any)).toEqual({ supplierId: 'NCC_IMP_1785742333287_7' });
    expect(liabilityKeys({ id: 'liab_1789000' } as any)).toEqual({});
  });
});

import { allocateSubcontractPayments } from '../liabilityPayments';
describe('allocateSubcontractPayments — mỗi phiếu chỉ tính MỘT lần giữa các hợp đồng của cùng thầu phụ', () => {
  const A = { id: 'A', projectId: 'P1', total: 300_000_000 };
  const B = { id: 'B', projectId: 'P2', total: 200_000_000 };
  it('ca thật TRẦN HOÀNG TRUNG HIẾU: 4 phiếu không dự án (292tr) + 1 phiếu dự án P2 (50tr) → tổng 342tr, không nhân đôi', () => {
    const r = allocateSubcontractPayments([A, B], [
      { id: '1', amount: 145_000_000 }, { id: '2', amount: 37_000_000 }, { id: '3', amount: 60_000_000 }, { id: '4', amount: 50_000_000 },
      { id: '5', amount: 50_000_000, projectId: 'P2' },
    ]);
    expect(r).toEqual({ A: 292_000_000, B: 50_000_000 });
    expect(r.A + r.B).toBe(342_000_000);                    // trước đây hiển thị 634tr
    expect(300_000_000 - r.A + (200_000_000 - r.B)).toBe(158_000_000);   // còn phải trả thật: 500tr − 342tr
  });
  it('phiếu có dự án chỉ tính cho hợp đồng của dự án đó; phiếu dự án không khớp hợp đồng nào thì bỏ qua', () => {
    const r = allocateSubcontractPayments([A, B], [{ id: '1', amount: 10, projectId: 'P1' }, { id: '2', amount: 99, projectId: 'PX' }]);
    expect(r).toEqual({ A: 10, B: 0 });
  });
  it('quỹ chung lấp đầy hợp đồng đầu rồi sang hợp đồng sau; dư dồn hợp đồng cuối (trả vượt)', () => {
    expect(allocateSubcontractPayments([A, B], [{ id: '1', amount: 350_000_000 }])).toEqual({ A: 300_000_000, B: 50_000_000 });
    expect(allocateSubcontractPayments([A, B], [{ id: '1', amount: 600_000_000 }])).toEqual({ A: 300_000_000, B: 300_000_000 });
  });
  it('thứ tự thanh toán: phiếu dự án được tính trước khi chia quỹ chung (không chiếm phần của nhau)', () => {
    const r = allocateSubcontractPayments([A, B], [{ id: '1', amount: 200_000_000 }, { id: '2', amount: 200_000_000, projectId: 'P2' }]);
    expect(r.B).toBe(200_000_000);               // B đã đủ nhờ phiếu dự án
    expect(r.A).toBe(200_000_000);               // quỹ chung vào A
  });
  it('1 hợp đồng: nhận tất cả phiếu khớp; hợp đồng không gắn dự án nhận phiếu mọi dự án', () => {
    expect(allocateSubcontractPayments([A], [{ id: '1', amount: 5 }, { id: '2', amount: 7, projectId: 'P1' }, { id: '3', amount: 9, projectId: 'P9' }])).toEqual({ A: 12 });
    expect(allocateSubcontractPayments([{ id: 'C', total: 100 }], [{ id: '1', amount: 40, projectId: 'P9' }])).toEqual({ C: 40 });
  });
  it('FinanceManagement dùng hàm phân bổ này', () => {
    expect(fs.readFileSync('src/components/FinanceManagement.tsx', 'utf8')).toMatch(/allocateSubcontractPayments\(/);
  });
});

import { findUnrecordedOrders, findOrphanSupplierPayments } from '../liabilityPayments';
import { allocateReceipts } from '../receivableAllocation';
describe('cảnh báo lệch đơn mua / phiếu trả NCC so với Công nợ trả', () => {
  const liabs: any[] = [
    { id: 'opbal_sup_S1', category: 'Nhà Cung Cấp', recordedPurchaseOrderIds: [] },
    { id: 'u1', category: 'Nhà Cung Cấp', recordedPurchaseOrderIds: ['O1'] },
    { id: 'tp', category: 'Thầu Phụ', recordedPurchaseOrderIds: ['O9'] },   // công nợ thầu phụ không tính là đã ghi nhận đơn mua
  ];
  it('đơn còn nợ chưa ghi nhận: chỉ đơn xác nhận/hoàn thành, còn nợ > 0, không phải đơn nội bộ kho', () => {
    const orders: any[] = [
      { id: 'O1', status: 'confirmed', congNo: 100, supplierId: 'S2' },                        // đã ghi nhận
      { id: 'O2', status: 'confirmed', congNo: 200, supplierId: 'S2' },                        // CHƯA → cảnh báo
      { id: 'O3', status: 'completed', congNo: 300, supplierId: 'S3' },                        // CHƯA → cảnh báo
      { id: 'O4', status: 'draft', congNo: 400, supplierId: 'S3' },                            // nháp
      { id: 'O5', status: 'confirmed', congNo: 0, supplierId: 'S3' },                          // hết nợ
      { id: 'O6', status: 'confirmed', congNo: 500, supplierId: '__warehouse__' },              // nội bộ kho
      { id: 'O7', status: 'confirmed', congNo: 600, supplierId: 'S3', fromWarehouse: true },
      { id: 'O9', status: 'confirmed', congNo: 700, supplierId: 'S3' },                        // chỉ nằm trong công nợ thầu phụ → vẫn chưa ghi nhận
    ];
    expect(findUnrecordedOrders(orders, liabs).map(o => o.id)).toEqual(['O2', 'O3', 'O9']);
  });
  it('phiếu trả NCC chưa có công nợ: NCC có nợ đầu kỳ hoặc có đơn đã ghi nhận thì không cảnh báo', () => {
    const orders = [{ id: 'O1', supplierId: 'S2' }];
    const pays: any[] = [
      { id: 'a', category: 'supplier_payment', status: 'approved', supplierId: 'S1' },   // có nợ đầu kỳ opbal_sup_S1
      { id: 'b', category: 'supplier_payment', status: 'approved', supplierId: 'S2' },   // đơn O1 của S2 đã ghi nhận
      { id: 'c', category: 'supplier_payment', status: 'approved', supplierId: 'S3' },   // KHÔNG có gì → cảnh báo
      { id: 'd', category: 'supplier_payment', status: 'pending', supplierId: 'S3' },    // chờ duyệt: bỏ qua
      { id: 'e', category: 'subcontractor_advance', status: 'approved', supplierId: 'S3' },
      { id: 'f', category: 'supplier_payment', status: 'approved' },                     // không mã NCC: không xét
    ];
    expect(findOrphanSupplierPayments(pays, liabs, orders).map(p => p.id)).toEqual(['c']);
  });
  it('FinanceManagement hiện banner cảnh báo và nhãn Dư có', () => {
    const src = fs.readFileSync('src/components/FinanceManagement.tsx', 'utf8');
    expect(src).toMatch(/data-testid="liab-alerts"/);
    expect(src).toMatch(/Dư có · khách trả trước/);
    expect(src).toMatch(/allocateReceipts\(/);
  });
});

describe('allocateReceipts — phiếu thu của khách chỉ chia MỘT lần giữa các dòng công nợ nhập tay', () => {
  it('1 dòng nhận đủ như cũ; nhiều dòng chia lần lượt theo phần còn lại; dư dồn dòng cuối', () => {
    expect(allocateReceipts([{ id: 'a', capacity: 100 }], 500)).toEqual({ a: 500 });
    expect(allocateReceipts([{ id: 'a', capacity: 100 }, { id: 'b', capacity: 200 }], 250)).toEqual({ a: 100, b: 150 });
    expect(allocateReceipts([{ id: 'a', capacity: 100 }, { id: 'b', capacity: 200 }], 900)).toEqual({ a: 100, b: 800 });
    expect(allocateReceipts([{ id: 'a', capacity: 100 }, { id: 'b', capacity: 200 }], 0)).toEqual({ a: 0, b: 0 });
  });
  it('tổng các dòng luôn bằng tổng đã thu của khách (không cộng đôi)', () => {
    const r = allocateReceipts([{ id: 'a', capacity: 300 }, { id: 'b', capacity: 300 }, { id: 'c', capacity: 300 }], 700);
    expect(r.a + r.b + r.c).toBe(700);
  });
});
