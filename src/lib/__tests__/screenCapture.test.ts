import { describe, it, expect, vi, afterEach } from 'vitest';
import { canCaptureDisplay, captureDisplay } from '../screenCapture';

afterEach(() => { vi.restoreAllMocks(); });
const nav = (o: any) => o as Navigator;

describe('canCaptureDisplay', () => {
  it('máy tính có getDisplayMedia → true', () => {
    expect(canCaptureDisplay(nav({ mediaDevices: { getDisplayMedia: () => {} }, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/130' }))).toBe(true);
  });
  it('điện thoại / máy tính bảng → false dù trình duyệt có hàm', () => {
    const md = { getDisplayMedia: () => {} };
    expect(canCaptureDisplay(nav({ mediaDevices: md, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari' }))).toBe(false);
    expect(canCaptureDisplay(nav({ mediaDevices: md, userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome Mobile' }))).toBe(false);
    expect(canCaptureDisplay(nav({ mediaDevices: md, userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0) Safari' }))).toBe(false);
  });
  it('không có getDisplayMedia / không có navigator → false', () => {
    expect(canCaptureDisplay(nav({ mediaDevices: {}, userAgent: 'Chrome' }))).toBe(false);
    expect(canCaptureDisplay(nav({ userAgent: 'Chrome' }))).toBe(false);
    expect(canCaptureDisplay(undefined)).toBe(false);
  });
});

describe('captureDisplay', () => {
  const setMedia = (getDisplayMedia: any) => Object.defineProperty(navigator, 'mediaDevices', { value: { getDisplayMedia }, configurable: true });
  it('người dùng bấm Hủy ở hộp chọn của trình duyệt → null, không lỗi', async () => {
    setMedia(vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' })));
    await expect(captureDisplay()).resolves.toBeNull();
  });
  it('lỗi khác được ném ra để giao diện báo người dùng', async () => {
    setMedia(vi.fn().mockRejectedValue(Object.assign(new Error('hỏng'), { name: 'NotReadableError' })));
    await expect(captureDisplay()).rejects.toThrow('hỏng');
  });
});
