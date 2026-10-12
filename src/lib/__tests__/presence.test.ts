import { describe, it, expect, beforeEach } from 'vitest';
import { applyPresenceState, isOnline, getLastSeen, formatLastSeen, stopPresence } from '../presence';

describe('presence', () => {
  beforeEach(() => stopPresence());
  it('online theo khóa presence; nhiều tab cùng 1 người vẫn là 1 người', () => {
    applyPresenceState({ a: [{}, {}], b: [{}] });
    expect(isOnline('a')).toBe(true);
    expect(isOnline('b')).toBe(true);
    expect(isOnline('c')).toBe(false);
    expect(isOnline(undefined)).toBe(false);
  });
  it('người rời đi được ghi lại lần cuối thấy; khóa rỗng không tính là online', () => {
    applyPresenceState({ a: [{}] }, 1000);
    applyPresenceState({ a: [] }, 5000);
    expect(isOnline('a')).toBe(false);
    expect(getLastSeen('a')).toBe(5000);
  });
  it('chưa từng thấy → không có lần cuối', () => {
    expect(getLastSeen('x')).toBeUndefined();
    expect(formatLastSeen(undefined)).toBe('Ngoại tuyến');
  });
  it('định dạng thời gian', () => {
    const now = 10_000_000;
    expect(formatLastSeen(now - 10_000, now)).toBe('Hoạt động vừa xong');
    expect(formatLastSeen(now - 5 * 60_000, now)).toBe('Hoạt động 5 phút trước');
    expect(formatLastSeen(now - 3 * 3600_000, now)).toBe('Hoạt động 3 giờ trước');
    expect(formatLastSeen(now - 2 * 86400_000, now)).toBe('Hoạt động 2 ngày trước');
  });
  it('stopPresence xóa trạng thái', () => {
    applyPresenceState({ a: [{}] });
    stopPresence();
    expect(isOnline('a')).toBe(false);
  });
});
