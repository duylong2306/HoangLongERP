import { describe, it, expect } from 'vitest';
import { chooseScreen } from '../boot';

// Quyết định màn hình khởi động. Quan trọng nhất: TOKEN KHÓA (doanh nghiệp hết hạn) không bao giờ vào ERP,
// và /quantri chỉ mở ở địa chỉ gốc/other — không bao giờ ở subdomain doanh nghiệp.
const NOW = 1_800_000_000_000;
const sec = (ms: number) => Math.floor(ms / 1000);
const thuong = (expOffsetMs = 3 * 86400000) => ({ sub: 'emp_admin', role: 'authenticated', company_id: 'c1', exp: sec(NOW + expOffsetMs) });
const khoa = (expOffsetMs = 86400000) => ({ sub: 'emp_admin', role: 'anon', locked_company_id: 'c1', exp: sec(NOW + expOffsetMs) });

describe('chooseScreen — trang quản trị & địa chỉ gốc', () => {
  it('/quantri ở địa chỉ gốc và địa chỉ "other" → trang quản trị (kể cả /quantri/ và đường dẫn con)', () => {
    for (const kind of ['root', 'other'] as const) {
      for (const path of ['/quantri', '/quantri/', '/quantri/doanh-nghiep']) {
        expect(chooseScreen(kind, path, null, NOW).screen, `${kind} ${path}`).toBe('console');
      }
    }
  });
  it('/quantri ở SUBDOMAIN doanh nghiệp → vẫn là ERP, không bao giờ là trang quản trị', () => {
    expect(chooseScreen('tenant', '/quantri', null, NOW).screen).toBe('erp');
    expect(chooseScreen('tenant', '/quantri', khoa(), NOW).screen).toBe('renewal');
  });
  it('đường dẫn gần giống không phải /quantri', () => {
    expect(chooseScreen('root', '/quantri-gia', null, NOW).screen).toBe('landing');
    expect(chooseScreen('root', '/x/quantri', null, NOW).screen).toBe('landing');
  });
  it('địa chỉ gốc → trang giới thiệu', () => {
    expect(chooseScreen('root', '/', null, NOW).screen).toBe('landing');
  });
});

describe('chooseScreen — token ERP', () => {
  it('không có token → ERP (màn đăng nhập), không xóa gì', () => {
    expect(chooseScreen('tenant', '/', null, NOW)).toEqual({ screen: 'erp', clearSession: false, reloadAtMs: null });
  });
  it('token thường còn hạn → ERP, hẹn tải lại đúng lúc token hết hạn', () => {
    const c = thuong();
    expect(chooseScreen('tenant', '/', c, NOW)).toEqual({ screen: 'erp', clearSession: false, reloadAtMs: c.exp * 1000 });
  });
  it('token thường ĐÃ hết hạn → ERP kèm xóa phiên (về màn đăng nhập), không dùng token chết', () => {
    expect(chooseScreen('tenant', '/', thuong(-1000), NOW)).toEqual({ screen: 'erp', clearSession: true, reloadAtMs: null });
    expect(chooseScreen('tenant', '/', thuong(0), NOW).clearSession).toBe(true);   // đúng thời điểm hết hạn
  });
  it('token KHÓA còn hạn → trang gia hạn, không xóa phiên, không hẹn tải lại', () => {
    expect(chooseScreen('tenant', '/', khoa(), NOW)).toEqual({ screen: 'renewal', clearSession: false, reloadAtMs: null });
    expect(chooseScreen('other', '/', khoa(), NOW).screen).toBe('renewal');
  });
  it('token KHÓA đã hết hạn → xóa phiên về đăng nhập (không kẹt ở trang gia hạn với token chết)', () => {
    expect(chooseScreen('tenant', '/', khoa(-5000), NOW)).toEqual({ screen: 'erp', clearSession: true, reloadAtMs: null });
  });
  it('token không có exp: vẫn phân biệt khóa / thường', () => {
    expect(chooseScreen('tenant', '/', { locked_company_id: 'c1' }, NOW).screen).toBe('renewal');
    expect(chooseScreen('tenant', '/', { company_id: 'c1' }, NOW)).toEqual({ screen: 'erp', clearSession: false, reloadAtMs: null });
  });
  it('locked_company_id không phải chuỗi (dữ liệu lạ) → không coi là token khóa', () => {
    expect(chooseScreen('tenant', '/', { locked_company_id: 123, exp: sec(NOW + 1000) }, NOW).screen).toBe('erp');
  });
});
