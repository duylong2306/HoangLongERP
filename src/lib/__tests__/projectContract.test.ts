import { describe, it, expect } from 'vitest';
import { contractFinalValue, approvedContractByProject, withApprovedContractValue } from '../projectContract';

describe('Giá trị hợp đồng đã duyệt của công trình', () => {
  it('giá trị 1 hợp đồng: totalAmount → contractValue → tổng items.totalPrice (như Kế toán)', () => {
    expect(contractFinalValue({ totalAmount: 100, contractValue: 50 })).toBe(100);
    expect(contractFinalValue({ totalAmount: null, contractValue: 50 })).toBe(50);
    expect(contractFinalValue({ items: [{ totalPrice: 30 }, { totalPrice: 20 }] })).toBe(50);
    expect(contractFinalValue({})).toBe(0);
  });

  it('chỉ cộng hợp đồng khách hàng ĐÃ DUYỆT; nhiều hợp đồng cùng công trình thì cộng dồn; bỏ thầu phụ và hợp đồng chưa duyệt', () => {
    const m = approvedContractByProject([
      { projectId: 'P1', sector: 'construction', contractApproved: true, totalAmount: 1000 },
      { projectId: 'P1', sector: 'construction', contractApproved: true, totalAmount: 500 },
      { projectId: 'P1', sector: 'construction', contractApproved: false, totalAmount: 9999 },
      { projectId: 'P1', sector: 'subcontractor', contractApproved: true, totalAmount: 7777 },
      { projectId: 'P2', sector: 'furniture', contractApproved: true, contractValue: 300 },
      { sector: 'construction', contractApproved: true, totalAmount: 5 },   // không gắn công trình
    ]);
    expect(m.get('P1')).toBe(1500);
    expect(m.get('P2')).toBe(300);
    expect(m.size).toBe(2);
  });

  it('công trình CÓ hợp đồng đã duyệt lấy tổng đó (dù giá trị lưu cứng là 0 hay cũ); không có thì giữ giá trị lưu', () => {
    const projects = [
      { id: 'P1', name: 'A', contractValue: 0 },           // trường hợp báo lỗi: đã duyệt nhưng Giám đốc thấy 0
      { id: 'P2', name: 'B', contractValue: 136_627_200 }, // lưu cứng cũ, hợp đồng đã duyệt là số mới
      { id: 'P3', name: 'C', contractValue: 88_000_000 },  // chưa có hợp đồng duyệt → giữ nguyên
    ];
    const quotes = [
      { projectId: 'P1', sector: 'construction', contractApproved: true, totalAmount: 1_315_459_569 },
      { projectId: 'P2', sector: 'construction', contractApproved: true, totalAmount: 147_334_400 },
    ];
    const r = withApprovedContractValue(projects, quotes);
    expect(r[0].contractValue).toBe(1_315_459_569);
    expect(r[1].contractValue).toBe(147_334_400);
    expect(r[2].contractValue).toBe(88_000_000);
    expect(projects[0].contractValue).toBe(0);              // không sửa dữ liệu gốc
  });

  it('không có hợp đồng đã duyệt nào → trả lại đúng danh sách cũ (cùng tham chiếu)', () => {
    const projects = [{ id: 'P1', contractValue: 5 }];
    expect(withApprovedContractValue(projects, [])).toBe(projects);
  });
});
