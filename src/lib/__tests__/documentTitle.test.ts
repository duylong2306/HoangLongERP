import { describe, it, expect } from 'vitest';
import { buildDocumentTitle, DEFAULT_DOCUMENT_TITLE } from '../documentTitle';

describe('Tiêu đề tab theo doanh nghiệp', () => {
  it('có tên → "<Tên> — LoLo" (tên đứng trước)', () => expect(buildDocumentTitle('Hoàng Long')).toBe('Hoàng Long — LoLo'));
  it('cắt khoảng trắng thừa', () => expect(buildDocumentTitle('  Hoàng Long  ')).toBe('Hoàng Long — LoLo'));
  it('rỗng / thiếu / tên mặc định → tiêu đề mặc định', () => {
    expect(buildDocumentTitle('')).toBe(DEFAULT_DOCUMENT_TITLE);
    expect(buildDocumentTitle(undefined)).toBe(DEFAULT_DOCUMENT_TITLE);
    expect(buildDocumentTitle('Tên Công Ty Của Bạn')).toBe(DEFAULT_DOCUMENT_TITLE);
  });
});
