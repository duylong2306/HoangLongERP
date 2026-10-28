// Chẩn đoán màn hình lúc khởi động: đoạn mã trong index.html ghi số đo; trang "Tôi" cho xem lại.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { ViewportDiag } from '../../components/shell/MobileNav';

const html = fs.readFileSync(path.resolve(__dirname, '../../../index.html'), 'utf8');
const script = (() => { const m = /<script>\s*\/\* vp-probe \*\/([\s\S]*?)<\/script>/.exec(html); if (!m) throw new Error('không thấy đoạn mã'); return m[1]; })();

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
afterEach(() => { vi.useRealTimers(); document.documentElement.querySelectorAll('div[aria-hidden]').forEach(e => e.remove()); });

describe('đoạn mã ghi số đo (index.html)', () => {
  it('ghi số đo ở các thời điểm đầu vào localStorage (mỗi dòng có chiều cao trong, vùng nhìn, màn hình, đáy cố định, vùng an toàn)', () => {
    new Function(script)();
    vi.advanceTimersByTime(5100);
    const rows = JSON.parse(localStorage.getItem('lolo_vp_diag')!);
    expect(rows.map((r: any) => r.t)).toEqual(['t0', 't150', 't500', 't1200', 't2500', 't5000']);
    for (const k of ['innerH', 'innerW', 'vvH', 'screenH', 'clientH', 'fixedBottom', 'safeT', 'safeB', 'standalone', 'displayMode', 'ms']) expect(rows[0]).toHaveProperty(k);
  });
  it('ghi thêm khi chạm / cuộn lần đầu (đúng thời điểm mà iPhone tính lại vùng hiển thị)', () => {
    new Function(script)();
    vi.advanceTimersByTime(10);
    window.dispatchEvent(new Event('touchstart'));
    vi.advanceTimersByTime(350);
    const labels = JSON.parse(localStorage.getItem('lolo_vp_diag')!).map((r: any) => r.t);
    expect(labels).toContain('lần touchstart đầu'); expect(labels).toContain('sau touchstart 300ms');
    window.dispatchEvent(new Event('touchstart')); vi.advanceTimersByTime(350);
    expect(JSON.parse(localStorage.getItem('lolo_vp_diag')!).filter((r: any) => r.t === 'lần touchstart đầu')).toHaveLength(1);   // chỉ lần đầu
  });
  it('lỗi khi ghi (đầy bộ nhớ / bị chặn) không làm hỏng trang', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('đầy'); });
    expect(() => { new Function(script)(); vi.advanceTimersByTime(5100); }).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe('ViewportDiag (trang Tôi)', () => {
  it('chưa có số đo → hướng dẫn mở lại ứng dụng', () => {
    render(<ViewportDiag />);
    expect(screen.getByTestId('vp-diag').textContent).toContain('Chưa có số đo');
  });
  it('có số đo → mỗi dòng một thời điểm, đủ thông số', () => {
    localStorage.setItem('lolo_vp_diag', JSON.stringify([{ t: 't0', ms: 3, innerW: 390, innerH: 760, vvH: 760, vvTop: 0, screenW: 390, screenH: 844, clientH: 760, fixedBottom: 760, safeT: '47px', safeB: '34px', scrollY: 0, standalone: true, displayMode: true }]));
    render(<ViewportDiag />);
    const t = screen.getByTestId('vp-diag').textContent!;
    expect(t).toContain('t0 (3ms)'); expect(t).toContain('trong 390x760'); expect(t).toContain('màn 390x844'); expect(t).toContain('dưới 34px'); expect(t).toContain('standalone true/true');
  });
  it('dữ liệu hỏng → vẫn hiện hướng dẫn, không lỗi', () => {
    localStorage.setItem('lolo_vp_diag', '{hỏng');
    render(<ViewportDiag />);
    expect(screen.getByTestId('vp-diag').textContent).toContain('Chưa có số đo');
  });
  it('nút "Chẩn đoán màn hình" nằm trong trang Tôi và bật/tắt khung số đo', async () => {
    const { default: MobileNav } = await import('../../components/shell/MobileNav');
    const user: any = { name: 'Long', onProfile() {}, onReload() {}, onLogout() {} };
    render(<MobileNav tops={[]} groups={[]} user={user} activeTab="x" />);
    fireEvent.click(screen.getByTestId('bn-me'));
    expect(screen.queryByTestId('vp-diag')).toBeNull();
    fireEvent.click(screen.getByTestId('vp-diag-toggle'));
    expect(screen.getByTestId('vp-diag')).toBeTruthy();
    fireEvent.click(screen.getByTestId('vp-diag-toggle'));
    expect(screen.queryByTestId('vp-diag')).toBeNull();
  });
});
