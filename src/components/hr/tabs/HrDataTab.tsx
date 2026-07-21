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
  CheckCircle,
  DollarSign,
  Info,
  Sliders,
  Download,
  Upload,
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
          const wb = XLSX.read(ev.target?.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
          resolve(rows);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Không thể đọc file'));
      reader.readAsBinaryString(file);
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

  return (
              <div className="space-y-4 font-sans" id="hr_data_tab_content">
                {/* Internal subtab navigation — underline-tab style */}
                <div className="bg-white border-b border-slate-200 mb-2 rounded-t-lg">
                  <ul className="flex flex-nowrap md:flex-wrap items-center gap-1 -mb-px text-sm font-medium overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <li>
                      <button
                        type="button"
                        onClick={() => setActiveHrDataSubTab('holidays')}
                        aria-current={activeHrDataSubTab === 'holidays' ? 'page' : undefined}
                        className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer text-xs font-bold ${activeHrDataSubTab === 'holidays' ? 'text-amber-600 border-amber-500' : 'text-slate-600 hover:text-amber-600 hover:border-slate-300'}`}
                        id="holiday_tab_trigger"
                      >
                        <Calendar className={`w-4 h-4 me-2 ${activeHrDataSubTab === 'holidays' ? 'text-amber-600' : 'text-slate-400 group-hover:text-amber-600'}`} />
                        <span>Ngày nghỉ lễ</span>
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => setActiveHrDataSubTab('coefficients')}
                        aria-current={activeHrDataSubTab === 'coefficients' ? 'page' : undefined}
                        className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer text-xs font-bold ${activeHrDataSubTab === 'coefficients' ? 'text-amber-600 border-amber-500' : 'text-slate-600 hover:text-amber-600 hover:border-slate-300'}`}
                        id="coefficient_tab_trigger"
                      >
                        <Percent className={`w-4 h-4 me-2 ${activeHrDataSubTab === 'coefficients' ? 'text-amber-600' : 'text-slate-400 group-hover:text-amber-600'}`} />
                        <span>Hệ Số Chấm Công</span>
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => setActiveHrDataSubTab('criteria')}
                        aria-current={activeHrDataSubTab === 'criteria' ? 'page' : undefined}
                        className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer text-xs font-bold ${activeHrDataSubTab === 'criteria' ? 'text-amber-600 border-amber-500' : 'text-slate-600 hover:text-amber-600 hover:border-slate-300'}`}
                        id="criteria_tab_trigger"
                      >
                        <Building className={`w-4 h-4 me-2 ${activeHrDataSubTab === 'criteria' ? 'text-amber-600' : 'text-slate-400 group-hover:text-amber-600'}`} />
                        <span>🎯 Tiêu Chí Hiệu Suất</span>
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => setActiveHrDataSubTab('salary_scales')}
                        aria-current={activeHrDataSubTab === 'salary_scales' ? 'page' : undefined}
                        className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer text-xs font-bold ${activeHrDataSubTab === 'salary_scales' ? 'text-amber-600 border-amber-500' : 'text-slate-600 hover:text-amber-600 hover:border-slate-300'}`}
                        id="salary_scales_tab_trigger"
                      >
                        <Award className={`w-4 h-4 me-2 ${activeHrDataSubTab === 'salary_scales' ? 'text-amber-600' : 'text-slate-400 group-hover:text-amber-600'}`} />
                        <span>📈 Hệ Thống Bậc Lương</span>
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => setActiveHrDataSubTab('insurance')}
                        aria-current={activeHrDataSubTab === 'insurance' ? 'page' : undefined}
                        className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer text-xs font-bold ${activeHrDataSubTab === 'insurance' ? 'text-amber-600 border-amber-500' : 'text-slate-600 hover:text-amber-600 hover:border-slate-300'}`}
                        id="insurance_tab_trigger"
                      >
                        <FileSpreadsheet className={`w-4 h-4 me-2 ${activeHrDataSubTab === 'insurance' ? 'text-amber-600' : 'text-slate-400 group-hover:text-amber-600'}`} />
                        <span>🛡️ BHXH & Thuế</span>
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => setActiveHrDataSubTab('travel_norms')}
                        aria-current={activeHrDataSubTab === 'travel_norms' ? 'page' : undefined}
                        className={`group inline-flex items-center justify-center px-4 py-3 border-b border-transparent rounded-t-lg transition-all whitespace-nowrap cursor-pointer text-xs font-bold ${activeHrDataSubTab === 'travel_norms' ? 'text-amber-600 border-amber-500' : 'text-slate-600 hover:text-amber-600 hover:border-slate-300'}`}
                        id="travel_norms_tab_trigger"
                      >
                        <MapPin className={`w-4 h-4 me-2 ${activeHrDataSubTab === 'travel_norms' ? 'text-amber-600' : 'text-slate-400 group-hover:text-amber-600'}`} />
                        <span>💼 Định mức công tác phí</span>
                      </button>
                    </li>
                  </ul>
                </div>

                {activeHrDataSubTab === 'holidays' && (
                  <>
                    {/* Filter and Addition controls */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
                      <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Tìm kiếm dịp lễ, ngày..."
                          value={holidaySearchQuery}
                          onChange={(e) => setHolidaySearchQuery(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-amber-500 transition-colors"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleExportHolidays}
                          className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Xuất Excel ngày nghỉ lễ"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Xuất Excel</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => holidaysFileRef.current?.click()}
                          className="bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Nhập Excel ngày nghỉ lễ"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Nhập Excel</span>
                        </button>
                        <input
                          ref={holidaysFileRef}
                          type="file"
                          accept=".xlsx,.xls"
                          className="hidden"
                          onChange={handleImportHolidays}
                        />
                        <button
                          onClick={() => setShowHolidayModal(true)}
                          className="bg-amber-600 hover:bg-amber-550 text-white font-bold text-xs px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
                          id="add_holiday_btn"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Thêm ngày nghỉ lễ</span>
                        </button>
                      </div>
                    </div>

                    {/* Holidays list table */}
                    <div className="bg-slate-900/80 border border-slate-850 rounded-xl overflow-hidden shadow-xl">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-850/65 text-slate-350 border-b border-slate-800 uppercase tracking-wider font-extrabold text-[10px]">
                              <th className="py-3 px-2 w-10 text-center">
                                <input
                                  type="checkbox"
                                  checked={hrSelectAll && (() => {
                                    const filtered = holidays.filter(h => {
                                      const query = holidaySearchQuery.toLowerCase();
                                      return h.name.toLowerCase().includes(query) || h.date.includes(query) || h.id.toLowerCase().includes(query);
                                    });
                                    return filtered.length > 0 && filtered.every(h => hrSelectedRows.has(h.id));
                                  })()}
                                  onChange={(e) => {
                                    const filtered = holidays.filter(h => {
                                      const query = holidaySearchQuery.toLowerCase();
                                      return h.name.toLowerCase().includes(query) || h.date.includes(query) || h.id.toLowerCase().includes(query);
                                    });
                                    handleHrSelectAll(e.target.checked, filtered);
                                  }}
                                  className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                                />
                              </th>
                              <th className="py-3 px-4">Mã NL (khóa chính tự sinh)</th>
                              <th className="py-3 px-4">Ngày nghỉ</th>
                              <th className="py-3 px-4">Tên dịp lễ</th>
                              <th className="py-4 px-4 text-center">Hành động</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 text-slate-300 font-medium">
                            {holidays
                              .filter(h => {
                                const query = holidaySearchQuery.toLowerCase();
                                return h.name.toLowerCase().includes(query) || h.date.includes(query) || h.id.toLowerCase().includes(query);
                              })
                              .map((item) => (
                                <tr key={item.id} className={`hover:bg-slate-800/30 transition-colors ${hrSelectedRows.has(item.id) ? 'bg-amber-500/10' : ''}`}>
                                  <td className="py-3 px-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={hrSelectedRows.has(item.id)}
                                      onChange={(e) => { e.stopPropagation(); handleHrRowSelect(item.id, e.target.checked); }}
                                      className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                                    />
                                  </td>
                                  <td className="py-3 px-4 font-mono font-bold text-amber-500">{item.id}</td>
                                  <td className="py-3 px-4 text-slate-205 font-mono font-bold">{item.date}</td>
                                  <td className="py-3 px-4 text-white text-[11.5px]">{item.name}</td>
                                  <td className="py-3 px-4 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteHoliday(item.id)}
                                      className="text-slate-500 hover:text-red-400 p-1.5 rounded transition-colors cursor-pointer"
                                      title="Xóa ngày nghỉ"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            {holidays.filter(h => {
                              const query = holidaySearchQuery.toLowerCase();
                              return h.name.toLowerCase().includes(query) || h.date.includes(query) || h.id.toLowerCase().includes(query);
                            }).length === 0 && (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-slate-500 font-semibold italic">
                                  Không tìm thấy ngày nghỉ lễ nào khớp với bộ lọc.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="bg-slate-900 px-4 py-2.5 border-t border-slate-850 flex justify-between items-center text-[10.5px] text-slate-400">
                        <div className="flex items-center gap-3">
                          <span>Tổng cộng: <strong className="text-amber-500 font-mono font-bold">{holidays.length}</strong> ngày nghỉ lễ</span>
                          {hrSelectedRows.size > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-amber-500 font-bold">Đã chọn: {hrSelectedRows.size}</span>
                              <button
                                onClick={handleBulkDeleteHrData}
                                className="bg-rose-650 hover:bg-rose-600 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors text-[10px] flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" /> Xóa
                              </button>
                            </div>
                          )}
                        </div>
                        <span className="italic">Hoàng Long ERP • 2026 Calendar</span>
                      </div>
                    </div>
                  </>
                )}

                {activeHrDataSubTab === 'coefficients' && (
                  <>
                    {/* Filter and Addition controls */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
                      <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Tìm kiếm nội dung chấm công, mã HSCC..."
                          value={coefSearchQuery}
                          onChange={(e) => setCoefSearchQuery(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-amber-500 transition-colors"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleExportCoefficients}
                          className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Xuất Excel hệ số chấm công"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Xuất Excel</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => coefFileRef.current?.click()}
                          className="bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Nhập Excel hệ số chấm công"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Nhập Excel</span>
                        </button>
                        <input
                          ref={coefFileRef}
                          type="file"
                          accept=".xlsx,.xls"
                          className="hidden"
                          onChange={handleImportCoefficients}
                        />
                        <button
                          onClick={() => setShowCoefModal(true)}
                          className="bg-amber-600 hover:bg-amber-550 text-white font-bold text-xs px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
                          id="add_coef_btn"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Thêm hệ số chấm công</span>
                        </button>
                      </div>
                    </div>

                    {/* Coefficients list table */}
                    <div className="bg-slate-900/80 border border-slate-850 rounded-xl overflow-hidden shadow-xl">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-850/65 text-slate-350 border-b border-slate-800 uppercase tracking-wider font-extrabold text-[10px]">
                              <th className="py-3 px-2 w-10 text-center">
                                <input
                                  type="checkbox"
                                  checked={hrSelectAll && (() => {
                                    const filtered = leaveCoefficients.filter(c => {
                                      const query = coefSearchQuery.toLowerCase();
                                      return c.type.toLowerCase().includes(query) || c.id.toLowerCase().includes(query);
                                    });
                                    return filtered.length > 0 && filtered.every(c => hrSelectedRows.has(c.id));
                                  })()}
                                  onChange={(e) => {
                                    const filtered = leaveCoefficients.filter(c => {
                                      const query = coefSearchQuery.toLowerCase();
                                      return c.type.toLowerCase().includes(query) || c.id.toLowerCase().includes(query);
                                    });
                                    handleHrSelectAll(e.target.checked, filtered);
                                  }}
                                  className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                                />
                              </th>
                              <th className="py-3 px-4">Mã HSCC (Khóa chính)</th>
                              <th className="py-3 px-4">Nội Dung Chấm Công</th>
                              <th className="py-3 px-4">Chấm tự động (kiểu boolean)</th>
                              <th className="py-3 px-4">Hệ Số</th>
                              <th className="py-3 px-4 text-center">Hành động</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 text-slate-300 font-medium font-sans">
                            {leaveCoefficients
                              .filter(c => {
                                const query = coefSearchQuery.toLowerCase();
                                return c.type.toLowerCase().includes(query) || c.id.toLowerCase().includes(query);
                              })
                              .map((item) => (
                                <tr key={item.id} className={`hover:bg-slate-800/30 transition-colors ${hrSelectedRows.has(item.id) ? 'bg-amber-500/10' : ''}`}>
                                  <td className="py-3 px-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={hrSelectedRows.has(item.id)}
                                      onChange={(e) => { e.stopPropagation(); handleHrRowSelect(item.id, e.target.checked); }}
                                      className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                                    />
                                  </td>
                                  <td className="py-3 px-4 font-mono font-bold text-amber-500">
                                    <span className="bg-slate-850 border border-slate-800 text-amber-500 font-extrabold rounded-md px-2 py-0.5 text-[11px]">
                                      {item.id}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-white text-[11.5px]">{item.type}</td>
                                  <td className="py-3 px-4">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleCoefficientAuto(item.id)}
                                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                        item.isAuto ? 'bg-emerald-500' : 'bg-slate-700'
                                      }`}
                                    >
                                      <span
                                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                          item.isAuto ? 'translate-x-4' : 'translate-x-0'
                                        }`}
                                      />
                                    </button>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        step="0.1"
                                        className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-center font-mono text-amber-500 font-extrabold text-xs focus:outline-none focus:border-amber-500 transition-colors"
                                        value={item.coefficient}
                                        onChange={(e) => {
                                          const val = Number(e.target.value);
                                          setLeaveCoefficients(prev => prev.map(c => c.id === item.id ? { ...c, coefficient: val } : c));
                                        }}
                                      />
                                      <span className="text-[9px] text-slate-400 font-bold uppercase">hệ số</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCoefficient(item.id)}
                                      className="text-slate-500 hover:text-red-400 p-1.5 rounded transition-colors cursor-pointer"
                                      title="Xóa hệ số chấm công"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            {leaveCoefficients.filter(c => {
                              const query = coefSearchQuery.toLowerCase();
                              return c.type.toLowerCase().includes(query) || c.id.toLowerCase().includes(query);
                            }).length === 0 && (
                              <tr>
                                <td colSpan={6} className="py-8 text-center text-slate-500 font-semibold italic">
                                  Không tìm thấy hệ số chấm công nào khớp với bộ lọc.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="bg-slate-900 px-4 py-2.5 border-t border-slate-850 flex justify-between items-center text-[10.5px] text-slate-400">
                        <div className="flex items-center gap-3">
                          <span>Tổng cộng: <strong className="text-amber-500 font-mono font-bold">{leaveCoefficients.length}</strong> loại hệ số chấm công</span>
                          {hrSelectedRows.size > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-amber-500 font-bold">Đã chọn: {hrSelectedRows.size}</span>
                              <button
                                onClick={handleBulkDeleteHrData}
                                className="bg-rose-650 hover:bg-rose-600 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors text-[10px] flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" /> Xóa
                              </button>
                            </div>
                          )}
                        </div>
                        <span className="italic">Hoàng Long ERP • Attendance Coefficients</span>
                      </div>
                    </div>
                  </>
                )}

                {activeHrDataSubTab === 'criteria' && (
                  <div className="space-y-4" id="criteria_workspace">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
                      <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Tìm nhanh tiêu chí đánh giá hiệu suất..."
                          value={criteriaSearchQuery}
                          onChange={(e) => setCriteriaSearchQuery(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-amber-500 transition-colors"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleExportCriteria}
                          className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Xuất Excel tiêu chí hiệu suất"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Xuất Excel</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => criteriaFileRef.current?.click()}
                          className="bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Nhập Excel tiêu chí hiệu suất"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Nhập Excel</span>
                        </button>
                        <input
                          ref={criteriaFileRef}
                          type="file"
                          accept=".xlsx,.xls"
                          className="hidden"
                          onChange={handleImportCriteria}
                        />
                        <button
                          onClick={() => {
                            setEditingCritId(null);
                            setEditingCritDeptId(null);
                            setNewCritContent('');
                            setNewCritCategory('readiness');
                            setShowCriteriaModal(true);
                          }}
                          className="bg-amber-600 hover:bg-amber-550 text-white font-bold text-xs px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
                          id="add_criterion_btn"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Thêm tiêu chí đánh giá</span>
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                      <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                          <h5 className="font-extrabold text-sm text-amber-500 uppercase tracking-wider font-sans">Bảng Toàn Bộ Tiêu Chí Đánh Giá Hiệu Suất</h5>
                          <p className="text-[10px] text-slate-400 mt-0.5">Sử dụng để đánh giá hiệu suất, thưởng phạt hoặc xếp loại kpi hằng kỳ</p>
                        </div>
                        <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded font-mono font-bold">
                          Đang hiển thị: {
                            ((departmentCriteria[0]?.criteria || []).filter(crit => {
                              const q = removeVietnameseTones(criteriaSearchQuery);
                              return removeVietnameseTones(crit.content).includes(q) ||
                                     removeVietnameseTones(crit.id).includes(q);
                            })).length
                          } tiêu chí
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-sans">
                          <thead>
                            <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 font-extrabold text-[10px] uppercase tracking-wider">
                              <th className="p-3.5 w-10 text-center">
                                <input
                                  type="checkbox"
                                  checked={hrSelectAll && (() => {
                                    const unfiltered = departmentCriteria[0]?.criteria || [];
                                    const filtered = unfiltered.filter(crit => {
                                      const q = removeVietnameseTones(criteriaSearchQuery);
                                      return removeVietnameseTones(crit.content).includes(q) ||
                                             removeVietnameseTones(crit.id).includes(q);
                                    });
                                    return filtered.length > 0 && filtered.every(c => hrSelectedRows.has(c.id));
                                  })()}
                                  onChange={(e) => {
                                    const unfiltered = departmentCriteria[0]?.criteria || [];
                                    const filtered = unfiltered.filter(crit => {
                                      const q = removeVietnameseTones(criteriaSearchQuery);
                                      return removeVietnameseTones(crit.content).includes(q) ||
                                             removeVietnameseTones(crit.id).includes(q);
                                    });
                                    handleHrSelectAll(e.target.checked, filtered);
                                  }}
                                  className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                                />
                              </th>
                              <th className="p-3.5 w-12 text-center">STT</th>
                              <th className="p-3.5 w-32">Mã Tiêu Chí</th>
                              <th className="p-3.5 w-44">Phân Nhóm</th>
                              <th className="p-3.5">Nội Dung Tiêu Chí Đánh Giá</th>
                              <th className="p-3.5 w-32 text-center">Thao Tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 font-sans">
                            {(() => {
                              const unfiltered = departmentCriteria[0]?.criteria || [];
                              const filtered = unfiltered.filter(crit => {
                                const q = removeVietnameseTones(criteriaSearchQuery);
                                return removeVietnameseTones(crit.content).includes(q) ||
                                       removeVietnameseTones(crit.id).includes(q);
                              });

                              if (filtered.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                                      Không tìm thấy tiêu chí nào khớp với từ khóa tìm kiếm.
                                    </td>
                                  </tr>
                                );
                              }

                              return filtered.map((crit, idx) => {
                                let catLabel = "Tác phong & Chuyên cần";
                                let catBg = "bg-purple-950/40 text-purple-400 border-purple-500/20";
                                if (crit.category === 'progress') {
                                  catLabel = "Hiệu suất & Tiến độ";
                                  catBg = "bg-sky-900/40 text-sky-400 border-sky-500/20";
                                } else if (crit.category === 'reporting') {
                                  catLabel = "Báo cáo & Đạo đức";
                                  catBg = "bg-emerald-950/40 text-emerald-400 border-emerald-500/20";
                                }

                                return (
                                  <tr key={crit.id} className={`hover:bg-slate-850/20 transition-all font-sans ${hrSelectedRows.has(crit.id) ? 'bg-amber-500/10' : ''}`}>
                                    <td className="p-3 text-center">
                                      <input
                                        type="checkbox"
                                        checked={hrSelectedRows.has(crit.id)}
                                        onChange={(e) => { e.stopPropagation(); handleHrRowSelect(crit.id, e.target.checked); }}
                                        className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                                      />
                                    </td>
                                    <td className="p-3 text-center text-slate-500 font-mono font-bold border-r border-slate-800/40">{idx + 1}</td>
                                    <td className="p-3 text-slate-400 font-mono font-bold">{crit.id}</td>
                                    <td className="p-3">
                                      <span className={`text-[10px] px-2 py-0.5 font-extrabold rounded-md uppercase tracking-wide border ${catBg}`}>
                                        {catLabel}
                                      </span>
                                    </td>
                                    <td className="p-3 text-white font-extrabold text-[12px]">{crit.content}</td>
                                    <td className="p-3 text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleEditCriteriaTrigger('dept_all', crit)}
                                          className="bg-slate-850 hover:bg-amber-600 hover:text-white text-slate-350 font-bold px-2 py-1 rounded text-[10px] flex items-center gap-1 transition-all cursor-pointer border border-slate-750"
                                        >
                                          Cập nhật
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteCriteria('dept_all', crit.id)}
                                          className="hover:bg-rose-955/45 hover:text-rose-450 text-slate-500 font-bold p-1 rounded transition-colors cursor-pointer"
                                          title="Xóa tiêu chí"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {activeHrDataSubTab === 'salary_scales' && (
                  <div className="space-y-4" id="salary_scales_workspace">
                    {/* Filter and configuration header */}
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
                      <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                        <div className="relative w-full sm:w-60">
                          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                          <input
                            type="text"
                            placeholder="Tìm mã, ngạch, bậc..."
                            value={salaryScalesSearch}
                            onChange={(e) => setSalaryScalesSearch(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-amber-500 transition-colors"
                          />
                        </div>

                        <select
                          value={selectedGroupFilter}
                          onChange={(e) => setSelectedGroupFilter(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500 transition-colors cursor-pointer font-bold"
                        >
                          <option value="all">📍 Tất cả các ngạch</option>
                          <option value="QLDH">I. QUẢN LÝ - ĐIỀU HÀNH (QLDH)</option>
                          <option value="KTTC">II. KỸ THUẬT - THI CÔNG (KTTC)</option>
                          <option value="HCKT">III. HÀNH CHÍNH - NHÂN SỰ (HCKT)</option>
                        </select>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={handleExportSalaryScales}
                          className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Xuất Excel bảng lương"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Xuất Excel</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => salaryScaleFileRef.current?.click()}
                          className="bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Nhập Excel bảng lương"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Nhập Excel</span>
                        </button>
                        <input
                          ref={salaryScaleFileRef}
                          type="file"
                          accept=".xlsx,.xls"
                          className="hidden"
                          onChange={handleImportSalaryScales}
                        />
                        <button
                          type="button"
                          onClick={handleResetSalaryScales}
                          className="bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold text-xs px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer border border-slate-755"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-teal-400" />
                          <span>Khôi phục mẫu Excel</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleAddNewSalaryScaleClick}
                          className="bg-amber-600 hover:bg-amber-550 text-white font-bold text-xs px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg animate-pulse"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Thêm Bậc Lương mới</span>
                        </button>
                      </div>
                    </div>


                    {/* Main Salary Scales List Table */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                      <div className="p-4 border-b border-slate-850 bg-slate-950/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                          <h5 className="font-extrabold text-sm text-amber-400 uppercase tracking-wider font-sans">Bảng Tra Cứu Hệ Thống Bậc Lương</h5>
                          <p className="text-[10px] text-slate-400 mt-0.5">Chi tiết bảng ngạch, hệ số, tỷ lệ chia lương cơ bản & hiệu suất đạt 100%</p>
                        </div>
                        <span className="text-[10px] text-slate-350 bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded font-mono font-bold">
                          Đang tìm thấy: <strong className="text-amber-500">{
                            salaryScales.filter(item => {
                              const q = salaryScalesSearch.toLowerCase();
                              const groupMatch = selectedGroupFilter === 'all' || item.groupCode === selectedGroupFilter;
                              const textMatch = item.id.toLowerCase().includes(q) ||
                                              item.levelName.toLowerCase().includes(q) ||
                                              item.groupName.toLowerCase().includes(q);
                              return groupMatch && textMatch;
                            }).length
                          }</strong> / {salaryScales.length} bậc lương
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-sans">
                          <thead>
                            <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-350 font-extrabold text-[10px] uppercase tracking-wider">
                              <th className="py-3 px-2 text-center w-10 border-r border-slate-850">
                                <input
                                  type="checkbox"
                                  checked={hrSelectAll && (() => {
                                    const filtered = salaryScales.filter(item => {
                                      const q = salaryScalesSearch.toLowerCase();
                                      const groupMatch = selectedGroupFilter === 'all' || item.groupCode === selectedGroupFilter;
                                      const textMatch = item.id.toLowerCase().includes(q) ||
                                                      item.levelName.toLowerCase().includes(q) ||
                                                      item.groupName.toLowerCase().includes(q);
                                      return groupMatch && textMatch;
                                    });
                                    return filtered.length > 0 && filtered.every(item => hrSelectedRows.has(item.id));
                                  })()}
                                  onChange={(e) => {
                                    const filtered = salaryScales.filter(item => {
                                      const q = salaryScalesSearch.toLowerCase();
                                      const groupMatch = selectedGroupFilter === 'all' || item.groupCode === selectedGroupFilter;
                                      const textMatch = item.id.toLowerCase().includes(q) ||
                                                      item.levelName.toLowerCase().includes(q) ||
                                                      item.groupName.toLowerCase().includes(q);
                                      return groupMatch && textMatch;
                                    });
                                    handleHrSelectAll(e.target.checked, filtered);
                                  }}
                                  className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                                />
                              </th>
                              <th className="py-3 px-3 text-center w-12 border-r border-slate-850">TT</th>
                              <th className="py-3 px-3 border-r border-slate-850">Mã Chi Trả</th>
                              <th className="py-3 px-3 border-r border-slate-850">Mã Ngạch</th>
                              <th className="py-3 px-4 border-r border-slate-850">Tên Ngạch / Đối tượng áp dụng</th>
                              <th className="py-3 px-3 border-r border-slate-850 text-center">Bậc</th>
                              <th className="py-3 px-3 border-r border-slate-850">Tên Bậc</th>
                              <th className="py-3 px-3 border-r border-slate-850 text-right">Lương Cơ Bản (LCB)</th>
                              <th className="py-3 px-3 border-r border-slate-850 text-center">Tỉ Lệ %</th>
                              <th className="py-3 px-3 border-r border-slate-850 text-right">Lương Hiệu Suất</th>
                              <th className="py-3 px-3 border-r border-slate-850 text-right text-emerald-400 bg-emerald-950/10">Tổng Lương (100%)</th>
                              <th className="py-3 px-3">Ghi chú</th>
                              <th className="py-3 px-3 text-center">Hành động</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 text-slate-300 font-medium">
                            {(() => {
                              // Let's filter first
                              const filtered = salaryScales.filter(item => {
                                const q = salaryScalesSearch.toLowerCase();
                                const groupMatch = selectedGroupFilter === 'all' || item.groupCode === selectedGroupFilter;
                                const textMatch = item.id.toLowerCase().includes(q) ||
                                                item.levelName.toLowerCase().includes(q) ||
                                                item.groupName.toLowerCase().includes(q);
                                return groupMatch && textMatch;
                              });

                              if (filtered.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={13} className="py-12 text-center text-slate-500 font-semibold italic">
                                      Không tìm thấy thông tin bậc lương nào khớp với bộ lọc tìm kiếm.
                                    </td>
                                  </tr>
                                );
                              }

                              // Render sorted or as inputted
                              let globalIndex = 0;
                              return filtered.map((item) => {
                                globalIndex++;
                                return (
                                  <tr key={item.id} className={`hover:bg-slate-800/35 transition-colors group ${hrSelectedRows.has(item.id) ? 'bg-amber-500/10' : ''}`}>
                                    <td className="py-3 px-2 text-center border-r border-slate-850">
                                      <input
                                        type="checkbox"
                                        checked={hrSelectedRows.has(item.id)}
                                        onChange={(e) => { e.stopPropagation(); handleHrRowSelect(item.id, e.target.checked); }}
                                        className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                                      />
                                    </td>
                                    <td className="py-3 px-3 text-center border-r border-slate-850 font-mono text-slate-400 text-[10.5px]">
                                      {globalIndex}
                                    </td>
                                    <td className="py-3 px-3 border-r border-slate-850 font-mono font-bold text-amber-500 text-[11px]">
                                      {item.id}
                                    </td>
                                    <td className="py-3 px-3 border-r border-slate-850 font-mono font-black text-slate-400 text-[10.5px]">
                                      {item.groupCode}
                                    </td>
                                    <td className="py-3 px-4 border-r border-slate-850">
                                      <div className="space-y-0.5">
                                        <div className="font-extrabold text-white text-[11px]">{item.groupName}</div>
                                        {item.groupDesc && (
                                          <div className="text-[9.5px] text-slate-400 line-clamp-1 group-hover:line-clamp-none transition-all">
                                            {item.groupDesc}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-3 border-r border-slate-850 text-center font-mono font-black text-blue-400 text-[11px]">
                                      {item.level}
                                    </td>
                                    <td className="py-3 px-3 border-r border-slate-850 text-white font-semibold text-[11px]">
                                      {item.levelName}
                                    </td>
                                    <td className="py-3 px-3 border-r border-slate-850 text-right font-mono font-bold text-slate-100 text-[11px]">
                                      {item.baseSalary.toLocaleString('vi-VN')} ₫
                                    </td>
                                    <td className="py-3 px-3 border-r border-slate-850 text-center font-mono">
                                      <span className="bg-slate-950/80 px-2 py-0.5 rounded text-[11px] border border-slate-800 text-amber-400 font-extrabold font-mono">
                                        {item.allocationRate}%
                                      </span>
                                    </td>
                                    <td className="py-3 px-3 border-r border-slate-850 text-right font-mono font-bold text-slate-300 text-[11px]">
                                      {item.performanceSalary.toLocaleString('vi-VN')} ₫
                                    </td>
                                    <td className="py-3 px-3 border-r border-slate-850 text-right font-mono font-black text-emerald-400 text-[11.5px] bg-emerald-950/10">
                                      {item.totalSalary.toLocaleString('vi-VN')} ₫
                                    </td>
                                    <td className="py-3 px-3 text-[10.5px] text-slate-400 italic">
                                      {item.notes || '-'}
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleEditSalaryScaleClick(item)}
                                          className="bg-slate-850 hover:bg-amber-600 hover:text-white text-slate-350 font-extrabold px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer border border-slate-750"
                                        >
                                          Sửa
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteSalaryScale(item.id)}
                                          className="hover:bg-rose-955/45 hover:text-rose-450 text-slate-500 font-bold p-1 rounded transition-colors cursor-pointer"
                                          title="Xóa ngạch bậc này"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>

                      <div className="bg-slate-950 px-4 py-3 border-t border-slate-850 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 gap-2">
                        <div className="flex items-center gap-3">
                          <span>Định dạng dữ liệu bảng bậc lương: <strong>Dữ liệu chuẩn hóa SQL • Chống sai lệch %</strong></span>
                          {hrSelectedRows.size > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-amber-500 font-bold">Đã chọn: {hrSelectedRows.size}</span>
                              <button
                                onClick={handleBulkDeleteHrData}
                                className="bg-rose-650 hover:bg-rose-600 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors text-[10px] flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" /> Xóa
                              </button>
                            </div>
                          )}
                        </div>
                        <span className="italic">Bản quyền của Hoàng Long ERP • Quản trị tài chính nhân sự</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeHrDataSubTab === 'insurance' && (() => {
              const filteredInsEmployees = employees.filter((emp: any) => {
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

              const insStats = (() => {
                const withBook = employees.filter((e: any) => e.bhxhBookNo && e.bhxhBookNo.trim() !== '');
                const withoutBook = employees.filter((e: any) => !e.bhxhBookNo || e.bhxhBookNo.trim() === '');
                const getInsSalary = (e: any) => Number(e.bhxhSalary) || (salaryScales.find((s: any) => s.id === e.salaryCode)?.baseSalary || 0);
                const totalSalary = withBook.reduce((sum: number, e: any) => sum + getInsSalary(e), 0);
                const totalPayment = withBook.reduce((sum: number, e: any) => {
                  const rate = Number(e.bhxhRate) || 10.5;
                  const sal = getInsSalary(e);
                  return sum + (sal * rate / 100);
                }, 0);

                return {
                  total: employees.length,
                  withBookCount: withBook.length,
                  withoutBookCount: withoutBook.length,
                  totalSalary,
                  totalPayment
                };
              })();

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
                      dependentCount: 0
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

              // Extract departments
              const departments = Array.from(new Set(employees.map((e: any) => e.department))).filter(Boolean);

              return (
                <div className="space-y-4 font-sans" id="payroll_bhxh_view_pane">

                  {/* Summary Cards Row */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                    <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-4 rounded-2xl border border-slate-800/80 shadow-md flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Đã có Số sổ BHXH</span>
                        <div className="text-xl font-black text-emerald-400 flex items-baseline gap-1.5">
                          {insStats.withBookCount}
                          <span className="text-slate-500 text-xs font-semibold">/ {insStats.total} NV</span>
                        </div>
                        <p className="text-[10px] text-slate-450 font-bold">
                          Tỷ lệ: {insStats.total > 0 ? ((insStats.withBookCount / insStats.total) * 100).toFixed(1) : 0}% nhân sự
                        </p>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-emerald-950/40 border border-emerald-550/30 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-emerald-450" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-4 rounded-2xl border border-slate-800/80 shadow-md flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Mức Thù Lao BHXH</span>
                        <div className="text-xl font-black text-teal-400">
                          {insStats.totalSalary.toLocaleString('vi-VN')} <span className="text-[10px] text-teal-500">đ</span>
                        </div>
                        <p className="text-[10px] text-slate-450 font-semibold italic">Tổng mức lương nền đóng bảo lưu</p>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-teal-950/40 border border-teal-500/20 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-teal-450" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-4 rounded-2xl border border-slate-800/80 shadow-md flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Tiền Trích Đóng (10.5%)</span>
                        <div className="text-xl font-black text-sky-400">
                          {Math.round(insStats.totalPayment).toLocaleString('vi-VN')} <span className="text-[10px] text-sky-500">đ/tháng</span>
                        </div>
                        <p className="text-[10px] text-sky-450/80 font-bold">Trừ trực tiếp từ thu nhập ròng</p>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-sky-950/40 border border-sky-550/30 flex items-center justify-center">
                        <Percent className="w-5 h-5 text-sky-400" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-4 rounded-2xl border border-slate-800/80 shadow-md flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Chưa Đăng Ký BHXH</span>
                        <div className="text-xl font-black text-rose-400 flex items-baseline gap-1.5">
                          {insStats.withoutBookCount}
                          <span className="text-slate-500 text-xs font-medium">nhân viên</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleBatchGenerateBHXH}
                          className="text-[9.5px] text-amber-500 hover:text-amber-450 underline font-bold transition-all text-left block cursor-pointer"
                        >
                          ⚡ Đăng ký tự động hàng loạt
                        </button>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-rose-955/20 border border-rose-500/20 flex items-center justify-center">
                        <Info className="w-5 h-5 text-rose-450 animate-pulse" />
                      </div>
                    </div>

                  </div>

                  {/* Filter controls row */}
                  <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800/80 flex flex-col md:flex-row gap-4 items-center justify-between">

                    {/* Search Input Box */}
                    <div className="relative w-full md:max-w-md">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={insSearchText}
                        onChange={(e) => setInsSearchText(e.target.value)}
                        placeholder="Tìm theo Mã NV, Tên NV, Số sổ BHXH..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-600 focus:outline-none rounded-xl text-xs text-white placeholder-slate-500 font-sans shadow-inner transition-all"
                      />
                    </div>

                    {/* Filter Select Boxes */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">

                      {/* Department Filter */}
                      <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
                        <span className="text-slate-500 text-[10px] font-bold uppercase select-none">BỘ PHẬN:</span>
                        <select
                          value={insDeptFilter}
                          onChange={(e) => setInsDeptFilter(e.target.value)}
                          className="bg-transparent text-xs text-white focus:outline-none cursor-pointer font-bold select-none pr-1"
                        >
                          <option value="all">Tất cả phòng ban</option>
                          {departments.map((dept: any) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </div>

                      {/* Code Status Filter */}
                      <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
                        <span className="text-slate-500 text-[10px] font-bold uppercase select-none">SỔ BH:</span>
                        <select
                          value={insBookFilter}
                          onChange={(e) => setInsBookFilter(e.target.value)}
                          className="bg-transparent text-xs text-white focus:outline-none cursor-pointer font-bold select-none pr-1"
                        >
                          <option value="all">Toàn bộ hồ sơ</option>
                          <option value="has_book">Đã cấp sổ BHXH</option>
                          <option value="no_book">Chưa đăng ký sổ</option>
                        </select>
                      </div>

                      {/* Export / Import Insurance */}
                      <button
                        type="button"
                        onClick={handleExportInsurance}
                        className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-extrabold px-3 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                        title="Xuất Excel BHXH & Thuế"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Xuất Excel</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => insuranceFileRef.current?.click()}
                        className="bg-blue-700 hover:bg-blue-600 text-white text-xs font-extrabold px-3 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                        title="Nhập Excel BHXH & Thuế"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Nhập Excel</span>
                      </button>
                      <input
                        ref={insuranceFileRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleImportInsurance}
                      />
                      {/* Export / Batch Action Button */}
                      <button
                        type="button"
                        onClick={handleBatchGenerateBHXH}
                        className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Đăng ký nhanh</span>
                      </button>

                    </div>

                  </div>

                  {/* Main Database Table Container */}
                  <div className="bg-slate-900 border border-slate-800/85 rounded-2xl shadow-xl overflow-hidden">

                    <div className="p-4 bg-slate-900/60 border-b border-slate-800/80 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-xs font-extrabold text-white">Danh sách BHXH & Thiết lập Giảm thuế TNCN ({filteredInsEmployees.length} nhân sự)</span>
                      </div>
                      <div className="text-[10px] text-slate-450 italic font-medium">Định dạng hiển thị: <strong>Lịch thanh toán đồng bộ</strong></div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left whitespace-nowrap">
                        <thead>
                          <tr className="bg-slate-950/70 border-b border-slate-800 text-[10px] text-slate-400 uppercase font-black tracking-wider">
                            <th className="p-3 text-center border-r border-slate-800/40 w-10 border-b border-slate-800">
                              <input
                                type="checkbox"
                                checked={hrSelectAll && (filteredInsEmployees.length > 0 && filteredInsEmployees.every(emp => hrSelectedRows.has(emp.id)))}
                                onChange={(e) => handleHrSelectAll(e.target.checked, filteredInsEmployees)}
                                className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                              />
                            </th>
                            <th className="p-3 text-center border-r border-slate-800/40 w-12 border-b border-slate-800">STT</th>
                            <th className="p-3 border-b border-slate-800">Mã NV</th>
                            <th className="p-3 border-b border-slate-800">Họ và Tên</th>
                            <th className="p-3 border-b border-slate-800">Bộ phận / Chức vụ</th>
                            <th className="p-3 text-center border-b border-slate-800">Số sổ BHXH</th>
                            <th className="p-3 text-right border-b border-slate-800">Mức đóng BH</th>
                            <th className="p-3 text-center border-b border-slate-800">Tỷ lệ đóng</th>
                            <th className="p-3 text-right border-b border-slate-800">Tiền trích đóng</th>
                            <th className="p-3 text-center border-b border-slate-800">Ngày hiệu lực</th>
                            <th className="p-3 text-right border-b border-slate-800">Thuế: Bản thân</th>
                            <th className="p-3 text-center border-b border-slate-800">Số người PT</th>
                            <th className="p-3 text-center w-24 border-b border-slate-800">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850/60">
                          {filteredInsEmployees.length === 0 ? (
                            <tr>
                              <td colSpan={13} className="p-10 text-center text-slate-500 font-medium italic text-xs font-sans">
                                ❌ Không tìm thấy nhân sự phù hợp với điều kiện tìm kiếm.
                              </td>
                            </tr>
                          ) : (
                            filteredInsEmployees.map((emp: any, idx: number) => {
                              const bxhSal = Number(emp.bhxhSalary) || (salaryScales.find((s: any) => s.id === emp.salaryCode)?.baseSalary || 0);
                              const rate = Number(emp.bhxhRate) || 10.5;
                              const monthlyDeduction = (bxhSal * rate) / 100;
                              const personalDeduction = Number(emp.taxPersonalRelief) || 15500000;
                              const depCount = Number(emp.dependentCount) || 0;

                              return (
                                <tr key={emp.id} className={`hover:bg-slate-850/20 transition-colors font-sans text-xs ${hrSelectedRows.has(emp.id) ? 'bg-amber-500/10' : ''}`}>
                                  <td className="p-3 text-center border-r border-slate-800/40">
                                    <input
                                      type="checkbox"
                                      checked={hrSelectedRows.has(emp.id)}
                                      onChange={(e) => { e.stopPropagation(); handleHrRowSelect(emp.id, e.target.checked); }}
                                      className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                                    />
                                  </td>
                                  <td className="p-3 text-center text-slate-500 font-mono font-black border-r border-slate-805/30">{idx + 1}</td>
                                  <td className="p-3 font-mono font-extrabold text-amber-500 text-[11px]">{emp.id}</td>
                                  <td className="p-3 text-white font-black text-[12.5px]">{emp.name}</td>
                                  <td className="p-3">
                                    <div className="flex flex-col">
                                      <span className="text-slate-350 font-bold tracking-tight">{emp.department}</span>
                                      <span className="text-[10px] text-slate-500 font-semibold">{emp.position}</span>
                                    </div>
                                  </td>
                                  <td className="p-3 text-center">
                                    {emp.bhxhBookNo && emp.bhxhBookNo.trim() !== '' ? (
                                      <span className="bg-emerald-950/50 border border-emerald-500/20 text-emerald-400 font-mono font-extrabold text-[11px] px-2.5 py-1 rounded-lg">
                                        {emp.bhxhBookNo}
                                      </span>
                                    ) : (
                                      <span className="bg-rose-955/20 border border-rose-500/10 text-rose-400 font-bold text-[10px] px-2 py-0.5 rounded-md italic">
                                        Chưa đăng ký sổ
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold text-slate-300">
                                    {bxhSal.toLocaleString('vi-VN')}đ
                                  </td>
                                  <td className="p-3 text-center font-mono font-extrabold text-sky-400">
                                    {rate}%
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold text-teal-400">
                                    {Math.round(monthlyDeduction).toLocaleString('vi-VN')}đ
                                  </td>
                                  <td className="p-3 text-center font-mono text-slate-450 text-[11px]">
                                    {emp.bhxhDate || '2026-04-01'}
                                  </td>
                                  <td className="p-3 text-right font-mono text-slate-400 border-l border-slate-850/40">
                                    {personalDeduction.toLocaleString('vi-VN')}đ
                                  </td>
                                  <td className="p-3 text-center font-mono font-extrabold text-amber-550">
                                    {depCount}
                                  </td>
                                  <td className="p-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditIns(emp)}
                                      className="bg-slate-850 hover:bg-amber-600 hover:text-white text-slate-300 font-bold px-2.5 py-1.5 rounded-lg text-[10px] inline-flex items-center gap-1 hover:shadow transition-all cursor-pointer border border-slate-750"
                                    >
                                      <Sliders className="w-3.5 h-3.5 text-amber-500" />
                                      <span>Thiết lập</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Bottom table info notice */}
                    <div className="bg-slate-955 px-4 py-3 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-450 gap-2">
                      <div className="flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-blue-400" />
                        <span>Mức đóng mặc định: BHXH trích 8%, BHYT trích 1.5%, BHTN trích 1%. Tổng mức người lao động đóng là 10.5%.</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {hrSelectedRows.size > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-amber-500 font-bold">Đã chọn: {hrSelectedRows.size}</span>
                            <button
                              onClick={handleBulkDeleteHrData}
                              className="bg-rose-650 hover:bg-rose-600 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors text-[10px] flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Xóa
                            </button>
                          </div>
                        )}
                        <span className="italic font-medium text-slate-500">Hệ quản trị Hoàng Long ERP v2.1</span>
                      </div>
                    </div>

                  </div>

                </div>
              );
            })()}

            {activeHrDataSubTab === 'travel_norms' && (
              <div className="space-y-4 animate-fadeIn" id="travel_allowance_subpanel">
                {/* Header bar of the tab inside */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800/60 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                      <MapPin className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <span className="text-[10px] bg-orange-500/15 text-orange-400 font-extrabold font-mono px-2 py-0.5 rounded border border-orange-500/20 uppercase tracking-wider">PHỤ LỤC 02</span>
                      <h3 className="text-sm font-extrabold text-white mt-1">BẢNG ĐỊNH MỨC TÍNH TIỀN CÔNG TÁC PHÍ 2026</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Ban hành kèm theo Quy chế điều hành tài chính, tác nghiệp ngày 31/03/2026</p>
                    </div>
                  </div>
                  <div className="flex w-full sm:w-auto items-center gap-3 self-stretch sm:self-auto justify-end">
                    <div className="relative w-48 sm:w-64">
                      <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Tìm kiếm định mức..."
                        value={travelNormSearch}
                        onChange={(e) => setTravelNormSearch(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-amber-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleExportTravelNorms}
                      className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
                      title="Xuất Excel định mức công tác phí"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Xuất Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => travelNormFileRef.current?.click()}
                      className="bg-blue-700 hover:bg-blue-600 text-white font-bold text-[11px] px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
                      title="Nhập Excel định mức công tác phí"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Nhập Excel</span>
                    </button>
                    <input
                      ref={travelNormFileRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={handleImportTravelNorms}
                    />
                    <button
                      type="button"
                      onClick={handleAddTravelNormClick}
                      className="bg-orange-600 hover:bg-orange-550 text-white font-bold text-[11px] px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-orange-950/20 active:scale-95 duration-100 cursor-pointer animate-none"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm định mức mới</span>
                    </button>
                  </div>
                </div>

                {/* Table View of Travel Allowance Norms */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 uppercase text-[9px] font-mono tracking-wider">
                          <th className="px-2 py-3 font-bold text-center w-10">
                            <input
                              type="checkbox"
                              checked={hrSelectAll && (() => {
                                const filtered = travelNorms.filter(norm =>
                                  norm.content.toLowerCase().includes(travelNormSearch.toLowerCase()) ||
                                  (norm.code && norm.code.toLowerCase().includes(travelNormSearch.toLowerCase())) ||
                                  (norm.notes && norm.notes.toLowerCase().includes(travelNormSearch.toLowerCase()))
                                );
                                return filtered.length > 0 && filtered.every(n => hrSelectedRows.has(n.id));
                              })()}
                              onChange={(e) => {
                                const filtered = travelNorms.filter(norm =>
                                  norm.content.toLowerCase().includes(travelNormSearch.toLowerCase()) ||
                                  (norm.code && norm.code.toLowerCase().includes(travelNormSearch.toLowerCase())) ||
                                  (norm.notes && norm.notes.toLowerCase().includes(travelNormSearch.toLowerCase()))
                                );
                                handleHrSelectAll(e.target.checked, filtered);
                              }}
                              className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                            />
                          </th>
                          <th className="px-4 py-3 font-bold text-center w-24">Mã CTP</th>
                          <th className="px-4 py-3 font-bold">Nội Dung</th>
                          <th className="px-4 py-3 font-bold text-right font-sans w-36">Đơn Giá</th>
                          <th className="px-4 py-3 font-bold text-center w-28 font-sans">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {(() => {
                          const filtered = travelNorms.filter(norm =>
                            norm.content.toLowerCase().includes(travelNormSearch.toLowerCase()) ||
                            (norm.code && norm.code.toLowerCase().includes(travelNormSearch.toLowerCase())) ||
                            (norm.notes && norm.notes.toLowerCase().includes(travelNormSearch.toLowerCase()))
                          );
                          if (filtered.length === 0) {
                            return (
                              <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-slate-500 font-medium font-sans">
                                  Không tìm thấy dòng dữ liệu định mức công tác phí nào phù hợp với từ khóa tìm kiếm.
                                </td>
                              </tr>
                            );
                          }
                          return filtered.map((norm) => (
                            <tr key={norm.id} className={`hover:bg-slate-800/40 transition-colors ${hrSelectedRows.has(norm.id) ? 'bg-amber-500/10' : ''}`}>
                              <td className="px-2 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={hrSelectedRows.has(norm.id)}
                                  onChange={(e) => { e.stopPropagation(); handleHrRowSelect(norm.id, e.target.checked); }}
                                  className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-3 text-center font-mono font-black text-orange-400 bg-orange-500/5">{norm.code || ''}</td>
                              <td className="px-4 py-3 font-bold text-slate-100">{norm.content}</td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">{(norm.unitPrice).toLocaleString('vi-VN')} đ</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditTravelNormClick(norm)}
                                    className="p-1 px-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-lg transition-all flex items-center gap-1 text-[10px] font-semibold cursor-pointer"
                                    title="Chỉnh sửa định mức"
                                  >
                                    <Sliders className="w-3 text-orange-400" />
                                    <span>Sửa</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTravelNorm(norm.id)}
                                    className="p-1 px-2 text-slate-400 hover:text-rose-455 bg-slate-800/40 hover:bg-rose-950/25 rounded-lg transition-all flex items-center gap-1 text-[10px] cursor-pointer"
                                    title="Xóa bỏ"
                                  >
                                    <Trash2 className="w-3 text-rose-500" />
                                    <span>Xóa</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                  {hrSelectedRows.size > 0 && (
                    <div className="bg-slate-950 px-4 py-2 border-t border-slate-850 flex items-center gap-2 text-[10px]">
                      <span className="text-amber-500 font-bold">Đã chọn: {hrSelectedRows.size}</span>
                      <button
                        onClick={handleBulkDeleteHrData}
                        className="bg-rose-650 hover:bg-rose-600 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Xóa
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
              </div>
  );
}
