import React from 'react';
import { Calculator, FileSpreadsheet, Download } from 'lucide-react';
import { PayrollItem } from '../hrTypes';

interface PayrollTabProps {
  payroll: PayrollItem[];
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
  addToast: (msg: { title: string; message: string; type?: 'success' | 'info' | 'warning' | 'error'; duration?: number }) => void;
}

export default function PayrollTab({
  payroll,
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
  addToast,
}: PayrollTabProps) {
  return (
    <div className="space-y-4 animate-fadeIn">
      {/* TOOLBAR CONTROLS */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 font-sans text-left text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h4 className="font-extrabold text-[12px] text-orange-400 uppercase tracking-widest flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-orange-500" />
              Quản lý & Tính Lương Tự Động
            </h4>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              Lương thực lĩnh = Lương công + Phụ cấp + Tăng ca - Tạm ứng - Khấu trừ
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCalculatePayroll}
              className="bg-amber-600 hover:bg-amber-550 text-white font-extrabold text-[10.5px] px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow transition-all duration-150 active:translate-y-0.5"
            >
              ⚡ Tính lương tự động
            </button>
            <button
              onClick={handleExportPayrollExcel}
              className="bg-blue-600 hover:bg-blue-550 text-white font-extrabold text-[10.5px] px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow transition-all duration-150 active:translate-y-0.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Xuất Excel bảng lương
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          <div>
            <label className="block text-[9.5px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">Kỳ Tính Lương (Tháng)</label>
            <select
              value={payrollMonth}
              onChange={(e) => setPayrollMonth(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 focus:outline-none cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const mVal = String(i + 1).padStart(2, '0');
                return <option key={i} value={mVal}>Tháng {mVal}</option>;
              })}
            </select>
          </div>
          <div>
            <label className="block text-[9.5px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">Kỳ Tính Lương (Năm)</label>
            <select
              value={payrollYear}
              onChange={(e) => setPayrollYear(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 focus:outline-none cursor-pointer"
            >
              <option value="2024">Năm 2024</option>
              <option value="2025">Năm 2025</option>
              <option value="2026">Năm 2026</option>
              <option value="2027">Năm 2027</option>
            </select>
          </div>
          <div>
            <label className="block text-[9.5px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">Ngày công quy chuẩn</label>
            <input
              type="number"
              min={20}
              max={31}
              value={standardWorkDays}
              onChange={(e) => setStandardWorkDays(Math.max(20, Math.min(31, Number(e.target.value) || 26)))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 focus:outline-none font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[9.5px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">Chế độ hiển thị bảng</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setPayrollViewMode('summary')}
                className={`p-2 text-xs font-bold rounded-lg transition-all cursor-pointer border ${
                  payrollViewMode === 'summary'
                    ? 'bg-slate-800 text-white border-amber-500'
                    : 'bg-slate-955 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                Tóm tắt cơ bản
              </button>
              <button
                type="button"
                onClick={() => setPayrollViewMode('detail')}
                className={`p-2 text-xs font-bold rounded-lg transition-all cursor-pointer border ${
                  payrollViewMode === 'detail'
                    ? 'bg-slate-800 text-white border-orange-500'
                    : 'bg-slate-955 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                Worksheet (Chi tiết mộc)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN TABLE CONTAINER */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 font-sans text-left text-white">
        <div className="flex justify-between items-center border-b border-slate-850 pb-2">
          <span className="font-bold text-[11px] text-amber-500 uppercase tracking-widest flex items-center gap-1">
            {payrollViewMode === 'summary' ? 'Bảng tóm tắt tiền lương' : 'Bảng tính toán mộc chi tiết đầy đủ 100%'}
            <span className="text-[10px] text-slate-400 normal-case font-normal ml-1">({payrollMonth}/{payrollYear} - Công chuẩn: {standardWorkDays} ngày)</span>
          </span>
          <span className="text-[9.5px] text-slate-400 italic font-medium hidden sm:inline">Click để ghi đè công, điểm KPI, thưởng tăng ca & các khoản trừ liên thông</span>
        </div>

        <div className="overflow-x-auto text-[11px] scroller-slate">
          {payrollViewMode === 'summary' ? (
            <table className="w-full text-left whitespace-nowrap border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10.5px]">
                  <th className="pb-2">Nhân viên</th>
                  <th className="pb-2">Lương gốc</th>
                  <th className="pb-2">Công đạt</th>
                  <th className="pb-2">Lương công nhật</th>
                  <th className="pb-2">Phụ cấp tổng</th>
                  <th className="pb-2">Thưởng KPI</th>
                  <th className="pb-2">Tăng ca (H)</th>
                  <th className="pb-2">Tạm ứng</th>
                  <th className="pb-2">Bảo hiểm (10.5%)</th>
                  <th className="pb-2">Thuế TNCN</th>
                  <th className="pb-2">Thực lĩnh sạch</th>
                  <th className="pb-2 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const startIndex = (payrollPage - 1) * (globalPageSize === 'all' ? payroll.length : (globalPageSize as number));
                  const endIndex = globalPageSize === 'all' ? payroll.length : startIndex + (globalPageSize as number);
                  const paginated = payroll.slice(startIndex, endIndex);
                  if (paginated.length === 0) {
                    return (
                      <tr>
                        <td colSpan={12} className="py-8 text-center text-slate-500 italic">Không có dữ liệu kì tính lương hiện tại. Vui lòng click "Tính lương tự động" phía trên.</td>
                      </tr>
                    );
                  }
                  return paginated.map(pay => (
                    <tr key={pay.id} className="border-b border-slate-850/60 hover:bg-slate-950/30 transition-all">
                      <td className="py-2.5 font-bold text-white">
                        {pay.empName}
                        <span className="block text-[8.5px] text-slate-400 font-mono mt-0.5">{pay.empId}</span>
                      </td>
                      <td className="py-2.5 font-mono">{(pay.baseSalary || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 font-mono text-slate-300">{pay.workedDays || 0} ngày</td>
                      <td className="py-2.5 font-mono text-slate-100">
                        {(Math.round(((pay.baseSalary || 0) / standardWorkDays) * (pay.workedDays || 0))).toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-2.5 font-mono">{(pay.allowance || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 font-mono text-emerald-400">+{(pay.kpiBonus || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 font-mono text-amber-450">
                        +{((pay.otWeekendSalary || 0) + (pay.totalOtHoursSalary || 0)).toLocaleString('vi-VN')} đ
                        <span className="block text-[8.5px] text-slate-500 font-mono mt-0.5">({pay.otHours || 0}h)</span>
                      </td>
                      <td className="py-2.5 font-mono text-red-400">-{(pay.advances || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 font-mono text-purple-400">-{(pay.insurance || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 font-mono text-slate-400">-{(pay.tax || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 font-black text-emerald-400 font-sans text-xs">
                        {(pay.netSalary || 0).toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditPayroll(pay)}
                            className="bg-slate-850 hover:bg-sky-655 text-sky-400 px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors"
                            title="Chỉnh sửa chi tiết"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => triggerDownloadPayslip(pay)}
                            className="bg-slate-850 hover:bg-amber-600 hover:text-white text-slate-300 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-0.5 cursor-pointer transition-colors"
                            title="In phiếu lương PDF"
                          >
                            <Download className="w-3" /> Phiếu
                          </button>
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left whitespace-nowrap border-collapse min-w-[2200px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <th className="pb-2">Mã BLU</th>
                  <th className="pb-2">Nhân viên</th>
                  <th className="pb-2">Công nhật</th>
                  <th className="pb-2">Lương cơ bản</th>
                  <th className="pb-2">Lương hiệu suất</th>
                  <th className="pb-2">Điểm hiệu suất</th>
                  <th className="pb-2">Thưởng hiệu suất</th>
                  <th className="pb-2">Lương ngày chuẩn</th>
                  <th className="pb-2">Lương công nhật</th>
                  <th className="pb-2">Công tăng ca CN</th>
                  <th className="pb-2">Lương tăng ca CN</th>
                  <th className="pb-2">Công tăng ca LỄ</th>
                  <th className="pb-2">Lương tăng ca LỄ</th>
                  <th className="pb-2">Giờ Tăng ca ngoài giờ</th>
                  <th className="pb-2">Lần Tăng ca ngoài giờ</th>
                  <th className="pb-2">Lương tăng ca ngoài giờ</th>
                  <th className="pb-2">Công tác phí</th>
                  <th className="pb-2">Thưởng Lễ</th>
                  <th className="pb-2">Thưởng sáng kiến</th>
                  <th className="pb-2">Tổng thu nhập tháng</th>
                  <th className="pb-2">BHXH (10.5%)</th>
                  <th className="pb-2">Khoản giảm trừ khác</th>
                  <th className="pb-2">Tạm ứng</th>
                  <th className="pb-2 text-emerald-400">Thu nhập thực lĩnh tháng</th>
                  <th className="pb-2 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/65">
                {(() => {
                  const startIndex = (payrollPage - 1) * (globalPageSize === 'all' ? payroll.length : (globalPageSize as number));
                  const endIndex = globalPageSize === 'all' ? payroll.length : startIndex + (globalPageSize as number);
                  const paginated = payroll.slice(startIndex, endIndex);
                  if (paginated.length === 0) {
                    return (
                      <tr>
                        <td colSpan={25} className="py-8 text-center text-slate-500 italic">Không có dữ liệu kì tính lương mộc.</td>
                      </tr>
                    );
                  }
                  return paginated.map(pay => (
                    <tr key={pay.id} className="hover:bg-slate-950/40 text-[10.5px] font-mono transition-all">
                      <td className="py-2.5 text-slate-400 font-mono text-[9.5px]">{pay.bluCode}</td>
                      <td className="py-2.5 font-sans">
                        <b className="text-white block">{pay.empName}</b>
                        <span className="text-[9px] text-slate-400 font-mono">{pay.empId}</span>
                      </td>
                      <td className="py-2.5 text-slate-300">{pay.workedDays || 0} ngày</td>
                      <td className="py-2.5">{(pay.baseSalary || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5">{(pay.performanceSalary || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 text-amber-400">{pay.kpiScore || 100}%</td>
                      <td className="py-2.5 text-emerald-450">{(pay.kpiBonus || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 text-slate-300">{(pay.salaryPerDay || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 text-slate-200">{(pay.daySalary || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 text-slate-400">{pay.otSunday || 0}</td>
                      <td className="py-2.5 text-amber-300 font-bold">{(pay.otSundaySalary || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 text-slate-400">{pay.otHoliday || 0}</td>
                      <td className="py-2.5 text-amber-300 font-bold">{(pay.otHolidaySalary || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 text-slate-300">{pay.otHours || 0}h</td>
                      <td className="py-2.5 text-slate-400">{pay.otCount || 0} lần</td>
                      <td className="py-2.5 text-indigo-400 font-bold">{(pay.otHoursSalary || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 text-slate-300">{(pay.expenses || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 text-emerald-450">{(pay.bonusHoliday || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 text-emerald-450">{(pay.bonusCreative || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 font-bold text-white bg-slate-950/20 px-1 font-sans">{(pay.totalIncome || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 text-rose-350">{(pay.insurance || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 text-rose-450">{(pay.otherDeductions || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 text-rose-500">{(pay.advances || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 text-emerald-400 font-extrabold bg-emerald-950/10 px-1 font-sans text-xs">{(pay.netSalary || 0).toLocaleString('vi-VN')} đ</td>
                      <td className="py-2.5 text-center font-sans">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditPayroll(pay)}
                            className="p-1 bg-slate-800 hover:bg-amber-600 text-[10px] text-amber-400 hover:text-white rounded transition-colors cursor-pointer"
                            title="Cập nhật thưởng & phạt"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => triggerDownloadPayslip(pay)}
                            className="p-1 bg-slate-850 hover:bg-emerald-600 text-[10px] text-emerald-400 hover:text-white rounded transition-colors cursor-pointer"
                            title="Phiếu lương PDF"
                          >
                            Phiếu
                          </button>
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          )}
        </div>

        {/* Payroll Pagination helper */}
        {(() => {
          const totalFiltered = payroll.length;
          if (globalPageSize === 'all' || totalFiltered <= (globalPageSize as number)) return null;
          const totalPages = Math.ceil(totalFiltered / (globalPageSize as number));
          return (
            <div className="flex justify-center items-center gap-1.5 mt-4 pt-4 border-t border-slate-850">
              <button
                type="button"
                disabled={payrollPage === 1}
                onClick={(e) => { e.stopPropagation(); setPayrollPage(prev => Math.max(prev - 1, 1)); }}
                className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none text-xs font-bold transition-all cursor-pointer"
              >
                Trước
              </button>
              <span className="text-[11px] font-mono text-slate-400 px-2">
                Trang <strong>{payrollPage}</strong> / {totalPages}
              </span>
              <button
                type="button"
                disabled={payrollPage >= totalPages}
                onClick={(e) => { e.stopPropagation(); setPayrollPage(prev => Math.min(prev + 1, totalPages)); }}
                className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none text-xs font-bold transition-all cursor-pointer"
              >
                Sau
              </button>
            </div>
          );
        })()}

        {/* Global Row Selector inside Payroll footer */}
        <div className="flex justify-between items-center mt-3 pt-2 text-[10px] text-slate-500 border-t border-slate-850/50">
          <div>Hiển thị {globalPageSize === 'all' ? 'tất cả' : `${Math.min(globalPageSize as number, payroll.length)} / ${payroll.length} dòng`} mỗi trang.</div>
          <div className="flex items-center gap-1.5">
            <span>Hiển thị:</span>
            <select
              value={globalPageSize.toString()}
              onChange={(e) => {
                const val = e.target.value;
                const newSize = val === 'all' ? 'all' : parseInt(val, 10);
                setGlobalPageSize(newSize);
                localStorage.setItem('hl_global_page_size', val);
              }}
              className="bg-slate-955 border border-slate-800 text-slate-350 px-1.5 py-0.5 rounded text-[10px] cursor-pointer outline-none font-bold"
            >
              <option value="5">5 dòng</option>
              <option value="10">10 dòng</option>
              <option value="20">20 dòng</option>
              <option value="50">50 dòng</option>
              <option value="all">Tất cả</option>
            </select>
          </div>
        </div>
      </div>

      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-2">
        <span className="text-[10px] text-slate-400 uppercase tracking-wide font-mono font-medium">Khóa kỳ sổ & Đẩy thông tin liên hệ sỹ thợ mộc qua webhook Ngân hàng</span>
        <button
          onClick={() => {
            addToast({ title: 'Thông báo', message: 'Đang phát hành yêu cầu phê duyệt chuyển khoản Vietcombank tự động sang liên thông Tài chính Kế toán.', type: 'warning' });
          }}
          className="bg-emerald-650 hover:bg-emerald-600 text-white text-[10px] font-bold px-3 py-1.5 rounded cursor-pointer animate-pulse"
        >
          Khóa kỳ & Phát phiếu lương VNĐ
        </button>
      </div>
    </div>
  );
}
