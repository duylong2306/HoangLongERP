import React from 'react';
import { Plus, CheckCircle, Users, AlertTriangle, Clock } from 'lucide-react';
import { EmployeeErrorLog } from '../hrTypes';

interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
}

interface PerformanceTabProps {
  employees: Employee[];
  employeeErrors: EmployeeErrorLog[];
  errorSearchEmpId: string;
  setErrorSearchEmpId: (v: string) => void;
  errorFilterMonth: string;
  setErrorFilterMonth: (v: string) => void;
  errorFilterYear: string;
  setErrorFilterYear: (v: string) => void;
  deletingErrorId: string | null;
  setDeletingErrorId: (v: string | null) => void;
  setEditingErrorId: (v: string | null) => void;
  setErrFormEmpId: (v: string) => void;
  setErrFormDate: (v: string) => void;
  setErrFormNotes: (v: string) => void;
  setErrorFormCritSearch: (v: string) => void;
  setShowErrorModal: (v: boolean) => void;
  handleFormEmployeeChange: (empId: string) => void;
  handleEditErrorTrigger: (err: EmployeeErrorLog) => void;
  handleDeleteError: (id: string) => void;
}

export default function PerformanceTab({
  employees,
  employeeErrors,
  errorSearchEmpId,
  setErrorSearchEmpId,
  errorFilterMonth,
  setErrorFilterMonth,
  errorFilterYear,
  setErrorFilterYear,
  deletingErrorId,
  setDeletingErrorId,
  setEditingErrorId,
  setErrFormEmpId,
  setErrFormDate,
  setErrFormNotes,
  setErrorFormCritSearch,
  setShowErrorModal,
  handleFormEmployeeChange,
  handleEditErrorTrigger,
  handleDeleteError,
}: PerformanceTabProps) {
  const calculateScoreFromErrorCount = (count: number): number => {
    if (count === 0) return 100;
    if (count === 1) return 97;
    if (count === 2) return 95;
    if (count === 3) return 90;
    if (count === 4) return 85;
    if (count === 5) return 80;
    return 50; // count >= 6
  };

  // Filter errors logged in chosen employee, month, and year
  const filteredErrors = employeeErrors.filter(err => {
    if (errorSearchEmpId !== 'all') {
      const targetEmp = employees.find(e => e.id === errorSearchEmpId);
      const isIdMatch = err.employeeId === errorSearchEmpId;
      const isNameMatch = targetEmp && err.employeeName && (err.employeeName.toLowerCase().trim() === targetEmp.name.toLowerCase().trim());
      if (!isIdMatch && !isNameMatch) return false;
    }
    if (err.date) {
      const parts = err.date.split('-');
      if (parts.length === 3) {
        const itemMonth = String(parseInt(parts[1], 10));
        const itemYear = parts[0];
        if (errorFilterMonth !== 'all' && itemMonth !== errorFilterMonth) return false;
        if (errorFilterYear !== 'all' && itemYear !== errorFilterYear) return false;
      }
    }
    return true;
  });

  // Generate ranking aggregated list
  const employeesSummaryList = employees.map(emp => {
    const empErrorsInPeriod = employeeErrors.filter(err => {
      const isIdMatch = err.employeeId === emp.id;
      const isNameMatch = err.employeeName && emp.name && (err.employeeName.toLowerCase().trim() === emp.name.toLowerCase().trim());
      if (!isIdMatch && !isNameMatch) return false;
      if (err.date) {
        const parts = err.date.split('-');
        if (parts.length === 3) {
          const itemMonth = String(parseInt(parts[1], 10));
          const itemYear = parts[0];
          if (errorFilterMonth !== 'all' && itemMonth !== errorFilterMonth) return false;
          if (errorFilterYear !== 'all' && itemYear !== errorFilterYear) return false;
        }
      }
      return true;
    });

    const count = empErrorsInPeriod.length;
    const score = calculateScoreFromErrorCount(count);

    return {
      id: emp.id,
      name: emp.name,
      department: emp.department,
      position: emp.position,
      errorCount: count,
      score: score
    };
  }).filter(sum => {
    if (errorSearchEmpId !== 'all' && sum.id !== errorSearchEmpId) return false;
    return true;
  }).sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-6 animate-fadeIn font-sans text-left">

      {/* WORKSPACE FILTERS */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">
              Tìm nhân sự
            </label>
            <select
              value={errorSearchEmpId}
              onChange={(e) => setErrorSearchEmpId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 focus:outline-none cursor-pointer"
            >
              <option value="all">👥 Tất cả nhân sự</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.id} - {emp.name} ({emp.position})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">
              Lọc theo Tháng
            </label>
            <select
              value={errorFilterMonth}
              onChange={(e) => setErrorFilterMonth(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 focus:outline-none cursor-pointer"
            >
              <option value="all">📅 Tất cả các tháng</option>
              {Array.from({ length: 12 }, (_, i) => {
                const mStr = String(i + 1);
                return <option key={i} value={mStr}>Tháng {mStr.padStart(2, '0')}</option>;
              })}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">
              Lọc theo Năm
            </label>
            <select
              value={errorFilterYear}
              onChange={(e) => setErrorFilterYear(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 focus:outline-none cursor-pointer"
            >
              <option value="2024">Năm 2024</option>
              <option value="2025">Năm 2025</option>
              <option value="2026">Năm 2026</option>
              <option value="2027">Năm 2027</option>
              <option value="2028">Năm 2028</option>
            </select>
          </div>
        </div>

        <div className="flex items-end self-stretch md:self-auto pt-2 md:pt-0">
          <button
            type="button"
            onClick={() => {
              setEditingErrorId(null);
              if (employees.length > 0) {
                handleFormEmployeeChange(employees[0].id);
              } else {
                setErrFormEmpId('');
              }
              setErrFormDate('2026-06-12');
              setErrFormNotes('');
              setErrorFormCritSearch('');
              setShowErrorModal(true);
            }}
            className="w-full md:w-auto bg-amber-600 hover:bg-amber-550 active:translate-y-0.5 text-white text-xs font-extrabold px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
          >
            <Plus className="w-4 h-4 text-white" />
            Ghi Nhận Lỗi Vi Phạm
          </button>
        </div>
      </div>

      {/* MASTER-DETAIL LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT PANEL: CONFIG MAPPING TABLE & TOTAL EVALUATION RATINGS */}
        <div className="space-y-6">

          {/* SUB-CARD 1: REFERENCE TABLE ON OVERALL METHOD DECLARED */}
          <div className="bg-slate-900 border border-slate-805 p-4 rounded-2xl shadow-xl space-y-3">
            <div className="border-b border-slate-800 pb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-amber-500" />
              <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">
                Cách Đánh Giá Tổng Hợp
              </h4>
            </div>
            <p className="text-[10px] text-slate-400 italic">
              Hệ thống theo vết số lỗi mắc phải của nhân viên trong tháng và quy đổi điểm xếp loại xếp bậc:
            </p>

            <div className="overflow-hidden border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 font-bold text-slate-300 border-b border-slate-800 text-[10px]">
                    <th className="p-2 border-r border-slate-850">Số lần mắc lỗi/tháng</th>
                    <th className="p-2 text-center">Xếp loại (Điểm)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-[10.5px] text-slate-400 font-mono">
                  <tr className="hover:bg-slate-850/30">
                    <td className="p-2 border-r border-slate-850 text-slate-200">0 lần</td>
                    <td className="p-2 text-center text-emerald-400 font-extrabold">100</td>
                  </tr>
                  <tr className="hover:bg-slate-850/30">
                    <td className="p-2 border-r border-slate-850 text-slate-200">1 lần</td>
                    <td className="p-2 text-center text-emerald-500/80 font-bold">97 <span className="text-[9px] text-slate-500 font-normal italic">(Quy đổi)</span></td>
                  </tr>
                  <tr className="hover:bg-slate-850/30">
                    <td className="p-2 border-r border-slate-850 text-slate-200">2 lần</td>
                    <td className="p-2 text-center text-sky-400 font-bold">95</td>
                  </tr>
                  <tr className="hover:bg-slate-850/30">
                    <td className="p-2 border-r border-slate-850 text-slate-200">3 lần</td>
                    <td className="p-2 text-center text-yellow-500 font-bold">90</td>
                  </tr>
                  <tr className="hover:bg-slate-850/30">
                    <td className="p-2 border-r border-slate-850 text-slate-200">4 lần</td>
                    <td className="p-2 text-center text-amber-550 font-bold">85</td>
                  </tr>
                  <tr className="hover:bg-slate-850/30">
                    <td className="p-2 border-r border-slate-850 text-slate-200">5 lần</td>
                    <td className="p-2 text-center text-orange-400">80</td>
                  </tr>
                  <tr className="hover:bg-slate-850/30">
                    <td className="p-2 border-r border-slate-850 text-slate-200">≥ 6 lần</td>
                    <td className="p-2 text-center text-red-500 font-extrabold bg-red-950/20">50</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SUB-CARD 2: MONTHLY TOTAL RATING SUMMARY */}
          <div className="bg-slate-900 border border-slate-805 p-4 rounded-2xl shadow-xl space-y-3">
            <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
              <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-500" />
                Xếp Loại Kỳ Này {errorFilterMonth === 'all' ? 'Tổng năm' : `T.${errorFilterMonth}`}/{errorFilterYear}
              </h4>
              <span className="text-[9px] bg-slate-950 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800">
                {employeesSummaryList.length} NS
              </span>
            </div>

            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {employeesSummaryList.map(sum => {
                const getScoreBadgeColor = (score: number) => {
                  if (score === 100) return 'bg-emerald-950 text-emerald-400 border border-emerald-800/60';
                  if (score >= 95) return 'bg-sky-950 text-sky-400 border border-sky-800/60';
                  if (score >= 85) return 'bg-yellow-950 text-yellow-400 border border-yellow-800/60';
                  if (score === 80) return 'bg-orange-950 text-orange-400 border border-orange-855';
                  return 'bg-red-950 text-red-400 border border-red-855';
                };

                return (
                  <div
                    key={sum.id}
                    onClick={() => setErrorSearchEmpId(sum.id)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer text-[11px] ${
                      errorSearchEmpId === sum.id
                        ? 'bg-slate-800 border-amber-500 shadow-md'
                        : 'bg-slate-950 hover:bg-slate-850/50 border-slate-850'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-extrabold text-white flex items-center gap-1 select-none">
                          <span>{sum.name}</span>
                          <span className="text-[9px] font-mono text-slate-500">#{sum.id}</span>
                        </div>
                        <div className="text-[9.5px] text-slate-400 mt-0.5 truncate max-w-[130px]" title={sum.position}>
                          {sum.position} • {sum.department.split('(')[0].trim()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold">
                          {sum.errorCount === 0 ? (
                            <span className="text-emerald-400">0 lỗi</span>
                          ) : (
                            <span className="text-amber-500 font-mono">{sum.errorCount} lỗi</span>
                          )}
                        </div>
                        <span className={`inline-block mt-1 px-1 py-0.2 rounded text-[9.5px] font-mono font-bold ${getScoreBadgeColor(sum.score)}`}>
                          Đánh giá: {sum.score}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {errorSearchEmpId !== 'all' && (
              <div className="pt-1.5 text-right">
                <button
                  type="button"
                  onClick={() => setErrorSearchEmpId('all')}
                  className="text-[10px] font-extrabold text-amber-500 hover:underline cursor-pointer"
                >
                  × Hiện tất cả nhân sự
                </button>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: IN-DEPTH ERROR DETAIL LOG */}
        <div className="lg:col-span-2 space-y-4">

          <div className="bg-slate-900 border border-slate-805 p-5 rounded-2xl shadow-xl space-y-4">

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                  Nhật Ký Lỗi Vi Phạm ({filteredErrors.length} bản ghi)
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Xem chi tiết lỗi phục vụ đánh giá xếp loại bậc lương
                </p>
              </div>

              {errorSearchEmpId !== 'all' && (
                <span className="bg-slate-950 border border-slate-800 text-[9.5px] py-1 px-2.5 rounded-lg text-amber-400 font-bold flex items-center gap-1.5">
                  <span>Lọc: {employees.find(e => e.id === errorSearchEmpId)?.name}</span>
                  <button
                    type="button"
                    onClick={() => setErrorSearchEmpId('all')}
                    className="text-red-400 text-xs hover:text-white font-extrabold cursor-pointer ml-1"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>

            {filteredErrors.length === 0 ? (
              <div className="py-14 text-center text-slate-500 italic space-y-2 text-xs">
                <div className="text-4xl text-slate-800">✓</div>
                <p className="font-sans">Không ghi nhận lỗi vi phạm nào trong bộ lọc hiện thời.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredErrors.map(err => {
                  const getCatText = (cat: string) => {
                    if (cat === 'readiness') return 'Tác phong 5S';
                    if (cat === 'progress') return 'Hiệu suất / Tiến độ';
                    if (cat === 'reporting') return 'Báo cáo / Ý thức';
                    return cat;
                  };

                  return (
                    <div key={err.id} className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl hover:border-slate-800/80 hover:bg-slate-900/10 transition-all">

                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 mb-2 border-b border-slate-900">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-white text-xs">{err.employeeName}</span>
                          <span className="text-[10px] text-slate-500 font-mono">#{err.employeeId}</span>
                          <span className="text-[10px] text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-900/30">
                            {getCatText(err.category)}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-850 px-2 py-0.5 rounded flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{err.date.split('-').reverse().join('/')}</span>
                        </div>
                      </div>

                      <div className="text-[11px] space-y-1.5 text-slate-300">
                        <div>
                          <span className="text-slate-500 font-bold select-none text-[10px] uppercase">Lỗi vi phạm:</span>{" "}
                          <span className="text-amber-450 font-bold">{err.criterionContent}</span>
                        </div>
                        {err.notes && (
                          <div>
                            <span className="text-slate-500 font-bold select-none text-[10px] uppercase">Ghi chú cụ thể:</span>{" "}
                            <span className="font-sans text-slate-300 italic">"{err.notes}"</span>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-500">
                          Khung đánh giá phòng ban: <span className="text-slate-400 font-medium">{err.departmentName}</span>
                        </div>
                        {err.images && err.images.length > 0 && (
                          <div className="pt-2 bg-slate-900/40 p-2 rounded-lg border border-slate-900/80 flex gap-1.5 flex-wrap">
                            {err.images.map((imgUrl, imgIdx) => (
                              <div key={imgIdx} className="relative focus:outline-none">
                                <img
                                  src={imgUrl}
                                  alt={`Violation ${imgIdx + 1}`}
                                  className="w-14 h-14 object-cover rounded-lg border border-slate-800 hover:border-slate-705 transition-all cursor-zoom-in"
                                  onClick={() => {
                                    const w = window.open();
                                    if (w) {
                                      w.document.write(`<img src="${imgUrl}" style="max-width: 100vw; max-height: 100vh; object-fit: contain; margin: auto; display: block;" />`);
                                    }
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-3 mt-3 pt-2.5 border-t border-slate-900/50 items-center">
                        {deletingErrorId === err.id ? (
                          <div className="flex items-center gap-2 bg-rose-950/40 px-3 py-1.5 rounded-xl border border-rose-900/30 animate-fadeIn">
                            <span className="text-[10.5px] font-bold text-rose-300">⚠️ Xác nhận xóa lỗi này?</span>
                            <button
                              type="button"
                              onClick={() => {
                                handleDeleteError(err.id);
                                setDeletingErrorId(null);
                              }}
                              className="px-2.5 py-1 text-[9.5px] font-extrabold rounded-lg bg-rose-600 hover:bg-rose-500 text-white cursor-pointer transition-all active:scale-95"
                            >
                              Đồng ý
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingErrorId(null)}
                              className="px-2.5 py-1 text-[9.5px] font-bold rounded-lg bg-slate-800 hover:bg-slate-705 text-slate-300 cursor-pointer transition-colors"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEditErrorTrigger(err)}
                              className="text-[10.5px] text-sky-400 hover:text-sky-300 font-extrabold flex items-center gap-1 cursor-pointer"
                            >
                              ✏️ Sửa lỗi
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingErrorId(err.id)}
                              className="text-[10.5px] text-red-500 hover:text-red-400 font-extrabold flex items-center gap-1 cursor-pointer"
                            >
                              🗑️ Xoá
                            </button>
                          </>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
