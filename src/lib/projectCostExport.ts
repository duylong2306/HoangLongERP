// ─── Xuất "Chi tiết tổng chi phí" của 1 công trình ra file Excel (.xlsx) có định dạng đẹp, đồng bộ màu LoLo ─────────────────
// Dùng exceljs (xlsx bản cộng đồng không ghi được màu/viền). exceljs nặng nên CHỈ được nạp khi bấm "Xuất Excel" (import động).
// Số tiền ghi dạng SỐ (không làm tròn, không rút gọn) với định dạng #,##0 → cộng/lọc được trong Excel và đúng từng đồng.
// File gồm 2 trang:  1) "Tổng quan"  — tổng chi phí, đã chi, còn phải chi, tiền mặt + bảng tỷ trọng từng nhóm
//                    2) "Chi tiết các khoản" — từng khoản (nhóm, tên khoản, nhà cung cấp/người nhận, ngày, số tiền, đã chi, còn lại, ghi chú)
import type { Project } from '../types';
import { COST_GROUPS, type ProjectCost, type CostItem } from './projectCost';

// Bảng màu LoLo (cùng với CLAUDE.md / design system): xanh chủ đạo, nền xanh nhạt, viền xanh nhạt
const C = {
  blue: 'FF0D47C9', blueDark: 'FF0A3AA8', soft: 'FFE8EFFF', line: 'FFBCD0FF', zebra: 'FFF6F9FF', white: 'FFFFFFFF',
  text: 'FF1E293B', mute: 'FF64748B', rose: 'FFE11D48',
};
const MONEY = '#,##0';                       // đồng, ngăn cách hàng nghìn, không số lẻ
const DATE = 'dd/mm/yyyy';

/** 'YYYY-MM-DD' → Date UTC nửa đêm (để Excel hiện đúng ngày, không lệch múi giờ). Không hiểu được → undefined. */
function ymdToDate(ymd?: string): Date | undefined {
  const m = ymd && /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : undefined;
}
const hex = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });
const thin = { style: 'thin' as const, color: { argb: C.line } };
const boxBorder = { top: thin, left: thin, bottom: thin, right: thin };

/** Tên file an toàn: Chi-phi-<mã công trình>-<YYYY-MM-DD>.xlsx */
export function costExportFileName(project: Pick<Project, 'code' | 'name'>, now: Date = new Date()): string {
  const safe = String(project.code || project.name || 'cong-trinh').replace(/[\\/:*?"<>|\s]+/g, '-').replace(/-+/g, '-');
  const p = (n: number) => String(n).padStart(2, '0');
  return `Chi-phi-${safe}-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.xlsx`;
}

/** Dựng workbook (chưa ghi ra file) — tách riêng để test được. */
export async function buildProjectCostWorkbook(project: Project, cost: ProjectCost, items: CostItem[], now: Date = new Date()) {
  const ExcelJS: any = await import('exceljs');
  const Workbook = (ExcelJS.default || ExcelJS).Workbook;
  const wb = new Workbook();
  wb.creator = 'LoLo ERP';
  wb.created = now;

  // Các nhóm có khoản, theo đúng thứ tự COST_GROUPS và sắp xếp khoản như trên màn hình (ngày mới → cũ, rồi tiền lớn → nhỏ)
  const groups = COST_GROUPS.map(g => {
    const list = items.filter(i => i.group === g.key).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.amount - a.amount);
    return { ...g, list, sum: list.reduce((s, i) => s + i.amount, 0) };
  }).filter(g => g.list.length > 0);

  const stamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  // ═══════════ TRANG 1: TỔNG QUAN ═══════════
  const ws = wb.addWorksheet('Tổng quan', { views: [{ showGridLines: false }], pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
  ws.columns = [{ width: 34 }, { width: 14 }, { width: 24 }, { width: 14 }];

  ws.mergeCells('A1:D1');
  Object.assign(ws.getCell('A1'), { value: 'CHI TIẾT TỔNG CHI PHÍ CÔNG TRÌNH', fill: hex(C.blue), font: { name: 'Arial', size: 15, bold: true, color: { argb: C.white } }, alignment: { vertical: 'middle', horizontal: 'left', indent: 1 } });
  ws.getRow(1).height = 34;
  ws.mergeCells('A2:D2');
  Object.assign(ws.getCell('A2'), { value: project.name, fill: hex(C.soft), font: { name: 'Arial', size: 12, bold: true, color: { argb: C.blueDark } }, alignment: { vertical: 'middle', wrapText: true, indent: 1 } });
  ws.getRow(2).height = 26;
  ws.mergeCells('A3:D3');
  Object.assign(ws.getCell('A3'), { value: `Mã công trình: ${project.code || '—'}   ·   Xuất ngày ${stamp}`, font: { name: 'Arial', size: 10, color: { argb: C.mute } }, alignment: { indent: 1 } });

  // Khối 4 con số chính
  const kpis: [string, number, boolean][] = [
    ['Tổng chi phí', cost.total, true], ['Đã chi', cost.paid, false], ['Còn phải chi', cost.remaining, false], ['Trong đó tiền mặt', cost.cash, false],
  ];
  let r = 5;
  kpis.forEach(([label, value, big]) => {
    ws.mergeCells(`A${r}:B${r}`);
    Object.assign(ws.getCell(`A${r}`), { value: label, fill: hex(C.soft), font: { name: 'Arial', size: 11, bold: true, color: { argb: C.blueDark } }, alignment: { vertical: 'middle', indent: 1 }, border: boxBorder });
    ws.getCell(`B${r}`).border = boxBorder;
    ws.mergeCells(`C${r}:D${r}`);
    Object.assign(ws.getCell(`C${r}`), { value: value, numFmt: `${MONEY} "đ"`, font: { name: 'Arial', size: big ? 14 : 11, bold: true, color: { argb: label === 'Đã chi' ? C.rose : C.text } }, alignment: { vertical: 'middle', horizontal: 'right' }, border: boxBorder });
    ws.getCell(`D${r}`).border = boxBorder;
    ws.getRow(r).height = big ? 30 : 24;
    r++;
  });

  // Bảng tỷ trọng các nhóm
  r += 1;
  const headRow = r;
  ['Nhóm chi phí', 'Số khoản', 'Số tiền (đ)', 'Tỷ trọng'].forEach((h, i) => {
    Object.assign(ws.getCell(r, i + 1), { value: h, fill: hex(C.blue), font: { name: 'Arial', size: 11, bold: true, color: { argb: C.white } }, alignment: { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right', indent: i === 0 ? 1 : 0 }, border: boxBorder });
  });
  ws.getRow(r).height = 24;
  r++;
  const firstGroupRow = r;
  groups.forEach((g, idx) => {
    const fill = idx % 2 ? hex(C.zebra) : hex(C.white);
    Object.assign(ws.getCell(r, 1), { value: g.label, fill, font: { name: 'Arial', size: 11, color: { argb: C.text } }, alignment: { vertical: 'middle', indent: 1 }, border: boxBorder });
    Object.assign(ws.getCell(r, 2), { value: g.list.length, fill, numFmt: '0', font: { name: 'Arial', size: 11 }, alignment: { horizontal: 'right' }, border: boxBorder });
    Object.assign(ws.getCell(r, 3), { value: g.sum, fill, numFmt: MONEY, font: { name: 'Arial', size: 11, bold: true }, alignment: { horizontal: 'right' }, border: boxBorder });
    // Tỷ trọng = số tiền nhóm / tổng chi phí (ghi số thật, định dạng %) — tính bằng công thức để đổi số liệu thì tự cập nhật
    Object.assign(ws.getCell(r, 4), { value: { formula: `IF($C$${firstGroupRow + groups.length}=0,0,C${r}/$C$${firstGroupRow + groups.length})`, result: cost.total > 0 ? g.sum / cost.total : 0 }, fill, numFmt: '0.0%', font: { name: 'Arial', size: 11, color: { argb: C.mute } }, alignment: { horizontal: 'right' }, border: boxBorder });
    ws.getRow(r).height = 22;
    r++;
  });
  // Dòng cộng
  const totalRow = r;
  Object.assign(ws.getCell(r, 1), { value: 'TỔNG CỘNG', fill: hex(C.soft), font: { name: 'Arial', size: 11, bold: true, color: { argb: C.blueDark } }, alignment: { vertical: 'middle', indent: 1 }, border: boxBorder });
  Object.assign(ws.getCell(r, 2), { value: groups.length ? { formula: `SUM(B${firstGroupRow}:B${r - 1})`, result: groups.reduce((s, g) => s + g.list.length, 0) } : 0, fill: hex(C.soft), numFmt: '0', font: { name: 'Arial', size: 11, bold: true }, alignment: { horizontal: 'right' }, border: boxBorder });
  Object.assign(ws.getCell(r, 3), { value: groups.length ? { formula: `SUM(C${firstGroupRow}:C${r - 1})`, result: groups.reduce((s, g) => s + g.sum, 0) } : 0, fill: hex(C.soft), numFmt: MONEY, font: { name: 'Arial', size: 11, bold: true, color: { argb: C.blueDark } }, alignment: { horizontal: 'right' }, border: boxBorder });
  Object.assign(ws.getCell(r, 4), { value: groups.length ? { formula: `SUM(D${firstGroupRow}:D${r - 1})`, result: cost.total > 0 ? 1 : 0 } : 0, fill: hex(C.soft), numFmt: '0.0%', font: { name: 'Arial', size: 11, bold: true }, alignment: { horizontal: 'right' }, border: boxBorder });
  ws.getRow(r).height = 24;
  void headRow; void totalRow;

  ws.mergeCells(`A${r + 2}:D${r + 2}`);
  Object.assign(ws.getCell(`A${r + 2}`), { value: 'Tổng chi phí = đã chi + còn phải chi. Số liệu lấy từ Phòng Dự án → Tổng chi phí; chi tiết từng khoản xem trang "Chi tiết các khoản".', font: { name: 'Arial', size: 9, italic: true, color: { argb: C.mute } }, alignment: { wrapText: true, vertical: 'top', indent: 1 } });
  ws.getRow(r + 2).height = 28;

  // ═══════════ TRANG 2: CHI TIẾT CÁC KHOẢN ═══════════
  const wd = wb.addWorksheet('Chi tiết các khoản', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
  wd.columns = [{ width: 6 }, { width: 22 }, { width: 40 }, { width: 36 }, { width: 13 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];

  wd.mergeCells('A1:I1');
  Object.assign(wd.getCell('A1'), { value: `CHI TIẾT CÁC KHOẢN CHI PHÍ — ${project.name}`, fill: hex(C.blue), font: { name: 'Arial', size: 14, bold: true, color: { argb: C.white } }, alignment: { vertical: 'middle', indent: 1 } });
  wd.getRow(1).height = 32;
  wd.mergeCells('A2:I2');
  Object.assign(wd.getCell('A2'), { value: `Mã công trình: ${project.code || '—'}   ·   Xuất ngày ${stamp}   ·   ${items.length} khoản`, font: { name: 'Arial', size: 10, color: { argb: C.mute } }, alignment: { indent: 1 } });
  wd.getRow(3).height = 6;
  const heads = ['STT', 'Nhóm', 'Khoản chi', 'Nhà cung cấp / người nhận / ghi chú', 'Ngày', 'Số tiền (đ)', 'Đã chi (đ)', 'Còn phải chi (đ)', 'Trạng thái'];
  heads.forEach((h, i) => {
    Object.assign(wd.getCell(4, i + 1), { value: h, fill: hex(C.blue), font: { name: 'Arial', size: 11, bold: true, color: { argb: C.white } }, alignment: { vertical: 'middle', horizontal: i >= 5 && i <= 7 ? 'right' : i === 0 || i === 4 ? 'center' : 'left', wrapText: true, indent: i === 1 || i === 2 || i === 3 || i === 8 ? 1 : 0 }, border: boxBorder });
  });
  wd.getRow(4).height = 26;

  let row = 5; let stt = 1;
  groups.forEach(g => {
    g.list.forEach(it => {
      const fill = (stt % 2 === 0) ? hex(C.zebra) : hex(C.white);
      const date = ymdToDate(it.date);
      // "Đã chi" của nhóm Chờ duyệt = 0 (chưa chi); các nhóm khác lấy theo khoản
      const paid = g.key === 'pending' ? 0 : it.paid;
      const base = { fill, font: { name: 'Arial', size: 10.5, color: { argb: C.text } }, border: boxBorder };
      Object.assign(wd.getCell(row, 1), { ...base, value: stt, alignment: { horizontal: 'center', vertical: 'top' } });
      Object.assign(wd.getCell(row, 2), { ...base, value: g.label, font: { name: 'Arial', size: 10.5, bold: true, color: { argb: C.blueDark } }, alignment: { vertical: 'top', wrapText: true, indent: 1 } });
      Object.assign(wd.getCell(row, 3), { ...base, value: it.title, alignment: { vertical: 'top', wrapText: true, indent: 1 } });
      Object.assign(wd.getCell(row, 4), { ...base, value: it.sub || '', alignment: { vertical: 'top', wrapText: true, indent: 1 } });
      Object.assign(wd.getCell(row, 5), { ...base, value: date ?? '', numFmt: DATE, alignment: { horizontal: 'center', vertical: 'top' } });
      Object.assign(wd.getCell(row, 6), { ...base, value: it.amount, numFmt: MONEY, font: { name: 'Arial', size: 10.5, bold: true, color: { argb: C.text } }, alignment: { horizontal: 'right', vertical: 'top' } });
      Object.assign(wd.getCell(row, 7), { ...base, value: paid, numFmt: MONEY, alignment: { horizontal: 'right', vertical: 'top' } });
      Object.assign(wd.getCell(row, 8), { ...base, value: { formula: `F${row}-G${row}`, result: it.amount - paid }, numFmt: MONEY, alignment: { horizontal: 'right', vertical: 'top' } });
      Object.assign(wd.getCell(row, 9), { ...base, value: it.tag || '', alignment: { vertical: 'top', wrapText: true, indent: 1 } });
      row++; stt++;
    });
  });
  const lastDataRow = row - 1;
  // Dòng TỔNG CỘNG cuối bảng (công thức SUM + kèm kết quả để mở bằng trình xem trước vẫn thấy số)
  const sumAmt = items.reduce((s, i) => s + i.amount, 0);
  const sumPaid = items.reduce((s, i) => s + (i.group === 'pending' ? 0 : i.paid), 0);
  wd.mergeCells(`A${row}:E${row}`);
  Object.assign(wd.getCell(`A${row}`), { value: 'TỔNG CỘNG', fill: hex(C.soft), font: { name: 'Arial', size: 11, bold: true, color: { argb: C.blueDark } }, alignment: { vertical: 'middle', indent: 1 }, border: boxBorder });
  for (let c = 2; c <= 5; c++) wd.getCell(row, c).border = boxBorder;
  const totals: [number, string, number][] = [[6, 'F', sumAmt], [7, 'G', sumPaid], [8, 'H', sumAmt - sumPaid]];
  totals.forEach(([col, letter, result]) => {
    Object.assign(wd.getCell(row, col), { value: lastDataRow >= 5 ? { formula: `SUM(${letter}5:${letter}${lastDataRow})`, result } : 0, fill: hex(C.soft), numFmt: MONEY, font: { name: 'Arial', size: 11, bold: true, color: { argb: C.blueDark } }, alignment: { horizontal: 'right', vertical: 'middle' }, border: boxBorder });
  });
  Object.assign(wd.getCell(row, 9), { value: '', fill: hex(C.soft), border: boxBorder });
  wd.getRow(row).height = 24;
  if (lastDataRow >= 5) wd.autoFilter = { from: { row: 4, column: 1 }, to: { row: lastDataRow, column: 9 } };

  return wb;
}

/** Dựng file rồi tải xuống trình duyệt. */
export async function downloadProjectCostXlsx(project: Project, cost: ProjectCost, items: CostItem[]): Promise<void> {
  const wb = await buildProjectCostWorkbook(project, cost, items);
  const buf: ArrayBuffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = costExportFileName(project);
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
