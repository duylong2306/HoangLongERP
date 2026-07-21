import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, RotateCcw, Save, Check, FileText, Printer, X, Edit } from 'lucide-react';
import { dbService } from '../lib/dbService';
import { useNotification } from '../context';
import QuotationTableSheet from './QuotationTableSheet';

interface TakeoffRow {
  id: string;
  category: string;
  name: string;
  maDM: string;
  unit: string;
  dai: number;
  rong: number;
  cao: number;
  qty: number;
  haoHut: number; // e.g. 5 for 5%
  price: number;
}

interface ConstructionTakeoffProps {
  materialCompositionNorms: any[];
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

const DEFAULT_TAKEOFF_ROWS: TakeoffRow[] = [
  // I. PHẦN MÓNG & NỀN MÓNG
  {
    id: 'tk_1',
    category: 'I. PHẦN MÓNG & NỀN MÓNG',
    name: 'Đào đất móng băng bằng máy đào (<=4m)',
    maDM: '',
    unit: 'm³',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 0,
    price: 35000
  },
  {
    id: 'tk_2',
    category: 'I. PHẦN MÓNG & NỀN MÓNG',
    name: 'Đào đất móng đơn thủ công',
    maDM: '',
    unit: 'm³',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 0,
    price: 55000
  },
  {
    id: 'tk_3',
    category: 'I. PHẦN MÓNG & NỀN MÓNG',
    name: 'Bê tông lót móng mác 100 (đá 4x6)',
    maDM: 'AB.11111',
    unit: 'm³',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 5,
    price: 2200000
  },
  {
    id: 'tk_4',
    category: 'I. PHẦN MÓNG & NỀN MÓNG',
    name: 'Bê tông móng băng mác 200 (đá 2x4)',
    maDM: 'AB.11211',
    unit: 'm³',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 5,
    price: 2600000
  },
  {
    id: 'tk_5',
    category: 'I. PHẦN MÓNG & NỀN MÓNG',
    name: 'Cốt thép móng băng CB300-V phi 12',
    maDM: '',
    unit: 'kg',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 5,
    price: 16500
  },

  // II. PHẦN THÂN - CỘT, DẦM, SÀN
  {
    id: 'tk_6',
    category: 'II. PHẦN THÂN - CỘT, DẦM, SÀN',
    name: 'Bê tông cột tầng 1 mác 250 (0.25x0.25x3.5m)',
    maDM: 'AB.21111',
    unit: 'm³',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 5,
    price: 2800000
  },
  {
    id: 'tk_7',
    category: 'II. PHẦN THÂN - CỘT, DẦM, SÀN',
    name: 'Cốt thép cột phi 16-18 CB400-V',
    maDM: '',
    unit: 'kg',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 5,
    price: 17200
  },
  {
    id: 'tk_8',
    category: 'II. PHẦN THÂN - CỘT, DẦM, SÀN',
    name: 'Bê tông dầm chính mác 250 (0.3x0.5m)',
    maDM: 'AB.31111',
    unit: 'm³',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 5,
    price: 2800000
  },
  {
    id: 'tk_9',
    category: 'II. PHẦN THÂN - CỘT, DẦM, SÀN',
    name: 'Bê tông sàn tầng 1 mác 200 (dày 10cm)',
    maDM: 'AB.41111',
    unit: 'm³',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 5,
    price: 2600000
  },
  {
    id: 'tk_10',
    category: 'II. PHẦN THÂN - CỘT, DẦM, SÀN',
    name: 'Cốt thép sàn CB300-V phi 10 (2 lớp)',
    maDM: '',
    unit: 'kg',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 5,
    price: 16500
  },
  {
    id: 'tk_11',
    category: 'II. PHẦN THÂN - CỘT, DẦM, SÀN',
    name: 'Cầu thang BTCT (gộp cốt thép, bê tông)',
    maDM: 'AB.51111',
    unit: 'm³',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 5,
    price: 3500000
  },

  // III. PHẦN TƯỜNG XÂY GẠCH
  {
    id: 'tk_12',
    category: 'III. PHẦN TƯỜNG XÂY GẠCH',
    name: 'Xây tường ngoài gạch đặc 200mm (M75#)',
    maDM: 'AK.11121',
    unit: 'm³',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 5,
    price: 1800000
  },
  {
    id: 'tk_13',
    category: 'III. PHẦN TƯỜNG XÂY GẠCH',
    name: 'Xây tường trong gạch đặc 105mm (M75#)',
    maDM: 'AK.11111',
    unit: 'm³',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 5,
    price: 1700000
  },
  {
    id: 'tk_14',
    category: 'III. PHẦN TƯỜNG XÂY GẠCH',
    name: 'Xây tường ngăn gạch rỗng 6L 105mm (M50#)',
    maDM: 'AK.11221',
    unit: 'm³',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 5,
    price: 1600000
  },

  // IV. PHẦN TRÁT, CHỐNG THẤM, HOÀN THIỆN
  {
    id: 'tk_15',
    category: 'IV. PHẦN TRÁT, CHỐNG THẤM, HOÀN THIỆN',
    name: 'Trát tường trong dày 15mm (M50#)',
    maDM: 'AF.11111',
    unit: 'm²',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 8,
    price: 85000
  },
  {
    id: 'tk_16',
    category: 'IV. PHẦN TRÁT, CHỐNG THẤM, HOÀN THIỆN',
    name: 'Trát tường ngoài dày 20mm (M75#)',
    maDM: 'AF.21111',
    unit: 'm²',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 8,
    price: 95000
  },
  {
    id: 'tk_17',
    category: 'IV. PHẦN TRÁT, CHỐNG THẤM, HOÀN THIỆN',
    name: 'Trát trần dày 10mm (M50#)',
    maDM: 'AF.31111',
    unit: 'm²',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 8,
    price: 90000
  },
  {
    id: 'tk_18',
    category: 'IV. PHẦN TRÁT, CHỐNG THẤM, HOÀN THIỆN',
    name: 'Chống thấm sàn vệ sinh (Sika, 2 lớp)',
    maDM: '',
    unit: 'm²',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 10,
    price: 180000
  },

  // V. ỐP LÁT & HOÀN THIỆN MẶT
  {
    id: 'tk_19',
    category: 'V. ỐP LÁT & HOÀN THIỆN MẶT',
    name: 'Lát gạch granite 60x60 sàn phòng khách',
    maDM: 'AD.21111',
    unit: 'm²',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 8,
    price: 350000
  },
  {
    id: 'tk_20',
    category: 'V. ỐP LÁT & HOÀN THIỆN MẶT',
    name: 'Ốp gạch ceramic 30x60 tường WC',
    maDM: 'AD.11111',
    unit: 'm²',
    dai: 0,
    rong: 0,
    cao: 0,
    qty: 0,
    haoHut: 10,
    price: 220000
  }
];

const CATEGORIES = [
  'I. PHẦN MÓNG & NỀN MÓNG',
  'II. PHẦN THÂN - CỘT, DẦM, SÀN',
  'III. PHẦN TƯỜNG XÂY GẠCH',
  'IV. PHẦN TRÁT, CHỐNG THẤM, HOÀN THIỆN',
  'V. ỐP LÁT & HOÀN THIỆN MẶT'
];

export default function ConstructionTakeoff({
  materialCompositionNorms,
  currentUser,
  onAddQuote,
  selectedCustomerId,
  setSelectedCustomerId,
  selectedProjectId,
  setSelectedProjectId,
  projectName,
  setProjectName,
  customerName,
  setCustomerName,
  customerAddress,
  setCustomerAddress,
  customerPhone,
  setCustomerPhone,
  isConstructionSaved = false,
  setIsConstructionSaved,
  isLocked = false,
  setIsLocked,
  loadedQuote,
  setLoadedQuote
}: ConstructionTakeoffProps) {
  const { addToast } = useNotification();
  // Table rows state
  const [rows, setRows] = useState<TakeoffRow[]>(() => {
    const local = sessionStorage.getItem('takeoff_rows');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        return parsed && parsed.length > 0 ? parsed : DEFAULT_TAKEOFF_ROWS;
      } catch (e) {
        return DEFAULT_TAKEOFF_ROWS;
      }
    }
    return DEFAULT_TAKEOFF_ROWS;
  });

  // Load saved takeoff rows from loadedQuote
  useEffect(() => {
    if (loadedQuote) {
      if (loadedQuote.takeoffRows && loadedQuote.takeoffRows.length > 0) {
        setRows(loadedQuote.takeoffRows);
      } else {
        setRows(DEFAULT_TAKEOFF_ROWS);
      }
    } else {
      const local = sessionStorage.getItem('takeoff_rows');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (parsed && parsed.length > 0) {
            setRows(parsed);
          } else {
            setRows(DEFAULT_TAKEOFF_ROWS);
          }
        } catch (e) {
          setRows(DEFAULT_TAKEOFF_ROWS);
        }
      } else {
        setRows(DEFAULT_TAKEOFF_ROWS);
      }
    }
  }, [loadedQuote]);

  // State to hold saved quote for print preview modal
  const [savedQuoteForPreview, setSavedQuoteForPreview] = useState<{ items: any[]; totalAmount: number; code: string; date: string } | null>(null);

  // Save state to sessionStorage reactively
  useEffect(() => {
    sessionStorage.setItem('takeoff_rows', JSON.stringify(rows));
  }, [rows]);

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
    const localConfig = sessionStorage.getItem('hl_construction_config') ? JSON.parse(sessionStorage.getItem('hl_construction_config')!) : { discountPercent: 0, vatPercent: 8 };

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
      features: 'Quy chuẩn kết cấu thô và bóc tách khối lượng chi tiết',
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
      takeoffRows: calculatedRows // Use the calculated rows state
    };

    if (onAddQuote) {
      onAddQuote(generatedQuote);
    }

    // Save exact computed totals to sessionStorage for use in ConstructionFinalQuote
    const savedTotals = {
      gach: overallTotals.gachTotal,
      ximang: overallTotals.ximangTotal,
      cat: overallTotals.catTotal,
      da: overallTotals.daTotal,
      thep: overallTotals.thepTotal,
      cost: overallTotals.costTotal
    };
    sessionStorage.setItem('takeoff_saved_totals', JSON.stringify(savedTotals));

    // Save to archived quotes
    const archivedRecord = {
      ...generatedQuote,
      takeoffTotals: savedTotals, // also attach takeoffTotals directly to the saved record
      creatorId: currentUser?.id || 'emp_1',
      creatorName: currentUser?.name || 'Nhân viên Báo giá',
      sector: 'construction',
      createdAt: loadedQuote?.createdAt || new Date().toLocaleDateString('vi-VN'),
      totalAmount: overallTotals.costTotal
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

  // Reset to default template
  const handleReset = () => {
    if (window.confirm('Bạn có chắc chắn muốn cài đặt lại Bảng Bóc Tách về giá trị mẫu mặc định không?')) {
      setRows(DEFAULT_TAKEOFF_ROWS);
    }
  };

  // Add new blank row under a category
  const handleAddRow = (category: string) => {
    if (isLocked) return;
    const newRow: TakeoffRow = {
      id: `tk_custom_${Date.now()}`,
      category,
      name: 'Hạng mục công việc mới',
      maDM: '',
      unit: 'm³',
      dai: 0,
      rong: 0,
      cao: 0,
      qty: 0,
      haoHut: 5,
      price: 0
    };
    setRows([...rows, newRow]);
  };

  // Delete a row
  const handleDeleteRow = (id: string) => {
    if (isLocked) return;
    setRows(rows.filter(r => r.id !== id));
  };

  // Handle cell edit
  const handleCellChange = (id: string, field: keyof TakeoffRow, value: any) => {
    if (isLocked) return;
    setRows(rows.map(r => {
      if (r.id === id) {
        const updatedRow = { ...r, [field]: value };
        
        // If Mã ĐM changed, auto-populate details from norm if match found
        if (field === 'maDM') {
          const norm = materialCompositionNorms.find(n => n.id.toLowerCase() === value.trim().toLowerCase());
          if (norm) {
            updatedRow.name = norm.name;
            updatedRow.unit = norm.unit;
          }
        }
        return updatedRow;
      }
      return r;
    }));
  };

  // Safe calculators for material and totals
  const calculatedRows = useMemo(() => {
    return rows.map(row => {
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
      let gach = 0;
      let ximang = 0;
      let cat = 0;
      let da = 0;
      let thep = 0;

      if (row.maDM) {
        const norm = materialCompositionNorms.find(n => n.id.toLowerCase() === row.maDM.toLowerCase());
        if (norm) {
          gach = (parseFloat(norm.brick) || 0) * klTong * haoMultiplier;
          ximang = (parseFloat(norm.cement) || 0) * klTong * haoMultiplier;
          cat = (parseFloat(norm.sand) || 0) * klTong * haoMultiplier;
          da = (parseFloat(norm.stone) || 0) * klTong * haoMultiplier;
          thep = (parseFloat(norm.steel) || 0) * klTong * haoMultiplier;
        }
      }

      // III. Thành tiền
      const cost = klTong * haoMultiplier * (parseFloat(row.price as any) || 0);

      return {
        ...row,
        klTong,
        gach,
        ximang,
        cat,
        da,
        thep,
        cost
      };
    });
  }, [rows, materialCompositionNorms]);

  // Totals for all sections combined
  const overallTotals = useMemo(() => {
    let klTongTotal = 0;
    let gachTotal = 0;
    let ximangTotal = 0;
    let catTotal = 0;
    let daTotal = 0;
    let thepTotal = 0;
    let costTotal = 0;

    calculatedRows.forEach(r => {
      klTongTotal += r.klTong;
      gachTotal += r.gach;
      ximangTotal += r.ximang;
      catTotal += r.cat;
      daTotal += r.da;
      thepTotal += r.thep;
      costTotal += r.cost;
    });

    return {
      klTongTotal,
      gachTotal,
      ximangTotal,
      catTotal,
      daTotal,
      thepTotal,
      costTotal
    };
  }, [calculatedRows]);

  // Helper colors for Category Rows matching visual styles
  const getCategoryHeaderStyle = (category: string) => {
    if (category.includes('MÓNG')) return 'bg-indigo-50 border-slate-200 text-indigo-900';
    if (category.includes('THÂN')) return 'bg-blue-50 border-slate-200 text-blue-900';
    if (category.includes('TƯỜNG')) return 'bg-amber-50 border-slate-200 text-amber-900';
    if (category.includes('TRÁT')) return 'bg-emerald-50 border-slate-200 text-emerald-900';
    return 'bg-violet-50 border-slate-200 text-violet-900';
  };

  return (
    <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-5 text-left" id="takeoff_container">
      {/* HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <h2 className="text-base font-black text-slate-100 flex items-center gap-2 uppercase tracking-wide">
            <FileText className="w-5 h-5 text-indigo-400" /> Bảng Bóc Tách Khối Lượng Vật Tư Chi Tiết
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Tự động bóc tách gạch, xi măng, cát, đá, thép theo định mức và tính đơn giá khái toán công tác</p>
        </div>
      </div>

      {/* DETAILED TAKE-OFF SPREADSHEET TABLE */}
      <div className="w-full overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
        <table className="w-full text-left border-collapse table-fixed min-w-[1585px] border border-slate-200 font-sans text-slate-800" style={{ fontSize: '11px', lineHeight: '1.3' }}>
          <thead>
            <tr className="bg-[#1e40af] text-white font-extrabold uppercase tracking-wider text-[10.5px] border-b border-slate-300">
              <th className="px-3 py-3 w-[260px] text-left border border-slate-300">Tên công tác / Hạng mục</th>
              <th className="px-2 py-3 w-[220px] text-center border border-slate-300">Mã ĐM</th>
              <th className="px-2 py-3 w-[55px] text-center border border-slate-300">ĐVT</th>
              <th className="px-2 py-3 w-[70px] text-center border border-slate-300">Dài (m)</th>
              <th className="px-2 py-3 w-[70px] text-center border border-slate-300">Rộng (m)</th>
              <th className="px-2 py-3 w-[70px] text-center border border-slate-300">Cao (m)</th>
              <th className="px-2 py-3 w-[65px] text-center border border-slate-300">Số lượng</th>
              <th className="px-2 py-3 w-[85px] text-right border border-slate-300">KL tổng</th>
              <th className="px-2 py-3 w-[75px] text-center border border-slate-300">Hao hụt</th>
              <th className="px-2 py-3 w-[95px] text-right border border-slate-300">Gạch (viên)</th>
              <th className="px-2 py-3 w-[95px] text-right border border-slate-300">Xi măng (kg)</th>
              <th className="px-2 py-3 w-[85px] text-right border border-slate-300">Cát (m³)</th>
              <th className="px-2 py-3 w-[85px] text-right border border-slate-300">Đá (m³)</th>
              <th className="px-2 py-3 w-[95px] text-right border border-slate-300">Thép (kg)</th>
              <th className="px-2 py-3 w-[120px] text-right border border-slate-300">Đơn giá (đ)</th>
              <th className="px-3 py-3 w-[140px] text-right border border-slate-300">Thành tiền (đ)</th>
              <th className="px-2 py-3 w-[50px] text-center border border-slate-300">Xóa</th>
            </tr>
          </thead>
          <tbody className="text-xs">
            {CATEGORIES.map(category => {
              // Get rows belonging to this section
              const catRows = calculatedRows.filter(r => r.category === category);
              const headerStyle = getCategoryHeaderStyle(category);

              return (
                <React.Fragment key={category}>
                  {/* Category Section Row */}
                  <tr className={`${headerStyle} font-black uppercase text-[11px] tracking-wider border-y border-slate-200`}>
                    <td colSpan={16} className="px-3.5 py-2">
                      <div className="flex items-center justify-between">
                        <span>{category}</span>
                        <button
                          type="button"
                          onClick={() => !isLocked && handleAddRow(category)}
                          disabled={isLocked}
                          className="px-2.5 py-1 text-[9.5px] rounded-lg bg-[#1e40af]/10 hover:bg-[#1e40af]/25 disabled:opacity-35 disabled:cursor-not-allowed text-[#1e40af] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1 border border-[#1e40af]/20 shadow-sm"
                        >
                          <Plus className="w-3 h-3" /> Thêm dòng
                        </button>
                      </div>
                    </td>
                    <td className="bg-slate-50 border-l border-slate-200"></td>
                  </tr>

                  {/* Cat Rows */}
                  {catRows.length === 0 ? (
                    <tr className="border-b border-slate-200 text-slate-500 font-medium italic bg-slate-50/20">
                      <td colSpan={17} className="px-4 py-3 text-center">
                        Chưa có công tác nào trong mục này. Vui lòng nhấn "Thêm dòng" để thiết kế.
                      </td>
                    </tr>
                  ) : (
                    catRows.map(row => {
                      return (
                        <tr key={row.id} className="border-b border-slate-200 hover:bg-slate-50/80 transition-colors bg-white text-slate-800 text-[11px]">
                          {/* 1. Tên hạng mục */}
                          <td className="p-1 border border-slate-200">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => handleCellChange(row.id, 'name', e.target.value)}
                              disabled={isLocked}
                              className="w-full bg-transparent hover:bg-slate-100/50 focus:bg-white text-slate-900 rounded px-1.5 py-1 outline-none border border-slate-200 focus:border-indigo-500 text-left font-semibold text-[11px] disabled:opacity-60"
                            />
                          </td>

                          {/* 2. Mã ĐM */}
                          <td className="p-1 border border-slate-200">
                            <select
                              value={row.maDM}
                              onChange={(e) => handleCellChange(row.id, 'maDM', e.target.value)}
                              disabled={isLocked}
                              className="w-full bg-transparent hover:bg-slate-100/50 focus:bg-white text-slate-800 font-semibold rounded px-1 py-1 border border-slate-200 cursor-pointer outline-none truncate text-[11px] disabled:opacity-60"
                              title={materialCompositionNorms.find(n => n.id === row.maDM)?.name || '(Trống)'}
                            >
                              <option value="">(Trống)</option>
                              {materialCompositionNorms.map(norm => (
                                <option key={norm.id} value={norm.id}>{norm.name}</option>
                              ))}
                            </select>
                          </td>

                          {/* 3. ĐVT */}
                          <td className="p-1 border border-slate-200">
                            <input
                              type="text"
                              value={row.unit}
                              onChange={(e) => handleCellChange(row.id, 'unit', e.target.value)}
                              placeholder="m³"
                              disabled={isLocked}
                              className="w-full bg-transparent hover:bg-slate-100/50 focus:bg-white text-slate-700 font-bold text-center rounded px-1 py-1 outline-none border border-slate-200 focus:border-indigo-500 text-[11px] disabled:opacity-60"
                            />
                          </td>

                          {/* 4. Dài (m) - Yellow Input */}
                          <td className="p-1 border border-slate-200">
                            <input
                              type="number"
                              step="0.001"
                              value={row.dai ?? 0}
                              onChange={(e) => handleCellChange(row.id, 'dai', Math.max(0, parseFloat(e.target.value) || 0))}
                              disabled={isLocked}
                              className="w-full bg-amber-50/60 disabled:opacity-60 hover:bg-amber-100/40 text-amber-900 focus:bg-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-extrabold text-center border border-amber-200 rounded-md py-1 px-1 transition-all text-[11px] font-mono"
                            />
                          </td>

                          {/* 5. Rộng (m) - Yellow Input */}
                          <td className="p-1 border border-slate-200">
                            <input
                              type="number"
                              step="0.001"
                              value={row.rong ?? 0}
                              onChange={(e) => handleCellChange(row.id, 'rong', Math.max(0, parseFloat(e.target.value) || 0))}
                              disabled={isLocked}
                              className="w-full bg-amber-50/60 disabled:opacity-60 hover:bg-amber-100/40 text-amber-900 focus:bg-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-extrabold text-center border border-amber-200 rounded-md py-1 px-1 transition-all text-[11px] font-mono"
                            />
                          </td>

                          {/* 6. Cao (m) - Yellow Input */}
                          <td className="p-1 border border-slate-200">
                            <input
                              type="number"
                              step="0.001"
                              value={row.cao ?? 0}
                              onChange={(e) => handleCellChange(row.id, 'cao', Math.max(0, parseFloat(e.target.value) || 0))}
                              disabled={isLocked}
                              className="w-full bg-amber-50/60 disabled:opacity-60 hover:bg-amber-100/40 text-amber-900 focus:bg-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-extrabold text-center border border-amber-200 rounded-md py-1 px-1 transition-all text-[11px] font-mono"
                            />
                          </td>

                          {/* 7. Số lượng - Yellow Input */}
                          <td className="p-1 border border-slate-200">
                            <input
                              type="number"
                              value={row.qty ?? 0}
                              onChange={(e) => handleCellChange(row.id, 'qty', Math.max(0, parseInt(e.target.value) || 0))}
                              disabled={isLocked}
                              className="w-full bg-amber-50/60 disabled:opacity-60 hover:bg-amber-100/40 text-amber-900 focus:bg-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-extrabold text-center border border-amber-200 rounded-md py-1 px-1 transition-all text-[11px] font-mono"
                            />
                          </td>

                          {/* 8. KL tổng (Calculated) */}
                          <td className="px-2 py-1 border border-slate-200 text-center">
                            <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold rounded-md text-[11px] font-mono">
                              {row.klTong.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>

                          {/* 9. Hao hụt (%) - Yellow Input */}
                          <td className="p-1 border border-slate-200">
                            <div className="relative">
                              <input
                                type="number"
                                value={row.haoHut}
                                onChange={(e) => handleCellChange(row.id, 'haoHut', Math.max(0, parseFloat(e.target.value) || 0))}
                                disabled={isLocked}
                                className="w-full bg-amber-50/60 disabled:opacity-60 hover:bg-amber-100/40 text-amber-900 focus:bg-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-extrabold text-center border border-amber-200 rounded-md py-1 pl-1 pr-3.5 transition-all text-[11px] font-mono"
                              />
                              <span className="absolute right-1 top-2.5 text-[9px] text-amber-600 font-extrabold">%</span>
                            </div>
                          </td>

                          {/* 10. Gạch (Calculated) */}
                          <td className="px-2 py-1 border border-slate-200 text-right font-semibold text-slate-700 font-mono">
                            {row.gach > 0 ? row.gach.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </td>

                          {/* 11. Xi măng (Calculated) */}
                          <td className="px-2 py-1 border border-slate-200 text-right font-semibold text-slate-700 font-mono">
                            {row.ximang > 0 ? row.ximang.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </td>

                          {/* 12. Cát (Calculated) */}
                          <td className="px-2 py-1 border border-slate-200 text-right font-semibold text-slate-700 font-mono">
                            {row.cat > 0 ? row.cat.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </td>

                          {/* 13. Đá (Calculated) */}
                          <td className="px-2 py-1 border border-slate-200 text-right font-semibold text-slate-700 font-mono">
                            {row.da > 0 ? row.da.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </td>

                          {/* 14. Thép (Calculated) */}
                          <td className="px-2 py-1 border border-slate-200 text-right font-semibold text-slate-700 font-mono">
                            {row.thep > 0 ? row.thep.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </td>

                          {/* 15. Đơn giá (đ) - Yellow Input */}
                          <td className="p-1 border border-slate-200">
                            <input
                              type="number"
                              step="500"
                              value={row.price}
                              onChange={(e) => handleCellChange(row.id, 'price', Math.max(0, parseInt(e.target.value) || 0))}
                              disabled={isLocked}
                              className="w-full bg-amber-50/60 disabled:opacity-60 hover:bg-amber-100/40 text-[#1e40af] focus:bg-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-extrabold text-right border border-amber-200 rounded-md py-1 px-1.5 transition-all text-[11px] font-mono"
                            />
                          </td>

                          {/* 16. Thành tiền */}
                          <td className="px-3 py-1 border border-slate-200 text-right font-extrabold text-[#1e40af] font-mono">
                            {row.cost.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>

                          {/* 17. Action Xóa */}
                          <td className="px-2 py-1 text-center border border-slate-200">
                            <button
                              type="button"
                              onClick={() => !isLocked && handleDeleteRow(row.id)}
                              disabled={isLocked}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-30 disabled:cursor-not-allowed text-rose-600 hover:text-rose-700 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                              title="Xóa công tác này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </React.Fragment>
              );
            })}

            {/* TOTALS OVERALL ROW */}
            <tr className="bg-[#047857] text-white text-[11px] font-black uppercase tracking-wider text-center border-t-2 border-slate-300">
              <td className="px-3.5 py-3 text-left border border-emerald-700 font-black">TỔNG CỘNG VẬT TƯ VÀ THÀNH TIỀN</td>
              <td colSpan={6} className="border border-emerald-700 bg-emerald-800/10"></td>
              {/* KL Tổng */}
              <td className="px-2 py-3 text-center border border-emerald-700 bg-emerald-800/10 font-mono">
                <span className="inline-block px-1.5 py-0.5 bg-white text-emerald-900 rounded font-black">
                  {overallTotals.klTongTotal.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </td>
              <td className="border border-emerald-700 bg-emerald-800/10"></td>
              {/* Gạch */}
              <td className="px-2 py-3 text-right border border-emerald-700 bg-emerald-800/5 font-mono font-bold">
                {overallTotals.gachTotal.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              {/* Xi măng */}
              <td className="px-2 py-3 text-right border border-emerald-700 bg-emerald-800/5 font-mono font-bold">
                {overallTotals.ximangTotal.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              {/* Cát */}
              <td className="px-2 py-3 text-right border border-emerald-700 bg-emerald-800/5 font-mono font-bold">
                {overallTotals.catTotal.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              {/* Đá */}
              <td className="px-2 py-3 text-right border border-emerald-700 bg-emerald-800/5 font-mono font-bold">
                {overallTotals.daTotal.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              {/* Thép */}
              <td className="px-2 py-3 text-right border border-emerald-700 bg-emerald-800/5 font-mono font-bold">
                {overallTotals.thepTotal.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="border border-emerald-700 bg-emerald-800/10"></td>
              {/* Thành tiền */}
              <td className="px-3 py-3 text-right border border-emerald-700 bg-[#022c22]/30 font-mono font-black text-sm">
                {overallTotals.costTotal.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
              <td className="bg-[#022c22]/20 border border-emerald-700"></td>
            </tr>
          </tbody>
        </table>
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
            config: sessionStorage.getItem('hl_construction_config') ? JSON.parse(sessionStorage.getItem('hl_construction_config')!) : { discountPercent: 0, vatPercent: 8 },
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

      {/* Dynamic Print Preview Modal */}
      {savedQuoteForPreview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 select-text text-slate-800">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
