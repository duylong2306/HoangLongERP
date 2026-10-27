// Báo "có bản mới": so mã bản, hỏi /version.json, thanh Cập nhật, và các điểm nối (vite, service worker, App).
import { describe, it, expect, vi } from 'vitest';
import { renderHook, render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { isUpdateAvailable, fetchLatestBuild, useAppUpdate } from '../appUpdate';
import UpdateBanner from '../../components/UpdateBanner';

const ok = (body: any) => vi.fn(async () => ({ ok: true, json: async () => body })) as any;

describe('isUpdateAvailable', () => {
  it('khác mã → có bản mới', () => { expect(isUpdateAvailable('abc1234', 'def5678')).toBe(true); });
  it('cùng mã → không', () => { expect(isUpdateAvailable('abc1234', 'abc1234')).toBe(false); });
  it('máy phát triển (dev) hoặc thiếu mã → không bao giờ báo', () => {
    expect(isUpdateAvailable('dev', 'def5678')).toBe(false);
    expect(isUpdateAvailable('abc1234', null)).toBe(false);
    expect(isUpdateAvailable('abc1234', '')).toBe(false);
    expect(isUpdateAvailable('', 'def5678')).toBe(false);
  });
});

describe('fetchLatestBuild', () => {
  it('đọc mã commit; luôn hỏi mạng (không cache)', async () => {
    const f = ok({ commit: 'def5678' });
    expect(await fetchLatestBuild(f)).toBe('def5678');
    expect(f.mock.calls[0][0]).toMatch(/^\/version\.json\?t=\d+$/);
    expect(f.mock.calls[0][1]).toEqual({ cache: 'no-store' });
  });
  it('lỗi mạng / file chưa có / sai định dạng → null (không báo nhầm)', async () => {
    expect(await fetchLatestBuild(vi.fn(async () => { throw new Error('mạng'); }) as any)).toBeNull();
    expect(await fetchLatestBuild(vi.fn(async () => ({ ok: false })) as any)).toBeNull();
    expect(await fetchLatestBuild(ok({ x: 1 }))).toBeNull();
  });
});

describe('useAppUpdate', () => {
  it('máy chủ có bản khác → updateAvailable', async () => {
    const { result } = renderHook(() => useAppUpdate('abc1234', ok({ commit: 'def5678' })));
    await waitFor(() => expect(result.current.updateAvailable).toBe(true));
  });
  it('cùng bản → không báo', async () => {
    const f = ok({ commit: 'abc1234' });
    const { result } = renderHook(() => useAppUpdate('abc1234', f));
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(result.current.updateAvailable).toBe(false);
  });
  it('chạy dev → không hỏi máy chủ', () => {
    const f = ok({ commit: 'zzz' });
    renderHook(() => useAppUpdate('dev', f));
    expect(f).not.toHaveBeenCalled();
  });
  it('quay lại cửa sổ (focus) thì hỏi lại', async () => {
    const f = ok({ commit: 'abc1234' });
    renderHook(() => useAppUpdate('abc1234', f));
    await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    act(() => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(f).toHaveBeenCalledTimes(2));
  });
});

describe('UpdateBanner', () => {
  it('không hiện khi chưa có bản mới (trong test mã bản là dev nên không hỏi gì)', () => {
    render(<UpdateBanner />);
    expect(screen.queryByTestId('update-banner')).toBeNull();
  });
});

describe('điểm nối', () => {
  const root = path.resolve(__dirname, '../../..');
  const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
  it('vite ghi version.json cùng mã commit đã bơm vào ứng dụng', () => {
    const v = read('vite.config.ts');
    expect(v).toMatch(/fileName: 'version\.json'/);
    expect(v).toMatch(/commit: getBuildCommit\(\)/);
  });
  it('service worker không can thiệp /version.json (luôn đi thẳng mạng)', () => {
    expect(read('public/sw.js')).toMatch(/url\.pathname === '\/version\.json'\) return;/);
  });
  it('App gắn thanh báo bản mới trong giao diện chính', () => {
    const a = read('src/App.tsx');
    expect(a).toMatch(/import UpdateBanner from '\.\/components\/UpdateBanner'/);
    expect(a).toMatch(/<UpdateBanner \/>/);
  });
  it('bấm Cập nhật → tải lại trang', () => {
    const src = read('src/components/UpdateBanner.tsx');
    expect(src).toMatch(/onClick=\{reload\}/);
    expect(read('src/lib/appUpdate.ts')).toMatch(/window\.location\.reload\(\)/);
  });
});
