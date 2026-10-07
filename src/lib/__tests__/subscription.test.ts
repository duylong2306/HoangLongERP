import { describe, it, expect } from 'vitest';
import {
  getSubscriptionState, tokenTtlSeconds, addMonths, computeRenewal, orderAmount, makeOrderCode,
  validatePlan, readTrial, readBank, cleanFeatures, DAY_MS, MAX_TOKEN_SECONDS,
} from '../../../api/_subscription';

// Logic gói dịch vụ / hạn dùng / đơn đăng ký (trang quản trị nền tảng).
const T = (s: string) => new Date(s);

describe('getSubscriptionState', () => {
  const now = T('2026-10-07T00:00:00Z');
  it('không có hạn → không giới hạn, không khóa (doanh nghiệp cũ như Hoàng Long)', () => {
    expect(getSubscriptionState({ expires_at: null }, now)).toEqual({ status: 'unlimited', expiresAt: null, daysLeft: null, isTrial: false, locked: false });
    expect(getSubscriptionState({}, now).status).toBe('unlimited');
  });
  it('còn hạn: dùng thử → trial, gói trả phí → active; số ngày làm tròn LÊN', () => {
    const exp = new Date(now.getTime() + 6.2 * DAY_MS).toISOString();
    expect(getSubscriptionState({ expires_at: exp, is_trial: true }, now)).toMatchObject({ status: 'trial', daysLeft: 7, locked: false, isTrial: true });
    expect(getSubscriptionState({ expires_at: exp, is_trial: false }, now)).toMatchObject({ status: 'active', daysLeft: 7, locked: false });
  });
  it('còn 1 giây vẫn tính 1 ngày và chưa khóa', () => {
    const exp = new Date(now.getTime() + 1000).toISOString();
    expect(getSubscriptionState({ expires_at: exp }, now)).toMatchObject({ status: 'active', daysLeft: 1, locked: false });
  });
  it('đúng thời điểm hết hạn hoặc quá hạn → expired, khóa, daysLeft 0', () => {
    expect(getSubscriptionState({ expires_at: now.toISOString(), is_trial: true }, now)).toMatchObject({ status: 'expired', locked: true, daysLeft: 0, isTrial: true });
    expect(getSubscriptionState({ expires_at: '2026-01-01T00:00:00Z' }, now)).toMatchObject({ status: 'expired', locked: true });
  });
  it('dữ liệu hạn hỏng → khóa (không mở khóa nhầm)', () => {
    expect(getSubscriptionState({ expires_at: 'không-phải-ngày' }, now)).toMatchObject({ status: 'expired', locked: true });
  });
});

describe('tokenTtlSeconds', () => {
  const now = T('2026-10-07T00:00:00Z');
  it('không giới hạn → 7 ngày; còn hạn dài → 7 ngày', () => {
    expect(tokenTtlSeconds(null, now)).toBe(MAX_TOKEN_SECONDS);
    expect(tokenTtlSeconds(new Date(now.getTime() + 90 * DAY_MS).toISOString(), now)).toBe(MAX_TOKEN_SECONDS);
  });
  it('sắp hết hạn → token hết đúng lúc gói hết (không sống lâu hơn gói)', () => {
    expect(tokenTtlSeconds(new Date(now.getTime() + 3 * 3600 * 1000).toISOString(), now)).toBe(3 * 3600);
  });
  it('tối thiểu 60 giây; dữ liệu hỏng → 60', () => {
    expect(tokenTtlSeconds(new Date(now.getTime() + 5000).toISOString(), now)).toBe(60);
    expect(tokenTtlSeconds('xyz', now)).toBe(60);
  });
});

describe('addMonths', () => {
  it('cộng tháng lịch, kẹp về cuối tháng', () => {
    expect(addMonths(T('2026-01-31T10:00:00Z'), 1).toISOString()).toBe('2026-02-28T10:00:00.000Z');
    expect(addMonths(T('2028-01-31T10:00:00Z'), 1).toISOString()).toBe('2028-02-29T10:00:00.000Z');   // năm nhuận
    expect(addMonths(T('2026-03-15T00:00:00Z'), 1).toISOString()).toBe('2026-04-15T00:00:00.000Z');
    expect(addMonths(T('2026-12-10T00:00:00Z'), 1).toISOString()).toBe('2027-01-10T00:00:00.000Z');   // qua năm
    expect(addMonths(T('2026-10-07T00:00:00Z'), 12).toISOString()).toBe('2027-10-07T00:00:00.000Z');
    expect(addMonths(T('2028-02-29T00:00:00Z'), 12).toISOString()).toBe('2029-02-28T00:00:00.000Z');   // 29/02 + 1 năm
  });
  it('không làm thay đổi ngày gốc', () => {
    const d = T('2026-01-31T00:00:00Z'); addMonths(d, 1);
    expect(d.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });
});

describe('computeRenewal', () => {
  const now = T('2026-10-07T00:00:00Z');
  it('còn hạn (kể cả dùng thử còn ngày) → tính TIẾP từ hạn hiện tại, không mất ngày', () => {
    const r = computeRenewal('2026-10-12T00:00:00Z', 1, now);
    expect(r.start.toISOString()).toBe('2026-10-12T00:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-11-12T00:00:00.000Z');
  });
  it('đã hết hạn → tính từ BÂY GIỜ (không bù ngày đã quá hạn)', () => {
    const r = computeRenewal('2026-09-01T00:00:00Z', 12, now);
    expect(r.start.toISOString()).toBe(now.toISOString());
    expect(r.end.toISOString()).toBe('2027-10-07T00:00:00.000Z');
  });
  it('không giới hạn/không có hạn → từ bây giờ', () => {
    expect(computeRenewal(null, 1, now).start.toISOString()).toBe(now.toISOString());
  });
});

describe('orderAmount', () => {
  const plan = { price_monthly: 299000, price_yearly: 2990000 };
  it('theo kỳ hạn', () => {
    expect(orderAmount(plan, 'month')).toEqual({ months: 1, amount: 299000 });
    expect(orderAmount(plan, 'year')).toEqual({ months: 12, amount: 2990000 });
  });
  it('kỳ hạn lạ hoặc gói chưa đặt giá (0) → null', () => {
    expect(orderAmount(plan, 'week')).toBeNull();
    expect(orderAmount({ price_monthly: 0, price_yearly: 5 }, 'month')).toBeNull();
    expect(orderAmount({ price_monthly: 5, price_yearly: 0 }, 'year')).toBeNull();
  });
});

describe('makeOrderCode', () => {
  it('dạng LOLO + 8 ký tự, không có ký tự dễ nhầm, hầu như không trùng', () => {
    const set = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const c = makeOrderCode();
      expect(c).toMatch(/^LOLO[A-HJ-NP-Z2-9]{8}$/);
      set.add(c);
    }
    expect(set.size).toBe(500);
  });
});

describe('validatePlan', () => {
  const hopLe = { id: ' Co-Ban ', name: '  Cơ   bản ', description: 'Mô tả', priceMonthly: 299000, priceYearly: '2990000', maxEmployees: 10, active: true, sortOrder: 5 };
  it('hợp lệ → làm sạch', () => {
    const r = validatePlan(hopLe);
    expect(r.ok).toBe(true);
    expect(r.data).toEqual({ id: 'co-ban', name: 'Cơ bản', description: 'Mô tả', badge: '', features: [], price_monthly: 299000, price_yearly: 2990000, max_employees: 10, active: true, sort_order: 5 });
  });
  it('số nhân viên trống → không giới hạn; active mặc định false', () => {
    const r = validatePlan({ ...hopLe, maxEmployees: '', active: undefined });
    expect(r.data).toMatchObject({ max_employees: null, active: false });
  });
  it.each([
    ['mã gói sai', { id: 'Sai Ma!' }, 'id'],
    ['tên rỗng', { name: ' ' }, 'name'],
    ['giá tháng âm', { priceMonthly: -1 }, 'priceMonthly'],
    ['giá năm lẻ', { priceYearly: 1.5 }, 'priceYearly'],
    ['giá năm không phải số', { priceYearly: 'abc' }, 'priceYearly'],
    ['thiếu giá tháng', { priceMonthly: undefined }, 'priceMonthly'],
    ['nhân viên = 0', { maxEmployees: 0 }, 'maxEmployees'],
    ['mô tả quá dài', { description: 'x'.repeat(301) }, 'description'],
  ])('từ chối: %s', (_t, doi, truong) => {
    const r = validatePlan({ ...hopLe, ...doi });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors!)).toContain(truong);
  });
});

describe('readTrial / readBank', () => {
  it('đọc giá trị DB về dạng an toàn, sai thì dùng mặc định', () => {
    expect(readTrial({ days: 14, maxEmployees: 5 })).toEqual({ days: 14, maxEmployees: 5 });
    expect(readTrial({ days: 0 })).toEqual({ days: 7, maxEmployees: null });
    expect(readTrial(null)).toEqual({ days: 7, maxEmployees: null });
    expect(readTrial({ days: 9999 }).days).toBe(7);
  });
  it('ngân hàng: cắt độ dài, bỏ giá trị không phải chuỗi', () => {
    expect(readBank({ bankName: ' VCB ', accountNumber: 123, accountName: 'A', note: 'x'.repeat(500) }))
      .toEqual({ bankName: 'VCB', bankBin: '', accountNumber: '', accountName: 'A', note: 'x'.repeat(300) });
    expect(readBank(undefined)).toEqual({ bankName: '', bankBin: '', accountNumber: '', accountName: '', note: '' });
    // Mã BIN chỉ nhận đúng 6 chữ số
    expect(readBank({ bankBin: '970436' }).bankBin).toBe('970436');
    for (const bad of ['97043', '9704361', '97043a', 970436]) expect(readBank({ bankBin: bad }).bankBin).toBe('');
  });
});

describe('cleanFeatures', () => {
  it('chuẩn hóa: bỏ dòng rỗng, gộp khoảng trắng, mặc định được nhận, cắt 120 ký tự, tối đa 30 dòng', () => {
    expect(cleanFeatures([{ text: '  Quản   lý ', included: true }, { text: '', included: true }, { text: 'Không có', included: false }, { text: 'Mặc định' }]))
      .toEqual([{ text: 'Quản lý', included: true }, { text: 'Không có', included: false }, { text: 'Mặc định', included: true }]);
    expect(cleanFeatures([{ text: 'x'.repeat(200) }])[0].text).toHaveLength(120);
    expect(cleanFeatures(Array.from({ length: 50 }, (_, i) => ({ text: `d${i}` })))).toHaveLength(30);
    for (const bad of [null, undefined, 'abc', 5, {}]) expect(cleanFeatures(bad)).toEqual([]);
  });
});
