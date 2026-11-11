import { describe, it, expect } from 'vitest';
import { getProjectDaysLeft, compareByDaysLeft } from '../projectDeadline';

const NOW = new Date(2026, 10, 11, 15, 30); // 11/11/2026 giữa chiều — phải tính theo ngày, bỏ giờ

describe('getProjectDaysLeft', () => {
  it('endDate dạng ngày: còn / hôm nay / trễ', () => {
    expect(getProjectDaysLeft({ endDate: '2026-11-20' }, NOW)).toBe(9);
    expect(getProjectDaysLeft({ endDate: '2026-11-11' }, NOW)).toBe(0);
    expect(getProjectDaysLeft({ endDate: '2026-11-01' }, NOW)).toBe(-10);
  });
  it('endDate "N ngày" + ngày khởi công', () => {
    expect(getProjectDaysLeft({ startDate: '2026-11-01', endDate: '30 ngày' }, NOW)).toBe(20);
  });
  it('hoàn thành hoặc thiếu dữ liệu → null', () => {
    expect(getProjectDaysLeft({ endDate: '2026-11-20', status: 'completed' }, NOW)).toBeNull();
    expect(getProjectDaysLeft({ endDate: '' }, NOW)).toBeNull();
    expect(getProjectDaysLeft({ endDate: '45 ngày' }, NOW)).toBeNull();
  });
  it('sắp tăng dần: trễ → sắp hết → xa → không có hạn', () => {
    expect([5, null, -3, 20].sort(compareByDaysLeft)).toEqual([-3, 5, 20, null]);
  });
});
