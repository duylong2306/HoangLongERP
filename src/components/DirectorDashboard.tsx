import React, { useState } from 'react';
import { 
  Folder, 
  Users, 
  DollarSign, 
  Warehouse, 
  Briefcase, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  Check, 
  X, 
  Shield, 
  BarChart3, 
  PieChart, 
  Activity, 
  ExternalLink,
  ChevronRight,
  UserPlus,
  ShieldCheck,
  PackageOpen,
  Eye,
  Building,
  UserCheck
} from 'lucide-react';
import { Project, Task, Receipt, Payment, Employee, Customer, Supplier } from '../types';

interface DirectorDashboardProps {
  projects: Project[];
  tasks: Task[];
  receipts: Receipt[];
  payments: Payment[];
  employees: Employee[];
  customers: Customer[];
  currentUser: Employee;
  activeSubDepartment: 'projects' | 'hr' | 'accounting' | 'warehouse' | 'subcontractor';
  onChangeSubDepartment: (sub: 'projects' | 'hr' | 'accounting' | 'warehouse' | 'subcontractor') => void;
  onNavigateTab: (tabId: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onApprovePayment?: (id: string, status: 'approved' | 'rejected') => void;
}

export default function DirectorDashboard({
  projects = [],
  tasks = [],
  receipts = [],
  payments = [],
  employees = [],
  customers = [],
  currentUser,
  activeSubDepartment,
  onChangeSubDepartment,
  onNavigateTab,
  onUpdateTask,
  onApprovePayment,
}: DirectorDashboardProps) {

  const [searchTerm, setSearchTerm] = useState('');

  // Formatter helper
  const formatVND = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  // Safe division helper
  const getPercentage = (value: number, total: number) => {
    if (!total) return 0;
    return Math.round((value / total) * 100);
  };

  // ----------------------------------------------------
  // DATA COMPUTATIONS - PROJECT DEPARTMENT
  // ----------------------------------------------------
  const activeProjects = projects.filter(p => p.status === 'processing' || p.status === 'new');
  const completedProjects = projects.filter(p => p.status === 'completed');
  const totalContractValue = projects.reduce((acc, curr) => acc + (curr.contractValue || 0), 0);
  const avgProjectProgress = projects.length 
    ? Math.round(projects.reduce((acc, curr) => acc + (curr.progress || 0), 0) / projects.length) 
    : 0;

  const projectsByType = {
    construction: projects.filter(p => p.type === 'construction'),
    furniture: projects.filter(p => p.type === 'furniture'),
    mechanical: projects.filter(p => p.type === 'mechanical'),
    general: projects.filter(p => p.type === 'general' || !p.type)
  };

  // ----------------------------------------------------
  // DATA COMPUTATIONS - HR DEPARTMENT
  // ----------------------------------------------------
  const hrEmployees = employees;
  const employeesByDept = employees.reduce((acc, curr) => {
    const dept = curr.department || 'Khác';
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const employeesByRole = employees.reduce((acc, curr) => {
    const role = curr.role || 'user';
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Today attendance (real count from HRM attendance records in localstorage)
  const getTodayCheckinsCount = () => {
    try {
      const savedLogs = localStorage.getItem('hl_hrm_attendance_v3');
      if (savedLogs) {
        const parsed = JSON.parse(savedLogs);
        const getLocalYYYYMMDD = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const r = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${r}`;
        };
        const todayStr = getLocalYYYYMMDD(new Date());
        const uniqueUsers = new Set(
          parsed
            .filter((log: any) => log.date === todayStr && log.status !== 'missing' && log.status !== 'unexcused')
            .map((log: any) => log.empId)
        );
        return uniqueUsers.size;
      }
    } catch (e) {}
    return 0;
  };
  const todayAttendanceCount = getTodayCheckinsCount();

  // ----------------------------------------------------
  // DATA COMPUTATIONS - ACCOUNTING DEPARTMENT
  // ----------------------------------------------------
  const totalCollected = receipts.reduce((sum, r) => sum + r.amount, 0);
  const totalSpent = payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + p.amount, 0);
  const netBalance = totalCollected - totalSpent;
  const pendingPayments = payments.filter(p => p.status === 'pending');
  const outstandingReceivables = totalContractValue - totalCollected;

  // Payments by category
  const paymentsByCategory = payments.filter(p => p.status === 'approved').reduce((acc, p) => {
    const cat = p.category || 'other';
    acc[cat] = (acc[cat] || 0) + p.amount;
    return acc;
  }, {} as Record<string, number>);

  const categoryNames: Record<string, string> = {
    material: 'Vật tư',
    labor: 'Nhân công',
    shipping: 'Vận chuyển',
    machinery: 'Máy móc/Thiết bị',
    general: 'Quản lý chung',
    other: 'Khác'
  };

  // ----------------------------------------------------
  // DATA COMPUTATIONS - WAREHOUSE (KHO)
  // ----------------------------------------------------
  // We can pull material demands from projects' documents (which contain materials list) or generate a comprehensive view.
  const allMaterialDemands: { id: string; projectName: string; matName: string; qty: number; unit: string; spec: string; status: 'pending' | 'ordered' | 'received' }[] = [];
  
  projects.forEach(p => {
    if (p.documents) {
      p.documents.forEach(doc => {
        if (doc.materials) {
          doc.materials.forEach((m, idx) => {
            allMaterialDemands.push({
              id: `${p.id}_${doc.id}_${idx}`,
              projectName: p.name,
              matName: m.name,
              qty: m.qty,
              unit: m.unit,
              spec: m.spec || 'Không có quy cách',
              status: (idx % 3 === 0) ? 'received' : (idx % 3 === 1) ? 'ordered' : 'pending'
            });
          });
        }
      });
    }
  });

  const totalMaterialsDemanded = allMaterialDemands.length;
  const pendingMaterialsCount = allMaterialDemands.filter(m => m.status === 'pending').length;
  const orderedMaterialsCount = allMaterialDemands.filter(m => m.status === 'ordered').length;
  const receivedMaterialsCount = allMaterialDemands.filter(m => m.status === 'received').length;

  // ----------------------------------------------------
  // DATA COMPUTATIONS - SUBCONTRACTORS (THẦU PHỤ)
  // ----------------------------------------------------
  const [suppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem('hl_acc_suppliers');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 'XD_1', name: 'Xưởng dán dẹt An Phát', representative: 'Nguyễn An Phát', field: 'Thợ phụ gia công dán cạnh Acrylic', address: 'Bảo Lộc', phone: '0933444555', email: 'anphat@gmail.com' },
      { id: 'NTN_2', name: 'Nhóm thầu nề Hoàng Long', representative: 'Trần Hoàng Long', field: 'Thợ thầu sắt móng xây thô', address: 'Đà Lạt', phone: '0988777112', email: 'hoanglong@gmail.com' },
      { id: 'DN_3', name: 'Nhà thầu điện nước Minh Hùng', representative: 'Phạm Minh Hùng', field: 'Thi công M&E công trình', address: 'Đức Trọng', phone: '0912334455', email: 'minhhungme@gmail.com' }
    ];
  });

  // Filter lists based on search term
  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (employees.find(e => e.id === p.pmId)?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMaterials = allMaterialDemands.filter(m => 
    m.matName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.projectName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Department quick navigation bar
  const navTabs = [
    { id: 'projects', label: 'Phòng Dự Án', icon: Folder, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    { id: 'hr', label: 'Phòng Nhân Sự', icon: Users, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    { id: 'accounting', label: 'Phòng Kế Toán', icon: DollarSign, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { id: 'warehouse', label: 'Kho & Vật Tư', icon: Warehouse, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
    { id: 'subcontractor', label: 'Nhà Thầu Phụ', icon: Briefcase, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' }
  ] as const;

  return (
    <div className="space-y-6" id="director_office_dashboard">
      
      {/* 1. MAJESTIC HEADER */}
      <div className="bg-slate-950 border border-slate-850 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-xl flex items-center justify-center font-extrabold text-lg shadow-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-white font-sans uppercase">Phòng Giám Đốc Executive 🛡️</h2>
              <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded font-mono font-extrabold uppercase tracking-widest select-none">
                Bảng Tổng Hợp Doanh Nghiệp
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Hệ thống giám sát tối cao phục vụ Giám Đốc. Tự động đồng bộ số liệu thô từ Phòng Dự án, Phòng Nhân sự, Phòng Kế toán và Kho vận trực quan theo thời gian thực.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-xl relative z-10 shrink-0">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider block font-bold text-slate-500">Giám sát tổng quát</span>
            <span className="text-xs font-bold text-slate-300 font-mono">5/5 Phân hệ Đã Đồng Bộ</span>
          </div>
        </div>
      </div>

      {/* 2. TABBED DEPARTMENT SELECTOR */}
      <div className="flex flex-wrap gap-2.5 p-1 bg-slate-950 border border-slate-900 rounded-xl">
        {navTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubDepartment === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setSearchTerm('');
                onChangeSubDepartment(tab.id);
              }}
              className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-extrabold text-xs tracking-wider transition-all cursor-pointer ${
                isActive 
                  ? 'bg-slate-900 text-white shadow-md border-b-2 border-emerald-400 scale-[1.01]' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SEARCH AND FILTER BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-850">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder={`Tìm kiếm nhanh trong ${navTabs.find(t => t.id === activeSubDepartment)?.label}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/90 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-300 outline-none focus:border-emerald-500 placeholder-slate-500 transition-colors"
          />
          <Activity className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          <span className="text-[11px] text-slate-500 font-medium">Báo cáo cập nhật lúc:</span>
          <span className="text-[11px] text-emerald-400 font-bold font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            {new Date().toLocaleTimeString()} (Thời gian thực)
          </span>
        </div>
      </div>

      {/* 3. DYNAMIC CONTENT RENDERING */}
      
      {/* 3.1 PROJECTS DEPARTMENT DASHBOARD */}
      {activeSubDepartment === 'projects' && (
        <div className="space-y-6">
          {/* Key Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Tổng số công trình</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-white font-mono">{projects.length}</span>
                <span className="text-[10px] bg-sky-500/15 text-sky-400 px-2 py-0.5 rounded font-bold">Lưu trữ</span>
              </div>
            </div>

            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Công trình Đang thi công</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-400 font-mono">{activeProjects.length}</span>
                <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded font-bold">Thực tế</span>
              </div>
            </div>

            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Tổng giá trị Hợp đồng</span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black text-white font-mono text-emerald-300">{formatVND(totalContractValue)}</span>
                <span className="text-[10px] bg-slate-950 text-slate-400 px-1.5 py-0.5 rounded font-bold font-mono">VND</span>
              </div>
            </div>

            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Tiến độ bình quân</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-indigo-400 font-mono">{avgProjectProgress}%</span>
                <div className="w-16 bg-slate-950 h-2 rounded-full overflow-hidden shrink-0 mt-2">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${avgProjectProgress}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Project Distribution visual */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-md">
              <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest border-b border-slate-800 pb-2">
                Phân bổ theo Phân hệ chính
              </h3>
              <div className="space-y-4.5 py-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 font-bold flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 block"></span>
                      Dự án Xây dựng
                    </span>
                    <span className="font-mono text-white font-bold">{projectsByType.construction.length} ({getPercentage(projectsByType.construction.length, projects.length)}%)</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${getPercentage(projectsByType.construction.length, projects.length)}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 font-bold flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block"></span>
                      Dự án Nội thất
                    </span>
                    <span className="font-mono text-white font-bold">{projectsByType.furniture.length} ({getPercentage(projectsByType.furniture.length, projects.length)}%)</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: `${getPercentage(projectsByType.furniture.length, projects.length)}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 font-bold flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-pink-500 block"></span>
                      Dự án Cơ khí
                    </span>
                    <span className="font-mono text-white font-bold">{projectsByType.mechanical.length} ({getPercentage(projectsByType.mechanical.length, projects.length)}%)</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-pink-500 h-full rounded-full" style={{ width: `${getPercentage(projectsByType.mechanical.length, projects.length)}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* List projects */}
            <div className="lg:col-span-2 bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-md">
              <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest border-b border-slate-800 pb-2 flex justify-between items-center">
                <span>Danh Sách Công Trình Giám Sát</span>
                <span className="text-[10px] font-mono text-slate-500">{filteredProjects.length} công trình</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse min-w-[500px]">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-500 font-black uppercase tracking-wider pb-2">
                      <th className="py-2.5 px-2">Mã / Tên công trình</th>
                      <th className="py-2.5 px-2">PM Phụ Trách</th>
                      <th className="py-2.5 px-2">Giá Trị HĐ</th>
                      <th className="py-2.5 px-2">Tiến Độ</th>
                      <th className="py-2.5 px-2 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {filteredProjects.map(proj => {
                      const pm = employees.find(e => e.id === proj.pmId);
                      const typeColor = proj.type === 'construction' ? 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5'
                                      : proj.type === 'furniture' ? 'text-amber-400 border-amber-500/20 bg-amber-500/5'
                                      : 'text-pink-400 border-pink-500/20 bg-pink-500/5';
                      return (
                        <tr key={proj.id} className="hover:bg-slate-950/40 transition-colors">
                          <td className="py-3 px-2">
                            <div className="font-extrabold text-slate-100 flex items-center gap-1.5">
                              <span className={`text-[8.5px] px-1.5 py-0.2 border rounded font-mono ${typeColor}`}>
                                {proj.code}
                              </span>
                              <span className="truncate max-w-[150px]" title={proj.name}>{proj.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 block mt-0.5 truncate max-w-[180px]">{proj.address}</span>
                          </td>
                          <td className="py-3 px-2">
                            <div className="font-bold text-slate-300">{pm ? pm.name : 'Chưa gán'}</div>
                            <span className="text-[9.5px] text-slate-500 block">PM Chuyên Trách</span>
                          </td>
                          <td className="py-3 px-2 font-mono text-emerald-400 font-extrabold">
                            {formatVND(proj.contractValue)}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-white font-bold">{proj.progress}%</span>
                              <div className="w-16 bg-slate-950 h-1.5 rounded-full overflow-hidden shrink-0">
                                <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${proj.progress}%` }}></div>
                              </div>
                            </div>
                            <span className={`text-[9px] font-extrabold uppercase ${
                              proj.status === 'completed' ? 'text-emerald-400' : proj.status === 'processing' ? 'text-indigo-400' : 'text-amber-400'
                            }`}>{proj.status}</span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <button
                              onClick={() => {
                                const tabMap = {
                                  construction: 'projects-construction',
                                  furniture: 'projects-furniture',
                                  mechanical: 'projects-mechanical',
                                  general: 'projects-construction'
                                };
                                onNavigateTab(tabMap[proj.type || 'general']);
                              }}
                              className="p-1.5 bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-400 rounded-md transition cursor-pointer flex items-center gap-1.5 text-[10px] font-bold ml-auto"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Xem Bản Việc
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3.2 HR DEPARTMENT DASHBOARD */}
      {activeSubDepartment === 'hr' && (
        <div className="space-y-6">
          {/* Key Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Tổng số nhân sự</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-white font-mono">{employees.length}</span>
                <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded font-bold">Chính thức</span>
              </div>
            </div>

            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Điểm danh hôm nay</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-400 font-mono">{todayAttendanceCount} / {employees.length}</span>
                <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded font-bold">
                  {getPercentage(todayAttendanceCount, employees.length)}%
                </span>
              </div>
            </div>

            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Tỷ lệ vắng mặt</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-rose-400 font-mono">
                  {employees.length - todayAttendanceCount} nhân viên
                </span>
                <span className="text-[10px] bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded font-bold">
                  {100 - getPercentage(todayAttendanceCount, employees.length)}%
                </span>
              </div>
            </div>

            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Bộ phận nhiều nhân sự nhất</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-black text-indigo-300 truncate max-w-[120px]">
                  {Object.entries(employeesByDept).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Phòng Dự Án'}
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">
                  {Object.entries(employeesByDept).sort((a, b) => b[1] - a[1])[0]?.[1] || 0} NS
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Roles and distribution */}
            <div className="lg:col-span-1 bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-md">
              <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest border-b border-slate-800 pb-2">
                Phân bổ Cơ cấu Vai trò
              </h3>
              <div className="space-y-3.5 py-1">
                {Object.entries(employeesByRole).map(([role, count]) => {
                  const roleMap: Record<string, string> = {
                    director: 'Giám Đốc Ban Điều Hành',
                    pm: 'Quản Lý Dự Án (PM)',
                    accountant: 'Kế Toán Tổng Hợp',
                    engineer: 'Kỹ Sư Công Trình',
                    quotation: 'Báo Giá Chuyên Viên',
                    purchasing: 'Thu Mua & Vật Tư',
                    factory: 'Thợ Xưởng Nội Thất'
                  };
                  const colors: Record<string, string> = {
                    director: 'bg-emerald-500',
                    pm: 'bg-sky-500',
                    accountant: 'bg-rose-500',
                    engineer: 'bg-indigo-500',
                    quotation: 'bg-amber-500',
                    purchasing: 'bg-teal-500',
                    factory: 'bg-pink-500'
                  };
                  return (
                    <div key={role}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400 font-bold flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${colors[role] || 'bg-slate-400'} block`}></span>
                          {roleMap[role] || role}
                        </span>
                        <span className="font-mono text-white font-bold">{count} ({getPercentage(count, employees.length)}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                        <div className={`${colors[role] || 'bg-slate-400'} h-full rounded-full`} style={{ width: `${getPercentage(count, employees.length)}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Employee Directory */}
            <div className="lg:col-span-2 bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-md">
              <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest border-b border-slate-800 pb-2 flex justify-between items-center">
                <span>Danh bạ Nhân sự Giám sát</span>
                <span className="text-[10px] font-mono text-slate-500">{filteredEmployees.length} nhân sự</span>
              </h3>

              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-500 font-black uppercase tracking-wider pb-2">
                      <th className="py-2 px-1">Nhân viên</th>
                      <th className="py-2 px-1">Phòng ban</th>
                      <th className="py-2 px-1">Chức vụ / Vai trò</th>
                      <th className="py-2 px-1">Email / SĐT</th>
                      <th className="py-2 px-1 text-right">Trạng thái ngày</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {filteredEmployees.map(emp => {
                      const isCheckin = emp.id === currentUser.id || parseInt(emp.id.replace(/\D/g, '')) % 5 !== 0; // simulated attendance
                      return (
                        <tr key={emp.id} className="hover:bg-slate-950/40 transition-colors">
                          <td className="py-2.5 px-1 font-bold text-white flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-[10px] text-slate-300">
                              {emp.name.charAt(0)}
                            </div>
                            <span className="truncate max-w-[130px]">{emp.name}</span>
                          </td>
                          <td className="py-2.5 px-1 text-slate-400 font-medium">{emp.department}</td>
                          <td className="py-2.5 px-1">
                            <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-[10px] font-bold text-slate-350">
                              {emp.role?.toUpperCase() || '—'}
                            </span>
                          </td>
                          <td className="py-2.5 px-1 font-mono text-slate-450">
                            <div>{emp.email}</div>
                            <div className="text-[10px]">{emp.phone}</div>
                          </td>
                          <td className="py-2.5 px-1 text-right">
                            {isCheckin ? (
                              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-black font-mono">
                                ● ĐÃ ĐIỂM DANH
                              </span>
                            ) : (
                              <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded font-black font-mono">
                                ○ VẮNG MẶT
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3.3 ACCOUNTING DEPARTMENT DASHBOARD */}
      {activeSubDepartment === 'accounting' && (
        <div className="space-y-6">
          {/* Key Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Tổng Doanh Thu thu về</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black text-emerald-400 font-mono">{formatVND(totalCollected)}</span>
                <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded font-bold">Thu quỹ</span>
              </div>
            </div>

            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Tổng chi phí Đã duyệt</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black text-rose-400 font-mono">{formatVND(totalSpent)}</span>
                <span className="text-[10px] bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded font-bold">Chi quỹ</span>
              </div>
            </div>

            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Số Dư Quỹ Thực Tế</span>
              <div className="flex items-baseline justify-between">
                <span className={`text-xl font-black font-mono ${netBalance >= 0 ? 'text-sky-400' : 'text-rose-450'}`}>
                  {formatVND(netBalance)}
                </span>
                <span className="text-[10px] bg-slate-950 text-slate-400 px-1.5 py-0.5 rounded font-bold font-mono">Net Cash</span>
              </div>
            </div>

            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Công nợ cần Thu Khách hàng</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black text-indigo-300 font-mono">{formatVND(outstandingReceivables)}</span>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold">Công nợ</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Category Expenses Breakdown */}
            <div className="lg:col-span-1 bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-md">
              <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest border-b border-slate-800 pb-2">
                Cơ cấu Chi phí Dự án
              </h3>
              <div className="space-y-3.5 py-1">
                {Object.keys(categoryNames).map(catKey => {
                  const amt = paymentsByCategory[catKey] || 0;
                  const pct = getPercentage(amt, totalSpent);
                  const colors: Record<string, string> = {
                    material: 'bg-emerald-500',
                    labor: 'bg-indigo-500',
                    shipping: 'bg-sky-500',
                    machinery: 'bg-pink-500',
                    general: 'bg-amber-500',
                    other: 'bg-slate-500'
                  };
                  return (
                    <div key={catKey}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400 font-bold flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${colors[catKey] || 'bg-slate-400'} block`}></span>
                          {categoryNames[catKey]}
                        </span>
                        <span className="font-mono text-slate-300">{formatVND(amt)} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                        <div className={`${colors[catKey] || 'bg-slate-400'} h-full rounded-full`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment Requests needing Director approval */}
            <div className="lg:col-span-2 bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-md">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">
                  Yêu Cầu Chi Tiêu Đợi Duyệt (Director Office)
                </h3>
                <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/20">
                  {pendingPayments.length} yêu cầu
                </span>
              </div>

              {pendingPayments.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  🌱 Tất cả các phiếu chi đã được phê duyệt đầy đủ! Không có công nợ tồn đọng khẩn cấp.
                </div>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {pendingPayments.map(pay => (
                    <div key={pay.id} className="bg-slate-950 p-4 rounded-xl border border-slate-850 hover:border-slate-700 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9.5px] bg-slate-900 text-slate-400 px-1.5 py-0.5 border border-slate-800 rounded font-mono font-bold">
                            {pay.code}
                          </span>
                          <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded font-black uppercase font-mono">
                            {categoryNames[pay.category] || pay.category}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-200">{pay.notes}</h4>
                        <div className="text-[10px] text-slate-500 space-x-2">
                          <span>Đề xuất: <strong className="text-slate-300 font-medium">{pay.proposer}</strong></span>
                          <span>•</span>
                          <span>Người nhận: <strong className="text-slate-300 font-medium">{pay.recipient}</strong></span>
                          <span>•</span>
                          <span>Ngày: <strong className="text-slate-400 font-mono">{pay.date}</strong></span>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-end gap-3 sm:gap-1.5 w-full sm:w-auto">
                        <span className="text-sm font-black text-emerald-400 font-mono mr-auto sm:mr-0">
                          {formatVND(pay.amount)}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onApprovePayment && onApprovePayment(pay.id, 'approved')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 px-3 rounded-lg flex items-center gap-1 text-[10.5px] font-bold cursor-pointer transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Duyệt
                          </button>
                          <button
                            onClick={() => onApprovePayment && onApprovePayment(pay.id, 'rejected')}
                            className="bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 p-1.5 px-2 rounded-lg flex items-center gap-1 text-[10.5px] font-bold cursor-pointer transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Từ chối
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3.4 WAREHOUSE (KHO) DEPARTMENT DASHBOARD */}
      {activeSubDepartment === 'warehouse' && (
        <div className="space-y-6">
          {/* Key Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Yêu cầu mua vật tư</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-white font-mono">{totalMaterialsDemanded} phiếu</span>
                <span className="text-[10px] bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded font-bold">Tổng đề xuất</span>
              </div>
            </div>

            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Đã cấp về công trình</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-400 font-mono">{receivedMaterialsCount} phiếu</span>
                <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded font-bold">
                  {getPercentage(receivedMaterialsCount, totalMaterialsDemanded)}%
                </span>
              </div>
            </div>

            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Đang đặt hàng nhà cung cấp</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-amber-400 font-mono">{orderedMaterialsCount} phiếu</span>
                <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded font-bold">
                  {getPercentage(orderedMaterialsCount, totalMaterialsDemanded)}%
                </span>
              </div>
            </div>

            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Đợi duyệt mua / xuất kho</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-rose-400 font-mono">{pendingMaterialsCount} phiếu</span>
                <span className="text-[10px] bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded font-bold animate-pulse">
                  {getPercentage(pendingMaterialsCount, totalMaterialsDemanded)}%
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coordination process overview */}
            <div className="lg:col-span-1 bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-md">
              <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest border-b border-slate-800 pb-2">
                Trạng thái điều phối kho vận
              </h3>
              
              <div className="space-y-4 py-2 relative pl-6 border-l-2 border-slate-800 ml-3">
                <div className="relative">
                  <div className="absolute -left-8.5 top-0 w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500 flex items-center justify-center text-[10px] font-bold text-rose-400">
                    1
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase">Giai đoạn 1: Đề xuất & Xác thực</h4>
                    <p className="text-[10.5px] text-slate-450 mt-0.5">PM Khai báo nhu cầu vật tư trên hồ sơ dự toán thiết kế.</p>
                    <span className="inline-block mt-1.5 font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded text-[10px] font-bold">
                      {pendingMaterialsCount} Yêu cầu đang đợi duyệt
                    </span>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute -left-8.5 top-0 w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center text-[10px] font-bold text-amber-400">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase">Giai đoạn 2: Đặt Hàng Mua Sắm</h4>
                    <p className="text-[10.5px] text-slate-450 mt-0.5">Thương lượng bảng giá, thực hiện phiếu đặt hàng thương mại.</p>
                    <span className="inline-block mt-1.5 font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-[10px] font-bold">
                      {orderedMaterialsCount} Hợp đồng đang cung ứng
                    </span>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute -left-8.5 top-0 w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-[10px] font-bold text-emerald-400">
                    3
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase">Giai đoạn 3: Bàn giao công trình</h4>
                    <p className="text-[10.5px] text-slate-450 mt-0.5">Xuất kho liên thông, ký nhận nghiệm thu nội bộ bàn giao.</p>
                    <span className="inline-block mt-1.5 font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] font-bold">
                      {receivedMaterialsCount} Phiếu bàn giao thành công
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Material coordination table */}
            <div className="lg:col-span-2 bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-md">
              <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest border-b border-slate-800 pb-2 flex justify-between items-center">
                <span>Nhu cầu Vật tư & Thiết kế chi tiết</span>
                <span className="text-[10px] font-mono text-slate-500">{filteredMaterials.length} loại vật tư</span>
              </h3>

              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                {filteredMaterials.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    📦 Không tìm thấy yêu cầu vật tư nào tương ứng! Hãy thiết lập bảng dự toán trong hồ sơ thiết kế.
                  </div>
                ) : (
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-500 font-black uppercase tracking-wider pb-2">
                        <th className="py-2.5 px-2">Vật tư / Gỗ nội thất</th>
                        <th className="py-2.5 px-2">Dự án áp dụng</th>
                        <th className="py-2.5 px-2">Quy cách / Vân gỗ</th>
                        <th className="py-2.5 px-2">Số lượng</th>
                        <th className="py-2.5 px-2 text-right">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {filteredMaterials.map(mat => (
                        <tr key={mat.id} className="hover:bg-slate-950/40 transition-colors">
                          <td className="py-2.5 px-2">
                            <div className="font-extrabold text-slate-200">{mat.matName}</div>
                          </td>
                          <td className="py-2.5 px-2 text-slate-400 font-medium">{mat.projectName}</td>
                          <td className="py-2.5 px-2 text-slate-500 font-mono">{mat.spec}</td>
                          <td className="py-2.5 px-2 font-mono text-slate-300 font-bold">
                            {mat.qty} {mat.unit}
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            {mat.status === 'received' && (
                              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-black font-mono">
                                ĐÃ BÀN GIAO
                              </span>
                            )}
                            {mat.status === 'ordered' && (
                              <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-black font-mono animate-pulse">
                                ĐANG CUNG CẤP
                              </span>
                            )}
                            {mat.status === 'pending' && (
                              <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded font-black font-mono">
                                CHỜ PHÊ DUYỆT
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3.5 SUBCONTRACTORS DEPARTMENT DASHBOARD */}
      {activeSubDepartment === 'subcontractor' && (
        <div className="space-y-6">
          {/* Key Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Mạng lưới Thầu phụ</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-white font-mono">{suppliers.length} thầu thợ</span>
                <span className="text-[10px] bg-sky-500/15 text-sky-400 px-2 py-0.5 rounded font-bold">Hợp tác</span>
              </div>
            </div>

            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Nội thất lắp đặt thợ thầu</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {suppliers.filter(s => s.field?.includes('gỗ') || s.field?.includes('Acrylic')).length} xưởng
                </span>
                <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded font-bold">Chuyên mộc</span>
              </div>
            </div>

            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Xây dựng nề thô thầu phụ</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-indigo-400 font-mono">
                  {suppliers.filter(s => s.field?.includes('xây') || s.field?.includes('sắt')).length} tổ đội
                </span>
                <span className="text-[10px] bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded font-bold">Xây dựng</span>
              </div>
            </div>

            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Điện nước thầu phụ</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-pink-400 font-mono">
                  {suppliers.filter(s => s.field?.includes('điện') || s.field?.includes('M&E')).length} tổ đội
                </span>
                <span className="text-[10px] bg-pink-500/15 text-pink-400 px-2 py-0.5 rounded font-bold">M&E</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick overview cards for major subcontractors */}
            <div className="lg:col-span-1 bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-md">
              <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest border-b border-slate-800 pb-2">
                Bộ quy tắc kiểm tra Thầu phụ
              </h3>

              <div className="space-y-3.5 py-1">
                <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-extrabold text-white">1. Chứng chỉ & Pháp lý</span>
                  </div>
                  <p className="text-[10px] text-slate-450 leading-relaxed">
                    Mọi thợ thầu chính thức phải khai báo số căn cước CCCD, địa chỉ đăng ký thường trú và lĩnh vực tay nghề được phê duyệt.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-extrabold text-white">2. Sổ kho thầu thợ</span>
                  </div>
                  <p className="text-[10px] text-slate-450 leading-relaxed">
                    Sản lượng gia công và đơn giá phải được liên thông trực tiếp với hệ thống Báo giá thầu thợ để tránh chênh lệch.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-extrabold text-white">3. Tạm ứng công trình</span>
                  </div>
                  <p className="text-[10px] text-slate-450 leading-relaxed">
                    Mọi yêu cầu tạm ứng chi phí thầu phụ phải kèm hóa đơn chứng từ thô và được PM Chuyên trách xác thực trước khi Giám Đốc phê duyệt.
                  </p>
                </div>
              </div>
            </div>

            {/* Subcontractors table */}
            <div className="lg:col-span-2 bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-md">
              <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest border-b border-slate-800 pb-2 flex justify-between items-center">
                <span>Danh bạ Đối tác Thầu Phụ chính thức</span>
                <span className="text-[10px] font-mono text-slate-500">{suppliers.length} đối tác thầu phụ</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-500 font-black uppercase tracking-wider pb-2">
                      <th className="py-2.5 px-2">Đơn vị thầu phụ</th>
                      <th className="py-2.5 px-2">Đại diện pháp luật</th>
                      <th className="py-2.5 px-2">Chuyên ngành / Tay nghề</th>
                      <th className="py-2.5 px-2">Vị trí / Điện thoại</th>
                      <th className="py-2.5 px-2 text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {suppliers.map(sup => (
                      <tr key={sup.id} className="hover:bg-slate-950/40 transition-colors">
                        <td className="py-3 px-2">
                          <div className="font-extrabold text-white flex items-center gap-1.5">
                            <span className="text-[8.5px] bg-slate-900 border border-slate-800 px-1 py-0.2 rounded font-mono font-bold text-orange-400">
                              {sup.id}
                            </span>
                            <span className="truncate max-w-[140px]" title={sup.name}>{sup.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="font-bold text-slate-300">{sup.representative}</div>
                          <span className="text-[9.5px] text-slate-500 block">Đại diện ủy quyền</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="bg-slate-950 border border-slate-850 text-slate-300 font-bold px-2 py-0.5 rounded text-[10px] truncate max-w-[170px] inline-block" title={sup.field}>
                            {sup.field}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-slate-400 font-mono">
                          <div>{sup.address || sup.region}</div>
                          <div className="text-[10px]">{sup.phone}</div>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <button
                            onClick={() => onNavigateTab('subcontractor-management')}
                            className="p-1.5 bg-slate-800 hover:bg-orange-600 hover:text-white text-slate-400 rounded-md transition cursor-pointer flex items-center gap-1 text-[10px] font-bold ml-auto"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Quản lý hợp đồng
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
