import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Save, Check, FileText, Printer, Edit, LayoutTemplate, X } from 'lucide-react';
import { dbService } from '../lib/dbService';
import { useNotification } from '../context';
import QuotationTableSheet from './QuotationTableSheet';
import {
  TakeoffRow,
  DEFAULT_HE_SO,
  computeTakeoff,
  TakeoffTemplate,
  normalizeTakeoffRows,
  toTemplateRows,
  instantiateTemplateRows,
  splitCatalogPrice
} from '../lib/takeoffCalc';

/**
 * BẢNG BÓC TÁCH KHỐI LƯỢNG CHI TIẾT — dạng giống file Excel "KL CHI TIẾT" + "PL HỢP ĐỒNG".
 *  - Phần (section) → Hạng mục (item) → các dòng bóc tách chi tiết (line: từng trục/phòng/cửa...)
 *  - KL dòng = Số BP × Dài × Rộng × Cao × S.Phụ (cho phép số âm để trừ cửa, ô trống...)
 *  - Đơn giá hạng mục = (Vật tư + Nhân công) × Hệ số; Thành tiền = KL × Đơn giá
 *  - Đơn giá vật tư/nhân công lấy từ danh mục "Đơn giá vật tư & nhân công" (vẫn sửa được tại chỗ).
 *  - Định mức cấp phối KHÔNG dùng ở đây (chỉ để tra cứu ở màn Định mức).
 */

interface CatalogPrice {
  group: string;
  name: string;
  unit: string;
  avgPrice: number;
  vatTu?: number | null;
  nhanCong?: number | null;
}

interface ConstructionTakeoffProps {
  /** Danh mục đơn giá vật tư & nhân công — nguồn đơn giá chính cho bóc tách */
  materialLaborPrices?: CatalogPrice[];
  currentUser?: any;
  onAddQuote?: (newQuote: any) => void;
  selectedCustomerId?: string;
  setSelectedCustomerId?: (val: string) => void;
  selectedProjectId?: string;
  setSelectedProjectId?: (val: string) => void;
  projectName?: string;
  setProjectName?: (val: string) => void;
  customerName?: string;
  setCustomerName?: (val: string) => void;
  customerAddress?: string;
  setCustomerAddress?: (val: string) => void;
  customerPhone?: string;
  setCustomerPhone?: (val: string) => void;

  // Saved & Lock control props
  isConstructionSaved?: boolean;
  setIsConstructionSaved?: (val: boolean) => void;
  isLocked?: boolean;
  setIsLocked?: (val: boolean) => void;
  loadedQuote?: any;
  setLoadedQuote?: (quote: any) => void;
}

const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const fmt = (v: number, digits = 3) =>
  v.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: digits });

/** Đọc bảng bóc tách đã lưu tạm trong phiên (tự chuyển dữ liệu định dạng cũ sang mới) */
const readSessionRows = (): TakeoffRow[] => {
  try {
    const local = sessionStorage.getItem('takeoff_rows');
    return local ? normalizeTakeoffRows(JSON.parse(local)) : [];
  } catch (e) {
    return [];
  }
};

/** Ô nhập số: để trống = null (bỏ qua khi nhân), cho phép số âm */
function NumCell({
  value, onChange, disabled, className = '', step = 'any'
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  className?: string;
  step?: string;
}) {
  return (
    <input
      type="number"
      step={step}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
      className={`w-full bg-transparent hover:bg-slate-100/50 focus:bg-white rounded px-1 py-1 outline-none border border-slate-200 focus:border-indigo-500 text-right font-mono text-[11px] disabled:opacity-60 ${className}`}
    />
  );
}

export default function ConstructionTakeoff({
  materialLaborPrices = [],
  currentUser,
  onAddQuote,
  selectedCustomerId,
  selectedProjectId,
  projectName,
  customerName,
  customerAddress,
  customerPhone,
  isConstructionSaved = false,
  setIsConstructionSaved,
  isLocked = false,
  setIsLocked,
  loadedQuote,
  setLoadedQuote
}: ConstructionTakeoffProps) {
  const { addToast } = useNotification();

  // Danh sách dòng của bảng (phẳng: section / item / line)
  const [rows, setRows] = useState<TakeoffRow[]>(() => readSessionRows());

  // Nạp bảng bóc tách từ hồ sơ đã lưu (hoặc từ phiên làm việc)
  useEffect(() => {
    if (loadedQuote) {
      setRows(normalizeTakeoffRows(loadedQuote.takeoffRows));
    } else {
      setRows(readSessionRows());
    }
  }, [loadedQuote]);

  // ===== MẪU BÓC TÁCH do người dùng tự tạo (lưu chung trên hệ thống, có bản dự phòng trong máy) =====
  const TEMPLATE_KEY = 'takeoff_templates';
  const [templates, setTemplates] = useState<TakeoffTemplate[]>(() => {
    try { return JSON.parse(localStorage.getItem('hl_' + TEMPLATE_KEY) || '[]'); } catch (e) { return []; }
  });
  const [showTemplates, setShowTemplates] = useState(false);
  // Hộp xác nhận nằm trong ứng dụng, thay cho window.confirm (dễ bị trình duyệt chặn khiến nút không phản hồi)
  const [confirmState, setConfirmState] = useState<{ message: string; okLabel: string; onOk: () => void } | null>(null);
  const askConfirm = (message: string, onOk: () => void, okLabel = 'Đồng ý') => setConfirmState({ message, okLabel, onOk });
  const [newTemplateName, setNewTemplateName] = useState('');

  useEffect(() => {
    dbService.constructionNorms.get(TEMPLATE_KEY)
      .then((cloud: any) => { if (Array.isArray(cloud)) setTemplates(cloud as TakeoffTemplate[]); })
      .catch(() => {});
  }, []);

  // Ghi danh sách mẫu lên hệ thống + bản dự phòng cục bộ
  const persistTemplates = (list: TakeoffTemplate[]) => {
    setTemplates(list);
    try { localStorage.setItem('hl_' + TEMPLATE_KEY, JSON.stringify(list)); } catch (e) { /* bỏ qua */ }
    dbService.constructionNorms.save(TEMPLATE_KEY, list).catch(() => {});
  };

  // Lưu bảng hiện tại thành mẫu (chỉ giữ cấu trúc + đơn giá, bỏ số đo của công trình này)
  const saveAsTemplate = () => {
    const name = newTemplateName.trim();
    if (!name || rows.length === 0) return;
    const existing = templates.find(t => t.name.toLowerCase() === name.toLowerCase());
    const doSave = () => {
      const tpl: TakeoffTemplate = {
        id: existing?.id || `tpl_${Date.now()}`,
        name,
        rows: toTemplateRows(rows),
        createdAt: new Date().toLocaleDateString('vi-VN'),
        createdBy: currentUser?.name
      };
      persistTemplates(existing ? templates.map(t => (t.id === existing.id ? tpl : t)) : [...templates, tpl]);
      setNewTemplateName('');
      addToast({ title: '✅ Đã lưu mẫu', message: `Mẫu "${name}" đã được lưu để dùng cho các công trình khác.`, type: 'success' });
    };
    if (existing) askConfirm(`Đã có mẫu "${existing.name}". Ghi đè bằng bảng hiện tại?`, doSave, 'Ghi đè');
    else doSave();
  };

  // Áp mẫu: thay thế toàn bộ bảng hiện tại (hỏi xác nhận nếu bảng đang có dữ liệu hoặc hồ sơ đang khóa)
  const applyTemplate = (tpl: TakeoffTemplate) => {
    const doApply = () => {
      if (isLocked && setIsLocked) setIsLocked(false); // áp mẫu là một thao tác chỉnh sửa → mở khóa
      setRows(instantiateTemplateRows(tpl.rows));
      setShowTemplates(false);
    };
    if (rows.length > 0 || isLocked) {
      const lockNote = isLocked ? 'Hồ sơ đã lưu đang bị KHÓA — áp mẫu sẽ mở khóa để chỉnh sửa. ' : '';
      askConfirm(`${lockNote}Áp dụng mẫu "${tpl.name}" sẽ THAY THẾ toàn bộ bảng bóc tách hiện tại. Tiếp tục?`, doApply, 'Áp dụng mẫu');
    } else {
      doApply();
    }
  };

  const deleteTemplate = (tpl: TakeoffTemplate) => {
    askConfirm(`Xóa mẫu "${tpl.name}"?`, () => persistTemplates(templates.filter(t => t.id !== tpl.id)), 'Xóa mẫu');
  };

  // State to hold saved quote for print preview modal
  const [savedQuoteForPreview, setSavedQuoteForPreview] = useState<any | null>(null);

  // Lưu tạm vào sessionStorage mỗi khi bảng thay đổi
  useEffect(() => {
    sessionStorage.setItem('takeoff_rows', JSON.stringify(rows));
  }, [rows]);

  // Tính toàn bộ bảng (KL, đơn giá, thành tiền, tổng phần, tổng cộng)
  const { rows: calc, totals } = useMemo(() => computeTakeoff(rows), [rows]);

  // Danh sách hạng mục (để chọn "Lấy KL từ")
  const itemOptions = useMemo(() => calc.filter(r => r.kind === 'item'), [calc]);

  // Danh mục đơn giá chia theo nhóm cho ô chọn nhanh
  const catalogGroups = useMemo(() => {
    const map = new Map<string, CatalogPrice[]>();
    materialLaborPrices.forEach(p => {
      if (!map.has(p.group)) map.set(p.group, []);
      map.get(p.group)!.push(p);
    });
    return Array.from(map.entries());
  }, [materialLaborPrices]);

  // ===== Thao tác trên bảng =====
  const updateRow = (id: string, patch: Partial<TakeoffRow>) => {
    if (isLocked) return;
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  // Thêm 1 phần mới NGAY DƯỚI phần `afterSectionId` (sau toàn bộ hạng mục của phần đó); không truyền id → thêm cuối bảng
  const addSection = (afterSectionId?: string) => {
    if (isLocked) return;
    setRows(rs => {
      let end = rs.length;
      const start = afterSectionId ? rs.findIndex(r => r.id === afterSectionId) : -1;
      if (start >= 0) {
        for (let i = start + 1; i < rs.length; i++) {
          if (rs[i].kind === 'section') { end = i; break; }
        }
      }
      const sec: TakeoffRow = { id: newId('sec'), kind: 'section', name: `${rs.filter(r => r.kind === 'section').length + 1}. PHẦN MỚI` };
      return [...rs.slice(0, end), sec, ...rs.slice(end)];
    });
  };

  // Thêm hạng mục vào cuối phần `sectionId` (kèm sẵn 1 dòng bóc tách trống)
  const addItem = (sectionId: string) => {
    if (isLocked) return;
    setRows(rs => {
      const start = rs.findIndex(r => r.id === sectionId);
      let end = rs.length;
      for (let i = start + 1; i < rs.length; i++) {
        if (rs[i].kind === 'section') { end = i; break; }
      }
      const item: TakeoffRow = { id: newId('it'), kind: 'item', name: 'Hạng mục công việc mới', unit: 'm²', vatTu: 0, nhanCong: 0, heSo: DEFAULT_HE_SO };
      const line: TakeoffRow = { id: newId('ln'), kind: 'line' };
      return [...rs.slice(0, end), item, line, ...rs.slice(end)];
    });
  };

  // Thêm dòng bóc tách vào cuối hạng mục `itemId`
  const addLine = (itemId: string) => {
    if (isLocked) return;
    setRows(rs => {
      const start = rs.findIndex(r => r.id === itemId);
      let end = rs.length;
      for (let i = start + 1; i < rs.length; i++) {
        if (rs[i].kind !== 'line') { end = i; break; }
      }
      return [...rs.slice(0, end), { id: newId('ln'), kind: 'line' }, ...rs.slice(end)];
    });
  };

  // Xóa 1 dòng; xóa hạng mục thì xóa luôn các dòng chi tiết của nó, xóa phần thì xóa cả các hạng mục bên trong
  const deleteRow = (id: string) => {
    if (isLocked) return;
    const start = rows.findIndex(r => r.id === id);
    if (start < 0) return;
    const kind = rows[start].kind;
    let end = start + 1;
    if (kind === 'item') {
      while (end < rows.length && rows[end].kind === 'line') end++;
    } else if (kind === 'section') {
      while (end < rows.length && rows[end].kind !== 'section') end++;
    }
    const removedIds = new Set(rows.slice(start, end).map(r => r.id));
    const removedItems = rows.slice(start, end).filter(r => r.kind === 'item').map(r => r.id);
    const doDelete = () => setRows(rs =>
      // Gỡ liên kết "Lấy KL từ" đang trỏ tới hạng mục bị xóa
      rs.filter(r => !removedIds.has(r.id)).map(r =>
        r.refItemId && removedItems.includes(r.refItemId) ? { ...r, refItemId: undefined } : r
      )
    );
    if (end - start > 1) {
      askConfirm(`Xóa ${kind === 'section' ? 'phần' : 'hạng mục'} này cùng ${end - start - 1} dòng bên trong?`, doDelete, 'Xóa');
    } else {
      doDelete();
    }
  };

  // Chọn hạng mục từ danh mục đơn giá → tự điền tên, ĐVT, đơn giá vật tư, nhân công
  const applyCatalog = (itemId: string, catalogName: string) => {
    const p = materialLaborPrices.find(x => x.name === catalogName);
    if (!p) return;
    const { vatTu, nhanCong } = splitCatalogPrice(p);
    updateRow(itemId, { name: p.name, unit: p.unit, vatTu, nhanCong });
  };

  // Handle Save & Print for construction takeoff
  const handleSaveAndPrint = async () => {
    if (!customerName || !customerName.trim()) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng nhập tên Chủ Đầu Tư trước khi thực hiện Lưu!', type: 'warning' });
      return;
    }
    if (!projectName || !projectName.trim()) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng nhập tên Dự án trước khi thực hiện Lưu!', type: 'warning' });
      return;
    }

    const finalCustomerId = selectedCustomerId || `cust_${Date.now()}`;

    // Load construction estimator fields if they exist in sessionStorage
    const localHouseType = sessionStorage.getItem('hl_construction_house_type') || '';
    const localChieuDai = parseFloat(sessionStorage.getItem('hl_construction_chieu_dai') || '0');
    const localChieuRong = parseFloat(sessionStorage.getItem('hl_construction_chieu_rong') || '0');
    const localSoTang = parseInt(sessionStorage.getItem('hl_construction_so_tang') || '0');
    const localDonGia = parseFloat(sessionStorage.getItem('hl_construction_don_gia') || '0');
    const localNganSach = parseFloat(sessionStorage.getItem('hl_construction_ngan_sach') || '0');
    const localItems = sessionStorage.getItem('hl_construction_items') ? JSON.parse(sessionStorage.getItem('hl_construction_items')!) : [];
    const localNotes = sessionStorage.getItem('hl_construction_notes') || '';
    const localPaymentTerms = sessionStorage.getItem('hl_construction_payment_terms') || '';
    const localConfig = sessionStorage.getItem('hl_construction_config') ? JSON.parse(sessionStorage.getItem('hl_construction_config')!) : { discountPercent: 0, vatPercent: 0 };

    const quoteId = loadedQuote ? loadedQuote.id : `archived_quote_${Date.now()}`;
    const quoteCode = loadedQuote ? loadedQuote.code : `BGXD-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`;

    const generatedQuote = {
      id: quoteId,
      code: quoteCode,
      customerId: finalCustomerId,
      projectId: selectedProjectId || undefined,
      projectName: projectName.trim(),
      chieuDai: localChieuDai,
      chieuRong: localChieuRong,
      soTang: localSoTang,
      selectedHouseType: localHouseType,
      donGiaKhaiToan: localDonGia,
      nganSachNoiThat: localNganSach,
      features: 'Bóc tách khối lượng chi tiết theo từng hạng mục (vật tư + nhân công)',
      minPrice: 0,
      maxPrice: 0,
      dienTichSan: localChieuDai * localChieuRong,
      tongDienTichXayDung: localChieuDai * localChieuRong * localSoTang,
      date: new Date().toISOString().split('T')[0],
      items: localItems,
      config: localConfig,
      status: 'draft',
      notes: localNotes,
      paymentTerms: localPaymentTerms,
      customerName: customerName.trim(),
      customerPhone: (customerPhone || '').trim(),
      customerAddress: (customerAddress || '').trim(),
      takeoffRows: rows // Lưu dữ liệu gốc; số liệu tính lại từ computeTakeoff khi hiển thị/in
    };

    if (onAddQuote) {
      onAddQuote(generatedQuote);
    }

    // Tổng tiền bóc tách dùng cho Báo giá cuối
    const savedTotals = {
      cost: totals.total,
      vatTu: totals.vatTu,
      nhanCong: totals.nhanCong
    };
    sessionStorage.setItem('takeoff_saved_totals', JSON.stringify(savedTotals));

    // Save to archived quotes
    const archivedRecord = {
      ...generatedQuote,
      takeoffTotals: savedTotals,
      creatorId: currentUser?.id || 'emp_1',
      creatorName: currentUser?.name || 'Nhân viên Báo giá',
      sector: 'construction',
      createdAt: loadedQuote?.createdAt || new Date().toLocaleDateString('vi-VN'),
      totalAmount: totals.total
    };

    try {
      await dbService.archivedQuotes.save({ ...archivedRecord, sector: 'construction' });
      if (setIsConstructionSaved) setIsConstructionSaved(true);
      if (setIsLocked) setIsLocked(true);
      if (setLoadedQuote) setLoadedQuote(archivedRecord);

      // Dispatch custom events to trigger reloading of search dropdown and final quote
      window.dispatchEvent(new CustomEvent('hl-archived-quotes-updated'));
      window.dispatchEvent(new CustomEvent('hl-takeoff-saved'));

      addToast({ title: '✅ Thành công', message: `Đã lưu thành công bảng bóc tách ${quoteCode}!`, type: 'success' });
    } catch (err) {
      console.error("Lỗi lưu trữ hồ sơ bóc tách:", err);
      addToast({ title: '❌ Lỗi', message: 'Lỗi khi lưu trữ hồ sơ bóc tách.', type: 'error' });
    }
  };

  // Ô nhập chữ dùng chung cho tên phần / hạng mục / diễn giải dòng
  const textInputCls = 'w-full bg-transparent hover:bg-slate-100/50 focus:bg-white rounded px-1.5 py-1 outline-none border border-slate-200 focus:border-indigo-500 text-left text-[11px] disabled:opacity-60';
  const COLS = 19;

  // Vẽ 1 dòng của bảng (phần / hạng mục / dòng chi tiết)
  const renderRow = (row: any) => {
        // ===== PHẦN =====
        if (row.kind === 'section') {
          return (
            <tr key={row.id} className="bg-indigo-50 text-indigo-900 font-black uppercase text-[11px] tracking-wider border-y border-slate-200">
              <td colSpan={2} className="p-1 border border-slate-200">
                <input
                  type="text"
                  value={row.name || ''}
                  onChange={(e) => updateRow(row.id, { name: e.target.value })}
                  disabled={isLocked}
                  className={`${textInputCls} font-black uppercase bg-white/60`}
                />
              </td>
              <td colSpan={13} className="px-3 py-1.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => addItem(row.id)}
                  disabled={isLocked}
                  className="px-2.5 py-1 text-[9.5px] rounded-lg bg-[#1e40af]/10 hover:bg-[#1e40af]/25 disabled:opacity-35 disabled:cursor-not-allowed text-[#1e40af] font-black uppercase tracking-widest transition-all cursor-pointer inline-flex items-center gap-1 border border-[#1e40af]/20 shadow-sm"
                >
                  <Plus className="w-3 h-3" /> Thêm hạng mục
                </button>
              </td>
              <td className="px-3 py-1.5 border border-slate-200 text-right font-mono font-bold text-sky-800">
                {fmt(row.ttVatTu || 0, 0)}
              </td>
              <td className="px-3 py-1.5 border border-slate-200 text-right font-mono font-bold text-amber-700">
                {fmt(row.ttNhanCong || 0, 0)}
              </td>
              <td className="px-3 py-1.5 border border-slate-200 text-right font-mono font-black text-indigo-900">
                {fmt(row.sectionTotal || 0, 0)}
              </td>
              <td className="px-2 py-1 text-center border border-slate-200">
                <button
                  type="button"
                  onClick={() => deleteRow(row.id)}
                  disabled={isLocked}
                  className="p-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-30 disabled:cursor-not-allowed text-rose-600 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                  title="Xóa phần này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          );
        }

        // ===== HẠNG MỤC =====
        if (row.kind === 'item') {
          return (
            <tr key={row.id} className="border-b border-slate-200 bg-slate-50 font-bold text-slate-900">
              <td className="px-2 py-1 border border-slate-200 text-center font-mono">{row.stt}</td>
              <td className="p-1 border border-slate-200">
                <input
                  type="text"
                  value={row.name || ''}
                  onChange={(e) => updateRow(row.id, { name: e.target.value })}
                  disabled={isLocked}
                  className={`${textInputCls} font-bold text-slate-900`}
                />
              </td>
              {/* Chọn nhanh từ danh mục đơn giá: tự điền tên, ĐVT, vật tư, nhân công */}
              <td colSpan={6} className="p-1 border border-slate-200">
                <select
                  value=""
                  onChange={(e) => applyCatalog(row.id, e.target.value)}
                  disabled={isLocked || catalogGroups.length === 0}
                  className="w-full bg-white text-slate-600 font-semibold rounded px-1 py-1 border border-slate-200 cursor-pointer outline-none text-[11px] disabled:opacity-60"
                  title="Chọn từ danh mục Đơn giá vật tư & nhân công"
                >
                  <option value="">▾ Chọn từ danh mục đơn giá…</option>
                  {catalogGroups.map(([group, list]) => (
                    <optgroup key={group} label={group}>
                      {list.map(p => (
                        <option key={p.name} value={p.name}>{p.name} ({p.unit})</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </td>
              <td className="p-1 border border-slate-200">
                <input
                  type="text"
                  value={row.unit || ''}
                  onChange={(e) => updateRow(row.id, { unit: e.target.value })}
                  disabled={isLocked}
                  placeholder="m²"
                  className={`${textInputCls} text-center font-bold`}
                />
              </td>
              <td className="px-2 py-1 border border-slate-200"></td>
              <td className="px-2 py-1 border border-slate-200 text-right font-mono font-black text-emerald-800">{fmt(row.kl)}</td>
              <td className="p-1 border border-slate-200 bg-amber-50/60">
                <NumCell value={row.vatTu} onChange={(v) => updateRow(row.id, { vatTu: v })} disabled={isLocked} step="500" className="font-bold text-[#1e40af]" />
              </td>
              <td className="p-1 border border-slate-200 bg-amber-50/60">
                <NumCell value={row.nhanCong} onChange={(v) => updateRow(row.id, { nhanCong: v })} disabled={isLocked} step="500" className="font-bold text-[#1e40af]" />
              </td>
              <td className="p-1 border border-slate-200 bg-amber-50/60">
                <NumCell value={row.heSo} onChange={(v) => updateRow(row.id, { heSo: v })} disabled={isLocked} step="0.01" className="text-center" />
              </td>
              <td className="px-2 py-1 border border-slate-200 text-right font-mono">{fmt(row.donGia || 0, 0)}</td>
              <td className="px-3 py-1 border border-slate-200 text-right font-mono text-sky-800 bg-sky-50/50">{fmt(row.ttVatTu || 0, 0)}</td>
              <td className="px-3 py-1 border border-slate-200 text-right font-mono text-amber-700 bg-amber-50/50">{fmt(row.ttNhanCong || 0, 0)}</td>
              <td className="px-3 py-1 border border-slate-200 text-right font-mono font-black text-[#1e40af]">{fmt(row.thanhTien || 0, 0)}</td>
              <td className="px-1 py-1 text-center border border-slate-200">
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => addLine(row.id)}
                    disabled={isLocked}
                    className="p-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-30 disabled:cursor-not-allowed text-indigo-700 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                    title="Thêm dòng bóc tách"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRow(row.id)}
                    disabled={isLocked}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-30 disabled:cursor-not-allowed text-rose-600 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                    title="Xóa hạng mục này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          );
        }

        // ===== DÒNG BÓC TÁCH CHI TIẾT =====
        // Hạng mục cha gần nhất phía trên (loại trừ khỏi danh sách "Lấy KL từ")
        const parentIdx = calc.findIndex(r => r.id === row.id);
        let parentId = '';
        for (let i = parentIdx - 1; i >= 0; i--) {
          if (calc[i].kind === 'item') { parentId = calc[i].id; break; }
          if (calc[i].kind === 'section') break;
        }
        const hasRef = !!row.refItemId;
        return (
          <tr key={row.id} className="border-b border-slate-200 hover:bg-slate-50/80 transition-colors bg-white text-slate-800">
            <td className="px-2 py-1 border border-slate-200"></td>
            <td className="p-1 border border-slate-200 pl-5">
              <input
                type="text"
                value={row.name || ''}
                onChange={(e) => updateRow(row.id, { name: e.target.value })}
                disabled={isLocked}
                placeholder="Vị trí / diễn giải (VD: trục 2, - cửa)"
                className={textInputCls}
              />
            </td>
            <td className="p-1 border border-slate-200"><NumCell value={row.soBP} onChange={(v) => updateRow(row.id, { soBP: v })} disabled={isLocked} /></td>
            <td className="p-1 border border-slate-200">
              {hasRef ? (
                // Dài lấy theo KL hạng mục được liên kết (chỉ đọc)
                <div className="px-1 py-1 text-right font-mono text-[11px] bg-sky-50 border border-sky-200 rounded text-sky-800" title="Lấy theo khối lượng hạng mục được liên kết">
                  {fmt(row.daiHieuLuc || 0)}
                </div>
              ) : (
                <NumCell value={row.dai} onChange={(v) => updateRow(row.id, { dai: v })} disabled={isLocked} />
              )}
            </td>
            <td className="p-1 border border-slate-200"><NumCell value={row.rong} onChange={(v) => updateRow(row.id, { rong: v })} disabled={isLocked} /></td>
            <td className="p-1 border border-slate-200"><NumCell value={row.cao} onChange={(v) => updateRow(row.id, { cao: v })} disabled={isLocked} /></td>
            <td className="p-1 border border-slate-200"><NumCell value={row.phu} onChange={(v) => updateRow(row.id, { phu: v })} disabled={isLocked} /></td>
            <td className="p-1 border border-slate-200">
              <select
                value={row.refItemId || ''}
                onChange={(e) => updateRow(row.id, { refItemId: e.target.value || undefined })}
                disabled={isLocked}
                className="w-full bg-white text-slate-600 rounded px-1 py-1 border border-slate-200 cursor-pointer outline-none text-[10.5px] disabled:opacity-60"
                title="Lấy khối lượng toàn phần của hạng mục khác thay cho ô Dài (VD: láng nền = lát nền)"
              >
                <option value="">—</option>
                {itemOptions.filter(it => it.id !== parentId).map(it => (
                  <option key={it.id} value={it.id}>= HM {it.stt}. {it.name}</option>
                ))}
              </select>
            </td>
            <td className="px-2 py-1 border border-slate-200"></td>
            <td className={`px-2 py-1 border border-slate-200 text-right font-mono ${row.kl < 0 ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>{fmt(row.kl)}</td>
            <td colSpan={8} className="px-2 py-1 border border-slate-200 bg-slate-50/40"></td>
            <td className="px-2 py-1 text-center border border-slate-200">
              <button
                type="button"
                onClick={() => deleteRow(row.id)}
                disabled={isLocked}
                className="p-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-30 disabled:cursor-not-allowed text-rose-600 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                title="Xóa dòng này"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        );
  };

  // Với mỗi phần: id dòng cuối cùng của phần đó → id của phần (để gắn dòng nút thêm ngay dưới phần)
  const blockEnd = useMemo(() => {
    const m = new Map<string, string>();
    let sec: string | null = null;
    calc.forEach((r, i) => {
      if (r.kind === 'section') sec = r.id;
      const next = calc[i + 1];
      if (sec && (!next || next.kind === 'section')) m.set(r.id, sec);
    });
    return m;
  }, [calc]);

  // Dòng nút nằm cuối mỗi phần
  const sectionFooter = (secId: string) => (
    <tr className="bg-slate-50/70 border-b border-dashed border-slate-300">
      <td colSpan={COLS} className="px-3 py-1.5 border border-slate-200">
        <div className="flex items-center gap-2 pl-8">
          <button
            type="button"
            onClick={() => addItem(secId)}
            disabled={isLocked}
            className="px-2.5 py-1 text-[9.5px] rounded-lg bg-[#1e40af]/10 hover:bg-[#1e40af]/25 disabled:opacity-35 disabled:cursor-not-allowed text-[#1e40af] font-black uppercase tracking-widest transition-all cursor-pointer inline-flex items-center gap-1 border border-[#1e40af]/20"
          >
            <Plus className="w-3 h-3" /> Thêm hạng mục
          </button>
          <button
            type="button"
            onClick={() => addSection(secId)}
            disabled={isLocked}
            className="px-2.5 py-1 text-[9.5px] rounded-lg bg-emerald-50 hover:bg-emerald-100 disabled:opacity-35 disabled:cursor-not-allowed text-emerald-700 font-black uppercase tracking-widest transition-all cursor-pointer inline-flex items-center gap-1 border border-emerald-200"
          >
            <Plus className="w-3 h-3" /> Thêm phần mới bên dưới
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-5 text-left" id="takeoff_container">
      {/* HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <h2 className="text-base font-black text-slate-100 flex items-center gap-2 uppercase tracking-wide">
            <FileText className="w-5 h-5 text-indigo-400" /> Bảng Bóc Tách Khối Lượng Vật Tư Chi Tiết
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Bóc tách từng dòng chi tiết (Số BP × Dài × Rộng × Cao × S.Phụ, nhập số âm để trừ), đơn giá vật tư – nhân công lấy từ danh mục Đơn giá
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTemplates(true)}
            className="px-3 py-2 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
            title="Lưu bảng hiện tại thành mẫu hoặc áp dụng mẫu có sẵn"
          >
            <LayoutTemplate className="w-3.5 h-3.5" /> Mẫu bóc tách ({templates.length})
          </button>
        </div>
      </div>

      {/* BẢNG BÓC TÁCH (dạng file Excel) */}
      <div className="w-full overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
        <table className="w-full text-left border-collapse table-fixed min-w-[1800px] border border-slate-200 font-sans text-slate-800" style={{ fontSize: '11px', lineHeight: '1.3' }}>
          <thead>
            <tr className="bg-[#1e40af] text-white font-extrabold uppercase tracking-wider text-[10.5px] border-b border-slate-300">
              <th rowSpan={2} className="px-2 py-2 w-[45px] text-center border border-slate-300">STT</th>
              <th rowSpan={2} className="px-3 py-2 w-[290px] text-left border border-slate-300">Nội dung công việc</th>
              <th rowSpan={2} className="px-2 py-2 w-[60px] text-center border border-slate-300">Số BP</th>
              <th colSpan={3} className="px-2 py-1.5 text-center border border-slate-300">Kích thước (m)</th>
              <th rowSpan={2} className="px-2 py-2 w-[60px] text-center border border-slate-300">S.Phụ</th>
              <th rowSpan={2} className="px-2 py-2 w-[115px] text-center border border-slate-300">Lấy KL từ HM</th>
              <th rowSpan={2} className="px-2 py-2 w-[60px] text-center border border-slate-300">ĐVT</th>
              <th colSpan={2} className="px-2 py-1.5 text-center border border-slate-300">Khối lượng</th>
              <th rowSpan={2} className="px-2 py-2 w-[100px] text-right border border-slate-300">Đơn giá vật tư (đ)</th>
              <th rowSpan={2} className="px-2 py-2 w-[100px] text-right border border-slate-300">Đơn giá nhân công (đ)</th>
              <th rowSpan={2} className="px-2 py-2 w-[60px] text-center border border-slate-300">Hệ số</th>
              <th rowSpan={2} className="px-2 py-2 w-[100px] text-right border border-slate-300">Đơn giá (đ)</th>
              <th rowSpan={2} className="px-3 py-2 w-[120px] text-right border border-slate-300 bg-sky-700">Thành tiền vật tư (đ)</th>
              <th rowSpan={2} className="px-3 py-2 w-[120px] text-right border border-slate-300 bg-amber-600">Thành tiền nhân công (đ)</th>
              <th rowSpan={2} className="px-3 py-2 w-[130px] text-right border border-slate-300">Thành tiền (đ)</th>
              <th rowSpan={2} className="px-2 py-2 w-[90px] text-center border border-slate-300">Thao tác</th>
            </tr>
            <tr className="bg-[#1e40af] text-white font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-300">
              <th className="px-2 py-1.5 w-[70px] text-center border border-slate-300">Dài</th>
              <th className="px-2 py-1.5 w-[70px] text-center border border-slate-300">Rộng</th>
              <th className="px-2 py-1.5 w-[70px] text-center border border-slate-300">Cao</th>
              <th className="px-2 py-1.5 w-[85px] text-right border border-slate-300">Từng phần</th>
              <th className="px-2 py-1.5 w-[90px] text-right border border-slate-300">Toàn phần</th>
            </tr>
          </thead>
          <tbody className="text-xs">
            {calc.length === 0 && (
              <tr className="border-b border-slate-200 text-slate-500 font-medium italic bg-slate-50/20">
                <td colSpan={COLS} className="px-4 py-6 text-center">
                  Bảng đang trống. Bấm "Mẫu bóc tách" để áp dụng mẫu có sẵn, hoặc thêm phần đầu tiên để tự lập.
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => addSection()}
                      disabled={isLocked}
                      className="px-3 py-1.5 text-[10.5px] rounded-lg bg-emerald-50 hover:bg-emerald-100 disabled:opacity-35 text-emerald-700 font-black uppercase tracking-widest cursor-pointer inline-flex items-center gap-1 border border-emerald-200 not-italic"
                    >
                      <Plus className="w-3 h-3" /> Thêm phần
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {calc.map(row => {
              const el = renderRow(row);
              const secId = blockEnd.get(row.id);
              // Hàng cuối của mỗi phần: thêm dòng nút "Thêm hạng mục / Thêm phần" ngay tại chỗ, khỏi kéo lên đầu bảng
              return secId ? <React.Fragment key={row.id}>{el}{sectionFooter(secId)}</React.Fragment> : el;
            })}

            {/* TỔNG CỘNG */}
            <tr className="bg-[#047857] text-white text-[11px] font-black uppercase tracking-wider border-t-2 border-slate-300">
              <td colSpan={11} className="px-3.5 py-2.5 text-left border border-emerald-700">TỔNG CỘNG ({totals.itemCount} hạng mục)</td>
              <td colSpan={4} className="border border-emerald-700"></td>
              <td className="px-3 py-2.5 text-right border border-emerald-700 font-mono bg-sky-900/40" title="Tổng thành tiền vật tư (đã gồm hệ số)">{fmt(totals.vatTu, 0)}</td>
              <td className="px-3 py-2.5 text-right border border-emerald-700 font-mono bg-amber-800/40" title="Tổng thành tiền nhân công (đã gồm hệ số)">{fmt(totals.nhanCong, 0)}</td>
              <td className="px-3 py-2.5 text-right border border-emerald-700 bg-[#022c22]/30 font-mono text-sm">{fmt(totals.total, 0)}</td>
              <td className="border border-emerald-700"></td>
            </tr>
            <tr className="bg-emerald-50 text-emerald-900 text-[11px] font-black uppercase tracking-wider">
              <td colSpan={17} className="px-3.5 py-2 text-right border border-slate-200">LÀM TRÒN (đến nghìn):</td>
              <td className="px-3 py-2 text-right border border-slate-200 font-mono text-sm">{fmt(totals.rounded, 0)}</td>
              <td className="border border-slate-200"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-[10.5px] text-slate-500 italic">
        Đơn giá = (Vật tư + Nhân công) × Hệ số. Thành tiền vật tư = KL × Đơn giá vật tư × Hệ số; Thành tiền nhân công = phần còn lại; hai cột cộng lại đúng bằng Thành tiền.
        Định mức cấp phối chỉ để tra cứu, không tham gia tính toán.
      </p>

      {/* FOOTER CONTROLS */}
      <div className="flex justify-end items-center gap-2.5 pt-2">
        {/* Nút Chỉnh sửa */}
        <button
          type="button"
          onClick={() => setIsLocked && setIsLocked(false)}
          disabled={!isConstructionSaved || !isLocked}
          className="bg-amber-550 hover:bg-amber-600 text-white disabled:opacity-30 disabled:cursor-not-allowed font-semibold px-4 py-2.5 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-200 shadow-md"
          title={!isConstructionSaved ? "Nút Chỉnh sửa chỉ mở khi hồ sơ Đã Lưu" : !isLocked ? "Đang trong chế độ chỉnh sửa" : "Chỉnh sửa số liệu báo giá"}
        >
          <Edit className="w-4 h-4" /> Chỉnh sửa
        </button>

        {/* Nút Lưu / Đã Lưu */}
        <button
          type="button"
          onClick={handleSaveAndPrint}
          disabled={(isConstructionSaved && isLocked) || !projectName || !projectName.trim() || !customerName || !customerName.trim() || !customerPhone || !customerPhone.trim() || !customerAddress || !customerAddress.trim()}
          className={`${isConstructionSaved && isLocked ? 'bg-slate-500 hover:bg-slate-500 cursor-not-allowed' : 'bg-[#00a651] hover:bg-[#008f43]'} text-white disabled:opacity-30 disabled:cursor-not-allowed font-semibold px-4 py-2.5 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-200 shadow-md`}
          title={(!projectName || !projectName.trim() || !customerName || !customerName.trim() || !customerPhone || !customerPhone.trim() || !customerAddress || !customerAddress.trim()) ? "Vui lòng nhập đầy đủ các trường bắt buộc (DỰ ÁN, CHỦ ĐẦU TƯ, SỐ ĐIỆN THOẠI, ĐỊA CHỈ THI CÔNG)" : isConstructionSaved && isLocked ? "Hồ sơ đã được lưu" : "Lưu hồ sơ báo giá"}
        >
          {isConstructionSaved && isLocked ? (
            <>
              <Check className="w-4 h-4" /> Đã Lưu
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> Lưu
            </>
          )}
        </button>

        {/* Nút Xem & In */}
        <button
          type="button"
          onClick={() => setSavedQuoteForPreview(loadedQuote || {
            id: `temp_${Date.now()}`,
            code: 'BGXD-TEMP',
            customerId: selectedCustomerId || 'temp',
            projectId: selectedProjectId || undefined,
            projectName: projectName,
            chieuDai: parseFloat(sessionStorage.getItem('hl_construction_chieu_dai') || '0'),
            chieuRong: parseFloat(sessionStorage.getItem('hl_construction_chieu_rong') || '0'),
            soTang: parseInt(sessionStorage.getItem('hl_construction_so_tang') || '0'),
            selectedHouseType: sessionStorage.getItem('hl_construction_house_type') || '',
            donGiaKhaiToan: parseFloat(sessionStorage.getItem('hl_construction_don_gia') || '0'),
            nganSachNoiThat: parseFloat(sessionStorage.getItem('hl_construction_ngan_sach') || '0'),
            dienTichSan: parseFloat(sessionStorage.getItem('hl_construction_chieu_dai') || '0') * parseFloat(sessionStorage.getItem('hl_construction_chieu_rong') || '0'),
            tongDienTichXayDung: parseFloat(sessionStorage.getItem('hl_construction_chieu_dai') || '0') * parseFloat(sessionStorage.getItem('hl_construction_chieu_rong') || '0') * parseInt(sessionStorage.getItem('hl_construction_so_tang') || '0'),
            date: new Date().toISOString().split('T')[0],
            items: sessionStorage.getItem('hl_construction_items') ? JSON.parse(sessionStorage.getItem('hl_construction_items')!) : [],
            config: sessionStorage.getItem('hl_construction_config') ? JSON.parse(sessionStorage.getItem('hl_construction_config')!) : { discountPercent: 0, vatPercent: 0 },
            notes: sessionStorage.getItem('hl_construction_notes') || '',
            paymentTerms: sessionStorage.getItem('hl_construction_payment_terms') || '',
            customerName: customerName,
            customerPhone: customerPhone,
            customerAddress: customerAddress,
            takeoffRows: rows
          })}
          disabled={!isConstructionSaved || !isLocked}
          className="bg-indigo-600 text-white hover:bg-indigo-550 disabled:opacity-30 disabled:cursor-not-allowed font-semibold px-4 py-2.5 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-200 shadow-md"
          title={!isConstructionSaved ? "Vui lòng lưu hồ sơ trước khi Xem & In" : !isLocked ? "Vui lòng hoàn tất chỉnh sửa và lưu trước khi Xem & In" : "Xem chi tiết & In ấn"}
        >
          <Printer className="w-4 h-4" /> Xem & In
        </button>
      </div>

      {/* Modal Mẫu bóc tách */}
      {showTemplates && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl text-slate-100 text-left">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4" /> Mẫu bóc tách
              </h3>
              <button type="button" onClick={() => setShowTemplates(false)} className="text-slate-400 hover:text-white cursor-pointer" title="Đóng">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 text-xs">
              {/* Lưu bảng hiện tại thành mẫu */}
              <div className="space-y-2">
                <label className="block text-slate-400 font-bold">Lưu bảng hiện tại thành mẫu mới:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveAsTemplate(); }}
                    placeholder="VD: Nhà phố cải tạo, Nhà cấp 4 xây mới..."
                    className="flex-1 bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-semibold"
                  />
                  <button
                    type="button"
                    onClick={saveAsTemplate}
                    disabled={!newTemplateName.trim() || rows.length === 0}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-35 disabled:cursor-not-allowed text-white font-bold cursor-pointer flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" /> Lưu mẫu
                  </button>
                </div>
                <p className="text-[10.5px] text-slate-500 italic">
                  Mẫu giữ các phần, hạng mục, ĐVT, đơn giá vật tư – nhân công, hệ số và tên các dòng chi tiết. Số đo của công trình hiện tại không được lưu.
                </p>
              </div>

              {/* Danh sách mẫu */}
              <div className="space-y-2">
                <label className="block text-slate-400 font-bold">Mẫu đã có:</label>
                {templates.length === 0 ? (
                  <div className="text-center text-slate-500 italic py-5 border border-dashed border-slate-800 rounded-xl">
                    Chưa có mẫu nào. Hãy lập bảng bóc tách rồi lưu thành mẫu.
                  </div>
                ) : (
                  templates.map(tpl => {
                    const secCount = tpl.rows.filter(r => r.kind === 'section').length;
                    const itemCount = tpl.rows.filter(r => r.kind === 'item').length;
                    return (
                      <div key={tpl.id} className="flex items-center justify-between gap-3 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-100 truncate">{tpl.name}</div>
                          <div className="text-[10.5px] text-slate-500">
                            {secCount} phần · {itemCount} hạng mục{tpl.createdAt ? ` · ${tpl.createdAt}` : ''}{tpl.createdBy ? ` · ${tpl.createdBy}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => applyTemplate(tpl)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                            title="Thay thế bảng hiện tại bằng mẫu này"
                          >
                            Áp dụng
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTemplate(tpl)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer"
                            title="Xóa mẫu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hộp xác nhận trong ứng dụng */}
      {confirmState && (
        <div className="fixed inset-0 bg-slate-950/80 z-[150] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-5 text-left text-slate-100 space-y-4">
            <p className="text-sm font-semibold leading-relaxed">{confirmState.message}</p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmState(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => { const ok = confirmState.onOk; setConfirmState(null); ok(); }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
              >
                {confirmState.okLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Print Preview Modal */}
      {savedQuoteForPreview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 select-text text-slate-800">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-200">
                  <FileText className="w-4 h-4 text-[#00a651]" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                    Xem chi tiết hồ sơ bóc tách khối lượng vật tư
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">Bảng bóc tách khối lượng vật tư chi tiết tạo lập tự động - HOANG LONG ERP</p>
                </div>
              </div>
              <button
                onClick={() => setSavedQuoteForPreview(null)}
                className="text-slate-400 hover:text-slate-800 font-black cursor-pointer bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-4 md:p-6 bg-slate-100 overflow-y-auto grow">
              <QuotationTableSheet quoteData={savedQuoteForPreview} />
            </div>

            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setSavedQuoteForPreview(null)}
                className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer"
              >
                Thoát
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-5 py-2.5 bg-[#00a651] hover:bg-[#008f43] text-white font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-all hover:scale-[1.01]"
              >
                <Printer className="w-3.5 h-3.5" />
                In Chi Tiết Bóc Tách
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
