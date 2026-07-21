import React, { useState, useEffect } from 'react';
import { Project, Customer, Employee, ProjectType, ProjectStatus, Receipt, Payment, ProjectDoc, ProjectDocCustomField } from '../types';
import { Plus, Search, Eye, Filter, Calendar, TrendingUp, DollarSign, ArrowRight, FileText, Check, Trash2, FolderOpen, Settings, AlertTriangle, X, Users } from 'lucide-react';
import { useNotification } from '../context';
import { can, loadProjectPermissions } from './hr/hrProjectPermissions';

interface ProjectManagementProps {
  projects: Project[];
  customers: Customer[];
  employees: Employee[];
  receipts: Receipt[];
  payments: Payment[];
  onAddProject: (newProject: Project) => void;
  onUpdateProjectStatus: (id: string, status: ProjectStatus, progress: number) => void;
  onUpdateProject?: (id: string, updates: Partial<Project>) => void;
  onDeleteProject?: (id: string) => void;
  onAddCustomer?: (newCust: Customer) => void;
  currentUser?: Employee;
}

// Helper to get initials abbreviation
const getAbbreviation = (name: string): string => {
  if (!name) return '';
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
  const words = normalized.trim().split(/\s+/).filter(Boolean);
  const initials = words.map(w => w[0].toUpperCase()).join('');
  return initials;
};

export default function ProjectManagement({
  projects,
  customers,
  employees,
  receipts,
  payments,
  onAddProject,
  onUpdateProjectStatus,
  onUpdateProject,
  onDeleteProject,
  onAddCustomer,
  currentUser
}: ProjectManagementProps) {
  const { addToast } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Trạng thái dự án đang chọn để xem Chi tiết sâu
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projects[0]?.id || null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    setIsConfirmingDelete(false);
  }, [selectedProjectId]);

  // Form dự án mới
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjCust, setNewProjCust] = useState(customers[0]?.id || '');
  const [prevCustId, setPrevCustId] = useState('');
  const [newProjType, setNewProjType] = useState<ProjectType>('furniture');
  const [newProjValue, setNewProjValue] = useState(0); // Mặc định là 0
  const [newProjAddress, setNewProjAddress] = useState('');
  const [newProjPm, setNewProjPm] = useState(employees[2]?.id || ''); // emp_3 (Hải)
  const [newProjStart, setNewProjStart] = useState(''); // Mặc định trống
  const [newProjEnd, setNewProjEnd] = useState(''); // Mặc định trống
  const [newProjDuration, setNewProjDuration] = useState<number | ''>(''); // Thời hạn HĐ (ngày)
  const [newProjNotes, setNewProjNotes] = useState('');

  // States cho thêm nhanh khách hàng (Quick Add Customer)
  const [showQuickCustModal, setShowQuickCustModal] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustAddress, setQuickCustAddress] = useState('');
  const [quickCustType, setQuickCustType] = useState<'individual' | 'organization'>('individual');
  const [quickCustRep, setQuickCustRep] = useState('');
  const [quickCustTax, setQuickCustTax] = useState('');
  const [quickCustNotes, setQuickCustNotes] = useState('');

  // States cho Quản lý Hồ sơ dự án (Báo giá, Hợp đồng, Nghiệm thu, Thanh lý)
  const [activeDocTab, setActiveDocTab] = useState<'quotation' | 'contract' | 'acceptance' | 'liquidation'>('quotation');
  const [showAddDocForm, setShowAddDocForm] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocCode, setNewDocCode] = useState('');
  const [newDocValue, setNewDocValue] = useState<number>(0);
  const [newDocTemplate, setNewDocTemplate] = useState('Bản mẫu Hoàng Long Tiêu Chuẩn');
  const [newDocStatus, setNewDocStatus] = useState<'draft' | 'active' | 'approved' | 'archived'>('draft');
  const [docCustomFields, setDocCustomFields] = useState<ProjectDocCustomField[]>([]);
  const [tempAttrLabel, setTempAttrLabel] = useState('');
  const [tempAttrVal, setTempAttrVal] = useState('');

  const typeLabels: Record<ProjectType, string> = {
    construction: 'Xây dựng',
    furniture: 'Nội thất',
    mechanical: 'Cơ khí',
    general: 'Tổng hợp'
  };

  const statusLabels: Record<ProjectStatus, string> = {
    new: 'Mới',
    processing: 'Đang triển khai',
    paused: 'Tạm dừng',
    completed: 'Hoàn thành',
    cancelled: 'Hủy'
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // ─── Phân quyền dự án ──────────────────────────────────────────────────
  const matrix = loadProjectPermissions();
  const canCreateProject = can('createProject', currentUser, selectedProject, undefined, matrix);
  const canUpdateProjectStatus = can('updateProjectStatus', currentUser, selectedProject, undefined, matrix);
  const canDeleteProject = can('deleteProject', currentUser, selectedProject, undefined, matrix);
  const canQuickAddCustomer = can('quickAddCustomer', currentUser, selectedProject, undefined, matrix);
  const canManageProjectDocs = can('manageProjectDocs', currentUser, selectedProject, undefined, matrix);
  // ────────────────────────────────────────────────────────────────────────

  // Lọc danh sách dự án
  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || p.type === filterType;
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Sync address from customer automatically but allow manual overrides
  useEffect(() => {
    if (newProjCust && newProjCust !== prevCustId) {
      const selectedCust = customers.find(c => c.id === newProjCust);
      if (selectedCust) {
        setNewProjAddress(selectedCust.address || '');
      }
      setPrevCustId(newProjCust);
    }
  }, [newProjCust, customers, prevCustId]);

  const handleQuickAddCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustName) return;

    const abbrev = getAbbreviation(quickCustName);
    const orderIndex = customers.length + 1;
    const generatedId = `KH_${abbrev}_${orderIndex}`;

    const newCust: Customer = {
      id: generatedId,
      name: quickCustName,
      phone: quickCustPhone,
      email: '',
      address: quickCustAddress,
      type: quickCustType,
      representative: quickCustType === 'organization' ? quickCustRep : '',
      taxOrIdNumber: quickCustTax,
      notes: quickCustNotes
    };

    if (onAddCustomer) {
      onAddCustomer(newCust);
    } else {
      customers.push(newCust);
    }

    // Connect to newly created customer
    setNewProjCust(generatedId);
    setPrevCustId(generatedId);
    setNewProjAddress(quickCustAddress);

    // Reset fields
    setQuickCustName('');
    setQuickCustPhone('');
    setQuickCustAddress('');
    setQuickCustType('individual');
    setQuickCustRep('');
    setQuickCustTax('');
    setQuickCustNotes('');
    setShowQuickCustModal(false);
    addToast({ title: 'ℹ️ Thông báo', message: `🤝 Đã thêm nhanh khách hàng ${newCust.name} với mã ${newCust.id}!`, type: 'info' });
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName || !newProjCust) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng nhập đầy đủ các trường bắt buộc!', type: 'warning' });
      return;
    }

    // Auto generated code format: DA_chữ cái đầu tên dự án_số thứ tự hàng đang nhập
    const abbrev = getAbbreviation(newProjName) || 'DA';
    const sequenceValue = projects.length + 1;
    const autoCode = `DA_${abbrev}_${sequenceValue}`;

    // Calculated completion date from start date & duration in days
    let calculatedEndStr = '';
    if (newProjStart && newProjDuration) {
      const dt = new Date(newProjStart);
      dt.setDate(dt.getDate() + Number(newProjDuration));
      calculatedEndStr = dt.toISOString().split('T')[0];
    } else if (newProjDuration) {
      calculatedEndStr = `${newProjDuration} ngày`;
    }

    const newProj: Project = {
      id: `proj_${Date.now()}`,
      code: autoCode,
      name: newProjName,
      customerId: newProjCust,
      address: newProjAddress,
      type: newProjType,
      contractValue: 0, // Giá trị hợp đồng gốc ẩn và bằng 0
      startDate: newProjStart, // Mặc định để trống hoặc giá trị đã nhập
      endDate: calculatedEndStr, // Hoàn thành dự kiến lưu dưới dạng Hạn (ngày hoặc ngày tháng)
      pmId: newProjPm,
      status: 'new',
      progress: 0,
      notes: newProjNotes,
      image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80'
    };

    onAddProject(newProj);
    setSelectedProjectId(newProj.id);
    setShowAddForm(false);
    
    // reset project form
    setNewProjName('');
    setNewProjAddress('');
    setNewProjStart('');
    setNewProjEnd('');
    setNewProjDuration('');
    setNewProjNotes('');
  };

  const handleCreateDocument = (e: React.FormEvent, projectId: string) => {
    e.preventDefault();
    if (!newDocName || !newDocCode) return;

    const newDoc: ProjectDoc = {
      id: `doc_${Date.now()}`,
      type: activeDocTab,
      name: newDocName,
      code: newDocCode,
      createdAt: new Date().toISOString().split('T')[0],
      status: newDocStatus,
      value: newDocValue || undefined,
      templateName: newDocTemplate,
      customFields: docCustomFields.length > 0 ? docCustomFields : undefined
    };

    const proj = projects.find(p => p.id === projectId);
    if (proj) {
      const currentDocs = proj.documents || [];
      if (onUpdateProject) {
        onUpdateProject(projectId, {
          documents: [...currentDocs, newDoc]
        });
      }
    }

    // Reset Form
    setNewDocName('');
    setNewDocCode('');
    setNewDocValue(0);
    setNewDocTemplate('Bản mẫu Hoàng Long Tiêu Chuẩn');
    setNewDocStatus('draft');
    setDocCustomFields([]);
    setShowAddDocForm(false);
  };

  const handleDeleteDocument = (projectId: string, docId: string) => {
    const proj = projects.find(p => p.id === projectId);
    if (proj && proj.documents) {
      if (onUpdateProject) {
        onUpdateProject(projectId, {
          documents: proj.documents.filter(d => d.id !== docId)
        });
      }
    }
  };

  // Tính toán lãi lỗ ròng cụ thể của Dự án đang được Lựa chọn
  const getProjectFinances = (projId: string) => {
    // Tổng số thu
    const projectReceipts = receipts.filter(r => r.projectId === projId);
    const totalCollected = projectReceipts.reduce((sum, r) => sum + r.amount, 0);

    // Tổng số chi thực tế
    const projectPayments = payments.filter(p => p.projectId === projId && p.status === 'approved');
    const totalSpent = projectPayments.reduce((sum, p) => sum + p.amount, 0);

    const contractVal = projects.find(p => p.id === projId)?.contractValue || 0;
    const remainingToCollect = contractVal - totalCollected;

    return {
      totalCollected,
      totalSpent,
      balance: totalCollected - totalSpent,
      remainingToCollect
    };
  };

  const curFin = selectedProject ? getProjectFinances(selectedProject.id) : null;
  const pmName = employees.find(e => e.id === selectedProject?.pmId)?.name || 'Chưa gán';
  const customerName = customers.find(c => c.id === selectedProject?.customerId)?.name || 'Ẩn danh';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6" id="project_management">
      
      {/* 1. Bên Trái: Danh sách dự án (7 columns) */}
      <div className="xl:col-span-7 bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col justify-between space-y-4">
        
        {/* Header lọc */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <span className="font-bold text-slate-800 text-sm">HỒ SƠ KHU VỰC THI CÔNG CHI TIẾT</span>
            {canCreateProject && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-sky-600 text-white hover:bg-sky-700 font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                Khai dự án mới
              </button>
            )}
          </div>

          {/* Form thêm dự án (Nếu bật) */}
          {showAddForm && (
            <div className="space-y-4">
              <form onSubmit={handleCreateProject} className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs space-y-3 transition-all duration-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Mã khách hàng / Mã dự án tự sinh - Khóa nhập liệu */}
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Mã khách hàng / Mã dự án tự sinh (Khóa nhập liệu)</label>
                    <input
                      type="text"
                      disabled
                      value={newProjName ? `DA_${getAbbreviation(newProjName)}_${projects.length + 1}` : 'DA_[Tên viết tắt]_[STT]'}
                      className="w-full bg-slate-100 border rounded px-2.5 py-1.5 outline-none font-mono font-bold text-sky-800 cursor-not-allowed"
                    />
                  </div>

                  {/* Tên dự án/công trình (Bắt buộc) */}
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Tên dự án/công trình <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={newProjName}
                      onChange={(e) => setNewProjName(e.target.value)}
                      className="w-full bg-white border rounded px-2.5 py-1.5 outline-none"
                      placeholder="Nhập tên dự án (ví dụ: Biệt thự Anh Hải)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Chủ đầu tư (Bắt buộc) với nút "Thêm nhanh" */}
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Chủ đầu tư (Khách hàng) <span className="text-red-500">*</span></label>
                    <div className="flex gap-1.5">
                      <select
                        required
                        value={newProjCust}
                        onChange={(e) => setNewProjCust(e.target.value)}
                        className="flex-1 bg-white border rounded px-2.5 py-1.5 outline-none"
                      >
                        <option value="">-- Chọn khách hàng --</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      {canQuickAddCustomer && (
                        <button
                          type="button"
                          onClick={() => setShowQuickCustModal(true)}
                          className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-2 rounded text-[11px] flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors rounded-lg"
                        >
                          <Plus className="w-3.5 h-3.5" /> Thêm nhanh
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Loại khách hàng (Khóa hiển thị thông tin trực quan) */}
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Loại khách hàng (Chỉ đọc)</label>
                    <input
                      type="text"
                      disabled
                      value={
                        (() => {
                          const matched = customers.find(c => c.id === newProjCust);
                          if (matched) {
                            return matched.type === 'organization' ? '🏢 Tổ chức' : '👤 Cá nhân';
                          }
                          return 'Chưa xác định';
                        })()
                      }
                      className="w-full bg-slate-100 border rounded px-2.5 py-1.5 outline-none text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Lĩnh vực loại dự án (Bắt buộc) */}
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Lĩnh vực (Loại dự án) <span className="text-red-500">*</span></label>
                    <select
                      required
                      value={newProjType}
                      onChange={(e) => setNewProjType(e.target.value as ProjectType)}
                      className="w-full bg-white border rounded px-2 py-1.5 outline-none"
                    >
                      <option value="furniture">Nội thất</option>
                      <option value="construction">Xây dựng</option>
                      <option value="mechanical">Cơ khí</option>
                      <option value="general">Tổng hợp</option>
                    </select>
                  </div>

                  {/* PM Chuyên trách phụ trách (Bắt buộc) */}
                  <div className="sm:col-span-2">
                    <label className="block text-slate-500 font-semibold mb-1 font-bold text-sky-700">PM chuyên trách phụ trách <span className="text-red-500">*</span></label>
                    <select
                      required
                      value={newProjPm}
                      onChange={(e) => setNewProjPm(e.target.value)}
                      className="w-full bg-white border rounded px-2 py-1.5 outline-none font-bold"
                    >
                      <option value="">-- Chọn PM phụ trách --</option>
                      {employees.filter(emp => emp.role === 'pm' || emp.role === 'director').map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Hợp đồng gốc ẩn giá trị mặc định là 0 (Đã loại bỏ input ở giao diện) */}

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Địa điểm thi công (Mặc định lấy từ địa chỉ khách hàng)</label>
                  <input
                    type="text"
                    required
                    value={newProjAddress}
                    onChange={(e) => setNewProjAddress(e.target.value)}
                    className="w-full bg-white border rounded px-2.5 py-1.5 outline-none"
                    placeholder="ví dụ: Số 12 Triệu Việt Vương, Đà Lạt"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Ngày bắt đầu (Mặc định trống) */}
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Ngày bắt đầu</label>
                    <input
                      type="date"
                      value={newProjStart}
                      onChange={(e) => setNewProjStart(e.target.value)}
                      className="w-full bg-white border rounded px-2.5 py-1.5 outline-none"
                    />
                  </div>

                  {/* Thời hạn HĐ tính theo ngày */}
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Thời hạn HĐ (ngày)</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="ví dụ: 60"
                      value={newProjDuration}
                      onChange={(e) => setNewProjDuration(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-white border rounded px-2.5 py-1.5 outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Ghi chú yêu cầu kỹ thuật đặc biệt</label>
                  <textarea
                    value={newProjNotes}
                    onChange={(e) => setNewProjNotes(e.target.value)}
                    rows={2}
                    className="w-full bg-white border rounded p-2 outline-none"
                    placeholder="Các yêu cầu thi công, vật tư chiết khấu mộc thợ..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded font-bold cursor-pointer transition-colors"
                  >
                    Bỏ qua
                  </button>
                  <button
                    type="submit"
                    className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-1.5 rounded font-bold cursor-pointer transition-colors shadow-sm"
                  >
                    Tạo Dự án
                  </button>
                </div>
              </form>

              {/* POPUP OVERLAY: THÊM NHANH KHÁCH HÀNG MỚI TỪ DỰ ÁN */}
              {showQuickCustModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans text-slate-200">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs text-left animate-scaleIn">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-orange-500" />
                        <h3 className="font-extrabold text-white text-sm">Thêm nhanh Khách hàng mới</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowQuickCustModal(false)}
                        className="text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleQuickAddCustomerSubmit} className="space-y-3">
                      <div>
                        <label className="block text-slate-450 font-semibold mb-1">Mã khách hàng tự sinh</label>
                        <input
                          type="text"
                          disabled
                          value={quickCustName ? `KH_${getAbbreviation(quickCustName)}_${customers.length + 1}` : 'KH_[Tên viết tắt]_[STT]'}
                          className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-orange-400 font-mono font-bold cursor-not-allowed outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-350 font-bold mb-1">Tên khách hàng <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          required
                          placeholder="Nhập tên khách hàng..."
                          value={quickCustName}
                          onChange={(e) => setQuickCustName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white outline-none focus:border-orange-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-350 font-bold mb-1">Loại khách hàng</label>
                          <select
                            value={quickCustType}
                            onChange={(e) => setQuickCustType(e.target.value as any)}
                            className="w-full bg-slate-950 border border-slate-850 rounded p-1.5 text-white outline-none cursor-pointer focus:border-orange-500 font-bold"
                          >
                            <option value="individual">👤 Cá nhân</option>
                            <option value="organization">🏢 Tổ chức</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-350 font-bold mb-1">Số điện thoại (* kiểu số)</label>
                          <input
                            type="text"
                            required
                            pattern="[0-9]*"
                            inputMode="numeric"
                            placeholder="ví dụ: 0912345678"
                            value={quickCustPhone}
                            onChange={(e) => setQuickCustPhone(e.target.value.replace(/[^0-9]/g, ''))}
                            className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white outline-none font-mono focus:border-orange-500"
                          />
                        </div>
                      </div>

                      {quickCustType === 'organization' && (
                        <div>
                          <label className="block text-slate-350 font-bold mb-1">Người đại diện <span className="text-red-400">*</span></label>
                          <input
                            type="text"
                            required={quickCustType === 'organization'}
                            placeholder="Nhập họ tên người đại diện pháp nhân..."
                            value={quickCustRep}
                            onChange={(e) => setQuickCustRep(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white outline-none focus:border-orange-500"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-slate-350 font-bold mb-1">Địa chỉ</label>
                        <input
                          type="text"
                          placeholder="Địa chỉ liên hệ nhà thô..."
                          value={quickCustAddress}
                          onChange={(e) => setQuickCustAddress(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-855 rounded px-2.5 py-1.5 text-white outline-none focus:border-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-350 font-bold mb-1">MST / CMND (* kiểu số)</label>
                        <input
                          type="text"
                          pattern="[0-9]*"
                          inputMode="numeric"
                          placeholder="Mã số thuế hoặc Mã CMND..."
                          value={quickCustTax}
                          onChange={(e) => setQuickCustTax(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white outline-none font-mono focus:border-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-350 font-bold mb-1">Ghi chú lưu ý</label>
                        <textarea
                          rows={2}
                          placeholder="Nhật trình hoặc vật tư gỗ ván mong muốn..."
                          value={quickCustNotes}
                          onChange={(e) => setQuickCustNotes(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded p-1.5 text-white outline-none"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => setShowQuickCustModal(false)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-1.5 rounded cursor-pointer"
                        >
                          Hủy bỏ
                        </button>
                        <button
                          type="submit"
                          className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-1.5 rounded cursor-pointer shadow-md"
                        >
                          Lưu khách hàng
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Thanh lọc tìm kiếm */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm tên, mã công trình..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-xs bg-slate-50 focus:bg-white"
            >
              <option value="all">Tất cả Phân hệ</option>
              <option value="construction">Xây dựng</option>
              <option value="furniture">Nội thất (Gỗ)</option>
              <option value="mechanical">Cơ khí (Sắt cấu)</option>
              <option value="general">Tổng hợp</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-xs bg-slate-50 focus:bg-white"
            >
              <option value="all">Tất cả Trạng thái</option>
              <option value="new">Mới ký</option>
              <option value="processing">Đang chạy</option>
              <option value="paused">Tạm ngưng</option>
              <option value="completed">Đã bàn giao</option>
            </select>
          </div>
        </div>

        {/* Lưới dự án */}
        <div className="overflow-y-auto max-h-[450px] space-y-3 pr-1 pt-2">
          {filteredProjects.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-bold text-xs">Không tìm thấy công trình nào phù hợp tiêu chí.</div>
          ) : (
            filteredProjects.map((p) => {
              const cust = customers.find(c => c.id === p.customerId)?.name || 'Vãng lai';
              const fin = getProjectFinances(p.id);
              const isSelected = p.id === selectedProjectId;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className={`p-4 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected ? 'border-sky-500 bg-sky-50/50 shadow-xs' : 'border-slate-100 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded font-mono block w-fit mb-1">{p.code}</span>
                      <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{p.name}</h4>
                      <p className="text-slate-550 font-medium line-clamp-1 mt-0.5">Chủ nhà: {cust}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      p.status === 'processing' ? 'bg-sky-100 text-sky-800' :
                      p.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {statusLabels[p.status]}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-3 border-t border-slate-100/60 pt-2.5">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-450 font-medium">Tiến độ thi công:</span>
                        <strong className="text-sky-700 font-bold">{p.progress}%</strong>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div className="bg-sky-600 h-1.5 rounded-full" style={{ width: `${p.progress}%` }}></div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-450 block">Hợp đồng bao thầu:</span>
                      <strong className="font-mono text-slate-800 text-xs">{p.contractValue.toLocaleString('vi-VN')} đ</strong>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* 2. Bên Phải: Chi tiết dự án sâu + Lãi/lỗ ròng của riêng dự án đó (5 columns) */}
      <div className="xl:col-span-5">
        {selectedProject && curFin ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden text-xs flex flex-col h-full justify-between space-y-4 p-5" id="project_details_deep">
            <div className="space-y-4">
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div>
                  <span className="teal-card px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded">
                    Phân loại: {typeLabels[selectedProject.type]}
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-sm mt-1">{selectedProject.name}</h3>
                  <div className="text-slate-400 mt-1">PM phụ trách: <span className="font-semibold text-slate-700">{pmName}</span></div>
                </div>
              </div>

              {/* Thông tin mốc thời gian */}
              <div className="space-y-2 bg-slate-50 p-3 rounded-lg border">
                <span className="font-bold text-[10px] text-slate-400 block uppercase">Tiến trình triển khai</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="block text-slate-400 text-[10px]">Ngày bàn giao khởi công:</span>
                    <strong className="text-slate-700 font-bold">{selectedProject.startDate}</strong>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[10px]">Hạn kết cấu dự toán:</span>
                    <strong className="text-slate-700 font-bold">{selectedProject.endDate}</strong>
                  </div>
                </div>
              </div>

              {/* Thay đổi trạng thái nhanh — gated by canUpdateProjectStatus */}
              {canUpdateProjectStatus ? (
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Cập nhật nhanh Trạng thái & % Tiến độ</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={selectedProject.status}
                      onChange={(e) => onUpdateProjectStatus(selectedProject.id, e.target.value as ProjectStatus, selectedProject.progress)}
                      className="border rounded p-1 text-xs"
                    >
                      <option value="new">Mới</option>
                      <option value="processing">Đang triển khai</option>
                      <option value="paused">Tạm dừng</option>
                      <option value="completed">Hoàn thành</option>
                    </select>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={selectedProject.progress}
                      onChange={(e) => onUpdateProjectStatus(selectedProject.id, selectedProject.status, Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-slate-50 rounded border border-slate-200 text-xs text-slate-400 text-center italic">
                  Trạng thái: <strong className="text-slate-700">{selectedProject.status === 'new' ? 'Mới' : selectedProject.status === 'processing' ? 'Đang triển khai' : selectedProject.status === 'paused' ? 'Tạm dừng' : selectedProject.status === 'completed' ? 'Hoàn thành' : 'Hủy'}</strong> | Tiến độ: <strong className="text-slate-700">{selectedProject.progress}%</strong> (chỉ PM/Giám đốc mới cập nhật)
                </div>
              )}

              {/* Sổ cái Thu Chi lãi lỗ của RIÊNG công trình đó */}
              <div className="border-t pt-3 space-y-3">
                <span className="font-black text-[11px] text-slate-800 uppercase block tracking-wider">📊 Báo cáo tài chính</span>
                
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-2 bg-slate-50 border rounded text-slate-600">
                    <span className="block text-[9px] font-bold text-slate-400">ĐÃ THU TẠM ỨNG</span>
                    <span className="text-xs font-mono font-black text-emerald-600">{curFin.totalCollected.toLocaleString('vi-VN')} đ</span>
                  </div>
                  <div className="p-2 bg-slate-50 border rounded text-slate-600">
                    <span className="block text-[9px] font-bold text-slate-400">TỔNG CHI PHÍ THỰC TẾ</span>
                    <span className="text-xs font-mono font-black text-red-600">{curFin.totalSpent.toLocaleString('vi-VN')} đ</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 font-medium space-y-1">
                  <div className="flex justify-between">
                    <span>Còn nợ phải gạt thu (phải thu):</span>
                    <strong className="text-slate-700 font-mono">{curFin.remainingToCollect.toLocaleString('vi-VN')} đ</strong>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-normal italic mt-1 bg-yellow-50 p-1 rounded border border-yellow-100">
                    *Mục tiêu Lợi nhuận dự tính cho công trình nội thất: tối thiểu 15%. Luôn bám sát phiếu chi đề xuất để tránh vỡ dự toán thô.
                  </p>
                </div>
              </div>

              {/* PHÂN HỆ HỒ SƠ DỰ ÁN (Báo giá, Hợp đồng, Nghiệm thu, Thanh lý) */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between items-center bg-slate-900 px-3 py-2 rounded-lg text-white">
                  <span className="font-extrabold text-[10.5px] uppercase tracking-wider flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-sky-450" />
                    Hồ sơ biên bản dự án
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddDocForm(!showAddDocForm)}
                    className="bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-[10px] px-2 py-1 rounded flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Plus className="w-3 h-3" />
                    Lập hồ sơ tài liệu
                  </button>
                </div>

                {/* Doc Categories Tabs */}
                <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-lg">
                  {(['quotation', 'contract', 'acceptance', 'liquidation'] as const).map((type) => {
                    const label = 
                      type === 'quotation' ? 'BÁO GIÁ' :
                      type === 'contract' ? 'HĐ/GỐC' :
                      type === 'acceptance' ? 'NG.THU' : 'TH.LÝ';
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setActiveDocTab(type);
                          setShowAddDocForm(false);
                        }}
                        className={`py-1 text-[9.5px] font-black rounded-md text-center uppercase tracking-normal transition-all cursor-pointer ${
                          activeDocTab === type ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Adding New Document Drawer Form */}
                {showAddDocForm && (
                  <form 
                    onSubmit={(e) => handleCreateDocument(e, selectedProject.id)}
                    className="bg-slate-50 p-3 rounded-xl border border-sky-100 space-y-2 text-[10.5px] animate-fade-in animate-duration-300"
                  >
                    <div className="font-bold text-sky-800 text-[10px] uppercase border-b pb-1.5 flex items-center gap-1">
                      <Settings className="w-3.5 h-3.5" />
                      Lập mới: {activeDocTab.toUpperCase()} (Tốc độ tùy chỉnh 100%)
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-500 font-bold mb-0.5">Tên văn bản / Hồ sơ</label>
                        <input
                          type="text"
                          required
                          value={newDocName}
                          onChange={(e) => setNewDocName(e.target.value)}
                          placeholder="vd: Báo giá gỗ nội thất v1.2"
                          className="w-full bg-white border border-slate-200 rounded p-1 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 font-bold mb-0.5">Mã văn bản / Số kí duyệt</label>
                        <input
                          type="text"
                          required
                          value={newDocCode}
                          onChange={(e) => setNewDocCode(e.target.value)}
                          placeholder="vd: BG-DA2-001"
                          className="w-full bg-white border border-slate-200 rounded p-1 outline-none text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-500 font-bold mb-0.5">Giá trị nếu có (VND)</label>
                        <input
                          type="number"
                          value={newDocValue}
                          onChange={(e) => setNewDocValue(Number(e.target.value))}
                          placeholder="0"
                          className="w-full bg-white border border-slate-200 rounded p-1 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 font-bold mb-0.5">Chọn mẫu biên bản</label>
                        <input
                          type="text"
                          value={newDocTemplate}
                          onChange={(e) => setNewDocTemplate(e.target.value)}
                          placeholder="Mẫu Hoàng Long Tiêu Chuẩn"
                          className="w-full bg-white border border-slate-200 rounded p-1 outline-none text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-500 font-bold mb-0.5">Trạng thái hiện tại</label>
                      <select
                        value={newDocStatus}
                        onChange={(e) => setNewDocStatus(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded p-1 outline-none text-xs"
                      >
                        <option value="draft">Bản nháp lưu xưởng (Draft)</option>
                        <option value="active">Đang tiến hành / Có hiệu lực (Active)</option>
                        <option value="approved">Đã ký duyệt song phương (Approved)</option>
                        <option value="archived">Lưu kho hồ sơ (Archived)</option>
                      </select>
                    </div>

                    {/* DYNAMIC FIELD CUSTOMIZER (CÓ THỂ TÙY CHỈNH TỐI ĐA!) */}
                    <div className="bg-white border rounded-lg p-2 space-y-1.5 shadow-sm">
                      <span className="font-extrabold text-[9.5px] text-slate-600 block uppercase tracking-wider">
                        Danh sách tham số đặc tả (Tùy biến tối đa mẫu):
                      </span>

                      {/* Attribute pills */}
                      {docCustomFields.length > 0 && (
                        <div className="flex flex-wrap gap-1 border-b pb-1.5">
                          {docCustomFields.map((f, i) => (
                            <span key={i} className="inline-flex items-center gap-1 bg-slate-150 text-slate-700 px-1.5 py-0.5 rounded text-[9.5px] font-bold">
                              <strong>{f.label}:</strong> {f.value}
                              <button
                                type="button"
                                onClick={() => setDocCustomFields(docCustomFields.filter((_, idx) => idx !== i))}
                                className="text-slate-400 hover:text-red-500 font-black"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Add attribute input row */}
                      <div className="flex gap-1">
                        <input
                          type="text"
                          placeholder="Tiêu chí (Chất liệu, Cọc, ...)"
                          value={tempAttrLabel}
                          onChange={(e) => setTempAttrLabel(e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded p-0.5 px-1.5 text-[10px] outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Giá trị / Chỉ số"
                          value={tempAttrVal}
                          onChange={(e) => setTempAttrVal(e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded p-0.5 px-1.5 text-[10px] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!tempAttrLabel.trim() || !tempAttrVal.trim()) return;
                            setDocCustomFields([...docCustomFields, { label: tempAttrLabel.trim(), value: tempAttrVal.trim() }]);
                            setTempAttrLabel('');
                            setTempAttrVal('');
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-0.5 rounded text-[10px] font-bold"
                        >
                          + Găm
                        </button>
                      </div>
                      <p className="text-[9px] text-slate-400 italic mt-1 leading-tight">
                        * Bạn có thể tự do "găm" bao nhiêu thuộc tính tuỳ ý để làm mẫu cho sau này.
                      </p>
                    </div>

                    <div className="flex gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddDocForm(false)}
                        className="bg-slate-200 hover:bg-slate-350 text-slate-700 px-2.5 py-1 rounded font-bold flex-1 cursor-pointer"
                      >
                        Hủy bỏ
                      </button>
                      <button
                        type="submit"
                        className="bg-sky-650 hover:bg-sky-700 text-white px-3 py-1 rounded font-black flex-1 cursor-pointer text-center text-xs"
                      >
                        Lưu tủ Hồ sơ
                      </button>
                    </div>

                  </form>
                )}

                {/* Document List Render under Selected Tab Category */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {(() => {
                    const allDocs = selectedProject.documents || [];
                    const filteredDocs = allDocs.filter(d => d.type === activeDocTab);
                    
                    if (filteredDocs.length === 0) {
                      return (
                        <div className="text-center py-5 border border-dashed rounded-xl bg-slate-50 text-slate-400 italic text-[10px]">
                          Chưa có hồ sơ nào cho phần <span className="font-extrabold uppercase text-sky-850">"{activeDocTab}"</span> này.
                        </div>
                      );
                    }

                    return filteredDocs.map((doc) => {
                      let statusBadge = 'bg-yellow-50 text-yellow-700 border-yellow-250';
                      let statusText = 'Bản nháp';
                      if (doc.status === 'active') {
                        statusBadge = 'bg-sky-50 text-sky-800 border-sky-250';
                        statusText = 'Có hiệu lực';
                      } else if (doc.status === 'approved') {
                        statusBadge = 'bg-emerald-50 text-emerald-800 border-emerald-250';
                        statusText = 'Đã duyệt ký';
                      } else if (doc.status === 'archived') {
                        statusBadge = 'bg-slate-100 text-slate-600 border-slate-200';
                        statusText = 'Lưu kho';
                      }

                      return (
                        <div 
                          key={doc.id}
                          className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-150 rounded-xl space-y-2 relative group transition-colors"
                        >
                          {/* Trash button — gated by canManageProjectDocs */}
                          {canManageProjectDocs && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDocument(selectedProject.id, doc.id)}
                              className="absolute right-2 top-2 text-slate-350 hover:text-red-650 p-1 rounded-full cursor-pointer transition opacity-0 group-hover:opacity-100"
                              title="Xóa hồ sơ khỏi tủ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <div className="flex items-start gap-1.5 pr-6">
                            <FileText className="w-4 h-4 text-sky-650 mt-0.5 shrink-0" />
                            <div className="space-y-0.5">
                              <span className="text-[9.5px] bg-slate-200 text-slate-800 px-1 py-0.2 rounded font-mono font-bold">
                                {doc.code}
                              </span>
                              <h5 className="font-extrabold text-slate-850 text-[11px] leading-tight">
                                {doc.name}
                              </h5>
                              <p className="text-[9px] text-slate-450 leading-none">
                                Lập: {doc.createdAt} | Bản mẫu: <span className="font-semibold">{doc.templateName}</span>
                              </p>
                            </div>
                          </div>

                          {/* Value if applicable */}
                          {doc.value && (
                            <div className="bg-white px-2 py-1 rounded inline-block border border-slate-150">
                              <span className="text-[9px] text-slate-450 block font-bold leading-none uppercase">Giá trị tài chính:</span>
                              <strong className="text-emerald-705 font-mono text-[10.5px]">{doc.value.toLocaleString('vi-VN')} đ</strong>
                            </div>
                          )}

                          {/* Custom fields specification table */}
                          {doc.customFields && doc.customFields.length > 0 && (
                            <div className="bg-white border border-slate-100 rounded-lg p-2 space-y-1 text-[9.5px]">
                              {doc.customFields.map((f, fIdx) => (
                                <div key={fIdx} className="flex justify-between border-b border-dashed border-slate-100 pb-0.5 last:border-b-0">
                                  <span className="text-slate-450 font-bold">{f.label}:</span>
                                  <span className="text-slate-850 font-semibold text-right">{f.value}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex justify-between items-center pt-1 border-t border-dashed border-slate-200 text-[10px]">
                            <span className={`px-1.5 py-0.2 rounded text-[8px] uppercase font-black tracking-wide border ${statusBadge}`}>
                              {statusText}
                            </span>
                            <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5">
                              <Check className="w-3 h-3 text-emerald-500" />
                              Hồ sơ hợp chuẩn
                            </span>
                          </div>

                        </div>
                      );
                    });
                  })()}
                </div>

              </div>
            </div>

            {/* Note cuối */}
            <div className="border-t pt-3 text-[10px] text-slate-450 leading-relaxed italic">
              <strong>Ghi chú:</strong> {selectedProject.notes || 'Không ghi nhận trở ngại.'}
            </div>

            {/* Xóa dự án phục vụ liên thông — gated by canDeleteProject */}
            {canDeleteProject && onDeleteProject && (
              <div className="border-t pt-4 mt-2">
                {!isConfirmingDelete ? (
                  <button
                    onClick={() => setIsConfirmingDelete(true)}
                    className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-650 p-2 text-xs font-bold rounded-lg cursor-pointer transition-all border border-red-200"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    Xóa dự án khỏi hệ thống
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-250 p-2.5 rounded-lg space-y-2 text-left">
                    <p className="text-[11px] text-red-700 font-bold leading-normal">
                      ⚠️ Bạn có chắc chắn muốn xóa dự án này khỏi hệ thống? Thao tác này sẽ xóa vĩnh viễn toàn bộ hồ sơ của dự án và toàn bộ các nhiệm vụ, công việc thi công liên quan!
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          onDeleteProject(selectedProject.id);
                          setSelectedProjectId(null);
                          setIsConfirmingDelete(false);
                        }}
                        className="flex-1 bg-red-650 hover:bg-red-700 text-white font-extrabold text-[10px] py-1.5 rounded-md cursor-pointer transition-all"
                      >
                        Xác nhận xóa
                      </button>
                      <button
                        onClick={() => setIsConfirmingDelete(false)}
                        className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-[10px] py-1.5 rounded-md cursor-pointer transition-all"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20 text-slate-400 font-bold text-xs bg-white rounded-xl border border-dashed">Hãy lựa chọn dự án để xem dải dòng sổ cái sâu.</div>
        )}
      </div>

    </div>
  );
}
