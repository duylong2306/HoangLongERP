import { describe, it, expect } from 'vitest';
import { matchesMaterialSearch } from '../materialSearch';

const f = { docName: 'Đề xuất vật tư tháng 10', docCode: 'VATTU-DA_THAKVI_8-2026', projName: 'THI HÀNH ÁN KHU VỰC IV', projCode: 'DA_THAKVI_8', poCodes: ['PO-1791623232557-0', 'PO-1791788953651-1'] };

describe('Tìm kiếm ở Điều phối vật tư', () => {
  it('tìm theo mã đơn hàng, đầy đủ hoặc một phần, không phân biệt hoa/thường', () => {
    expect(matchesMaterialSearch('PO-1791623232557-0', f)).toBe(true);
    expect(matchesMaterialSearch('po-1791623232557', f)).toBe(true);
    expect(matchesMaterialSearch('1791788953651', f)).toBe(true);
    expect(matchesMaterialSearch('  PO-1791623232557-0  ', f)).toBe(true);   // dán thừa khoảng trắng
  });
  it('mã đơn hàng của đề xuất khác thì không khớp', () => {
    expect(matchesMaterialSearch('PO-9999999999999-0', f)).toBe(false);
  });
  it('vẫn tìm được theo tên / mã đề xuất và tên / mã dự án như trước', () => {
    expect(matchesMaterialSearch('thi hành án', f)).toBe(true);
    expect(matchesMaterialSearch('da_thakvi_8', f)).toBe(true);
    expect(matchesMaterialSearch('vattu-da', f)).toBe(true);
    expect(matchesMaterialSearch('đề xuất vật tư', f)).toBe(true);
    expect(matchesMaterialSearch('không có', f)).toBe(false);
  });
  it('ô tìm trống khớp tất cả; đề xuất chưa có đơn hàng vẫn tìm bình thường', () => {
    expect(matchesMaterialSearch('', f)).toBe(true);
    expect(matchesMaterialSearch('   ', f)).toBe(true);
    expect(matchesMaterialSearch('PO-1', { docName: 'A', poCodes: [] })).toBe(false);
    expect(matchesMaterialSearch('a', { docName: 'A' })).toBe(true);
  });
});
