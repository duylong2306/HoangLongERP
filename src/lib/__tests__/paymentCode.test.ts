import { describe, it, expect } from 'vitest';
import { nextPaymentCode } from '../paymentCode';

describe('nextPaymentCode', () => {
  it('không có phiếu nào → PC-2026-001', () => {
    expect(nextPaymentCode([])).toBe('PC-2026-001');
  });
  it('lấy số lớn nhất + 1, bỏ qua mã khác định dạng', () => {
    expect(nextPaymentCode([{ code: 'PC-2026-127' }, { code: 'PC-2026-916' }, { code: 'PC-DH-20261017-123' }, {}])).toBe('PC-2026-917');
  });
  it('mã mới không trùng mã nào đang có, kể cả khi đã vượt 999', () => {
    const list = [{ code: 'PC-2026-999' }];
    const c = nextPaymentCode(list);
    expect(c).toBe('PC-2026-1000');
    expect(list.some(p => p.code === c)).toBe(false);
  });
});
