import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Minus, Edit2, Trash2, Check, X, 
  AlertTriangle, Layers, MapPin, DollarSign, Activity, FileText 
} from 'lucide-react';
import { dbService } from '../lib/dbService';
import { WarehouseLog } from '../types';
import { useNotification } from '../context';

interface MaterialStock {
  id: string;
  code: string;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
  minAlert: number;
  location: string;
}

export default function WarehouseManagement() {
  const { addToast } = useNotification();
  const [inventory, setInventory] = useState<MaterialStock[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // ── Multi-row selection ──
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const filtered = inventory.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.location.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedRows(new Set(filtered.map(m => m.id)));
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
  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) return;
    if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa ${selectedRows.size} vật tư đã chọn không?\nHành động này không thể hoàn tác.`)) return;
    const idsToDelete = Array.from(selectedRows);
    const remaining = inventory.filter(m => !selectedRows.has(m.id));
    setInventory(remaining);
    setSelectedRows(new Set());
    setSelectAll(false);
    addToast({ title: '✅ Đã xóa', message: `Đã xóa ${idsToDelete.length} vật tư.`, type: 'success' });
    // Persist deletions to Supabase
    try {
      await Promise.allSettled(
        idsToDelete.map(id => dbService.inventory.delete(id).catch(err => console.error("Lỗi xóa vật tư:", err)))
      );
    } catch (err) {
      console.error("Lỗi xóa hàng loạt vật tư:", err);
    }
  };

  // Stock Transaction Modal State
  const [txModalType, setTxModalType] = useState<'in' | 'out' | null>(null);
  const [txMatId, setTxMatId] = useState<string>('');
  const [txQty, setTxQty] = useState<number>(0);
  const [txPrice, setTxPrice] = useState<number>(0);
  const [txNote, setTxNote] = useState('');
  const [txTarget, setTxTarget] = useState(''); // Dự án xuất / Nhà cung cấp nhập

  // Form fields for adding new item
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formUnit, setFormUnit] = useState('Tấm');
  const [formQty, setFormQty] = useState(0);
  const [formPrice, setFormPrice] = useState(0);
  const [formMinAlert, setFormMinAlert] = useState(10);
  const [formLocation, setFormLocation] = useState('Kho chính xưởng mộc');

  // Edit fields
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editPrice, setEditPrice] = useState(0);
  const [editMin, setEditMin] = useState(10);
  const [editLoc, setEditLoc] = useState('');

  // Transaction Log
  const [logs, setLogs] = useState<WarehouseLog[]>([]);

  const loadInventory = async () => {
    try {
      const invData = await dbService.inventory.list();
      setInventory(invData);
      
      const logData = await dbService.warehouseLogs.list();
      setLogs(logData.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
    } catch (e) {
      console.error("Lỗi khi tải dữ liệu kho từ Firebase:", e);
    }
  };

  useEffect(() => {
    loadInventory();
    const syncInventory = () => loadInventory();
    window.addEventListener('hl-inventory-updated', syncInventory);
    window.addEventListener('hl-warehouse-logs-updated', syncInventory);
    return () => {
      window.removeEventListener('hl-inventory-updated', syncInventory);
      window.removeEventListener('hl-warehouse-logs-updated', syncInventory);
    };
  }, []);

  const handleAddNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formName.trim()) return addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng điền đầy đủ Mã và Tên vật tư!', type: 'warning' });
    
    // Check duplication
    if (inventory.some(item => item.code.toLowerCase() === formCode.toLowerCase().trim())) {
      return addToast({ title: 'ℹ️ Thông báo', message: 'Mã vật tư này đã tồn tại trên hệ thống!', type: 'warning' });
    }

    const newItem: MaterialStock = {
      id: `mt_${Date.now()}`,
      code: formCode.toUpperCase().trim(),
      name: formName.trim(),
      unit: formUnit,
      qty: formQty,
      unitPrice: formPrice,
      minAlert: formMinAlert,
      location: formLocation
    };

    try {
      await dbService.inventory.save(newItem);
      setInventory(prev => [...prev, newItem]);
      setIsAdding(false);
      resetForm();
      addToast({ title: '✅ Thành công', message: 'Khai báo vật tư mới thành công!', type: 'success' });
    } catch (err) {
      console.error(err);
      addToast({ title: '❌ Lỗi', message: 'lỗi khi lưu vật tư mới.', type: 'error' });
    }
  };

  const resetForm = () => {
    setFormCode('');
    setFormName('');
    setFormUnit('Tấm');
    setFormQty(0);
    setFormPrice(0);
    setFormMinAlert(10);
    setFormLocation('Kho chính xưởng mộc');
  };

  const handleEditClick = (item: MaterialStock) => {
    setEditingId(item.id);
    setEditCode(item.code);
    setEditName(item.name);
    setEditUnit(item.unit);
    setEditPrice(item.unitPrice || 0);
    setEditMin(item.minAlert || 10);
    setEditLoc(item.location || '');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return addToast({ title: '⚠️ Lỗi', message: 'Tên vật tư không được để trống!', type: 'warning' });
    const item = inventory.find(i => i.id === id);
    if (!item) return;

    const updated = {
      ...item,
      code: editCode.toUpperCase().trim(),
      name: editName.trim(),
      unit: editUnit,
      unitPrice: editPrice,
      minAlert: editMin,
      location: editLoc
    };

    try {
      await dbService.inventory.save(updated);
      setInventory(prev => prev.map(i => i.id === id ? updated : i));
      setEditingId(null);
      addToast({ title: '✅ Thành công', message: 'Cập nhật thành công!', type: 'success' });
    } catch (err) {
      console.error(err);
      addToast({ title: '❌ Lỗi', message: 'lỗi khi cập nhật vật tư.', type: 'error' });
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (window.confirm(`⚠️ Bạn chắc chắn muốn XÓA mặt hàng "${name}" khỏi danh sách tồn kho?`)) {
      try {
        await dbService.inventory.delete(id);
        setInventory(prev => prev.filter(i => i.id !== id));
        addToast({ title: '🗑️ Đã xóa', message: 'Đã xóa mặt hàng.', type: 'info' });
      } catch (err) {
        console.error(err);
        addToast({ title: '🗑️ Đã xóa', message: 'Lỗi khi xóa vật tư.', type: 'info' });
      }
    }
  };

  // Transaction Handler (Nhập / Xuất kho)
  const openTxModal = (type: 'in' | 'out', item?: MaterialStock) => {
    setTxModalType(type);
    if (item) {
      setTxMatId(item.id);
      setTxPrice(item.unitPrice || 0);
    } else {
      setTxMatId(inventory[0]?.id || '');
      setTxPrice(inventory[0]?.unitPrice || 0);
    }
    setTxQty(10);
    setTxNote('');
    setTxTarget('');
  };

  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txMatId || txQty <= 0) return addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng nhập số lượng hợp lệ!', type: 'warning' });
    
    const mat = inventory.find(m => m.id === txMatId);
    if (!mat) return;

    if (txModalType === 'out' && mat.qty < txQty) {
      const forceOut = window.confirm(
        `🚨 CẢNH BÁO THIẾU HÀNG:\nSố lượng tồn kho hiện tại là ${mat.qty} ${mat.unit}, nhỏ hơn số lượng xuất ${txQty} ${mat.unit}.\n\nBạn vẫn muốn xuất kho và ghi nhận số lượng âm chứ?`
      );
      if (!forceOut) return;
    }

    const diff = txModalType === 'in' ? txQty : -txQty;
    const updatedMat = {
      ...mat,
      qty: Math.max(txModalType === 'in' ? 0 : -9999, mat.qty + diff)
    };

    try {
      await dbService.inventory.save(updatedMat);

      // Create log
      const newLog = {
        id: `log_${Date.now()}`,
        time: new Date().toISOString(),
        type: txModalType,
        matName: mat.name,
        qty: txQty,
        target: txTarget || (txModalType === 'in' ? 'NCC Vãng lai' : 'Công trình nội bộ'),
        note: txNote
      };
      await dbService.warehouseLogs.save(newLog);

      setInventory(prev => prev.map(m => m.id === updatedMat.id ? updatedMat : m));
      setLogs(prev => [newLog, ...prev]);
      setTxModalType(null);
      addToast({ title: '✅ Thành công', message: `Đã ghi nhận phiếu ${txModalType === 'in' ? 'NHẬP' : 'XUẤT'} kho thành công!`, type: 'success' });
    } catch (err) {
      console.error(err);
      addToast({ title: '❌ Lỗi', message: 'lỗi khi ghi nhận phiếu nhập xuất.', type: 'error' });
    }
  };

  return (
    <div className="space-y-6 text-slate-200" id="warehouse_management_panel">
      {/* Header cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Stock Items */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-teal-500/10 text-teal-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-455 block">Tổng số chủng loại</span>
            <span className="text-xl font-black text-white font-mono">{inventory.length}</span>
            <span className="text-[9.5px] text-slate-500 block">vật tư phụ kiện lưu trữ</span>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400 animate-pulse">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-455 block">Cảnh báo thiếu hụt</span>
            <span className="text-xl font-black text-rose-500 font-mono">
              {inventory.filter(m => m.qty <= m.minAlert).length}
            </span>
            <span className="text-[9.5px] text-rose-400 block font-semibold">Cần lên kế hoạch thu mua ngay</span>
          </div>
        </div>

        {/* Action controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-around gap-2">
          <button
            type="button"
            onClick={() => openTxModal('in')}
            className="flex-1 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 hover:text-white font-bold text-xs py-2.5 px-3 rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Nhập Kho (+)
          </button>
          <button
            type="button"
            onClick={() => openTxModal('out')}
            className="flex-1 bg-amber-600/20 hover:bg-amber-600 border border-amber-500/30 hover:border-amber-500 text-amber-400 hover:text-white font-bold text-xs py-2.5 px-3 rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <Minus className="w-4 h-4" />
            Xuất Kho (-)
          </button>
        </div>
      </div>

      {/* Adding Form */}
      {isAdding && (
        <form onSubmit={handleAddNewItem} className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 animate-fade-in text-left">
          <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider border-b border-slate-800 pb-2">
            🆕 KHAI BÁO THÊM CHỦNG LOẠI VẬT TƯ MỚI
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-455">Mã Vật Tư (Duy nhất) *</label>
              <input
                type="text"
                required
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="VD: MDF-AC-18"
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 uppercase font-mono focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-455">Tên Vật Tư / Chi Tiết Mẫu Mã *</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ví dụ: Bản lề hơi giảm chấn inox 304..."
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-455">Đơn Vị Tính</label>
              <input
                type="text"
                value={formUnit}
                onChange={(e) => setFormUnit(e.target.value)}
                placeholder="Tấm, Cây, Thùng, Cái..."
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-455">Số lượng ban đầu</label>
              <input
                type="number"
                value={formQty || ''}
                onChange={(e) => setFormQty(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-455">Đơn Giá Định Mức (đ)</label>
              <input
                type="number"
                value={formPrice || ''}
                onChange={(e) => setFormPrice(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-455">Cảnh báo tồn tối thiểu</label>
              <input
                type="number"
                value={formMinAlert || ''}
                onChange={(e) => setFormMinAlert(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-455">Vị trí kho lưu trữ</label>
              <input
                type="text"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="VD: Kệ gỗ mộc xưởng chính"
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                resetForm();
              }}
              className="bg-slate-800 hover:bg-slate-750 font-bold text-[10.5px] text-slate-300 px-4 py-2 rounded-lg cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 font-bold text-[10.5px] text-white px-4 py-2 rounded-lg cursor-pointer"
            >
              Lưu vật tư
            </button>
          </div>
        </form>
      )}

      {/* Transaction Entry Modal (Nhập / Xuất kho) */}
      {txModalType && (() => {
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-left">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h3 className="font-extrabold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Ghi nhận phiếu {txModalType === 'in' ? 'NHẬP KHO VẬT TƯ' : 'XUẤT KHO CẤP PHÁT'}
                </h3>
                <button type="button" onClick={() => setTxModalType(null)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleTxSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Chọn loại vật tư mộc ván</label>
                  <select
                    value={txMatId}
                    onChange={(e) => {
                      const mat = inventory.find(i => i.id === e.target.value);
                      setTxMatId(e.target.value);
                      if (mat) setTxPrice(mat.unitPrice || 0);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none"
                  >
                    {inventory.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.code} - {m.name} (Tồn: {m.qty} {m.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Số lượng giao dịch</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={txQty || ''}
                      onChange={(e) => setTxQty(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Đơn giá áp dụng (đ)</label>
                    <input
                      type="number"
                      value={txPrice || ''}
                      onChange={(e) => setTxPrice(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">
                    {txModalType === 'in' ? 'Nhà cung cấp / Nguồn nhập' : 'Dự án / Địa điểm nhận'}
                  </label>
                  <input
                    type="text"
                    value={txTarget}
                    onChange={(e) => setTxTarget(e.target.value)}
                    placeholder={txModalType === 'in' ? 'VD: Gỗ An Cường Đà Lạt...' : 'VD: Biệt thự 45 Đà Lạt...'}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Diễn giải nội dung</label>
                  <input
                    type="text"
                    value={txNote}
                    onChange={(e) => setTxNote(e.target.value)}
                    placeholder="Lý do bàn giao, số lô hàng..."
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
                  <button
                    type="button"
                    onClick={() => setTxModalType(null)}
                    className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-[10px] px-3.5 py-2 rounded-lg"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-4 py-2 rounded-lg"
                  >
                    Hoàn Tất Giao Dịch
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Main filters and list */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Mã vật tư, tên tấm ván..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 outline-none focus:border-teal-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(!isAdding)}
              className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3 text-emerald-400" />
              Khai báo mặt hàng mới
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider">
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectAll && filtered.length > 0 && filtered.every(m => selectedRows.has(m.id))}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                  />
                </th>
                <th className="p-3 w-32">Mã Vật Tư</th>
                <th className="p-3">Tên Nguyên Vật Liệu / Phụ Kiện</th>
                <th className="p-3 text-center w-20">ĐVT</th>
                <th className="p-3 text-right w-24">Số lượng tồn</th>
                <th className="p-3 text-right w-28">Đơn giá đ.mức</th>
                <th className="p-3 text-right w-24">Ngưỡng cảnh báo</th>
                <th className="p-3">Vị trí lưu kho</th>
                <th className="p-3 w-28 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-500 font-medium">
                    Không tìm thấy vật tư mộc ván nào trong kho.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isEditingThis = editingId === item.id;
                  const isLow = item.qty <= item.minAlert;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-900/40 text-slate-300 transition-colors ${isLow ? 'bg-rose-950/10' : ''} ${selectedRows.has(item.id) ? 'bg-amber-500/10' : ''}`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(item.id)}
                          onChange={(e) => { e.stopPropagation(); handleRowSelect(item.id, e.target.checked); }}
                          className="w-4 h-4 text-amber-500 border-slate-600 rounded cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-400">
                        {isEditingThis ? (
                          <input
                            type="text"
                            value={editCode}
                            onChange={(e) => setEditCode(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded p-1 w-full text-xs text-white uppercase font-mono"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {isLow && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>}
                            <span>{item.code}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditingThis ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded p-1 w-full text-xs text-white"
                          />
                        ) : (
                          <div>
                            <span className="font-semibold block text-white">{item.name}</span>
                            {isLow && (
                              <span className="text-[9px] text-rose-450 font-bold uppercase tracking-wider flex items-center gap-0.5 mt-0.5">
                                ⚠️ Tồn cực thấp (Ngưỡng {item.minAlert})
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center text-slate-400 font-medium">
                        {isEditingThis ? (
                          <input
                            type="text"
                            value={editUnit}
                            onChange={(e) => setEditUnit(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded p-1 w-12 text-center text-xs text-white"
                          />
                        ) : (
                          item.unit
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <span className={`font-mono font-black text-xs ${isLow ? 'text-rose-500' : 'text-emerald-400'}`}>
                          {item.qty}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {isEditingThis ? (
                          <input
                            type="number"
                            value={editPrice || ''}
                            onChange={(e) => setEditPrice(Number(e.target.value))}
                            className="bg-slate-950 border border-slate-800 rounded p-1 w-20 text-right text-xs text-white font-mono"
                          />
                        ) : (
                          <span className="font-mono text-slate-400">
                            {item.unitPrice ? `${item.unitPrice.toLocaleString('vi-VN')} đ` : '—'}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {isEditingThis ? (
                          <input
                            type="number"
                            value={editMin || ''}
                            onChange={(e) => setEditMin(Number(e.target.value))}
                            className="bg-slate-950 border border-slate-800 rounded p-1 w-16 text-right text-xs text-white font-mono"
                          />
                        ) : (
                          <span className="font-mono text-slate-500 font-semibold">{item.minAlert}</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400">
                        {isEditingThis ? (
                          <input
                            type="text"
                            value={editLoc}
                            onChange={(e) => setEditLoc(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded p-1 w-full text-xs text-white"
                          />
                        ) : (
                          <div className="flex items-center gap-1 text-[11px]">
                            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>{item.location || 'Chưa định vị'}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {isEditingThis ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(item.id)}
                              className="p-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 rounded cursor-pointer"
                              title="Lưu"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded cursor-pointer"
                              title="Hủy"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openTxModal('in', item)}
                              className="p-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded cursor-pointer"
                              title="Nhập thêm kho"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openTxModal('out', item)}
                              className="p-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded cursor-pointer"
                              title="Xuất cấp phát"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditClick(item)}
                              className="p-1 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded cursor-pointer"
                              title="Chỉnh sửa thông số"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id, item.name)}
                              className="p-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded cursor-pointer"
                              title="Xóa khỏi sổ kho"
                            >
                              <Trash2 className="w-3 h-3" />
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

      {/* Transaction History Logs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-left">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
          <FileText className="w-4 h-4 text-teal-400" />
          Nhật ký xuất nhập kho tức thời (gần đây)
        </h3>
        <div className="mt-3 overflow-y-auto max-h-48 space-y-2">
          {logs.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">Chưa ghi nhận hoạt động nào.</p>
          ) : (
            logs.map((log) => (
              <div 
                key={log.id} 
                className="flex items-center justify-between p-2 rounded-lg bg-slate-950/50 border border-slate-850 text-[11px]"
              >
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                    log.type === 'in' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {log.type === 'in' ? 'Nhập' : 'Xuất'}
                  </span>
                  <div>
                    <span className="font-extrabold text-slate-200">{log.matName}</span>
                    <span className="text-slate-500 mx-1.5">•</span>
                    <span className="text-slate-400 font-semibold">{log.target}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-mono font-black ${log.type === 'in' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {log.type === 'in' ? '+' : '-'}{log.qty}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(log.time).toLocaleDateString('vi-VN')} {new Date(log.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
