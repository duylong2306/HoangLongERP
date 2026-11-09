import React, { useRef, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Calendar,
  Percent,
  Building,
  Award,
  FileSpreadsheet,
  MapPin,
  Search,
  Plus,
  Trash2,
  Sliders,
  Download,
  Upload,
  Pencil,
} from 'lucide-react';
import {
  Holiday,
  LeaveCoefficient,
  DepartmentCriteria,
  TravelAllowanceNorm,
  EmployeeProfile,
} from '../hrTypes';
import { SalaryScale } from '../../../types';

interface HrDataTabProps {
  activeHrDataSubTab: string;
  setActiveHrDataSubTab: (v: any) => void;

  holidays: Holiday[];
  setHolidays: React.Dispatch<React.SetStateAction<Holiday[]>>;
  holidaySearchQuery: string;
  setHolidaySearchQuery: (v: string) => void;
  setShowHolidayModal: (v: boolean) => void;
  handleDeleteHoliday: (id: string) => void;
  onEditHoliday: (item: Holiday) => void;

  leaveCoefficients: LeaveCoefficient[];
  setLeaveCoefficients: React.Dispatch<React.SetStateAction<LeaveCoefficient[]>>;
  coefSearchQuery: string;
  setCoefSearchQuery: (v: string) => void;
  setShowCoefModal: (v: boolean) => void;
  handleToggleCoefficientAuto: (id: string) => void;
  handleDeleteCoefficient: (id: string) => void;

  departmentCriteria: DepartmentCriteria[];
  setDepartmentCriteria: React.Dispatch<React.SetStateAction<DepartmentCriteria[]>>;
  criteriaSearchQuery: string;
  setCriteriaSearchQuery: (v: string) => void;
  setEditingCritId: (v: any) => void;
  setEditingCritDeptId: (v: any) => void;
  setNewCritContent: (v: string) => void;
  setNewCritCategory: (v: any) => void;
  setShowCriteriaModal: (v: boolean) => void;
  handleEditCriteriaTrigger: (deptId: string, crit: any) => void;
  handleDeleteCriteria: (deptId: string, id: string) => void;
  removeVietnameseTones: (s: string) => string;

  salaryScales: SalaryScale[];
  setSalaryScales: React.Dispatch<React.SetStateAction<SalaryScale[]>>;
  salaryScalesSearch: string;
  setSalaryScalesSearch: (v: string) => void;
  selectedGroupFilter: string;
  setSelectedGroupFilter: (v: string) => void;
  handleResetSalaryScales: () => void;
  handleAddNewSalaryScaleClick: () => void;
  handleEditSalaryScaleClick: (item: any) => void;
  handleDeleteSalaryScale: (id: string) => void;

  employees: EmployeeProfile[];
  setEmployees: React.Dispatch<React.SetStateAction<EmployeeProfile[]>>;
  addToast: (toast: any) => void;
  insSearchText: string;
  setInsSearchText: (v: string) => void;
  insDeptFilter: string;
  setInsDeptFilter: (v: string) => void;
  insBookFilter: string;
  setInsBookFilter: (v: string) => void;
  setEditingInsEmpId: (v: any) => void;
  setInsBookNo: (v: any) => void;
  setInsSalary: (v: any) => void;
  setInsRate: (v: any) => void;
  setInsPersonalRelief: (v: any) => void;
  setInsDependentCount: (v: any) => void;
  setInsDate: (v: any) => void;
  setShowInsModal: (v: boolean) => void;

  travelNorms: TravelAllowanceNorm[];
  travelNormSearch: string;
  setTravelNormSearch: (v: string) => void;
  handleAddTravelNormClick: () => void;
  handleEditTravelNormClick: (norm: any) => void;
  handleDeleteTravelNorm: (id: string) => void;
  setTravelNorms: React.Dispatch<React.SetStateAction<TravelAllowanceNorm[]>>;

  attendanceInitDate: Date;
  setAttendanceInitDate: (v: Date) => void;
}

export default function HrDataTab(props: HrDataTabProps) {
  const {
    activeHrDataSubTab,
    setActiveHrDataSubTab,

    holidays,
    setHolidays,
    holidaySearchQuery,
    setHolidaySearchQuery,
    setShowHolidayModal,
    handleDeleteHoliday,
    onEditHoliday,

    leaveCoefficients,
    setLeaveCoefficients,
    coefSearchQuery,
    setCoefSearchQuery,
    setShowCoefModal,
    handleToggleCoefficientAuto,
    handleDeleteCoefficient,

    departmentCriteria,
    setDepartmentCriteria,
    criteriaSearchQuery,
    setCriteriaSearchQuery,
    setEditingCritId,
    setEditingCritDeptId,
    setNewCritContent,
    setNewCritCategory,
    setShowCriteriaModal,
    handleEditCriteriaTrigger,
    handleDeleteCriteria,
    removeVietnameseTones,

    salaryScales,
    setSalaryScales,
    salaryScalesSearch,
    setSalaryScalesSearch,
    selectedGroupFilter,
    setSelectedGroupFilter,
    handleResetSalaryScales,
    handleAddNewSalaryScaleClick,
    handleEditSalaryScaleClick,
    handleDeleteSalaryScale,

    employees,
    setEmployees,
    addToast,
    insSearchText,
    setInsSearchText,
    insDeptFilter,
    setInsDeptFilter,
    insBookFilter,
    setInsBookFilter,
    setEditingInsEmpId,
    setInsBookNo,
    setInsSalary,
    setInsRate,
    setInsPersonalRelief,
    setInsDependentCount,
    setInsDate,
    setShowInsModal,

    travelNorms,
    travelNormSearch,
    setTravelNormSearch,
    handleAddTravelNormClick,
    handleEditTravelNormClick,
    handleDeleteTravelNorm,
    setTravelNorms,

    attendanceInitDate,
    setAttendanceInitDate,
  } = props;

  // ── Multi-row selection state ──
  const [hrSelectedRows, setHrSelectedRows] = useState<Set<string>>(new Set());
  const [hrSelectAll, setHrSelectAll] = useState(false);

  // Reset selection when switching subtabs
  useEffect(() => {
    setHrSelectedRows(new Set());
    setHrSelectAll(false);
  }, [activeHrDataSubTab]);

  const handleHrSelectAll = (checked: boolean, visibleItems: { id: string }[]) => {
    if (checked) {
      setHrSelectedRows(new Set(visibleItems.map(item => item.id)));
    } else {
      setHrSelectedRows(new Set());
    }
    setHrSelectAll(checked);
  };

  const handleHrRowSelect = (id: string, checked: boolean) => {
    setHrSelectedRows(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleBulkDeleteHrData = () => {
    if (hrSelectedRows.size === 0) return;
    if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa ${hrSelectedRows.size} mục đã chọn không?\nHành động này không thể hoàn tác.`)) return;

    switch (activeHrDataSubTab) {
      case 'holidays': {
        const remaining = holidays.filter(h => !hrSelectedRows.has(h.id));
        setHolidays(remaining);
        break;
      }
      case 'coefficients': {
        const remaining = leaveCoefficients.filter(c => !hrSelectedRows.has(c.id));
        setLeaveCoefficients(remaining);
        break;
      }
      case 'criteria': {
        const existing = departmentCriteria[0]?.criteria || [];
        const remaining = existing.filter(c => !hrSelectedRows.has(c.id));
        setDepartmentCriteria([{ ...departmentCriteria[0], criteria: remaining }]);
        break;
      }
      case 'salary_scales': {
        const remaining = salaryScales.filter(s => !hrSelectedRows.has(s.id));
        setSalaryScales(remaining);
        break;
      }
      case 'insurance': {
        const remaining = employees.filter(e => !hrSelectedRows.has(e.id));
        setEmployees(remaining);
        break;
      }
      case 'travel_norms': {
        const remaining = travelNorms.filter(n => !hrSelectedRows.has(n.id));
        setTravelNorms(remaining);
        break;
      }
    }
    setHrSelectedRows(new Set());
    setHrSelectAll(false);
    addToast({ title: '✅ Đã xóa', message: `Đã xóa ${hrSelectedRows.size} mục.`, type: 'success' });
  };

  // ── File input refs ──
  const holidaysFileRef = useRef<HTMLInputElement>(null);
  const coefFileRef = useRef<HTMLInputElement>(null);
  const criteriaFileRef = useRef<HTMLInputElement>(null);
  const salaryScaleFileRef = useRef<HTMLInputElement>(null);
  const insuranceFileRef = useRef<HTMLInputElement>(null);
  const travelNormFileRef = useRef<HTMLInputElement>(null);

  // ── Export helpers ──
  const exportToExcel = (data: Record<string, any>[], sheetName: string, fileName: string) => {
    if (data.length === 0) {
      addToast({ title: '⚠️ Không có dữ liệu', message: 'Không có dữ liệu để xuất Excel.', type: 'warning' });
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
    addToast({ title: '✅ Xuất Excel', message: `Đã xuất ${data.length} bản ghi`, type: 'success' });
  };

  const importFromExcel = (file: File, sheetNameHint: string): Promise<Record<string, any>[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = ev.target?.result;
          if (!data) { reject(new Error('Không đọc được dữ liệu file')); return; }
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false });
          resolve(rows);
        } catch (err) {
          console.error('[Import Excel] Lỗi parse:', err);
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Không thể đọc file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    tableName: string,
    processRow: (row: Record<string, any>) => any,
    onData: (items: any[]) => void,
    requiredColumns: string[],
    keyFn?: (row: any) => string,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await importFromExcel(file, tableName);
      if (rows.length === 0) {
        addToast({ title: '⚠️ Không có dữ liệu', message: `File không có dòng dữ liệu hợp lệ.`, type: 'warning' });
        return;
      }
      const missingCols = requiredColumns.filter(col => !(col in rows[0]));
      if (missingCols.length > 0) {
        addToast({ title: '⛔ Lỗi cột', message: `Thiếu cột: ${missingCols.join(', ')}`, type: 'error' });
        return;
      }
      const mapped = rows.map(r => processRow(r));
      onData(mapped);
      addToast({ title: '✅ Nhập Excel', message: `Đã import ${mapped.length} bản ghi vào ${tableName}`, type: 'success' });
    } catch (err) {
      addToast({ title: '⛔ Lỗi', message: `Không thể đọc file Excel`, type: 'error' });
    }
    e.target.value = '';
  };

  // ── 1. Holidays ──
  // Quy đổi "dd/mm/yyyy" -> timestamp để sắp xếp tăng dần theo ngày (không phải
  // theo chuỗi ký tự, vì "2/9" sẽ đứng trước "10/2" nếu so sánh chuỗi thô).
  // Trả về Infinity cho giá trị không đúng định dạng để đẩy xuống cuối danh sách
  // thay vì làm vỡ thứ tự hoặc crash.
  const parseHolidayDate = (dateStr: string): number => {
    const parts = (dateStr || '').split('/');
    if (parts.length !== 3) return Infinity;
    const [day, month, year] = parts.map(Number);
    if (!day || !month || !year) return Infinity;
    return new Date(year, month - 1, day).getTime();
  };

  const handleExportHolidays = () => {
    const data = holidays.map(h => ({
      'Mã NL': h.id,
      'Ngày nghỉ': h.date,
      'Tên dịp lễ': h.name,
    }));
    exportToExcel(data, 'NgayNghiLe', `DanhMuc_NgayNghiLe_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleImportHolidays = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e, 'Ngày nghỉ lễ', (row) => ({
      id: String(row['Mã NL'] || `NL-IMP-${Date.now()}-${Math.random().toString(36).slice(2,6)}`).trim(),
      date: String(row['Ngày nghỉ'] || '').trim(),
      name: String(row['Tên dịp lễ'] || '').trim(),
    }), (items) => {
      const merged = [...holidays];
      items.forEach((item: Holiday) => {
        const idx = merged.findIndex(h => h.id === item.id || h.date === item.date);
        if (idx > -1) merged[idx] = { ...merged[idx], ...item };
        else merged.push(item);
      });
      setHolidays(merged);
    }, ['Ngày nghỉ', 'Tên dịp lễ']);
  };

  // ── 2. Leave Coefficients ──
  const handleExportCoefficients = () => {
    const data = leaveCoefficients.map(c => ({
      'Mã HSCC': c.id,
      'Nội Dung Chấm Công': c.type,
      'Chấm tự động': c.isAuto ? 'Có' : 'Không',
      'Hệ Số': c.coefficient,
    }));
    exportToExcel(data, 'HeSoChamCong', `DanhMuc_HeSoChamCong_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleImportCoefficients = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e, 'Hệ số chấm công', (row) => ({
      id: String(row['Mã HSCC'] || `HSCC-IMP-${Date.now()}-${Math.random().toString(36).slice(2,6)}`).trim(),
      type: String(row['Nội Dung Chấm Công'] || '').trim(),
      isAuto: String(row['Chấm tự động'] || '').trim().toLowerCase() === 'có' || String(row['Chấm tự động'] || '').trim() === 'true',
      coefficient: Number(row['Hệ Số'] || 1),
    }), (items) => {
      const merged = [...leaveCoefficients];
      items.forEach((item: LeaveCoefficient) => {
        const idx = merged.findIndex(c => c.id === item.id || c.type === item.type);
        if (idx > -1) merged[idx] = { ...merged[idx], ...item };
        else merged.push(item);
      });
      setLeaveCoefficients(merged);
    }, ['Nội Dung Chấm Công', 'Hệ Số']);
  };

  // ── 3. Performance Criteria ──
  const handleExportCriteria = () => {
    const allCrits = departmentCriteria[0]?.criteria || [];
    const data = allCrits.map(c => ({
      'Mã Tiêu Chí': c.id,
      'Phân Nhóm': c.category === 'readiness' ? 'Tác phong & Chuyên cần' : c.category === 'progress' ? 'Hiệu suất & Tiến độ' : 'Báo cáo & Đạo đức',
      'Nội Dung Tiêu Chí': c.content,
    }));
    exportToExcel(data, 'TieuChiHieuSuat', `DanhMuc_TieuChiHieuSuat_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleImportCriteria = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e, 'Tiêu chí hiệu suất', (row) => {
      const rawCat = String(row['Phân Nhóm'] || '').trim().toLowerCase();
      let category: 'readiness' | 'progress' | 'reporting' = 'readiness';
      if (rawCat.includes('hiệu suất') || rawCat.includes('tiến độ') || rawCat === 'progress') category = 'progress';
      else if (rawCat.includes('báo cáo') || rawCat.includes('đạo đức') || rawCat === 'reporting') category = 'reporting';
      return {
        id: String(row['Mã Tiêu Chí'] || `TC-IMP-${Date.now()}-${Math.random().toString(36).slice(2,6)}`).trim(),
        category,
        content: String(row['Nội Dung Tiêu Chí'] || '').trim(),
      };
    }, (items) => {
      const existing = departmentCriteria[0]?.criteria || [];
      const merged = [...existing];
      items.forEach((item: any) => {
        const idx = merged.findIndex(c => c.id === item.id || c.content === item.content);
        if (idx > -1) merged[idx] = { ...merged[idx], ...item };
        else merged.push(item);
      });
      const updated: DepartmentCriteria[] = [{ ...departmentCriteria[0], criteria: merged }];
      setDepartmentCriteria(updated);
    }, ['Nội Dung Tiêu Chí']);
  };

  // ── 4. Salary Scales ──
  const handleExportSalaryScales = () => {
    const data = salaryScales.map(s => ({
      'Mã Chi Trả': s.id,
      'Mã Ngạch': s.groupCode,
      'Tên Ngạch': s.groupName,
      'Mô tả Ngạch': s.groupDesc || '',
      'Bậc': s.level,
      'Tên Bậc': s.levelName,
      'Lương Cơ Bản': s.baseSalary,
      'Tỉ Lệ %': s.allocationRate,
      'Lương Hiệu Suất': s.performanceSalary,
      'Tổng Lương 100%': s.totalSalary,
      'Ghi chú': s.notes || '',
    }));
    exportToExcel(data, 'BacLuong', `DanhMuc_HeThongBacLuong_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleImportSalaryScales = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e, 'Bậc lương', (row) => ({
      id: String(row['Mã Chi Trả'] || '').trim(),
      groupCode: String(row['Mã Ngạch'] || '').trim(),
      groupName: String(row['Tên Ngạch'] || '').trim(),
      groupDesc: String(row['Mô tả Ngạch'] || '').trim() || undefined,
      level: String(row['Bậc'] || '').trim(),
      levelName: String(row['Tên Bậc'] || '').trim(),
      baseSalary: Number(row['Lương Cơ Bản'] || 0),
      allocationRate: Number(row['Tỉ Lệ %'] || 0),
      performanceSalary: Number(row['Lương Hiệu Suất'] || 0),
      totalSalary: Number(row['Tổng Lương 100%'] || 0),
      notes: String(row['Ghi chú'] || '').trim() || undefined,
    }), (items) => {
      const merged = [...salaryScales];
      items.forEach((item: SalaryScale) => {
        const idx = merged.findIndex(s => s.id === item.id);
        if (idx > -1) merged[idx] = { ...merged[idx], ...item };
        else merged.push(item);
      });
      setSalaryScales(merged);
    }, ['Mã Chi Trả', 'Tên Bậc', 'Lương Cơ Bản']);
  };

  // ── 5. Insurance & Tax ──
  const handleExportInsurance = () => {
    const filtered = employees.filter((emp: any) => {
      const searchLower = insSearchText.trim().toLowerCase();
      const matchesSearch = searchLower === '' ||
        emp.id.toLowerCase().includes(searchLower) ||
        emp.name.toLowerCase().includes(searchLower) ||
        (emp.bhxhBookNo && emp.bhxhBookNo.toLowerCase().includes(searchLower));
      const matchesDept = insDeptFilter === 'all' || emp.department === insDeptFilter;
      const matchesBook = insBookFilter === 'all' ||
        (insBookFilter === 'has_book' && emp.bhxhBookNo && emp.bhxhBookNo.trim() !== '') ||
        (insBookFilter === 'no_book' && (!emp.bhxhBookNo || emp.bhxhBookNo.trim() === ''));
      return matchesSearch && matchesDept && matchesBook;
    });
    const data = filtered.map((emp: any) => ({
      'Mã NV': emp.id,
      'Họ và Tên': emp.name,
      'Bộ phận': emp.department,
      'Chức vụ': emp.position || '',
      'Số sổ BHXH': emp.bhxhBookNo || '',
      'Mức đóng BH': Number(emp.bhxhSalary) || (salaryScales.find((s: any) => s.id === emp.salaryCode)?.baseSalary || 0),
      'Tỷ lệ đóng (%)': Number(emp.bhxhRate) || 10.5,
      'Ngày hiệu lực': emp.bhxhDate || '',
      'Thuế: Bản thân': Number(emp.taxPersonalRelief) || 15500000,
      'Số người phụ thuộc': Number(emp.dependentCount) || 0,
    }));
    exportToExcel(data, 'BHXH_Thue', `DanhSach_BHXH_Thue_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleImportInsurance = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e, 'BHXH & Thuế', (row) => ({
      empId: String(row['Mã NV'] || '').trim(),
      bhxhBookNo: String(row['Số sổ BHXH'] || '').trim() || undefined,
      bhxhSalary: Number(row['Mức đóng BH'] || 0) || undefined,
      bhxhRate: Number(row['Tỷ lệ đóng (%)'] || 10.5) || undefined,
      bhxhDate: String(row['Ngày hiệu lực'] || '').trim() || undefined,
      taxPersonalRelief: Number(row['Thuế: Bản thân'] || 15500000) || undefined,
      dependentCount: Number(row['Số người phụ thuộc'] || 0) || undefined,
    }), (items) => {
      const updated = [...employees];
      let count = 0;
      items.forEach((item: any) => {
        const idx = updated.findIndex((e: any) => e.id === item.empId);
        if (idx > -1) {
          updated[idx] = {
            ...updated[idx],
            bhxhBookNo: item.bhxhBookNo || (updated[idx] as any).bhxhBookNo,
            bhxhSalary: item.bhxhSalary || (updated[idx] as any).bhxhSalary,
            bhxhRate: item.bhxhRate || (updated[idx] as any).bhxhRate,
            bhxhDate: item.bhxhDate || (updated[idx] as any).bhxhDate,
            taxPersonalRelief: item.taxPersonalRelief || (updated[idx] as any).taxPersonalRelief,
            dependentCount: item.dependentCount !== undefined ? item.dependentCount : (updated[idx] as any).dependentCount,
          };
          count++;
        }
      });
      setEmployees(updated);
      if (count === 0) {
        addToast({ title: '⚠️ Lưu ý', message: 'Không tìm thấy Mã NV nào khớp với dữ liệu hiện tại!', type: 'warning' });
      } else {
        addToast({ title: '✅ Cập nhật BHXH', message: `Đã cập nhật ${count} nhân sự`, type: 'success' });
      }
    }, ['Mã NV']);
  };

  // ── 6. Travel Allowance Norms ──
  const handleExportTravelNorms = () => {
    const data = travelNorms.map(n => ({
      'Mã CTP': n.code || '',
      'Nội Dung': n.content,
      'Số lượng': n.quantity,
      'Đơn Giá': n.unitPrice,
      'Ghi chú': n.notes || '',
    }));
    exportToExcel(data, 'DinhMucCongTacPhi', `DanhMuc_DinhMucCongTacPhi_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleImportTravelNorms = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e, 'Định mức công tác phí', (row) => ({
      id: String(row['Mã CTP'] || `CTP-IMP-${Date.now()}-${Math.random().toString(36).slice(2,6)}`).trim(),
      code: String(row['Mã CTP'] || '').trim(),
      content: String(row['Nội Dung'] || '').trim(),
      quantity: Number(row['Số lượng'] || 1),
      unitPrice: Number(row['Đơn Giá'] || 0),
      notes: String(row['Ghi chú'] || '').trim(),
    }), (items) => {
      const merged = [...travelNorms];
      items.forEach((item: TravelAllowanceNorm) => {
        const idx = merged.findIndex(n => n.id === item.id || n.code === item.code);
        if (idx > -1) merged[idx] = { ...merged[idx], ...item };
        else merged.push(item);
      });
      setTravelNorms(merged);
    }, ['Nội Dung', 'Đơn Giá']);
  };

  // ───────────────────────── HIỂN THỊ (thiết kế mới) ─────────────────────────
  // Logic lọc / xuất-nhập Excel / xóa hàng loạt ở trên giữ nguyên; phần dưới chỉ là giao diện:
  // chip chuyển 6 danh mục (kèm số lượng) → thanh công cụ gọn (tìm kiếm + Xuất/Nhập chỉ biểu tượng + nút xanh "Thêm")
  // → bảng (máy tính) / thẻ (điện thoại) → thanh xóa hàng loạt chỉ hiện khi có dòng được tích.
  const PILL = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap';
  const inputCls = 'h-9 bg-white border border-slate-200 text-slate-800 rounded-xl px-2.5 text-[13px] outline-none focus:border-blue-400';
  const iconBtn36 = 'w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer';
  const rowIcon = 'w-8 h-8 inline-flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer';
  const rowDel = 'w-8 h-8 inline-flex items-center justify-center rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer';
  const chk = 'w-4 h-4 rounded cursor-pointer';
  const th = 'py-2.5 px-3 text-left';
  const money = (n: number) => `${(Number(n) || 0).toLocaleString('vi-VN')} đ`;

  // ── Danh sách đã lọc của từng danh mục (đúng điều kiện lọc cũ) ──
  const holidayQ = holidaySearchQuery.toLowerCase();
  const filteredHolidays = holidays
    .filter(h => h.name.toLowerCase().includes(holidayQ) || h.date.includes(holidayQ) || h.id.toLowerCase().includes(holidayQ))
    .sort((a, b) => parseHolidayDate(a.date) - parseHolidayDate(b.date));

  const coefQ = coefSearchQuery.toLowerCase();
  const filteredCoefs = leaveCoefficients.filter(c => c.type.toLowerCase().includes(coefQ) || c.id.toLowerCase().includes(coefQ));

  const allCriteria = departmentCriteria[0]?.criteria || [];
  const critQ = removeVietnameseTones(criteriaSearchQuery);
  const filteredCriteria = allCriteria.filter(c => removeVietnameseTones(c.content).includes(critQ) || removeVietnameseTones(c.id).includes(critQ));
  // Nhãn + màu pill theo nhóm tiêu chí
  const critMeta = (cat: string) =>
    cat === 'progress' ? { label: 'Hiệu suất & Tiến độ', cls: 'bg-sky-50 text-sky-700 border-sky-200' }
    : cat === 'reporting' ? { label: 'Báo cáo & Đạo đức', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : { label: 'Tác phong & Chuyên cần', cls: 'bg-violet-50 text-violet-700 border-violet-200' };

  const scaleQ = salaryScalesSearch.toLowerCase();
  const filteredScales = salaryScales.filter(item => {
    const groupMatch = selectedGroupFilter === 'all' || item.groupCode === selectedGroupFilter;
    const textMatch = item.id.toLowerCase().includes(scaleQ) || item.levelName.toLowerCase().includes(scaleQ) || item.groupName.toLowerCase().includes(scaleQ);
    return groupMatch && textMatch;
  });

  // BHXH & thuế
  const insQ = insSearchText.trim().toLowerCase();
  const filteredIns = employees.filter((emp: any) => {
    const matchesSearch = insQ === '' || emp.id.toLowerCase().includes(insQ) || emp.name.toLowerCase().includes(insQ) || (emp.bhxhBookNo && emp.bhxhBookNo.toLowerCase().includes(insQ));
    const matchesDept = insDeptFilter === 'all' || emp.department === insDeptFilter;
    const matchesBook = insBookFilter === 'all' ||
      (insBookFilter === 'has_book' && emp.bhxhBookNo && emp.bhxhBookNo.trim() !== '') ||
      (insBookFilter === 'no_book' && (!emp.bhxhBookNo || emp.bhxhBookNo.trim() === ''));
    return matchesSearch && matchesDept && matchesBook;
  });
  const insSalaryOf = (e: any) => Number(e.bhxhSalary) || (salaryScales.find((s: any) => s.id === e.salaryCode)?.baseSalary || 0);
  const insStats = (() => {
    const withBook = employees.filter((e: any) => e.bhxhBookNo && e.bhxhBookNo.trim() !== '');
    const totalSalary = withBook.reduce((sum: number, e: any) => sum + insSalaryOf(e), 0);
    const totalPayment = withBook.reduce((sum: number, e: any) => sum + (insSalaryOf(e) * (Number(e.bhxhRate) || 10.5) / 100), 0);
    return { total: employees.length, withBookCount: withBook.length, withoutBookCount: employees.length - withBook.length, totalSalary, totalPayment };
  })();
  // Cấp số sổ BHXH tự động cho người chưa có (logic giữ nguyên như bản cũ)
  const handleBatchGenerateBHXH = () => {
    let count = 0;
    const updated = employees.map((emp: any, index: number) => {
      if (!emp.bhxhBookNo || emp.bhxhBookNo.trim() === '') {
        count++;
        const numericSuffix = String(4000 + index + 1).padStart(4, '0');
        return {
          ...emp,
          bhxhBookNo: `SHX260${numericSuffix}`,
          bhxhSalary: salaryScales.find((s: any) => s.id === emp.salaryCode)?.baseSalary || 5200000,
          bhxhRate: 10.5,
          bhxhDate: '2026-04-01',
          taxPersonalRelief: 15500000,
          dependentCount: 0,
        };
      }
      return emp;
    });
    if (count === 0) {
      addToast({ title: 'ℹ️ Thông báo', message: 'Tất cả nhân viên hiện tại đều đã được đăng ký sổ BHXH!', type: 'warning' });
      return;
    }
    setEmployees(updated);
    addToast({ title: '✅ Thành công', message: `Đã cấp số sổ BHXH tự động hàng loạt thành công cho ${count} nhân sự chưa có sổ!`, type: 'success' });
  };
  const handleOpenEditIns = (emp: any) => {
    setEditingInsEmpId(emp.id);
    setInsBookNo(emp.bhxhBookNo || '');
    setInsSalary(emp.bhxhSalary || (salaryScales.find((s: any) => s.id === emp.salaryCode)?.baseSalary || 0));
    setInsRate(emp.bhxhRate || 10.5);
    setInsPersonalRelief(emp.taxPersonalRelief || 15500000);
    setInsDependentCount(emp.dependentCount || 0);
    setInsDate(emp.bhxhDate || '2026-04-01');
    setShowInsModal(true);
  };
  const departments = Array.from(new Set(employees.map((e: any) => e.department))).filter(Boolean);

  const travelQ = travelNormSearch.toLowerCase();
  const filteredNorms = travelNorms.filter(norm =>
    norm.content.toLowerCase().includes(travelQ) || (norm.code && norm.code.toLowerCase().includes(travelQ)) || (norm.notes && norm.notes.toLowerCase().includes(travelQ)));

  // ── Chip chuyển danh mục (kèm số lượng) ──
  const TABS: Array<[string, string, React.ComponentType<{ className?: string }>, number, string]> = [
    ['holidays', 'Ngày nghỉ lễ', Calendar, holidays.length, 'holiday_tab_trigger'],
    ['coefficients', 'Hệ số chấm công', Percent, leaveCoefficients.length, 'coefficient_tab_trigger'],
    ['criteria', 'Tiêu chí hiệu suất', Building, allCriteria.length, 'criteria_tab_trigger'],
    ['salary_scales', 'Bậc lương', Award, salaryScales.length, 'salary_scales_tab_trigger'],
    ['insurance', 'BHXH & Thuế', FileSpreadsheet, employees.length, 'insurance_tab_trigger'],
    ['travel_norms', 'Định mức công tác phí', MapPin, travelNorms.length, 'travel_norms_tab_trigger'],
  ];

  // Ô chọn tất cả (đúng điều kiện cũ: bật cờ hrSelectAll và mọi dòng đang lọc đều được tích)
  const allSelected = (items: { id: string }[]) => hrSelectAll && items.length > 0 && items.every(i => hrSelectedRows.has(i.id));
  const headCheck = (items: { id: string }[]) => (
    <input type="checkbox" className={chk} aria-label="Chọn tất cả" checked={allSelected(items)} onChange={(e) => handleHrSelectAll(e.target.checked, items)} />
  );
  const rowCheck = (id: string) => (
    <input type="checkbox" className={chk} aria-label="Chọn dòng" checked={hrSelectedRows.has(id)} onChange={(e) => { e.stopPropagation(); handleHrRowSelect(id, e.target.checked); }} />
  );

  // Thanh công cụ dùng chung: tìm kiếm + (bộ lọc riêng) + Xuất/Nhập chỉ biểu tượng + nút xanh "Thêm"
  const toolbar = (o: {
    search: string; setSearch: (v: string) => void; placeholder: string; extra?: React.ReactNode;
    onExport: () => void; exportTitle: string; fileRef: React.RefObject<HTMLInputElement>; onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    addLabel: string; onAdd: () => void; addId?: string; more?: React.ReactNode;
  }) => (
    <div className="flex flex-wrap items-center gap-2" data-testid="hrdata-toolbar">
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <input type="text" value={o.search} onChange={(e) => o.setSearch(e.target.value)} placeholder={o.placeholder} data-testid="hrdata-search"
          className={`${inputCls} w-full pl-9 pr-3`} />
      </div>
      {o.extra}
      <button type="button" onClick={o.onExport} title={o.exportTitle} aria-label="Xuất Excel" data-testid="hrdata-export" className={iconBtn36}><Download className="w-4 h-4" /></button>
      <button type="button" onClick={() => o.fileRef.current?.click()} title="Nhập từ Excel" aria-label="Nhập Excel" data-testid="hrdata-import" className={iconBtn36}><Upload className="w-4 h-4" /></button>
      <input ref={o.fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={o.onImport} />
      {o.more}
      <button type="button" onClick={o.onAdd} id={o.addId} data-testid="hrdata-add"
        // Nền xanh đặt inline vì index.css ép màu cho bg-* / text-white
        style={{ background: '#0d47c9', color: '#ffffff' }}
        className="h-9 px-3.5 rounded-xl flex items-center gap-1.5 text-[13px] font-bold cursor-pointer">
        <Plus className="w-4 h-4" /><span>{o.addLabel}</span>
      </button>
    </div>
  );

  // Thanh xóa hàng loạt: chỉ hiện khi có dòng được tích
  const bulkBar = hrSelectedRows.size > 0 && (
    <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ background: '#e8efff', borderColor: '#bcd0ff' }} data-testid="hrdata-bulk">
      <span className="text-[13px] font-bold" style={{ color: '#0d47c9' }}>Đã chọn {hrSelectedRows.size}</span>
      <span className="flex-1" />
      <button type="button" onClick={handleBulkDeleteHrData} data-testid="hrdata-bulk-delete"
        style={{ background: '#e11d48', color: '#ffffff' }} className="h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /> Xóa</button>
    </div>
  );

  // Khung bảng (máy tính) + khung thẻ (điện thoại) + dòng đếm
  const shell = (o: { tableHead: React.ReactNode; tableBody: React.ReactNode; cards: React.ReactNode; empty: boolean; emptyText: string; count: React.ReactNode; minW?: string }) => (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {o.empty ? (
        <div className="py-12 text-center text-slate-500 text-sm" data-testid="hrdata-empty">{o.emptyText}</div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto" data-testid="hrdata-table">
            <table className={`w-full text-[13px] ${o.minW || ''}`}>
              <thead><tr className="bg-slate-50 text-slate-500 text-[11px] font-bold border-b border-slate-200">{o.tableHead}</tr></thead>
              <tbody className="divide-y divide-slate-100">{o.tableBody}</tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-slate-100" data-testid="hrdata-cards">{o.cards}</div>
        </>
      )}
      <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-500" data-testid="hrdata-count">{o.count}</div>
    </div>
  );
  const rowCls = (id: string) => `hover:bg-blue-50/40 ${hrSelectedRows.has(id) ? 'bg-blue-50/60' : ''}`;
  const actions = (onEdit: (() => void) | null, onDelete: () => void, what: string) => (
    <div className="flex items-center justify-end gap-1.5">
      {onEdit && <button type="button" className={rowIcon} title={`Sửa ${what}`} aria-label={`Sửa ${what}`} onClick={onEdit}><Pencil className="w-3.5 h-3.5" /></button>}
      <button type="button" className={rowDel} title={`Xóa ${what}`} aria-label={`Xóa ${what}`} onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  );

  return (
    <div className="space-y-3 font-sans min-w-0" id="hr_data_tab_content" data-testid="hrdata-root">
      {/* Thanh chuyển danh mục — CÙNG KIỂU với thanh tab của "Quản lý nhân sự" (HrDesktopTabs):
          nút bo xl, tab đang chọn tô xanh LoLo chữ trắng, tab thường nền xám nhạt, có đường kẻ dưới.
          Giữ thêm số lượng từng danh mục; điện thoại cuộn ngang (ít tab nên không cần ngăn kéo). */}
      <nav aria-label="Danh mục dữ liệu nhân sự" className="flex items-center gap-1.5 overflow-x-auto pb-3 border-b border-slate-200" data-testid="hrdata-chips">
        {TABS.map(([id, label, Icon, n, trig]) => {
          const on = activeHrDataSubTab === id;
          return (
            <button key={id} type="button" id={trig} onClick={() => setActiveHrDataSubTab(id)} aria-current={on ? 'page' : undefined} data-testid={`hrdata-chip-${id}`}
              // Nền/chữ đặt inline: index.css ép màu cho text-white / bg-* nên class Tailwind không đủ tin cậy cho nút nền xanh
              style={on ? { background: '#0d47c9', color: '#ffffff' } : undefined}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors ${on ? '' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}>
              <Icon className="w-4 h-4" />
              <span>{label}</span>
              <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] leading-[18px] text-center font-black"
                style={on ? { background: '#ffffff', color: '#0d47c9' } : { background: '#e2e8f0', color: '#475569' }}>{n}</span>
            </button>
          );
        })}
      </nav>

      {/* ═══ 1. NGÀY NGHỈ LỄ ═══ */}
      {activeHrDataSubTab === 'holidays' && (
        <>
          {toolbar({ search: holidaySearchQuery, setSearch: setHolidaySearchQuery, placeholder: 'Tìm dịp lễ, ngày…', onExport: handleExportHolidays, exportTitle: 'Xuất Excel ngày nghỉ lễ', fileRef: holidaysFileRef, onImport: handleImportHolidays, addLabel: 'Thêm ngày nghỉ lễ', onAdd: () => setShowHolidayModal(true), addId: 'add_holiday_btn' })}
          {bulkBar}
          {shell({
            empty: filteredHolidays.length === 0, emptyText: 'Không tìm thấy ngày nghỉ lễ nào khớp với bộ lọc.',
            count: <>Tổng cộng <b className="text-slate-700">{holidays.length}</b> ngày nghỉ lễ{filteredHolidays.length !== holidays.length && <> · đang hiển thị {filteredHolidays.length}</>}</>,
            tableHead: (<><th className="py-2.5 px-3 w-10">{headCheck(filteredHolidays)}</th><th className={th}>Ngày nghỉ</th><th className={th}>Tên dịp lễ</th><th className={th}>Mã</th><th className={`${th} text-right`}>Thao tác</th></>),
            tableBody: filteredHolidays.map(item => (
              <tr key={item.id} data-testid={`hrdata-row-${item.id}`} className={rowCls(item.id)}>
                <td className="py-2.5 px-3">{rowCheck(item.id)}</td>
                <td className="py-2.5 px-3"><span className={`${PILL} bg-slate-50 text-slate-700 border-slate-200 font-mono`}>{item.date}</span></td>
                <td className="py-2.5 px-3 font-bold text-slate-900">{item.name}</td>
                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{item.id}</td>
                <td className="py-2.5 px-3">{actions(() => onEditHoliday(item), () => handleDeleteHoliday(item.id), 'ngày nghỉ')}</td>
              </tr>)),
            cards: filteredHolidays.map(item => (
              <div key={item.id} data-testid={`hrdata-card-${item.id}`} className={`p-3.5 flex items-start gap-3 ${hrSelectedRows.has(item.id) ? 'bg-blue-50/60' : ''}`}>
                <div className="pt-1">{rowCheck(item.id)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                  <div className="mt-1 flex items-center gap-2"><span className={`${PILL} bg-slate-50 text-slate-700 border-slate-200 font-mono`}>{item.date}</span><span className="font-mono text-[11px] text-slate-400">{item.id}</span></div>
                </div>
                {actions(() => onEditHoliday(item), () => handleDeleteHoliday(item.id), 'ngày nghỉ')}
              </div>)),
          })}
        </>
      )}

      {/* ═══ 2. HỆ SỐ CHẤM CÔNG ═══ */}
      {activeHrDataSubTab === 'coefficients' && (
        <>
          {toolbar({ search: coefSearchQuery, setSearch: setCoefSearchQuery, placeholder: 'Tìm nội dung chấm công, mã…', onExport: handleExportCoefficients, exportTitle: 'Xuất Excel hệ số chấm công', fileRef: coefFileRef, onImport: handleImportCoefficients, addLabel: 'Thêm hệ số', onAdd: () => setShowCoefModal(true), addId: 'add_coef_btn' })}
          {bulkBar}
          {(() => {
            // Công tắc "Chấm tự động" (bấm đổi ngay, như cũ) và ô sửa hệ số tại chỗ
            const toggle = (item: LeaveCoefficient) => (
              <button type="button" role="switch" aria-checked={item.isAuto} aria-label="Chấm tự động" data-testid={`hrdata-auto-${item.id}`} onClick={() => handleToggleCoefficientAuto(item.id)}
                style={{ background: item.isAuto ? '#0d47c9' : '#cbd5e1' }} className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors">
                <span className={`pointer-events-none inline-block h-4 w-4 m-0.5 transform rounded-full bg-white shadow transition ${item.isAuto ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>);
            const coefInput = (item: LeaveCoefficient) => (
              <input type="number" step="0.1" value={item.coefficient} data-testid={`hrdata-coef-${item.id}`} aria-label="Hệ số"
                onChange={(e) => { const val = Number(e.target.value); setLeaveCoefficients(prev => prev.map(c => c.id === item.id ? { ...c, coefficient: val } : c)); }}
                className="w-16 h-8 bg-white border border-slate-200 rounded-lg px-1.5 text-center font-mono font-bold text-[13px] outline-none focus:border-blue-400" />);
            return shell({
              empty: filteredCoefs.length === 0, emptyText: 'Không tìm thấy hệ số chấm công nào khớp với bộ lọc.',
              count: <>Tổng cộng <b className="text-slate-700">{leaveCoefficients.length}</b> loại hệ số chấm công</>,
              tableHead: (<><th className="py-2.5 px-3 w-10">{headCheck(filteredCoefs)}</th><th className={th}>Nội dung chấm công</th><th className={th}>Mã</th><th className={th}>Chấm tự động</th><th className={th}>Hệ số</th><th className={`${th} text-right`}>Thao tác</th></>),
              tableBody: filteredCoefs.map(item => (
                <tr key={item.id} data-testid={`hrdata-row-${item.id}`} className={rowCls(item.id)}>
                  <td className="py-2.5 px-3">{rowCheck(item.id)}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">{item.type}</td>
                  <td className="py-2.5 px-3"><span className={`${PILL} bg-slate-50 text-slate-600 border-slate-200 font-mono`}>{item.id}</span></td>
                  <td className="py-2.5 px-3">{toggle(item)}</td>
                  <td className="py-2.5 px-3">{coefInput(item)}</td>
                  <td className="py-2.5 px-3">{actions(null, () => handleDeleteCoefficient(item.id), 'hệ số')}</td>
                </tr>)),
              cards: filteredCoefs.map(item => (
                <div key={item.id} data-testid={`hrdata-card-${item.id}`} className={`p-3.5 space-y-2 ${hrSelectedRows.has(item.id) ? 'bg-blue-50/60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="pt-1">{rowCheck(item.id)}</div>
                    <div className="flex-1 min-w-0"><div className="font-bold text-slate-900 text-sm">{item.type}</div><span className={`${PILL} bg-slate-50 text-slate-600 border-slate-200 font-mono mt-1`}>{item.id}</span></div>
                    {actions(null, () => handleDeleteCoefficient(item.id), 'hệ số')}
                  </div>
                  <div className="flex items-center gap-4 pl-7"><label className="flex items-center gap-2 text-xs text-slate-500">Chấm tự động {toggle(item)}</label><label className="flex items-center gap-2 text-xs text-slate-500">Hệ số {coefInput(item)}</label></div>
                </div>)),
            });
          })()}
        </>
      )}

      {/* ═══ 3. TIÊU CHÍ HIỆU SUẤT ═══ */}
      {activeHrDataSubTab === 'criteria' && (
        <div className="space-y-3" id="criteria_workspace">
          {toolbar({ search: criteriaSearchQuery, setSearch: setCriteriaSearchQuery, placeholder: 'Tìm tiêu chí đánh giá…', onExport: handleExportCriteria, exportTitle: 'Xuất Excel tiêu chí hiệu suất', fileRef: criteriaFileRef, onImport: handleImportCriteria, addLabel: 'Thêm tiêu chí', addId: 'add_criterion_btn',
            onAdd: () => { setEditingCritId(null); setEditingCritDeptId(null); setNewCritContent(''); setNewCritCategory('readiness'); setShowCriteriaModal(true); } })}
          {bulkBar}
          {shell({
            empty: filteredCriteria.length === 0, emptyText: 'Không tìm thấy tiêu chí nào khớp với từ khóa tìm kiếm.',
            count: <>Đang hiển thị <b className="text-slate-700">{filteredCriteria.length}</b> / {allCriteria.length} tiêu chí</>,
            tableHead: (<><th className="py-2.5 px-3 w-10">{headCheck(filteredCriteria)}</th><th className={`${th} w-12`}>STT</th><th className={th}>Phân nhóm</th><th className={th}>Nội dung tiêu chí đánh giá</th><th className={th}>Mã</th><th className={`${th} text-right`}>Thao tác</th></>),
            tableBody: filteredCriteria.map((crit, idx) => {
              const m = critMeta(crit.category);
              return (
                <tr key={crit.id} data-testid={`hrdata-row-${crit.id}`} className={rowCls(crit.id)}>
                  <td className="py-2.5 px-3">{rowCheck(crit.id)}</td>
                  <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-2.5 px-3"><span className={`${PILL} ${m.cls}`}>{m.label}</span></td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">{crit.content}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{crit.id}</td>
                  <td className="py-2.5 px-3">{actions(() => handleEditCriteriaTrigger('dept_all', crit), () => handleDeleteCriteria('dept_all', crit.id), 'tiêu chí')}</td>
                </tr>);
            }),
            cards: filteredCriteria.map(crit => {
              const m = critMeta(crit.category);
              return (
                <div key={crit.id} data-testid={`hrdata-card-${crit.id}`} className={`p-3.5 flex items-start gap-3 ${hrSelectedRows.has(crit.id) ? 'bg-blue-50/60' : ''}`}>
                  <div className="pt-1">{rowCheck(crit.id)}</div>
                  <div className="flex-1 min-w-0"><span className={`${PILL} ${m.cls}`}>{m.label}</span><div className="mt-1.5 font-bold text-slate-900 text-sm break-words">{crit.content}</div><div className="font-mono text-[11px] text-slate-400 mt-0.5">{crit.id}</div></div>
                  {actions(() => handleEditCriteriaTrigger('dept_all', crit), () => handleDeleteCriteria('dept_all', crit.id), 'tiêu chí')}
                </div>);
            }),
          })}
        </div>
      )}

      {/* ═══ 4. BẬC LƯƠNG ═══ */}
      {activeHrDataSubTab === 'salary_scales' && (
        <div className="space-y-3" id="salary_scales_workspace">
          {toolbar({ search: salaryScalesSearch, setSearch: setSalaryScalesSearch, placeholder: 'Tìm mã, ngạch, bậc…', onExport: handleExportSalaryScales, exportTitle: 'Xuất Excel bậc lương', fileRef: salaryScaleFileRef, onImport: handleImportSalaryScales, addLabel: 'Thêm bậc lương', onAdd: handleAddNewSalaryScaleClick,
            extra: (
              <select value={selectedGroupFilter} onChange={(e) => setSelectedGroupFilter(e.target.value)} aria-label="Ngạch" data-testid="hrdata-group-filter" className={`${inputCls} cursor-pointer font-bold`}>
                <option value="all">Tất cả các ngạch</option>
                <option value="QLDH">I. Quản lý - Điều hành (QLDH)</option>
                <option value="KTTC">II. Kỹ thuật - Thi công (KTTC)</option>
                <option value="HCKT">III. Hành chính - Nhân sự (HCKT)</option>
              </select>),
            more: (<button type="button" onClick={handleResetSalaryScales} data-testid="hrdata-reset-scales" className="h-9 px-3 rounded-xl text-[13px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-1.5"><FileSpreadsheet className="w-4 h-4" /><span className="hidden sm:inline">Khôi phục mẫu</span></button>) })}
          {bulkBar}
          {shell({
            minW: 'min-w-[1000px]',
            empty: filteredScales.length === 0, emptyText: 'Không tìm thấy thông tin bậc lương nào khớp với bộ lọc tìm kiếm.',
            count: <>Đang hiển thị <b className="text-slate-700">{filteredScales.length}</b> / {salaryScales.length} bậc lương</>,
            tableHead: (<><th className="py-2.5 px-3 w-10">{headCheck(filteredScales)}</th><th className={th}>Mã chi trả</th><th className={th}>Ngạch / đối tượng áp dụng</th><th className={th}>Bậc</th><th className={`${th} text-right`}>Lương cơ bản</th><th className={`${th} text-center`}>Tỉ lệ</th><th className={`${th} text-right`}>Lương hiệu suất</th><th className={`${th} text-right`}>Tổng (100%)</th><th className={th}>Ghi chú</th><th className={`${th} text-right`}>Thao tác</th></>),
            tableBody: filteredScales.map(item => (
              <tr key={item.id} data-testid={`hrdata-row-${item.id}`} className={rowCls(item.id)}>
                <td className="py-2.5 px-3">{rowCheck(item.id)}</td>
                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{item.id}</td>
                <td className="py-2.5 px-3"><div className="font-bold text-slate-900">{item.groupName}</div><div className="text-[11px] text-slate-500"><span className="font-mono">{item.groupCode}</span>{item.groupDesc ? ` · ${item.groupDesc}` : ''}</div></td>
                <td className="py-2.5 px-3"><span className={`${PILL} bg-sky-50 text-sky-700 border-sky-200 font-mono`}>{item.level}</span> <span className="text-slate-700">{item.levelName}</span></td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-800">{money(item.baseSalary)}</td>
                <td className="py-2.5 px-3 text-center"><span className={`${PILL} bg-amber-50 text-amber-700 border-amber-200 font-mono`}>{item.allocationRate}%</span></td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-800">{money(item.performanceSalary)}</td>
                <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700">{money(item.totalSalary)}</td>
                <td className="py-2.5 px-3 text-[12px] text-slate-500 max-w-[200px] truncate" title={item.notes || ''}>{item.notes || '—'}</td>
                <td className="py-2.5 px-3">{actions(() => handleEditSalaryScaleClick(item), () => handleDeleteSalaryScale(item.id), 'bậc lương')}</td>
              </tr>)),
            cards: filteredScales.map(item => (
              <div key={item.id} data-testid={`hrdata-card-${item.id}`} className={`p-3.5 space-y-2 ${hrSelectedRows.has(item.id) ? 'bg-blue-50/60' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="pt-1">{rowCheck(item.id)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 text-sm">{item.groupName}</div>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap"><span className={`${PILL} bg-sky-50 text-sky-700 border-sky-200 font-mono`}>{item.level}</span><span className="text-xs text-slate-600">{item.levelName}</span><span className="font-mono text-[11px] text-slate-400">{item.id}</span></div>
                  </div>
                  {actions(() => handleEditSalaryScaleClick(item), () => handleDeleteSalaryScale(item.id), 'bậc lương')}
                </div>
                <div className="grid grid-cols-3 gap-2 pl-7 text-center">
                  <div className="rounded-lg bg-slate-50 py-1.5"><div className="text-[10px] text-slate-500">Cơ bản</div><div className="text-xs font-bold font-mono text-slate-800">{(item.baseSalary || 0).toLocaleString('vi-VN')}</div></div>
                  <div className="rounded-lg bg-slate-50 py-1.5"><div className="text-[10px] text-slate-500">Hiệu suất ({item.allocationRate}%)</div><div className="text-xs font-bold font-mono text-slate-800">{(item.performanceSalary || 0).toLocaleString('vi-VN')}</div></div>
                  <div className="rounded-lg py-1.5" style={{ background: '#ecfdf5' }}><div className="text-[10px] text-emerald-700">Tổng 100%</div><div className="text-xs font-black font-mono text-emerald-700">{(item.totalSalary || 0).toLocaleString('vi-VN')}</div></div>
                </div>
              </div>)),
          })}
        </div>
      )}

      {/* ═══ 5. BHXH & THUẾ ═══ */}
      {activeHrDataSubTab === 'insurance' && (
        <div className="space-y-3" id="payroll_bhxh_view_pane">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" data-testid="hrdata-ins-tiles">
            {([
              ['Đã có sổ BHXH', `${insStats.withBookCount}/${insStats.total}`, '#047857', `${insStats.total > 0 ? ((insStats.withBookCount / insStats.total) * 100).toFixed(1) : 0}% nhân sự`],
              ['Lương nền đóng BH', money(insStats.totalSalary), '#0f766e', 'Tổng mức lương nền của người đã có sổ'],
              ['Trích đóng / tháng', money(Math.round(insStats.totalPayment)), '#0369a1', 'Trừ trực tiếp từ thu nhập'],
              ['Chưa đăng ký sổ', `${insStats.withoutBookCount}`, '#be123c', 'nhân viên'],
            ] as Array<[string, string, string, string]>).map(([label, v, color, sub]) => (
              <div key={label} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 min-w-0">
                <div className="text-[11px] text-slate-500 font-bold">{label}</div>
                <div className="text-lg font-black mt-0.5 truncate" style={{ color }}>{v}</div>
                <div className="text-[11px] text-slate-400 truncate">{sub}</div>
              </div>))}
          </div>
          {toolbar({ search: insSearchText, setSearch: setInsSearchText, placeholder: 'Tìm mã NV, tên, số sổ BHXH…', onExport: handleExportInsurance, exportTitle: 'Xuất Excel BHXH & Thuế', fileRef: insuranceFileRef, onImport: handleImportInsurance, addLabel: 'Đăng ký nhanh', onAdd: handleBatchGenerateBHXH,
            extra: (<>
              <select value={insDeptFilter} onChange={(e) => setInsDeptFilter(e.target.value)} aria-label="Bộ phận" data-testid="hrdata-ins-dept" className={`${inputCls} cursor-pointer font-bold`}>
                <option value="all">Tất cả phòng ban</option>
                {departments.map((dept: any) => <option key={dept} value={dept}>{dept}</option>)}
              </select>
              <select value={insBookFilter} onChange={(e) => setInsBookFilter(e.target.value)} aria-label="Sổ BH" data-testid="hrdata-ins-book" className={`${inputCls} cursor-pointer font-bold`}>
                <option value="all">Toàn bộ hồ sơ</option>
                <option value="has_book">Đã cấp sổ BHXH</option>
                <option value="no_book">Chưa đăng ký sổ</option>
              </select></>) })}
          {bulkBar}
          {(() => {
            const bookPill = (emp: any) => emp.bhxhBookNo && emp.bhxhBookNo.trim() !== ''
              ? <span className={`${PILL} bg-emerald-50 text-emerald-700 border-emerald-200 font-mono`}>{emp.bhxhBookNo}</span>
              : <span className={`${PILL} bg-rose-50 text-rose-700 border-rose-200`}>Chưa có sổ</span>;
            const calc = (emp: any) => { const sal = insSalaryOf(emp); const rate = Number(emp.bhxhRate) || 10.5; return { sal, rate, pay: (sal * rate) / 100, relief: Number(emp.taxPersonalRelief) || 15500000, dep: Number(emp.dependentCount) || 0 }; };
            return shell({
              minW: 'min-w-[1000px]',
              empty: filteredIns.length === 0, emptyText: 'Không tìm thấy nhân sự phù hợp với điều kiện tìm kiếm.',
              count: <>Danh sách BHXH & giảm trừ thuế TNCN: <b className="text-slate-700">{filteredIns.length}</b> nhân sự · Mức đóng mặc định 10,5% (BHXH 8% + BHYT 1,5% + BHTN 1%)</>,
              tableHead: (<><th className="py-2.5 px-3 w-10">{headCheck(filteredIns)}</th><th className={th}>Nhân viên</th><th className={th}>Bộ phận / chức vụ</th><th className={th}>Số sổ BHXH</th><th className={`${th} text-right`}>Mức đóng</th><th className={`${th} text-center`}>Tỷ lệ</th><th className={`${th} text-right`}>Tiền trích</th><th className={th}>Hiệu lực</th><th className={`${th} text-right`}>Giảm trừ bản thân</th><th className={`${th} text-center`}>NPT</th><th className={`${th} text-right`}>Thao tác</th></>),
              tableBody: filteredIns.map((emp: any) => { const c = calc(emp); return (
                <tr key={emp.id} data-testid={`hrdata-row-${emp.id}`} className={rowCls(emp.id)}>
                  <td className="py-2.5 px-3">{rowCheck(emp.id)}</td>
                  <td className="py-2.5 px-3"><div className="font-bold text-slate-900">{emp.name}</div><div className="font-mono text-[11px] text-slate-400">{emp.id}</div></td>
                  <td className="py-2.5 px-3"><div className="text-slate-700">{emp.department}</div><div className="text-[11px] text-slate-500">{emp.position}</div></td>
                  <td className="py-2.5 px-3">{bookPill(emp)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-800">{money(c.sal)}</td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-sky-700">{c.rate}%</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-700">{money(Math.round(c.pay))}</td>
                  <td className="py-2.5 px-3 font-mono text-[12px] text-slate-500">{emp.bhxhDate || '2026-04-01'}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">{money(c.relief)}</td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold">{c.dep}</td>
                  <td className="py-2.5 px-3 text-right"><button type="button" onClick={() => handleOpenEditIns(emp)} data-testid={`hrdata-ins-edit-${emp.id}`} className="h-8 px-3 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1"><Sliders className="w-3.5 h-3.5" />Thiết lập</button></td>
                </tr>); }),
              cards: filteredIns.map((emp: any) => { const c = calc(emp); return (
                <div key={emp.id} data-testid={`hrdata-card-${emp.id}`} className={`p-3.5 space-y-2 ${hrSelectedRows.has(emp.id) ? 'bg-blue-50/60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="pt-1">{rowCheck(emp.id)}</div>
                    <div className="flex-1 min-w-0"><div className="font-bold text-slate-900 text-sm">{emp.name} <span className="font-mono text-[11px] text-slate-400 font-normal">{emp.id}</span></div><div className="text-[11px] text-slate-500">{emp.position} · {emp.department}</div></div>
                    {bookPill(emp)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 pl-7 text-center">
                    <div className="rounded-lg bg-slate-50 py-1.5"><div className="text-[10px] text-slate-500">Mức đóng</div><div className="text-xs font-bold font-mono text-slate-800">{c.sal.toLocaleString('vi-VN')}</div></div>
                    <div className="rounded-lg bg-slate-50 py-1.5"><div className="text-[10px] text-slate-500">Trích ({c.rate}%)</div><div className="text-xs font-bold font-mono text-teal-700">{Math.round(c.pay).toLocaleString('vi-VN')}</div></div>
                    <div className="rounded-lg bg-slate-50 py-1.5"><div className="text-[10px] text-slate-500">Người PT</div><div className="text-xs font-bold font-mono text-slate-800">{c.dep}</div></div>
                  </div>
                  <div className="pl-7"><button type="button" onClick={() => handleOpenEditIns(emp)} className="h-8 px-3 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700 cursor-pointer inline-flex items-center gap-1"><Sliders className="w-3.5 h-3.5" />Thiết lập</button></div>
                </div>); }),
            });
          })()}
        </div>
      )}

      {/* ═══ 6. ĐỊNH MỨC CÔNG TÁC PHÍ ═══ */}
      {activeHrDataSubTab === 'travel_norms' && (
        <div className="space-y-3" id="travel_allowance_subpanel">
          {toolbar({ search: travelNormSearch, setSearch: setTravelNormSearch, placeholder: 'Tìm định mức…', onExport: handleExportTravelNorms, exportTitle: 'Xuất Excel định mức công tác phí', fileRef: travelNormFileRef, onImport: handleImportTravelNorms, addLabel: 'Thêm định mức', onAdd: handleAddTravelNormClick })}
          {bulkBar}
          {shell({
            empty: filteredNorms.length === 0, emptyText: 'Không tìm thấy định mức công tác phí nào phù hợp với từ khóa tìm kiếm.',
            count: <>Tổng cộng <b className="text-slate-700">{travelNorms.length}</b> định mức{filteredNorms.length !== travelNorms.length && <> · đang hiển thị {filteredNorms.length}</>}</>,
            tableHead: (<><th className="py-2.5 px-3 w-10">{headCheck(filteredNorms)}</th><th className={th}>Mã CTP</th><th className={th}>Nội dung</th><th className={`${th} text-right`}>Đơn giá</th><th className={`${th} text-right`}>Thao tác</th></>),
            tableBody: filteredNorms.map(norm => (
              <tr key={norm.id} data-testid={`hrdata-row-${norm.id}`} className={rowCls(norm.id)}>
                <td className="py-2.5 px-3">{rowCheck(norm.id)}</td>
                <td className="py-2.5 px-3">{norm.code ? <span className={`${PILL} bg-orange-50 text-orange-700 border-orange-200 font-mono`}>{norm.code}</span> : '—'}</td>
                <td className="py-2.5 px-3 font-bold text-slate-900">{norm.content}{norm.notes ? <div className="text-[11px] text-slate-500 font-normal">{norm.notes}</div> : null}</td>
                <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{money(norm.unitPrice)}</td>
                <td className="py-2.5 px-3">{actions(() => handleEditTravelNormClick(norm), () => handleDeleteTravelNorm(norm.id), 'định mức')}</td>
              </tr>)),
            cards: filteredNorms.map(norm => (
              <div key={norm.id} data-testid={`hrdata-card-${norm.id}`} className={`p-3.5 flex items-start gap-3 ${hrSelectedRows.has(norm.id) ? 'bg-blue-50/60' : ''}`}>
                <div className="pt-1">{rowCheck(norm.id)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 text-sm">{norm.content}</div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">{norm.code && <span className={`${PILL} bg-orange-50 text-orange-700 border-orange-200 font-mono`}>{norm.code}</span>}<span className="font-mono font-bold text-emerald-700 text-sm">{money(norm.unitPrice)}</span></div>
                  {norm.notes && <div className="text-[11px] text-slate-500 mt-0.5">{norm.notes}</div>}
                </div>
                {actions(() => handleEditTravelNormClick(norm), () => handleDeleteTravelNorm(norm.id), 'định mức')}
              </div>)),
          })}
        </div>
      )}
    </div>
  );
}
