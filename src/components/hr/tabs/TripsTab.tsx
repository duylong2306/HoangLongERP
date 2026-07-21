import React from 'react';
import { FileSpreadsheet, Trash2 } from 'lucide-react';

interface TripItem {
  id: string;
  employeeId?: string;
  empId?: string;
  employeeName: string;
  amount: number;
  period: string;
  completedDate?: string;
  projectName?: string;
  customerName?: string;
  taskName?: string;
  missionName?: string;
  content?: string;
  month?: string;
  fuelFee?: number;
  mealFee?: number;
  lodgeFee?: number;
  otherFee?: number;
}

interface TripsTabProps {
  travelExpensesSummary: TripItem[];
  selectedEmpFilter: string;
  setSelectedEmpFilter: (v: string) => void;
  selectedMonthFilter: string;
  setSelectedMonthFilter: (v: string) => void;
  selectedYearFilter: string;
  setSelectedYearFilter: (v: string) => void;
  handleExportExcel: () => void;
  setClearingState: (s: { isOpen: boolean; tableName: string; targetTab: string }) => void;
}

export default function TripsTab({
  travelExpensesSummary,
  selectedEmpFilter,
  setSelectedEmpFilter,
  selectedMonthFilter,
  setSelectedMonthFilter,
  selectedYearFilter,
  setSelectedYearFilter,
  handleExportExcel,
  setClearingState,
}: TripsTabProps) {
  return (
    <div className="space-y-4">
      {/* BẢNG TỔNG HỢP CÔNG TÁC PHÍ */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        {travelExpensesSummary.length === 0 ? (
          <div className="py-6 text-center text-slate-500 italic text-[11px]">
            Chưa có phát sinh khoản Tổng hợp Công Tác Phí nào được ghi nhận từ Nhiệm vụ hoàn thành.
          </div>
        ) : travelExpensesSummary.filter(item => {
          if (selectedEmpFilter !== 'all' && item.employeeName !== selectedEmpFilter) return false;
          if (item.completedDate) {
            const parts = item.completedDate.split('/');
            if (parts.length === 3) {
              const itemMonth = String(parseInt(parts[1], 10));
              const itemYear = parts[2];
              if (selectedMonthFilter !== 'all' && itemMonth !== selectedMonthFilter) return false;
              if (selectedYearFilter !== 'all' && itemYear !== selectedYearFilter) return false;
            } else {
              const dateObj = new Date(item.completedDate);
              if (!isNaN(dateObj.getTime())) {
                const itemMonth = String(dateObj.getMonth() + 1);
                const itemYear = String(dateObj.getFullYear());
                if (selectedMonthFilter !== 'all' && itemMonth !== selectedMonthFilter) return false;
                if (selectedYearFilter !== 'all' && itemYear !== selectedYearFilter) return false;
              }
            }
          }
          return true;
        }).length === 0 ? (
          <div className="py-6 text-center text-slate-500 italic text-[11px]">
            Không có phát sinh khoản Công Tác Phí nào phù hợp với bộ lọc đã chọn.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">
                  <th className="py-2.5 px-3">Mã THCTP</th>
                  <th className="py-2.5 px-3">Ngày Hoàn Thành</th>
                  <th className="py-2.5 px-3">Tên Dự Án</th>
                  <th className="py-2.5 px-3">Khách hàng</th>
                  <th className="py-2.5 px-3">Công Việc</th>
                  <th className="py-2.5 px-3">Nhiệm Vụ</th>
                  <th className="py-2.5 px-3">Nhân Viên</th>
                  <th className="py-2.5 px-3">Nội Dung</th>
                  <th className="py-2.5 px-3 text-right">Số Tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {travelExpensesSummary
                  .filter(item => {
                    if (selectedEmpFilter !== 'all' && item.employeeName !== selectedEmpFilter) return false;
                    if (item.completedDate) {
                      const parts = item.completedDate.split('/');
                      if (parts.length === 3) {
                        const itemMonth = String(parseInt(parts[1], 10));
                        const itemYear = parts[2];
                        if (selectedMonthFilter !== 'all' && itemMonth !== selectedMonthFilter) return false;
                        if (selectedYearFilter !== 'all' && itemYear !== selectedYearFilter) return false;
                      } else {
                        const dateObj = new Date(item.completedDate);
                        if (!isNaN(dateObj.getTime())) {
                          const itemMonth = String(dateObj.getMonth() + 1);
                          const itemYear = String(dateObj.getFullYear());
                          if (selectedMonthFilter !== 'all' && itemMonth !== selectedMonthFilter) return false;
                          if (selectedYearFilter !== 'all' && itemYear !== selectedYearFilter) return false;
                        }
                      }
                    }
                    return true;
                  })
                  .map((item) => (
                    <tr key={item.id} className="hover:bg-slate-850/40 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-400">{item.id}</td>
                      <td className="py-2.5 px-3 text-slate-350">{item.completedDate}</td>
                      <td className="py-2.5 px-3 font-medium text-white max-w-[150px] truncate" title={item.projectName}>{item.projectName}</td>
                      <td className="py-2.5 px-3 text-slate-400 max-w-[120px] truncate" title={item.customerName}>{item.customerName}</td>
                      <td className="py-2.5 px-3 text-slate-330 max-w-[140px] truncate" title={item.taskName}>{item.taskName}</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-medium max-w-[140px] truncate" title={item.missionName}>{item.missionName}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{item.employeeName}</td>
                      <td className="py-2.5 px-3 text-slate-400 max-w-[150px] truncate" title={item.content}>{item.content}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-amber-500">
                        {Number(item.amount).toLocaleString('vi-VN')} đ
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-950/40 border-t border-slate-800 font-bold">
                  <td colSpan={8} className="py-3 px-3 text-right text-slate-400 uppercase tracking-lighter font-extrabold">Tổng cộng:</td>
                  <td className="py-3 px-3 text-right text-amber-500 font-mono font-extrabold text-xs">
                    {travelExpensesSummary
                      .filter(item => {
                        if (selectedEmpFilter !== 'all' && item.employeeName !== selectedEmpFilter) return false;
                        if (item.completedDate) {
                          const parts = item.completedDate.split('/');
                          if (parts.length === 3) {
                            const itemMonth = String(parseInt(parts[1], 10));
                            const itemYear = parts[2];
                            if (selectedMonthFilter !== 'all' && itemMonth !== selectedMonthFilter) return false;
                            if (selectedYearFilter !== 'all' && itemYear !== selectedYearFilter) return false;
                          } else {
                            const dateObj = new Date(item.completedDate);
                            if (!isNaN(dateObj.getTime())) {
                              const itemMonth = String(dateObj.getMonth() + 1);
                              const itemYear = String(dateObj.getFullYear());
                              if (selectedMonthFilter !== 'all' && itemMonth !== selectedMonthFilter) return false;
                              if (selectedYearFilter !== 'all' && itemYear !== selectedYearFilter) return false;
                            }
                          }
                        }
                        return true;
                      })
                      .reduce((sum, item) => sum + Number(item.amount || 0), 0)
                      .toLocaleString('vi-VN')} đ
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
