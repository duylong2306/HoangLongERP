// Nhật ký dự án mở rộng sang báo giá, phiếu thu, đơn mua: mẫu câu + điểm nối trong App.tsx (kiểm bằng đọc mã nguồn như các test "wiring" khác).
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../supabase', () => ({ getSupabase: () => null, getCurrentCompanyId: () => null }));
import * as MT from '../messageTemplates';
import { classifyEvent } from '../projectEvents';

const app = fs.readFileSync(path.resolve(__dirname, '../../App.tsx'), 'utf8');
const body = (name: string) => { const i = app.indexOf(name); return app.slice(i, app.indexOf('\n  };', i)); };

describe('mẫu câu nhật ký', () => {
  it('báo giá: lập mới và 4 trạng thái', () => {
    const p = { code: 'BGNT-01', total: 120000000, customer: 'Chị Lan' };
    expect(MT.nk.baoGiaTao(p)).toBe('📝 Lập báo giá BGNT-01: 120.000.000đ · Chị Lan');
    expect(MT.nk.baoGiaTrangThai('sent', p)).toBe('📤 Gửi báo giá BGNT-01: 120.000.000đ · Chị Lan');
    expect(MT.nk.baoGiaTrangThai('approved', p)).toBe('✅ Khách duyệt báo giá BGNT-01: 120.000.000đ · Chị Lan');
    expect(MT.nk.baoGiaTrangThai('rejected', p)).toBe('❌ Khách từ chối báo giá BGNT-01: 120.000.000đ · Chị Lan');
    expect(MT.nk.baoGiaTrangThai('draft', p)).toContain('về bản nháp');
  });
  it('thiếu tổng tiền / khách thì bỏ phần đó, không để dấu thừa', () => {
    expect(MT.nk.baoGiaTao({ code: 'BG-2' })).toBe('📝 Lập báo giá BG-2');
    expect(MT.nk.phieuThuTao({ code: 'PT-1', amount: 5000000 })).toBe('💰 Thu tiền PT-1: 5.000.000đ');
  });
  it('phiếu thu và đơn mua', () => {
    expect(MT.nk.phieuThuTao({ code: 'PT-1', amount: 50000000, method: 'Chuyển khoản', customer: 'Chị Lan' })).toBe('💰 Thu tiền PT-1: 50.000.000đ · Chuyển khoản · Chị Lan');
    expect(MT.nk.phieuThuSua({ code: 'PT-1', amount: 1000000 })).toBe('✏️ Sửa phiếu thu PT-1: 1.000.000đ');
    expect(MT.nk.phieuThuXoa({ code: 'PT-1', amount: 1000000 })).toBe('🗑️ Xóa phiếu thu PT-1: 1.000.000đ');
    expect(MT.nk.donMuaTao({ id: 'PO-1', total: 8000000, supplier: 'Tùng Lâm' })).toBe('🛒 Tạo đơn mua PO-1: 8.000.000đ · Tùng Lâm');
    expect(MT.nk.donMuaXoa({ id: 'PO-1', total: 8000000, supplier: 'Tùng Lâm' })).toBe('🗑️ Xóa đơn mua PO-1: 8.000.000đ · Tùng Lâm');
  });
  it('khi không truyền loại, bộ phân loại tự đoán cũng ra loại hợp lý', () => {
    expect(classifyEvent(MT.nk.phieuThuTao({ code: 'PT-1', amount: 1 })).type).toBe('tc');
    expect(classifyEvent(MT.nk.phieuThuXoa({ code: 'PT-1', amount: 1 })).type).toBe('xoa');
    expect(classifyEvent(MT.nk.donMuaXoa({ id: 'PO-1', total: 1 })).type).toBe('xoa');
    expect(classifyEvent(MT.nk.baoGiaTrangThai('approved', { code: 'BG-1' })).type).toBe('duyet');
  });
});

describe('điểm nối trong App.tsx', () => {
  it('phiếu thu: ghi khi thêm (bỏ qua nhập Excel), sửa, xóa — xóa lấy phiếu TRƯỚC khi lọc khỏi state', () => {
    const add = body('const handleAddReceipt');
    expect(add).toMatch(/newRec\.projectId && newRec\.source !== 'import'/);
    expect(add).toContain('MT.nk.phieuThuTao');
    const del = body('const handleDeleteReceipt');
    expect(del.indexOf('receipts.find(')).toBeLessThan(del.indexOf('setReceipts('));
    expect(del).toContain('MT.nk.phieuThuXoa');
    expect(body('const handleUpdateReceipt')).toContain('MT.nk.phieuThuSua');
  });
  it('báo giá: ghi khi lập mới (không ghi lại báo giá đã có) và khi đổi trạng thái', () => {
    const add = body('const handleAddQuote');
    expect(add).toMatch(/newQuote\.projectId && !quotes\.some\(q => q\.id === newQuote\.id\)/);
    expect(add).toContain('MT.nk.baoGiaTao');
    const st = body('const handleUpdateQuoteStatus');
    expect(st).toMatch(/cur\.status !== status/);
    expect(st).toContain('MT.nk.baoGiaTrangThai');
  });
  it('đơn mua: chỉ đơn tạo tay của dự án thật (không ghi đơn sinh từ đề xuất vật tư — đã có dòng riêng), xóa lấy đơn trước khi lọc', () => {
    const add = body('const handleAddPurchaseOrder');
    expect(add).toMatch(/saved\.projectId && !saved\.proposalId && projects\.some\(p => p\.id === saved\.projectId\)/);
    expect(add).toContain('MT.nk.donMuaTao');
    const del = body('const handleDeletePurchaseOrder');
    expect(del.indexOf('purchaseOrders.find(')).toBeLessThan(del.indexOf('setPurchaseOrders('));
    expect(del).toContain('MT.nk.donMuaXoa');
  });
  it('postProjectNotice nhận loại sự kiện tường minh', () => {
    const pn = fs.readFileSync(path.resolve(__dirname, '../projectNotice.ts'), 'utf8');
    expect(pn).toMatch(/type\?: ProjectEventType/);
    expect(pn).toMatch(/type: p\.type,/);
  });
});
