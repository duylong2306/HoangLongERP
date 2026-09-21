import { describe, it, expect } from 'vitest';
import { computeTakeoff, normalizeTakeoffRows, splitCatalogPrice, toTemplateRows, instantiateTemplateRows, TakeoffRow } from '../takeoffCalc';

describe('takeoffCalc — bóc tách dạng Excel', () => {
  // Dữ liệu lấy từ file "KL A HIỀN": hạng mục 3 (tháo dỡ cửa) và hạng mục 15 (ốp gạch WC, có trừ cửa)
  const rows: TakeoffRow[] = [
    { id: 's1', kind: 'section', name: '1. PHẦN THÁO DỠ' },
    { id: 'i1', kind: 'item', name: 'Tháo dỡ cửa thủ công', unit: 'm2', vatTu: 0, nhanCong: 14592, heSo: 1.1 },
    { id: 'l1', kind: 'line', soBP: 9, dai: 0.9, cao: 2 },
    { id: 'l2', kind: 'line', soBP: 1, dai: 1.5, cao: 1 },
    { id: 'l3', kind: 'line', soBP: 2, dai: 0.5, cao: 1 },
    { id: 'l4', kind: 'line', soBP: 1, dai: 0.8, cao: 1 },
    { id: 's2', kind: 'section', name: '2. PHẦN CẢI TẠO' },
    { id: 'i2', kind: 'item', name: 'Ốp gạch tường wc', unit: 'm2', vatTu: 450000, nhanCong: 150000, heSo: 1.1 },
    { id: 'l5', kind: 'line', soBP: 1, dai: 7.6, cao: 2.4 },
    { id: 'l6', kind: 'line', soBP: -1, dai: 0.75, cao: 2 }, // trừ cửa
    { id: 'l7', kind: 'line', soBP: -1, dai: 0.6, cao: 0.6 },
    // Láng nền = KL hạng mục 2 (liên kết)
    { id: 'i3', kind: 'item', name: 'Láng nền', unit: 'm2', vatTu: 0, nhanCong: 140000, heSo: 1.1 },
    { id: 'l8', kind: 'line', soBP: 1, refItemId: 'i2' },
  ];

  it('tính KL dòng, hạng mục, đơn giá và thành tiền giống Excel', () => {
    const { rows: c, totals } = computeTakeoff(rows);
    const item1 = c.find(r => r.id === 'i1')!;
    expect(item1.kl).toBe(19.5);            // 16.2 + 1.5 + 1 + 0.8
    expect(item1.donGia).toBe(16051);        // ROUND(14592 × 1.1)
    expect(item1.thanhTien).toBe(312995);    // ROUND(19.5 × 16051)
    const item2 = c.find(r => r.id === 'i2')!;
    expect(item2.kl).toBe(16.38);            // 18.24 − 1.5 − 0.36 (số âm để trừ)
    expect(item2.donGia).toBe(660000);
    expect(item2.thanhTien).toBe(10810800);
    expect(totals.total).toBe(312995 + 10810800 + Math.round(16.38 * 154000));
  });

  it('liên kết "lấy KL từ hạng mục khác" và chống vòng lặp', () => {
    const { rows: c } = computeTakeoff(rows);
    expect(c.find(r => r.id === 'i3')!.kl).toBe(16.38);
    const cyc: TakeoffRow[] = [
      { id: 'a', kind: 'item', vatTu: 1 }, { id: 'la', kind: 'line', refItemId: 'b' },
      { id: 'b', kind: 'item', vatTu: 1 }, { id: 'lb', kind: 'line', refItemId: 'a' },
    ];
    expect(() => computeTakeoff(cyc)).not.toThrow();
  });

  it('tính tổng phần và STT tự động', () => {
    const { rows: c } = computeTakeoff(rows);
    expect(c.filter(r => r.kind === 'item').map(r => r.stt)).toEqual([1, 2, 3]);
    expect(c.find(r => r.id === 's1')!.sectionTotal).toBe(312995);
  });

  it('dòng không có số nào → KL = 0; LÀM TRÒN đến nghìn', () => {
    const { rows: c, totals } = computeTakeoff([
      { id: 'i', kind: 'item', vatTu: 1000, heSo: 1 }, { id: 'l', kind: 'line' },
      { id: 'j', kind: 'item', vatTu: 1234, heSo: 1 }, { id: 'm', kind: 'line', soBP: 1, dai: 1 },
    ]);
    expect(c.find(r => r.id === 'i')!.kl).toBe(0);
    expect(totals.total).toBe(1234);
    expect(totals.rounded).toBe(1000);
  });

  it('chuyển dữ liệu bóc tách cũ sang định dạng mới mà không đổi thành tiền', () => {
    const legacy = [
      { id: 'a', category: 'I. MÓNG', name: 'BT lót', unit: 'm³', dai: 10, rong: 2, cao: 0.1, qty: 3, haoHut: 5, price: 2200000, maDM: 'AB.1' },
      { id: 'b', category: 'I. MÓNG', name: 'Trát', unit: 'm²', dai: 5, rong: 0, cao: 3, qty: 2, haoHut: 8, price: 100000, maDM: '' },
      { id: 'c', category: 'II. THÂN', name: 'Chưa nhập', unit: 'm³', dai: 0, rong: 0, cao: 0, qty: 0, haoHut: 5, price: 900000, maDM: '' },
    ];
    const { totals, rows: c } = computeTakeoff(normalizeTakeoffRows(legacy));
    // cũ: 10×2×0.1×3 ×1.05 ×2.2tr  và  5×3×2 ×1.08 ×100k ; dòng qty = 0 → 0
    expect(c.filter(r => r.kind === 'section')).toHaveLength(2);
    expect(totals.total).toBe(Math.round(6 * Math.round(2200000 * 1.05)) + Math.round(30 * Math.round(100000 * 1.08)));
  });

  it('đơn giá từ danh mục: tách sẵn hoặc suy theo nhóm', () => {
    expect(splitCatalogPrice({ group: 'CÔNG TÁC THI CÔNG', avgPrice: 100, vatTu: 60, nhanCong: 40 })).toEqual({ vatTu: 60, nhanCong: 40 });
    expect(splitCatalogPrice({ group: 'NHÂN CÔNG', avgPrice: 500 })).toEqual({ vatTu: 0, nhanCong: 500 });
    expect(splitCatalogPrice({ group: 'VẬT LIỆU CHÍNH', avgPrice: 300 })).toEqual({ vatTu: 300, nhanCong: 0 });
  });
});

describe('mẫu bóc tách do người dùng tạo', () => {
  const src: TakeoffRow[] = [
    { id: 's', kind: 'section', name: '1. PHẦN THÁO DỠ' },
    { id: 'i', kind: 'item', name: 'Tháo dỡ cửa', unit: 'm2', vatTu: 0, nhanCong: 14592, heSo: 1.1 },
    { id: 'l', kind: 'line', name: 'cửa đi', soBP: 9, dai: 0.9, cao: 2, refItemId: 'x' },
  ];
  it('lưu mẫu: giữ cấu trúc + đơn giá, xóa số đo', () => {
    const tpl = toTemplateRows(src);
    expect(tpl[1]).toMatchObject({ kind: 'item', unit: 'm2', nhanCong: 14592, heSo: 1.1 });
    expect(tpl[2]).toEqual({ id: 'l', kind: 'line', name: 'cửa đi' });
  });
  it('áp mẫu: id mới, KL = 0, mỗi hạng mục có ≥ 1 dòng chi tiết', () => {
    const rows = instantiateTemplateRows(toTemplateRows([src[0], src[1]])); // hạng mục chưa có dòng
    expect(rows.map(r => r.kind)).toEqual(['section', 'item', 'line']);
    expect(new Set(rows.map(r => r.id)).size).toBe(3);
    expect(computeTakeoff(rows).totals.total).toBe(0);
  });
});

describe('thành tiền vật tư / nhân công', () => {
  it('hai cột cộng lại đúng bằng thành tiền (kể cả khi làm tròn) và cộng dồn lên phần + tổng', () => {
    const { rows, totals } = computeTakeoff([
      { id: 's', kind: 'section', name: 'P1' },
      { id: 'i', kind: 'item', vatTu: 450000, nhanCong: 150000, heSo: 1.1 }, { id: 'l', kind: 'line', soBP: 1, dai: 7.6, cao: 2.4 },
      { id: 'j', kind: 'item', vatTu: 333, nhanCong: 777, heSo: 1.1 }, { id: 'm', kind: 'line', soBP: 1, dai: 3.33 },
    ]);
    const items = rows.filter(r => r.kind === 'item');
    items.forEach(r => expect((r.ttVatTu || 0) + (r.ttNhanCong || 0)).toBe(r.thanhTien));
    expect(items[0].ttVatTu).toBe(Math.round(18.24 * 450000 * 1.1)); // 9.028.800
    const sec = rows.find(r => r.kind === 'section')!;
    expect((sec.ttVatTu || 0) + (sec.ttNhanCong || 0)).toBe(sec.sectionTotal);
    expect(totals.vatTu + totals.nhanCong).toBe(totals.total);
  });
});
