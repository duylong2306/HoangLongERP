import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, cleanup, fireEvent } from '@testing-library/react';
import jwt from 'jsonwebtoken';
import { FakeDb } from '../../lib/__tests__/helpers/fakeSupabase';

// TEST TÍCH HỢP phía DOANH NGHIỆP của gói dịch vụ: trang gia hạn (token khóa), thanh hạn dùng trong ERP, bảng gói/đặt mua.
// Giao diện thật ↔ api/subscription.ts thật ↔ CSDL giả.
const db = new FakeDb();
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db.client() }));
import subscriptionHandler from '../../../api/subscription';
import RenewalPage from '../subscription/RenewalPage';
import SubscriptionBanner from '../subscription/SubscriptionBanner';

const SECRET = 'jwt-secret-thu';
const DAY = 86400000;
const fetchGoc = globalThis.fetch;
const goc = { ...process.env };

function installFetch() {
  globalThis.fetch = vi.fn(async (url: any, init: any) => {
    // Máy chủ (api/subscription) gọi Telegram qua cùng fetch → ghi lại thay vì ra mạng thật
    if (String(url).startsWith('https://api.telegram.org/')) { tinTelegram.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({}) } as any; }
    expect(String(url)).toBe('/api/subscription');
    const r: any = { code: 200, body: null, setHeader() { return r; }, status(c: number) { r.code = c; return r; }, json(b: any) { r.body = b; return r; } };
    await subscriptionHandler({ method: init.method, body: JSON.parse(init.body), headers: { host: 'abc.lolo.io.vn', ...Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v])) } } as any, r);
    return { ok: r.code >= 200 && r.code < 300, status: r.code, json: async () => r.body } as any;
  }) as any;
}
const luuToken = (claims: any) => sessionStorage.setItem('hl_erp_jwt', jwt.sign(claims, SECRET, { expiresIn: '1h' }));
const tokenKhoa = (sub = 'emp_admin') => luuToken({ sub, role: 'anon', locked_company_id: 'c1' });
const tokenThuong = (sub = 'emp_admin') => luuToken({ sub, role: 'authenticated', company_id: 'c1' });
const reload = vi.fn();
let tinTelegram: any[] = [];

beforeEach(() => {
  sessionStorage.clear(); localStorage.clear(); reload.mockClear(); tinTelegram = [];
  process.env.TELEGRAM_BOT_TOKEN = 'bot-thu'; process.env.TELEGRAM_CHAT_ID = '42';
  db.tables = {}; db.fail = {}; db.log = [];
  db.unique = { subscription_orders: ['code'] }; db.autoId = new Set(['subscription_orders']);
  db.seed('plans', [
    { id: 'co-ban', name: 'Cơ bản', description: 'Cho doanh nghiệp nhỏ', price_monthly: 300000, price_yearly: 3000000, max_employees: 10, active: true, sort_order: 1, badge: '', features: [{ text: 'Quản lý dự án', included: true }, { text: 'Báo cáo nâng cao', included: false }] },
    { id: 'pro', name: 'Chuyên nghiệp', description: '', price_monthly: 700000, price_yearly: 7000000, max_employees: null, active: true, sort_order: 2, badge: 'Phổ biến nhất', features: [] },
  ]);
  db.seed('platform_settings', [{ key: 'bank', value: { bankName: 'Vietcombank', bankBin: '970436', accountNumber: '0123456789', accountName: 'CONG TY LOLO', note: 'Ghi đúng mã.' } }]);
  db.seed('companies', [{ id: 'c1', slug: 'abc', name: 'Công ty ABC', active: true, plan_id: null, expires_at: new Date(Date.now() - 2 * DAY).toISOString(), is_trial: true }]);
  db.seed('employees', [
    { id: 'emp_admin', company_id: 'c1', name: 'Admin', username: 'admin', role_group_ids: ['role_admin'] },
    { id: 'nv1', company_id: 'c1', name: 'NV', username: 'nv', role_group_ids: ['role_office'] },
  ]);
  process.env.VITE_SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'srv'; process.env.SUPABASE_JWT_SECRET = SECRET;
  installFetch();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); process.env = { ...goc }; globalThis.fetch = fetchGoc; });

describe('trang gia hạn (doanh nghiệp hết hạn, token khóa)', () => {
  it('hiện thông báo hết hạn dùng thử, ngày hết hạn, các gói; đổi Tháng/Năm đổi giá', async () => {
    tokenKhoa();
    render(<RenewalPage />);
    expect(await screen.findByText('Thời gian dùng thử đã kết thúc')).toBeTruthy();
    expect(screen.getByText(/Dữ liệu của doanh nghiệp được giữ nguyên/)).toBeTruthy();
    expect(await screen.findByText('Công ty ABC', { selector: 'header span' })).toBeTruthy();
    const panel = document.getElementById('subscription_panel')!;
    expect(within(panel).getByText('Đã hết hạn', { selector: 'span' })).toBeTruthy();
    expect(within(panel).getByText('Cơ bản')).toBeTruthy();
    expect(within(panel).getByText('300.000 đ')).toBeTruthy();
    expect(within(panel).getByText('Tối đa 10 nhân viên')).toBeTruthy();
    expect(within(panel).getByText('Không giới hạn số nhân viên')).toBeTruthy();
    expect(within(panel).getByText('Quản lý dự án').textContent).toContain('(có)');            // mô tả được nhận
    expect(within(panel).getByText('Báo cáo nâng cao').textContent).toContain('(không có)');   // không được nhận
    expect(within(panel).getByText('Phổ biến nhất')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('tab', { name: 'Theo năm' }));
    expect(within(panel).getByText('3.000.000 đ')).toBeTruthy();
    expect(within(panel).getByText(/≈ 250\.000 đ \/ tháng/)).toBeTruthy();
  });

  it('gói đã hết hạn (không phải dùng thử) → tiêu đề "Gói dịch vụ đã hết hạn"', async () => {
    db.table('companies')[0].is_trial = false; db.table('companies')[0].plan_id = 'co-ban';
    tokenKhoa();
    render(<RenewalPage />);
    expect(await screen.findByText('Gói dịch vụ đã hết hạn')).toBeTruthy();
  });

  it('chọn gói theo NĂM → tạo đơn đúng số tiền, mở trang thanh toán QR, xác nhận chuyển khoản gửi Telegram; chọn lại không tạo đơn trùng', async () => {
    tokenKhoa();
    render(<RenewalPage />);
    const panel = await waitFor(() => { const p = document.getElementById('subscription_panel'); if (!p) throw new Error('chưa có'); return p; });
    fireEvent.click(within(panel).getByRole('tab', { name: 'Theo năm' }));
    const theCoBan = within(panel).getByText('Cơ bản').closest('div.flex-col') as HTMLElement;
    fireEvent.click(within(theCoBan).getByRole('button', { name: /Chọn gói này/ }));

    // Bấm mua → mở TRANG THANH TOÁN (mã QR + thông tin chuyển khoản + nút xác nhận)
    const tt = await waitFor(() => { const d = document.getElementById('checkout_modal'); if (!d) throw new Error('chưa mở trang thanh toán'); return d; });
    expect(within(tt).getByText('Thanh toán gói Cơ bản')).toBeTruthy();
    expect(within(tt).getAllByText('3.000.000 đ').length).toBeGreaterThan(0);
    const ma = within(tt).getAllByText(/^LOLO[A-HJ-NP-Z2-9]{8}$/)[0].textContent!;
    expect(within(tt).getByText('Vietcombank')).toBeTruthy();
    expect(within(tt).getByText('0123456789')).toBeTruthy();
    expect(within(tt).getByText('CONG TY LOLO')).toBeTruthy();
    expect(await within(tt).findByAltText(/Mã QR chuyển khoản/)).toBeTruthy();      // QR đã vẽ (có ngân hàng + BIN)
    expect(db.table('subscription_orders')).toHaveLength(1);
    expect(db.table('subscription_orders')[0]).toMatchObject({ company_id: 'c1', plan_id: 'co-ban', period: 'year', months: 12, amount: 3000000, status: 'pending', code: ma });

    // Bấm "Xác nhận chuyển khoản thành công" → đơn được đánh dấu + Telegram báo quản trị; gói CHƯA kích hoạt
    fireEvent.click(within(tt).getByRole('button', { name: 'Xác nhận chuyển khoản thành công' }));
    expect(await within(tt).findByText('Đã gửi yêu cầu xác nhận chuyển khoản')).toBeTruthy();
    expect(db.table('subscription_orders')[0].paid_claimed_at).toBeTruthy();
    expect(db.table('subscription_orders')[0].status).toBe('pending');
    expect(tinTelegram).toHaveLength(1);
    expect(tinTelegram[0].text).toContain(ma);
    expect(within(tt).queryByRole('button', { name: 'Xác nhận chuyển khoản thành công' })).toBeNull();   // không bấm lại được
    fireEvent.click(within(tt).getByText('Đóng', { selector: 'button' }));
    expect(document.getElementById('checkout_modal')).toBeNull();
    // Đơn vẫn hiện ở danh sách chờ, kèm nhãn đã báo chuyển khoản
    expect(await within(document.getElementById('pending_orders')!).findByText(/Đã báo chuyển khoản/)).toBeTruthy();

    fireEvent.click(within(theCoBan).getByRole('button', { name: /Chọn gói này/ }));
    await waitFor(() => expect(db.log.filter(l => l === 'insert:subscription_orders').length).toBe(1));   // không tạo thêm
    expect(db.table('subscription_orders')).toHaveLength(1);
  });

  it('hủy đơn đang chờ', async () => {
    tokenKhoa();
    db.seed('subscription_orders', [{ id: 'o1', code: 'LOLOAAAA2222', company_id: 'c1', plan_id: 'co-ban', period: 'month', months: 1, amount: 300000, status: 'pending', created_at: new Date().toISOString() }]);
    render(<RenewalPage />);
    const don = await waitFor(() => { const d = document.getElementById('pending_orders'); if (!d) throw new Error('chưa có'); return d; });
    // Hộp thoại gốc bị chặn (như trình duyệt nhúng): nút Hủy đơn vẫn phải hoạt động qua hộp thoại trong trang
    (window.confirm as any).mockReturnValue(false);
    fireEvent.click(within(don).getByRole('button', { name: /Hủy đơn/ }));
    const hop = await screen.findByRole('alertdialog');
    // "Giữ đơn" không hủy
    fireEvent.click(within(hop).getByRole('button', { name: 'Giữ đơn' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(db.table('subscription_orders')[0].status).toBe('pending');
    fireEvent.click(within(don).getByRole('button', { name: /Hủy đơn/ }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Xác nhận hủy đơn' }));
    await waitFor(() => expect(db.table('subscription_orders')[0].status).toBe('cancelled'));
    await waitFor(() => expect(document.getElementById('pending_orders')).toBeNull());
  });

  it('hủy đơn ngay trong trang thanh toán: hộp xác nhận hiện trên trang thanh toán, hủy xong đóng cả hai', async () => {
    tokenKhoa();
    render(<RenewalPage />);
    const panel = await waitFor(() => { const p = document.getElementById('subscription_panel'); if (!p) throw new Error('chưa có'); return p; });
    const the = within(panel).getByText('Cơ bản').closest('div.flex-col') as HTMLElement;
    fireEvent.click(within(the).getByRole('button', { name: /Chọn gói này/ }));
    const tt = await waitFor(() => { const d = document.getElementById('checkout_modal'); if (!d) throw new Error('chưa mở'); return d; });
    fireEvent.click(within(tt).getByRole('button', { name: /Hủy đơn này/ }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Xác nhận hủy đơn' }));
    await waitFor(() => expect(db.table('subscription_orders')[0].status).toBe('cancelled'));
    await waitFor(() => expect(document.getElementById('checkout_modal')).toBeNull());
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('hủy đơn lỗi (đơn đã được xử lý) → báo lỗi ngay trong hộp thoại, không im lặng', async () => {
    tokenKhoa();
    db.seed('subscription_orders', [{ id: 'o1', code: 'LOLOAAAA2222', company_id: 'c1', plan_id: 'co-ban', period: 'month', months: 1, amount: 300000, status: 'pending', created_at: new Date().toISOString() }]);
    render(<RenewalPage />);
    const don = await waitFor(() => { const d = document.getElementById('pending_orders'); if (!d) throw new Error('chưa có'); return d; });
    fireEvent.click(within(don).getByRole('button', { name: /Hủy đơn/ }));
    const hop = await screen.findByRole('alertdialog');
    db.table('subscription_orders')[0].status = 'confirmed';   // quản trị vừa xác nhận xong
    fireEvent.click(within(hop).getByRole('button', { name: 'Xác nhận hủy đơn' }));
    expect(await within(hop).findByRole('alert')).toHaveTextContent(/Không tìm thấy đơn đang chờ/);
  });

  it('nhân viên thường (không phải admin): thấy tình trạng hạn dùng nhưng KHÔNG đặt mua được và KHÔNG thấy tài khoản ngân hàng', async () => {
    tokenKhoa('nv1');
    db.seed('subscription_orders', [{ id: 'o1', code: 'LOLOAAAA2222', company_id: 'c1', plan_id: 'co-ban', period: 'month', months: 1, amount: 300000, status: 'pending', created_at: new Date().toISOString() }]);
    render(<RenewalPage />);
    expect(await screen.findByText(/mới đặt mua\/gia hạn được/)).toBeTruthy();   // (chữ "quản trị viên của doanh nghiệp" nằm trong thẻ <b> riêng)
    const panel = document.getElementById('subscription_panel')!;
    within(panel).getAllByRole('button', { name: /Chọn gói này/ }).forEach(b => expect(b).toBeDisabled());
    expect(document.getElementById('pending_orders')).toBeNull();
    expect(screen.queryByText('0123456789')).toBeNull();
  });

  it('quản trị nền tảng đã kích hoạt → "kiểm tra lại" hiện thông báo đã kích hoạt; "Đăng nhập lại" xóa token và tải lại trang', async () => {
    tokenKhoa();
    render(<RenewalPage />);
    await screen.findByText('Thời gian dùng thử đã kết thúc');
    db.table('companies')[0].expires_at = new Date(Date.now() + 30 * DAY).toISOString();     // admin nền tảng vừa xác nhận đơn
    db.table('companies')[0].is_trial = false;
    fireEvent.click(screen.getByRole('button', { name: /Tôi đã thanh toán — kiểm tra lại/ }));
    expect(await screen.findByText('Gói của doanh nghiệp đã được kích hoạt!')).toBeTruthy();
    expect(screen.queryByText('Thời gian dùng thử đã kết thúc')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập lại' }));
    expect(sessionStorage.getItem('hl_erp_jwt')).toBeNull();
    expect(reload).toHaveBeenCalled();
  });

  it('đăng xuất → xóa phiên, tải lại', async () => {
    tokenKhoa(); sessionStorage.setItem('hl_erp_active_session', '{"id":"emp_admin"}');
    render(<RenewalPage />);
    await screen.findByText('Thời gian dùng thử đã kết thúc');
    fireEvent.click(screen.getByRole('button', { name: /Đăng xuất/ }));
    expect(sessionStorage.getItem('hl_erp_jwt')).toBeNull();
    expect(sessionStorage.getItem('hl_erp_active_session')).toBeNull();
    expect(reload).toHaveBeenCalled();
  });
});

describe('thanh hạn dùng trong ERP', () => {
  beforeEach(() => tokenThuong());

  it('đang dùng thử còn 3 ngày → thanh vàng có ngày hết hạn và nút mua/gia hạn; bấm mở bảng gói', async () => {
    db.table('companies')[0].expires_at = new Date(Date.now() + 3 * DAY).toISOString();
    render(<SubscriptionBanner />);
    const thanh = await waitFor(() => { const b = document.getElementById('subscription_banner'); if (!b) throw new Error('chưa có'); return b; });
    expect(thanh).toHaveTextContent(/Đang dùng thử — còn 3 ngày/);
    expect(thanh).toHaveTextContent(new Date(db.table('companies')[0].expires_at).toLocaleDateString('vi-VN'));
    expect(thanh.className).toContain('bg-amber-50');
    fireEvent.click(within(thanh).getByRole('button', { name: /Mua \/ gia hạn gói/ }));
    const hop = await screen.findByRole('dialog', { name: 'Gói dịch vụ' });
    expect(await within(hop).findByText('Cơ bản')).toBeTruthy();
    expect(within(hop).getByText('Đang dùng thử', { selector: 'span' })).toBeTruthy();
  });

  it('gói trả phí còn nhiều ngày → 1 dòng nhỏ (không cảnh báo) hiện tên gói và ngày hết hạn', async () => {
    Object.assign(db.table('companies')[0], { plan_id: 'co-ban', is_trial: false, expires_at: new Date(Date.now() + 200 * DAY).toISOString() });
    render(<SubscriptionBanner />);
    const thanh = await waitFor(() => { const b = document.getElementById('subscription_banner'); if (!b) throw new Error('chưa có'); return b; });
    expect(thanh).toHaveTextContent(/Gói Cơ bản — hết hạn/);
    expect(thanh).toHaveTextContent(/còn 200 ngày/);
    expect(thanh.className).not.toContain('bg-amber-50');
    expect(within(thanh).getByRole('button', { name: 'Gói dịch vụ' })).toBeTruthy();
  });

  it('gói trả phí sắp hết (≤ 14 ngày) → chuyển sang cảnh báo vàng', async () => {
    Object.assign(db.table('companies')[0], { plan_id: 'co-ban', is_trial: false, expires_at: new Date(Date.now() + 10 * DAY).toISOString() });
    render(<SubscriptionBanner />);
    const thanh = await waitFor(() => { const b = document.getElementById('subscription_banner'); if (!b) throw new Error('chưa có'); return b; });
    expect(thanh.className).toContain('bg-amber-50');
    expect(within(thanh).getByRole('button', { name: /Mua \/ gia hạn gói/ })).toBeTruthy();
  });

  it('doanh nghiệp KHÔNG GIỚI HẠN (như Hoàng Long) → không hiện thanh nào', async () => {
    db.table('companies')[0].expires_at = null; db.table('companies')[0].is_trial = false;
    render(<SubscriptionBanner />);
    await waitFor(() => expect(db.log).toContain('select:companies'));
    await new Promise(r => setTimeout(r, 50));
    expect(document.getElementById('subscription_banner')).toBeNull();
  });

  it('có đơn chờ xác nhận → thanh ghi số đơn chờ', async () => {
    db.table('companies')[0].expires_at = new Date(Date.now() + 3 * DAY).toISOString();
    db.seed('subscription_orders', [{ id: 'o1', code: 'LOLOAAAA2222', company_id: 'c1', plan_id: 'co-ban', period: 'month', months: 1, amount: 1, status: 'pending', created_at: new Date().toISOString() }]);
    render(<SubscriptionBanner />);
    const thanh = await waitFor(() => { const b = document.getElementById('subscription_banner'); if (!b) throw new Error('chưa có'); return b; });
    expect(thanh).toHaveTextContent('Có 1 đơn chờ xác nhận');
  });

  it('công ty bị KHÓA lúc đang dùng → phủ kín màn hình thông báo, đăng xuất xóa phiên', async () => {
    db.table('companies')[0].expires_at = new Date(Date.now() + 3 * DAY).toISOString();
    render(<SubscriptionBanner />);
    await waitFor(() => expect(document.getElementById('subscription_banner')).toBeTruthy());   // đang dùng bình thường
    expect(document.getElementById('subscription_blocked')).toBeNull();
    db.table('companies')[0].active = false;                       // quản trị nền tảng bấm Khóa
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));         // người dùng quay lại tab → kiểm tra ngay (không chờ 60 giây)
    const hop = await screen.findByRole('alertdialog');
    expect(hop).toHaveTextContent('Doanh nghiệp đã bị khóa');
    expect(document.getElementById('subscription_banner')).toBeNull();
    fireEvent.click(within(hop).getByRole('button', { name: /Đăng xuất/ }));
    expect(sessionStorage.getItem('hl_erp_jwt')).toBeNull();
    expect(reload).toHaveBeenCalled();
  });

  it('gói hết hạn lúc đang dùng → chặn, nút dẫn tới đăng nhập lại để gia hạn', async () => {
    db.table('companies')[0].expires_at = new Date(Date.now() + 3 * DAY).toISOString();
    render(<SubscriptionBanner />);
    await waitFor(() => expect(document.getElementById('subscription_banner')).toBeTruthy());
    db.table('companies')[0].expires_at = new Date(Date.now() - 1000).toISOString();
    document.dispatchEvent(new Event('visibilitychange'));
    const hop = await screen.findByRole('alertdialog');
    expect(hop).toHaveTextContent('Gói dịch vụ đã hết hạn');
    expect(within(hop).getByRole('button', { name: /Đăng nhập lại để gia hạn/ })).toBeTruthy();
  });

  it('lỗi máy chủ / token sai → ẩn im lặng, không làm phiền người dùng ERP', async () => {
    sessionStorage.setItem('hl_erp_jwt', 'rac.rac.rac');
    render(<SubscriptionBanner />);
    await new Promise(r => setTimeout(r, 80));
    expect(document.getElementById('subscription_banner')).toBeNull();
  });
});
