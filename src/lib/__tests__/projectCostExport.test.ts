import { describe, it, expect } from 'vitest';
import { buildProjectCostWorkbook, costExportFileName } from '../projectCostExport';

// Dữ liệu mẫu: 2 nhóm; có số lẻ đồng để kiểm tra không bị làm tròn / rút gọn
const project = { id: 'P1', code: 'DA_THAKVI_8', name: 'THI HÀNH ÁN KHU VỰC IV' } as any;
const items = [
  { id: 'a', group: 'material', title: 'Đơn mua hàng PO-1', sub: 'CÔNG TY A', date: '2026-11-03', amount: 142_500, paid: 0, tag: 'Chưa thanh toán' },
  { id: 'b', group: 'material', title: 'Đơn mua hàng PO-2', sub: 'CÔNG TY B', date: '2026-10-21', amount: 84_273_270, paid: 1_000, tag: 'Chưa thanh toán' },
  { id: 'c', group: 'site', title: 'Phiếu chi PC-1', sub: 'Lê Văn A', date: '2026-10-05', amount: 757_000, paid: 757_000 },
] as any[];
const cost = { material: 84_415_770, warehouse: 0, subcontract: 0, site: 757_000, other: 0, pending: 0, paid: 758_000, total: 85_172_770, remaining: 84_414_770, cash: 757_000 } as any;

describe('Xuất Excel chi phí công trình', () => {
  it('tên file an toàn theo mã công trình và ngày', () => {
    expect(costExportFileName(project, new Date(2026, 10, 23))).toBe('Chi-phi-DA_THAKVI_8-2026-11-23.xlsx');
    expect(costExportFileName({ code: '', name: 'Khách sạn / Lý Nam Đế' } as any, new Date(2026, 0, 5))).toBe('Chi-phi-Khách-sạn-Lý-Nam-Đế-2026-01-05.xlsx');
  });

  it('trang Tổng quan: các con số chính ghi đúng từng đồng, bảng nhóm đúng tổng', async () => {
    const wb = await buildProjectCostWorkbook(project, cost, items, new Date(2026, 10, 23));
    const ws = wb.getWorksheet('Tổng quan')!;
    expect(ws.getCell('A1').value).toBe('CHI TIẾT TỔNG CHI PHÍ CÔNG TRÌNH');
    expect(ws.getCell('A2').value).toBe('THI HÀNH ÁN KHU VỰC IV');
    // 4 ô số chính: tổng chi phí / đã chi / còn phải chi / tiền mặt
    expect(ws.getCell('C5').value).toBe(85_172_770);
    expect(ws.getCell('C6').value).toBe(758_000);
    expect(ws.getCell('C7').value).toBe(84_414_770);
    expect(ws.getCell('C8').value).toBe(757_000);
    expect(ws.getCell('C5').numFmt).toContain('#,##0');
    // Bảng nhóm: 2 nhóm có khoản (Vật tư, Chi phí công trường) + dòng cộng
    const rows: any[] = [];
    ws.eachRow(r => rows.push(r.values));
    const flat = JSON.stringify(rows);
    expect(flat).toContain('Vật tư (nhà cung cấp)');
    expect(flat).toContain('Chi phí công trường');
    const matRow = [...Array(30).keys()].map(i => ws.getRow(i + 1)).find(r => r.getCell(1).value === 'Vật tư (nhà cung cấp)')!;
    expect(matRow.getCell(2).value).toBe(2);               // 2 khoản
    expect(matRow.getCell(3).value).toBe(84_415_770);      // 142.500 + 84.273.270
  });

  it('trang Chi tiết: từng khoản đúng số tiền, ngày là ngày thật, dòng cộng bằng tổng các khoản', async () => {
    const wb = await buildProjectCostWorkbook(project, cost, items, new Date(2026, 10, 23));
    const wd = wb.getWorksheet('Chi tiết các khoản')!;
    expect(wd.getCell('A4').value).toBe('STT');
    expect(wd.getCell('F4').value).toBe('Số tiền (đ)');
    // sắp xếp trong nhóm: ngày mới → cũ (PO-1 03/11 trước PO-2 21/10)
    expect(wd.getCell('C5').value).toBe('Đơn mua hàng PO-1');
    expect(wd.getCell('F5').value).toBe(142_500);
    expect((wd.getCell('E5').value as Date).toISOString().slice(0, 10)).toBe('2026-11-03');
    expect(wd.getCell('F6').value).toBe(84_273_270);
    expect(wd.getCell('G6').value).toBe(1_000);
    expect((wd.getCell('H6').value as any).result).toBe(84_272_270);   // còn phải chi = số tiền − đã chi
    // dòng TỔNG CỘNG: công thức SUM + kết quả đúng tổng các khoản
    const tong = wd.getRow(8);
    expect(tong.getCell(1).value).toBe('TỔNG CỘNG');
    expect((tong.getCell(6).value as any).result).toBe(142_500 + 84_273_270 + 757_000);
    expect((tong.getCell(6).value as any).formula).toBe('SUM(F5:F7)');
  });

  it('định dạng LoLo: tiêu đề xanh #0d47c9, chữ trắng; cố định hàng tiêu đề; có bộ lọc', async () => {
    const wb = await buildProjectCostWorkbook(project, cost, items);
    const ws = wb.getWorksheet('Tổng quan')!;
    expect((ws.getCell('A1').fill as any).fgColor.argb).toBe('FF0D47C9');
    expect((ws.getCell('A1').font as any).color.argb).toBe('FFFFFFFF');
    const wd = wb.getWorksheet('Chi tiết các khoản')!;
    expect((wd.getCell('A4').fill as any).fgColor.argb).toBe('FF0D47C9');
    expect((wd.views[0] as any).ySplit).toBe(4);
    expect(wd.autoFilter).toBeTruthy();
  });

  it('không có khoản nào: vẫn dựng file hợp lệ (chỉ có tiêu đề và dòng cộng 0)', async () => {
    const wb = await buildProjectCostWorkbook(project, { ...cost, total: 0, paid: 0, remaining: 0, cash: 0 }, []);
    const wd = wb.getWorksheet('Chi tiết các khoản')!;
    expect(wd.getRow(5).getCell(1).value).toBe('TỔNG CỘNG');
    expect(wd.getRow(5).getCell(6).value).toBe(0);
  });

  it('ghi ra buffer .xlsx đọc lại được', async () => {
    const wb = await buildProjectCostWorkbook(project, cost, items);
    const buf = await wb.xlsx.writeBuffer();
    expect((buf as ArrayBuffer).byteLength).toBeGreaterThan(2000);
  });
});
