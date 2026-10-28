// Sửa lỗi iPhone: vừa mở ứng dụng từ Màn hình chính, vùng hiển thị ngắn hơn màn hình (dải trắng ở đáy) cho tới khi vuốt xuống.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync(path.resolve(__dirname, '../../../index.html'), 'utf8');
const script = (() => { const m = /<script>\s*\/\* ios-viewport-nudge \*\/([\s\S]*?)<\/script>/.exec(html); if (!m) throw new Error('không thấy đoạn mã'); return m[1]; })();

let scroll: any, resizes: number;
const onResize = () => { resizes++; };
beforeEach(() => {
  vi.useFakeTimers();
  document.head.innerHTML = '<meta name="viewport" content="width=device-width, viewport-fit=cover">';
  document.body.removeAttribute('style'); document.documentElement.removeAttribute('style');
  scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  resizes = 0; window.addEventListener('resize', onResize);
});
afterEach(() => { vi.useRealTimers(); window.removeEventListener('resize', onResize); scroll.mockRestore(); delete (navigator as any).standalone; });

const run = () => new Function(script)();

describe('đẩy iOS tính lại vùng hiển thị lúc khởi động', () => {
  it('ứng dụng cài ở Màn hình chính (iPhone): cuộn 2px rồi về 0, gắn lại thẻ viewport, phát resize — và lặp lại vài lần', () => {
    (navigator as any).standalone = true;
    const before = document.querySelector('meta[name="viewport"]');
    run();
    vi.advanceTimersByTime(0);
    expect(scroll.mock.calls.slice(0, 2)).toEqual([[0, 2], [0, 0]]);
    expect(resizes).toBe(1);
    const after = document.querySelector('meta[name="viewport"]')!;
    expect(after).not.toBe(before);                                                   // đã gắn lại thẻ
    expect(after.getAttribute('content')).toBe('width=device-width, viewport-fit=cover');   // nội dung giữ nguyên
    // trả lại kiểu dáng tạm (không để lại 2px thừa)
    expect(document.documentElement.style.minHeight).toBe(''); expect(document.body.style.minHeight).toBe('');
    vi.advanceTimersByTime(4000);
    expect(resizes).toBe(6);                                                          // 6 lần theo lịch 0/120/400/900/1800/3500ms
  });
  it('trình duyệt thường (không phải ứng dụng đã cài): không làm gì', () => {
    (navigator as any).standalone = false;
    run(); vi.advanceTimersByTime(5000);
    expect(scroll).not.toHaveBeenCalled(); expect(resizes).toBe(0);
  });
  it('quay lại ứng dụng từ nền (visibilitychange) cũng đẩy lại; lỗi bất kỳ không làm hỏng trang', () => {
    (navigator as any).standalone = true;
    run(); vi.advanceTimersByTime(4000); resizes = 0;
    document.dispatchEvent(new Event('visibilitychange')); vi.advanceTimersByTime(150);
    expect(resizes).toBeGreaterThanOrEqual(1);   // (≥: các lần chạy thử trước trong cùng tệp để lại bộ nghe trên document)
    scroll.mockImplementation(() => { throw new Error('lỗi'); });
    expect(() => { window.dispatchEvent(new Event('pageshow')); }).not.toThrow();
  });
});
