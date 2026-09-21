/**
 * Bảng bóc tách khối lượng chi tiết — logic tính toán (theo mẫu file Excel "KL CHI TIẾT" + "PL HỢP ĐỒNG").
 *
 * Bảng là 1 danh sách PHẲNG các dòng, có 3 loại (kind), đọc từ trên xuống như trong Excel:
 *   - 'section' : tên phần lớn, VD "1. PHẦN THÁO DỠ"
 *   - 'item'    : hạng mục công việc (có ĐVT, đơn giá vật tư, đơn giá nhân công, hệ số)
 *   - 'line'    : dòng bóc tách chi tiết nằm dưới hạng mục (từng trục / phòng / cửa...)
 * Các dòng 'line' liền sau một 'item' thuộc về hạng mục đó.
 *
 * Công thức (giống Excel):
 *   KL dòng chi tiết = ROUND( Số BP × Dài × Rộng × Cao × S.Phụ , 3 )   (ô để trống thì bỏ qua, cho phép SỐ ÂM để trừ)
 *   KL hạng mục      = tổng KL các dòng chi tiết
 *   Đơn giá          = ROUND( (Vật tư + Nhân công) × Hệ số , 0 )
 *   Thành tiền       = ROUND( KL hạng mục × Đơn giá , 0 )
 *
 * Định mức cấp phối KHÔNG tham gia tính toán (chỉ là dữ liệu để người dùng tra cứu).
 */

export type TakeoffRowKind = 'section' | 'item' | 'line';

export interface TakeoffRow {
  id: string;
  kind: TakeoffRowKind;
  /** section/item: tên; line: vị trí/diễn giải (VD "trục 2", "- cửa") */
  name?: string;
  // ---- chỉ dùng cho 'item' ----
  unit?: string;
  vatTu?: number | null;     // đơn giá vật tư
  nhanCong?: number | null;  // đơn giá nhân công
  heSo?: number | null;      // hệ số nhân (mặc định 1,1 như file Excel); trống = 1
  // ---- chỉ dùng cho 'line' ----
  soBP?: number | null;      // số bộ phận giống nhau (cột [3])
  dai?: number | null;
  rong?: number | null;
  cao?: number | null;
  phu?: number | null;       // số phụ: nhân 2 mặt trát, quy đổi kg → tấn...
  /** id của 'item' khác: dòng này lấy KL toàn phần của hạng mục đó thay cho ô Dài (VD láng nền = lát nền) */
  refItemId?: string;
}

/** Hệ số mặc định của hạng mục mới (giống cột % = 1,1 trong file Excel) */
export const DEFAULT_HE_SO = 1.1;

// ===== MẪU BÓC TÁCH DO NGƯỜI DÙNG TỰ TẠO =====
// Mẫu = cấu trúc bảng (phần, hạng mục kèm ĐVT + đơn giá + hệ số, tên các dòng chi tiết) nhưng KHÔNG mang số đo
// của công trình cũ, để dùng lại cho nhiều công trình cùng loại.

export interface TakeoffTemplate {
  id: string;
  name: string;
  rows: TakeoffRow[];
  createdAt: string;
  createdBy?: string;
}

/** Tạo nội dung mẫu từ bảng hiện tại: giữ cấu trúc + đơn giá, xóa toàn bộ số đo và liên kết. */
export function toTemplateRows(rows: TakeoffRow[]): TakeoffRow[] {
  return rows.map(r => {
    if (r.kind === 'section') return { id: r.id, kind: 'section', name: r.name };
    if (r.kind === 'item') return { id: r.id, kind: 'item', name: r.name, unit: r.unit, vatTu: r.vatTu ?? null, nhanCong: r.nhanCong ?? null, heSo: r.heSo ?? null };
    return { id: r.id, kind: 'line', name: r.name }; // dòng chi tiết chỉ giữ diễn giải (VD "trục 2"), bỏ số đo
  });
}

/** Áp mẫu vào bảng: cấp id mới cho mọi dòng và đảm bảo mỗi hạng mục có ít nhất 1 dòng chi tiết để nhập. */
export function instantiateTemplateRows(rows: TakeoffRow[]): TakeoffRow[] {
  const stamp = Date.now();
  let n = 0;
  const nid = (k: string) => `${k}_${stamp}_${n++}`;
  const out: TakeoffRow[] = [];
  rows.forEach((r, i) => {
    out.push({ ...r, id: nid(r.kind) });
    const next = rows[i + 1];
    if (r.kind === 'item' && (!next || next.kind !== 'line')) out.push({ id: nid('line'), kind: 'line' });
  });
  return out;
}

export interface ComputedTakeoffRow extends TakeoffRow {
  stt?: number;          // số thứ tự hạng mục (tự đánh, giống COUNTA trong Excel)
  kl: number;            // line: KL từng phần | item: KL toàn phần
  donGia?: number;       // item
  thanhTien?: number;    // item
  ttVatTu?: number;      // item/section: phần thành tiền là vật tư (đã gồm hệ số)
  ttNhanCong?: number;   // item/section: phần thành tiền là nhân công (đã gồm hệ số); ttVatTu + ttNhanCong = thanhTien
  sectionTotal?: number; // section: tổng thành tiền của phần
  daiHieuLuc?: number | null; // line: giá trị Dài thực dùng (khi có liên kết hạng mục)
}

export interface TakeoffTotals {
  vatTu: number;      // Σ thành tiền vật tư (đã gồm hệ số)
  nhanCong: number;   // Σ thành tiền nhân công (đã gồm hệ số); vatTu + nhanCong = total
  total: number;      // TỔNG CỘNG (Σ thành tiền hạng mục)
  rounded: number;    // LÀM TRÒN đến nghìn
  itemCount: number;
}

const num = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

// Làm tròn "nửa ra xa số 0" giống hàm ROUND của Excel (kể cả số âm)
const round = (v: number, digits = 0) => {
  const f = Math.pow(10, digits);
  return (Math.sign(v) * Math.round(Math.abs(v) * f + 1e-9)) / f;
};

/** Lấy đơn giá vật tư / nhân công từ 1 mục của danh mục "Đơn giá vật tư & nhân công". */
export function splitCatalogPrice(p: { group?: string; avgPrice?: number; vatTu?: number | null; nhanCong?: number | null }) {
  const hasSplit = (p.vatTu ?? null) !== null || (p.nhanCong ?? null) !== null;
  if (hasSplit) return { vatTu: p.vatTu || 0, nhanCong: p.nhanCong || 0 };
  // Mục cũ chưa tách: nhóm NHÂN CÔNG → toàn bộ là nhân công, còn lại → vật tư
  return p.group === 'NHÂN CÔNG'
    ? { vatTu: 0, nhanCong: p.avgPrice || 0 }
    : { vatTu: p.avgPrice || 0, nhanCong: 0 };
}

/**
 * Chuyển dữ liệu bóc tách CŨ (mỗi hạng mục 1 dòng, có category/maDM/haoHut/price) sang định dạng mới,
 * giữ nguyên thành tiền: đơn giá cũ → vật tư, hao hụt → hệ số (1 + hao hụt%).
 * Dữ liệu đã ở định dạng mới (có 'kind') được trả về nguyên vẹn.
 */
export function normalizeTakeoffRows(raw: any): TakeoffRow[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (raw.some(r => r && r.kind)) return raw.filter(r => r && r.kind) as TakeoffRow[];

  // Bảng cũ chưa nhập số lượng nào (toàn bộ SL = 0) → coi như bảng trống
  if (raw.every((r: any) => !(num(r?.qty) && (num(r?.qty) as number) > 0))) return [];

  const out: TakeoffRow[] = [];
  const seen = new Set<string>();
  raw.forEach((r: any, idx: number) => {
    const cat = String(r.category || 'PHẦN KHÁC');
    if (!seen.has(cat)) {
      seen.add(cat);
      out.push({ id: `sec_mig_${seen.size}`, kind: 'section', name: cat });
    }
    const d = num(r.dai) ?? 0, w = num(r.rong) ?? 0, h = num(r.cao) ?? 0, qty = num(r.qty) ?? 0;
    const itemId = `it_mig_${idx}`;
    out.push({
      id: itemId, kind: 'item', name: r.name || '', unit: r.unit || '',
      vatTu: num(r.price) ?? 0, nhanCong: 0, heSo: 1 + (num(r.haoHut) ?? 0) / 100,
    });
    // Tái tạo đúng công thức KL cũ: qty ≤ 0 → KL = 0
    let line: TakeoffRow = { id: `ln_mig_${idx}`, kind: 'line', soBP: 0 };
    if (qty > 0) {
      if (r.unit === 'm³') line = { ...line, soBP: qty, dai: d, rong: w, cao: h };
      else if (r.unit === 'm²') line = { ...line, soBP: qty, dai: d, rong: w > 0 ? w : (h > 0 ? h : null) };
      else line = { ...line, soBP: qty };
    }
    out.push(line);
  });
  return out;
}

/** Tính toàn bộ bảng: KL từng dòng, KL/đơn giá/thành tiền từng hạng mục, tổng phần, tổng cộng. */
export function computeTakeoff(rows: TakeoffRow[]): { rows: ComputedTakeoffRow[]; totals: TakeoffTotals } {
  // Gom các dòng chi tiết theo hạng mục
  const linesOfItem = new Map<string, TakeoffRow[]>();
  let curItem: string | null = null;
  rows.forEach(r => {
    if (r.kind === 'item') { curItem = r.id; linesOfItem.set(r.id, []); }
    else if (r.kind === 'section') curItem = null;
    else if (r.kind === 'line' && curItem) linesOfItem.get(curItem)!.push(r);
  });

  // KL toàn phần từng hạng mục (có cache + chống vòng lặp khi liên kết chéo)
  const itemKl = new Map<string, number>();
  const visiting = new Set<string>();
  const lineKl = (l: TakeoffRow): { kl: number; dai: number | null } => {
    const dai = l.refItemId ? resolveItem(l.refItemId) : num(l.dai);
    const factors = [num(l.soBP), dai, num(l.rong), num(l.cao), num(l.phu)].filter((v): v is number => v !== null);
    // Giống PRODUCT() trong Excel: không có ô nào có số → 0
    return { kl: factors.length ? round(factors.reduce((a, b) => a * b, 1), 3) : 0, dai };
  };
  const resolveItem = (id: string): number => {
    if (itemKl.has(id)) return itemKl.get(id)!;
    if (visiting.has(id) || !linesOfItem.has(id)) return 0; // vòng lặp / không tồn tại → 0
    visiting.add(id);
    const sum = round(linesOfItem.get(id)!.reduce((a, l) => a + lineKl(l).kl, 0), 3);
    visiting.delete(id);
    itemKl.set(id, sum);
    return sum;
  };

  const totals: TakeoffTotals = { vatTu: 0, nhanCong: 0, total: 0, rounded: 0, itemCount: 0 };
  const out: ComputedTakeoffRow[] = [];
  let stt = 0;
  let sectionIdx = -1;

  rows.forEach(r => {
    if (r.kind === 'section') {
      out.push({ ...r, kl: 0, sectionTotal: 0, ttVatTu: 0, ttNhanCong: 0 });
      sectionIdx = out.length - 1;
    } else if (r.kind === 'item') {
      const kl = resolveItem(r.id);
      const vt = num(r.vatTu) ?? 0, nc = num(r.nhanCong) ?? 0, hs = num(r.heSo) ?? 1;
      const donGia = round((vt + nc) * hs, 0);
      const thanhTien = round(kl * donGia, 0);
      // Tách thành tiền thành vật tư / nhân công (hệ số áp cho cả hai); nhân công lấy phần còn lại để hai cột cộng lại đúng bằng Thành tiền
      const ttVatTu = round(kl * vt * hs, 0);
      const ttNhanCong = thanhTien - ttVatTu;
      out.push({ ...r, stt: ++stt, kl, donGia, thanhTien, ttVatTu, ttNhanCong });
      totals.vatTu += ttVatTu;
      totals.nhanCong += ttNhanCong;
      totals.total += thanhTien;
      totals.itemCount++;
      if (sectionIdx >= 0) {
        const sec = out[sectionIdx];
        sec.sectionTotal = (sec.sectionTotal || 0) + thanhTien;
        sec.ttVatTu = (sec.ttVatTu || 0) + ttVatTu;
        sec.ttNhanCong = (sec.ttNhanCong || 0) + ttNhanCong;
      }
    } else {
      const { kl, dai } = lineKl(r);
      out.push({ ...r, kl, daiHieuLuc: dai });
    }
  });

  totals.rounded = round(totals.total / 1000, 0) * 1000; // LÀM TRÒN đến nghìn như Excel
  return { rows: out, totals };
}

// ===== BẢNG TỔNG HỢP THEO TỪNG PHẦN (giống sheet "PL HỢP ĐỒNG" trong file Excel) — dùng cho Báo giá cuối cùng =====

export interface FinalSummaryItem {
  stt: number;
  name: string;
  unit: string;
  kl: number;
  donGia: number;
  ttVatTu: number;
  ttNhanCong: number;
  thanhTien: number;
}

export interface FinalSummarySection {
  id: string;
  name: string;
  items: FinalSummaryItem[];
  ttVatTu: number;
  ttNhanCong: number;
  total: number;
}

/** Gom bảng bóc tách thành các phần, mỗi phần gồm các hạng mục đã tính (không kèm dòng chi tiết). */
export function buildFinalSummary(rawRows: any): { sections: FinalSummarySection[]; totals: TakeoffTotals } {
  const { rows, totals } = computeTakeoff(normalizeTakeoffRows(rawRows));
  const sections: FinalSummarySection[] = [];
  let cur: FinalSummarySection | null = null;
  rows.forEach(r => {
    if (r.kind === 'section') {
      cur = { id: r.id, name: r.name || '', items: [], ttVatTu: 0, ttNhanCong: 0, total: 0 };
      sections.push(cur);
    } else if (r.kind === 'item') {
      // Hạng mục nằm ngoài mọi phần (dữ liệu bất thường) → gom vào phần không tên
      if (!cur) { cur = { id: 'sec_none', name: '', items: [], ttVatTu: 0, ttNhanCong: 0, total: 0 }; sections.push(cur); }
      cur.items.push({
        stt: r.stt || 0, name: r.name || '', unit: r.unit || '', kl: r.kl, donGia: r.donGia || 0,
        ttVatTu: r.ttVatTu || 0, ttNhanCong: r.ttNhanCong || 0, thanhTien: r.thanhTien || 0
      });
      cur.ttVatTu += r.ttVatTu || 0;
      cur.ttNhanCong += r.ttNhanCong || 0;
      cur.total += r.thanhTien || 0;
    }
  });
  return { sections: sections.filter(s => s.items.length > 0), totals };
}

/** Danh sách hạng mục dạng phẳng (category = tên phần, qty = KL, price = đơn giá) để hồ sơ/hợp đồng đọc lại. */
export function takeoffToFinalItems(rawRows: any) {
  return buildFinalSummary(rawRows).sections.flatMap(s =>
    s.items.map(i => ({ id: `${s.id}_${i.stt}`, category: s.name, name: i.name, unit: i.unit, qty: i.kl, price: i.donGia, note: '' }))
  );
}
