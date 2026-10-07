import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, cleanup, fireEvent } from '@testing-library/react';
import bcrypt from 'bcryptjs';
import { FakeDb } from '../../lib/__tests__/helpers/fakeSupabase';

// TEST TÍCH HỢP trang quản trị nền tảng: giao diện thật (PlatformConsole) gọi thẳng vào api/platform.ts thật,
// phía dưới là CSDL giả trong bộ nhớ → kiểm tra từ thao tác bấm nút đến kết quả trong dữ liệu.

// Dự án không cài @testing-library/user-event → mô phỏng gọn các thao tác cần dùng bằng fireEvent (ô nhập kiểu "controlled" của React
// nhận giá trị mới qua sự kiện change).
const userEvent = {
  setup: () => ({
    type: async (el: Element, text: string) => { fireEvent.change(el, { target: { value: (el as HTMLInputElement).value + text } }); },
    clear: async (el: Element) => { fireEvent.change(el, { target: { value: '' } }); },
    click: async (el: Element) => { fireEvent.click(el); },
    selectOptions: async (el: Element, value: string) => { fireEvent.change(el, { target: { value } }); },
  }),
};

const db = new FakeDb();
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db.client() }));
import platformHandler from '../../../api/platform';
import PlatformConsole from '../platform/PlatformConsole';

const SECRET = 'jwt-secret-thu';
const DAY = 86400000;

// fetch giả: chuyển lời gọi /api/platform sang handler thật
function installFetch() {
  globalThis.fetch = vi.fn(async (url: any, init: any) => {
    expect(String(url)).toBe('/api/platform');
    const r: any = { code: 200, body: null, setHeader() { return r; }, status(c: number) { r.code = c; return r; }, json(b: any) { r.body = b; return r; } };
    await platformHandler({ method: init.method, body: JSON.parse(init.body), headers: { host: 'www.lolo.io.vn', 'x-forwarded-for': '1.1.1.1', ...Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v])) } } as any, r);   // Node luôn hạ chữ thường tên header
    return { ok: r.code >= 200 && r.code < 300, status: r.code, json: async () => r.body } as any;
  }) as any;
}
const fetchGoc = globalThis.fetch;
const goc = { ...process.env };

beforeEach(async () => {
  sessionStorage.clear();
  db.tables = {}; db.fail = {}; db.log = []; db.rpcs = {}; db.missingColumns = {};
  db.unique = { companies: ['slug'], subscription_orders: ['code'], platform_admins: ['username'] };
  db.autoId = new Set(['platform_login_attempts', 'subscription_orders', 'platform_audit_logs', 'platform_admins']);
  db.seed('platform_admins', [{ id: 'ad-1', username: 'chu', password_hash: await bcrypt.hash('MatKhauTot123', 4), name: 'Chủ nền tảng', active: true, is_owner: true }]);
  db.seed('plans', [
    { id: 'co-ban', name: 'Cơ bản', description: 'Nhỏ', price_monthly: 300000, price_yearly: 3000000, max_employees: 10, active: true, sort_order: 1 },
    { id: 'pro', name: 'Chuyên nghiệp', description: '', price_monthly: 0, price_yearly: 0, max_employees: null, active: false, sort_order: 2 },
  ]);
  db.seed('companies', [
    { id: 'c1', slug: 'hoanglong', name: 'Hoàng Long', active: true, created_at: '2026-01-01', plan_id: null, expires_at: null, is_trial: false },
    { id: 'c2', slug: 'dung-thu', name: 'Công ty Dùng Thử', active: true, created_at: '2026-02-01', plan_id: null, expires_at: new Date(Date.now() + 3 * DAY).toISOString(), is_trial: true },
    { id: 'c3', slug: 'het-han', name: 'Công ty Hết Hạn', active: true, created_at: '2026-03-01', plan_id: 'co-ban', expires_at: new Date(Date.now() - 2 * DAY).toISOString(), is_trial: false },
  ]);
  db.seed('subscription_orders', [{ id: 'o1', code: 'LOLOAAAA2222', company_id: 'c3', plan_id: 'co-ban', period: 'year', months: 12, amount: 3000000, status: 'pending', created_at: '2026-10-05T01:00:00Z', note: '' }]);
  db.rpcs.platform_employee_counts = () => [{ company_id: 'c1', employee_count: 24 }, { company_id: 'c3', employee_count: 10 }];
  process.env.VITE_BASE_DOMAIN = 'lolo.io.vn';
  process.env.VITE_SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'srv';
  process.env.SUPABASE_JWT_SECRET = SECRET;
  installFetch();
  vi.stubEnv('VITE_BASE_DOMAIN', 'lolo.io.vn');
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); process.env = { ...goc }; globalThis.fetch = fetchGoc; });

async function dangNhap(user = 'userEvent') {
  const u = userEvent.setup();
  render(<PlatformConsole />);
  await u.type(await screen.findByLabelText(/Tên đăng nhập/i), 'chu');
  await u.type(screen.getByLabelText(/Mật khẩu/i), 'MatKhauTot123');
  await u.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  await screen.findByText('Doanh nghiệp (3)');
  return u;
}

describe('trang quản trị — đăng nhập', () => {
  it('sai mật khẩu → báo lỗi, vẫn ở màn đăng nhập; đúng → vào trang quản trị', async () => {
    const u = userEvent.setup();
    render(<PlatformConsole />);
    await u.type(await screen.findByLabelText(/Tên đăng nhập/i), 'chu');
    await u.type(screen.getByLabelText(/Mật khẩu/i), 'sai-mat-khau');
    await u.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/không đúng/i);
    expect(screen.queryByText('Doanh nghiệp (3)')).toBeNull();
    await u.clear(screen.getByLabelText(/Mật khẩu/i));
    await u.type(screen.getByLabelText(/Mật khẩu/i), 'MatKhauTot123');
    await u.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Doanh nghiệp (3)')).toBeTruthy();
    expect(sessionStorage.getItem('lolo_platform_token')).toBeTruthy();
  });

  it('đã có phiên (token còn hạn) → vào thẳng; đăng xuất → về màn đăng nhập và xóa token', async () => {
    const u = await dangNhap();
    cleanup();
    render(<PlatformConsole />);                                      // mở lại trang: khôi phục phiên từ token
    expect(await screen.findByText('Doanh nghiệp (3)')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: /Đăng xuất/ }));
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
    expect(sessionStorage.getItem('lolo_platform_token')).toBeNull();
  });

  it('token hỏng trong sessionStorage → về màn đăng nhập', async () => {
    sessionStorage.setItem('lolo_platform_token', 'rac.rac.rac');
    render(<PlatformConsole />);
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
    expect(sessionStorage.getItem('lolo_platform_token')).toBeNull();
  });
});

describe('tab Doanh nghiệp', () => {
  it('hiện trạng thái, gói, ngày hết hạn, số nhân viên và địa chỉ riêng của từng doanh nghiệp', async () => {
    await dangNhap();
    const bang = screen.getByRole('table');
    const dong = (ten: string) => within(bang).getByText(ten).closest('tr') as HTMLElement;

    const hl = dong('Hoàng Long');
    expect(within(hl).getByText('Không giới hạn', { selector: 'span.inline-block' })).toBeTruthy();
    expect(within(hl).getByText('24')).toBeTruthy();
    expect(within(hl).getByText('hoanglong.lolo.io.vn').closest('a')).toHaveAttribute('href', 'https://hoanglong.lolo.io.vn');

    const dt = dong('Công ty Dùng Thử');
    expect(within(dt).getByText('Dùng thử', { selector: 'span.inline-block' })).toBeTruthy();
    expect(within(dt).getByText('Còn 3 ngày')).toBeTruthy();

    const hh = dong('Công ty Hết Hạn');
    expect(within(hh).getByText('Hết hạn', { selector: 'span.inline-block' })).toBeTruthy();
    expect(within(hh).getByText('Đã hết hạn')).toBeTruthy();
    expect(within(hh).getByText('Cơ bản')).toBeTruthy();
    expect(within(hh).getByText('10 / 10')).toBeTruthy();             // đã chạm giới hạn nhân viên của gói
  });

  it('lọc theo trạng thái và tìm theo tên', async () => {
    const u = await dangNhap();
    await u.selectOptions(screen.getByLabelText('Lọc theo trạng thái'), 'expired');
    expect(screen.queryByText('Hoàng Long')).toBeNull();
    expect(screen.getByText('Công ty Hết Hạn')).toBeTruthy();
    await u.selectOptions(screen.getByLabelText('Lọc theo trạng thái'), 'all');
    await u.type(screen.getByPlaceholderText(/Tìm theo tên/), 'dung-thu');
    expect(screen.getByText('Công ty Dùng Thử')).toBeTruthy();
    expect(screen.queryByText('Hoàng Long')).toBeNull();
  });

  it('khóa doanh nghiệp: bấm Khóa chỉ hiện CẢNH BÁO trong trang (không khóa ngay); "Hủy bỏ" giữ nguyên; xác nhận mới khóa', async () => {
    const u = await dangNhap();
    const dong = screen.getByText('Công ty Dùng Thử').closest('tr') as HTMLElement;
    await u.click(within(dong).getByRole('button', { name: /Khóa/ }));
    const hop = await screen.findByRole('alertdialog');
    expect(hop).toHaveTextContent('Khóa doanh nghiệp "Công ty Dùng Thử"?');
    expect(hop).toHaveTextContent(/không đăng nhập được/);
    expect(hop).toHaveTextContent(/ngay lập tức/);
    expect(hop).toHaveTextContent(/Dữ liệu của doanh nghiệp được giữ nguyên/);
    expect(db.table('companies').find(c => c.id === 'c2')!.active).toBe(true);   // mới chỉ cảnh báo, chưa khóa
    expect(window.confirm).not.toHaveBeenCalled();                                  // không dựa vào hộp thoại gốc của trình duyệt
    // Hủy bỏ → không khóa
    await u.click(within(hop).getByRole('button', { name: 'Hủy bỏ' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(db.table('companies').find(c => c.id === 'c2')!.active).toBe(true);
    // Xác nhận → khóa
    await u.click(within(dong).getByRole('button', { name: /Khóa/ }));
    await u.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Khóa doanh nghiệp' }));
    await waitFor(() => expect(db.table('companies').find(c => c.id === 'c2')!.active).toBe(false));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(await within(screen.getByText('Công ty Dùng Thử').closest('tr') as HTMLElement).findByText('Đã khóa')).toBeTruthy();   // huy hiệu trong đúng dòng (thông báo phía trên cũng có chữ này)
  });

  it('mở lại doanh nghiệp cũng hỏi xác nhận', async () => {
    db.table('companies').find(c => c.id === 'c2')!.active = false;
    const u = await dangNhap();
    const dong = screen.getByText('Công ty Dùng Thử').closest('tr') as HTMLElement;
    await u.click(within(dong).getByRole('button', { name: /Mở/ }));
    const hop = await screen.findByRole('alertdialog');
    expect(db.table('companies').find(c => c.id === 'c2')!.active).toBe(false);
    await u.click(within(hop).getByRole('button', { name: 'Mở lại' }));
    await waitFor(() => expect(db.table('companies').find(c => c.id === 'c2')!.active).toBe(true));
  });

  it('chỉnh gói và ngày hết hạn thủ công', async () => {
    const u = await dangNhap();
    const dong = screen.getByText('Công ty Dùng Thử').closest('tr') as HTMLElement;
    await u.click(within(dong).getByRole('button', { name: /Gói & hạn/ }));
    const hop = await screen.findByRole('dialog');
    await u.selectOptions(within(hop).getByRole('combobox'), 'co-ban');
    await u.clear(within(hop).getByDisplayValue(/\d{4}-\d{2}-\d{2}/));
    await u.type(within(hop).getByLabelText(/Ngày hết hạn/), '2027-06-30');
    await u.click(within(hop).getByLabelText(/Đang trong thời gian dùng thử/));
    await u.click(within(hop).getByRole('button', { name: /Lưu/ }));
    await waitFor(() => expect(db.table('companies').find(c => c.id === 'c2')).toMatchObject({ plan_id: 'co-ban', is_trial: false }));
    expect(new Date(db.table('companies').find(c => c.id === 'c2')!.expires_at).getFullYear()).toBe(2027);
  });

  it('tạo doanh nghiệp mới (dùng thử) và hiện địa chỉ riêng; tên cấm bị từ chối', async () => {
    const u = await dangNhap();
    await u.click(screen.getByRole('button', { name: /Tạo doanh nghiệp/ }));
    const form = document.getElementById('create_company_form')!;
    await u.type(within(form).getByPlaceholderText('vd: dai-phat'), 'www');
    await u.type(within(form).getAllByRole('textbox')[1], 'Công ty X');
    await u.type(within(form).getAllByRole('textbox')[4], 'abcd1234');
    await u.click(within(form).getByRole('button', { name: /Tạo doanh nghiệp/ }));
    expect(await within(form).findByText(/dành cho hệ thống/)).toBeTruthy();
    await u.clear(within(form).getByPlaceholderText('vd: dai-phat'));
    await u.type(within(form).getByPlaceholderText('vd: dai-phat'), 'cong-ty-x');
    await u.click(within(form).getByRole('button', { name: /Tạo doanh nghiệp/ }));
    expect(await screen.findByText(/cong-ty-x\.lolo\.io\.vn/, { selector: '[role=status] span' })).toBeTruthy();
    const moi = db.table('companies').find(c => c.slug === 'cong-ty-x')!;
    expect(moi.is_trial).toBe(true);
    expect(moi.expires_at).toBeTruthy();
  });
});

describe('tab Gói dịch vụ', () => {
  it('thêm gói mới với giá tháng/năm; hiện giá định dạng VNĐ; gói chưa có giá hiện "Chưa đặt giá"', async () => {
    const u = await dangNhap();
    await u.click(screen.getByRole('button', { name: /Gói dịch vụ/ }));
    const bang = await screen.findByRole('table');
    expect(within(bang).getByText(/300\.000/)).toBeTruthy();
    expect(within(bang).getByText(/3\.000\.000/)).toBeTruthy();
    expect(within(bang).getAllByText('Chưa đặt giá').length).toBe(2);

    await u.click(screen.getByRole('button', { name: /Thêm gói/ }));
    const hop = await screen.findByRole('dialog');
    await u.type(within(hop).getByPlaceholderText('vd: co-ban'), 'vip');
    await u.type(within(hop).getAllByRole('textbox')[1], 'Gói VIP');
    await u.clear(within(hop).getAllByRole('spinbutton')[0]); await u.type(within(hop).getAllByRole('spinbutton')[0], '900000');
    await u.clear(within(hop).getAllByRole('spinbutton')[1]); await u.type(within(hop).getAllByRole('spinbutton')[1], '9000000');
    await u.click(within(hop).getByLabelText(/Đang bán/));
    await u.click(within(hop).getByRole('button', { name: /Lưu gói/ }));
    await waitFor(() => expect(db.table('plans').find(p => p.id === 'vip')).toMatchObject({ name: 'Gói VIP', price_monthly: 900000, price_yearly: 9000000, active: true }));
    expect(await screen.findByText('Gói VIP')).toBeTruthy();
  });
});

describe('tab Đơn đăng ký', () => {
  it('đơn chờ hiện đúng thông tin; XÁC NHẬN → công ty được kích hoạt theo năm, đơn biến khỏi danh sách chờ', async () => {
    const u = await dangNhap();
    await u.click(screen.getByRole('button', { name: /Đơn đăng ký/ }));
    const bang = await screen.findByRole('table');
    expect(within(bang).getByText('LOLOAAAA2222')).toBeTruthy();
    expect(within(bang).getByText('Công ty Hết Hạn')).toBeTruthy();
    expect(within(bang).getByText(/3\.000\.000/)).toBeTruthy();
    expect(within(bang).getByText(/Theo năm/)).toBeTruthy();

    await u.click(within(bang).getByRole('button', { name: /Xác nhận/ }));
    await waitFor(() => expect(db.table('subscription_orders')[0].status).toBe('confirmed'));
    const c = db.table('companies').find(x => x.id === 'c3')!;
    expect(c).toMatchObject({ plan_id: 'co-ban', is_trial: false });
    const ngay = (new Date(c.expires_at).getTime() - Date.now()) / DAY;
    expect(ngay).toBeGreaterThan(364); expect(ngay).toBeLessThan(367);   // đã hết hạn → tính từ hôm nay + 1 năm
    expect(await screen.findByRole('status')).toHaveTextContent(/Đã kích hoạt/);
    expect(await screen.findByText('Không có đơn nào đang chờ xác nhận.')).toBeTruthy();
  });

  it('không xác nhận khi người dùng bấm Hủy ở hộp thoại', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const u = await dangNhap();
    await u.click(screen.getByRole('button', { name: /Đơn đăng ký/ }));
    await u.click(await screen.findByRole('button', { name: /Xác nhận/ }));
    expect(db.table('subscription_orders')[0].status).toBe('pending');
  });

  it('hủy đơn kèm ghi chú', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Khách không chuyển tiền');
    const u = await dangNhap();
    await u.click(screen.getByRole('button', { name: /Đơn đăng ký/ }));
    await u.click(await screen.findByRole('button', { name: /^Hủy$/ }));
    await waitFor(() => expect(db.table('subscription_orders')[0]).toMatchObject({ status: 'cancelled', note: 'Khách không chuyển tiền' }));
  });
});

describe('tab Cấu hình', () => {
  it('lưu số ngày dùng thử + tài khoản ngân hàng', async () => {
    const u = await dangNhap();
    await u.click(screen.getByRole('button', { name: /Cấu hình/ }));
    const form = await waitFor(() => { const f = document.getElementById('settings_form'); if (!f) throw new Error('chưa có'); return f; });
    await u.clear(within(form).getAllByRole('spinbutton')[0]); await u.type(within(form).getAllByRole('spinbutton')[0], '14');
    await u.selectOptions(within(form).getByLabelText('Ngân hàng'), '970436');   // Vietcombank → tự lấy mã BIN
    await u.click(within(form).getByRole('button', { name: /Lưu cấu hình/ }));
    expect(await within(form).findByRole('status')).toHaveTextContent('Đã lưu cấu hình');
    expect(db.table('platform_settings').find(r => r.key === 'trial')!.value).toEqual({ days: 14, maxEmployees: null });
    expect(db.table('platform_settings').find(r => r.key === 'bank')!.value).toMatchObject({ bankName: 'Vietcombank', bankBin: '970436' });

  });
});

describe('tab Tài khoản & Nhật ký', () => {
  it('đổi mật khẩu của tôi, rồi chủ nền tảng tạo + khóa tài khoản mới', async () => {
    const u = await dangNhap();
    await u.click(screen.getByRole('button', { name: /Tài khoản/ }));
    const pwForm = await waitFor(() => { const f = document.getElementById('password_form'); if (!f) throw new Error('chưa có'); return f; });
    const o = within(pwForm).getAllByLabelText(/mật khẩu/i);
    await u.type(o[0], 'MatKhauTot123'); await u.type(o[1], 'MatKhauMoi99999'); await u.type(o[2], 'MatKhauMoi99999');
    await u.click(within(pwForm).getByRole('button', { name: /Đổi mật khẩu/ }));
    expect(await within(pwForm).findByRole('status')).toHaveTextContent('Đã đổi mật khẩu');
    expect(await bcrypt.compare('MatKhauMoi99999', db.table('platform_admins')[0].password_hash)).toBe(true);

    const form = document.getElementById('account_create_form')!;
    await u.type(within(form).getByLabelText(/Tên đăng nhập/), 'nhanvien1');
    await u.type(within(form).getByLabelText(/Mật khẩu ban đầu/), 'MatKhauBanDau1');
    await u.click(within(form).getByRole('button', { name: /Tạo tài khoản/ }));
    expect(await screen.findByText(/Đã tạo tài khoản "nhanvien1"/)).toBeTruthy();
    const moi = db.table('platform_admins').find(a => a.username === 'nhanvien1')!;
    expect(moi.is_owner).toBeFalsy();
    expect(moi.password_hash).not.toContain('MatKhauBanDau1');

    await u.click(await screen.findByRole('button', { name: /^Khóa$/ }));
    await waitFor(() => expect(db.table('platform_admins').find(a => a.username === 'nhanvien1')!.active).toBe(false));
  });

  it('quản trị viên KHÔNG phải chủ chỉ thấy form đổi mật khẩu, không thấy phần quản lý tài khoản', async () => {
    db.table('platform_admins')[0].is_owner = false;
    const u = await dangNhap();
    await u.click(screen.getByRole('button', { name: /Tài khoản/ }));
    await waitFor(() => expect(document.getElementById('password_form')).toBeTruthy());
    expect(document.getElementById('account_create_form')).toBeNull();
  });

  it('nhật ký hiện thao tác vừa làm (khóa công ty) và không chứa mật khẩu', async () => {
    const u = await dangNhap();
    await u.click(screen.getByRole('button', { name: /Doanh nghiệp/ }));
    const khoa = await screen.findAllByRole('button', { name: /Khóa/ });
    await u.click(khoa[0]);
    await u.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Khóa doanh nghiệp' }));
    await waitFor(() => expect(db.table('platform_audit_logs').some(l => l.action === 'companies.update')).toBe(true));
    await u.click(screen.getByRole('button', { name: /Nhật ký/ }));
    expect(await screen.findByText(/Khóa doanh nghiệp/)).toBeTruthy();
    expect(JSON.stringify(db.table('platform_audit_logs'))).not.toMatch(/MatKhauTot123|\$2[aby]\$/);
  });
});
