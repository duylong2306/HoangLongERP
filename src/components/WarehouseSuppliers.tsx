import React, { useState, useEffect, useRef } from 'react';
import { SupplierPartner } from '../types';
import TablePagination, { usePagination } from './TablePagination';
import {
  Search, Plus, Trash2, Edit2, Check, X,
  Phone, Mail, MapPin, DollarSign, FileText, AlertCircle, RefreshCw,
  Download, FileUp
} from 'lucide-react';
import { dbService } from '../lib/dbService';
import { useNotification, hasModulePermission } from '../context';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import { exportToExcel, importFromExcel, formatDateForFile, EXCEL_HEADERS } from '../lib/excelUtils';

export default function WarehouseSuppliers({ autoOpenAddSignal = 0 }: { autoOpenAddSignal?: number }) {
  const { addToast } = useNotification();
  // Component này không nhận currentUser qua props nên lấy trực tiếp từ AuthContext để kiểm tra quyền.
  const { currentUser } = useAuth();
  const canCreate = hasModulePermission(currentUser?.id, 'warehouse_suppliers', 'create');
  const canEditSup = hasModulePermission(currentUser?.id, 'warehouse_suppliers', 'edit');
  const canDeleteSup = hasModulePermission(currentUser?.id, 'warehouse_suppliers', 'delete');
  const denyToast = (action: string) => addToast({ title: '⛔ Không đủ quyền', message: `Bạn không có quyền "${action}" ở phân hệ Nhà Cung Cấp Vật Tư.`, type: 'warning' });
  const [suppliers, setSuppliers] = useState<SupplierPartner[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedSupDetail, setSelectedSupDetail] = useState<SupplierPartner | null>(null);

  // ── Multi-row selection ──
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(filtered.map(s => s.id)));
    } else {
      setSelectedRows(new Set());
    }
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

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) return;
    if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa ${selectedRows.size} nhà cung cấp đã chọn không?\nHành động này không thể hoàn tác.`)) return;
    const idsToDelete = Array.from(selectedRows);
    const remaining = suppliers.filter(s => !selectedRows.has(s.id));
    setSuppliers(remaining);
    setSelectedRows(new Set());
    setSelectAll(false);
    addToast({ title: '✅ Đã xóa', message: `Đã xóa ${idsToDelete.length} nhà cung cấp.`, type: 'success' });
    // Persist deletions to Supabase — xóa kèm dòng Công nợ đầu kỳ snapshot của
    // từng NCC (nếu có) để tránh để lại dòng "mồ côi" cộng dư vào Công Nợ Trả.
    try {
      await Promise.allSettled(
        idsToDelete.flatMap(id => [
          dbService.suppliers.delete(id).catch(err => console.error("Lỗi xóa nhà cung cấp:", err)),
          dbService.accountingLiabilities.delete(`opbal_sup_${id}`).catch(() => {})
        ])
      );
    } catch (err) {
      console.error("Lỗi xóa hàng loạt nhà cung cấp:", err);
    }
  };

  // Excel import/export refs
  const nccFileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formRep, setFormRep] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formField, setFormField] = useState('Cung cấp gỗ ván & phụ kiện');
  const [formNote, setFormNote] = useState('');
  const [formBankNo, setFormBankNo] = useState('');
  const [formBankName, setFormBankName] = useState('');
  const [formDebt, setFormDebt] = useState<number>(0);
  const [formOpeningDebt, setFormOpeningDebt] = useState<number>(0);

  // Quick Debt adjustment
  const [adjustDebtId, setAdjustDebtId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustType, setAdjustType] = useState<'increase' | 'decrease'>('decrease');
  const [adjustNote, setAdjustNote] = useState('');

  const loadSuppliers = async () => {
    try {
      const data = await dbService.suppliers.list();
      const normalized = data.map((s: any) => ({
        ...s,
        debt: typeof s.debt === 'number' ? s.debt : 0
      }));
      setSuppliers(normalized);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadSuppliers();
    const syncSuppliers = () => loadSuppliers();
    window.addEventListener('hl-suppliers-updated', syncSuppliers);
    return () => window.removeEventListener('hl-suppliers-updated', syncSuppliers);
  }, []);

  // Đồng bộ dòng "Công nợ đầu kỳ" tương ứng của NCC này trong Công Nợ Trả
  // (bảng accounting_liabilities, id "opbal_sup_<mã NCC>") mỗi khi sửa/xóa NCC.
  // TRƯỚC ĐÂY: nút "Cập nhật Công Nợ Đầu Kỳ" ở tab Tài Chính chỉ COPY 1 LẦN giá
  // trị openingDebt sang 1 dòng riêng — sau đó nếu sửa hoặc xóa Công nợ đầu kỳ
  // trên hồ sơ NCC (hoặc xóa hẳn NCC), dòng đã copy KHÔNG tự cập nhật/xóa theo,
  // vẫn cộng dồn số cũ vào Công Nợ Trả mãi mãi. Sự cố thật: "CÔNG TY TNHH THIÊN
  // TỰ PHƯỚC" bị cộng dư 922.440.000đ từ 2 dòng snapshot cũ + mồ côi (1 dòng của
  // NCC đã xóa, 1 dòng chưa cập nhật theo khi NCC còn lại đổi Công nợ đầu kỳ về 0).
  const syncOpeningDebtLiability = async (supplierId: string, name: string, openingDebt: number) => {
    const liabId = `opbal_sup_${supplierId}`;
    try {
      if (openingDebt > 0) {
        await dbService.accountingLiabilities.save({
          id: liabId,
          name,
          category: 'Nhà Cung Cấp',
          value: 0,
          openingDebt,
          paid: 0,
          remaining: openingDebt,
          notes: 'Cập nhật từ Công Nợ đầu kỳ (NCC Vật tư)',
          isOpeningDebt: true,
        });
      } else {
        // Công nợ đầu kỳ = 0 (đã xóa/sửa về 0) → xóa luôn dòng snapshot tương ứng
        // thay vì để lại số cũ.
        await dbService.accountingLiabilities.delete(liabId);
      }
    } catch (err) {
      console.warn('Đồng bộ Công nợ đầu kỳ (Công Nợ Trả) thất bại:', err);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(editingId ? canEditSup : canCreate)) { denyToast(editingId ? 'Sửa' : 'Thêm'); setIsAdding(false); return; }
    if (!formName.trim()) return addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng nhập tên nhà cung cấp!', type: 'warning' });

    // Nếu đang sửa (editingId) → cập nhật bản ghi hiện có, không tạo mã mới.
    if (editingId) {
      const existing = suppliers.find(s => s.id === editingId);
      if (!existing) return;
      const updated: SupplierPartner = {
        ...existing,
        name: formName,
        representative: formRep || formName,
        phone: formPhone,
        email: formEmail,
        address: formAddress || 'Đà Lạt',
        field: formField,
        note: formNote,
        bankAccount: formBankNo,
        bankName: formBankName,
        bankNo: formBankNo,
        debt: formDebt,
        openingDebt: formOpeningDebt
      } as any;
      try {
        await dbService.suppliers.save(updated);
        await syncOpeningDebtLiability(updated.id, updated.name, updated.openingDebt || 0);
        setSuppliers(prev => prev.map(s => s.id === editingId ? updated : s));
        setIsAdding(false);
        resetForm();
        setSelectedSupDetail(updated);
        addToast({ title: '✅ Thành công', message: 'Cập nhật nhà cung cấp thành công!', type: 'success' });
      } catch (err) {
        console.error(err);
        addToast({ title: '⚠️ Lỗi', message: 'không thể lưu nhà cung cấp lên máy chủ.', type: 'warning' });
      }
      return;
    }

    const newId = `SUP_${Date.now()}`;
    const newSup: SupplierPartner = {
      id: newId,
      name: formName,
      representative: formRep || formName,
      gender: 'Nam',
      birthDate: '',
      cccd: '',
      cccdDate: '',
      cccdPlace: '',
      address: formAddress || 'Đà Lạt',
      phone: formPhone,
      email: formEmail,
      taxCode: '',
      bankAccount: formBankNo,
      bankName: formBankName,
      field: formField,
      note: formNote,
      debt: formDebt,
      openingDebt: formOpeningDebt
    } as any;

    try {
      await dbService.suppliers.save(newSup);
      await syncOpeningDebtLiability(newSup.id, newSup.name, newSup.openingDebt || 0);
      setSuppliers(prev => [...prev, newSup]);
      setIsAdding(false);
      resetForm();
      addToast({ title: '✅ Thành công', message: 'Thêm nhà cung cấp mới thành công!', type: 'success' });
    } catch (err) {
      console.error(err);
      addToast({ title: '⚠️ Lỗi', message: 'không thể lưu nhà cung cấp lên máy chủ.', type: 'warning' });
    }
  };

  const handleEditClick = (sup: SupplierPartner) => {
    // RÀ SOÁT 2026-09: chỉ hàm lưu kiểm tra canEditSup — chặn ngay từ bước mở form Sửa
    // để không có đường vòng và không hiện form cho người không đủ quyền.
    if (!canEditSup) { denyToast('Sửa'); return; }
    setEditingId(sup.id);
    setFormName(sup.name);
    setFormRep(sup.representative || '');
    setFormPhone(sup.phone || '');
    setFormEmail(sup.email || '');
    setFormAddress(sup.address || '');
    setFormField(sup.field || '');
    setFormNote(sup.note || '');
    setFormBankNo(sup.bankAccount || sup.bankNo || '');
    setFormBankName(sup.bankName || '');
    setFormDebt(sup.debt || 0);
    setFormOpeningDebt(sup.openingDebt || 0);
    setIsAdding(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!canDeleteSup) { denyToast('Xóa'); return; }
    if (window.confirm(`⚠️ Bạn có chắc chắn muốn XÓA nhà cung cấp "${name}"? Thao tác này sẽ dọn sạch thông tin đối tác khỏi hệ thống.`)) {
      try {
        await dbService.suppliers.delete(id);
        // Xóa luôn dòng Công nợ đầu kỳ snapshot của NCC này (nếu có) — tránh để
        // lại dòng "mồ côi" vẫn cộng vào Công Nợ Trả dù NCC đã bị xóa hẳn.
        await dbService.accountingLiabilities.delete(`opbal_sup_${id}`).catch(() => {});
        setSuppliers(prev => prev.filter(s => s.id !== id));
        addToast({ title: '🗑️ Đã xóa', message: 'Đã xóa nhà cung cấp.', type: 'info' });
      } catch (err) {
        console.error(err);
        addToast({ title: '🗑️ Đã xóa', message: 'Lỗi khi xóa nhà cung cấp.', type: 'info' });
      }
    }
  };

  const handleAdjustDebtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustDebtId || adjustAmount <= 0) return;
    
    const existing = suppliers.find(s => s.id === adjustDebtId);
    if (!existing) return;

    const currentDebt = typeof existing.debt === 'number' ? existing.debt : 0;
    const diff = adjustType === 'increase' ? adjustAmount : -adjustAmount;
    const updated = {
      ...existing,
      debt: Math.max(0, currentDebt + diff)
    };

    try {
      await dbService.suppliers.save(updated);
      setSuppliers(prev => prev.map(s => s.id === adjustDebtId ? updated : s));
      setAdjustDebtId(null);
      setAdjustAmount(0);
      setAdjustNote('');
      addToast({ title: '✅ Thành công', message: 'Ghi nhận công nợ thành công!', type: 'success' });
    } catch (err) {
      console.error(err);
      addToast({ title: '❌ Lỗi', message: 'lỗi ghi nhận công nợ lên Firebase.', type: 'error' });
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormRep('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormField('Cung cấp gỗ ván & phụ kiện');
    setFormNote('');
    setFormBankNo('');
    setFormBankName('');
    setFormDebt(0);
    setFormOpeningDebt(0);
    setEditingId(null);
  };

  // Mở nhanh form "Thêm Nhà Cung Cấp" khi nhận tín hiệu từ bên ngoài (vd: từ nút Chi Nhà Cung Cấp).
  useEffect(() => {
    if (autoOpenAddSignal > 0) {
      setEditingId(null);
      resetForm();
      setIsAdding(true);
    }
  }, [autoOpenAddSignal]);

  // ===================== BLOCK EXCEL (DANH MỤC NHÀ CUNG CẤP VẬT TƯ) =====================
  const handleExportNccExcel = () => {
    const data = suppliers.map(s => ({
      'Mã NCC': s.id,
      'Tên nhà cung cấp': s.name,
      'Số điện thoại': s.phone || '',
      'Email': s.email || '',
      'Địa chỉ': s.address || '',
      'Loại vật tư': s.field || '',
      'Công nợ đầu kỳ': s.openingDebt || 0,
      'Ghi chú': s.note || '',
    }));
    exportToExcel(data, 'DanhMucNCC', `DanhMucNCC_${formatDateForFile()}.xlsx`, undefined, [...EXCEL_HEADERS.supplier]);
    addToast({ title: '✅ Xuất Excel', message: `Đã xuất ${data.length} nhà cung cấp`, type: 'success' });
  };

  const handleImportNccExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false });
        if (rows.length === 0) {
          addToast({ title: '⚠️ Không có dữ liệu', message: 'File Excel trống.', type: 'warning' });
          return;
        }
        const deduped = new Map<string, any>();
        rows.forEach((r, idx) => {
          const id = String(r['Mã NCC'] || `NCC_IMP_${Date.now()}_${idx}`);
          deduped.set(id, r);
        });
        for (const [id, r] of deduped) {
          const name = String(r['Tên nhà cung cấp'] || '').trim();
          if (!name) continue;
          const existing = suppliers.find(s => s.id === id);
          const toSave: SupplierPartner = {
            ...(existing as SupplierPartner),
            id,
            name,
            representative: String(r['Người đại diện'] || r['Tên nhà cung cấp'] || existing?.representative || ''),
            gender: existing?.gender || 'Nam',
            birthDate: existing?.birthDate || '',
            cccd: existing?.cccd || '',
            cccdDate: existing?.cccdDate || '',
            cccdPlace: existing?.cccdPlace || '',
            address: String(r['Địa chỉ'] || existing?.address || 'Đà Lạt'),
            phone: String(r['Số điện thoại'] || existing?.phone || ''),
            email: String(r['Email'] || existing?.email || ''),
            taxCode: existing?.taxCode || '',
            bankAccount: String(r['Số tài khoản'] || existing?.bankAccount || ''),
            bankNo: String(r['Số tài khoản'] || existing?.bankNo || ''),
            bankName: String(r['Ngân hàng'] || existing?.bankName || ''),
            field: String(r['Loại vật tư'] || existing?.field || 'Cung cấp gỗ ván & phụ kiện'),
            note: String(r['Ghi chú'] || existing?.note || ''),
            openingDebt: Number(r['Công nợ đầu kỳ']) || existing?.openingDebt || 0,
            debt: existing?.debt || 0,
          };
          await dbService.suppliers.save(toSave);
          await syncOpeningDebtLiability(toSave.id, toSave.name, toSave.openingDebt || 0);
        }
        await loadSuppliers();
        addToast({ title: '✅ Nhập thành công', message: `Đã cập nhật ${deduped.size} nhà cung cấp (thêm mới/mã đã có)`, type: 'success' });
      } catch (err) {
        console.error(err);
        addToast({ title: '⛔ Lỗi', message: 'Không thể đọc file Excel', type: 'error' });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const [fieldFilter, setFieldFilter] = useState('all');
  const supFields = Array.from(new Set(suppliers.map(s => (s.field || '').trim()).filter(Boolean))).sort();
  // Phân trang danh sách nhà cung cấp (số dòng/trang + chuyển trang); đổi bộ lọc/tìm kiếm → về trang 1
  const pg = usePagination(10);
  useEffect(() => { pg.reset(); }, [searchTerm, fieldFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = suppliers.filter(s => {
    const matchSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.representative && s.representative.toLowerCase().includes(searchTerm.toLowerCase())) ||
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.field && s.field.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchField = fieldFilter === 'all' || (s.field || '') === fieldFilter;
    return matchSearch && matchField;
  });

  // ── Giao diện kiểu LoLo (xanh #0d47c9, ô sáng, bo xl): bộ lọc kèm ô tìm kiếm + chip lĩnh vực, bảng máy tính + thẻ điện thoại, thanh phân trang dùng chung ──
  const iconBtn = 'h-9 w-9 rounded-xl flex items-center justify-center bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer';
  const inputCls = 'w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#0d47c9]';
  const labelCls = 'block text-slate-600 font-bold text-[12px] mb-1';
  const money = (n: number) => `${(n || 0).toLocaleString('vi-VN')} đ`;
  // Số NCC theo từng lĩnh vực (hiện trên chip lọc)
  const fieldChips: [string, string, number][] = [
    ['all', 'Tất cả', suppliers.length],
    ...supFields.map(f => [f, f, suppliers.filter(s => (s.field || '').trim() === f).length] as [string, string, number]),
  ];
  const fieldPill = (f?: string) => (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-bold bg-[#e8efff] text-[#0d47c9] border-[#bcd0ff]">{f || 'Đại lý vật tư'}</span>
  );
  // Trang hiện tại của danh sách đã lọc; "chọn tất cả" chỉ áp dụng cho các dòng của trang này
  const pageRows = pg.slice(filtered);
  const pageAllSelected = pageRows.length > 0 && pageRows.every(s => selectedRows.has(s.id));
  const togglePage = (checked: boolean) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      pageRows.forEach(s => (checked ? next.add(s.id) : next.delete(s.id)));
      return next;
    });
  };

  return (
    <div className="space-y-4" id="warehouse_suppliers_panel">
      {/* Hàng tiêu đề: tên mục + nút icon Xuất/Nhập Excel + nút Thêm (xanh LoLo) */}
      <div className="flex flex-wrap justify-between items-center gap-2 pb-1">
        <span className="font-extrabold text-slate-900 text-sm">Nhà cung cấp vật tư <span className="text-slate-500 font-bold">({filtered.length})</span></span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleExportNccExcel} className={iconBtn} title="Xuất Excel nhà cung cấp" data-testid="ncc-export"><Download className="w-4 h-4" /></button>
          <button type="button" onClick={() => nccFileInputRef.current?.click()} className={iconBtn} title="Nhập Excel nhà cung cấp" data-testid="ncc-import"><FileUp className="w-4 h-4" /></button>
          <input ref={nccFileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportNccExcel} />
          <button type="button" data-testid="ncc-add"
            onClick={() => { resetForm(); setIsAdding(true); }}
            style={{ background: '#0d47c9', color: '#ffffff' }}
            className="h-9 px-3.5 rounded-xl text-[13px] font-bold inline-flex items-center gap-1.5 cursor-pointer">
            <Plus className="w-4 h-4" />
            Thêm nhà cung cấp
          </button>
        </div>
      </div>

      {/* Bộ lọc ô sáng kèm ô tìm kiếm + chip lĩnh vực */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-white border border-slate-200 rounded-2xl" data-testid="ncc-filters">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-slate-500 font-bold">Tìm kiếm</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" data-testid="ncc-search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tên, mã, người đại diện…"
              className="h-9 w-64 max-w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 text-[13px] text-slate-800 outline-none focus:border-[#0d47c9]" />
          </div>
        </div>
        {/* Lĩnh vực có rất nhiều giá trị → dùng ô chọn thả xuống (kèm số lượng) thay cho hàng chip dài */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-slate-500 font-bold">Lĩnh vực</label>
          <select data-testid="ncc-field-select" value={fieldFilter}
            onChange={(e) => setFieldFilter(e.target.value)}
            className="h-9 w-64 max-w-full bg-white border border-slate-200 rounded-xl px-3 text-[13px] text-slate-800 outline-none focus:border-[#0d47c9] cursor-pointer">
            {fieldChips.map(([k, label, n]) => (
              <option key={k} value={k}>{label} ({n})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Hộp Thêm / Sửa nhà cung cấp */}
      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[9999] p-4" data-testid="ncc-modal">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 space-y-4 shadow-xl text-slate-800 text-[13px] text-left animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm">
                {editingId ? 'Cập nhật nhà cung cấp' : 'Khai báo nhà cung cấp mới'}
              </h3>
              <button type="button" onClick={() => { setIsAdding(false); resetForm(); }}
                className="text-slate-500 hover:bg-slate-100 p-1.5 rounded-lg cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Tên nhà cung cấp <span className="text-red-500">*</span></label>
                  <input type="text" required value={formName} onChange={(e) => setFormName(e.target.value)}
                    placeholder="Nhập tên công ty/đại lý..." className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Người đại diện</label>
                  <input type="text" value={formRep} onChange={(e) => setFormRep(e.target.value)}
                    placeholder="Nhập tên người đại diện..." className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Lĩnh vực cung cấp</label>
                  <input type="text" value={formField} onChange={(e) => setFormField(e.target.value)}
                    placeholder="Ví dụ: Cung cấp ván ép MDF, sắt hộp..." className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Số điện thoại</label>
                  <input type="text" value={formPhone} onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="Nhập số điện thoại..." className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email liên hệ</label>
                  <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="nhacungcap@gmail.com" className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Địa chỉ</label>
                  <input type="text" value={formAddress} onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="Địa chỉ nhà cung cấp..." className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Số tài khoản</label>
                  <input type="text" value={formBankNo} onChange={(e) => setFormBankNo(e.target.value)}
                    placeholder="Nhập số tài khoản ngân hàng..." className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Tên ngân hàng</label>
                  <input type="text" value={formBankName} onChange={(e) => setFormBankName(e.target.value)}
                    placeholder="Ví dụ: MBBank, Techcombank..." className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Công nợ khởi tạo (VNĐ)</label>
                  <input type="number" value={formDebt || ''} onChange={(e) => setFormDebt(Number(e.target.value))}
                    placeholder="Đặt dư nợ khởi tạo nếu có..." className={`${inputCls} font-mono`} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Công nợ đầu kỳ (VNĐ)</label>
                  <input type="number" min={0} value={formOpeningDebt || ''} onChange={(e) => setFormOpeningDebt(Number(e.target.value))}
                    placeholder="Công nợ đầu kỳ (nếu có)..." className={`${inputCls} font-mono`} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Ghi chú hoạt động</label>
                <textarea value={formNote} onChange={(e) => setFormNote(e.target.value)} rows={2}
                  placeholder="Nhập ghi chú chi tiết về điều kiện giao hàng, tiến độ..." className={inputCls} />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => { setIsAdding(false); resetForm(); }}
                  className="h-9 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold cursor-pointer">Hủy bỏ</button>
                <button type="submit" style={{ background: '#0d47c9', color: '#ffffff' }} className="h-9 px-4 rounded-xl font-bold cursor-pointer">Xác nhận lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hộp điều chỉnh công nợ nhà cung cấp */}
      {adjustDebtId && (() => {
        const sup = suppliers.find(s => s.id === adjustDebtId);
        if (!sup) return null;
        return (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[9999] text-left" data-testid="ncc-adjust-modal">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 w-full max-w-md shadow-xl space-y-4 text-slate-800 text-[13px] animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-[#e8efff] text-[#0d47c9] inline-flex items-center justify-center"><DollarSign className="w-4 h-4" /></span>
                  Điều chỉnh công nợ nhà cung cấp
                </h3>
                <button type="button" onClick={() => setAdjustDebtId(null)} className="text-slate-500 hover:bg-slate-100 p-1.5 rounded-lg cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-500 block text-[12px] font-bold">Nhà cung cấp</span>
                <span className="font-extrabold text-slate-900">{sup.name}</span>
                <div className="flex justify-between mt-1.5 pt-1.5 border-t border-slate-200">
                  <span className="text-slate-500">Dư nợ hiện tại:</span>
                  <b className="font-mono text-amber-700">{money(sup.debt || 0)}</b>
                </div>
              </div>
              <form onSubmit={handleAdjustDebtSubmit} className="space-y-3">
                <div>
                  <label className={labelCls}>Hình thức điều chỉnh</label>
                  <select value={adjustType} onChange={(e) => setAdjustType(e.target.value as any)} className={inputCls}>
                    <option value="decrease">Thanh toán nợ / Giảm công nợ (-)</option>
                    <option value="increase">Ghi nhận hóa đơn phát sinh / Tăng công nợ (+)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Số tiền điều chỉnh (VNĐ) <span className="text-red-500">*</span></label>
                  <input type="number" required min={1} value={adjustAmount || ''} onChange={(e) => setAdjustAmount(Number(e.target.value))}
                    placeholder="Nhập số tiền..." className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Ghi chú diễn giải</label>
                  <input type="text" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)}
                    placeholder="Lý do chi trả nợ, số hóa đơn..." className={inputCls} />
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button type="button" onClick={() => setAdjustDebtId(null)}
                    className="h-9 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold cursor-pointer">Đóng</button>
                  <button type="submit" style={{ background: '#0d47c9', color: '#ffffff' }} className="h-9 px-4 rounded-xl font-bold cursor-pointer">Xác nhận cập nhật</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Danh sách (trái) */}
        <div className={`${selectedSupDetail ? 'xl:col-span-7' : 'xl:col-span-12'} space-y-3 transition-all duration-300`}>
          {/* Thanh xóa hàng loạt: chỉ hiện khi có dòng được tích */}
          {selectedRows.size > 0 && (
            <div className="bg-[#f3f7ff] border border-[#bcd0ff] rounded-2xl px-4 py-2.5 flex flex-wrap items-center gap-2 text-[13px]" data-testid="ncc-bulk">
              <span className="text-[#0d47c9] font-bold">Đã chọn {selectedRows.size} nhà cung cấp</span>
              <button onClick={handleBulkDelete}
                className="h-9 px-3.5 rounded-xl bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold inline-flex items-center gap-1.5 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" /> Xóa
              </button>
              <button onClick={() => { setSelectedRows(new Set()); setSelectAll(false); }}
                className="h-9 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold cursor-pointer">Hủy chọn</button>
            </div>
          )}

          {/* MÁY TÍNH: bảng */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-x-auto" data-testid="ncc-table">
            <table className="w-full text-left text-slate-700 text-[13px]">
              <thead className="bg-slate-50 text-slate-500 text-[12px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center">
                    <input type="checkbox" checked={pageAllSelected} onChange={(e) => togglePage(e.target.checked)} className="w-4 h-4 cursor-pointer accent-[#0d47c9]" />
                  </th>
                  <th className="px-3 py-2.5">Mã NCC</th>
                  <th className="px-3 py-2.5">Tên nhà cung cấp</th>
                  <th className="px-3 py-2.5">Địa chỉ</th>
                  <th className="px-3 py-2.5">SĐT</th>
                  <th className="px-3 py-2.5">Lĩnh vực</th>
                  <th className="px-3 py-2.5 text-right">Công nợ đầu kỳ</th>
                  <th className="px-3 py-2.5 text-right">Công nợ hiện tại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500 italic">Không tìm thấy nhà cung cấp nào khớp với bộ lọc tìm kiếm.</td></tr>
                ) : pageRows.map(s => (
                  <tr key={s.id} onClick={() => setSelectedSupDetail(s)} data-testid={`ncc-row-${s.id}`}
                    className={`cursor-pointer transition-colors ${selectedSupDetail?.id === s.id ? 'bg-[#e8efff]' : selectedRows.has(s.id) ? 'bg-[#f3f7ff]' : 'hover:bg-slate-50'}`}>
                    <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedRows.has(s.id)} onChange={(e) => handleRowSelect(s.id, e.target.checked)} className="w-4 h-4 cursor-pointer accent-[#0d47c9]" />
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-[#0d47c9] text-[12px] uppercase">{s.id}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-extrabold text-slate-900">{s.name}</div>
                      <div className="text-[12px] text-slate-500 mt-0.5">ĐD: {s.representative || 'Chưa rõ'}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{s.address || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-slate-700">{s.phone || '—'}</td>
                    <td className="px-3 py-2.5">{fieldPill(s.field)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">{money(s.openingDebt || 0)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-bold ${(s.debt || 0) > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{money(s.debt || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ĐIỆN THOẠI: mỗi nhà cung cấp 1 thẻ, bấm để xem chi tiết */}
          <div className="md:hidden space-y-3" data-testid="ncc-cards">
            {filtered.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-8 text-center text-slate-500 italic text-[13px]">Không tìm thấy nhà cung cấp nào khớp với bộ lọc tìm kiếm.</div>
            )}
            {pageRows.map(s => (
              <div key={`card:${s.id}`} onClick={() => setSelectedSupDetail(s)}
                className={`bg-white border rounded-2xl p-4 space-y-2 cursor-pointer ${selectedRows.has(s.id) ? 'border-[#bcd0ff] bg-[#f3f7ff]' : 'border-slate-200'}`}>
                <div className="flex items-start gap-2.5">
                  <span onClick={(e) => e.stopPropagation()} className="pt-0.5">
                    <input type="checkbox" checked={selectedRows.has(s.id)} onChange={(e) => handleRowSelect(s.id, e.target.checked)} className="w-4 h-4 cursor-pointer accent-[#0d47c9]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-slate-900 text-[14px] break-words">{s.name}</div>
                    <div className="flex items-center flex-wrap gap-2 mt-0.5">
                      <span className="font-mono text-[12px] text-[#0d47c9] font-bold uppercase">{s.id}</span>
                      {fieldPill(s.field)}
                    </div>
                  </div>
                </div>
                <div className="text-[12px] text-slate-600 space-y-1 pl-6">
                  {s.representative && <div>👤 {s.representative}</div>}
                  {s.phone && <div>📞 <a href={`tel:${s.phone}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[#0d47c9] font-bold">{s.phone}</a></div>}
                  {s.address && <div>📍 {s.address}</div>}
                  <div className="flex justify-between border-t border-slate-100 pt-1.5"><span className="text-slate-500">Công nợ đầu kỳ</span><b className="font-mono text-slate-700">{money(s.openingDebt || 0)}</b></div>
                  <div className="flex justify-between"><span className="text-slate-500">Công nợ hiện tại</span><b className={`font-mono ${(s.debt || 0) > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{money(s.debt || 0)}</b></div>
                </div>
              </div>
            ))}
          </div>

          {/* Phân trang — thanh dùng chung */}
          {filtered.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <TablePagination {...pg.props(filtered.length)} unit="nhà cung cấp" testId="supplier-pager" />
            </div>
          )}
        </div>

        {/* Khung chi tiết: máy tính = cột phải dính; điện thoại/máy tính bảng = hộp nổi phủ màn hình */}
        {selectedSupDetail && (() => {
          const sup = selectedSupDetail;
          const field = (label: string, val: React.ReactNode) => (
            <div><span className="text-slate-500 block text-[12px] font-bold">{label}</span><div className="text-slate-900 font-semibold mt-0.5 break-words">{val}</div></div>
          );
          return (
            <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-900/40 xl:static xl:z-auto xl:bg-transparent xl:block xl:col-span-5"
              onClick={() => setSelectedSupDetail(null)} data-testid="ncc-detail">
              <div className="w-full max-w-lg xl:max-w-none bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto xl:sticky xl:top-4 space-y-4 shadow-xl xl:shadow-none text-left"
                onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start gap-3 border-b border-slate-100 pb-3">
                  <div className="min-w-0">
                    <span className="font-mono text-[12px] text-[#0d47c9] font-black uppercase">{sup.id}</span>
                    <h3 className="font-extrabold text-slate-900 text-[15px] mt-0.5 break-words">{sup.name}</h3>
                    <div className="mt-1">{fieldPill(sup.field)}</div>
                  </div>
                  <button type="button" onClick={() => setSelectedSupDetail(null)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer" title="Đóng xem chi tiết"><X className="w-4 h-4" /></button>
                </div>

                <div className="space-y-3 text-[13px]">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                    {field('Người đại diện', sup.representative || 'Chưa rõ')}
                    {field('📞 Số điện thoại', <span className="font-mono">{sup.phone || 'Chưa cập nhật'}</span>)}
                    {field('✉️ Email', <span className="font-mono">{sup.email || 'Chưa cập nhật'}</span>)}
                    {field('📍 Địa chỉ', sup.address || 'Trống')}
                    {field('Ngân hàng', <span className="font-mono">{sup.bankAccount ? `${sup.bankAccount}${sup.bankName ? ` (${sup.bankName})` : ''}` : 'Chưa liên kết'}</span>)}
                  </div>

                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                    <div className="flex justify-between"><span className="text-slate-500">Công nợ đầu kỳ:</span><b className="font-mono text-slate-800">{money(sup.openingDebt || 0)}</b></div>
                    <div className="flex justify-between"><span className="text-slate-500">Công nợ hiện tại:</span><b className="font-mono text-amber-700">{money(sup.debt || 0)}</b></div>
                  </div>

                  {sup.note && <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-slate-700 leading-normal">{sup.note}</div>}
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-between items-center gap-2">
                  <div className="flex gap-1.5">
                    {sup.phone && (
                      <a href={`tel:${sup.phone}`} className="p-2 rounded-xl bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50 flex items-center justify-center" title="Gọi điện liên hệ"><Phone className="w-4 h-4" /></a>
                    )}
                    <button type="button" onClick={() => handleEditClick(sup)} data-testid="ncc-edit"
                      className={`p-2 rounded-xl border ${canEditSup ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer' : 'text-slate-400 border-slate-200 cursor-not-allowed opacity-50'}`} title="Sửa nhà cung cấp">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button type="button" data-testid="ncc-adjust"
                      onClick={() => { setAdjustDebtId(sup.id); setAdjustAmount(0); setAdjustType('decrease'); }}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-amber-700 hover:bg-amber-50 cursor-pointer" title="Điều chỉnh công nợ">
                      <DollarSign className="w-4 h-4" />
                    </button>
                    <button type="button" data-testid="ncc-delete"
                      onClick={() => { handleDelete(sup.id, sup.name); setSelectedSupDetail(null); }}
                      className={`p-2 rounded-xl border ${canDeleteSup ? 'bg-white border-rose-300 text-rose-600 hover:bg-rose-50 cursor-pointer' : 'text-slate-400 border-slate-200 cursor-not-allowed opacity-50'}`} title="Xóa nhà cung cấp này">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <button type="button" onClick={() => setSelectedSupDetail(null)} className="h-9 px-4 rounded-xl text-[13px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer">Đóng chi tiết</button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
