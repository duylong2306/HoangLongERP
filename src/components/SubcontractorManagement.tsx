import React, { useState, useEffect } from 'react';
import { dbService } from '../lib/dbService';
import { Employee, ArchivedQuote, Project } from '../types';
import { useNotification, isUserInRoleGroup } from '../context';
import {
  FileText,
  DollarSign,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import SubcontractorArchive from './SubcontractorArchive';

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

  const loadStats = async () => {
    try {
      const data = await dbService.archivedSubcontractorQuotes.list();
      const projs = await dbService.projects.list();
      void projs;

      // Filter based on role permissions similar to SubcontractorArchive
      const filtered = data.filter(item => {
        const isCreator = item.creatorId === currentUser.id;
        if (!isCreator && !isUserInRoleGroup(currentUser.id, 'role_admin') && !isUserInRoleGroup(currentUser.id, 'role_accounting')) return false;
        return true;
      });

      const totalVal = filtered.reduce((acc, item) => acc + (item.contractValue || 0), 0);
      const completed = filtered.filter(item => item.status === 'Hoàn thành').length;
      const doing = filtered.filter(item => item.status === 'Đang thực hiện' || !item.status).length;

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

  useEffect(() => {
    loadStats();
    // Re-load stats whenever subcontractor quotes are updated
    window.addEventListener('hl-archived-subcontractor-quotes-updated', loadStats);
    return () => {
      window.removeEventListener('hl-archived-subcontractor-quotes-updated', loadStats);
    };
  }, [currentUser]);

  return (
    <div className="space-y-6 animate-fade-in" id="subcontractor_management_panel">
      {/* 4-bento grid KPI metric card layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="subcontractor_kpi_cards">
        <div className="bg-slate-900 border border-slate-850 p-4.5 rounded-2xl flex items-center gap-4 shadow-xl text-left">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/15">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] text-slate-450 uppercase tracking-wider font-extrabold">Hợp đồng thầu phụ</span>
            <span className="block text-xl font-black text-slate-100 mt-0.5 font-mono">
              {stats.totalContracts} <span className="text-[10px] text-slate-500 font-sans font-normal">hợp đồng</span>
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-850 p-4.5 rounded-2xl flex items-center gap-4 shadow-xl text-left">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/15">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] text-slate-450 uppercase tracking-wider font-extrabold">Tổng giá trị khoán</span>
            <span className="block text-xl font-black text-emerald-400 mt-0.5 font-mono">
              {stats.totalValue.toLocaleString('vi-VN')} <span className="text-[10px] text-slate-500 font-sans font-normal">đ</span>
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-850 p-4.5 rounded-2xl flex items-center gap-4 shadow-xl text-left">
          <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/15">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] text-slate-450 uppercase tracking-wider font-extrabold">Đang thực thi</span>
            <span className="block text-xl font-black text-slate-100 mt-0.5 font-mono">
              {stats.doingCount} <span className="text-[10px] text-slate-500 font-sans font-normal">hạng mục</span>
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-850 p-4.5 rounded-2xl flex items-center gap-4 shadow-xl text-left">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/15">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] text-slate-450 uppercase tracking-wider font-extrabold">Nghiệm thu hoàn tất</span>
            <span className="block text-xl font-black text-slate-100 mt-0.5 font-mono">
              {stats.completedCount} <span className="text-[10px] text-slate-500 font-sans font-normal">hợp đồng</span>
            </span>
          </div>
        </div>
      </div>

      {/* Tab bar header — chỉ còn tab HỢP ĐỒNG THẦU PHỤ LIÊN KẾT ĐÃ LẬP */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-1.5 shadow-2xl" id="subcontractor_tab_workspace">
        <div className="flex border-b border-slate-800/80 px-4.5 pt-3 pb-0 gap-6 overflow-x-auto scrollbar-none" id="subcontractor_management_nav">
          <button
            type="button"
            className="text-xs font-black uppercase tracking-wider relative pb-3 transition-all cursor-pointer text-emerald-400"
          >
            🤝 HỢP ĐỒNG THẦU PHỤ LIÊN KẾT ĐÃ LẬP
            <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-emerald-500 rounded-full" />
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
    </div>
  );
}
