import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Màn quản trị doanh nghiệp (Giai đoạn 4): mỗi công ty phải hiện ĐỊA CHỈ RIÊNG <mã>.<tên-miền> (mở/sao chép được).
vi.mock('../../lib/supabase', () => ({ getCurrentAccessToken: () => 'tok' }));
import CompanyManagement from '../CompanyManagement';

const congTy = [
  { id: '1', slug: 'hoanglong', name: 'Hoàng Long', active: true, created_at: '2026-01-01T00:00:00Z' },
  { id: '2', slug: 'dai-phat', name: 'Đại Phát', active: false, created_at: '2026-02-01T00:00:00Z' },
];
const fetchGoc = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ companies: congTy }) })) as any;
});
afterEach(() => { vi.unstubAllEnvs(); globalThis.fetch = fetchGoc; });

describe('CompanyManagement — địa chỉ riêng của từng doanh nghiệp', () => {
  it('đã cấu hình VITE_BASE_DOMAIN: hiện liên kết <mã>.<tên-miền> trỏ đúng địa chỉ, mở tab mới', async () => {
    vi.stubEnv('VITE_BASE_DOMAIN', 'lolo.io.vn');
    render(<CompanyManagement />);
    const a = await screen.findByText('hoanglong.lolo.io.vn');
    expect(a.closest('a')?.getAttribute('href')).toBe('https://hoanglong.lolo.io.vn');
    expect(a.closest('a')?.getAttribute('target')).toBe('_blank');
    expect(a.closest('a')?.getAttribute('rel')).toContain('noopener');
    expect(screen.getByText('dai-phat.lolo.io.vn')).toBeTruthy();
    expect(screen.getByText('Ngừng hoạt động')).toBeTruthy();   // công ty ngừng vẫn hiện địa chỉ + trạng thái
  });

  it('chưa cấu hình tên miền gốc: báo rõ thay vì hiện địa chỉ sai', async () => {
    vi.stubEnv('VITE_BASE_DOMAIN', '');
    render(<CompanyManagement />);
    await waitFor(() => expect(screen.getAllByText('Chưa cấu hình tên miền').length).toBe(2));
    expect(screen.queryByText(/lolo\.io\.vn/)).toBeNull();
  });
});
