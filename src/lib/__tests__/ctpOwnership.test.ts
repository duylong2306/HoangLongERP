import { describe, it, expect } from 'vitest';
import { isTravelExpenseBeneficiary } from '../ctpOwnership';

describe('Công tác phí của tôi — theo người được hưởng', () => {
  const b = { id: 'B', name: 'Bình' };
  it('người hưởng thấy, dù không phải người lập', () => {
    expect(isTravelExpenseBeneficiary({ empId: 'B', creatorId: 'A' } as any, b)).toBe(true);
  });
  it('người lập hộ người khác KHÔNG thấy', () => {
    expect(isTravelExpenseBeneficiary({ empId: 'B', creatorId: 'A' } as any, { id: 'A', name: 'An' })).toBe(false);
  });
  it('khoản cũ chưa có mã: dự phòng theo tên người hưởng', () => {
    expect(isTravelExpenseBeneficiary({ employeeName: 'bình' }, b)).toBe(true);
    expect(isTravelExpenseBeneficiary({ employeeName: 'An' }, b)).toBe(false);
  });
  it('đã có mã thì không so tên (tránh trùng tên)', () => {
    expect(isTravelExpenseBeneficiary({ empId: 'X', employeeName: 'Bình' }, b)).toBe(false);
  });
});
