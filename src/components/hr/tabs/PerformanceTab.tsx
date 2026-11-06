import React from 'react';
import { Plus, CheckCircle, Clock, Download, Pencil, Trash2, X } from 'lucide-react';
import { EmployeeErrorLog } from '../hrTypes';
import { calculateScoreFromErrorCount } from '../hrCalculations';

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

  // Dùng chung cho cả hiển thị nhật ký lỗi và xuất Excel bên dưới.
  const getCatText = (cat: string) => {
    if (cat === 'readiness') return 'Tác phong 5S';
    if (cat === 'progress') return 'Hiệu suất / Tiến độ';
    if (cat === 'reporting') return 'Báo cáo / Ý thức';
    return cat;
  };

  // Xuất Excel (.xls) 2 bảng theo ĐÚNG bộ lọc/dữ liệu đang hiển thị trên tab:
  // (1) Bảng xếp loại tổng hợp theo nhân sự, (2) Nhật ký lỗi vi phạm chi tiết.
  // Dùng cùng kiểu template HTML→Blob như handleExportExcel ở TripsTab (HumanResourcesManagement.tsx)
  // để đồng bộ style file .xls xuất ra trong toàn bộ menu Hệ Thống Nhân Sự.
  const handleExportExcel = () => {
    const cellStyle = 'border: 1px solid #3f3f46; padding: 6px; font-family: Arial, sans-serif; font-size: 11px;';
    const thStyle = `${cellStyle} background-color: #d97706; color: white;`;

    const summaryHeaders = ['Mã NV', 'Họ Tên', 'Bộ Phận', 'Chức Vụ', 'Số Lỗi', 'Điểm Đánh Giá'];
    let summaryRows = '<tr>' + summaryHeaders.map(h => `<th style="${thStyle}">${h}</th>`).join('') + '</tr>';
    employeesSummaryList.forEach(sum => {
      summaryRows += '<tr>';
      summaryRows += `<td style="${cellStyle} font-weight: bold;">${sum.id}</td>`;
      summaryRows += `<td style="${cellStyle}">${sum.name}</td>`;
      summaryRows += `<td style="${cellStyle}">${sum.department}</td>`;
      summaryRows += `<td style="${cellStyle}">${sum.position}</td>`;
      summaryRows += `<td style="${cellStyle} text-align: center;">${sum.errorCount}</td>`;
      summaryRows += `<td style="${cellStyle} text-align: center; font-weight: bold;">${sum.score}</td>`;
      summaryRows += '</tr>';
    });

    const detailHeaders = ['Mã NV', 'Họ Tên', 'Ngày', 'Loại Lỗi', 'Nội Dung Lỗi', 'Ghi Chú', 'Phòng Ban Đánh Giá'];
    let detailRows = '<tr>' + detailHeaders.map(h => `<th style="${thStyle}">${h}</th>`).join('') + '</tr>';
    filteredErrors.forEach(err => {
      detailRows += '<tr>';
      detailRows += `<td style="${cellStyle} font-weight: bold;">${err.employeeId}</td>`;
      detailRows += `<td style="${cellStyle}">${err.employeeName}</td>`;
      detailRows += `<td style="${cellStyle}">${err.date.split('-').reverse().join('/')}</td>`;
      detailRows += `<td style="${cellStyle}">${getCatText(err.category)}</td>`;
      detailRows += `<td style="${cellStyle}">${err.criterionContent}</td>`;
      detailRows += `<td style="${cellStyle}">${err.notes || ''}</td>`;
      detailRows += `<td style="${cellStyle}">${err.departmentName}</td>`;
      detailRows += '</tr>';
    });

    const periodLabel = `${errorFilterMonth === 'all' ? 'Tất cả các tháng' : 'Tháng ' + errorFilterMonth} / Năm ${errorFilterYear}`;
    const empLabel = errorSearchEmpId === 'all' ? 'Tất cả nhân sự' : (employees.find(e => e.id === errorSearchEmpId)?.name || errorSearchEmpId);

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Hieu Suat Cong Viec</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
      </head>
      <body>
        <h2 style="font-family: Arial, sans-serif; color: #1e3a8a;">BẢNG HIỆU SUẤT CÔNG VIỆC & LỖI KỶ LUẬT - HOÀNG LONG GROUP</h2>
        <p style="font-family: Arial, sans-serif;">Thời gian xuất file: ${new Date().toLocaleString('vi-VN')}</p>
        <p style="font-family: Arial, sans-serif;">Bộ lọc đang chọn: Nhân viên: <strong>${empLabel}</strong> | Kỳ: <strong>${periodLabel}</strong></p>
        <h3 style="font-family: Arial, sans-serif; color: #1e3a8a;">1. Bảng Xếp Loại Tổng Hợp Theo Nhân Sự</h3>
        <table style="font-family: Arial, sans-serif; font-size: 11px; border-collapse: collapse; border: 1px solid #3f3f46;">
          ${summaryRows}
        </table>
        <br/>
        <h3 style="font-family: Arial, sans-serif; color: #1e3a8a;">2. Nhật Ký Lỗi Vi Phạm Chi Tiết</h3>
        <table style="font-family: Arial, sans-serif; font-size: 11px; border-collapse: collapse; border: 1px solid #3f3f46;">
          ${detailRows}
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `HieuSuatCongViec_${errorFilterMonth !== 'all' ? 'Thang' + errorFilterMonth : 'TatCa'}_Nam${errorFilterYear}_${Date.now()}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Hiển thị ──
  // Huy hiệu dùng chung (cùng kiểu các tab khác): bo tròn hẳn, chữ 11px đậm, viền nhạt
  const PILL = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap';
  const inputCls = 'h-9 bg-white border border-slate-200 text-slate-800 rounded-xl px-2.5 text-[13px] font-bold outline-none focus:border-blue-400 cursor-pointer';
  const iconBtn = 'w-8 h-8 inline-flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer';
  // Màu huy hiệu điểm: 100 xanh lá · ≥95 xanh dương · ≥85 vàng · 80 cam · còn lại đỏ
  const scoreTone = (score: number) => {
    if (score === 100) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score >= 95) return 'bg-sky-50 text-sky-700 border-sky-200';
    if (score >= 85) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    if (score === 80) return 'bg-orange-50 text-orange-700 border-orange-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };
  const fmtDate = (d: string) => d.split('-').reverse().join('/');
  const initials = (name: string) => (name || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
  const selectedEmp = employees.find(e => e.id === errorSearchEmpId);
  const withErrors = employeesSummaryList.filter(s => s.errorCount > 0).length;
  const perfect = employeesSummaryList.filter(s => s.score === 100).length;
  const tiles: Array<[string, number, string, string]> = [
    ['Bản ghi lỗi', filteredErrors.length, '#334155', 'Số lỗi vi phạm trong bộ lọc hiện tại'],
    ['Nhân sự có lỗi', withErrors, '#b45309', 'Số nhân sự có ít nhất 1 lỗi trong kỳ'],
    ['Đạt 100 điểm', perfect, '#047857', 'Số nhân sự không mắc lỗi nào trong kỳ'],
  ];
  // Thang quy đổi số lỗi → điểm (hiện gọn thay cho bảng tham chiếu cũ)
  const SCALE: Array<[string, number]> = [['0 lỗi', 100], ['1', 97], ['2', 95], ['3', 90], ['4', 85], ['5', 80], ['≥6', 50]];

  // Mở hộp "Ghi nhận lỗi" (logic giữ nguyên như nút cũ)
  const openNewError = () => {
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
  };

  return (
    <div className="space-y-3" data-testid="perf-root">
      {/* ── THANH CÔNG CỤ: lọc nhân sự/tháng/năm; nút chính (xanh LoLo) là "Ghi nhận lỗi" ── */}
      <div className="flex flex-wrap items-center gap-2" data-testid="perf-toolbar">
        <select value={errorSearchEmpId} onChange={(e) => setErrorSearchEmpId(e.target.value)} aria-label="Nhân sự" data-testid="perf-filter-emp" className={`${inputCls} flex-1 min-w-[160px]`}>
          <option value="all">Tất cả nhân sự</option>
          {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.id} - {emp.name} ({emp.position})</option>)}
        </select>
        <select value={errorFilterMonth} onChange={(e) => setErrorFilterMonth(e.target.value)} aria-label="Tháng" data-testid="perf-filter-month" className={inputCls}>
          <option value="all">Mọi tháng</option>
          {Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i + 1)}>Tháng {String(i + 1).padStart(2, '0')}</option>)}
        </select>
        <select value={errorFilterYear} onChange={(e) => setErrorFilterYear(e.target.value)} aria-label="Năm" data-testid="perf-filter-year" className={inputCls}>
          {['2024', '2025', '2026', '2027', '2028'].map(y => <option key={y} value={y}>Năm {y}</option>)}
        </select>
        <button type="button" onClick={handleExportExcel} title="Xuất bảng xếp loại & nhật ký lỗi vi phạm ra Excel" aria-label="Xuất Excel" data-testid="perf-export"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"><Download className="w-4 h-4" /></button>
        <button type="button" onClick={openNewError} data-testid="perf-add"
          // Nền xanh đặt inline vì index.css ép màu cho bg-* / text-white
          style={{ background: '#0d47c9', color: '#ffffff' }}
          className="h-9 px-3.5 rounded-xl flex items-center gap-1.5 text-[13px] font-bold cursor-pointer">
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">Ghi nhận lỗi vi phạm</span><span className="sm:hidden">Ghi lỗi</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2" data-testid="perf-summary">
        {tiles.map(([label, n, color, tip]) => (
          <div key={label} title={tip} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
            <div className="text-[11px] text-slate-500 font-bold">{label}</div>
            <div className="text-xl font-black mt-0.5" style={{ color }}>{n}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* ── TRÁI: thang điểm + xếp loại kỳ này ── */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-3.5 py-3 border-b border-slate-200">
            <div className="text-[11px] font-black uppercase tracking-wide text-slate-400 mb-2">Thang điểm theo số lỗi/tháng</div>
            <div className="flex flex-wrap gap-1.5" data-testid="perf-scale">
              {SCALE.map(([k, v]) => <span key={k} className={`${PILL} ${scoreTone(v)}`}>{k} → {v}</span>)}
            </div>
          </div>
          <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-slate-200">
            <div className="text-sm font-black text-slate-900">Xếp loại {errorFilterMonth === 'all' ? 'cả năm' : `tháng ${errorFilterMonth}`}/{errorFilterYear}</div>
            <span className="min-w-[24px] h-[22px] px-1.5 rounded-full text-xs leading-[22px] text-center font-black" style={{ background: '#e2e8f0', color: '#475569' }}>{employeesSummaryList.length}</span>
          </div>
          <div className="max-h-[420px] overflow-y-auto" data-testid="perf-ranking">
            {employeesSummaryList.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">Chưa có nhân sự.</div>
            ) : employeesSummaryList.map(sum => (
              <div key={sum.id} onClick={() => setErrorSearchEmpId(sum.id)} data-testid={`perf-rank-${sum.id}`}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 border-b border-slate-100 last:border-b-0 cursor-pointer transition-colors hover:bg-blue-50/50 ${errorSearchEmpId === sum.id ? 'bg-blue-50' : ''}`}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: '#e8efff', color: '#0d47c9' }}>{initials(sum.name)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 text-[13px] truncate">{sum.name}</div>
                  <div className="text-[11px] text-slate-500 truncate" title={sum.position}>{sum.position} · {(sum.department || '').split('(')[0].trim()}</div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`${PILL} ${scoreTone(sum.score)} font-mono`}>{sum.score}</span>
                  <div className={`text-[11px] mt-0.5 ${sum.errorCount === 0 ? 'text-emerald-700' : 'text-amber-700'} font-bold`}>{sum.errorCount} lỗi</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── PHẢI: nhật ký lỗi vi phạm ── */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-black text-slate-900">Nhật ký lỗi vi phạm</div>
            <span className="min-w-[24px] h-[22px] px-1.5 rounded-full text-xs leading-[22px] text-center font-black" style={{ background: '#e2e8f0', color: '#475569' }} data-testid="perf-log-count">{filteredErrors.length}</span>
            {errorSearchEmpId !== 'all' && (
              <button type="button" onClick={() => setErrorSearchEmpId('all')} data-testid="perf-clear-emp"
                style={{ background: '#e8efff', color: '#0d47c9', borderColor: '#bcd0ff' }}
                className="h-8 px-3 rounded-full text-xs font-bold border cursor-pointer inline-flex items-center gap-1">
                {selectedEmp?.name || errorSearchEmpId} <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {filteredErrors.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl py-12 text-center text-slate-500 text-sm" data-testid="perf-empty">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
              Không ghi nhận lỗi vi phạm nào trong bộ lọc hiện tại.
            </div>
          ) : (
            <div className="space-y-2.5" data-testid="perf-log">
              {filteredErrors.map(err => (
                <div key={err.id} data-testid={`perf-err-${err.id}`} className="bg-white border border-slate-200 rounded-2xl p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-bold text-slate-900 text-sm">{err.employeeName}</span>
                      <span className="font-mono text-[11px] text-slate-500">{err.employeeId}</span>
                      <span className={`${PILL} bg-violet-50 text-violet-700 border-violet-200`}>{getCatText(err.category)}</span>
                    </div>
                    <span className={`${PILL} bg-slate-50 text-slate-600 border-slate-200 font-mono`}><Clock className="w-3 h-3" />{fmtDate(err.date)}</span>
                  </div>

                  <div className="mt-2.5 space-y-1.5 text-[13px]">
                    <div><span className="text-slate-500">Lỗi vi phạm: </span><span className="font-bold text-amber-700">{err.criterionContent}</span></div>
                    {err.notes && <div><span className="text-slate-500">Ghi chú: </span><span className="text-slate-700 italic">"{err.notes}"</span></div>}
                    <div className="text-xs text-slate-500">Khung đánh giá: <span className="text-slate-700 font-medium">{err.departmentName}</span></div>
                    {err.images && err.images.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap pt-1">
                        {err.images.map((imgUrl, imgIdx) => (
                          <img key={imgIdx} src={imgUrl} alt={`Ảnh vi phạm ${imgIdx + 1}`}
                            className="w-14 h-14 object-cover rounded-lg border border-slate-200 hover:border-blue-400 transition-all cursor-zoom-in"
                            onClick={() => {
                              const w = window.open();
                              if (w) {
                                w.document.write(`<img src="${imgUrl}" style="max-width: 100vw; max-height: 100vh; object-fit: contain; margin: auto; display: block;" />`);
                              }
                            }} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Thao tác: Sửa / Xóa (xóa có bước xác nhận ngay tại thẻ, như cũ) */}
                  <div className="flex justify-end items-center gap-2 mt-3 pt-2.5 border-t border-slate-100">
                    {deletingErrorId === err.id ? (
                      <div className="flex items-center gap-2 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                        <span className="text-xs font-bold text-rose-700">Xác nhận xóa lỗi này?</span>
                        <button type="button" data-testid={`perf-confirm-delete-${err.id}`} onClick={() => { handleDeleteError(err.id); setDeletingErrorId(null); }}
                          className="h-7 px-2.5 rounded-lg text-xs font-bold cursor-pointer" style={{ background: '#e11d48', color: '#ffffff' }}>Đồng ý</button>
                        <button type="button" onClick={() => setDeletingErrorId(null)}
                          className="h-7 px-2.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700 cursor-pointer">Hủy</button>
                      </div>
                    ) : (
                      <>
                        <button type="button" className={iconBtn} title="Sửa lỗi" aria-label="Sửa lỗi" data-testid={`perf-edit-${err.id}`} onClick={() => handleEditErrorTrigger(err)}><Pencil className="w-3.5 h-3.5" /></button>
                        <button type="button" title="Xóa lỗi" aria-label="Xóa lỗi" data-testid={`perf-delete-${err.id}`} onClick={() => setDeletingErrorId(err.id)}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
