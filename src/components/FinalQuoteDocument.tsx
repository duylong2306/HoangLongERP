import React, { useState, useMemo, useEffect } from 'react';
import { Printer, FileText } from 'lucide-react';
import { docSoTiengViet } from './QuotationTableSheet';
import { dbService } from '../lib/dbService';
import { useNotification } from '../context';

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

interface FinalQuoteDocumentProps {
  quoteData: any;
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

export default function FinalQuoteDocument({ quoteData }: FinalQuoteDocumentProps) {
  const { addToast } = useNotification();
  const [day, setDay] = useState(new Date().getDate().toString().padStart(2, '0'));
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [year, setYear] = useState(new Date().getFullYear().toString());

  // 1. Calculate takeoff totals if finalItems is not explicitly saved in quoteData
  const takeoffTotals = useMemo(() => {
    if (quoteData.finalItems) return { gach: 0, ximang: 0, cat: 0, da: 0, thep: 0 };

    const parsedRows = quoteData.takeoffRows || [];
    let gach = 0;
    let ximang = 0;
    let cat = 0;
    let da = 0;
    let thep = 0;

    parsedRows.forEach((row: any) => {
      const dai = parseFloat(row.dai) || 0;
      const rong = parseFloat(row.rong) || 0;
      const cao = parseFloat(row.cao) || 0;
      const qty = parseFloat(row.qty) || 0;

      let klTong = 0;
      if (dai > 0 && rong > 0 && cao > 0) {
        klTong = dai * rong * cao;
      } else if (dai > 0 && rong > 0) {
        klTong = dai * rong;
      } else if (dai > 0) {
        klTong = dai;
      }

      if (qty > 0) {
        klTong = klTong > 0 ? klTong * qty : qty;
      }

      const haoMultiplier = 1 + (parseFloat(row.haoHut as any) || 0) / 100;

      // Fallback or load norms from localStorage
      let normsList = [];
      try {
        const localNorms = localStorage.getItem('material_composition_norms');
        if (localNorms) normsList = JSON.parse(localNorms);
      } catch (e) {}

      if (row.maDM) {
        const norm = normsList.find((n: any) => n.id.toLowerCase() === row.maDM.toLowerCase());
        if (norm) {
          gach += (parseFloat(norm.brick) || 0) * klTong * haoMultiplier;
          ximang += (parseFloat(norm.cement) || 0) * klTong * haoMultiplier;
          cat += (parseFloat(norm.sand) || 0) * klTong * haoMultiplier;
          da += (parseFloat(norm.stone) || 0) * klTong * haoMultiplier;
          thep += (parseFloat(norm.steel) || 0) * klTong * haoMultiplier;
        }
      }
    });

    return { gach, ximang, cat, da, thep };
  }, [quoteData]);

  // 2. Load list of items to render
  const finalItems = useMemo<FinalQuoteItem[]>(() => {
    if (quoteData.finalItems && quoteData.finalItems.length > 0) {
      return quoteData.finalItems;
    }

    // Attempt to reconstruct from fallback sessionStorage quantities/prices
    let savedQuantities: Record<string, number> = {};
    let savedPrices: Record<string, number> = {};
    try {
      savedQuantities = JSON.parse(sessionStorage.getItem('hl_final_quote_quantities') || '{}');
      savedPrices = JSON.parse(sessionStorage.getItem('hl_final_quote_prices') || '{}');
    } catch (e) {}

    return DEFAULT_FINAL_ITEMS.map(item => {
      let qty = savedQuantities[item.id] || 0;
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
        price: savedPrices[item.id] !== undefined ? savedPrices[item.id] : item.price
      };
    });
  }, [quoteData, takeoffTotals]);

  const grandTotalCost = useMemo(() => {
    return finalItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
  }, [finalItems]);

  const categories = ['VẬT LIỆU CHÍNH', 'HOÀN THIỆN', 'CỬA & KẾT CẤU', 'NHÂN CÔNG', 'MÁY & THIẾT BỊ'];

  const [docHtml, setDocHtml] = useState(quoteData.finalQuoteHtml || '');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const editorRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (quoteData.finalQuoteHtml) {
      setDocHtml(quoteData.finalQuoteHtml);
    } else {
      setDocHtml('');
    }
  }, [quoteData.finalQuoteHtml, quoteData.id]);

  const handlePrint = () => {
    window.print();
  };

  const startEditing = () => {
    if (editorRef.current) {
      setDocHtml(editorRef.current.innerHTML);
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!editorRef.current) return;
    setSaving(true);
    try {
      const newHtml = editorRef.current.innerHTML;
      await dbService.updateQuoteDocHtml(quoteData.id, { finalQuoteHtml: newHtml });
      quoteData.finalQuoteHtml = newHtml;
      setDocHtml(newHtml);
      setIsEditing(false);
      addToast({ title: '💾 Đã lưu', message: 'đã lưu bản in báo giá thành công!', type: 'success' });
    } catch (err) {
      console.error('Lỗi khi lưu bản in báo giá:', err);
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Không thể lưu bản in báo giá. vui lòng kiểm tra lại kết nối!', type: 'warning' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (quoteData.finalQuoteHtml) {
      setDocHtml(quoteData.finalQuoteHtml);
    } else {
      setDocHtml('');
    }
  };

  const handleRestoreDefault = async () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa tất cả các tùy chỉnh và khôi phục về bản in mặc định?')) {
      setSaving(true);
      try {
        await dbService.updateQuoteDocHtml(quoteData.id, { finalQuoteHtml: '' });
        quoteData.finalQuoteHtml = '';
        setDocHtml('');
        setIsEditing(false);
        addToast({ title: '✅ Thành công', message: 'Đã khôi phục bản in mặc định thành công!', type: 'success' });
      } catch (err) {
        console.error('Lỗi khi khôi phục bản in:', err);
        addToast({ title: '⚠️ Thiếu thông tin', message: 'Không thể khôi phục bản in. vui lòng thử lại!', type: 'warning' });
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="relative max-w-5xl mx-auto my-1">
      {/* Edit/Save Actions Toolbar */}
      <div className="absolute left-6 top-6 flex items-center gap-2 print:hidden no-print z-10" contentEditable={false}>
        {!isEditing ? (
          <button
            onClick={quoteData.finalQuoteHtml ? () => setIsEditing(true) : startEditing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white transition-all rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
            Chỉnh sửa bản in
          </button>
        ) : (
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold font-sans text-amber-600 px-2 animate-pulse">
              🔓 ĐANG CHỈNH SỬA
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-all rounded-lg text-xs font-bold font-sans flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
            >
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 transition-all rounded-lg text-xs font-bold font-sans flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
            >
              Hủy
            </button>
          </div>
        )}
        {docHtml && !isEditing && (
          <button
            onClick={handleRestoreDefault}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-all rounded-xl text-xs font-bold font-sans flex items-center gap-1 cursor-pointer shadow-sm active:scale-95 transition-all"
          >
            Khôi phục mặc định
          </button>
        )}
      </div>

      {/* Print Button floating */}
      <div className="absolute right-6 top-6 flex items-center gap-2 print:hidden no-print" contentEditable={false}>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-[#00a651] text-white hover:bg-[#008f45] transition-colors rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
        >
          <Printer className="w-4 h-4" />
          In Báo Giá Cuối Cùng
        </button>
      </div>

      {docHtml && !isEditing ? (
        /* Render saved custom html */
        <div 
          ref={editorRef}
          className="bg-white p-6 md:p-10 rounded-2xl border border-slate-250 select-text print:border-none print:shadow-none print:p-0 times-roman-final prose max-w-none text-left text-base space-y-4 print:prose-sm leading-relaxed"
          style={{ fontFamily: "'Times New Roman', Times, serif", color: '#000000' }}
          dangerouslySetInnerHTML={{ __html: docHtml }}
          contentEditable={false}
        />
      ) : isEditing ? (
        /* Render editable custom html */
        <div 
          ref={editorRef}
          className="bg-white p-6 md:p-10 rounded-2xl border border-slate-250 select-text print:border-none print:shadow-none print:p-0 times-roman-final prose max-w-none text-left text-base space-y-4 print:prose-sm leading-relaxed"
          style={{ fontFamily: "'Times New Roman', Times, serif", color: '#000000' }}
          dangerouslySetInnerHTML={{ __html: docHtml }}
          contentEditable={true}
          suppressContentEditableWarning={true}
        />
      ) : (
        /* Render original React layout */
        <div 
          ref={editorRef}
          className="bg-white p-6 md:p-10 rounded-2xl border border-slate-250 select-text print:border-none print:shadow-none print:p-0" 
          style={{ fontFamily: "'Times New Roman', Times, serif", color: '#000000' }}
          contentEditable={false}
        >
          <style>{`
            .times-roman-final, .times-roman-final * {
              font-family: 'Times New Roman', Times, serif !important;
              color: #000000 !important;
            }
            .times-roman-final table, 
            .times-roman-final th, 
            .times-roman-final td {
              border: 1px solid #000000 !important;
              color: #000000 !important;
              font-family: 'Times New Roman', Times, serif !important;
            }
          `}</style>
          
          {/* 1. COMP-HEADER: LOGO & COMPANY INFO (Matched with BÁO GIÁ XÂY DỰNG) */}
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-4 border-b border-[#00a651] pb-4 mb-5 text-left">
            <div className="flex items-center gap-3">
              {/* Stylized geometric house icon to represent Hoang Long */}
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center border border-[#00a651]/20 p-2">
                <svg viewBox="0 0 100 100" className="w-10 h-10 text-[#00a651]" fill="currentColor">
                  <path d="M50 15 L15 48 L25 48 L25 85 L75 85 L75 48 L85 48 Z" fill="none" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
                  <path d="M42 85 L42 55 L58 55 L58 85" fill="none" stroke="currentColor" strokeWidth="6" />
                  <path d="M15 15 L45 42 L35 48" fill="none" stroke="currentColor" strokeWidth="4" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-widest text-[#00a651] font-sans m-0 leading-tight">HOANG LONG</h1>
                <p className="text-[10px] font-bold text-slate-600 tracking-widest uppercase font-sans m-0 leading-tight">Construction - Furniture - Doors</p>
                <div className="text-[9px] text-slate-500 font-sans mt-1">
                  <p className="m-0">📍 Địa điểm kinh doanh: Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng</p>
                  <p className="m-0">🏠 Địa chỉ: 54/20 Kim Đồng, Phường 6, TP. Đà Lạt, tỉnh Lâm Đồng</p>
                </div>
              </div>
            </div>

            <div className="text-center md:text-right font-sans text-[10px] text-slate-500 space-y-0.5 md:pt-1">
              <p className="m-0"><span className="font-bold text-slate-700">📞 Hotline:</span> 0966 545 959 - 0374 883 979</p>
              <p className="m-0"><span className="font-bold text-slate-700">✉ Email:</span> hoanglongld.com@gmail.com</p>
              <p className="m-0"><span className="font-bold text-slate-700">🌐 Web:</span> hoanglongld.com</p>
            </div>
          </div>

          {/* 2. TITLE: MATCHED WITH BÁO GIÁ XÂY DỰNG */}
          <div className="bg-[#00a651] py-2.5 px-4 mb-4 text-center rounded-md">
            <h2 className="text-lg font-black text-white uppercase tracking-widest m-0 font-sans">
              💰 BẢNG TỔNG HỢP BÁO GIÁ THI CÔNG CUỐI CÙNG
            </h2>
          </div>
          <p className="text-[11px] text-slate-500 font-sans mt-1.5 mb-4 italic text-center">
            Hôm nay, ngày {day} tháng {month} năm {year} tại Văn phòng Hoàng Long Lâm Đồng
          </p>

          {/* 3. METADATA PROFILE (Matched with BÁO GIÁ XÂY DỰNG) */}
          <div className="grid grid-cols-12 gap-x-6 gap-y-3 pb-4 pt-1 mb-4 text-xs border border-slate-200 border-dashed p-4 rounded-xl bg-slate-50/50 font-sans">
            <div className="col-span-12 md:col-span-7 space-y-2 text-left">
              <div className="flex items-baseline">
                <span className="font-bold text-slate-700 w-24 shrink-0">Mã báo giá:</span>
                <span className="text-slate-800 font-bold border-b border-dotted border-slate-300 grow pb-0.5">{quoteData.code || `BGXD-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 899)}`}</span>
              </div>
              <div className="flex items-baseline">
                <span className="font-bold text-slate-700 w-24 shrink-0">Khách hàng:</span>
                <span className="text-slate-800 font-semibold border-b border-dotted border-slate-300 grow pb-0.5">{quoteData.customerName || 'Chị Ngân Nguyễn'}</span>
              </div>
              <div className="flex items-baseline">
                <span className="font-bold text-slate-700 w-24 shrink-0">Địa chỉ:</span>
                <span className="text-slate-800 border-b border-dotted border-slate-300 grow pb-0.5 leading-relaxed">{quoteData.customerAddress || 'Lâm Đồng'}</span>
              </div>
              <div className="flex items-baseline">
                <span className="font-bold text-slate-700 w-24 shrink-0">Dự án thầu:</span>
                <span className="text-slate-800 font-bold border-b border-dotted border-slate-300 grow pb-0.5 uppercase text-[#00a651]">{quoteData.projectName || 'Báo giá Độc lập'}</span>
              </div>
            </div>

            <div className="col-span-12 md:col-span-5 space-y-2 text-left">
              <div className="flex items-baseline">
                <span className="font-bold text-slate-700 w-20 shrink-0">Ngày lập:</span>
                <span className="text-slate-800 border-b border-dotted border-slate-300 grow pb-0.5">{quoteData.createdAt || new Date().toLocaleDateString('vi-VN')}</span>
              </div>
              <div className="flex items-baseline">
                <span className="font-bold text-slate-700 w-20 shrink-0">Điện thoại:</span>
                <span className="text-slate-800 font-semibold border-b border-dotted border-slate-300 grow pb-0.5">{quoteData.customerPhone || 'Chưa cung cấp'}</span>
              </div>
              <div className="flex items-baseline">
                <span className="font-bold text-slate-700 w-20 shrink-0">Email:</span>
                <span className="text-slate-800 border-b border-dotted border-slate-300 grow pb-0.5 truncate">{quoteData.customerPhone ? 'hoanglongld.com@gmail.com' : 'Đang cập nhật'}</span>
              </div>
            </div>
          </div>

          {/* 3.1 CONSTRUCTION SPECIFICATIONS (matched with BÁO GIÁ XÂY DỰNG if selectedHouseType exists) */}
          {quoteData.selectedHouseType && (
            <div className="my-4 border border-dashed border-[#00a651]/40 rounded-xl p-4 bg-emerald-50/20 font-sans text-xs space-y-4">
              <h3 className="font-extrabold text-[11px] text-[#00a651] uppercase tracking-wider border-b border-emerald-100 pb-2 flex items-center gap-1.5 text-left">
                📊 THÔNG SỐ KỸ THUẬT & LOẠI NHÀ ĐÃ CHỌN
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* PANEL 1: THÔNG SỐ VẬT LÝ MẶT BẰNG */}
                <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm space-y-2 text-left">
                  <span className="block font-black text-[#1e3a8a] border-b pb-1 text-[10px] uppercase tracking-wide">
                    📐 THÔNG SỐ VẬT LÝ MẶT BẰNG
                  </span>
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Chiều dài mặt bằng:</span>
                      <span className="font-bold text-slate-800 font-mono">{quoteData.chieuDai} m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Chiều rộng mặt bằng:</span>
                      <span className="font-bold text-slate-800 font-mono">{quoteData.chieuRong} m</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-1.5 font-bold">
                      <span className="text-slate-500">Diện tích sàn:</span>
                      <span className="font-bold text-[#00a651] font-mono">{(quoteData.dienTichSan || (quoteData.chieuDai && quoteData.chieuRong ? quoteData.chieuDai * quoteData.chieuRong : 0))?.toLocaleString('vi-VN')} m²</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Số tầng thầu:</span>
                      <span className="font-bold text-slate-800 font-mono">{quoteData.soTang} tầng</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-1.5 font-bold">
                      <span className="text-slate-800">Tổng d.tích sàn XD:</span>
                      <span className="font-black text-rose-600 font-mono">{(quoteData.tongDienTichXayDung || (quoteData.chieuDai && quoteData.chieuRong && quoteData.soTang ? quoteData.chieuDai * quoteData.chieuRong * quoteData.soTang : 0))?.toLocaleString('vi-VN')} m²</span>
                    </div>
                  </div>
                </div>

                {/* PANEL 2: PHÂN LOẠI & ĐĂNG KÍ THI THIẾT KẾ */}
                <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm space-y-2 text-left">
                  <span className="block font-black text-[#1e3a8a] border-b pb-1 text-[10px] uppercase tracking-wide">
                    🏢 PHÂN LOẠI & THIẾT KẾ ĐÃ CHỌN
                  </span>
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gói thầu xây:</span>
                      <span className="font-bold text-[#00a651]">{quoteData.selectedHouseType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Đơn giá định mức:</span>
                      <span className="font-bold text-slate-800 font-mono">{(quoteData.basePrice || 0).toLocaleString('vi-VN')} đ/m²</span>
                    </div>
                    {quoteData.selectedInteriorLevel && (
                      <div className="flex justify-between border-t border-slate-100 pt-1.5">
                        <span className="text-slate-500">Gói nội thất:</span>
                        <span className="font-bold text-[#00a651]">{quoteData.selectedInteriorLevel}</span>
                      </div>
                    )}
                    {quoteData.interiorPrice > 0 && (
                      <div className="flex justify-between font-bold">
                        <span className="text-slate-500">Đơn giá nội thất:</span>
                        <span className="font-bold text-slate-800 font-mono">{(quoteData.interiorPrice).toLocaleString('vi-VN')} đ/m²</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* PANEL 3: ĐẶC ĐIỂM KẾT CẤU CHÍNH */}
                <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm space-y-2 text-left">
                  <span className="block font-black text-[#1e3a8a] border-b pb-1 text-[10px] uppercase tracking-wide">
                    🏗️ ĐẶC ĐIỂM KẾT CẤU CHÍNH
                  </span>
                  <p className="text-[10.5px] text-slate-600 leading-relaxed pt-0.5">
                    {quoteData.description || 'Hệ khung bê tông cốt thép chịu lực, móng băng hoặc móng cọc tùy theo địa hình khảo sát thực tế.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Materials and services table */}
          <div className="w-full overflow-x-auto my-4 border border-slate-200 rounded-xl bg-white shadow-sm font-sans">
            <table className="w-full text-left border-collapse border border-slate-200 font-sans text-slate-800" style={{ fontSize: '11px', lineHeight: '1.3' }}>
              <thead>
                <tr className="bg-[#1e40af] text-white font-extrabold border-b border-slate-300 uppercase tracking-wider text-center text-[10px]">
                  <th className="px-2 py-2.5 border border-slate-300 w-[40px]">STT</th>
                  <th className="px-3 py-2.5 border border-slate-300 text-left min-w-[220px]">Tên vật tư / nhân công / dịch vụ</th>
                  <th className="px-2 py-2.5 border border-slate-300 w-[55px] text-center">ĐVT</th>
                  <th className="px-2 py-2.5 border border-slate-300 w-[95px] text-center">Tổng KL</th>
                  <th className="px-2 py-2.5 border border-slate-300 w-[110px] text-right">Đơn giá (đ)</th>
                  <th className="px-2 py-2.5 border border-slate-300 w-[120px] text-right">Thành tiền (đ)</th>
                  <th className="px-3 py-2.5 border border-slate-300 text-left min-w-[130px]">Ghi chú / Nguồn</th>
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
                        <tr className="bg-blue-50/60 font-black text-[#1e40af] text-[10.5px] uppercase border-y border-slate-200">
                          <td colSpan={7} className="px-3 py-2 text-left tracking-wide">
                            {cat}
                          </td>
                        </tr>

                        {/* Item rows */}
                        {itemsInCat.map(item => {
                          const amount = item.qty * item.price;
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-slate-700 text-center">
                              <td className="px-2 py-2.5 border border-slate-200 font-medium text-slate-500">{sttCounter++}</td>
                              <td className="px-3 py-2.5 border border-slate-200 text-left font-bold text-slate-900 leading-tight">
                                {item.name}
                              </td>
                              <td className="px-2 py-2.5 border border-slate-200 font-medium text-slate-600 text-center">
                                {item.unit}
                              </td>
                              
                              {/* Quantity column */}
                              <td className="px-2 py-2.5 border border-slate-200 font-mono text-center">
                                <span className="inline-block px-1.5 py-0.5 bg-slate-50 text-slate-800 font-bold border border-slate-200 rounded">
                                  {item.qty.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </td>

                              {/* Price column */}
                              <td className="px-2 py-2.5 border border-slate-200 font-mono text-right text-slate-700">
                                {item.price.toLocaleString('vi-VN')}
                              </td>

                              {/* Total cost column */}
                              <td className="px-2 py-2.5 border border-slate-200 font-mono text-right font-black text-slate-900 bg-slate-50/30">
                                {amount.toLocaleString('vi-VN')}
                              </td>

                              <td className="px-3 py-2.5 border border-slate-200 text-left text-[10.5px] italic text-slate-500 leading-normal">
                                {item.note}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  });
                })()}

                {/* Overall Grand Total Banner */}
                <tr className="bg-[#047857] text-white text-[11px] font-black uppercase tracking-wider text-center border-t-2 border-slate-300">
                  <td colSpan={2} className="px-3 py-3 text-left border border-emerald-800 font-black">
                    TỔNG GIÁ TRỊ BÁO GIÁ QUY CHUẨN ĐÃ BAO GỒM THUẾ & PHÍ
                  </td>
                  <td colSpan={3} className="border border-emerald-800"></td>
                  <td className="px-3 py-3 text-right border border-emerald-800 font-mono text-[12.5px] font-black">
                    {grandTotalCost.toLocaleString('vi-VN')} đ
                  </td>
                  <td className="border border-emerald-800"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Money in Words */}
          <div className="border border-slate-200 rounded-xl bg-slate-50 p-4 font-sans text-xs text-left mb-8">
            <p className="m-0"><span className="font-extrabold text-slate-500">Bằng chữ:</span> <span className="font-black text-[#047857] italic capitalize text-[12px]">{docSoTiengViet(grandTotalCost)} đồng chẵn.</span></p>
          </div>

          {/* Signature Section */}
          <div className="grid grid-cols-2 gap-4 mt-12 pt-8 border-t border-slate-200 font-sans text-xs">
            {/* Representative Signature */}
            <div className="text-center space-y-12">
              <div>
                <p className="font-black text-slate-900 uppercase tracking-wide leading-tight">CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</p>
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-0.5">Đại diện pháp luật</p>
              </div>
              <div className="pt-2">
                <span className="font-black text-indigo-600 text-xs underline decoration-dotted tracking-wider">Trương Hữu Long</span>
              </div>
            </div>

            {/* Customer Signature */}
            <div className="text-center space-y-12">
              <div>
                <p className="font-black text-slate-900 uppercase tracking-wide leading-tight">Duyệt và ký nhận</p>
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-0.5">Khách hàng</p>
              </div>
              <div className="pt-2">
                <span className="font-black text-slate-800 text-xs underline decoration-dotted tracking-wider">
                  {quoteData.customerName || 'Nguyễn Viết Đăng Trình'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
