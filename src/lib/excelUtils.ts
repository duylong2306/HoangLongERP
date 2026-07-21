import * as XLSX from 'xlsx';

/**
 * Export an array of objects to an .xlsx file.
 * Mirrors the pattern already used in HumanResourcesManagement.tsx and TaskDetailModal.tsx.
 */
export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  sheetName: string,
  fileName: string,
  headerOrder?: (keyof T)[]
): void {
  if (data.length === 0) {
    console.warn('exportToExcel: empty data, skipping');
    return;
  }
  const ws = headerOrder
    ? XLSX.utils.json_to_sheet(data, { header: headerOrder as string[] })
    : XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

/**
 * Import an .xlsx/.xls file and map each row via `mapRow`.
 * Returns a promise resolving to the mapped array.
 */
export function importFromExcel<T>(
  file: File,
  mapRow: (row: Record<string, any>, index: number) => T
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const binary = ev.target?.result as string;
        const wb = XLSX.read(binary, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, any>[];
        if (rows.length === 0) {
          resolve([]);
          return;
        }
        const mapped = rows.map((row, idx) => mapRow(row, idx));
        resolve(mapped);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
}

/** Generate a YYYYMMDD string for file naming. */
export function formatDateForFile(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** Generate a MM_YYYY string for HRM/finance file naming (matches existing convention). */
export function formatMonthYearForFile(date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${m}_${y}`;
}

/** Default Vietnamese headers for common master-data types. */
export const EXCEL_HEADERS = {
  customer: [
    'STT',
    'Mã KH',
    'Tên khách hàng',
    'Số điện thoại',
    'Email',
    'Địa chỉ',
    'Ghi chú',
  ],
  supplier: [
    'STT',
    'Mã NCC',
    'Tên nhà cung cấp',
    'Số điện thoại',
    'Email',
    'Địa chỉ',
    'Loại vật tư',
    'Ghi chú',
  ],
  subcontractor: [
    'STT',
    'Mã thầu phụ',
    'Tên thầu phụ',
    'Số điện thoại',
    'Email',
    'Địa chỉ',
    'Chuyên môn',
    'Ghi chú',
  ],
  houseEstimatePrice: [
    'STT',
    'Loại nhà',
    'Đơn giá TB (đ/m²)',
    'Giá thấp (đ/m²)',
    'Giá cao (đ/m²)',
    'Đặc điểm kết cấu',
    'Ghi chú',
  ],
  compositionNorm: [
    'STT',
    'Mã công tác',
    'Tên công tác',
    'Đơn vị',
    'Định mức vật tư',
    'Định mức nhân công',
    'Định mức máy thi công',
    'Ghi chú',
  ],
  materialLaborNorm: [
    'STT',
    'Tên vật tư / nhân công',
    'Đơn vị',
    'Đơn giá',
    'Loại',
    'Ghi chú',
  ],
  productCatalog: [
    'STT',
    'Tên sản phẩm',
    'Mã sản phẩm',
    'Danh mục',
    'Chất liệu',
    'Kích thước',
    'Đơn giá',
    'Đơn vị',
    'Ghi chú',
  ],
  employee: [
    'STT',
    'Mã NV',
    'Họ tên',
    'Phòng ban',
    'Chức vụ',
    'Số điện thoại',
    'Email',
    'Ngày vào làm',
    'Lương cơ bản',
    'Trạng thái',
  ],
  holiday: [
    'STT',
    'Tên ngày lễ',
    'Ngày',
    'Loại',
    'Ghi chú',
  ],
  performanceCriterion: [
    'STT',
    'Mã tiêu chí',
    'Tên tiêu chí',
    'Phòng ban',
    'Trọng số',
    'Điểm tối đa',
    'Mô tả',
  ],
  salaryScale: [
    'STT',
    'Bậc lương',
    'Hệ số lương',
    'Lương cơ bản',
    'Phụ cấp chức vụ',
    'Phụ cấp trách nhiệm',
    'Phụ cấp khác',
    'Ghi chú',
  ],
  insuranceConfig: [
    'STT',
    'Năm',
    'Mức lương tối đa BHXH',
    'Tỷ lệ BHXH (%), DN',
    'Tỷ lệ BHXH (%), NV',
    'Tỷ lệ BHYT (%), DN',
    'Tỷ lệ BHYT (%), NV',
    'Tỷ lệ BHTN (%), DN',
    'Tỷ lệ BHTN (%), NV',
    'Ghi chú',
  ],
  travelAllowanceNorm: [
    'STT',
    'Mã định mức',
    'Tên định mức',
    'Khoảng cách (km)',
    'Đơn giá (đ/km)',
    'Mức ăn trưa (đ)',
    'Mức lưu trú (đ/đêm)',
    'Mức khác (đ)',
    'Ghi chú',
  ],
} as const;