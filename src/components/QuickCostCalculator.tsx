import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, ChevronDown, ChevronUp, Plus, Trash2, RotateCcw } from 'lucide-react';

/**
 * CÔNG CỤ TÍNH NHANH GIÁ BÁN — dùng chung cho Lập Báo Giá Nội Thất & Cơ Khí.
 * (Chuyển từ file Excel "CÔNG CỤ TÍNH NHANH - ÁP DỤNG CHO CẢ NỘI THẤT VÀ CƠ KHÍ".)
 *
 * Cách tính (giữ đúng công thức Excel gốc):
 *   Thành tiền từng dòng = Số lượng × Đơn giá
 *   TỔNG NVL             = Σ thành tiền
 *   Nhân công / Phụ kiện / Hao hụt = TỔNG NVL × tỉ lệ (%)
 *   Lợi nhuận            = (NVL + Nhân công + Phụ kiện + Hao hụt) × tỉ lệ lợi nhuận
 *   GIÁ BÁN              = NVL + Nhân công + Phụ kiện + Hao hụt + Lợi nhuận
 *
 * Lưu ý: ở file Excel gốc ô Lợi nhuận đang gõ cứng 15% trong công thức (không đọc
 * ô tỉ lệ) — ở đây dùng đúng ô tỉ lệ đang nhập để "tỉ lệ có thể thay đổi" đúng
 * như ghi chú của file gốc.
 */

interface CalcRow {
  id: number;
  name: string;
  qty: string;   // giữ dạng chuỗi để người dùng gõ dở (vd "2.") không bị mất
  unit: string;
  price: number; // VNĐ, số nguyên
}

interface CalcRates {
  labor: string;
  accessory: string;
  waste: string;
  profit: string;
}

const STORAGE_KEY = 'hl_quick_cost_calc';
const SEEN_KEY = 'hl_quick_cost_calc_seen';
const DEFAULT_ROW_COUNT = 1; // Mặc định gọn 1 dòng, bấm "Thêm dòng vật tư" khi cần thêm
const DEFAULT_RATES: CalcRates = { labor: '35', accessory: '15', waste: '5', profit: '15' };

const makeRows = (count: number): CalcRow[] =>
  Array.from({ length: count }, (_, i) => ({ id: i + 1, name: '', qty: '', unit: '', price: 0 }));

const toNum = (s: string): number => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const fmt = (n: number): string => Math.round(n).toLocaleString('vi-VN');

// Đọc dữ liệu đã lưu — bọc try/catch vì localStorage có thể bị chặn/hỏng
const loadSaved = (): { rows: CalcRow[]; rates: CalcRates } => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p.rows) && p.rows.length > 0 && p.rates) {
        return { rows: p.rows, rates: { ...DEFAULT_RATES, ...p.rates } };
      }
    }
  } catch {}
  return { rows: makeRows(DEFAULT_ROW_COUNT), rates: { ...DEFAULT_RATES } };
};

export default function QuickCostCalculator() {
  // Mặc định THU GỌN (theo yêu cầu) — chỉ nhớ dữ liệu nhập, không nhớ trạng thái mở
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CalcRow[]>(() => loadSaved().rows);
  const [rates, setRates] = useState<CalcRates>(() => loadSaved().rates);
  // Nhãn "MỚI" chỉ hiện tới khi người dùng mở công cụ lần đầu
  const [seen, setSeen] = useState<boolean>(() => {
    try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
  });

  // Lưu lại dữ liệu nhập để không mất khi chuyển tab con / tải lại trang
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, rates })); } catch {}
  }, [rows, rates]);

  const calc = useMemo(() => {
    const lineTotals = rows.map(r => toNum(r.qty) * (r.price || 0));
    const nvl = lineTotals.reduce((s, v) => s + v, 0);
    const labor = nvl * (toNum(rates.labor) / 100);
    const accessory = nvl * (toNum(rates.accessory) / 100);
    const waste = nvl * (toNum(rates.waste) / 100);
    const profit = (nvl + labor + accessory + waste) * (toNum(rates.profit) / 100);
    const total = nvl + labor + accessory + waste + profit;
    return { lineTotals, nvl, labor, accessory, waste, profit, total };
  }, [rows, rates]);

  const toggle = () => {
    setOpen(o => !o);
    if (!seen) {
      setSeen(true);
      try { localStorage.setItem(SEEN_KEY, '1'); } catch {}
    }
  };

  const updateRow = (id: number, patch: Partial<CalcRow>) =>
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows(prev => [...prev, { id: Math.max(0, ...prev.map(r => r.id)) + 1, name: '', qty: '', unit: '', price: 0 }]);

  const removeRow = (id: number) =>
    setRows(prev => (prev.length <= 1 ? prev : prev.filter(r => r.id !== id)));

  const resetAll = () => {
    if (!window.confirm('Xóa toàn bộ dữ liệu đã nhập trong công cụ tính nhanh và đặt lại các tỉ lệ mặc định?')) return;
    setRows(makeRows(DEFAULT_ROW_COUNT));
    setRates({ ...DEFAULT_RATES });
  };

  const hasData = calc.nvl > 0;

  // Các dòng tỉ lệ: nhãn + trường dữ liệu + cơ sở tính (để hiển thị gợi ý)
  const rateLines: { key: keyof CalcRates; label: string; value: number; hint: string }[] = [
    { key: 'labor', label: 'Nhân công', value: calc.labor, hint: 'trên tổng NVL' },
    { key: 'accessory', label: 'Phụ kiện', value: calc.accessory, hint: 'trên tổng NVL' },
    { key: 'waste', label: 'Hao hụt', value: calc.waste, hint: 'trên tổng NVL' },
  ];

  return (
    // Viền gradient amber→cam để công cụ nổi bật ngay cả khi đang thu gọn
    <div className="rounded-2xl p-[1.5px] bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 shadow-md shadow-amber-500/20 mb-4 text-left">
      <div className="bg-white rounded-[15px] overflow-hidden">
        {/* THANH TIÊU ĐỀ — bấm để mở rộng / thu gọn */}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30 shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                  Công cụ tính nhanh giá bán
                </h4>
                {!seen && (
                  <span className="relative inline-flex items-center gap-1 text-[9px] font-black text-white bg-rose-500 rounded-full px-2 py-0.5">
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                    </span>
                    MỚI
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Nhập vật tư → tự cộng nhân công, phụ kiện, hao hụt, lợi nhuận để ra giá bán. Dùng cho cả nội thất và cơ khí.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Khi thu gọn mà đã có số liệu → hiện luôn giá bán để khỏi phải mở */}
            {!open && hasData && (
              <div className="text-right hidden sm:block">
                <div className="text-[9px] font-bold text-slate-500 uppercase">Giá bán</div>
                <div className="text-sm font-black text-orange-600 font-mono">{fmt(calc.total)} đ</div>
              </div>
            )}
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-white border border-amber-300 rounded-full px-2.5 py-1">
              {open ? <>Thu gọn <ChevronUp className="w-3.5 h-3.5" /></> : <>Mở rộng <ChevronDown className="w-3.5 h-3.5" /></>}
            </span>
          </div>
        </button>

        {/* NỘI DUNG CÔNG CỤ */}
        {open && (
          <div className="p-4 space-y-4 border-t border-amber-200">
            {/* BẢNG VẬT TƯ */}
            <div className="overflow-x-auto">
              <div className="min-w-[620px]">
                <div className="grid grid-cols-[32px_1fr_80px_64px_120px_120px_32px] gap-2 px-1 pb-1.5 text-[10px] font-bold text-slate-500 uppercase">
                  <div className="text-center">Stt</div>
                  <div>Tên vật tư</div>
                  <div className="text-right">Số lượng</div>
                  <div>ĐVT</div>
                  <div className="text-right">Đơn giá</div>
                  <div className="text-right">Thành tiền</div>
                  <div />
                </div>
                <div className="space-y-1.5">
                  {rows.map((r, i) => (
                    <div key={r.id} className="grid grid-cols-[32px_1fr_80px_64px_120px_120px_32px] gap-2 items-center">
                      <div className="text-center text-[11px] text-slate-400 font-bold">{i + 1}</div>
                      <input
                        type="text"
                        value={r.name}
                        onChange={(e) => updateRow(r.id, { name: e.target.value })}
                        placeholder="Tên vật tư..."
                        className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-slate-800 outline-none focus:border-amber-500"
                      />
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={r.qty}
                        onChange={(e) => updateRow(r.id, { qty: e.target.value })}
                        placeholder="0"
                        className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-[11px] text-right text-slate-800 outline-none focus:border-amber-500"
                      />
                      <input
                        type="text"
                        value={r.unit}
                        onChange={(e) => updateRow(r.id, { unit: e.target.value })}
                        placeholder="ĐVT"
                        className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-[11px] text-slate-800 outline-none focus:border-amber-500"
                      />
                      {/* Đơn giá: hiển thị có dấu chấm phân cách nghìn, chỉ nhận chữ số */}
                      <input
                        type="text"
                        inputMode="numeric"
                        value={r.price ? r.price.toLocaleString('vi-VN') : ''}
                        onChange={(e) => updateRow(r.id, { price: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 })}
                        placeholder="0"
                        className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-[11px] text-right text-slate-800 outline-none focus:border-amber-500 font-mono"
                      />
                      <div className="text-right text-[11px] font-bold text-slate-700 font-mono px-1">
                        {calc.lineTotals[i] > 0 ? fmt(calc.lineTotals[i]) : '—'}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRow(r.id)}
                        disabled={rows.length <= 1}
                        title="Xóa dòng"
                        className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg px-3 py-1.5 cursor-pointer transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm dòng vật tư
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 cursor-pointer transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Làm mới
              </button>
            </div>

            {/* TỔNG HỢP: NVL → phụ phí → lợi nhuận → giá bán */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 max-w-xl ml-auto">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600 uppercase">Tổng NVL</span>
                <span className="font-black text-slate-800 font-mono">{fmt(calc.nvl)} đ</span>
              </div>

              {rateLines.map(l => (
                <div key={l.key} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-600 uppercase w-20">{l.label}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={rates[l.key]}
                        onChange={(e) => setRates(prev => ({ ...prev, [l.key]: e.target.value }))}
                        className="w-16 bg-white border border-slate-300 rounded-lg p-1 text-[11px] text-right text-slate-800 outline-none focus:border-amber-500"
                      />
                      <span className="text-[10px] text-slate-500">% {l.hint}</span>
                    </div>
                  </div>
                  <span className="font-bold text-slate-700 font-mono">{fmt(l.value)} đ</span>
                </div>
              ))}

              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-600 uppercase w-20">Lợi nhuận</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={rates.profit}
                      onChange={(e) => setRates(prev => ({ ...prev, profit: e.target.value }))}
                      className="w-16 bg-white border border-slate-300 rounded-lg p-1 text-[11px] text-right text-slate-800 outline-none focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-500">% trên (NVL + nhân công + phụ kiện + hao hụt)</span>
                  </div>
                </div>
                <span className="font-bold text-slate-700 font-mono">{fmt(calc.profit)} đ</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-300">
                <span className="font-black text-slate-800 text-xs uppercase">Tổng cộng / Giá bán</span>
                <span className="font-black text-lg text-orange-600 font-mono">{fmt(calc.total)} đ</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
