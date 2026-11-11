import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../lib/dbService';
import { Employee, SupplierPartner, ArchivedQuote, Project } from '../types';
import { useNotification } from '../context';
import * as XLSX from 'xlsx';
import { exportToExcel, formatDateForFile, EXCEL_HEADERS } from '../lib/excelUtils';
import {
  Search,
  MapPin,
  X,
  Plus,
  Edit,
  Trash2,
  Briefcase,
  Download,
  FileUp,
  Phone
} from 'lucide-react';
import TablePagination from './TablePagination';

/**
 * DANH SÁCH THẦU PHỤ — bảng riêng (accounting_subcontractors), tách khỏi
 * Danh Mục Nhà Cung Cấp Vật Tư (bảng suppliers).
 * Trước đây là tab con của Quản Lý Thầu Phụ; giờ là sub-tab của Dữ Liệu Kế Toán.
 *
 * Dữ liệu được đồng bộ từ bảng accounting_subcontractors trên Supabase.
 * Các dropdown "Chọn Thầu Phụ từ Dữ Liệu Kế Toán" (Kanban/TaskDetail/Workflow/Estimator/...) load từ Supabase.
 */
interface SubcontractorDirectoryProps {
  currentUser: Employee;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export default function SubcontractorDirectory({
  currentUser,
  canCreate = true,
  canEdit = true,
  canDelete = true
}: SubcontractorDirectoryProps) {
  const { addToast } = useNotification();

  // Suppliers state — load từ bảng accounting_subcontractors (bảng riêng của thầu phụ)
  const [suppliers, setSuppliers] = useState<SupplierPartner[]>([]);

  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const data = await dbService.accountingSubcontractors.list();
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

  // ── Multi-row selection ──
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fieldFilter, setFieldFilter] = useState('all');
  const supFields = Array.from(new Set(suppliers.map(s => (s.field || '').trim()).filter(Boolean))).sort();
  const filteredSuppliers = suppliers.filter(s => {
    const matchSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.representative && s.representative.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.field && s.field.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.phone && s.phone.includes(searchTerm));
    const matchField = fieldFilter === 'all' || (s.field || '') === fieldFilter;
    return matchSearch && matchField;
  });
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
    if (!canDelete) { addToast({ title: '⛔ Không đủ quyền', message: 'Bạn không có quyền "Xóa" ở phân hệ Tài Chính - Kế Toán.', type: 'warning' }); return; }
    if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa ${selectedRows.size} thầu phụ đã chọn không?\nHành động này không thể hoàn tác.`)) return;
    const idsToDelete = Array.from(selectedRows);
    setSuppliers(suppliers.filter(s => !selectedRows.has(s.id)));
    setSelectedRows(new Set());
    setSelectAll(false);
    idsToDelete.forEach(id => {
      dbService.accountingSubcontractors.delete(id).catch(() => {});
      // Xóa luôn dòng Công nợ đầu kỳ snapshot của Thầu Phụ này (nếu có) — tránh
      // để lại dòng "mồ côi" vẫn cộng vào Công Nợ Trả.
      dbService.accountingLiabilities.delete(`opbal_sub_${id}`).catch(() => {});
    });
    addToast({ title: '✅ Đã xóa', message: `Đã xóa ${selectedRows.size} thầu phụ.`, type: 'success' });
  };

  // Form state
  const [editingSupId, setEditingSupId] = useState<string | null>(null);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [selectedSupDetail, setSelectedSupDetail] = useState<SupplierPartner | null>(null);
  const [pageSup, setPageSup] = useState(1);
  const [pageSizeSup, setPageSizeSup] = useState(10);

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
  const [formSupOpeningDebt, setFormSupOpeningDebt] = useState<number>(0);
  const [isRepManuallyEdited, setIsRepManuallyEdited] = useState(false);

  // Hợp đồng thầu phụ liên quan (cho panel chi tiết)
  const [archivedQuotes, setArchivedQuotes] = useState<ArchivedQuote[]>([]);
  const [projectsList, setProjectsList] = useState<Project[]>([]);

  useEffect(() => {
    const loadRelated = async () => {
      try {
        const data = await dbService.archivedSubcontractorQuotes.list();
        setArchivedQuotes(data);
        const projs = await dbService.projects.list();
        setProjectsList(projs);
      } catch (err) {
        console.error("Lỗi tải hợp đồng thầu phụ liên quan:", err);
      }
    };
    loadRelated();
    window.addEventListener('hl-archived-subcontractor-quotes-updated', loadRelated);
    return () => {
      window.removeEventListener('hl-archived-subcontractor-quotes-updated', loadRelated);
    };
  }, []);

  const getAbbreviation = (str: string) => {
    if (!str) return '';
    // Bỏ các "từ" chỉ toàn ký tự đặc biệt (vd: "-") và bỏ dấu ngoặc/ký tự đặc
    // biệt đứng đầu mỗi từ, tránh mã sinh ra dính dấu ngoặc/gạch ngang xấu.
    return str
      .split(' ')
      .filter(w => /[a-zA-Z0-9]/.test(w))
      .map(w => (w.match(/[a-zA-Z0-9]/) as RegExpMatchArray)[0])
      .join('')
      .toUpperCase();
  };

  // Đồng bộ dòng "Công nợ đầu kỳ" tương ứng của Thầu Phụ này trong Công Nợ Trả
  // (bảng accounting_liabilities, id "opbal_sub_<mã Thầu Phụ>") mỗi khi sửa/xóa
  // Thầu Phụ — cùng cơ chế fix đã áp dụng cho NCC (WarehouseSuppliers.tsx) và
  // Khách Hàng (FinanceManagement.tsx): trước đây nút "Cập nhật Công Nợ Đầu Kỳ"
  // chỉ COPY 1 LẦN giá trị openingDebt sang 1 dòng riêng, không tự cập nhật/xóa
  // theo khi sửa/xóa Công nợ đầu kỳ trên hồ sơ Thầu Phụ sau đó.
  const syncOpeningDebtLiability = async (subcontractorId: string, name: string, openingDebt: number) => {
    const liabId = `opbal_sub_${subcontractorId}`;
    try {
      if (openingDebt > 0) {
        await dbService.accountingLiabilities.save({
          id: liabId,
          subcontractorId,
          name,
          category: 'Thầu Phụ',
          value: 0,
          openingDebt,
          paid: 0,
          remaining: openingDebt,
          notes: 'Cập nhật từ Công Nợ đầu kỳ (Thầu Phụ)',
          isOpeningDebt: true,
        });
      } else {
        await dbService.accountingLiabilities.delete(liabId);
      }
    } catch (err) {
      console.warn('Đồng bộ Công nợ đầu kỳ (Công Nợ Trả) thất bại:', err);
    }
  };

  const handleAddSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSupName || !formSupPhone || !formSupAddress || !formSupRep) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng điền đầy đủ các thông tin bắt buộc (Tên thầu phụ, Người đại diện, Điện thoại, Địa chỉ)!', type: 'warning' });
      return;
    }
    // RÀ SOÁT 2026-09: trước đây luôn kiểm tra canEdit dù đang Thêm mới — 1 nhóm được
    // cấp create=true nhưng edit=false cho module 'finance' sẽ bị chặn nhầm khi Thêm
    // thầu phụ (cùng loại lỗi vừa phát hiện ở canCoordinate() của MaterialCoordination.tsx).
    if (editingSupId ? !canEdit : !canCreate) { addToast({ title: '⛔ Không đủ quyền', message: `Bạn không có quyền "${editingSupId ? 'Sửa' : 'Thêm'}" ở phân hệ Tài Chính - Kế Toán.`, type: 'warning' }); return; }

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
            openingDebt: Number(formSupOpeningDebt) || 0,
            region: formSupAddress, // sync legacy field
            bankNo: formSupBankAccount
          };
        }
        return s;
      });
      setSuppliers(updated);
      const editedSup = updated.find(s => s.id === editingSupId);
      if (editedSup) {
        dbService.accountingSubcontractors.save(editedSup).catch(() => {});
        void syncOpeningDebtLiability(editedSup.id, editedSup.name, editedSup.openingDebt || 0);
      }

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
          openingDebt: Number(formSupOpeningDebt) || 0,
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
        openingDebt: Number(formSupOpeningDebt) || 0,
        region: formSupAddress,
        bankNo: formSupBankAccount
      };

      setSuppliers([...suppliers, newSup]);
      dbService.accountingSubcontractors.save(newSup).catch(() => {});
      void syncOpeningDebtLiability(newSup.id, newSup.name, newSup.openingDebt || 0);
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
    setFormSupOpeningDebt(0);
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
      'Công nợ đầu kỳ': s.openingDebt || 0,
      'Ghi chú': s.note || '',
    }));
    exportToExcel(data, 'DanhSachThauPhu', `DanhSachThauPhu_${formatDateForFile()}.xlsx`, undefined, [...EXCEL_HEADERS.subcontractor]);
    addToast({ title: '✅ Xuất Excel', message: `Đã xuất ${data.length} thầu phụ`, type: 'success' });
  };

  const handleImportSubcontractorExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!canCreate) { addToast({ title: '⛔ Không đủ quyền', message: 'Bạn không có quyền "Thêm" ở phân hệ Tài Chính - Kế Toán.', type: 'warning' }); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false });
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
          openingDebt: Number(r['Công nợ đầu kỳ'] || 0) || 0,
          region: String(r['Địa chỉ'] || 'Đà Lạt'),
        })).filter(r => r.name && r.phone);
        if (imported.length === 0) {
          addToast({ title: '⚠️ Không có dữ liệu', message: 'File không có dòng hợp lệ (cần Tên thầu phụ, Số điện thoại).', type: 'warning' });
          return;
        }
        // Upsert theo Mã: nếu mã đã tồn tại → cập nhật dòng đó (giữ nguyên các trường khác);
        // nếu mã chưa có → thêm mới.
        const merged = [...suppliers];
        const toSave: SupplierPartner[] = [];
        imported.forEach(imp => {
          const dupIdx = merged.findIndex(s => s.id === imp.id);
          if (dupIdx > -1) {
            const updated = { ...merged[dupIdx], ...imp };
            merged[dupIdx] = updated;
            toSave.push(updated);
          } else {
            merged.push(imp);
            toSave.push(imp);
          }
        });
        setSuppliers(merged);
        // Đồng bộ lên Supabase (upsert theo id)
        toSave.forEach(item => {
          dbService.accountingSubcontractors.save(item).catch(err => console.warn('Lưu import thầu phụ lên Supabase thất bại:', err));
          void syncOpeningDebtLiability(item.id, item.name, item.openingDebt || 0);
        });
        addToast({ title: '✅ Nhập thành công', message: `Đã import ${imported.length} thầu phụ (thêm mới / cập nhật theo Mã)`, type: 'success' });
      } catch (err) {
        addToast({ title: '⛔ Lỗi', message: 'Không thể đọc file Excel', type: 'error' });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // ── Giao diện kiểu LoLo (xanh #0d47c9, ô sáng, bo xl): bộ lọc kèm ô tìm kiếm, bảng máy tính + thẻ điện thoại, thanh phân trang dùng chung ──
  const iconBtn = 'h-9 w-9 rounded-xl flex items-center justify-center bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer';
  const inputCls = 'w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#0d47c9]';
  const labelCls = 'block text-slate-600 font-bold text-[12px] mb-1';
  const money = (n: number) => `${(n || 0).toLocaleString('vi-VN')} đ`;
  // Số thầu phụ theo từng lĩnh vực (hiện trên chip lọc)
  const countOfField = (f: string) => suppliers.filter(s => (s.field || '') === f).length;
  const fieldChips: [string, string, number][] = [['all', 'Tất cả', suppliers.length], ...supFields.map(f => [f, f, countOfField(f)] as [string, string, number])];

  // Mở hộp Sửa thầu phụ (đổ dữ liệu của thầu phụ đang xem chi tiết vào form)
  const startEditSup = (sup: SupplierPartner) => {
    if (!canEdit) {
      addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền SỬA thông tin thầu phụ.', type: 'error' });
      return;
    }
    setEditingSupId(sup.id);
    setFormSupName(sup.name);
    setFormSupRep(sup.representative || sup.name);
    setFormSupGender(sup.gender || 'Nam');
    setFormSupBirthDate(sup.birthDate || '');
    setFormSupCccd(sup.cccd || sup.taxCode || '');
    setFormSupCccdDate(sup.cccdDate || '');
    setFormSupCccdPlace(sup.cccdPlace || '');
    setFormSupEmail(sup.email || '');
    setFormSupBankAccount(sup.bankAccount || sup.bankNo || '');
    setFormSupBankName(sup.bankName || '');
    setFormSupPhone(sup.phone);
    setFormSupField(sup.field || '');
    setFormSupAddress(sup.address || sup.region || '');
    setFormSupTaxCode(sup.taxCode || '');
    setFormSupNote(sup.note || '');
    setFormSupOpeningDebt(sup.openingDebt || 0);
    setIsRepManuallyEdited(true);
    setShowSupplierForm(true);
  };
  // Xóa 1 thầu phụ (có cảnh báo thêm lần nữa nếu đang liên kết hợp đồng)
  const deleteSup = (sup: SupplierPartner, linkedCount: number) => {
    if (!canDelete) {
      addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền XÓA thầu phụ.', type: 'error' });
      return;
    }
    let confirmMessage = `⚠️ CẢNH BÁO QUAN TRỌNG:\n\nHành động xóa này không thể hoàn tác!\nBạn có thực sự chắc chắn muốn xóa Thầu phụ "${sup.name}" (Mã: ${sup.id}) ra khỏi hệ thống danh mục không?`;
    if (linkedCount > 0) {
      confirmMessage = `🚨 CẢNH BÁO NGUY HIỂM CAO ĐỘ:\n\nThầu phụ "${sup.name}" đang liên kết với ${linkedCount} Hợp đồng thầu phụ đang lưu vết trong sổ sách kế toán!\n\nNếu xóa thầu phụ này, các hợp đồng liên quan sẽ bị lỗi hiển thị thầu phụ.\nBạn có THỰC SỰ CHẮC CHẮN MUỐN TIẾP TỤC XÓA và tự chịu trách nhiệm về tính toàn vẹn dữ liệu không?`;
    }
    if (!confirm(confirmMessage)) return;
    if (linkedCount > 0 && !confirm(`XÁC NHẬN LẦN CUỐI:\n\nNhấn OK để thực sự xóa sạch thông tin của thầu phụ "${sup.name}".\nNhấn Cancel để hủy bỏ.`)) return;
    setSuppliers(suppliers.filter(s => s.id !== sup.id));
    dbService.accountingSubcontractors.delete(sup.id).catch(() => {});
    // Xóa luôn dòng Công nợ đầu kỳ snapshot của Thầu Phụ này (nếu có).
    dbService.accountingLiabilities.delete(`opbal_sub_${sup.id}`).catch(() => {});
    setSelectedSupDetail(null);
    addToast({ title: '✅ Thành công', message: `✅ Đã xóa thầu phụ "${sup.name}" thành công.`, type: 'success' });
  };
  // Chọn tất cả: chỉ các dòng của trang hiện tại
  const pageAllSelected = paginatedSuppliers.length > 0 && paginatedSuppliers.every(s => selectedRows.has(s.id));
  const togglePage = (checked: boolean) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      paginatedSuppliers.forEach(s => (checked ? next.add(s.id) : next.delete(s.id)));
      return next;
    });
  };
  const fieldPill = (f?: string) => (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-bold bg-[#e8efff] text-[#0d47c9] border-[#bcd0ff]">{f || 'Chưa phân loại'}</span>
  );

  return (
    <div className="space-y-4" id="subcontractor_directory_panel">
      {/* Hàng tiêu đề: tên mục + nút icon Xuất/Nhập Excel + nút Thêm (xanh LoLo) */}
      <div className="flex flex-wrap justify-between items-center gap-2 pb-1">
        <span className="font-extrabold text-slate-900 text-sm">Danh sách thầu phụ <span className="text-slate-500 font-bold">({filteredSuppliers.length})</span></span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleExportSubcontractorExcel} className={iconBtn} title="Xuất Excel thầu phụ" data-testid="sub-export"><Download className="w-4 h-4" /></button>
          <button type="button" onClick={() => subcontractorFileInputRef.current?.click()} className={iconBtn} title="Nhập Excel thầu phụ" data-testid="sub-import"><FileUp className="w-4 h-4" /></button>
          <input ref={subcontractorFileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportSubcontractorExcel} />
          <button type="button" data-testid="sub-add"
            onClick={() => {
              if (!canCreate) {
                addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền KHỞI TẠO thầu phụ mới.', type: 'error' });
                return;
              }
              resetSupForm();
              setShowSupplierForm(true);
            }}
            style={canCreate ? { background: '#0d47c9', color: '#ffffff' } : undefined}
            className={`h-9 px-3.5 rounded-xl text-[13px] font-bold inline-flex items-center gap-1.5 ${canCreate ? 'cursor-pointer' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
            <Plus className="w-4 h-4" />
            Thêm thầu phụ
          </button>
        </div>
      </div>

      {/* Bộ lọc ô sáng kèm ô tìm kiếm + chip lĩnh vực */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-white border border-slate-200 rounded-2xl" data-testid="sub-filters">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-slate-500 font-bold">Tìm kiếm</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" data-testid="sub-search" placeholder="Tên, mã, người đại diện, SĐT…" value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPageSup(1); }}
              className="h-9 w-64 max-w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 text-[13px] text-slate-800 outline-none focus:border-[#0d47c9]" />
          </div>
        </div>
        {/* Lĩnh vực có rất nhiều giá trị → dùng ô chọn thả xuống (kèm số lượng) thay cho hàng chip dài */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-slate-500 font-bold">Lĩnh vực</label>
          <select data-testid="sub-field-select" value={fieldFilter}
            onChange={(e) => { setFieldFilter(e.target.value); setPageSup(1); }}
            className="h-9 w-64 max-w-full bg-white border border-slate-200 rounded-xl px-3 text-[13px] text-slate-800 outline-none focus:border-[#0d47c9] cursor-pointer">
            {fieldChips.map(([k, label, n]) => (
              <option key={k} value={k}>{label} ({n})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Hộp Thêm / Sửa thầu phụ */}
      {showSupplierForm && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[9999] p-4" data-testid="sub-modal">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 space-y-4 shadow-xl text-slate-800 text-[13px] text-left animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-[#e8efff] text-[#0d47c9] inline-flex items-center justify-center"><Briefcase className="w-4 h-4" /></span>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  {editingSupId ? `Cập nhật thông tin thầu phụ: ${editingSupId}` : 'Đăng ký thầu phụ mới'}
                </h3>
              </div>
              <button type="button" onClick={() => { setShowSupplierForm(false); resetSupForm(); }}
                className="text-slate-500 hover:bg-slate-100 p-1.5 rounded-lg cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleAddSupplierSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Tên thầu phụ <span className="text-red-500">*</span></label>
                  <input type="text" required value={formSupName} onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Nhập tên tổ đội / thầu phụ khoán..." className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Người đại diện / Bên B <span className="text-red-500">*</span></label>
                  <input type="text" required value={formSupRep} onChange={(e) => handleRepChange(e.target.value)}
                    placeholder="Họ tên người nhận khoán..." className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Giới tính Bên B</label>
                  <select value={formSupGender} onChange={(e) => setFormSupGender(e.target.value)} className={inputCls}>
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Ngày sinh Bên B</label>
                  <input type="date" value={formSupBirthDate} onChange={(e) => setFormSupBirthDate(e.target.value)} className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Số điện thoại <span className="text-red-500">*</span></label>
                  <input type="text" required value={formSupPhone} onChange={(e) => setFormSupPhone(e.target.value)}
                    placeholder="Nhập số điện thoại..." className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email Bên B</label>
                  <input type="email" value={formSupEmail} onChange={(e) => setFormSupEmail(e.target.value)}
                    placeholder="Email liên hệ..." className={`${inputCls} font-mono`} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Số CCCD Bên B</label>
                  <input type="text" value={formSupCccd} onChange={(e) => setFormSupCccd(e.target.value)}
                    placeholder="Nhập số CCCD..." className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Ngày cấp CCCD</label>
                  <input type="date" value={formSupCccdDate} onChange={(e) => setFormSupCccdDate(e.target.value)} className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Nơi cấp CCCD</label>
                  <input type="text" value={formSupCccdPlace} onChange={(e) => setFormSupCccdPlace(e.target.value)}
                    placeholder="Ví dụ: Cục Cảnh sát QLHC về TTXH..." className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Địa chỉ thường trú <span className="text-red-500">*</span></label>
                  <input type="text" required value={formSupAddress} onChange={(e) => setFormSupAddress(e.target.value)}
                    placeholder="Nhập địa chỉ đăng ký thường trú..." className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Lĩnh vực hoạt động</label>
                  <input type="text" value={formSupField} onChange={(e) => setFormSupField(e.target.value)}
                    placeholder="Ví dụ: Thợ dán mâm Acrylic, sắt móng thô..." className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>MST cá nhân Bên B</label>
                  <input type="text" value={formSupTaxCode} onChange={(e) => setFormSupTaxCode(e.target.value)}
                    placeholder="Nhập mã số thuế cá nhân..." className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Số tài khoản ngân hàng</label>
                  <input type="text" value={formSupBankAccount} onChange={(e) => setFormSupBankAccount(e.target.value)}
                    placeholder="Nhập số tài khoản..." className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Tên ngân hàng (mở tại)</label>
                  <input type="text" value={formSupBankName} onChange={(e) => setFormSupBankName(e.target.value)}
                    placeholder="Ví dụ: BIDV - Chi nhánh Lâm Đồng..." className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Công nợ đầu kỳ (VNĐ)</label>
                  <input type="number" min={0} value={formSupOpeningDebt || ''} onChange={(e) => setFormSupOpeningDebt(Number(e.target.value))}
                    placeholder="Công nợ đầu kỳ (nếu có)..." className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Ghi chú</label>
                  <input type="text" value={formSupNote} onChange={(e) => setFormSupNote(e.target.value)}
                    placeholder="Ghi chú về kinh nghiệm, năng lực hoặc đội thợ..." className={inputCls} />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => { setShowSupplierForm(false); resetSupForm(); }}
                  className="h-9 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold cursor-pointer">Hủy bỏ</button>
                <button type="submit" style={{ background: '#0d47c9', color: '#ffffff' }} className="h-9 px-4 rounded-xl font-bold cursor-pointer">
                  {editingSupId ? 'Lưu cập nhật' : 'Thêm thầu phụ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Danh sách (trái) */}
        <div className={`${selectedSupDetail ? 'xl:col-span-7' : 'xl:col-span-12'} space-y-3 transition-all duration-300`}>
          {/* Thanh xóa hàng loạt: chỉ hiện khi có dòng được tích */}
          {selectedRows.size > 0 && (
            <div className="bg-[#f3f7ff] border border-[#bcd0ff] rounded-2xl px-4 py-2.5 flex flex-wrap items-center gap-2 text-[13px]" data-testid="sub-bulk">
              <span className="text-[#0d47c9] font-bold">Đã chọn {selectedRows.size} thầu phụ</span>
              <button onClick={handleBulkDelete}
                className="h-9 px-3.5 rounded-xl bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold inline-flex items-center gap-1.5 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" /> Xóa
              </button>
              <button onClick={() => { setSelectedRows(new Set()); setSelectAll(false); }}
                className="h-9 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold cursor-pointer">Hủy chọn</button>
            </div>
          )}

          {/* MÁY TÍNH: bảng */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-x-auto" data-testid="sub-table">
            <table className="w-full text-left text-slate-700 text-[13px]">
              <thead className="bg-slate-50 text-slate-500 text-[12px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center">
                    <input type="checkbox" checked={pageAllSelected} onChange={(e) => togglePage(e.target.checked)} className="w-4 h-4 cursor-pointer accent-[#0d47c9]" />
                  </th>
                  <th className="px-3 py-2.5">Mã thầu phụ</th>
                  <th className="px-3 py-2.5">Tên thầu phụ</th>
                  <th className="px-3 py-2.5">Địa chỉ</th>
                  <th className="px-3 py-2.5">SĐT</th>
                  <th className="px-3 py-2.5">Lĩnh vực</th>
                  <th className="px-3 py-2.5 text-right">Công nợ đầu kỳ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedSuppliers.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500 italic">Không tìm thấy thầu phụ nào phù hợp.</td></tr>
                ) : paginatedSuppliers.map(s => (
                  <tr key={s.id} onClick={() => setSelectedSupDetail(s)} data-testid={`sub-row-${s.id}`}
                    className={`cursor-pointer transition-colors ${selectedSupDetail?.id === s.id ? 'bg-[#e8efff]' : selectedRows.has(s.id) ? 'bg-[#f3f7ff]' : 'hover:bg-slate-50'}`}>
                    <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedRows.has(s.id)} onChange={(e) => handleRowSelect(s.id, e.target.checked)} className="w-4 h-4 cursor-pointer accent-[#0d47c9]" />
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-[#0d47c9] text-[12px] uppercase">{s.id}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-extrabold text-slate-900">{s.name}</div>
                      {s.representative && s.representative !== s.name && (
                        <div className="text-[12px] text-slate-500 mt-0.5">ĐD: {s.representative}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{s.address || s.region || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-slate-700">{s.phone || '—'}</td>
                    <td className="px-3 py-2.5">{fieldPill(s.field)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-700">{money(s.openingDebt || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ĐIỆN THOẠI: mỗi thầu phụ 1 thẻ, bấm để xem chi tiết */}
          <div className="md:hidden space-y-3" data-testid="sub-cards">
            {paginatedSuppliers.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-8 text-center text-slate-500 italic text-[13px]">Không tìm thấy thầu phụ nào phù hợp.</div>
            )}
            {paginatedSuppliers.map(s => (
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
                  {s.representative && s.representative !== s.name && <div>👤 {s.representative}</div>}
                  {s.phone && <div>📞 <a href={`tel:${s.phone}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[#0d47c9] font-bold">{s.phone}</a></div>}
                  {(s.address || s.region) && <div>📍 {s.address || s.region}</div>}
                  <div className="flex justify-between border-t border-slate-100 pt-1.5"><span className="text-slate-500">Công nợ đầu kỳ</span><b className="font-mono text-amber-700">{money(s.openingDebt || 0)}</b></div>
                </div>
              </div>
            ))}
          </div>

          {/* Phân trang — thanh dùng chung */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <TablePagination total={filteredSuppliers.length} page={adjustedPageSup} pageSize={pageSizeSup}
              onPage={setPageSup} onPageSize={(sz) => { setPageSizeSup(sz); setPageSup(1); }}
              unit="thầu phụ" testId="sub-pager" />
          </div>
        </div>

        {/* Khung chi tiết: máy tính = cột phải dính; điện thoại/máy tính bảng = hộp nổi phủ màn hình */}
        {selectedSupDetail && (() => {
          const sup = selectedSupDetail;
          const linkedSubs = archivedQuotes.filter(q => q.subcontractorId === sup.id);
          const field = (label: string, val: React.ReactNode) => (
            <div><span className="text-slate-500 block text-[12px] font-bold">{label}</span><div className="text-slate-900 font-semibold mt-0.5 break-words">{val}</div></div>
          );
          const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('vi-VN') : 'Chưa cập nhật');
          return (
            <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-900/40 xl:static xl:z-auto xl:bg-transparent xl:block xl:col-span-5"
              onClick={() => setSelectedSupDetail(null)} data-testid="sub-detail">
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
                    <div className="grid grid-cols-2 gap-3">
                      {field('Người đại diện (Bên B)', sup.representative || sup.name)}
                      {field('Giới tính', sup.gender || 'Nam')}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {field('Ngày sinh', fmtDate(sup.birthDate))}
                      {field('📞 Số điện thoại', <span className="font-mono">{sup.phone || 'Chưa cập nhật'}</span>)}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {field('Số CCCD', <span className="font-mono">{sup.cccd || 'Chưa cập nhật'}</span>)}
                      {field('Ngày cấp', fmtDate(sup.cccdDate))}
                      {field('Nơi cấp', sup.cccdPlace || 'Chưa cập nhật')}
                    </div>
                    {field('📍 Địa chỉ thường trú', <span className="inline-flex items-start gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />{sup.address || 'Trống'}</span>)}
                    {field('Email Bên B', <span className="font-mono">{sup.email || 'Chưa cập nhật'}</span>)}
                    <div className="grid grid-cols-2 gap-3">
                      {field('MST cá nhân', <span className="font-mono">{sup.taxCode || 'Chưa cập nhật'}</span>)}
                      {field('Số tài khoản', <span className="font-mono">{sup.bankAccount || 'Chưa cập nhật'}</span>)}
                    </div>
                    {field('Tại ngân hàng', sup.bankName || 'Chưa cập nhật')}
                  </div>

                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                    <div className="flex justify-between"><span className="text-slate-500">Công nợ đầu kỳ:</span><b className="font-mono text-amber-700">{money(sup.openingDebt || 0)}</b></div>
                  </div>

                  {sup.note && <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-slate-700 leading-normal">{sup.note}</div>}

                  {/* Hợp đồng thầu phụ liên quan */}
                  <div className="space-y-2">
                    <span className="text-slate-500 font-bold text-[12px]">Hợp đồng thầu phụ liên quan ({linkedSubs.length})</span>
                    {linkedSubs.length === 0 ? (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 italic">Chưa có hợp đồng giao khoán nào.</div>
                    ) : (
                      <div className="max-h-[200px] overflow-y-auto space-y-2">
                        {linkedSubs.map(q => {
                          const projName = projectsList.find(p => p.id === q.projectId)?.name || 'Dự án khác';
                          const done = (q.status as string) === 'Hoàn thành';
                          return (
                            <div key={q.id} className="p-2.5 bg-white border border-slate-200 rounded-xl text-[12px]">
                              <div className="flex justify-between items-center gap-2 font-mono font-bold text-[#0d47c9]">
                                <span>{q.code || q.id}</span>
                                <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${done ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-sky-50 text-sky-700 border-sky-200'}`}>{q.status || 'Chạy'}</span>
                              </div>
                              <p className="text-slate-900 font-semibold mt-1 line-clamp-1">{(q as any).scopeWork || 'Giao khoán thầu phụ'}</p>
                              <div className="flex justify-between gap-2 text-slate-500 mt-1">
                                <span className="truncate">DA: <b className="text-slate-700">{projName}</b></span>
                                <b className="font-mono text-slate-800 whitespace-nowrap">{money(q.contractValue || 0)}</b>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-between items-center gap-2">
                  <div className="flex gap-1.5">
                    {sup.phone && (
                      <a href={`tel:${sup.phone}`} className="p-2 rounded-xl bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50 flex items-center justify-center" title="Gọi điện liên hệ"><Phone className="w-4 h-4" /></a>
                    )}
                    <button type="button" onClick={() => startEditSup(sup)} data-testid="sub-edit"
                      className={`p-2 rounded-xl border ${canEdit ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer' : 'text-slate-400 border-slate-200 cursor-not-allowed opacity-50'}`} title="Sửa thông tin thầu phụ">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => deleteSup(sup, linkedSubs.length)} data-testid="sub-delete"
                      className={`p-2 rounded-xl border ${canDelete ? 'bg-white border-rose-300 text-rose-600 hover:bg-rose-50 cursor-pointer' : 'text-slate-400 border-slate-200 cursor-not-allowed opacity-50'}`} title="Xóa thầu phụ này">
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
