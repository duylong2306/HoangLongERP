import { describe, it, expect } from 'vitest';
import { resolveShiftTimes, DEFAULT_SHIFT_TIMES } from '../standardShiftTimes';

describe('Giờ chuẩn của ca (đọc từ cấu hình)', () => {
  it('không có cấu hình → dùng mặc định', () => {
    expect(resolveShiftTimes(undefined)).toEqual(DEFAULT_SHIFT_TIMES);
    expect(resolveShiftTimes(null)).toEqual(DEFAULT_SHIFT_TIMES);
  });
  it('dùng đúng giờ trong cấu hình', () => {
    expect(resolveShiftTimes({ morningIn: '08:00', morningOut: '12:00', afternoonIn: '13:30', afternoonOut: '17:30' }))
      .toEqual({ morningIn: '08:00', morningOut: '12:00', afternoonIn: '13:30', afternoonOut: '17:30' });
  });
  it('chuẩn hóa "H:MM" thành "HH:MM"', () => expect(resolveShiftTimes({ morningIn: '7:30' }).morningIn).toBe('07:30'));
  it('mốc thiếu hoặc sai định dạng chỉ thay riêng mốc đó bằng mặc định, các mốc đúng giữ nguyên', () => {
    const r = resolveShiftTimes({ morningIn: '08:00', morningOut: 'abc', afternoonIn: '25:00', afternoonOut: '' });
    expect(r).toEqual({ morningIn: '08:00', morningOut: '11:30', afternoonIn: '13:00', afternoonOut: '17:00' });
  });
});
