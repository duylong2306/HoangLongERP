// Huy hiệu số trên biểu tượng ứng dụng: ứng dụng mở (đặt số thật) + service worker (cộng 1 mỗi thông báo khi đóng).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { applyAppBadge, normalizeBadge, badgeSupported, useAppBadge, BADGE_CACHE, BADGE_KEY } from '../appBadge';

const root = path.resolve(__dirname, '../../..');
const swSrc = fs.readFileSync(path.join(root, 'public/web-push-sw.js'), 'utf8');

/** Cache giả (Map) dùng chung cho "ứng dụng" và "service worker" */
function fakeCaches() {
  const store = new Map<string, string>();
  return {
    store,
    api: { open: async () => ({ put: async (k: string, r: Response) => { store.set(k, await r.text()); }, match: async (k: string) => (store.has(k) ? new Response(store.get(k)!) : undefined) }) },
  };
}

describe('normalizeBadge', () => {
  it('nguyên, không âm; không phải số → 0', () => {
    expect(normalizeBadge(3.9)).toBe(3); expect(normalizeBadge(-5)).toBe(0);
    expect(normalizeBadge(NaN)).toBe(0); expect(normalizeBadge(Infinity)).toBe(0);
  });
});

describe('applyAppBadge', () => {
  let set: any, clear: any, c: ReturnType<typeof fakeCaches>;
  beforeEach(() => {
    set = vi.fn(async () => {}); clear = vi.fn(async () => {}); c = fakeCaches();
    (navigator as any).setAppBadge = set; (navigator as any).clearAppBadge = clear; (globalThis as any).caches = c.api;
  });
  afterEach(() => { delete (navigator as any).setAppBadge; delete (navigator as any).clearAppBadge; delete (globalThis as any).caches; });

  it('có số → đặt huy hiệu và ghi nhớ số thật cho service worker', async () => {
    await applyAppBadge(7);
    expect(set).toHaveBeenCalledWith(7);
    expect(c.store.get(BADGE_KEY)).toBe('7');
  });
  it('số 0 → xóa huy hiệu và ghi nhớ 0', async () => {
    await applyAppBadge(0);
    expect(clear).toHaveBeenCalled(); expect(set).not.toHaveBeenCalled();
    expect(c.store.get(BADGE_KEY)).toBe('0');
  });
  it('trình duyệt không hỗ trợ → không làm gì, không ném lỗi', async () => {
    delete (navigator as any).setAppBadge;
    expect(badgeSupported()).toBe(false);
    await expect(applyAppBadge(5)).resolves.toBeUndefined();
    expect(c.store.size).toBe(0);
  });
  it('trình duyệt từ chối (lỗi) → bỏ qua', async () => {
    set.mockRejectedValue(new Error('NotAllowed'));
    await expect(applyAppBadge(3)).resolves.toBeUndefined();
  });
  it('hook đặt huy hiệu theo số hiện tại và đặt lại khi số đổi', async () => {
    const { rerender } = renderHook(({ n }) => useAppBadge(n), { initialProps: { n: 2 } });
    await vi.waitFor(() => expect(set).toHaveBeenCalledWith(2));
    rerender({ n: 0 });
    await vi.waitFor(() => expect(clear).toHaveBeenCalled());
  });
});

describe('service worker: cộng 1 mỗi thông báo khi ứng dụng đóng', () => {
  function runPush(opts: { clients?: any[]; supported?: boolean; cache?: Map<string, string> }) {
    const handlers: Record<string, (e: any) => void> = {};
    const c = fakeCaches(); if (opts.cache) opts.cache.forEach((v, k) => c.store.set(k, v));
    const setAppBadge = vi.fn(async () => {});
    const self: any = {
      addEventListener: (n: string, f: any) => { handlers[n] = f; },
      registration: { showNotification: vi.fn(async () => {}) },
      clients: { matchAll: async () => opts.clients ?? [] }, location: { origin: 'https://x' },
      caches: c.api, navigator: opts.supported === false ? {} : { setAppBadge },
    };
    new Function('self', swSrc)(self);
    let done: Promise<any> = Promise.resolve();
    handlers.push({ data: { json: () => ({ title: 'T', body: 'b' }) }, waitUntil: (p: any) => { done = Promise.resolve(p); } });
    return { done: () => done, setAppBadge, store: c.store, show: self.registration.showNotification };
  }

  it('ứng dụng đóng: số cũ + 1, ghi nhớ và đặt huy hiệu; thông báo vẫn hiện', async () => {
    const r = runPush({ cache: new Map([[BADGE_KEY, '4']]) }); await r.done();
    expect(r.show).toHaveBeenCalled();
    expect(r.setAppBadge).toHaveBeenCalledWith(5);
    expect(r.store.get(BADGE_KEY)).toBe('5');
  });
  it('chưa có số nào → bắt đầu từ 1', async () => {
    const r = runPush({}); await r.done();
    expect(r.setAppBadge).toHaveBeenCalledWith(1);
  });
  it('đang mở và nhìn thấy ứng dụng → bỏ qua (ứng dụng tự đặt số chính xác)', async () => {
    const r = runPush({ clients: [{ visibilityState: 'visible' }] }); await r.done();
    expect(r.setAppBadge).not.toHaveBeenCalled(); expect(r.show).toHaveBeenCalled();
  });
  it('ứng dụng mở nhưng đang ẩn (tab nền) → vẫn cộng', async () => {
    const r = runPush({ clients: [{ visibilityState: 'hidden' }] }); await r.done();
    expect(r.setAppBadge).toHaveBeenCalledWith(1);
  });
  it('trình duyệt không hỗ trợ huy hiệu → bỏ qua, thông báo vẫn hiện', async () => {
    const r = runPush({ supported: false }); await r.done();
    expect(r.show).toHaveBeenCalled(); expect(r.store.size).toBe(0);
  });
  it('cùng tên bộ nhớ với ứng dụng', () => {
    expect(swSrc).toContain(`'${BADGE_CACHE}'`); expect(swSrc).toContain(`'${BADGE_KEY}'`);
  });
});

describe('điểm nối', () => {
  it('sw.js không dọn bộ nhớ của huy hiệu khi kích hoạt', () => {
    expect(fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8')).toMatch(/key !== 'hl-badge-v1'/);
  });
  it('App đặt huy hiệu bằng đúng số ở menu Tin nhắn (và 0 khi tắt hiển thị badge)', () => {
    const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
    expect(app).toMatch(/useAppBadge\(showBadgeCounts \? chatUnreadForNav : 0\)/);
    expect(app.match(/const chatUnreadForNav =/g)?.length).toBe(1);   // chỉ một nơi định nghĩa, dùng chung cho menu, chuông và biểu tượng
  });
});
