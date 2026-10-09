// ─── Phòng Giám Đốc: Bảng điều hành ──────────────────────────────────────────────────────────────────────────
// Thanh tab: Tổng Hợp (bảng điều hành chung) + 5 phòng ban. Mỗi tab là một màn hình riêng trong src/components/director/ (có bộ lọc, phân trang, chọn số dòng).
// File này chỉ còn lo thanh tab và chuyển màn hình; số liệu và giao diện nằm ở các màn hình con.
import React from 'react';
import { Folder, Users, DollarSign, Warehouse, Briefcase, ClipboardList } from 'lucide-react';
import { Project, Task, Receipt, Payment, Employee, Customer } from '../types';
import ExecutiveDashboard from './ExecutiveDashboard';
import ProjectsView from './director/ProjectsView';
import HrView from './director/HrView';
import AccountingView from './director/AccountingView';
import WarehouseView from './director/WarehouseView';
import SubcontractorView from './director/SubcontractorView';

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
  projects = [], tasks = [], receipts = [], payments = [], employees = [], customers = [],
  activeSubDepartment, onChangeSubDepartment, onNavigateTab,
}: DirectorDashboardProps) {
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
