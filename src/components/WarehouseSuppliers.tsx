import React, { useState, useEffect, useRef } from 'react';
import { SupplierPartner } from '../types';
import {
  Search, Plus, Trash2, Edit2, Check, X,
  Phone, Mail, MapPin, DollarSign, FileText, AlertCircle, RefreshCw,
  Download, FileUp
} from 'lucide-react';
import { dbService } from '../lib/dbService';
import { useNotification } from '../context';
import * as XLSX from 'xlsx';

export default function WarehouseSuppliers() {
  const { addToast } = useNotification();
  const [suppliers, setSuppliers] = useState<SupplierPartner[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
    // Persist deletions to Supabase
    try {
      await Promise.allSettled(
        idsToDelete.map(id => dbService.suppliers.delete(id).catch(err => console.error("Lỗi xóa nhà cung cấp:", err)))
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

  // Quick Debt adjustment
  const [adjustDebtId, setAdjustDebtId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustType, setAdjustType] = useState<'increase' | 'decrease'>('decrease');
  const [adjustNote, setAdjustNote] = useState('');

  const loadSuppliers = async () => {
    try {
      const data = await dbService.suppliers.list();
      setSuppliers(data.map((s: any) => ({
        ...s,
        debt: typeof s.debt === 'number' ? s.debt : 0
      })));
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

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng nhập tên nhà cung cấp!', type: 'warning' });
    
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
      debt: formDebt
    } as any;

    try {
      await dbService.suppliers.save(newSup);
      setSuppliers(prev => [...prev, newSup]);
      setIsAdding(false);
      resetForm();
      addToast({ title: '✅ Thành công', message: 'Thêm nhà cung cấp mới thành công!', type: 'success' });
    } catch (err) {
      console.error(err);
      addToast({ title: '⚠️ Lỗi', message: 'không thể lưu nhà cung cấp lên Firebase.', type: 'warning' });
    }
  };

  const handleEditClick = (sup: SupplierPartner) => {
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
  };

  const handleEditSubmit = async (id: string) => {
    if (!formName.trim()) return addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng nhập tên nhà cung cấp!', type: 'warning' });
    const existing = suppliers.find(s => s.id === id);
    if (!existing) return;

    const updated = {
      ...existing,
      name: formName,
      representative: formRep,
      phone: formPhone,
      email: formEmail,
      address: formAddress,
      field: formField,
      note: formNote,
      bankAccount: formBankNo,
      bankNo: formBankNo,
      bankName: formBankName
    };

    try {
      await dbService.suppliers.save(updated);
      setSuppliers(prev => prev.map(s => s.id === id ? updated : s));
      setEditingId(null);
      resetForm();
      addToast({ title: '✅ Thành công', message: 'Cập nhật nhà cung cấp thành công!', type: 'success' });
    } catch (err) {
      console.error(err);
      addToast({ title: '⚠️ Lỗi', message: 'không thể lưu nhà cung cấp lên Firebase.', type: 'warning' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`⚠️ Bạn có chắc chắn muốn XÓA nhà cung cấp "${name}"? Thao tác này sẽ dọn sạch thông tin đối tác khỏi hệ thống.`)) {
      try {
        await dbService.suppliers.delete(id);
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
  };

  // ===================== BLOCK EXCEL (DANH MỤC NHÀ CUNG CẤP VẬT TƯ) =====================
  const handleExportNccExcel = () => {
    if (suppliers.length === 0) {
      addToast({ title: '⚠️ Không có dữ liệu', message: 'Chưa có nhà cung cấp nào để xuất.', type: 'warning' });
      return;
    }
    const data = suppliers.map(s => ({
      'Mã NCC': s.id,
      'Tên nhà cung cấp': s.name,
      'Số điện thoại': s.phone || '',
      'Email': s.email || '',
      'Địa chỉ': s.address || '',
      'Loại vật tư': s.field || '',
      'Ghi chú': s.note || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DanhMucNCC');
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    XLSX.writeFile(wb, `DanhMucNCC_${ymd}.xlsx`);
    addToast({ title: '✅ Xuất Excel', message: `Đã xuất ${data.length} nhà cung cấp`, type: 'success' });
  };

  const handleImportNccExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const imported: SupplierPartner[] = rows.map((r, idx) => ({
          id: String(r['Mã NCC'] || `NCC_IMP_${Date.now()}_${idx}`),
          name: String(r['Tên nhà cung cấp'] || '').trim(),
          representative: String(r['Người đại diện'] || r['Tên nhà cung cấp'] || ''),
          gender: 'Nam',
          birthDate: '',
          cccd: '',
          cccdDate: '',
          cccdPlace: '',
          address: String(r['Địa chỉ'] || 'Đà Lạt'),
          phone: String(r['Số điện thoại'] || ''),
          email: String(r['Email'] || ''),
          taxCode: '',
          bankAccount: String(r['Số tài khoản'] || ''),
          bankNo: String(r['Số tài khoản'] || ''),
          bankName: String(r['Ngân hàng'] || ''),
          field: String(r['Loại vật tư'] || 'Cung cấp gỗ ván & phụ kiện'),
          note: String(r['Ghi chú'] || ''),
          debt: 0,
        } as any)).filter(r => r.name);
        if (imported.length === 0) {
          addToast({ title: '⚠️ Không có dữ liệu', message: 'File không có dòng hợp lệ (cần cột Tên nhà cung cấp).', type: 'warning' });
          return;
        }
        let savedCount = 0;
        imported.forEach(async (sup) => {
          try {
            await dbService.suppliers.save(sup);
            savedCount++;
          } catch (err) {
            console.error(err);
          }
        });
        setTimeout(() => {
          addToast({ title: '✅ Nhập thành công', message: `Đã import ${imported.length} nhà cung cấp`, type: 'success' });
        }, 500);
      } catch (err) {
        addToast({ title: '⛔ Lỗi', message: 'Không thể đọc file Excel', type: 'error' });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.representative && s.representative.toLowerCase().includes(searchTerm.toLowerCase())) ||
    s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.field && s.field.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 text-slate-200" id="warehouse_suppliers_panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div>
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse"></span>
            Danh Mục Nhà Cung Cấp Vật Tư (KHO)
          </h2>
          <p className="text-[10.5px] text-slate-400 mt-1">
            Hệ thống quản lý thông tin các nhà cung cấp gỗ ván, sắt thép dầm móng và công nợ liên kết điều phối.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportNccExcel}
            className="bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5" /> Xuất Excel
          </button>
          <button
            type="button"
            onClick={() => nccFileInputRef.current?.click()}
            className="bg-sky-600 hover:bg-sky-500 font-bold text-xs text-white px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
          >
            <FileUp className="w-3.5 h-3.5" /> Nhập Excel
          </button>
          <input
            ref={nccFileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportNccExcel}
          />
          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsAdding(!isAdding);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
          >
            {isAdding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {isAdding ? 'Hủy bỏ' : 'Thêm Nhà Cung Cấp'}
          </button>
        </div>
      </div>

      {/* Adding Form */}
      {isAdding && (
        <form onSubmit={handleAddSubmit} className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 animate-fade-in text-left">
          <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider border-b border-slate-800 pb-2">
            ✍️ KHAI BÁO NHÀ CUNG CẤP MỚI
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-455">Tên Nhà Cung Cấp *</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nhập tên công ty/đại lý..."
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-455">Người Đại Diện</label>
              <input
                type="text"
                value={formRep}
                onChange={(e) => setFormRep(e.target.value)}
                placeholder="Nhập tên người đại diện..."
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-455">Lĩnh Vực Cung Cấp</label>
              <input
                type="text"
                value={formField}
                onChange={(e) => setFormField(e.target.value)}
                placeholder="Ví dụ: Cung cấp ván ép MDF, sắt hộp..."
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-455">Số Điện Thoại</label>
              <input
                type="text"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="Nhập số điện thoại..."
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-455">Email Liên Hệ</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="nhacungcap@gmail.com"
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-455">Địa Chỉ</label>
              <input
                type="text"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="Địa chỉ nhà cung cấp..."
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-455">Số Tài Khoản</label>
              <input
                type="text"
                value={formBankNo}
                onChange={(e) => setFormBankNo(e.target.value)}
                placeholder="Nhập số tài khoản ngân hàng..."
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-455">Tên Ngân Hàng</label>
              <input
                type="text"
                value={formBankName}
                onChange={(e) => setFormBankName(e.target.value)}
                placeholder="Ví dụ: MBBank, Techcombank..."
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-455">Công Nợ Khởi Tạo (VNĐ)</label>
              <input
                type="number"
                value={formDebt || ''}
                onChange={(e) => setFormDebt(Number(e.target.value))}
                placeholder="Đặt dư nợ khởi tạo nếu có..."
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-455">Ghi Chú Hoạt Động</label>
            <textarea
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              placeholder="Nhập ghi chú chi tiết về điều kiện giao hàng, tiến độ..."
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex justify-end gap-2.5 border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                resetForm();
              }}
              className="bg-slate-800 hover:bg-slate-750 font-bold text-[11px] text-slate-300 px-4 py-2 rounded-lg cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 font-bold text-[11px] text-white px-4 py-2 rounded-lg cursor-pointer"
            >
              Xác Nhận Lưu
            </button>
          </div>
        </form>
      )}

      {/* Debt adjustment modal */}
      {adjustDebtId && (() => {
        const sup = suppliers.find(s => s.id === adjustDebtId);
        if (!sup) return null;
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-left">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h3 className="font-extrabold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-amber-500" />
                  Điều chỉnh Công nợ Nhà cung cấp
                </h3>
                <button type="button" onClick={() => setAdjustDebtId(null)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Nhà cung cấp</span>
                <span className="text-xs font-bold text-teal-400">{sup.name}</span>
                <div className="flex justify-between text-[11px] text-slate-300 mt-1 pt-1 border-t border-slate-900">
                  <span>Dư nợ hiện tại:</span>
                  <span className="font-mono font-black text-amber-400">{sup.debt?.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>

              <form onSubmit={handleAdjustDebtSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Hình thức điều chỉnh</label>
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="decrease">Thanh toán nợ / Giảm công nợ (-)</option>
                    <option value="increase">Ghi nhận hóa đơn phát sinh / Tăng công nợ (+)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Số tiền điều chỉnh (VNĐ) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={adjustAmount || ''}
                    onChange={(e) => setAdjustAmount(Number(e.target.value))}
                    placeholder="Nhập số tiền..."
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Ghi chú diễn giải</label>
                  <input
                    type="text"
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    placeholder="Lý do chi trả nợ, số hóa đơn..."
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
                  <button
                    type="button"
                    onClick={() => setAdjustDebtId(null)}
                    className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-[10px] px-3.5 py-2 rounded-lg"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-[10px] px-4 py-2 rounded-lg"
                  >
                    Xác nhận cập nhật
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Main Filter & List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm nhà cung cấp..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 outline-none focus:border-teal-500"
            />
          </div>
          <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400">
            <span>Tổng số:</span>
            <span className="font-bold text-teal-400 font-mono">{filtered.length} NCC</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider">
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectAll && filtered.length > 0 && filtered.every(s => selectedRows.has(s.id))}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                  />
                </th>
                <th className="p-3 w-16 text-center">Mã NCC</th>
                <th className="p-3">Tên Nhà Cung Cấp</th>
                <th className="p-3">Lĩnh Vực Hoạt Động</th>
                <th className="p-3">Thông Tin Liên Hệ</th>
                <th className="p-3">Ngân Hàng Giao Dịch</th>
                <th className="p-3 text-right">CÔNG NỢ HIỆN TẠI</th>
                <th className="p-3 w-28 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 bg-slate-900/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-500 font-medium">
                    Không tìm thấy nhà cung cấp nào khớp với bộ lọc tìm kiếm.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const isEditingThis = editingId === s.id;
                  const currentDebt = s.debt || 0;
                  return (
                    <tr key={s.id} className={`hover:bg-slate-900/70 text-slate-300 ${selectedRows.has(s.id) ? 'bg-amber-500/10' : ''}`}>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(s.id)}
                          onChange={(e) => { e.stopPropagation(); handleRowSelect(s.id, e.target.checked); }}
                          className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                        />
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-500">{s.id}</td>
                      <td className="p-3">
                        {isEditingThis ? (
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              value={formName}
                              onChange={(e) => setFormName(e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded p-1 text-xs text-white"
                            />
                            <input
                              type="text"
                              value={formRep}
                              placeholder="Người đại diện"
                              onChange={(e) => setFormRep(e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded p-1 text-[11px] text-slate-400 w-full"
                            />
                          </div>
                        ) : (
                          <div>
                            <span className="font-extrabold text-teal-400 block">{s.name}</span>
                            <span className="text-[10px] text-slate-455 block">ĐD: {s.representative || 'Chưa rõ'}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditingThis ? (
                          <input
                            type="text"
                            value={formField}
                            onChange={(e) => setFormField(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded p-1 text-xs text-white"
                          />
                        ) : (
                          <span className="bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            {s.field || 'Đại lý vật tư'}
                          </span>
                        )}
                      </td>
                      <td className="p-3 space-y-1">
                        {isEditingThis ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={formPhone}
                              placeholder="SĐT"
                              onChange={(e) => setFormPhone(e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded p-1 text-xs text-white"
                            />
                            <input
                              type="text"
                              value={formEmail}
                              placeholder="Email"
                              onChange={(e) => setFormEmail(e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded p-1 text-xs text-white w-full"
                            />
                          </div>
                        ) : (
                          <div className="text-[11px] space-y-0.5">
                            {s.phone && <div className="flex items-center gap-1 text-slate-300"><Phone className="w-3 h-3 text-slate-500" /> {s.phone}</div>}
                            {s.email && <div className="flex items-center gap-1 text-slate-400"><Mail className="w-3 h-3 text-slate-500" /> {s.email}</div>}
                            {s.address && <div className="flex items-center gap-1 text-slate-400"><MapPin className="w-3 h-3 text-slate-500" /> {s.address}</div>}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-[11px] space-y-0.5">
                        {isEditingThis ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={formBankNo}
                              placeholder="Số TK"
                              onChange={(e) => setFormBankNo(e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded p-1 text-xs text-white"
                            />
                            <input
                              type="text"
                              value={formBankName}
                              placeholder="Tên ngân hàng"
                              onChange={(e) => setFormBankName(e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded p-1 text-xs text-white w-full"
                            />
                          </div>
                        ) : (
                          <div>
                            {s.bankAccount ? (
                              <>
                                <span className="font-semibold block font-mono text-slate-300">{s.bankAccount}</span>
                                <span className="text-[10px] text-slate-500 block truncate max-w-[130px]">{s.bankName || 'Ngân hàng'}</span>
                              </>
                            ) : (
                              <span className="text-slate-500 italic">Chưa liên kết</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span className={`font-black text-[12.5px] ${currentDebt > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                          {currentDebt.toLocaleString('vi-VN')} đ
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {isEditingThis ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditSubmit(s.id)}
                              className="p-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 rounded cursor-pointer"
                              title="Lưu thay đổi"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditingId(null); resetForm(); }}
                              className="p-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded cursor-pointer"
                              title="Hủy"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustDebtId(s.id);
                                setAdjustAmount(0);
                                setAdjustType('decrease');
                              }}
                              className="p-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded cursor-pointer"
                              title="Thu chi công nợ"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditClick(s)}
                              className="p-1 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded cursor-pointer"
                              title="Chỉnh sửa"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(s.id, s.name)}
                              className="p-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded cursor-pointer"
                              title="Xóa nhà cung cấp"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
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
      </div>
    </div>
  );
}
