import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { replaceContractValueInHtml, formatContractMoney } from '../subcontractorContractValue';
import { docSoTiengViet } from '../../components/QuotationTableSheet';

const doc = (v: number) => `<p>Giá trị: <b>${formatContractMoney(v)}</b></p><p>Bằng chữ: ${docSoTiengViet(v)}</p><p>Thanh toán 30% = 126.000.000 VND</p>`;

describe('replaceContractValueInHtml', () => {
  it('thay cả dạng số và dạng chữ của giá trị cũ bằng giá trị mới', () => {
    const r = replaceContractValueInHtml(doc(420000000), 420000000, 500000000, docSoTiengViet);
    expect(r.replaced).toBe(2);
    expect(r.html).toContain('500.000.000 VND');
    expect(r.html).toContain(docSoTiengViet(500000000));
    expect(r.html).not.toContain('420.000.000 VND');
    expect(r.html).not.toContain(docSoTiengViet(420000000));
  });
  it('không đụng số tiền khác trong văn bản (VD 30%)', () => {
    const r = replaceContractValueInHtml(doc(420000000), 420000000, 500000000, docSoTiengViet);
    expect(r.html).toContain('126.000.000 VND');
  });
  it('thay mọi lần xuất hiện của giá trị cũ', () => {
    const html = doc(420000000) + doc(420000000);
    expect(replaceContractValueInHtml(html, 420000000, 1, docSoTiengViet).replaced).toBe(4);
  });
  it('văn bản đã bị sửa tay (không còn số cũ) → replaced = 0, giữ nguyên', () => {
    const html = '<p>Giá trị hợp đồng là bốn trăm hai mươi triệu</p>';
    const r = replaceContractValueInHtml(html, 420000000, 500000000, docSoTiengViet);
    expect(r.replaced).toBe(0);
    expect(r.html).toBe(html);
  });
  it('giá trị không đổi hoặc văn bản rỗng → không làm gì', () => {
    expect(replaceContractValueInHtml(doc(5), 5, 5, docSoTiengViet).replaced).toBe(0);
    expect(replaceContractValueInHtml('', 5, 6, docSoTiengViet)).toEqual({ html: '', replaced: 0 });
  });
  it('giá trị cũ = 0 → không thay (mẫu ghi "0 VND"/"Chưa cập nhật", không thay an toàn được)', () => {
    const html = '<p>0 VND — Chưa cập nhật</p>';
    expect(replaceContractValueInHtml(html, 0, 9, docSoTiengViet)).toEqual({ html, replaced: 0 });
  });
  it('đổi về 0 → số bằng chữ thành "Chưa cập nhật"', () => {
    const r = replaceContractValueInHtml(doc(420000000), 420000000, 0, docSoTiengViet);
    expect(r.html).toContain('0 VND');
    expect(r.html).toContain('Chưa cập nhật');
  });
});

describe('SubcontractorArchive — ô giá trị hợp đồng', () => {
  const src = fs.readFileSync('src/components/SubcontractorArchive.tsx', 'utf8');
  it('ô giá trị chỉ khóa khi hợp đồng đã duyệt (không phụ thuộc "Chỉnh sửa bản in")', () => {
    const i = src.indexOf('Giá trị hợp đồng khoán:');
    const block = src.slice(i, i + 700);
    expect(block).toMatch(/disabled=\{tempQuote\.isApproved\}/);
    expect(block).not.toMatch(/!isEditing/);
  });
  it('có nút Lưu giá trị và thông báo hủy duyệt chỉ đúng cách sửa', () => {
    expect(src).toContain('Lưu giá trị');
    expect(src).toMatch(/Đã mở khóa: sửa ô/);
  });
});
