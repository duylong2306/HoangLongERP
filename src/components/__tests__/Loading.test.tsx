// Hiệu ứng loading LoLo: màn chờ (C), khung xương (D), loader nhỏ + các điểm nối trong ứng dụng.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import LoadingScreen, { SPLASH_MESSAGES, SPLASH_STEP_MS } from '../LoadingScreen';
import MiniLoader from '../MiniLoader';
import { ListSkeleton, Skeleton } from '../Skeleton';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
afterEach(() => { vi.useRealTimers(); });

describe('LoadingScreen (màn chờ khi mở ứng dụng)', () => {
  it('hiện logo thật, thanh tiến độ và câu trạng thái đầu tiên', () => {
    render(<LoadingScreen />);
    expect(screen.getByRole('status', { name: 'Đang tải' })).toBeTruthy();
    expect(screen.getByAltText('LoLo').getAttribute('src')).toBe('/lolo-icon-192.png');
    expect(screen.getByTestId('loading-message').textContent).toBe(SPLASH_MESSAGES[0]);
    expect(screen.getByText('Nền tảng ERP đa doanh nghiệp')).toBeTruthy();
  });
  it('đổi câu trạng thái dần theo thời gian và GIỮ ở câu cuối (không quay vòng lại)', () => {
    vi.useFakeTimers();
    render(<LoadingScreen />);
    act(() => { vi.advanceTimersByTime(SPLASH_STEP_MS); });
    expect(screen.getByTestId('loading-message').textContent).toBe(SPLASH_MESSAGES[1]);
    act(() => { vi.advanceTimersByTime(SPLASH_STEP_MS); });
    expect(screen.getByTestId('loading-message').textContent).toBe(SPLASH_MESSAGES[2]);
    act(() => { vi.advanceTimersByTime(SPLASH_STEP_MS * 5); });
    expect(screen.getByTestId('loading-message').textContent).toBe(SPLASH_MESSAGES[2]);
  });
  it('chỉ 1 câu thì đứng yên; có thể bỏ dòng chân trang', () => {
    vi.useFakeTimers();
    render(<LoadingScreen messages={['Đang tải…']} footer="" />);
    act(() => { vi.advanceTimersByTime(SPLASH_STEP_MS * 3); });
    expect(screen.getByTestId('loading-message').textContent).toBe('Đang tải…');
    expect(screen.queryByText('Nền tảng ERP đa doanh nghiệp')).toBeNull();
  });
});

describe('MiniLoader (loader nhỏ)', () => {
  it('4 ô vuông, đúng cỡ, nhận lớp phụ để đổi màu / căn chỉnh', () => {
    render(<MiniLoader size={20} className="text-amber-400 mr-1" />);
    const el = screen.getByTestId('mini-loader');
    expect(el.querySelectorAll('i')).toHaveLength(4);
    expect(el.style.width).toBe('20px'); expect(el.style.height).toBe('20px');
    expect(el.className).toContain('lolo-mini'); expect(el.className).toContain('text-amber-400');
    expect(el.getAttribute('aria-hidden')).toBe('true');   // trang trí: không tranh vai trò "status" với thông báo thật cạnh nút
    expect(el.getAttribute('role')).toBeNull();
  });
  it('khi đứng một mình và có nhãn thì được đọc là trạng thái "đang tải"', () => {
    render(<MiniLoader label="Đang tải danh sách" />);
    expect(screen.getByRole('status', { name: 'Đang tải danh sách' })).toBeTruthy();
  });
});

describe('Skeleton / ListSkeleton (khung xương)', () => {
  it('dựng đúng số hàng, có ô đầu hàng và nhãn "Đang tải…" kèm loader nhỏ', () => {
    render(<ListSkeleton rows={3} />);
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(3);
    expect(screen.getByText('Đang tải…')).toBeTruthy();
    expect(screen.getAllByTestId('mini-loader')).toHaveLength(1);
    expect(screen.getByTestId('list-skeleton').querySelectorAll('.lolo-sk').length).toBe(3 * 3);   // mỗi hàng: 1 ô + 2 dòng
  });
  it('không ô đầu hàng, đổi / ẩn nhãn', () => {
    const { rerender } = render(<ListSkeleton rows={2} avatar={false} label="Đang tải nhật ký…" />);
    expect(screen.getByText('Đang tải nhật ký…')).toBeTruthy();
    expect(screen.getByTestId('list-skeleton').querySelectorAll('.lolo-sk').length).toBe(2 * 2);
    rerender(<ListSkeleton rows={2} label="" />);
    expect(screen.queryByTestId('mini-loader')).toBeNull();
  });
  it('Skeleton là khối ẩn khỏi trình đọc màn hình', () => {
    const { container } = render(<Skeleton style={{ height: 10 }} />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('điểm nối trong ứng dụng', () => {
  it('index.html có màn chờ sớm trong #root (trước khi JavaScript chạy) cùng kiểu dáng .lolo-splash', () => {
    const html = read('index.html');
    expect(html).toMatch(/<div id="root"><div class="lolo-splash"/);
    expect(html).toContain('/lolo-icon-192.png');
    expect(html).toMatch(/\.lolo-splash\{/); expect(html).toMatch(/prefers-reduced-motion/);
    // CSS dùng chung có đủ các lớp mà màn chờ sớm dùng
    const css = read('src/index.css');
    for (const k of ['.lolo-splash{', '.lolo-splash-logo{', '.lolo-splash-bar{', '.lolo-mini{', '.lolo-sk{', 'prefers-reduced-motion']) expect(css).toContain(k);
  });
  it('App và main dùng LoadingScreen thay cho vòng xoay cũ', () => {
    const app = read('src/App.tsx');
    expect(app.match(/return <LoadingScreen \/>;/g)?.length).toBe(2);
    expect(app).not.toMatch(/border-emerald-500\/30 border-t-emerald-400/);
    expect(read('src/main.tsx')).toMatch(/Suspense fallback=\{<LoadingScreen/);
  });
  it('KHÔNG còn vòng xoay lẻ nào trong mã nguồn (animate-spin / Loader2) — dùng MiniLoader', () => {
    const offenders: string[] = [];
    const walk = (d: string) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).forEach(e => {
      const rel = `${d}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'test') walk(rel); return; }
      if (!/\.(tsx|ts)$/.test(e.name)) return;
      const s = read(rel);
      if (/animate-spin|\bLoader2\b/.test(s)) offenders.push(rel);
    });
    walk('src');
    expect(offenders).toEqual([]);
  });
  it('các màn danh sách / bảng / mẫu tài liệu đang tải dùng khung xương', () => {
    for (const f of ['platform/LogsTab', 'platform/AccountsTab', 'platform/CompaniesTab', 'platform/OrdersTab', 'platform/PlansTab', 'platform/SettingsTab', 'subscription/SubscriptionPanel',
      'CabinetArchive', 'ConstructionArchive', 'MechanicalArchive', 'SubcontractorArchive', 'AcceptanceDocument', 'ContractDocument', 'LegalDocument', 'LiquidationDocument', 'hr/tabs/PermissionAuditLog', 'ProjectActivityModal'])
      expect(read(`src/components/${f}.tsx`), f).toMatch(/ListSkeleton/);
  });
});
