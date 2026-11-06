import React, { useState, useMemo } from 'react';
import { Calculator, Download, Pencil, Search, Lock } from 'lucide-react';
import { PayrollItem } from '../hrTypes';

interface PayrollTabProps {
  payroll: PayrollItem[];
  employees?: any[];
  payrollMonth: string;
  setPayrollMonth: (v: string) => void;
  payrollYear: string;
  setPayrollYear: (v: string) => void;
  standardWorkDays: number;
  setStandardWorkDays: (v: number) => void;
  payrollViewMode: 'summary' | 'detail';
  setPayrollViewMode: (v: 'summary' | 'detail') => void;
  globalPageSize: number | 'all';
  setGlobalPageSize: (v: number | 'all') => void;
  payrollPage: number;
  setPayrollPage: (v: number | ((prev: number) => number)) => void;
  handleCalculatePayroll: () => void;
  handleExportPayrollExcel: () => void;
  handleOpenEditPayroll: (pay: PayrollItem) => void;
  triggerDownloadPayslip: (pay: PayrollItem) => void;
  handleLockPayrollPeriod: () => void;
  handleDownloadAllPayslips: () => void;
  addToast: (msg: { title: string; message: string; type?: 'success' | 'info' | 'warning' | 'error'; duration?: number }) => void;
}

export default function PayrollTab({
  payroll,
  employees,
  payrollMonth,
  setPayrollMonth,
  payrollYear,
  setPayrollYear,
  standardWorkDays,
  setStandardWorkDays,
  payrollViewMode,
  setPayrollViewMode,
  globalPageSize,
  setGlobalPageSize,
  payrollPage,
  setPayrollPage,
  handleCalculatePayroll,
  handleExportPayrollExcel,
  handleOpenEditPayroll,
  triggerDownloadPayslip,
  handleLockPayrollPeriod,
  handleDownloadAllPayslips,
  addToast,
}: PayrollTabProps) {
  const [payrollNameSearch, setPayrollNameSearch] = useState('');
  const [showNameSuggest, setShowNameSuggest] = useState(false);
  // Dòng đang mở phần chi tiết (lương gốc, tạm ứng, bảo hiểm, thuế…) ở chế độ Tóm tắt
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Chuẩn hóa về chữ thường, bỏ dấu để tìm kiếm gần đúng (không phân biệt dấu/hoa thường).
  const normStr = (s: string) =>
    String(s || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();

  // Lọc kết quả theo Kỳ lương (tháng/năm) VÀ theo tên nhân viên (tìm gần đúng),
  // sau đó sắp xếp theo mã nhân viên (empId) theo thứ tự số tự nhiên.
  const empIdNum = (id: string) => {
    const m = String(id || '').match(/(\d+)/);
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
  };
  const filteredPayroll = (payroll || [])
    .filter((p: any) => {
      const monthOk = p.month === `${payrollMonth}/${payrollYear}`;
      const q = payrollNameSearch.trim();
      const nameOk = !q || normStr(p.empName).includes(normStr(q));
      return monthOk && nameOk;
    })
    .sort((a: any, b: any) => {
      const na = empIdNum(a.empId);
      const nb = empIdNum(b.empId);
      if (na !== nb) return na - nb;
      return String(a.empId).localeCompare(String(b.empId));
    });

  // Toàn bộ payroll của kỳ đang chọn (KHÔNG lọc theo tên tìm kiếm) — dùng để
  // xác định kỳ này đã "Khóa kỳ & Phát phiếu lương" hay chưa.
  const periodPayrollAll = (payroll || []).filter((p: any) => p.month === `${payrollMonth}/${payrollYear}`);
  const periodLocked = periodPayrollAll.length > 0 && periodPayrollAll.every((p: any) => p.locked);

  // Tổng cộng theo bộ lọc hiện tại (kỳ lương + tên nhân viên) — tính trên TOÀN BỘ
  // danh sách đã lọc (filteredPayroll), không phải chỉ trang đang xem, giống cách
  // tab "Công nợ Trả" (Tài Chính - Kế Toán) tính tổng ở dòng cuối bảng.
  const payrollTotals = useMemo(() => {
    return filteredPayroll.reduce((acc: any, p: any) => {
      acc.baseSalary += p.baseSalary || 0;
      acc.dailyWage += Math.round(((p.baseSalary || 0) / standardWorkDays) * (p.workedDays || 0));
      acc.kpiBonus += p.kpiBonus || 0;
      // Trước đây đọc otWeekendSalary/totalOtHoursSalary — 2 field KHÔNG tồn tại
      // trong dữ liệu tính lương thực tế (calculateSingleEmployeePayroll trả về
      // otSundaySalary/otHolidaySalary/otHoursSalary) nên cột "Tăng ca (H)" luôn
      // hiện 0đ dù nhân viên có tăng ca thật.
      acc.otAmount += (p.otSundaySalary || 0) + (p.otHolidaySalary || 0) + (p.otHoursSalary || 0);
      acc.advances += p.advances || 0;
      acc.insurance += p.insurance || 0;
      acc.tax += p.tax || 0;
      acc.netSalary += p.netSalary || 0;
      return acc;
    }, { baseSalary: 0, dailyWage: 0, kpiBonus: 0, otAmount: 0, advances: 0, insurance: 0, tax: 0, netSalary: 0 });
  }, [filteredPayroll, standardWorkDays]);

  // Gợi ý nhân viên (từ danh sách employees) khớp gần đúng với từ khoá đang nhập.
  const nameSuggestions = !payrollNameSearch.trim()
    ? []
    : (employees || [])
        .filter((e: any) => e && normStr(e.name).includes(normStr(payrollNameSearch.trim())))
        .slice(0, 10);

  // ── Hiển thị dùng chung ──
  const money = (n?: number) => `${(n || 0).toLocaleString('vi-VN')} đ`;
  const dailyWageOf = (p: any) => Math.round(((p.baseSalary || 0) / standardWorkDays) * (p.workedDays || 0));
  const otOf = (p: any) => (p.otSundaySalary || 0) + (p.otHolidaySalary || 0) + (p.otHoursSalary || 0);
  const deductOf = (p: any) => (p.advances || 0) + (p.insurance || 0) + (p.tax || 0);
  const positionOf = (empId: string) => (employees || []).find((e: any) => e.id === empId)?.position || '';
  const PILL = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap';
  const inputCls = 'h-9 bg-white border border-slate-200 text-slate-800 rounded-xl px-2.5 text-[13px] font-bold outline-none focus:border-blue-400';
  const iconBtn = 'w-8 h-8 inline-flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer';
  const pageSizeNum = globalPageSize === 'all' ? 0 : (globalPageSize as number);
  const totalPages = pageSizeNum ? Math.ceil(filteredPayroll.length / pageSizeNum) : 1;
  const startIndex = pageSizeNum ? (payrollPage - 1) * pageSizeNum : 0;
  const paginated = pageSizeNum ? filteredPayroll.slice(startIndex, startIndex + pageSizeNum) : filteredPayroll;

  // Nút thao tác theo từng dòng: Sửa (ghi đè công/KPI/thưởng/khấu trừ) + Phiếu lương PDF
  const RowActions = ({ pay }: { pay: PayrollItem }) => (
    <div className="inline-flex items-center gap-1.5">
      <button type="button" className={iconBtn} title="Chỉnh sửa chi tiết" aria-label="Chỉnh sửa chi tiết" data-testid={`payroll-edit-${pay.id}`}
        onClick={(e) => { e.stopPropagation(); handleOpenEditPayroll(pay); }}><Pencil className="w-3.5 h-3.5" /></button>
      <button type="button" className={iconBtn} title="In phiếu lương PDF" aria-label="In phiếu lương PDF" data-testid={`payroll-slip-${pay.id}`}
        onClick={(e) => { e.stopPropagation(); triggerDownloadPayslip(pay); }}><Download className="w-3.5 h-3.5" /></button>
    </div>
  );
  // Phần chi tiết mở ra khi bấm dòng (chế độ Tóm tắt)
  const Breakdown = ({ pay }: { pay: any }) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs" data-testid={`payroll-detail-${pay.id}`}>
      {([['Lương gốc', money(pay.baseSalary)], ['Tạm ứng', `-${money(pay.advances)}`], ['Bảo hiểm (10.5%)', `-${money(pay.insurance)}`], ['Thuế TNCN', `-${money(pay.tax)}`]] as const).map(([k, v]) => (
        <div key={k}><div className="text-slate-500">{k}</div><div className="font-mono font-bold text-slate-800">{v}</div></div>
      ))}
    </div>
  );

  const tiles: Array<[string, string, string, string]> = [
    ['Nhân viên', String(filteredPayroll.length), '#334155', 'Số nhân viên trong kỳ đang lọc'],
    ['Lương công nhật', money(payrollTotals.dailyWage), '#334155', 'Tổng lương theo ngày công thực tế'],
    ['Tăng ca', money(payrollTotals.otAmount), '#b45309', 'Tổng tiền tăng ca (Chủ nhật, lễ, ngoài giờ)'],
    ['Khấu trừ', money(payrollTotals.advances + payrollTotals.insurance + payrollTotals.tax), '#be123c', 'Tạm ứng + bảo hiểm + thuế TNCN'],
    ['Thực lĩnh', money(payrollTotals.netSalary), '#0d47c9', 'Thực lĩnh = Lương công + Phụ cấp + Tăng ca − Tạm ứng − Khấu trừ'],
  ];

  return (
    <div className="space-y-3" data-testid="payroll-root">
      {/* ── THANH CÔNG CỤ: tìm nhân viên + kỳ lương + công chuẩn; nút chính (xanh LoLo) là "Tính lương tự động" ── */}
      <div className="flex flex-wrap items-center gap-2" data-testid="payroll-toolbar">
        <div className="relative flex-1 min-w-[160px]">
          <div className="flex items-center gap-2 h-9 px-3 bg-white border border-slate-200 rounded-xl">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input type="text" value={payrollNameSearch} data-testid="payroll-search"
              onChange={(e) => { setPayrollNameSearch(e.target.value); setPayrollPage(1); setShowNameSuggest(true); }}
              onFocus={() => setShowNameSuggest(true)}
              onBlur={() => setTimeout(() => setShowNameSuggest(false), 150)}
              placeholder="Tìm tên nhân viên"
              className="flex-1 min-w-0 bg-transparent text-[13px] border-none outline-none text-slate-800 placeholder-slate-400" />
          </div>
          {showNameSuggest && nameSuggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              {nameSuggestions.map((emp: any) => (
                <li key={emp.id || emp.name}
                  onMouseDown={() => { setPayrollNameSearch(emp.name); setShowNameSuggest(false); setPayrollPage(1); }}
                  className="px-3 py-2 text-[13px] text-slate-700 hover:bg-blue-50 cursor-pointer">{emp.name}</li>
              ))}
            </ul>
          )}
        </div>
        <select value={payrollMonth} onChange={(e) => { setPayrollMonth(e.target.value); setPayrollPage(1); }} aria-label="Tháng" data-testid="payroll-month" className={`${inputCls} cursor-pointer`}>
          {Array.from({ length: 12 }, (_, i) => { const m = String(i + 1).padStart(2, '0'); return <option key={i} value={m}>Tháng {m}</option>; })}
        </select>
        <select value={payrollYear} onChange={(e) => { setPayrollYear(e.target.value); setPayrollPage(1); }} aria-label="Năm" data-testid="payroll-year" className={`${inputCls} cursor-pointer`}>
          {['2024', '2025', '2026', '2027'].map(y => <option key={y} value={y}>Năm {y}</option>)}
        </select>
        <label className="flex items-center gap-1.5 h-9 px-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-500" title="Ngày công quy chuẩn của tháng">
          Công chuẩn
          <input type="number" min={20} max={31} value={standardWorkDays} data-testid="payroll-std-days"
            onChange={(e) => setStandardWorkDays(Math.max(20, Math.min(31, Number(e.target.value) || 26)))}
            className="w-12 bg-transparent text-[13px] font-mono font-bold text-slate-800 outline-none text-center" />
        </label>
        <button type="button" onClick={handleExportPayrollExcel} title="Xuất Excel bảng lương" aria-label="Xuất Excel bảng lương" data-testid="payroll-export"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"><Download className="w-4 h-4" /></button>
        <button type="button" onClick={handleCalculatePayroll} data-testid="payroll-calc"
          // Nền xanh đặt inline vì index.css ép màu cho bg-* / text-white
          style={{ background: '#0d47c9', color: '#ffffff' }}
          className="h-9 px-3.5 rounded-xl flex items-center gap-1.5 text-[13px] font-bold cursor-pointer">
          <Calculator className="w-4 h-4" /><span className="hidden sm:inline">Tính lương tự động</span><span className="sm:hidden">Tính lương</span>
        </button>
      </div>

      {/* Chip chế độ xem + trạng thái khóa kỳ */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" data-testid="payroll-views">
        {([['summary', 'Tóm tắt'], ['detail', 'Bảng chi tiết']] as const).map(([k, label]) => {
          const on = payrollViewMode === k;
          return (
            <button key={k} type="button" onClick={() => setPayrollViewMode(k)} data-testid={`payroll-view-${k}`}
              style={on ? { background: '#e8efff', color: '#0d47c9', borderColor: '#bcd0ff' } : undefined}
              className={`h-9 px-4 rounded-full text-[13px] font-bold whitespace-nowrap border cursor-pointer ${on ? '' : 'bg-white text-slate-600 border-slate-200'}`}>{label}</button>
          );
        })}
        <span className="flex-1" />
        {periodPayrollAll.length > 0 && (
          <span data-testid="payroll-lock-status" className={`${PILL} ${periodLocked ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
            <Lock className="w-3 h-3" />{periodLocked ? `Đã khóa kỳ ${payrollMonth}/${payrollYear}` : 'Chưa khóa kỳ'}
          </span>
        )}
      </div>

      {/* Thẻ số liệu tổng hợp của kỳ đang lọc */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" data-testid="payroll-summary">
        {tiles.map(([label, val, color, tip]) => (
          <div key={label} title={tip} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
            <div className="text-[11px] text-slate-500 font-bold">{label}</div>
            <div className="text-base font-black mt-0.5 truncate" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {payrollViewMode === 'summary' ? (
          <>
            {/* MÁY TÍNH: bảng tóm tắt gọn — lương gốc, tạm ứng, bảo hiểm, thuế nằm trong phần mở rộng của dòng */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]" data-testid="payroll-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs">
                    <th className="px-3 py-2.5 font-bold">Nhân viên</th>
                    <th className="px-3 py-2.5 font-bold text-center">Công đạt</th>
                    <th className="px-3 py-2.5 font-bold text-right">Lương công nhật</th>
                    <th className="px-3 py-2.5 font-bold text-right">Phụ cấp</th>
                    <th className="px-3 py-2.5 font-bold text-right">Thưởng KPI</th>
                    <th className="px-3 py-2.5 font-bold text-right">Tăng ca</th>
                    <th className="px-3 py-2.5 font-bold text-right" title="Tạm ứng + bảo hiểm + thuế TNCN">Khấu trừ</th>
                    <th className="px-3 py-2.5 font-bold text-right">Thực lĩnh</th>
                    <th className="px-3 py-2.5 font-bold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr><td colSpan={9} className="py-10 text-center text-slate-500 text-sm" data-testid="payroll-empty">Chưa có dữ liệu kỳ lương {payrollMonth}/{payrollYear}. Bấm "Tính lương tự động" để tạo.</td></tr>
                  ) : paginated.map((pay: any) => (
                    <React.Fragment key={pay.id}>
                      <tr data-testid={`payroll-row-${pay.id}`} onClick={() => setExpandedId(expandedId === pay.id ? null : pay.id)}
                        className={`border-b border-slate-100 cursor-pointer transition-colors hover:bg-blue-50/50 ${expandedId === pay.id ? 'bg-blue-50' : ''}`}>
                        <td className="px-3 py-2.5">
                          <div className="font-bold text-slate-900">{pay.empName}</div>
                          <div className="text-[11px] text-slate-500"><span className="font-mono">{pay.empId}</span>{positionOf(pay.empId) ? ` · ${positionOf(pay.empId)}` : ''}</div>
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-xs text-slate-700">{pay.workedDays || 0} ngày</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-800">{money(dailyWageOf(pay))}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-700">{money(pay.allowance)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-emerald-700">+{money(pay.kpiBonus)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-amber-700">+{money(otOf(pay))}<div className="text-[11px] text-slate-400">{pay.otHours || 0}h</div></td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-rose-700">-{money(deductOf(pay))}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-sm font-black" style={{ color: '#0d47c9' }}>{money(pay.netSalary)}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap"><RowActions pay={pay} /></td>
                      </tr>
                      {expandedId === pay.id && (
                        <tr className="bg-slate-50 border-b border-slate-100"><td colSpan={9} className="px-4 py-3"><Breakdown pay={pay} /></td></tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
                {filteredPayroll.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold text-xs">
                      <td className="px-3 py-3 text-slate-500">Tổng cộng ({filteredPayroll.length} nhân viên)</td>
                      <td></td>
                      <td className="px-3 py-3 text-right font-mono text-slate-900">{money(payrollTotals.dailyWage)}</td>
                      <td></td>
                      <td className="px-3 py-3 text-right font-mono text-emerald-700">+{money(payrollTotals.kpiBonus)}</td>
                      <td className="px-3 py-3 text-right font-mono text-amber-700">+{money(payrollTotals.otAmount)}</td>
                      <td className="px-3 py-3 text-right font-mono text-rose-700">-{money(payrollTotals.advances + payrollTotals.insurance + payrollTotals.tax)}</td>
                      <td className="px-3 py-3 text-right font-mono text-sm font-black" style={{ color: '#0d47c9' }}>{money(payrollTotals.netSalary)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* ĐIỆN THOẠI: thẻ — không phải kéo ngang; bấm để xem khoản lương gốc/tạm ứng/bảo hiểm/thuế */}
            <div className="md:hidden" data-testid="payroll-cards">
              {paginated.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-sm">Chưa có dữ liệu kỳ lương {payrollMonth}/{payrollYear}.</div>
              ) : paginated.map((pay: any) => (
                <div key={pay.id} data-testid={`payroll-card-${pay.id}`} onClick={() => setExpandedId(expandedId === pay.id ? null : pay.id)}
                  className={`px-3 py-3 border-b border-slate-100 last:border-b-0 ${expandedId === pay.id ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm leading-snug">{pay.empName}</div>
                      <div className="text-[11px] text-slate-500"><span className="font-mono">{pay.empId}</span>{positionOf(pay.empId) ? ` · ${positionOf(pay.empId)}` : ''}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-slate-500">Thực lĩnh</div>
                      <div className="font-mono text-sm font-black" style={{ color: '#0d47c9' }}>{money(pay.netSalary)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs">
                    <div className="text-slate-500">Công đạt <strong className="text-slate-800 font-mono">{pay.workedDays || 0} ngày</strong></div>
                    <div className="text-slate-500">Lương công <strong className="text-slate-800 font-mono">{money(dailyWageOf(pay))}</strong></div>
                    <div className="text-slate-500">Thưởng KPI <strong className="text-emerald-700 font-mono">+{money(pay.kpiBonus)}</strong></div>
                    <div className="text-slate-500">Tăng ca <strong className="text-amber-700 font-mono">+{money(otOf(pay))}</strong></div>
                    <div className="text-slate-500 col-span-2">Khấu trừ <strong className="text-rose-700 font-mono">-{money(deductOf(pay))}</strong></div>
                  </div>
                  {expandedId === pay.id && <div className="mt-2 pt-2 border-t border-slate-200"><Breakdown pay={pay} /></div>}
                  <div className="flex justify-end mt-2"><RowActions pay={pay} /></div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* BẢNG CHI TIẾT (worksheet 33 cột kiểu Excel): giữ đủ cột để đối chiếu; cột Nhân viên ghim bên trái khi kéo ngang.
             Kẻ ô nhạt + dòng xen kẽ; [&_th]/[&_td] áp viền cho mọi ô mà không phải sửa từng thẻ. */
          <div className="overflow-x-auto" data-testid="payroll-detail-wrap">
            <table className="w-full text-left whitespace-nowrap border-collapse min-w-[2200px] text-xs [&_th]:border [&_th]:border-slate-200 [&_td]:border [&_td]:border-slate-100 [&_th]:px-2.5 [&_td]:px-2.5" data-testid="payroll-worksheet">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[11px] font-bold">
                  <th className="py-2.5 text-center w-10">STT</th>
                  <th className="py-2.5 sticky left-0 bg-slate-50 z-10">Nhân viên</th>
                  {['Mã BLU', 'Chức vụ', 'Công nhật', 'Lương cơ bản', 'Lương hiệu suất', 'Điểm hiệu suất', 'Thưởng hiệu suất', 'Lương ngày chuẩn', 'Lương công nhật', 'Công tăng ca CN', 'Lương tăng ca CN', 'Công tăng ca LỄ', 'Lương tăng ca LỄ', 'Giờ tăng ca ngoài giờ', 'Lần tăng ca ngoài giờ', 'Lương tăng ca ngoài giờ', 'Công tác phí', 'Thưởng lễ', 'Thưởng sáng kiến', 'Tổng thu nhập tháng', 'BHXH (10.5%)', 'Khoản giảm trừ khác', 'Tạm ứng', 'Thu nhập miễn thuế', 'Thu nhập chịu thuế', 'Giảm trừ bản thân', 'Số người phụ thuộc', 'Giảm trừ người phụ thuộc', 'Thu nhập tính thuế', 'Thuế TNCN'].map(h => <th key={h} className="py-2.5">{h}</th>)}
                  <th className="py-2.5" style={{ color: '#0d47c9' }}>Thực lĩnh tháng</th>
                  <th className="py-2.5 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={34} className="py-10 text-center text-slate-500 text-sm" data-testid="payroll-empty">Chưa có dữ liệu kỳ lương {payrollMonth}/{payrollYear}.</td></tr>
                ) : paginated.map((pay: any, idx) => (
                  <tr key={pay.id} data-testid={`payroll-wrow-${pay.id}`} className={`${idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'} hover:bg-blue-50/50 font-mono`}>
                    <td className="py-2 text-center text-slate-400">{startIndex + idx + 1}</td>
                    <td className={`py-2 font-sans sticky left-0 z-10 ${idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                      <b className="text-slate-900 block">{pay.empName}</b>
                      <span className="text-[11px] text-slate-400 font-mono">{pay.empId}</span>
                    </td>
                    <td className="py-2 text-slate-400">{pay.bluCode}</td>
                    <td className="py-2 text-slate-600 font-sans">{positionOf(pay.empId) || '—'}</td>
                    <td className="py-2 text-slate-700">{pay.workedDays || 0} ngày</td>
                    <td className="py-2">{money(pay.baseSalary)}</td>
                    <td className="py-2">{money(pay.performanceSalary)}</td>
                    <td className="py-2 text-amber-700">{pay.kpiScore || 100}%</td>
                    <td className="py-2 text-emerald-700">{money(pay.kpiBonus)}</td>
                    <td className="py-2 text-slate-600">{money(pay.salaryPerDay)}</td>
                    <td className="py-2 text-slate-800">{money(pay.daySalary)}</td>
                    <td className="py-2 text-slate-500">{pay.otSunday || 0}</td>
                    <td className="py-2 text-amber-700 font-bold">{money(pay.otSundaySalary)}</td>
                    <td className="py-2 text-slate-500">{pay.otHoliday || 0}</td>
                    <td className="py-2 text-amber-700 font-bold">{money(pay.otHolidaySalary)}</td>
                    <td className="py-2 text-slate-600">{pay.otHours || 0}h</td>
                    <td className="py-2 text-slate-500">{pay.otCount || 0} lần</td>
                    <td className="py-2 text-indigo-700 font-bold">{money(pay.otHoursSalary)}</td>
                    <td className="py-2 text-slate-600">{money(pay.expenses)}</td>
                    <td className="py-2 text-emerald-700">{money(pay.bonusHoliday)}</td>
                    <td className="py-2 text-emerald-700">{money(pay.bonusCreative)}</td>
                    <td className="py-2 font-bold text-slate-900">{money(pay.totalIncome)}</td>
                    <td className="py-2 text-rose-700">{money(pay.insurance)}</td>
                    <td className="py-2 text-rose-700">{money(pay.otherDeductions)}</td>
                    <td className="py-2 text-rose-700">{money(pay.advances)}</td>
                    <td className="py-2 text-teal-700">{money(pay.taxExemptIncome)}</td>
                    <td className="py-2 text-slate-600">{money(pay.taxableIncome)}</td>
                    <td className="py-2 text-slate-500">{money(pay.personalDeduction)}</td>
                    <td className="py-2 text-center text-slate-500">{pay.dependentCount || 0}</td>
                    <td className="py-2 text-slate-500">{money(pay.dependentDeduction)}</td>
                    <td className="py-2 text-slate-800 font-bold">{money(pay.taxableNetIncome)}</td>
                    <td className="py-2 text-rose-700 font-bold">{money(pay.tax)}</td>
                    <td className="py-2 font-black font-sans" style={{ color: '#0d47c9' }}>{money(pay.netSalary)}</td>
                    <td className="py-2 text-center font-sans"><RowActions pay={pay} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Chân bảng: số lượng + phân trang + số dòng mỗi trang */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-t border-slate-200 text-xs text-slate-500">
          <span>{filteredPayroll.length} nhân viên · kỳ {payrollMonth}/{payrollYear} · công chuẩn {standardWorkDays} ngày</span>
          {pageSizeNum > 0 && filteredPayroll.length > pageSizeNum && (
            <div className="flex items-center gap-1.5">
              <button type="button" disabled={payrollPage === 1} aria-label="Trang trước"
                onClick={() => setPayrollPage(prev => Math.max(prev - 1, 1))}
                className="h-8 px-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 font-bold disabled:opacity-30 disabled:pointer-events-none cursor-pointer">Trước</button>
              <span className="px-1">Trang <strong>{payrollPage}</strong> / {totalPages}</span>
              <button type="button" disabled={payrollPage >= totalPages} aria-label="Trang sau"
                onClick={() => setPayrollPage(prev => Math.min(prev + 1, totalPages))}
                className="h-8 px-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 font-bold disabled:opacity-30 disabled:pointer-events-none cursor-pointer">Sau</button>
            </div>
          )}
          <label className="flex items-center gap-1.5">
            <span>Hiển thị</span>
            <select value={globalPageSize.toString()}
              onChange={(e) => { const val = e.target.value; setGlobalPageSize(val === 'all' ? 'all' : parseInt(val, 10)); localStorage.setItem('hl_global_page_size', val); }}
              className="h-8 bg-white border border-slate-200 text-slate-700 px-2 rounded-lg text-xs cursor-pointer outline-none font-bold">
              <option value="5">5 dòng</option>
              <option value="10">10 dòng</option>
              <option value="20">20 dòng</option>
              <option value="50">50 dòng</option>
              <option value="all">Tất cả</option>
            </select>
          </label>
        </div>
      </div>

      {/* Chốt kỳ lương: Khóa kỳ là nút chính (xanh LoLo), Tải toàn bộ là nút phụ — chỉ tải được sau khi khóa kỳ */}
      <div className="flex flex-wrap items-center justify-end gap-2" data-testid="payroll-lockbar">
        <button type="button" data-testid="payroll-lock"
          onClick={() => {
            if (!confirm(`Khóa kỳ lương ${payrollMonth}/${payrollYear}? Sau khi khóa, ngày lập trên phiếu lương sẽ chốt theo ngày hôm nay.`)) return;
            handleLockPayrollPeriod();
          }}
          disabled={periodLocked}
          style={periodLocked ? undefined : { background: '#0d47c9', color: '#ffffff' }}
          className={`h-9 px-4 rounded-xl text-[13px] font-bold flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed ${periodLocked ? 'bg-slate-100 text-slate-400 border border-slate-200' : ''}`}>
          <Lock className="w-4 h-4" />{periodLocked ? 'Đã khóa kỳ' : 'Khóa kỳ & phát phiếu lương'}
        </button>
        <button type="button" onClick={handleDownloadAllPayslips} disabled={!periodLocked} data-testid="payroll-download-all"
          title={periodLocked ? 'Tải toàn bộ phiếu lương của kỳ này (.zip)' : 'Cần khóa kỳ trước khi tải toàn bộ'}
          className="h-9 px-4 rounded-xl text-[13px] font-bold flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
          <Download className="w-4 h-4" /> Tải toàn bộ phiếu lương
        </button>
      </div>
    </div>
  );
}
