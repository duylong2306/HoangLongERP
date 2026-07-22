import React, { useState, useMemo, useEffect } from 'react';
import { Printer, Save, RotateCcw, Check, FileText, Edit } from 'lucide-react';
import { dbService } from '../lib/dbService';
import { useNotification } from '../context';
import QuotationTableSheet from './QuotationTableSheet';

function calculateTakeoffTotalsFromRows(rows: any[], norms: any[]) {
  let gach = 0;
  let ximang = 0;
  let cat = 0;
  let da = 0;
  let thep = 0;
  let cost = 0;

  rows.forEach(row => {
    const d = parseFloat(row.dai as any) || 0;
    const r = parseFloat(row.rong as any) || 0;
    const c = parseFloat(row.cao as any) || 0;
    const qty = parseFloat(row.qty as any) || 0;
    
    // I. Khối lượng tổng
    let klTong = 0;
    if (qty > 0) {
      if (row.unit === 'm³') {
        klTong = d * r * c * qty;
      } else if (row.unit === 'm²') {
        const depthOrHeight = r > 0 ? r : (c > 0 ? c : 1);
        klTong = d * depthOrHeight * qty;
      } else {
        klTong = qty;
      }
    }

    // Hao hụt multiplier
    const haoMultiplier = 1 + (parseFloat(row.haoHut as any) || 0) / 100;

    // II. Lookup composition norm
    let rowGach = 0;
    let rowXimang = 0;
    let rowCat = 0;
    let rowDa = 0;
    let rowThep = 0;

    if (row.maDM) {
      const norm = norms.find(n => n.id.toLowerCase() === row.maDM.toLowerCase());
      if (norm) {
        rowGach = (parseFloat(norm.brick) || 0) * klTong * haoMultiplier;
        rowXimang = (parseFloat(norm.cement) || 0) * klTong * haoMultiplier;
        rowCat = (parseFloat(norm.sand) || 0) * klTong * haoMultiplier;
        rowDa = (parseFloat(norm.stone) || 0) * klTong * haoMultiplier;
        rowThep = (parseFloat(norm.steel) || 0) * klTong * haoMultiplier;
      }
    }

    // III. Thành tiền
    const rowCost = klTong * haoMultiplier * (parseFloat(row.price as any) || 0);

    gach += rowGach;
    ximang += rowXimang;
    cat += rowCat;
    da += rowDa;
    thep += rowThep;
    cost += rowCost;
  });

  return { gach, ximang, cat, da, thep, cost };
}

interface FinalQuoteItem {
  id: string;
  category: string;
  name: string;
  unit: string;
  qty: number;
  price: number;
  isAuto: boolean;
  note: string;
}

interface ConstructionFinalQuoteProps {
  currentUser?: any;
  selectedCustomerId?: string;
  selectedProjectId?: string;
  projectName?: string;
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;
  onAddQuote?: (quote: any) => void;

  // Saved & Lock control props
  isConstructionSaved?: boolean;
  setIsConstructionSaved?: (val: boolean) => void;
  isLocked?: boolean;
  setIsLocked?: (val: boolean) => void;
  loadedQuote?: any;
  setLoadedQuote?: (quote: any) => void;
}

const DEFAULT_FINAL_ITEMS: Omit<FinalQuoteItem, 'qty'>[] = [
  // VẬT LIỆU CHÍNH
  { id: 'gach', category: 'VẬT LIỆU CHÍNH', name: 'Gạch xây (đặc + rỗng)', unit: 'viên', price: 2875, isAuto: true, note: 'Từ bảng bóc tách' },
  { id: 'ximang', category: 'VẬT LIỆU CHÍNH', name: 'Xi măng PCB40 (Hà Tiên/Hoàng Thạch)', unit: 'kg', price: 2185, isAuto: true, note: 'Từ bảng bóc tách' },
  { id: 'cat', category: 'VẬT LIỆU CHÍNH', name: 'Cát xây (cát vàng/cát sông)', unit: 'm³', price: 379500, isAuto: true, note: 'Từ bảng bóc tách' },
  { id: 'da', category: 'VẬT LIỆU CHÍNH', name: 'Đá dăm 1x2 & 2x4 (bê tông + lót)', unit: 'm³', price: 414000, isAuto: true, note: 'Từ bảng bóc tách' },
  { id: 'thep', category: 'VẬT LIỆU CHÍNH', name: 'Thép CB300-V phi 10-12 (chịu lực)', unit: 'kg', price: 20125, isAuto: true, note: 'Từ bảng bóc tách' },
  { id: 'thep_cb400', category: 'VẬT LIỆU CHÍNH', name: 'Thép CB400-V phi 14-22 (cột dầm)', unit: 'kg', price: 21275, isAuto: false, note: 'Nhập thủ công' },
  { id: 'thep_cb240', category: 'VẬT LIỆU CHÍNH', name: 'Thép CB240-T phi 6-8 (đai, cấu tạo)', unit: 'kg', price: 18975, isAuto: false, note: 'Nhập thủ công' },
  { id: 'nuoc', category: 'VẬT LIỆU CHÍNH', name: 'Nước thi công', unit: 'm³', price: 23000, isAuto: false, note: 'Ước tính ~10m³/100m² sàn' },

  // HOÀN THIỆN
  { id: 'son_noithat', category: 'HOÀN THIỆN', name: 'Sơn nước nội thất (Dulux/Jotun)', unit: 'lít', price: 112700, isAuto: false, note: 'Nhập thủ công' },
  { id: 'son_ngoai_that', category: 'HOÀN THIỆN', name: 'Sơn nước ngoại thất chống thấm', unit: 'lít', price: 143750, isAuto: false, note: 'Nhập thủ công' },
  { id: 'gach_ceramic', category: 'HOÀN THIỆN', name: 'Gạch ceramic ốp tường (30x60)', unit: 'm²', price: 155250, isAuto: false, note: 'Nhập thủ công' },
  { id: 'gach_granite', category: 'HOÀN THIỆN', name: 'Gạch granite lát sàn (60x60)', unit: 'm²', price: 241500, isAuto: false, note: 'Nhập thủ công' },
  { id: 'keo_dan_gach', category: 'HOÀN THIỆN', name: 'Keo dán gạch (Mapei/Bostik)', unit: 'kg', price: 10925, isAuto: false, note: '~5 kg/m² gạch' },
  { id: 'chong_tham_sika', category: 'HOÀN THIỆN', name: 'Chống thấm Sika (sàn mái + WC)', unit: 'kg', price: 74750, isAuto: false, note: '~2-3 kg/m²' },
  { id: 'thach_cao', category: 'HOÀN THIỆN', name: 'Thạch cao tấm (vách, trần)', unit: 'm²', price: 124200, isAuto: false, note: 'Nhập thủ công' },

  // CỬA & KẾT CẤU
  { id: 'cua_nhom_1', category: 'CỬA & KẾT CẤU', name: 'Cửa nhôm kính 1 cánh (W800×H2100)', unit: 'bộ', price: 3680000, isAuto: false, note: 'Đếm theo bản vẽ' },
  { id: 'cua_nhom_2', category: 'CỬA & KẾT CẤU', name: 'Cửa nhôm kính 2 cánh (W1200×H2100)', unit: 'bộ', price: 5980000, isAuto: false, note: 'Đếm theo bản vẽ' },
  { id: 'cua_go_hdf', category: 'CỬA & KẾT CẤU', name: 'Cửa đi gỗ HDF chống ẩm', unit: 'bộ', price: 4600000, isAuto: false, note: 'Phòng ngủ/WC' },

  // NHÂN CÔNG
  { id: 'tho_xay', category: 'NHÂN CÔNG', name: 'Thợ xây gạch bậc 3/7', unit: 'ca', price: 490500, isAuto: false, note: 'Ước tính ca theo KL' },
  { id: 'tho_betong', category: 'NHÂN CÔNG', name: 'Thợ đổ bê tông + cốp pha bậc 3.5/7', unit: 'ca', price: 545000, isAuto: false, note: 'Ước tính ca theo KL' },
  { id: 'tho_thep', category: 'NHÂN CÔNG', name: 'Thợ cốt thép bậc 4/7', unit: 'ca', price: 577700, isAuto: false, note: 'Ước tính ca theo KL' },
  { id: 'nhan_cong_pt', category: 'NHÂN CÔNG', name: 'Nhân công phổ thông', unit: 'ca', price: 381500, isAuto: false, note: 'Vận chuyển, đào đất' },

  // MÁY & THIẾT BỊ
  { id: 'may_bom', category: 'MÁY & THIẾT BỊ', name: 'Máy bơm bê tông (thuê ca)', unit: 'ca', price: 3335000, isAuto: false, note: '1 ca = 1 lần đổ BT' },
  { id: 'may_tron', category: 'MÁY & THIẾT BỊ', name: 'Máy trộn bê tông 250L', unit: 'ca', price: 460000, isAuto: false, note: 'Nếu không thuê bơm' },
];

export default function ConstructionFinalQuote({
  currentUser,
  selectedCustomerId,
  selectedProjectId,
  projectName = '',
  customerName = '',
  customerAddress = '',
  customerPhone = '',
  onAddQuote,
  isConstructionSaved = false,
  setIsConstructionSaved,
  isLocked = false,
  setIsLocked,
  loadedQuote,
  setLoadedQuote
}: ConstructionFinalQuoteProps) {
  const { addToast } = useNotification();
  // Load quantities and prices when loadedQuote changes
  useEffect(() => {
    if (loadedQuote && loadedQuote.finalItems) {
      const loadedQuantities: Record<string, number> = {};
      const loadedPrices: Record<string, number> = {};
      
      // Initialize with 0 and default prices first
      DEFAULT_FINAL_ITEMS.forEach(item => {
        loadedQuantities[item.id] = 0;
        loadedPrices[item.id] = item.price;
      });

      loadedQuote.finalItems.forEach((item: any) => {
        loadedQuantities[item.id] = item.qty !== undefined && item.qty !== null ? item.qty : 0;
        loadedPrices[item.id] = item.price !== undefined && item.price !== null ? item.price : (DEFAULT_FINAL_ITEMS.find(df => df.id === item.id)?.price || 0);
      });
      setQuantities(loadedQuantities);
      setPrices(loadedPrices);
    } else if (!loadedQuote) {
      // Reset to defaults when no quote is loaded (or starting new quote)
      const initialQuantities: Record<string, number> = {};
      const initialPrices: Record<string, number> = {};
      DEFAULT_FINAL_ITEMS.forEach(item => {
        initialQuantities[item.id] = 0;
        initialPrices[item.id] = item.price;
      });
      
      // Try fallback to sessionStorage
      const localQuantities = sessionStorage.getItem('hl_final_quote_quantities');
      const localPrices = sessionStorage.getItem('hl_final_quote_prices');
      
      if (localQuantities) {
        try {
          const parsed = JSON.parse(localQuantities);
          Object.assign(initialQuantities, parsed);
        } catch (e) {}
      }
      if (localPrices) {
        try {
          const parsed = JSON.parse(localPrices);
          Object.assign(initialPrices, parsed);
        } catch (e) {}
      }
      
      setQuantities(initialQuantities);
      setPrices(initialPrices);
    }
  }, [loadedQuote]);
  const [takeoffUpdateTrigger, setTakeoffUpdateTrigger] = useState(0);

  useEffect(() => {
    const handleUpdate = () => {
      setTakeoffUpdateTrigger(prev => prev + 1);
    };
    window.addEventListener('hl-archived-quotes-updated', handleUpdate);
    window.addEventListener('hl-takeoff-saved', handleUpdate);
    return () => {
      window.removeEventListener('hl-archived-quotes-updated', handleUpdate);
      window.removeEventListener('hl-takeoff-saved', handleUpdate);
    };
  }, []);

  // 1. Get takeoff calculation totals in real-time from localStorage or saved state
  const takeoffTotalsAndCost = useMemo(() => {
    try {
      // If loadedQuote has takeoffTotals directly, use it!
      if (loadedQuote && loadedQuote.takeoffTotals) {
        return {
          gach: loadedQuote.takeoffTotals.gach || 0,
          ximang: loadedQuote.takeoffTotals.ximang || 0,
          cat: loadedQuote.takeoffTotals.cat || 0,
          da: loadedQuote.takeoffTotals.da || 0,
          thep: loadedQuote.takeoffTotals.thep || 0,
          cost: loadedQuote.takeoffTotals.cost || 0
        };
      }
      
      // If loadedQuote has takeoffRows, compute from it!
      if (loadedQuote && loadedQuote.takeoffRows && loadedQuote.takeoffRows.length > 0) {
        const materialCompositionNormsLocal = localStorage.getItem('material_composition_norms');
        const parsedNorms = materialCompositionNormsLocal ? JSON.parse(materialCompositionNormsLocal) : [];
        return calculateTakeoffTotalsFromRows(loadedQuote.takeoffRows, parsedNorms);
      }

      // Check if we have saved totals in sessionStorage
      const savedTotalsLocal = sessionStorage.getItem('takeoff_saved_totals');
      if (savedTotalsLocal) {
        const parsed = JSON.parse(savedTotalsLocal);
        if (parsed && typeof parsed === 'object' && parsed.gach !== undefined) {
          return {
            gach: parsed.gach || 0,
            ximang: parsed.ximang || 0,
            cat: parsed.cat || 0,
            da: parsed.da || 0,
            thep: parsed.thep || 0,
            cost: parsed.cost || 0
          };
        }
      }

      // Fallback: calculate from sessionStorage takeoff_rows
      const takeoffRowsLocal = sessionStorage.getItem('takeoff_rows');
      const materialCompositionNormsLocal = localStorage.getItem('material_composition_norms');

      const parsedRows = takeoffRowsLocal ? JSON.parse(takeoffRowsLocal) : [];
      const parsedNorms = materialCompositionNormsLocal ? JSON.parse(materialCompositionNormsLocal) : [];

      return calculateTakeoffTotalsFromRows(parsedRows, parsedNorms);
    } catch (e) {
      console.error("Error calculating takeoff totals:", e);
      return { gach: 0, ximang: 0, cat: 0, da: 0, thep: 0, cost: 0 };
    }
  }, [loadedQuote, takeoffUpdateTrigger]);

  const takeoffTotals = takeoffTotalsAndCost;

  // 2. Load manual quantities and customized unit prices
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    DEFAULT_FINAL_ITEMS.forEach(item => {
      initial[item.id] = 0;
    });
    
    const local = sessionStorage.getItem('hl_final_quote_quantities');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        return { ...initial, ...parsed };
      } catch (e) {
        return initial;
      }
    }
    return initial;
  });

  const [prices, setPrices] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    DEFAULT_FINAL_ITEMS.forEach(item => {
      initial[item.id] = item.price;
    });

    const local = sessionStorage.getItem('hl_final_quote_prices');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        return { ...initial, ...parsed };
      } catch (e) {
        return initial;
      }
    }
    return initial;
  });

  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState(false);
  const [savedQuoteForPreview, setSavedQuoteForPreview] = useState<any | null>(null);

  // Selection mechanism: which result to use for the final quote
  // 'takeoff' = Tổng chi phí dự toán từ bảng bóc tách cuối cùng
  // 'preEstimate' = Khái toán xây dựng sơ bộ (từ tab Lập Báo Giá)
  const [selectedFinalResult, setSelectedFinalResult] = useState<'takeoff' | 'preEstimate' | null>(
    loadedQuote?.selectedFinalResult || null
  );

  // Load selectedFinalResult when loadedQuote changes
  useEffect(() => {
    if (loadedQuote && loadedQuote.selectedFinalResult) {
      setSelectedFinalResult(loadedQuote.selectedFinalResult);
    }
  }, [loadedQuote]);

  // 3. Save to sessionStorage reactively
  useEffect(() => {
    sessionStorage.setItem('hl_final_quote_quantities', JSON.stringify(quantities));
  }, [quantities]);

  useEffect(() => {
    sessionStorage.setItem('hl_final_quote_prices', JSON.stringify(prices));
  }, [prices]);

  // 4. Combine default items with updated quantities and prices
  const finalItems = useMemo<FinalQuoteItem[]>(() => {
    return DEFAULT_FINAL_ITEMS.map(item => {
      let qty = quantities[item.id] || 0;
      if (item.isAuto) {
        if (item.id === 'gach') qty = takeoffTotals.gach;
        else if (item.id === 'ximang') qty = takeoffTotals.ximang;
        else if (item.id === 'cat') qty = takeoffTotals.cat;
        else if (item.id === 'da') qty = takeoffTotals.da;
        else if (item.id === 'thep') qty = takeoffTotals.thep;
      }
      return {
        ...item,
        qty,
        price: prices[item.id] !== undefined ? prices[item.id] : item.price
      };
    });
  }, [takeoffTotals, quantities, prices]);

  // 5. Total cost calculations
  const grandTotalCost = useMemo(() => {
    return finalItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
  }, [finalItems]);

  // 6. Get Pre-estimate total from Lập báo cáo xây dựng
  const preEstimateAmount = useMemo(() => {
    try {
      const localItems = sessionStorage.getItem('hl_construction_items') ? JSON.parse(sessionStorage.getItem('hl_construction_items')!) : [];
      const localConfig = sessionStorage.getItem('hl_construction_config') ? JSON.parse(sessionStorage.getItem('hl_construction_config')!) : { discountPercent: 0 };
      
      const subtotal = localItems.reduce((acc: number, item: any) => acc + (item.totalPrice || 0), 0);
      const discountVal = Math.round(subtotal * ((localConfig.discountPercent || 0) / 100));
      const totalQuoteAmount = subtotal - discountVal;

      if (totalQuoteAmount > 0) return totalQuoteAmount;

      // Fallback to dimensions-based budget
      const localChieuDai = parseFloat(sessionStorage.getItem('hl_construction_chieu_dai') || '0');
      const localChieuRong = parseFloat(sessionStorage.getItem('hl_construction_chieu_rong') || '0');
      const localSoTang = parseInt(sessionStorage.getItem('hl_construction_so_tang') || '0');
      const localDonGia = parseFloat(sessionStorage.getItem('hl_construction_don_gia') || '0');
      const totalBuildingBudget = localChieuDai * localChieuRong * localSoTang * localDonGia;

      return totalBuildingBudget || 2140000000; // Default mockup from the image if nothing is calculated
    } catch (e) {
      console.error(e);
      return 2140000000;
    }
  }, []);

  const takeoffCostTotal = takeoffTotalsAndCost.cost;
  const priceDifference = takeoffCostTotal - preEstimateAmount;
  const priceDifferencePercent = preEstimateAmount > 0 ? (priceDifference / preEstimateAmount) * 100 : 0;

  // 7. Handle changes in input fields
  const handleQuantityChange = (id: string, value: string) => {
    const num = parseFloat(value) || 0;
    setQuantities(prev => ({
      ...prev,
      [id]: num >= 0 ? num : 0
    }));
  };

  const handlePriceChange = (id: string, value: string) => {
    const num = parseFloat(value) || 0;
    setPrices(prev => ({
      ...prev,
      [id]: num >= 0 ? num : 0
    }));
  };

  // 8. Save quote action with Print preview tab trigger
  const handleSaveFinalQuote = async () => {
    if (!projectName || !projectName.trim() || !customerName || !customerName.trim() || !customerPhone || !customerPhone.trim() || !customerAddress || !customerAddress.trim()) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng nhập đầy đủ thông tin dự án trước khi Lưu!', type: 'warning' });
      return;
    }

    if (!selectedFinalResult) {
      addToast({ title: '⚠️ Chưa chọn kết quả', message: 'Vui lòng chọn KẾT QUẢ BÁO GIÁ CUỐI CÙNG trước khi Lưu!', type: 'warning' });
      return;
    }

    const finalCustomerId = selectedCustomerId || `cust_${Date.now()}`;
    const quoteId = loadedQuote ? loadedQuote.id : `quote_final_${Date.now()}`;
    const quoteCode = loadedQuote ? loadedQuote.code : `BGCQ-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`;

    // Determine the selected final amount
    const selectedFinalAmount = selectedFinalResult === 'preEstimate' ? preEstimateAmount : takeoffCostTotal;

    const generatedQuote = {
      id: quoteId,
      code: quoteCode,
      customerId: finalCustomerId,
      projectId: selectedProjectId || undefined,
      projectName: projectName.trim(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim(),
      createdAt: loadedQuote?.createdAt || new Date().toLocaleDateString('vi-VN'),
      totalAmount: selectedFinalAmount,
      status: 'approved',
      finalItems: finalItems,
      takeoffRows: JSON.parse(sessionStorage.getItem('takeoff_rows') || '[]'),
      takeoffTotals: takeoffTotals,
      isFinalQuote: true,
      selectedFinalResult: selectedFinalResult,
      // Store both amounts for reference
      preEstimateAmount: preEstimateAmount,
      takeoffCostTotal: takeoffCostTotal
    };

    if (onAddQuote) {
      onAddQuote(generatedQuote);
    }

    try {
      await dbService.archivedQuotes.save({ ...generatedQuote, sector: 'construction' });
      setIsSavedSuccessfully(true);
      setSavedQuoteForPreview(generatedQuote);
      if (setIsConstructionSaved) setIsConstructionSaved(true);
      if (setIsLocked) setIsLocked(true);
      if (setLoadedQuote) setLoadedQuote(generatedQuote);
      
      // Dispatch custom event to trigger reloading of search dropdown
      window.dispatchEvent(new CustomEvent('hl-archived-quotes-updated'));

      addToast({ title: '✅ Thành công', message: `Đã lưu thành công Báo giá cuối cùng ${quoteCode}!`, type: 'success' });
      setTimeout(() => setIsSavedSuccessfully(false), 3000);
    } catch (err) {
      console.error("Lỗi lưu trữ báo giá cuối cùng:", err);
      addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi lưu trữ Báo giá cuối cùng.', type: 'error' });
    }
  };

  // 9. Reset action
  const handleReset = () => {
    if (window.confirm('Bạn có chắc muốn đặt lại toàn bộ số lượng nhập thủ công và đơn giá về mặc định không?')) {
      const initialQuantities: Record<string, number> = {};
      const initialPrices: Record<string, number> = {};
      DEFAULT_FINAL_ITEMS.forEach(item => {
        initialQuantities[item.id] = 0;
        initialPrices[item.id] = item.price;
      });
      setQuantities(initialQuantities);
      setPrices(initialPrices);
    }
  };

  // 10. Print action
  const handlePrint = () => {
    window.print();
  };

  // Group items by category
  const categories = ['VẬT LIỆU CHÍNH', 'HOÀN THIỆN', 'CỬA & KẾT CẤU', 'NHÂN CÔNG', 'MÁY & THIẾT BỊ'];

  return (
    <div className="space-y-4 w-full text-slate-100 font-sans text-left" id="final_construction_quote_component">
      
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm print:hidden no-print">
        <div className="space-y-0.5">
          <h2 className="text-sm font-black uppercase text-indigo-400 tracking-wider">
            ⚙️ Quản lý Báo Giá Cuối Cùng
          </h2>
          <p className="text-[11px] text-slate-400">
            Tổng hợp dữ liệu từ bảng bóc tách chi tiết kết hợp nhập bổ sung các hạng mục hoàn thiện, lắp đặt, thợ thầy và máy móc.
          </p>
        </div>
      </div>

      {/* Main Quotation Content / Card */}
      <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-slate-200 text-slate-900 leading-normal max-w-5xl mx-auto my-1 relative print:border-none print:shadow-none print:p-0 print:text-black">
        
        {/* Dynamic Table */}
        <div className="w-full overflow-x-auto my-4 border border-slate-200 rounded-xl bg-white shadow-sm">
          <table className="w-full text-left border-collapse border border-slate-200 font-sans text-slate-800" style={{ fontSize: '11px', lineHeight: '1.3' }}>
            <thead>
              <tr className="bg-[#1e40af] text-white font-extrabold border-b border-slate-300 uppercase tracking-wider text-center text-[10.5px]">
                <th className="px-3 py-3 border border-slate-300 w-[45px]">STT</th>
                <th className="px-4 py-3 border border-slate-300 text-left min-w-[240px]">Tên vật tư / nhân công / dịch vụ</th>
                <th className="px-3 py-3 border border-slate-300 w-[65px] text-center">Đơn vị</th>
                <th className="px-3 py-3 border border-slate-300 w-[110px] text-center">Tổng KL</th>
                <th className="px-3 py-3 border border-slate-300 w-[120px] text-right">Đơn giá (đ)</th>
                <th className="px-3 py-3 border border-slate-300 w-[130px] text-right">Thành tiền (đ)</th>
                <th className="px-4 py-3 border border-slate-300 text-left min-w-[150px]">Ghi chú / Nguồn</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let sttCounter = 1;
                return categories.map(cat => {
                  const itemsInCat = finalItems.filter(item => item.category === cat);
                  if (itemsInCat.length === 0) return null;

                  return (
                    <React.Fragment key={cat}>
                      {/* Section header row */}
                      <tr className="bg-[#3b82f6]/10 font-black text-[#1e40af] text-[11px] uppercase border-y border-slate-200">
                        <td colSpan={7} className="px-3 py-2 text-left tracking-wide">
                          {cat}
                        </td>
                      </tr>

                      {/* Item rows */}
                      {itemsInCat.map(item => {
                        const amount = item.qty * item.price;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-slate-700 text-center">
                            <td className="px-3 py-2.5 border border-slate-200 font-medium text-slate-500">{sttCounter++}</td>
                            <td className="px-4 py-2.5 border border-slate-200 text-left font-bold text-slate-900 leading-tight">
                              {item.name}
                            </td>
                            <td className="px-3 py-2.5 border border-slate-200 font-medium text-slate-600 text-center">
                              {item.unit}
                            </td>
                            
                            {/* Quantity column */}
                            <td className="px-3 py-2.5 border border-slate-200 font-mono text-center">
                              {item.isAuto ? (
                                <div className="inline-block px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold rounded-md text-[11px]">
                                  {item.qty.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              ) : (
                                <input
                                  type="number"
                                  step="any"
                                  value={quantities[item.id] !== undefined ? quantities[item.id] : 0}
                                  onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                  disabled={isLocked}
                                  className="w-20 bg-amber-50/50 hover:bg-amber-100/40 text-amber-900 focus:bg-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-extrabold text-center border border-amber-200 rounded-md py-0.5 text-[11px] print:border-none print:bg-transparent print:p-0 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                              )}
                            </td>

                            {/* Price column with creamy yellow background */}
                            <td className="px-3 py-2.5 border border-slate-200 font-mono text-right bg-amber-50/30">
                              <input
                                type="number"
                                value={prices[item.id] !== undefined ? prices[item.id] : item.price}
                                onChange={(e) => handlePriceChange(item.id, e.target.value)}
                                disabled={isLocked}
                                className="w-24 bg-transparent hover:bg-amber-100/40 text-[#1e40af] focus:bg-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-extrabold text-right border border-amber-100 rounded-md py-0.5 px-1 print:border-none print:p-0 transition-all text-[11px] disabled:opacity-60 disabled:cursor-not-allowed"
                              />
                            </td>

                            {/* Total cost column */}
                            <td className="px-3 py-2.5 border border-slate-200 font-mono text-right font-bold text-slate-900">
                              {amount.toLocaleString('vi-VN')}
                            </td>

                            <td className="px-4 py-2.5 border border-slate-200 text-left text-[11px] italic text-slate-500 leading-normal">
                              {item.note}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                });
              })()}

              {/* Green Grand Total Banner */}
              <tr className="bg-[#047857] text-white text-xs font-black uppercase tracking-wider text-center border-t-2 border-slate-300">
                <td colSpan={2} className="px-4 py-3.5 text-left border border-emerald-800 font-extrabold">
                  TỔNG CHI PHÍ VẬT TƯ & NHÂN CÔNG (từ bóc tách)
                </td>
                <td colSpan={3} className="border border-emerald-800"></td>
                <td className="px-4 py-3.5 text-right border border-emerald-800 font-mono text-[13px] font-black">
                  {grandTotalCost.toLocaleString('vi-VN')} đ
                </td>
                <td className="border border-emerald-800"></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* COMPARISON WITH PRE-ESTIMATE SECTION */}
        <div className="mt-8 border border-slate-200 rounded-xl overflow-hidden bg-slate-50 shadow-sm font-sans" id="comparison_section">
          <div className="bg-[#2563eb] py-2.5 px-4 text-left">
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider m-0">
              📊 SO SÁNH VỚI KHÁI TOÁN BAN ĐẦU
            </h3>
          </div>
          <div className="p-4 text-xs font-medium space-y-3 text-slate-800">
            <div className="grid grid-cols-12 gap-2 border-b border-slate-200 pb-2">
              <div className="col-span-8 text-left font-semibold text-slate-700">Khái toán xây dựng sơ bộ (từ tab Lập Báo Giá):</div>
              <div className="col-span-4 text-right font-mono font-bold text-[#2563eb]">
                {preEstimateAmount.toLocaleString('vi-VN')} đ
              </div>
            </div>
            <div className="grid grid-cols-12 gap-2 border-b border-slate-200 pb-2">
              <div className="col-span-8 text-left font-semibold text-slate-700">Tổng chi phí dự toán từ bảng bóc tách cuối cùng:</div>
              <div className="col-span-4 text-right font-mono font-bold text-emerald-700">
                {takeoffCostTotal.toLocaleString('vi-VN')} đ
              </div>
            </div>
            <div className="grid grid-cols-12 gap-2 border-b border-slate-200 pb-2">
              <div className="col-span-8 text-left font-semibold text-slate-700">Chênh lệch tuyệt đối (Dự toán - Khái toán):</div>
              <div className="col-span-4 text-right font-mono font-bold" style={{ color: priceDifference >= 0 ? '#b91c1c' : '#c2410c' }}>
                {priceDifference >= 0 ? '+' : ''}{priceDifference.toLocaleString('vi-VN')} đ
              </div>
            </div>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-8 text-left font-semibold text-slate-700">Tỷ lệ chênh lệch dự tính (%):</div>
              <div className="col-span-4 text-right font-mono font-bold" style={{ color: priceDifference >= 0 ? '#b91c1c' : '#c2410c' }}>
                {priceDifference >= 0 ? '+' : ''}{priceDifferencePercent.toFixed(2)}%
              </div>
            </div>

            {/* SELECTION MECHANISM */}
            <div className="mt-4 pt-4 border-t-2 border-dashed border-blue-300 bg-white rounded-xl p-4">
              <h4 className="text-[11px] font-black uppercase text-blue-700 tracking-wider mb-3 flex items-center gap-2">
                🎯 CHỌN KẾT QUẢ BÁO GIÁ CUỐI CÙNG
              </h4>
              <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                Bước quyết định: Chọn kết quả báo giá cuối cùng để lập Hợp Đồng Xây Dựng.
                Kết quả được chọn sẽ được dùng để tính ngược Đơn Giá & Thành Tiền trong bảng khối lượng công việc của Hợp Đồng.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedFinalResult('preEstimate')}
                  disabled={isLocked}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    selectedFinalResult === 'preEstimate'
                      ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
                  } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedFinalResult === 'preEstimate' ? 'border-blue-500' : 'border-slate-300'
                    }`}>
                      {selectedFinalResult === 'preEstimate' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    <span className="text-[11px] font-black text-blue-700 uppercase">Khái Toán Sơ Bộ</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Từ tab Lập Báo Giá (Kết cấu móng, cột dầm)</p>
                  <p className="text-[11px] font-mono font-bold text-blue-600 mt-1">
                    {preEstimateAmount.toLocaleString('vi-VN')} đ
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedFinalResult('takeoff')}
                  disabled={isLocked}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    selectedFinalResult === 'takeoff'
                      ? 'border-emerald-500 bg-emerald-50 shadow-md ring-2 ring-emerald-200'
                      : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30'
                  } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedFinalResult === 'takeoff' ? 'border-emerald-500' : 'border-slate-300'
                    }`}>
                      {selectedFinalResult === 'takeoff' && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                    </div>
                    <span className="text-[11px] font-black text-emerald-700 uppercase">Bóc Tách Chi Tiết</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Từ bảng bóc tách cuối cùng (Vật tư, nhân công)</p>
                  <p className="text-[11px] font-mono font-bold text-emerald-600 mt-1">
                    {takeoffCostTotal.toLocaleString('vi-VN')} đ
                  </p>
                </button>
              </div>

              {selectedFinalResult && (
                <div className="mt-3 p-2.5 bg-slate-100 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Kết quả được chọn: </span>
                  <span className="text-[11px] font-black text-slate-800">
                    {selectedFinalResult === 'preEstimate'
                      ? `Khái Toán Sơ Bộ — ${preEstimateAmount.toLocaleString('vi-VN')} đ`
                      : `Bóc Tách Chi Tiết — ${takeoffCostTotal.toLocaleString('vi-VN')} đ`
                    }
                  </span>
                </div>
              )}

              {!selectedFinalResult && (
                <div className="mt-3 p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-700">⚠️ Vui lòng chọn kết quả báo giá cuối cùng trước khi Lưu!</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

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
          onClick={handleSaveFinalQuote}
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
            code: 'BGCQ-TEMP',
            customerId: selectedCustomerId || 'temp',
            projectId: selectedProjectId || undefined,
            projectName: projectName,
            customerName: customerName,
            customerPhone: customerPhone,
            customerAddress: customerAddress,
            createdAt: new Date().toLocaleDateString('vi-VN'),
            totalAmount: grandTotalCost,
            status: 'approved',
            finalItems: finalItems,
            takeoffRows: JSON.parse(sessionStorage.getItem('takeoff_rows') || '[]'),
            isFinalQuote: true
          })}
          disabled={!isConstructionSaved || !isLocked}
          className="bg-indigo-600 text-white hover:bg-indigo-550 disabled:opacity-30 disabled:cursor-not-allowed font-semibold px-4 py-2.5 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-200 shadow-md"
          title={!isConstructionSaved ? "Vui lòng lưu hồ sơ trước khi Xem & In" : !isLocked ? "Vui lòng hoàn tất chỉnh sửa và lưu trước khi Xem & In" : "Xem chi tiết & In ấn"}
        >
          <Printer className="w-4 h-4" /> Xem & In
        </button>
      </div>

      {/* Dynamic Print Preview Modal */}
      {savedQuoteForPreview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 select-text text-slate-800">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-200">
                  <FileText className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                    Xem chi tiết hồ sơ báo giá cuối cùng
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">Báo giá cuối cùng tạo lập tự động - HOANG LONG ERP</p>
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
              <QuotationTableSheet quoteData={savedQuoteForPreview} initialTab="final_quote" />
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
                In Báo Giá Cuối Cùng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
