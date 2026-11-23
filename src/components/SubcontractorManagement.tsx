import { paymentBelongsToSubcontractor } from '../lib/liabilityPayments';
import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../lib/dbService';
import { Employee, ArchivedQuote, Project, Payment } from '../types';
import { useNotification, isUserInRoleGroup, isRoleAdmin, isRoleAccounting } from '../context';
import {
  FileText,
  DollarSign,
  CheckCircle2,
  Layers,
  Wallet,
} from 'lucide-react';
import SubcontractorArchive from './SubcontractorArchive';
import TablePagination, { usePagination } from './TablePagination';

interface SubcontractorManagementProps {
  currentUser: Employee;
  canEdit?: boolean;
  canDelete?: boolean;
  /** Khi truyền vào, SubcontractorArchive sẽ auto-mở print preview cho HĐ này. */
  viewContractId?: string;
}

/**
 * QUẢN LÝ THẦU PHỤ — hiện chỉ còn phần "HỢP ĐỒNG THẦU PHỤ LIÊN KẾT ĐÃ LẬP".
 * Tab "DANH SÁCH THẦU PHỤ" đã chuyển sang Dữ Liệu Kế Toán (SubcontractorDirectory).
 */
export default function SubcontractorManagement({
  currentUser,
  canEdit = true,
  canDelete = true,
  viewContractId
}: SubcontractorManagementProps) {
  const { addToast } = useNotification();
  const [stats, setStats] = useState({
    totalContracts: 0,
    totalValue: 0,
    completedCount: 0,
    doingCount: 0,
  });
  // Toàn bộ HĐ thầu phụ (đã lọc theo quyền) — dùng cả cho thống kê và Công nợ Trả
  const [subQuotes, setSubQuotes] = useState<ArchivedQuote[]>([]);
  // Danh sách phiếu chi/thu để tính Công nợ Trả đã thanh toán
  const [payments, setPayments] = useState<Payment[]>([]);

  const loadStats = async () => {
    try {
      const data = await dbService.archivedSubcontractorQuotes.list();
      const projs = await dbService.projects.list();
      void projs;

      // Filter based on role permissions similar to SubcontractorArchive
      const filtered = data.filter(item => {
        const isCreator = item.creatorId === currentUser.id;
        if (!isCreator && !isRoleAdmin(currentUser.id) && !isRoleAccounting(currentUser.id)) return false;
        return true;
      });

      const totalVal = filtered.reduce((acc, item) => acc + (item.contractValue || 0), 0);
      const completed = filtered.filter(item => item.status === 'Hoàn thành').length;
      const doing = filtered.filter(item => item.status === 'Đang thực hiện' || !item.status).length;

      setSubQuotes(filtered);
      setStats({
        totalContracts: filtered.length,
        totalValue: totalVal,
        completedCount: completed,
        doingCount: doing
      });
    } catch (err) {
      console.error("Lỗi khi tính toán thống kê thầu phụ:", err);
    }
  };

  // Tải phiếu chi/thu để tính số tiền đã thanh toán trên Công nợ Trả thầu phụ
  useEffect(() => {
    const loadPayments = async () => {
      try {
        const pays = await dbService.payments.list();
        setPayments(pays || []);
      } catch (err) {
        console.error("Lỗi khi tải phiếu thu/chi:", err);
      }
    };
    loadPayments();
    const onPayUpdate = () => loadPayments();
    window.addEventListener('hl-payments-updated', onPayUpdate);
    window.addEventListener('hl-subcontractor-advances-updated', onPayUpdate);
    return () => {
      window.removeEventListener('hl-payments-updated', onPayUpdate);
      window.removeEventListener('hl-subcontractor-advances-updated', onPayUpdate);
    };
  }, []);

  useEffect(() => {
    loadStats();
    // Re-load stats whenever subcontractor quotes are updated.
    // 2 tên event khác nhau, cả 2 đều cần nghe:
    // - 'hl-archived-subcontractor-quotes-updated': tự bắn khi CHÍNH tab đó lưu
    //   (SubcontractorEstimator.tsx/SubcontractorArchive.tsx) — phản hồi tức thời.
    // - 'hl-archived-quotes-updated': App.tsx bắn định kỳ mỗi 5 phút (bảng
    //   archived_quotes thuộc nhóm "ít đổi" chuyển sang polling) — đây mới là
    //   tên ĐÚNG để nhận biết hợp đồng do tab/người khác lập/duyệt. Trước đây
    //   chỉ nghe tên đầu (sai hoàn toàn với tên App.tsx thực bắn).
    const onUpdate = () => loadStats();
    window.addEventListener('hl-archived-subcontractor-quotes-updated', onUpdate);
    window.addEventListener('hl-archived-quotes-updated', onUpdate);
    return () => {
      window.removeEventListener('hl-archived-subcontractor-quotes-updated', onUpdate);
      window.removeEventListener('hl-archived-quotes-updated', onUpdate);
    };
  }, [currentUser]);

  // Công nợ Trả thầu phụ: tổng hợp từ HĐ thầu phụ ĐÃ DUYỆT, link qua subcontractorId (dự phòng tên).
  // Mỗi thầu phụ: giá trị HĐ khoán - số tiền phiếu chi đã duyệt → còn lại.
  const subcontractorLiabilities = useMemo(() => {
    const approved = subQuotes.filter(q => q.isApproved === true);
    const map = new Map<string, { subcontractorId: string; subcontractorName: string; value: number; paid: number; contracts: number }>();
    approved.forEach(q => {
      const sid = q.subcontractorId || '';
      const sname = q.subcontractorName || q.subcontractorId || 'Vãng lai';
      const key = sid || sname;
      if (!map.has(key)) map.set(key, { subcontractorId: sid, subcontractorName: sname, value: 0, paid: 0, contracts: 0 });
      const e = map.get(key)!;
      e.value += (q.contractValue || 0);
      e.contracts += 1;
    });
    payments.forEach(p => {
      if (p.status !== 'approved') return;
      for (const [, e] of map) {
        // Theo MÃ thầu phụ trước; chỉ phiếu cũ chưa có mã mới dự phòng theo tên (không tính phiếu trả NCC cùng tên)
        if (paymentBelongsToSubcontractor(p, { id: e.subcontractorId, name: e.subcontractorName })) {
          e.paid += (p.amount || 0);
          break;
        }
      }
    });
    return Array.from(map.values())
      .map(e => ({ ...e, remaining: e.value - e.paid }))
      .filter(e => e.value > 0)
      .sort((a, b) => b.remaining - a.remaining);
  }, [subQuotes, payments]);

  // Phân trang bảng Công nợ Trả theo thầu phụ (mặc định 10 dòng/trang, chọn 5/10/20/50/Tất cả)
  const liabPg = usePagination(10);
  const totalLiabilityRemaining = subcontractorLiabilities.reduce((s, e) => s + e.remaining, 0);
  const totalLiabilityValue = subcontractorLiabilities.reduce((s, e) => s + e.value, 0);
  const totalLiabilityPaid = subcontractorLiabilities.reduce((s, e) => s + e.paid, 0);

  // Thẻ chỉ số kiểu LoLo: nền trắng, viền nhạt, biểu tượng xanh LoLo (số âm/đỏ chỉ dùng cho công nợ còn lại)
  const kpiCard = 'bg-white border border-slate-200 p-4 rounded-2xl flex items-center gap-4 text-left';
  const kpiIcon = 'p-3 bg-[#e8efff] text-[#0d47c9] rounded-xl border border-[#bcd0ff]';
  const kpiLabel = 'block text-[12px] text-slate-500 font-bold';

  return (
    <div className="space-y-6 animate-fade-in" id="subcontractor_management_panel">
      {/* Thẻ chỉ số */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" id="subcontractor_kpi_cards">
        <div className={kpiCard}>
          <div className={kpiIcon}><Layers className="w-5 h-5" /></div>
          <div>
            <span className={kpiLabel}>Hợp đồng thầu phụ</span>
            <span className="block text-xl font-extrabold text-slate-800 mt-0.5 font-mono">
              {stats.totalContracts} <span className="text-[12px] text-slate-500 font-sans font-normal">hợp đồng</span>
            </span>
          </div>
        </div>

        <div className={kpiCard}>
          <div className={kpiIcon}><DollarSign className="w-5 h-5" /></div>
          <div>
            <span className={kpiLabel}>Tổng giá trị khoán</span>
            <span className="block text-xl font-extrabold text-[#0d47c9] mt-0.5 font-mono">
              {stats.totalValue.toLocaleString('vi-VN')} <span className="text-[12px] text-slate-500 font-sans font-normal">đ</span>
            </span>
          </div>
        </div>

        <div className={kpiCard}>
          <div className={kpiIcon}><CheckCircle2 className="w-5 h-5" /></div>
          <div>
            <span className={kpiLabel}>Đang thực thi</span>
            <span className="block text-xl font-extrabold text-slate-800 mt-0.5 font-mono">
              {stats.doingCount} <span className="text-[12px] text-slate-500 font-sans font-normal">hạng mục</span>
            </span>
          </div>
        </div>

        <div className={kpiCard}>
          <div className={kpiIcon}><FileText className="w-5 h-5" /></div>
          <div>
            <span className={kpiLabel}>Nghiệm thu hoàn tất</span>
            <span className="block text-xl font-extrabold text-slate-800 mt-0.5 font-mono">
              {stats.completedCount} <span className="text-[12px] text-slate-500 font-sans font-normal">hợp đồng</span>
            </span>
          </div>
        </div>

        {/* Công nợ còn lại: giữ tông đỏ nhạt để dễ nhận biết khoản phải trả */}
        <div className="bg-white border border-rose-200 p-4 rounded-2xl flex items-center gap-4 text-left">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-200"><Wallet className="w-5 h-5" /></div>
          <div>
            <span className={kpiLabel}>Công nợ trả còn lại</span>
            <span className="block text-xl font-extrabold text-rose-600 mt-0.5 font-mono">
              {totalLiabilityRemaining.toLocaleString('vi-VN')} <span className="text-[12px] text-slate-500 font-sans font-normal">đ</span>
            </span>
          </div>
        </div>
      </div>

      {/* Khung chứa danh sách hợp đồng — chỉ còn tab "Hợp đồng thầu phụ liên kết đã lập" */}
      <div className="bg-white rounded-2xl border border-slate-200" id="subcontractor_tab_workspace">
        <div className="flex border-b border-slate-200 px-5 pt-3 pb-0 gap-6 overflow-x-auto scrollbar-none" id="subcontractor_management_nav">
          <button
            type="button"
            className="text-[13px] font-extrabold relative pb-3 transition-all cursor-pointer text-[#0d47c9] whitespace-nowrap"
          >
            Hợp đồng thầu phụ liên kết đã lập
            <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#0d47c9] rounded-full" />
          </button>
        </div>

        <div className="p-4" id="subcontractor_tab_content">
          <div id="subcontractor_archive_wrapper">
            <SubcontractorArchive
              currentUser={currentUser}
              canEdit={canEdit}
              canDelete={canDelete}
              viewContractId={viewContractId}
            />
          </div>
        </div>
      </div>

      {/* Công nợ trả theo thầu phụ — liên kết trực tiếp với hồ sơ thầu phụ qua subcontractorId */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#0d47c9]" />
            <h3 className="font-extrabold text-slate-800 text-[15px]">Công nợ trả theo thầu phụ</h3>
          </div>
          <span className="bg-[#e8efff] border border-[#bcd0ff] text-[#0d47c9] text-[12px] px-2.5 py-0.5 rounded-full font-bold">
            {subcontractorLiabilities.length} thầu phụ
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <span className="block text-[12px] text-slate-500 font-bold">Tổng giá trị HĐ</span>
            <span className="block text-base font-extrabold text-slate-800 mt-1 font-mono">{totalLiabilityValue.toLocaleString('vi-VN')} đ</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <span className="block text-[12px] text-slate-500 font-bold">Đã thanh toán</span>
            <span className="block text-base font-extrabold text-emerald-600 mt-1 font-mono">-{totalLiabilityPaid.toLocaleString('vi-VN')} đ</span>
          </div>
          <div className="bg-white border border-rose-200 rounded-xl p-3">
            <span className="block text-[12px] text-slate-500 font-bold">Còn lại</span>
            <span className="block text-base font-extrabold text-rose-600 mt-1 font-mono">{totalLiabilityRemaining.toLocaleString('vi-VN')} đ</span>
          </div>
        </div>

        {subcontractorLiabilities.length === 0 ? (
          <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-500 italic text-[13px]">
            Chưa có công nợ thầu phụ nào (chưa có HĐ thầu phụ được duyệt).
          </div>
        ) : (
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[12px]">
                    <th className="px-3 py-2.5">Thầu phụ</th>
                    <th className="px-3 py-2.5 text-right">Giá trị HĐ</th>
                    <th className="px-3 py-2.5 text-right">Đã chi</th>
                    <th className="px-3 py-2.5 text-right">Còn lại</th>
                    <th className="px-3 py-2.5 text-center">Số HĐ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {liabPg.slice(subcontractorLiabilities).map(li => (
                    <tr key={li.subcontractorId || li.subcontractorName} className="hover:bg-[#e8efff]/40 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="font-extrabold text-slate-800">{li.subcontractorName}</div>
                        {li.subcontractorId && (
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">{li.subcontractorId.toUpperCase()}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">{li.value.toLocaleString('vi-VN')} đ</td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-600">-{li.paid.toLocaleString('vi-VN')} đ</td>
                      <td className="px-3 py-2.5 text-right font-mono font-extrabold text-rose-600">{li.remaining > 0 ? `${li.remaining.toLocaleString('vi-VN')} đ` : '0 đ'}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-slate-500">{li.contracts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination {...liabPg.props(subcontractorLiabilities.length)} unit="thầu phụ" testId="sub-liab-pager" />
          </div>
        )}
      </div>
    </div>
  );
}
