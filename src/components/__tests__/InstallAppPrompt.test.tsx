import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import InstallAppPrompt from '../InstallAppPrompt';
import { detectPlatform, isInAppBrowser, isSnoozed, snooze, markInstalled, SNOOZE_MS } from '../../lib/installPrompt';

// Thông báo cài ứng dụng ra màn hình: Android có nút Cài đặt (gọi hộp thoại của Chrome), iPhone có hướng dẫn 3 bước.
const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  zaloIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Zalo/23.1',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
};
const setUa = (ua: string) => Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
const setStandalone = (on: boolean) => { window.matchMedia = ((q: string) => ({ matches: on && q.includes('standalone'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as any; };

describe('installPrompt (hàm thuần)', () => {
  it('nhận diện nền tảng; iPadOS tự nhận là Mac có cảm ứng; trình duyệt trong ứng dụng khác', () => {
    expect(detectPlatform(UA.android)).toBe('android'); expect(detectPlatform(UA.ios)).toBe('ios'); expect(detectPlatform(UA.desktop)).toBe('other');
    expect(detectPlatform(UA.desktop, 'MacIntel', 5)).toBe('ios'); expect(detectPlatform(UA.desktop, 'MacIntel', 0)).toBe('other');
    expect(isInAppBrowser(UA.zaloIos)).toBe(true); expect(isInAppBrowser(UA.ios)).toBe(false);
  });
  it('"Để sau" ẩn 3 ngày rồi nhắc lại; đã cài thì không nhắc nữa', () => {
    const m: Record<string, string> = {}; const st = { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; } };
    expect(isSnoozed(1000, st)).toBe(false);
    snooze(1000, st); expect(isSnoozed(1000 + SNOOZE_MS - 1, st)).toBe(true); expect(isSnoozed(1000 + SNOOZE_MS + 1, st)).toBe(false);
    markInstalled(st); expect(isSnoozed(9e15, st)).toBe(true);
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(isSnoozed(1, bad)).toBe(false); expect(() => snooze(1, bad)).not.toThrow();
  });
});

describe('InstallAppPrompt', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); setStandalone(false); });
  afterEach(() => { vi.useRealTimers(); setUa(UA.desktop); });
  const wait = () => act(() => { vi.advanceTimersByTime(4000); });

  it('Android: có sự kiện cài của Chrome → hiện thẻ có nút Cài đặt; bấm thì gọi hộp thoại cài và ẩn thẻ', async () => {
    setUa(UA.android); render(<InstallAppPrompt />);
    const prompt = vi.fn(); const ev: any = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
    act(() => { window.dispatchEvent(ev); }); expect(ev.defaultPrevented).toBe(true); wait();
    expect(screen.getByTestId('install-prompt').getAttribute('data-platform')).toBe('android');
    await act(async () => { fireEvent.click(screen.getByTestId('install-now')); });
    expect(prompt).toHaveBeenCalled(); expect(screen.queryByTestId('install-prompt')).toBeNull(); expect(isSnoozed()).toBe(true);   // đã cài → không nhắc lại
  });
  it('Android chưa có sự kiện cài (đã cài hoặc chưa đủ điều kiện) → không hiện', () => {
    setUa(UA.android); render(<InstallAppPrompt />); wait();
    expect(screen.queryByTestId('install-prompt')).toBeNull();
  });
  it('iPhone (Safari): hiện hướng dẫn 3 bước; "Đã hiểu" ẩn 3 ngày', () => {
    setUa(UA.ios); render(<InstallAppPrompt />); wait();
    expect(screen.getByTestId('install-ios-steps').textContent).toMatch(/Chia sẻ[\s\S]*Thêm vào Màn hình chính[\s\S]*Thêm/);
    fireEvent.click(screen.getByTestId('install-ios-ok')); expect(screen.queryByTestId('install-prompt')).toBeNull(); expect(isSnoozed()).toBe(true);
  });
  it('iPhone trong Zalo/Facebook (trình duyệt trong ứng dụng) → không hiện hướng dẫn sai', () => {
    setUa(UA.zaloIos); render(<InstallAppPrompt />); wait();
    expect(screen.queryByTestId('install-prompt')).toBeNull();
  });
  it('đã chạy dạng ứng dụng (standalone) / máy tính / đang "Để sau" → không hiện', () => {
    setUa(UA.ios); setStandalone(true); const a = render(<InstallAppPrompt />); wait(); expect(screen.queryByTestId('install-prompt')).toBeNull(); a.unmount();
    setStandalone(false); setUa(UA.desktop); const b = render(<InstallAppPrompt />); wait(); expect(screen.queryByTestId('install-prompt')).toBeNull(); b.unmount();
    setUa(UA.ios); snooze(); render(<InstallAppPrompt />); wait(); expect(screen.queryByTestId('install-prompt')).toBeNull();
  });
  it('bấm X → Để sau (ẩn 3 ngày)', () => {
    setUa(UA.ios); render(<InstallAppPrompt />); wait(); fireEvent.click(screen.getByTestId('install-later-x'));
    expect(screen.queryByTestId('install-prompt')).toBeNull(); expect(isSnoozed()).toBe(true);
  });
});
