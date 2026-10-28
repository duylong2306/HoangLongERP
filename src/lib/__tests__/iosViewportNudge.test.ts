// Sửa lỗi iPhone (WebKit): vừa mở ứng dụng từ Màn hình chính, vùng hiển thị ngắn hơn màn hình (dải do hệ điều hành vẽ ở đáy) cho tới khi vuốt xuống.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync(path.resolve(__dirname, '../../../index.html'), 'utf8');
const script = (() => { const m = /<script>\s*\/\* ios-viewport-nudge \*\/([\s\S]*?)<\/script>/.exec(html); if (!m) throw new Error('không thấy đoạn mã'); return m[1]; })();

let scroll: any, resizes: number, mm: any;
const onResize = () => { resizes++; };
/** Giả lập máy: innerH = chiều cao vùng hiển thị, screenH = chiều cao màn hình, portrait = đang để dọc */
const device = (o: { standalone?: boolean; innerH: number; screenH?: number; portrait?: boolean }) => {
  (navigator as any).standalone = o.standalone ?? true;
  Object.defineProperty(window, 'innerHeight', { value: o.innerH, configurable: true });
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
  Object.defineProperty(window, 'screen', { value: { width: 390, height: o.screenH ?? 844 }, configurable: true });
  mm = vi.fn((q: string) => ({ matches: q.includes('orientation: portrait') ? (o.portrait ?? true) : q.includes('display-mode') ? (o.standalone ?? true) : false }));
  (window as any).matchMedia = mm;
};
beforeEach(() => {
  vi.useFakeTimers();
  document.head.innerHTML = '<meta name="viewport" content="width=device-width, viewport-fit=cover">';
  document.body.innerHTML = '<div id="root"></div>';
  document.body.removeAttribute('style'); document.documentElement.removeAttribute('style');
  scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  resizes = 0; window.addEventListener('resize', onResize);
});
afterEach(() => { vi.useRealTimers(); window.removeEventListener('resize', onResize); scroll.mockRestore(); delete (navigator as any).standalone; delete (window as any).matchMedia; });

const run = () => new Function(script)();

describe('đẩy iOS tính lại vùng hiển thị lúc khởi động', () => {
  it('ứng dụng cài ở Màn hình chính, để dọc, vùng hiển thị NGẮN hơn màn hình: ẩn/hiện #root, cuộn 2px rồi về 0, gắn lại thẻ viewport, phát resize — và lặp lại vài lần', () => {
    device({ innerH: 764 });   // thiếu 80px như trong video
    const before = document.querySelector('meta[name="viewport"]');
    const root = document.getElementById('root')!;
    const displays: string[] = [];
    const orig = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'style')!;   // theo dõi thay đổi display của #root
    const styleObj = root.style; const setProp = vi.spyOn(styleObj, 'display', 'set').mockImplementation(function (this: any, v: string) { displays.push(v); });
    void orig;
    run(); vi.advanceTimersByTime(0);
    expect(displays.slice(0, 2)).toEqual(['none', '']);                                  // ẩn rồi trả lại (cùng một lượt chạy)
    expect(scroll.mock.calls.slice(0, 2)).toEqual([[0, 2], [0, 0]]);
    expect(resizes).toBe(1);
    const after = document.querySelector('meta[name="viewport"]')!;
    expect(after).not.toBe(before);
    expect(after.getAttribute('content')).toBe('width=device-width, viewport-fit=cover');
    expect(document.documentElement.style.minHeight).toBe(''); expect(document.body.style.minHeight).toBe('');
    vi.advanceTimersByTime(4000);
    expect(resizes).toBe(6);                                                              // 6 lần theo lịch 0/120/400/900/1800/3500ms
    setProp.mockRestore();
  });
  it('vùng hiển thị đã KHỚP màn hình (không bị ngắn): không làm gì', () => {
    device({ innerH: 844 });
    run(); vi.advanceTimersByTime(5000);
    expect(scroll).not.toHaveBeenCalled(); expect(resizes).toBe(0);
  });
  it('chênh nhỏ (≤16px, vd. thanh trạng thái) cũng bỏ qua', () => {
    device({ innerH: 834 });
    run(); vi.advanceTimersByTime(5000);
    expect(resizes).toBe(0);
  });
  it('để NGANG: iOS vẫn báo kích thước dọc của máy nên không được coi là "ngắn"', () => {
    device({ innerH: 390, portrait: false });
    run(); vi.advanceTimersByTime(5000);
    expect(resizes).toBe(0);
  });
  it('trình duyệt thường (không phải ứng dụng đã cài): không làm gì', () => {
    device({ innerH: 764, standalone: false });
    run(); vi.advanceTimersByTime(5000);
    expect(scroll).not.toHaveBeenCalled(); expect(resizes).toBe(0);
  });
  it('quay lại ứng dụng từ nền (visibilitychange) cũng thử lại; lỗi bất kỳ không làm hỏng trang', () => {
    device({ innerH: 764 });
    run(); vi.advanceTimersByTime(4000); resizes = 0;
    document.dispatchEvent(new Event('visibilitychange')); vi.advanceTimersByTime(150);
    expect(resizes).toBeGreaterThanOrEqual(1);   // (≥: các lần chạy trước trong cùng tệp để lại bộ nghe trên document)
    scroll.mockImplementation(() => { throw new Error('lỗi'); });
    expect(() => { window.dispatchEvent(new Event('pageshow')); }).not.toThrow();
  });
});
