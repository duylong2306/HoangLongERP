import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../lib/dbService';
import { Employee, SupplierPartner, ArchivedQuote, Project } from '../types';
import { useNotification, isUserInRoleGroup } from '../context';
import * as XLSX from 'xlsx';
import {
  FileText,
  DollarSign,
  CheckCircle2,
  ShieldAlert,
  Layers,
  Search,
  MapPin,
  X,
  Plus,
  Edit,
  Trash2,
  CircleDot,
  Briefcase,
  Download,
  FileUp
} from 'lucide-react';
import SubcontractorArchive from './SubcontractorArchive';

interface SubcontractorManagementProps {
  currentUser: Employee;
  canEdit?: boolean;
  canDelete?: boolean;
  /** Khi truyền vào, SubcontractorArchive sẽ auto-mở print preview cho HĐ này. */
  viewContractId?: string;
}

export default function SubcontractorManagement({
  currentUser,
  canEdit = true,
  canDelete = true,
  viewContractId
}: SubcontractorManagementProps) {
  const { addToast } = useNotification();
  const [activeManagementTab, setActiveManagementTab] = useState<'contracts' | 'list'>('contracts');
  const [stats, setStats] = useState({
    totalContracts: 0,
    totalValue: 0,
    completedCount: 0,
    doingCount: 0,
  });

  const [archivedQuotes, setArchivedQuotes] = useState<ArchivedQuote[]>([]);
  const [projectsList, setProjectsList] = useState<Project[]>([]);

  // ── Must be before filteredSuppliers (line ~88) to avoid TDZ ────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSup, setPageSup] = useState(1);
  const [pageSizeSup, setPageSizeSup] = useState(10);

  // Suppliers state — load from Supabase on mount
  const [suppliers, setSuppliers] = useState<SupplierPartner[]>([]);

  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const data = await dbService.suppliers.list();
        setSuppliers(data);
      } catch (e) {
        console.error("Lỗi load thầu phụ từ Supabase:", e);
      }
    };
    loadSuppliers();
    const handleSync = () => loadSuppliers();
    window.addEventListener('hl-suppliers-updated', handleSync);
    return () => window.removeEventListener('hl-suppliers-updated', handleSync);
  }, []);

  const [editingSupId, setEditingSupId] = useState<string | null>(null);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [selectedSupDetail, setSelectedSupDetail] = useState<SupplierPartner | null>(null);

  // ── Multi-row selection ──
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.representative && s.representative.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.field && s.field.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.phone && s.phone.includes(searchTerm))
  );
  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedRows(new Set(filteredSuppliers.map(s => s.id)));
    else setSelectedRows(new Set());
    setSelectAll(checked);
  };
  const handleRowSelect = (id: string, checked: boolean) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const handleBulkDelete = () => {
    if (selectedRows.size === 0) return;
    if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa ${selectedRows.size} thầu phụ đã chọn không?\nHành động này không thể hoàn tác.`)) return;
    const idsToDelete = Array.from(selectedRows);
    setSuppliers(suppliers.filter(s => !selectedRows.has(s.id)));
    setSelectedRows(new Set());
    setSelectAll(false);
    idsToDelete.forEach(id => dbService.suppliers.delete(id).catch(() => {}));
    addToast({ title: '✅ Đã xóa', message: `Đã xóa ${selectedRows.size} thầu phụ.`, type: 'success' });
  };

  // Supplier form fields
  const [formSupName, setFormSupName] = useState('');
  const [formSupRep, setFormSupRep] = useState('');
  const [formSupGender, setFormSupGender] = useState('Nam');
  const [formSupBirthDate, setFormSupBirthDate] = useState('');
  const [formSupCccd, setFormSupCccd] = useState('');
  const [formSupCccdDate, setFormSupCccdDate] = useState('');
  const [formSupCccdPlace, setFormSupCccdPlace] = useState('');
  const [formSupEmail, setFormSupEmail] = useState('');
  const [formSupBankAccount, setFormSupBankAccount] = useState('');
  const [formSupBankName, setFormSupBankName] = useState('');
  const [formSupPhone, setFormSupPhone] = useState('');
  const [formSupField, setFormSupField] = useState('Thợ thầu thi công');
  const [formSupAddress, setFormSupAddress] = useState('');
  const [formSupTaxCode, setFormSupTaxCode] = useState('');
  const [formSupNote, setFormSupNote] = useState('');
  const [isRepManuallyEdited, setIsRepManuallyEdited] = useState(false);

  const loadStats = async () => {
    try {
      const data = await dbService.archivedSubcontractorQuotes.list();
      setArchivedQuotes(data);
      const projs = await dbService.projects.list();
      setProjectsList(projs);
      
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

  const getAbbreviation = (str: string) => {
    if (!str) return '';
    return str
      .split(' ')
      .map(w => w.charAt(0))
      .join('')
      .toUpperCase();
  };

  const handleAddSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSupName || !formSupPhone || !formSupAddress || !formSupRep) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng điền đầy đủ các thông tin bắt buộc (Tên thầu phụ, Người đại diện, Điện thoại, Địa chỉ)!', type: 'warning' });
      return;
    }

    if (editingSupId) {
      const updated = suppliers.map(s => {
        if (s.id === editingSupId) {
          return {
            ...s,
            name: formSupName,
            representative: formSupRep,
            gender: formSupGender,
            birthDate: formSupBirthDate,
            cccd: formSupCccd,
            cccdDate: formSupCccdDate,
            cccdPlace: formSupCccdPlace,
            address: formSupAddress,
            phone: formSupPhone,
            email: formSupEmail,
            taxCode: formSupTaxCode,
            bankAccount: formSupBankAccount,
            bankName: formSupBankName,
            field: formSupField,
            note: formSupNote,
            region: formSupAddress, // sync legacy field
            bankNo: formSupBankAccount
          };
        }
        return s;
      });
      setSuppliers(updated);
      const editedSup = updated.find(s => s.id === editingSupId);
      if (editedSup) dbService.suppliers.save(editedSup).catch(() => {});

      if (selectedSupDetail && selectedSupDetail.id === editingSupId) {
        setSelectedSupDetail({
          id: editingSupId,
          name: formSupName,
          representative: formSupRep,
          gender: formSupGender,
          birthDate: formSupBirthDate,
          cccd: formSupCccd,
          cccdDate: formSupCccdDate,
          cccdPlace: formSupCccdPlace,
          address: formSupAddress,
          phone: formSupPhone,
          email: formSupEmail,
          taxCode: formSupTaxCode,
          bankAccount: formSupBankAccount,
          bankName: formSupBankName,
          field: formSupField,
          note: formSupNote,
          region: formSupAddress,
          bankNo: formSupBankAccount
        });
      }

      setEditingSupId(null);
      setShowSupplierForm(false);
      resetSupForm();
      addToast({ title: '✅ Thành công', message: `✅ Đã cập nhật thông tin thầu phụ ${formSupName} thành công.`, type: 'success' });
    } else {
      const abbrev = getAbbreviation(formSupName) || 'TP';
      const orderIndex = suppliers.length + 1;
      const generatedId = `${abbrev}_${orderIndex}`;

      const newSup: SupplierPartner = {
        id: generatedId,
        name: formSupName,
        representative: formSupRep || formSupName,
        gender: formSupGender,
        birthDate: formSupBirthDate,
        cccd: formSupCccd,
        cccdDate: formSupCccdDate,
        cccdPlace: formSupCccdPlace,
        address: formSupAddress,
        phone: formSupPhone,
        email: formSupEmail,
        taxCode: formSupTaxCode,
        bankAccount: formSupBankAccount,
        bankName: formSupBankName,
        field: formSupField,
        note: formSupNote,
        region: formSupAddress,
        bankNo: formSupBankAccount
      };

      setSuppliers([...suppliers, newSup]);
      dbService.suppliers.save(newSup).catch(() => {});
      setShowSupplierForm(false);
      resetSupForm();
      addToast({ title: '✅ Thành công', message: `🤝 Đã thêm thầu phụ mới ${newSup.name} với Mã: ${newSup.id} thành công.`, type: 'success' });
    }
  };

  const resetSupForm = () => {
    setFormSupName('');
    setFormSupRep('');
    setFormSupGender('Nam');
    setFormSupBirthDate('');
    setFormSupCccd('');
    setFormSupCccdDate('');
    setFormSupCccdPlace('');
    setFormSupEmail('');
    setFormSupBankAccount('');
    setFormSupBankName('');
    setFormSupPhone('');
    setFormSupField('Thợ thầu thi công');
    setFormSupAddress('');
    setFormSupTaxCode('');
    setFormSupNote('');
    setEditingSupId(null);
    setIsRepManuallyEdited(false);
  };

  const limitSup = pageSizeSup === -1 ? filteredSuppliers.length : pageSizeSup;
  const totalPagesSup = Math.ceil(filteredSuppliers.length / limitSup) || 1;
  const adjustedPageSup = Math.min(pageSup, totalPagesSup);
  const startIndexSup = (adjustedPageSup - 1) * limitSup;
  const endIndexSup = startIndexSup + limitSup;
  const paginatedSuppliers = filteredSuppliers.slice(startIndexSup, endIndexSup);

  const handleNameChange = (val: string) => {
    setFormSupName(val);
    if (!isRepManuallyEdited) {
      setFormSupRep(val);
    }
  };

  const handleRepChange = (val: string) => {
    setFormSupRep(val);
    setIsRepManuallyEdited(true);
  };

  // ===================== BLOCK EXCEL (DANH SÁCH THẦU PHỤ) =====================
  const subcontractorFileInputRef = useRef<HTMLInputElement>(null);

  const handleExportSubcontractorExcel = () => {
    if (suppliers.length === 0) {
      addToast({ title: '⚠️ Không có dữ liệu', message: 'Chưa có thầu phụ nào để xuất.', type: 'warning' });
      return;
    }
    const data = suppliers.map(s => ({
      'Mã thầu phụ': s.id,
      'Tên thầu phụ': s.name,
      'Người đại diện': s.representative || '',
      'Giới tính': s.gender || '',
      'Ngày sinh': s.birthDate || '',
      'CCCD': s.cccd || '',
      'Ngày cấp CCCD': s.cccdDate || '',
      'Nơi cấp CCCD': s.cccdPlace || '',
      'Địa chỉ': s.address || '',
      'Số điện thoại': s.phone || '',
      'Email': s.email || '',
      'Mã số thuế': s.taxCode || '',
      'Số tài khoản': s.bankAccount || s.bankNo || '',
      'Ngân hàng': s.bankName || '',
      'Chuyên môn': s.field || '',
      'Ghi chú': s.note || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DanhSachThauPhu');
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    XLSX.writeFile(wb, `DanhSachThauPhu_${ymd}.xlsx`);
    addToast({ title: '✅ Xuất Excel', message: `Đã xuất ${data.length} thầu phụ`, type: 'success' });
  };

  const handleImportSubcontractorExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const imported: SupplierPartner[] = rows.map((r, idx) => ({
          id: String(r['Mã thầu phụ'] || `TP_IMP_${Date.now()}_${idx}`),
          name: String(r['Tên thầu phụ'] || '').trim(),
          representative: String(r['Người đại diện'] || r['Tên thầu phụ'] || ''),
          gender: String(r['Giới tính'] || 'Nam'),
          birthDate: String(r['Ngày sinh'] || ''),
          cccd: String(r['CCCD'] || ''),
          cccdDate: String(r['Ngày cấp CCCD'] || ''),
          cccdPlace: String(r['Nơi cấp CCCD'] || ''),
          address: String(r['Địa chỉ'] || 'Đà Lạt'),
          phone: String(r['Số điện thoại'] || ''),
          email: String(r['Email'] || ''),
          taxCode: String(r['Mã số thuế'] || ''),
          bankAccount: String(r['Số tài khoản'] || ''),
          bankNo: String(r['Số tài khoản'] || ''),
          bankName: String(r['Ngân hàng'] || ''),
          field: String(r['Chuyên môn'] || 'Thợ thầu thi công'),
          note: String(r['Ghi chú'] || ''),
          region: String(r['Địa chỉ'] || 'Đà Lạt'),
        })).filter(r => r.name && r.phone);
        if (imported.length === 0) {
          addToast({ title: '⚠️ Không có dữ liệu', message: 'File không có dòng hợp lệ (cần Tên thầu phụ, Số điện thoại).', type: 'warning' });
          return;
        }
        const merged = [...suppliers];
        imported.forEach(imp => {
          const dupIdx = merged.findIndex(s => s.name.toLowerCase() === imp.name.toLowerCase() || s.id === imp.id);
          if (dupIdx > -1) merged[dupIdx] = { ...merged[dupIdx], ...imp };
          else merged.push(imp);
        });
        setSuppliers(merged);
        addToast({ title: '✅ Nhập thành công', message: `Đã import ${imported.length} thầu phụ`, type: 'success' });
      } catch (err) {
        addToast({ title: '⛔ Lỗi', message: 'Không thể đọc file Excel', type: 'error' });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

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

      {/* Tab bar header */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-1.5 shadow-2xl" id="subcontractor_tab_workspace">
        <div className="flex border-b border-slate-800/80 px-4.5 pt-3 pb-0 gap-6 overflow-x-auto scrollbar-none" id="subcontractor_management_nav">
          <button
            type="button"
            onClick={() => setActiveManagementTab('contracts')}
            className={`text-xs font-black uppercase tracking-wider relative pb-3 transition-all cursor-pointer ${
              activeManagementTab === 'contracts' ? 'text-emerald-400' : 'text-slate-450 hover:text-slate-205'
            }`}
          >
            🤝 HỢP ĐỒNG THẦU PHỤ LIÊN KẾT ĐÃ LẬP
            {activeManagementTab === 'contracts' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-emerald-500 rounded-full" />
            )}
          </button>
          
          <button
            type="button"
            onClick={() => setActiveManagementTab('list')}
            className={`text-xs font-black uppercase tracking-wider relative pb-3 transition-all cursor-pointer ${
              activeManagementTab === 'list' ? 'text-emerald-400' : 'text-slate-450 hover:text-slate-205'
            }`}
          >
            📋 DANH SÁCH THẦU PHỤ
            {activeManagementTab === 'list' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-emerald-500 rounded-full" />
            )}
          </button>
        </div>

        <div className="p-4" id="subcontractor_tab_content">
          {activeManagementTab === 'contracts' ? (
            <div id="subcontractor_archive_wrapper">
              <SubcontractorArchive
                currentUser={currentUser}
                canEdit={canEdit}
                canDelete={canDelete}
                viewContractId={viewContractId}
              />
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in" id="subcontractor_directory_panel">
              {/* Toolbar & Search */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="Tìm kiếm nhanh tên, lĩnh vực, số điện thoại thầu phụ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none text-slate-100 placeholder-slate-500 focus:border-orange-500 transition-colors"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                </div>

                <div className="flex justify-between items-center border-b border-slate-850 pb-0 sm:pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!canEdit) {
                        addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền KHỞI TẠO thầu phụ mới.', type: 'error' });
                        return;
                      }
                      if (showSupplierForm && editingSupId) {
                        resetSupForm();
                      } else {
                        setShowSupplierForm(!showSupplierForm);
                      }
                    }}
                    className={`font-bold text-[10.5px] px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ${canEdit ? 'bg-orange-600 hover:bg-orange-550 text-white cursor-pointer active:scale-95' : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'}`}
                  >
                    {editingSupId ? '✏️ Đang sửa thầu phụ' : '+ Thêm thầu phụ mới'}
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleExportSubcontractorExcel}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10.5px] px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Download className="w-3 h-3" /> Xuất Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => subcontractorFileInputRef.current?.click()}
                      className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10.5px] px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <FileUp className="w-3 h-3" /> Nhập Excel
                    </button>
                    <input
                      ref={subcontractorFileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={handleImportSubcontractorExcel}
                    />
                  </div>
                </div>
              </div>

              <div id="subcontractor_form_anchor" />

              {showSupplierForm && (
                <form onSubmit={handleAddSupplierSubmit} className="bg-slate-950/80 border border-slate-800 p-4.5 rounded-xl space-y-3 animate-scaleIn">
                  <h4 className="text-white font-bold text-xs uppercase tracking-wide border-b border-slate-800 pb-1 text-left">
                    {editingSupId ? `✏️ Cập nhật thông tin Thầu phụ: ${editingSupId}` : '🤝 Đăng ký Thầu phụ mới'}
                  </h4>

                  {/* Row 1: Tên thầu phụ, Họ tên Bên B, Giới tính */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10.5px] text-left">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Tên Thầu Phụ <span className="text-red-400">*</span>:</label>
                      <input
                        type="text"
                        required
                        value={formSupName}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="Nhập tên tổ đội / thầu phụ khoán..."
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Người Đại Diện / Bên B <span className="text-red-400">*</span>:</label>
                      <input
                        type="text"
                        required
                        value={formSupRep}
                        onChange={(e) => handleRepChange(e.target.value)}
                        placeholder="Họ tên người nhận khoán..."
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Giới tính Bên B:</label>
                      <select
                        value={formSupGender}
                        onChange={(e) => setFormSupGender(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500"
                      >
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Ngày sinh, Điện thoại, Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10.5px] text-left">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Ngày sinh Bên B:</label>
                      <input
                        type="date"
                        value={formSupBirthDate}
                        onChange={(e) => setFormSupBirthDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Số Điện Thoại <span className="text-red-400">*</span>:</label>
                      <input
                        type="text"
                        required
                        value={formSupPhone}
                        onChange={(e) => setFormSupPhone(e.target.value)}
                        placeholder="Nhập số điện thoại..."
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Email Bên B:</label>
                      <input
                        type="email"
                        value={formSupEmail}
                        onChange={(e) => setFormSupEmail(e.target.value)}
                        placeholder="Email liên hệ..."
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Row 3: CCCD, Ngày cấp, Nơi cấp */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10.5px] text-left">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Số CCCD Bên B:</label>
                      <input
                        type="text"
                        value={formSupCccd}
                        onChange={(e) => setFormSupCccd(e.target.value)}
                        placeholder="Nhập số CCCD..."
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Ngày cấp CCCD:</label>
                      <input
                        type="date"
                        value={formSupCccdDate}
                        onChange={(e) => setFormSupCccdDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Nơi cấp CCCD:</label>
                      <input
                        type="text"
                        value={formSupCccdPlace}
                        onChange={(e) => setFormSupCccdPlace(e.target.value)}
                        placeholder="Ví dụ: Cục Cảnh sát QLHC về TTXH..."
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  {/* Row 4: Địa chỉ thường trú, Lĩnh vực */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10.5px] text-left">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Địa chỉ thường trú <span className="text-red-400">*</span>:</label>
                      <input
                        type="text"
                        required
                        value={formSupAddress}
                        onChange={(e) => setFormSupAddress(e.target.value)}
                        placeholder="Nhập địa chỉ đăng ký thường trú..."
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Lĩnh vực hoạt động:</label>
                      <input
                        type="text"
                        value={formSupField}
                        onChange={(e) => setFormSupField(e.target.value)}
                        placeholder="Ví dụ: Thợ dán mâm Acrylic, sắt móng thô..."
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  {/* Row 5: MST cá nhân, Số tài khoản, Ngân hàng */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10.5px] text-left">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">MST cá nhân Bên B:</label>
                      <input
                        type="text"
                        value={formSupTaxCode}
                        onChange={(e) => setFormSupTaxCode(e.target.value)}
                        placeholder="Nhập mã số thuế cá nhân..."
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Số tài khoản ngân hàng:</label>
                      <input
                        type="text"
                        value={formSupBankAccount}
                        onChange={(e) => setFormSupBankAccount(e.target.value)}
                        placeholder="Nhập số tài khoản..."
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Tên ngân hàng (Mở tại):</label>
                      <input
                        type="text"
                        value={formSupBankName}
                        onChange={(e) => setFormSupBankName(e.target.value)}
                        placeholder="Ví dụ: BIDV - Chi nhánh Lâm Đồng..."
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  {/* Row 6: Ghi chú */}
                  <div className="text-[10.5px] text-left">
                    <label className="block text-slate-400 font-semibold mb-1">Ghi chú:</label>
                    <input
                      type="text"
                      value={formSupNote}
                      onChange={(e) => setFormSupNote(e.target.value)}
                      placeholder="Ghi chú về kinh nghiệm, năng lực hoặc đội thợ..."
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowSupplierForm(false);
                        resetSupForm();
                      }} 
                      className="bg-slate-850 hover:bg-slate-800 px-3 py-1.5 rounded-lg text-slate-300 font-bold cursor-pointer text-[10.5px]"
                    >
                      Hủy
                    </button>
                    <button type="submit" className="bg-orange-600 hover:bg-orange-550 text-white px-3.5 py-1.5 rounded-lg font-bold text-[10.5px] cursor-pointer">
                      {editingSupId ? 'Lưu cập nhật' : 'Thêm Thầu phụ'}
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Left Table Panel */}
                <div className={`${selectedSupDetail ? 'xl:col-span-7' : 'xl:col-span-12'} space-y-4 transition-all duration-300`}>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto shadow-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider font-sans">
                          <th className="p-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={selectAll && filteredSuppliers.length > 0 && filteredSuppliers.every(s => selectedRows.has(s.id))}
                              onChange={(e) => handleSelectAll(e.target.checked)}
                              className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                            />
                          </th>
                          <th className="p-3 pl-4">Mã Thầu Phụ</th>
                          <th className="p-3">Tên Thầu Phụ</th>
                          <th className="p-3">Người Đại Diện</th>
                          <th className="p-3">Lĩnh vực hoạt động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {paginatedSuppliers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                              Không tìm thấy thầu phụ nào phù hợp.
                            </td>
                          </tr>
                        ) : (
                          paginatedSuppliers.map(s => (
                            <tr
                              key={s.id}
                              onClick={() => setSelectedSupDetail(s)}
                              className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                                selectedSupDetail?.id === s.id ? 'bg-orange-600/10 border-l-2 border-orange-500' : ''
                              } ${selectedRows.has(s.id) ? 'bg-amber-500/10' : ''}`}
                            >
                              {/* Checkbox */}
                              <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedRows.has(s.id)}
                                  onChange={(e) => { e.stopPropagation(); handleRowSelect(s.id, e.target.checked); }}
                                  className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                                />
                              </td>
                              {/* Subcontractor ID */}
                              <td className="p-3 pl-4 font-mono font-bold text-yellow-500 text-[10px] uppercase">
                                {s.id}
                              </td>

                              {/* Subcontractor Name */}
                              <td className="p-3">
                                <div className="font-extrabold text-white text-[12.5px]">
                                  {s.name}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  Địa chỉ: <span className="text-slate-350">{s.address || s.region || 'Không có'}</span>
                                </div>
                              </td>

                              {/* Representative */}
                              <td className="p-3 text-slate-300 font-medium">
                                {s.representative || s.name}
                              </td>

                              {/* Field / Contact */}
                              <td className="p-3">
                                <span className="text-orange-400 font-extrabold text-[11px] block">{s.field || 'Chưa phân loại'}</span>
                                {s.phone && (
                                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                    ĐT: {s.phone}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {selectedRows.size > 0 && (
                    <div className="bg-slate-950 px-4 py-2 border-t border-slate-850 flex items-center gap-2 text-[10px]">
                      <span className="text-amber-500 font-bold">Đã chọn: {selectedRows.size}</span>
                      <button
                        onClick={handleBulkDelete}
                        className="bg-rose-650 hover:bg-rose-600 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Xóa
                      </button>
                    </div>
                  )}

                  {/* Pagination block */}
                  <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-900/60 p-3 rounded-xl border border-slate-800 gap-3 text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <span>Số dòng hiển thị:</span>
                      <select
                        value={pageSizeSup}
                        onChange={(e) => {
                          setPageSizeSup(Number(e.target.value));
                          setPageSup(1);
                        }}
                        className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none cursor-pointer focus:border-orange-500 font-bold"
                      >
                        <option value={5}>5 dòng</option>
                        <option value={10}>10 dòng</option>
                        <option value={20}>20 dòng</option>
                        <option value={-1}>Tất cả</option>
                      </select>
                      <span>trong tổng số {filteredSuppliers.length} dòng</span>
                    </div>

                    {pageSizeSup !== -1 && totalPagesSup > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={adjustedPageSup === 1}
                          onClick={() => setPageSup(prev => Math.max(prev - 1, 1))}
                          className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-slate-300 hover:text-white disabled:opacity-35 disabled:pointer-events-none font-bold transition-all cursor-pointer"
                        >
                          ◀ Trước
                        </button>
                        <span className="font-mono text-slate-300 px-1">
                          Trang {adjustedPageSup} / {totalPagesSup}
                        </span>
                        <button
                          type="button"
                          disabled={adjustedPageSup === totalPagesSup}
                          onClick={() => setPageSup(prev => Math.min(prev + 1, totalPagesSup))}
                          className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-slate-300 hover:text-white disabled:opacity-35 disabled:pointer-events-none font-bold transition-all cursor-pointer"
                        >
                          Sau ▶
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Detail Panel */}
                {selectedSupDetail && (() => {
                  const linkedSubs = archivedQuotes.filter(sub => sub.subcontractorId === selectedSupDetail.id);
                  return (
                    <div className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 sticky top-4 animate-scaleIn space-y-4 text-left text-xs">
                      <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="p-2 rounded bg-yellow-500/10 text-yellow-500">
                            <Briefcase className="w-4 h-4" />
                          </span>
                          <div>
                            <span className="font-mono text-[9px] text-yellow-500 font-extrabold uppercase tracking-wider">
                              {selectedSupDetail.id.toUpperCase()}
                            </span>
                            <h3 className="font-extrabold text-white text-sm mt-0.5">
                              Hồ sơ Thầu phụ khoán
                            </h3>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedSupDetail(null)}
                          className="text-slate-400 hover:text-white bg-slate-850 p-1.5 rounded-lg transition-colors cursor-pointer"
                          title="Đóng xem chi tiết"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div className="p-4 bg-slate-950/60 rounded-xl space-y-3 border border-slate-850">
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Tên thầu phụ</span>
                            <strong className="text-white text-sm block font-extrabold mt-1">{selectedSupDetail.name}</strong>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-850/50">
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Người đại diện (Bên B)</span>
                              <span className="text-white mt-1 block font-bold text-[11px]">{selectedSupDetail.representative || selectedSupDetail.name}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Giới tính</span>
                              <span className="text-white mt-1 block font-medium text-[11px]">{selectedSupDetail.gender || 'Nam'}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-850/50">
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Ngày sinh</span>
                              <span className="text-white mt-1 block font-mono text-[11px]">{selectedSupDetail.birthDate ? new Date(selectedSupDetail.birthDate).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Số điện thoại</span>
                              <span className="text-slate-205 mt-1 block font-mono font-bold text-[11px]">{selectedSupDetail.phone || 'Chưa cập nhật'}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-850/50">
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Số CCCD</span>
                              <span className="text-slate-300 mt-1 block font-mono text-[11px]">{selectedSupDetail.cccd || 'Chưa cập nhật'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Ngày cấp</span>
                              <span className="text-slate-300 mt-1 block font-mono text-[11.5px]">{selectedSupDetail.cccdDate ? new Date(selectedSupDetail.cccdDate).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Nơi cấp</span>
                              <span className="text-slate-300 mt-1 block text-[11.5px] truncate" title={selectedSupDetail.cccdPlace}>{selectedSupDetail.cccdPlace || 'Chưa cập nhật'}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-850/50">
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Địa chỉ thường trú</span>
                              <span className="text-slate-300 mt-1 block font-medium flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400 inline shrink-0" /> <span className="truncate">{selectedSupDetail.address || 'Trống'}</span>
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Email Bên B</span>
                              <span className="text-slate-300 mt-1 block font-mono text-[11px] truncate" title={selectedSupDetail.email}>{selectedSupDetail.email || 'Chưa cập nhật'}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-850/50">
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">MST cá nhân</span>
                              <span className="text-slate-300 mt-1 block font-mono text-[11px]">{selectedSupDetail.taxCode || 'Chưa cập nhật'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Lĩnh vực</span>
                              <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-500">
                                {selectedSupDetail.field || 'Chưa phân loại'}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-850/50">
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Số tài khoản</span>
                              <span className="text-slate-300 mt-1 block font-mono text-[11px]">{selectedSupDetail.bankAccount || 'Chưa cập nhật'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Tại ngân hàng</span>
                              <span className="text-slate-300 mt-1 block text-[11px] truncate" title={selectedSupDetail.bankName}>{selectedSupDetail.bankName || 'Chưa cập nhật'}</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-850/50">
                            <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Ghi chú</span>
                            <span className="text-slate-300 mt-1 block text-[10.5px] max-h-12 overflow-y-auto" title={selectedSupDetail.note}>
                              {selectedSupDetail.note || 'Không có ghi chú'}
                            </span>
                          </div>
                        </div>

                        {/* Linked Contracts section */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center px-1">
                            <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Hợp đồng thầu phụ liên quan ({linkedSubs.length})</span>
                          </div>
                          
                          {linkedSubs.length === 0 ? (
                            <div className="p-3 bg-slate-950/30 rounded-xl text-center text-slate-500 italic">
                              Chưa có hợp đồng giao khoán nào.
                            </div>
                          ) : (
                            <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                              {linkedSubs.map(sub => {
                                const projName = projectsList.find(p => p.id === sub.projectId)?.name || 'Dự án khác';
                                return (
                                  <div key={sub.id} className="p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl text-[11px] hover:bg-slate-950/80 transition-colors">
                                    <div className="flex justify-between font-mono font-bold text-[10px] text-orange-400">
                                      <span>{sub.code || sub.id}</span>
                                      <span className={`text-[8.5px] px-1.5 rounded uppercase ${
                                        (sub.status as string) === 'Hoàn thành'
                                          ? 'bg-emerald-500/10 text-emerald-400'
                                          : 'bg-sky-500/10 text-sky-400'
                                      }`}>
                                        {sub.status || 'Chạy'}
                                      </span>
                                    </div>
                                    <p className="text-white font-medium mt-1 line-clamp-1">{(sub as any).scopeWork || 'Giao khoán thầu phụ'}</p>
                                    <div className="flex justify-between text-[9.5px] text-slate-500 mt-1">
                                      <span className="truncate max-w-[120px]">DA: <strong className="text-slate-400">{projName}</strong></span>
                                      <strong className="text-slate-205 font-mono">{(sub.contractValue || 0).toLocaleString('vi-VN')} đ</strong>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!canEdit) {
                              addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền SỬA thông tin thầu phụ.', type: 'error' });
                              return;
                            }
                            setEditingSupId(selectedSupDetail.id);
                            setFormSupName(selectedSupDetail.name);
                            setFormSupRep(selectedSupDetail.representative || selectedSupDetail.name);
                            setFormSupGender(selectedSupDetail.gender || 'Nam');
                            setFormSupBirthDate(selectedSupDetail.birthDate || '');
                            setFormSupCccd(selectedSupDetail.cccd || selectedSupDetail.taxCode || '');
                            setFormSupCccdDate(selectedSupDetail.cccdDate || '');
                            setFormSupCccdPlace(selectedSupDetail.cccdPlace || '');
                            setFormSupEmail(selectedSupDetail.email || '');
                            setFormSupBankAccount(selectedSupDetail.bankAccount || selectedSupDetail.bankNo || '');
                            setFormSupBankName(selectedSupDetail.bankName || '');
                            setFormSupPhone(selectedSupDetail.phone);
                            setFormSupField(selectedSupDetail.field || '');
                            setFormSupAddress(selectedSupDetail.address || selectedSupDetail.region || '');
                            setFormSupTaxCode(selectedSupDetail.taxCode || '');
                            setFormSupNote(selectedSupDetail.note || '');
                            setIsRepManuallyEdited(true);
                            setShowSupplierForm(true);
                            document.getElementById('subcontractor_form_anchor')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="bg-amber-600 hover:bg-amber-550 text-white font-bold py-2 rounded-xl text-center flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" /> Sửa thầu phụ
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!canDelete) {
                              addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền XÓA thầu phụ.', type: 'error' });
                              return;
                            }
                            
                            const hasLinkedContracts = linkedSubs.length > 0;
                            let confirmMessage = `⚠️ CẢNH BÁO QUAN TRỌNG:\n\nHành động xóa này không thể hoàn tác!\nBạn có thực sự chắc chắn muốn xóa Thầu phụ "${selectedSupDetail.name}" (Mã: ${selectedSupDetail.id}) ra khỏi hệ thống danh mục không?`;
                            
                            if (hasLinkedContracts) {
                              confirmMessage = `🚨 CẢNH BÁO NGUY HIỂM CAO ĐỘ:\n\nThầu phụ "${selectedSupDetail.name}" đang liên kết với ${linkedSubs.length} Hợp đồng thầu phụ đang lưu vết trong sổ sách kế toán!\n\nNếu xóa thầu phụ này, các hợp đồng liên quan sẽ bị lỗi hiển thị thầu phụ.\nBạn có THỰC SỰ CHẮC CHẮN MUỐN TIẾP TỤC XÓA và tự chịu trách nhiệm về tính toàn vẹn dữ liệu không?`;
                            }

                            if (confirm(confirmMessage)) {
                              if (hasLinkedContracts) {
                                const secondConfirm = confirm(`XÁC NHẬN LẦN CUỐI:\n\nNhấn OK để thực sự xóa sạch thông tin của thầu phụ "${selectedSupDetail.name}".\nNhấn Cancel để hủy bỏ.`);
                                if (!secondConfirm) return;
                              }
                              
                              setSuppliers(suppliers.filter(s => s.id !== selectedSupDetail.id));
                              dbService.suppliers.delete(selectedSupDetail.id).catch(() => {});
                              setSelectedSupDetail(null);
                              addToast({ title: '✅ Thành công', message: `✅ Đã xóa thầu phụ "${selectedSupDetail.name}" thành công.`, type: 'success' });
                            }
                          }}
                          className="bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/30 font-bold py-2 rounded-xl text-center flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Xóa thầu phụ
                        </button>
                      </div>

                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedSupDetail(null)}
                          className="bg-slate-800 hover:bg-slate-755 text-slate-205 font-bold px-4 py-1.5 rounded-xl transition-colors cursor-pointer w-full text-center"
                        >
                          Đóng chi tiết
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
