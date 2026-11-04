import { describe, it, expect } from 'vitest';
import { isImeComposing } from '../ime';

describe('isImeComposing', () => {
  it('Chrome: isComposing=true → đang ghép chữ', () => expect(isImeComposing({ nativeEvent: { isComposing: true }, keyCode: 13 })).toBe(true));
  it('Safari: chốt chữ xong mới gửi keydown với keyCode 229 → vẫn coi là đang ghép', () => expect(isImeComposing({ nativeEvent: { isComposing: false }, keyCode: 229 })).toBe(true));
  it('Enter thường (không ghép chữ) → false', () => expect(isImeComposing({ nativeEvent: { isComposing: false }, keyCode: 13 })).toBe(false));
  it('thiếu thông tin → false', () => expect(isImeComposing({})).toBe(false));
});
