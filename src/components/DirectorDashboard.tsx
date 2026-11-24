// ─── Phòng Giám Đốc: Bảng điều hành ──────────────────────────────────────────────────────────────────────────
// Thanh tab: Tổng Hợp (bảng điều hành chung) + 5 phòng ban. Mỗi tab là một màn hình riêng trong src/components/director/ (có bộ lọc, phân trang, chọn số dòng).
// File này chỉ còn lo thanh tab và chuyển màn hình; số liệu và giao diện nằm ở các màn hình con.
import React, { useEffect, useMemo, useState } from 'react';
import { Folder, Users, DollarSign, Warehouse, Briefcase, ClipboardList } from 'lucide-react';
import { Project, Task, Receipt, Payment, Employee, Customer } from '../types';
import ExecutiveDashboard from './ExecutiveDashboard';
import ProjectsView from './director/ProjectsView';
import HrView from './director/HrView';
import AccountingView from './director/AccountingView';
import WarehouseView from './director/WarehouseView';
import SubcontractorView from './director/SubcontractorView';
import { dbService } from '../lib/dbService';
import { withApprovedContractValue } from '../lib/projectContract';

type SubDept = 'projects' | 'hr' | 'accounting' | 'warehouse' | 'subcontractor' | 'summary';

interface DirectorDashboardProps {
  projects: Project[];
  tasks: Task[];
  receipts: Receipt[];
  payments: Payment[];
  employees: Employee[];
  customers: Customer[];
  currentUser: Employee;
  activeSubDepartment: SubDept;
  onChangeSubDepartment: (sub: SubDept) => void;
  onNavigateTab: (tabId: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onApprovePayment?: (id: string, status: 'approved' | 'rejected') => void;
}

// Thanh chuyển nhanh giữa các phòng ban (Tổng Hợp đứng đầu)
const NAV_TABS = [
  { id: 'summary', label: 'Tổng Hợp', icon: ClipboardList },
  { id: 'projects', label: 'Phòng Dự Án', icon: Folder },
  { id: 'hr', label: 'Phòng Nhân Sự', icon: Users },
  { id: 'accounting', label: 'Phòng Kế Toán', icon: DollarSign },
  { id: 'warehouse', label: 'Kho & Vật Tư', icon: Warehouse },
  { id: 'subcontractor', label: 'Nhà Thầu Phụ', icon: Briefcase },
] as const;

export default function DirectorDashboard({
  projects: rawProjects = [], tasks = [], receipts = [], payments = [], employees = [], customers = [],
  activeSubDepartment, onChangeSubDepartment, onNavigateTab,
}: DirectorDashboardProps) {
  // Giá trị hợp đồng của công trình: cộng các hợp đồng ĐÃ DUYỆT (cùng cách tính với Kế toán và bảng Kanban dự án), thay cho trường
  // project.contractValue lưu cứng — trường này không được cập nhật khi duyệt hợp đồng nên Phòng Giám Đốc từng hiện 0 dù Kế toán đã thấy.
  // Làm ở đây (một chỗ) để MỌI tab Giám đốc đều dùng cùng một số. Chưa tải xong thì tạm dùng giá trị đang lưu.
  const [quotes, setQuotes] = useState<any[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => { dbService.archivedQuotes.list().then(l => { if (alive) setQuotes(l || []); }).catch(() => { /* lỗi tải: giữ giá trị đang lưu */ }); };
    load();
    // Duyệt / hủy duyệt hợp đồng (ContractDocument) bắn đúng event này
    window.addEventListener('hl-archived-quotes-updated', load);
    return () => { alive = false; window.removeEventListener('hl-archived-quotes-updated', load); };
  }, []);
  const projects = useMemo(() => withApprovedContractValue(rawProjects, quotes), [rawProjects, quotes]);

  return (
    <div className="space-y-4" id="director_office_dashboard">
      <div className="flex flex-wrap gap-2 p-1 bg-white border border-slate-200 rounded-xl" role="tablist" aria-label="Phòng ban">
        {NAV_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubDepartment === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChangeSubDepartment(tab.id)}
              className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                isActive ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'text-slate-600 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeSubDepartment === 'summary' && (
        <ExecutiveDashboard projects={projects} tasks={tasks} receipts={receipts} payments={payments} employees={employees} onNavigateTab={onNavigateTab} />
      )}
      {activeSubDepartment === 'projects' && (
        <ProjectsView projects={projects} tasks={tasks} receipts={receipts} payments={payments} employees={employees} customers={customers} onNavigateTab={onNavigateTab} />
      )}
      {activeSubDepartment === 'hr' && <HrView employees={employees} onNavigateTab={onNavigateTab} />}
      {activeSubDepartment === 'accounting' && (
        <AccountingView projects={projects} receipts={receipts} payments={payments} customers={customers} onNavigateTab={onNavigateTab} />
      )}
      {activeSubDepartment === 'warehouse' && <WarehouseView projects={projects} onNavigateTab={onNavigateTab} />}
      {activeSubDepartment === 'subcontractor' && <SubcontractorView projects={projects} payments={payments} onNavigateTab={onNavigateTab} />}
    </div>
  );
}
