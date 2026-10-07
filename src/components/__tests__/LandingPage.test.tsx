import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, cleanup, fireEvent } from '@testing-library/react';
import LandingPage from '../landing/LandingPage';

// Trang giới thiệu + đăng ký: bảng giá lấy từ cấu hình ở trang quản trị, số ngày dùng thử, thông báo hết hạn dùng thử sau khi đăng ký.
const fetchGoc = globalThis.fetch;
let plansBody: any;
let registerBody: any;

beforeEach(() => {
  vi.stubEnv('VITE_BASE_DOMAIN', 'lolo.io.vn');
  plansBody = { plans: [], trialDays: 7 };
  registerBody = null;
  globalThis.fetch = vi.fn(async (url: any, init: any) => {
    const u = String(url);
    const json = (status: number, body: any) => ({ ok: status < 300, status, json: async () => body }) as any;
    if (u === '/api/subscription') return json(200, plansBody);
    if (u.startsWith('/api/check-slug')) return json(200, { available: true });
    if (u === '/api/register-company') { registerBody = JSON.parse(init.body); return json(201, { company: { slug: registerBody.slug, name: registerBody.companyName }, adminUsername: 'admin', trial: { days: 14, endsAt: '2026-10-21T16:59:59.000Z' } }); }
    return json(404, {});
  }) as any;
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); globalThis.fetch = fetchGoc; });

describe('trang giới thiệu', () => {
  it('chưa có gói nào được mở bán → không hiện bảng giá; hiện số ngày dùng thử mặc định', async () => {
    render(<LandingPage />);
    expect(await screen.findByText(/Dùng thử 7 ngày/)).toBeTruthy();
    expect(document.getElementById('bang-gia')).toBeNull();
  });

  it('có gói → hiện bảng giá (giá tháng/năm, tiết kiệm khi mua năm, giới hạn nhân viên) và số ngày dùng thử theo cấu hình', async () => {
    plansBody = { trialDays: 14, plans: [
      { id: 'co-ban', name: 'Cơ bản', description: 'Cho doanh nghiệp nhỏ', priceMonthly: 300000, priceYearly: 3000000, maxEmployees: 10 },
      { id: 'pro', name: 'Chuyên nghiệp', description: '', priceMonthly: 700000, priceYearly: 0, maxEmployees: null },
    ] };
    render(<LandingPage />);
    const bang = await waitFor(() => { const b = document.getElementById('bang-gia'); if (!b) throw new Error('chưa có'); return b; });
    expect(within(bang).getByText('Cơ bản')).toBeTruthy();
    expect(within(bang).getByText('300.000 đ')).toBeTruthy();
    expect(within(bang).getByText('3.000.000 đ')).toBeTruthy();
    expect(within(bang).getByText(/tiết kiệm 600\.000 đ/)).toBeTruthy();       // 300k×12 − 3tr
    expect(within(bang).getByText('Tối đa 10 nhân viên')).toBeTruthy();
    expect(within(bang).getByText('Không giới hạn nhân viên')).toBeTruthy();
    expect(within(bang).getByText('Chuyên nghiệp')).toBeTruthy();
    expect(screen.getAllByText(/14 ngày/).length).toBeGreaterThan(0);
  });

  it('đăng ký thành công → hiện địa chỉ riêng và NGÀY HẾT HẠN dùng thử', async () => {
    render(<LandingPage />);
    const form = await waitFor(() => { const f = document.getElementById('register_form'); if (!f) throw new Error('chưa có'); return f; });
    fireEvent.change(within(form).getByLabelText(/Tên doanh nghiệp/), { target: { value: 'Công ty TNHH Đại Phát' } });
    fireEvent.change(within(form).getByLabelText(/Họ tên người quản trị/), { target: { value: 'Nguyễn Văn A' } });
    fireEvent.change(within(form).getByLabelText(/Số điện thoại/), { target: { value: '0912345678' } });
    fireEvent.change(within(form).getByLabelText(/^Email/), { target: { value: 'a@dai-phat.vn' } });
    fireEvent.change(within(form).getByLabelText(/Mật khẩu quản trị/), { target: { value: 'matkhau123' } });
    fireEvent.click(within(form).getByRole('button', { name: /Đăng ký doanh nghiệp/ }));
    await screen.findByText('Đăng ký thành công!');
    expect(registerBody).toMatchObject({ slug: 'cong-ty-tnhh-dai-phat', companyName: 'Công ty TNHH Đại Phát', phone: '0912345678' });
    expect(screen.getByText(/cong-ty-tnhh-dai-phat\.lolo\.io\.vn/)).toBeTruthy();
    const ghiChu = document.getElementById('register_trial_note')!;
    expect(ghiChu).toHaveTextContent('dùng thử miễn phí');
    expect(ghiChu).toHaveTextContent(new Date('2026-10-21T16:59:59.000Z').toLocaleDateString('vi-VN'));
  });
});
