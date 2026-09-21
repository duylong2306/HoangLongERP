import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import ConstructionFinalQuote from '../ConstructionFinalQuote';
import FinalQuoteDocument from '../FinalQuoteDocument';

const rows = [
  { id: 's1', kind: 'section', name: '1. PHẦN THÁO DỠ' },
  { id: 'i0', kind: 'item', name: 'Tháo dỡ cửa', unit: 'm2', vatTu: 0, nhanCong: 14592, heSo: 1.1 },
  { id: 'l0', kind: 'line', soBP: 9, dai: 0.9, cao: 2 },            // 16,2 × 16.051 = 260.026
  { id: 's2', kind: 'section', name: '2. PHẦN CẢI TẠO' },
  { id: 'i1', kind: 'item', name: 'Ốp gạch tường wc', unit: 'm2', vatTu: 450000, nhanCong: 150000, heSo: 1.1 },
  { id: 'l1', kind: 'line', soBP: 1, dai: 7.6, cao: 2.4 },
  { id: 'l2', kind: 'line', soBP: -1, dai: 0.75, cao: 2 },
  { id: 'l3', kind: 'line', soBP: -1, dai: 0.6, cao: 0.6 },        // 16,38 × 660.000 = 10.810.800
]; // tổng = 11.070.826 → làm tròn 11.071.000
const txt = (c: HTMLElement) => (c.textContent || '').replace(/\s+/g, ' ');

describe('Báo giá cuối cùng — bảng tổng hợp từ bóc tách', () => {
  it('hiện bảng tổng hợp theo từng phần, tổng cộng và làm tròn; số so sánh lấy từ bảng', () => {
    sessionStorage.clear(); sessionStorage.setItem('takeoff_rows', JSON.stringify(rows));
    const { container } = render(<ConstructionFinalQuote />);
    const t = txt(container);
    expect(t).toContain('1. PHẦN THÁO DỠ');
    expect(t).toContain('2. PHẦN CẢI TẠO');
    expect(t).toContain('Ốp gạch tường wc');
    expect(t).toContain('10.810.800');           // thành tiền hạng mục
    expect(t).toContain('11.070.826');           // TỔNG CỘNG
    expect(t).toContain('11.071.000');           // LÀM TRÒN
    expect(t).toContain('Tổng chi phí dự toán từ bảng bóc tách cuối cùng:11.070.826 đ');
    expect(t).not.toContain('Tên vật tư / nhân công / dịch vụ'); // bảng vật liệu nhập tay cũ đã bỏ
  });

  it('không còn hiện số cũ: luôn tính từ bảng, kể cả khi phiên còn tổng lưu cũ', () => {
    sessionStorage.clear(); sessionStorage.setItem('takeoff_rows', JSON.stringify(rows));
    sessionStorage.setItem('takeoff_saved_totals', JSON.stringify({ cost: 5000000 }));
    const { container } = render(<ConstructionFinalQuote />);
    expect(txt(container)).toContain('11.070.826');
    expect(txt(container)).not.toContain('5.000.000');
  });

  it('hồ sơ đã lưu & khóa: dùng bảng đã lưu; đang chỉnh sửa: dùng bảng hiện hành', () => {
    sessionStorage.clear();
    const live = rows.slice(0, 3); // bảng hiện hành chỉ còn phần 1 (260.026)
    sessionStorage.setItem('takeoff_rows', JSON.stringify(live));
    const saved = { id: 'q', code: 'X', takeoffRows: rows };
    const locked = render(<ConstructionFinalQuote loadedQuote={saved} isLocked isConstructionSaved />);
    expect(txt(locked.container)).toContain('11.070.826');
    locked.unmount();
    const editing = render(<ConstructionFinalQuote loadedQuote={saved} isLocked={false} isConstructionSaved />);
    expect(txt(editing.container)).toContain('260.026');
    expect(txt(editing.container)).not.toContain('11.070.826');
  });

  it('bản in Báo giá cuối cùng dùng cùng bảng tổng hợp (từ takeoffRows trong hồ sơ)', () => {
    const { container } = render(<FinalQuoteDocument quoteData={{ takeoffRows: rows, code: 'X' }} />);
    const t = txt(container);
    expect(t).toContain('2. PHẦN CẢI TẠO');
    expect(t).toContain('11.071.000');
    expect(t).toContain('Bằng chữ');
  });
});
