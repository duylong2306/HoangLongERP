import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, Edit2, Trash2, Check, X,
  ChevronLeft, ChevronRight, ShoppingCart, Package, Info, Download, FileUp
} from 'lucide-react';
import { dbService } from '../lib/dbService';
import { useNotification } from '../context';
import { exportToExcel, importFromExcel, formatDateForFile } from '../lib/excelUtils';

interface CatalogItem {
  maSanPham: string;
  tenSanPham: string;
  donViTinh: string;
  donGia: number;
  quyCach: string;
}

interface CatalogService {
  list(): Promise<any[]>;
  save(item: any): Promise<void>;
  delete(maSanPham: string): Promise<void>;
}

interface CatalogTableProps {
  mode: 'mua' | 'ban';
}

function CatalogTable({ mode }: CatalogTableProps) {
  const { addToast } = useNotification();
  const isMua = mode === 'mua';
  const service: CatalogService = isMua ? dbService.purchaseProductCatalog : dbService.salesProductCatalog;
  const codePrefix = isMua ? 'SPM' : 'SPB';

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // Options: 5, 10, 20, 50, 100

  // ── Modal form (Thêm / Sửa) ──
  const [showFormModal, setShowFormModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [fMaSanPham, setFMaSanPham] = useState('');
  const [fTenSanPham, setFTenSanPham] = useState('');
  const [fDonViTinh, setFDonViTinh] = useState('');
  const [fDonGia, setFDonGia] = useState('');
  const [fQuyCach, setFQuyCach] = useState('');

  // ── Multi-row selection ──
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await service.list();
      setItems(rows.map((r: any) => ({
        maSanPham: r.maSanPham ?? '',
        tenSanPham: r.tenSanPham ?? '',
        donViTinh: r.donViTinh ?? '',
        donGia: Number(r.donGia) || 0,
        quyCach: r.quyCach ?? '',
      })));
    } catch (e) {
      console.error('Lỗi tải danh mục sản phẩm:', e);
    }
  }, [service]);

  useEffect(() => {
    load();
    const sync = () => load();
    window.addEventListener('hl-warehouse-data-updated', sync);
    return () => window.removeEventListener('hl-warehouse-data-updated', sync);
  }, [load]);

  const filtered = items.filter(i =>
    i.maSanPham.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.tenSanPham.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.quyCach.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const activePage = currentPage > totalPages ? totalPages : currentPage;
  const startIndex = (activePage - 1) * pageSize;
  const paginated = filtered.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  // ── Selection handlers ──
  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedRows(new Set(paginated.map(i => i.maSanPham)));
    else setSelectedRows(new Set());
    setSelectAll(checked);
  };
  const handleRowSelect = (ma: string, checked: boolean) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (checked) next.add(ma);
      else next.delete(ma);
      return next;
    });
  };
  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) return;
    if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa ${selectedRows.size} sản phẩm đã chọn không?\nHành động này không thể hoàn tác.`)) return;
    const maList = Array.from(selectedRows);
    const remaining = items.filter(i => !selectedRows.has(i.maSanPham));
    setItems(remaining);
    setSelectedRows(new Set());
    setSelectAll(false);
    addToast({ title: '✅ Đã xóa', message: `Đã xóa ${maList.length} sản phẩm.`, type: 'success' });
    // Persist deletions to Supabase
    try {
      await Promise.allSettled(
        maList.map(ma => service.delete(ma).catch(err => console.error('Lỗi xóa sản phẩm:', err)))
      );
    } catch (err) {
      console.error('Lỗi xóa hàng loạt sản phẩm:', err);
    }
  };

  // ── Auto-generate code: SPM-xxx / SPB-xxx ──
  const generateNextCode = (): string => {
    let maxId = 0;
    items.forEach(p => {
      if (p.maSanPham && p.maSanPham.startsWith(codePrefix)) {
        const numStr = p.maSanPham.substring(codePrefix.length).replace(/\D/g, '');
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > maxId) maxId = num;
      }
    });
    return `${codePrefix}-${String(maxId + 1).padStart(3, '0')}`;
  };

  const openAddModal = () => {
    setModalMode('add');
    setFMaSanPham(generateNextCode());
    setFTenSanPham('');
    setFDonViTinh('');
    setFDonGia('');
    setFQuyCach('');
    setShowFormModal(true);
  };

  const openEditModal = (item: CatalogItem) => {
    setModalMode('edit');
    setFMaSanPham(item.maSanPham);
    setFTenSanPham(item.tenSanPham);
    setFDonViTinh(item.donViTinh);
    setFDonGia(item.donGia ? String(item.donGia) : '');
    setFQuyCach(item.quyCach || '');
    setShowFormModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fTenSanPham.trim()) {
      return addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng nhập Tên sản phẩm!', type: 'warning' });
    }
    const ma = fMaSanPham.trim().toUpperCase();
    if (modalMode === 'add' && items.some(i => i.maSanPham.toLowerCase() === ma.toLowerCase())) {
      return addToast({ title: 'ℹ️ Thông báo', message: `Mã "${ma}" đã tồn tại trên hệ thống!`, type: 'warning' });
    }
    const item: CatalogItem = {
      maSanPham: ma,
      tenSanPham: fTenSanPham.trim(),
      donViTinh: fDonViTinh.trim(),
      donGia: Number(fDonGia) || 0,
      quyCach: fQuyCach.trim(),
    };
    try {
      await service.save(item);
      setItems(prev => modalMode === 'add' ? [item, ...prev] : prev.map(i => i.maSanPham === ma ? item : i));
      setShowFormModal(false);
      setCurrentPage(1);
      addToast({ title: '✅ Thành công', message: modalMode === 'add' ? 'Đã thêm sản phẩm mới!' : 'Đã cập nhật sản phẩm!', type: 'success' });
    } catch (err) {
      console.error(err);
      addToast({ title: '❌ Lỗi', message: 'Không thể lưu dữ liệu. Vui lòng kiểm tra kết nối Supabase.', type: 'error' });
    }
  };

  const handleDelete = async (ma: string, ten: string) => {
    if (!window.confirm(`⚠️ Bạn chắc chắn muốn XÓA sản phẩm "${ma} - ${ten}"?\nHành động này không thể hoàn tác.`)) return;
    try {
      await service.delete(ma);
      setItems(prev => prev.filter(i => i.maSanPham !== ma));
      addToast({ title: '🗑️ Đã xóa', message: `Đã xóa sản phẩm ${ma}.`, type: 'info' });
    } catch (err) {
      console.error(err);
      addToast({ title: '❌ Lỗi', message: 'Không thể xóa sản phẩm.', type: 'error' });
    }
  };

  const formatMoney = (v: number) => v ? `${v.toLocaleString('vi-VN')} đ` : '—';

  // ── Export / Import Excel ──
  const excelHeaders = ['Mã sản phẩm', 'Tên sản phẩm', 'Đơn vị tính', 'Đơn giá', 'Quy cách'];
  const excelSheetName = isMua ? 'DanhMucMUA' : 'DanhMucBAN';

  const handleExportExcel = () => {
    const data = items.map(i => ({
      'Mã sản phẩm': i.maSanPham,
      'Tên sản phẩm': i.tenSanPham,
      'Đơn vị tính': i.donViTinh || '',
      'Đơn giá': i.donGia || 0,
      'Quy cách': i.quyCach || '',
    }));
    // Khi chưa có dữ liệu, exportToExcel vẫn tạo file chỉ có tiêu đề cột → dùng làm mẫu nhập liệu
    exportToExcel(data, excelSheetName, `${excelSheetName}_${formatDateForFile()}.xlsx`, undefined, excelHeaders);
    addToast({
      title: '✅ Xuất Excel',
      message: data.length === 0 ? 'Đã xuất file mẫu kèm tiêu đề cột.' : `Đã xuất ${data.length} sản phẩm`,
      type: 'success',
    });
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const rows = await importFromExcel<Record<string, any>>(file, (row) => row);
      if (rows.length === 0) {
        addToast({ title: '⚠️ Không có dữ liệu', message: 'File Excel không có dữ liệu.', type: 'warning' });
        return;
      }

      // Tính max số mã hiện có (cả mã trong file) để tự sinh mã mới không trùng
      let maxNum = 0;
      const bump = (ma?: string) => {
        if (ma && ma.startsWith(codePrefix)) {
          const n = parseInt(ma.substring(codePrefix.length).replace(/\D/g, ''), 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      };
      items.forEach(i => bump(i.maSanPham));
      rows.forEach(r => bump(String(r['Mã sản phẩm'] || '')));
      let nextNum = maxNum + 1;

      const mapped: CatalogItem[] = rows.map((r) => {
        const maRaw = String(r['Mã sản phẩm'] || '').trim().toUpperCase();
        const ma = maRaw || `${codePrefix}-${String(nextNum).padStart(3, '0')}`;
        if (!maRaw) nextNum++;
        return {
          maSanPham: ma,
          tenSanPham: String(r['Tên sản phẩm'] || '').trim(),
          donViTinh: String(r['Đơn vị tính'] || '').trim(),
          donGia: Number(String(r['Đơn giá'] || '0').replace(/[^\d.-]/g, '')) || 0,
          quyCach: String(r['Quy cách'] || '').trim(),
        };
      }).filter(i => i.tenSanPham);

      if (mapped.length === 0) {
        addToast({ title: '⚠️ Không hợp lệ', message: 'Không tìm thấy cột "Tên sản phẩm" trong file.', type: 'warning' });
        return;
      }

      // Gộp vào danh sách: mã trùng → ghi đè, mã mới → thêm
      const merged = [...items];
      mapped.forEach(imp => {
        const existIdx = merged.findIndex(m => m.maSanPham.toLowerCase() === imp.maSanPham.toLowerCase());
        if (existIdx > -1) merged[existIdx] = { ...merged[existIdx], ...imp };
        else merged.push(imp);
      });
      setItems(merged);
      setCurrentPage(1);
      // Persist to Supabase
      try {
        await Promise.allSettled(
          mapped.map(m => service.save(m).catch(err => console.error('Lỗi lưu sản phẩm import:', err)))
        );
      } catch (err) {
        console.error('Lỗi import sản phẩm hàng loạt:', err);
      }
      addToast({ title: '✅ Nhập thành công', message: `Đã import ${mapped.length} sản phẩm từ file Excel`, type: 'success' });
    } catch (err) {
      console.error('Lỗi import Excel:', err);
      addToast({ title: '❌ Lỗi', message: 'Không thể đọc file Excel. Vui lòng kiểm tra định dạng.', type: 'error' });
    }
  };

  // Accent colors cho từng tab (emerald = MUA, amber = BÁN)
  const accentIconBox = isMua ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400';
  const accentHeaderBorder = isMua ? 'focus:border-emerald-500' : 'focus:border-amber-500';
  const accentLabel = isMua ? 'text-emerald-400' : 'text-amber-400';
  const accentBtnSolid = isMua ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-600 hover:bg-amber-500';
  const accentPageActive = isMua ? 'bg-emerald-600 border-emerald-600' : 'bg-amber-600 border-amber-600';
  const accentCheckbox = isMua ? 'text-emerald-500' : 'text-amber-500';

  return (
    <div className="space-y-4 text-slate-200">
      {/* Header cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className={`p-3 rounded-lg ${accentIconBox}`}>
            {isMua ? <ShoppingCart className="w-6 h-6" /> : <Package className="w-6 h-6" />}
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Tổng số mặt hàng</span>
            <span className="text-xl font-black text-white font-mono">{items.length}</span>
            <span className="text-[9.5px] text-slate-500 block">{isMua ? 'Danh mục MUA' : 'Danh mục BÁN'}</span>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4 md:col-span-2">
          <div className={`p-3 rounded-lg ${accentIconBox}`}>
            <Info className="w-6 h-6" />
          </div>
          <div className="text-[11px] text-slate-400 leading-relaxed">
            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Thông tin</span>
            Mã sản phẩm tự sinh theo định dạng{' '}
            <span className={`font-mono font-extrabold ${accentLabel}`}>{codePrefix}-001</span>
            , tăng dần 3 chữ số. Dữ liệu được đồng bộ trực tiếp lên <b className="text-slate-200">Supabase</b>.
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Mã sản phẩm, tên, quy cách..."
              className={`w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 outline-none ${accentHeaderBorder}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
              <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">Xem trên trang:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-transparent text-xs font-extrabold text-slate-200 outline-none cursor-pointer"
              >
                <option value={5} className="bg-slate-950 text-slate-200">5 dòng</option>
                <option value={10} className="bg-slate-950 text-slate-200">10 dòng</option>
                <option value={20} className="bg-slate-950 text-slate-200">20 dòng</option>
                <option value={50} className="bg-slate-950 text-slate-200">50 dòng</option>
                <option value={100} className="bg-slate-950 text-slate-200">100 dòng</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleExportExcel}
              className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs px-3 py-2 rounded-lg border border-slate-700 flex items-center gap-1 cursor-pointer"
              title={items.length === 0 ? 'Xuất file mẫu kèm tiêu đề cột' : 'Xuất Excel danh mục'}
            >
              <Download className="w-3 h-3 text-blue-400" />
              Xuất Excel
            </button>
            <label
              className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs px-3 py-2 rounded-lg border border-slate-700 flex items-center gap-1 cursor-pointer"
              title="Nhập Excel danh mục"
            >
              <FileUp className="w-3 h-3 text-emerald-400" />
              Nhập Excel
              <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" />
            </label>
            <button
              type="button"
              onClick={openAddModal}
              className={`${accentBtnSolid} text-white font-bold text-xs px-3 py-2 rounded-lg border border-transparent flex items-center gap-1 cursor-pointer transition-all active:scale-95`}
            >
              <Plus className="w-3 h-3" />
              Thêm sản phẩm
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider">
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectAll && paginated.length > 0 && paginated.every(i => selectedRows.has(i.maSanPham))}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className={`w-4 h-4 ${accentCheckbox} border-slate-600 rounded cursor-pointer`}
                  />
                </th>
                <th className="p-3 w-28">Mã sản phẩm</th>
                <th className="p-3">Tên sản phẩm</th>
                <th className="p-3 text-center w-20">ĐVT</th>
                <th className="p-3 text-right w-32">Đơn giá</th>
                <th className="p-3">Quy cách</th>
                <th className="p-3 w-28 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500 font-medium">
                    {searchTerm ? 'Không tìm thấy sản phẩm phù hợp.' : `Chưa có sản phẩm nào trong ${isMua ? 'Danh mục MUA' : 'Danh mục BÁN'}. Bấm "Thêm sản phẩm" để bắt đầu.`}
                  </td>
                </tr>
              ) : (
                paginated.map((item) => (
                  <tr
                    key={item.maSanPham}
                    className={`hover:bg-slate-900/40 text-slate-300 transition-colors ${selectedRows.has(item.maSanPham) ? 'bg-amber-500/10' : ''}`}
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(item.maSanPham)}
                        onChange={(e) => { e.stopPropagation(); handleRowSelect(item.maSanPham, e.target.checked); }}
                        className={`w-4 h-4 ${accentCheckbox} border-slate-600 rounded cursor-pointer`}
                      />
                    </td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 font-mono font-bold text-[10.5px] ${accentLabel}`}>
                        {item.maSanPham}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold block text-white">{item.tenSanPham}</span>
                    </td>
                    <td className="p-3 text-center text-slate-400 font-medium">{item.donViTinh || '—'}</td>
                    <td className="p-3 text-right">
                      <span className="font-mono font-bold text-emerald-400">{formatMoney(item.donGia)}</span>
                    </td>
                    <td className="p-3 text-slate-400">{item.quyCach || '—'}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="p-1 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded cursor-pointer"
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.maSanPham, item.tenSanPham)}
                          className="p-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded cursor-pointer"
                          title="Xóa"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Bulk delete bar */}
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

        {/* Pagination */}
        {totalItems > 0 && (
          <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[10.5px]">
            <div>
              Hiển thị từ <span className="font-bold text-slate-200">{startIndex + 1}</span> đến{' '}
              <span className="font-bold text-slate-200">{Math.min(startIndex + pageSize, totalItems)}</span>{' '}
              trong tổng số <span className="font-bold text-slate-200">{totalItems}</span> sản phẩm
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={activePage === 1}
                onClick={() => setCurrentPage(1)}
                className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] px-2 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              >
                Đầu
              </button>
              <button
                disabled={activePage === 1}
                onClick={() => setCurrentPage(activePage - 1)}
                className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 hover:text-white transition cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1 mx-1">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pageNum = i + 1;
                  if (pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - activePage) <= 1) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-6 h-6 text-center text-[10.5px] font-bold rounded transition cursor-pointer ${
                          activePage === pageNum
                            ? `${accentPageActive} text-white font-black border shadow-sm`
                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  } else if (pageNum === 2 || pageNum === totalPages - 1) {
                    return <span key={pageNum} className="text-slate-600 text-[10px] px-0.5">...</span>;
                  }
                  return null;
                })}
              </div>

              <button
                disabled={activePage === totalPages}
                onClick={() => setCurrentPage(activePage + 1)}
                className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 hover:text-white transition cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={activePage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] px-2 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              >
                Cuối
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-left">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className={`font-extrabold text-white text-xs uppercase tracking-wider ${accentLabel}`}>
                {modalMode === 'add' ? `✨ Thêm Sản Phẩm ${isMua ? 'MUA' : 'BÁN'} Mới` : `⚙️ Cập Nhật Sản Phẩm ${isMua ? 'MUA' : 'BÁN'}`}
              </h3>
              <button type="button" onClick={() => setShowFormModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Mã sản phẩm (tự sinh) *</label>
                <input
                  type="text"
                  value={fMaSanPham}
                  disabled
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-500 font-mono cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Tên sản phẩm *</label>
                <input
                  type="text"
                  required
                  value={fTenSanPham}
                  onChange={(e) => setFTenSanPham(e.target.value)}
                  placeholder={isMua ? 'VD: Ván MDF An Cường 18mm...' : 'VD: Tủ bếp Melamine...'}
                  className={`w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none ${accentHeaderBorder}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Đơn vị tính</label>
                  <input
                    type="text"
                    value={fDonViTinh}
                    onChange={(e) => setFDonViTinh(e.target.value)}
                    placeholder="Tấm, Cây, Mét, Cái..."
                    className={`w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none ${accentHeaderBorder}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Đơn giá (đ)</label>
                  <input
                    type="number"
                    min={0}
                    value={fDonGia}
                    onChange={(e) => setFDonGia(e.target.value)}
                    placeholder="0"
                    className={`w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-mono focus:outline-none ${accentHeaderBorder}`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Quy cách</label>
                <input
                  type="text"
                  value={fQuyCach}
                  onChange={(e) => setFQuyCach(e.target.value)}
                  placeholder="VD: Dày 18mm, cao 2.2m..."
                  className={`w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none ${accentHeaderBorder}`}
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-[10.5px] px-4 py-2 rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className={`${accentBtnSolid} text-white font-bold text-[10.5px] px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1`}
                >
                  <Check className="w-3 h-3" />
                  {modalMode === 'add' ? 'Thêm sản phẩm' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WarehouseDataManagement() {
  const [activeTab, setActiveTab] = useState<'mua' | 'ban'>('mua');

  return (
    <div className="space-y-4 text-slate-200" id="warehouse_data_panel">
      {/* Sub-tabs: Danh mục MUA / BÁN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-teal-400" />
            Dữ Liệu Kho — Danh Mục Sản Phẩm
          </h2>
          <p className="text-[10.5px] text-slate-500 mt-0.5">
            Quản lý danh mục sản phẩm MUA / BÁN, đồng bộ lên Supabase
          </p>
        </div>
        <div className="flex gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('mua')}
            className={`px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'mua'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Danh Mục MUA
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ban')}
            className={`px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ban'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Danh Mục BÁN
          </button>
        </div>
      </div>

      {activeTab === 'mua' && <CatalogTable mode="mua" />}
      {activeTab === 'ban' && <CatalogTable mode="ban" />}
    </div>
  );
}
