import { describe, it, expect } from 'vitest';
import { slugify } from '../slug';
import { slugProblem } from '../../../api/_signup';

describe('slugify', () => {
  it('bỏ dấu tiếng Việt, đ → d, khoảng trắng → gạch ngang', () => {
    expect(slugify('Công ty TNHH Đại Phát')).toBe('cong-ty-tnhh-dai-phat');
    expect(slugify('  Hoàng   Long ERP ')).toBe('hoang-long-erp');
    expect(slugify('ĐẶNG THỊ ÁNH')).toBe('dang-thi-anh');
  });
  it('bỏ ký tự đặc biệt, không để gạch ngang ở đầu/cuối', () => {
    expect(slugify('***ABC & XYZ!!!')).toBe('abc-xyz');
    expect(slugify('--a--b--')).toBe('a-b');
  });
  it('cắt tối đa 40 ký tự và không kết thúc bằng gạch ngang', () => {
    const s = slugify('a'.repeat(39) + ' bcd');
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith('-')).toBe(false);
  });
  it('rỗng / toàn ký tự lạ → rỗng', () => {
    expect(slugify('')).toBe('');
    expect(slugify('!!!')).toBe('');
  });
  it('kết quả (nếu đủ dài) luôn qua kiểm tra định dạng của máy chủ', () => {
    for (const ten of ['Công ty ABC', 'Nội thất Á Châu 2026', 'Xây dựng Đông Nam Á']) {
      expect(slugProblem(slugify(ten))).toBeNull();
    }
  });
});
