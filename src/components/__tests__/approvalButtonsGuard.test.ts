import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Canh: MỌI nút Duyệt VÀ Hủy duyệt hồ sơ dự án (Báo Giá / Hợp Đồng / Nghiệm Thu / Thanh Lý) phải kiểm tra người duyệt theo Quyền Phê Duyệt
// (canApproveProjectDoc). Trước đây chỉ có nút Duyệt ở vài nơi, nút Hủy duyệt thì không có kiểm soát nào.
const doc = (f: string) => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');
const thanHam = (src: string, ten: string): string => {
  const i = src.indexOf(`const ${ten} = async`);
  expect(i, `không thấy hàm ${ten}`).toBeGreaterThan(-1);
  return src.slice(i, i + 700);
};

describe('Nút Duyệt / Hủy duyệt hồ sơ dự án đều kiểm tra Quyền Phê Duyệt', () => {
  const cases: [string, string[]][] = [
    ['ContractDocument.tsx', ['handleApproveContract', 'handleUnapproveContract']],
    ['QuotationTableSheet.tsx', ['handleApproveQuote', 'handleUnapproveQuote']],
    ['AcceptanceDocument.tsx', ['handleApproveAcceptance', 'handleUnapproveAcceptance']],
    ['LiquidationDocument.tsx', ['handleApproveLiquidation', 'handleUnapproveLiquidation']],
  ];
  for (const [file, ham] of cases) {
    it(`${file}: ${ham.join(' + ')}`, () => {
      const src = doc(file);
      expect(src).toContain('canApproveProjectDoc');
      for (const h of ham) expect(thanHam(src, h), h).toMatch(/!coQuyenDuyet\w+/);
    });
  }
  it('Hợp đồng thầu phụ: cả Duyệt và Hủy duyệt đều kiểm tra', () => {
    const src = doc('SubcontractorArchive.tsx');
    expect((src.match(/canApproveProjectDoc\(currentUser\?\.id, 'contract'\)/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
