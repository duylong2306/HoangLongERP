import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Save, Check, FileText, Edit } from 'lucide-react';
import { dbService } from '../lib/dbService';
import { useNotification, hasModulePermission } from '../context';
import QuotationTableSheet from './QuotationTableSheet';
import TakeoffSummaryTable from './TakeoffSummaryTable';
import { buildFinalSummary, takeoffToFinalItems, normalizeTakeoffRows } from '../lib/takeoffCalc';

/**
 * Tổng tiền bóc tách tính từ các dòng bóc tách (định dạng mới, hoặc cũ được tự chuyển đổi).
 * Định mức cấp phối không còn tham gia; chỉ lấy tổng thành tiền.
 */
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
  // RÀ SOÁT 2026-09: cùng lý do như ConstructionTakeoff.tsx — trước đây không tự kiểm
  // tra quyền, dựa vào lớp check sai (luôn "Tạo", sai module) ở QuotationSystem.handleSaveQuote.
  const canCreateFinalQuote = hasModulePermission(currentUser?.id, 'quotes_construction', 'create');
  const canEditFinalQuote = hasModulePermission(currentUser?.id, 'quotes_construction', 'edit');
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

  // 1. Lấy bảng bóc tách để tổng hợp. Luôn TÍNH LẠI từ dòng bóc tách (không dùng số tổng lưu sẵn) để không bị hiện số cũ:
  //  - Hồ sơ đã lưu & đang khóa → dùng bảng đã lưu trong hồ sơ
  //  - Đang chỉnh sửa / hồ sơ mới → dùng bảng bóc tách hiện hành trong phiên (nếu trống thì lấy bảng trong hồ sơ)
  const takeoffRows = useMemo<any[]>(() => {
    try {
      const saved = normalizeTakeoffRows(loadedQuote?.takeoffRows);
      if (isLocked && saved.length > 0) return saved;
      const live = normalizeTakeoffRows(JSON.parse(sessionStorage.getItem('takeoff_rows') || '[]'));
      return live.length > 0 ? live : saved;
    } catch (e) {
      console.error("Error reading takeoff rows:", e);
      return [];
    }
  }, [loadedQuote, isLocked, takeoffUpdateTrigger]);

  const takeoffSummary = useMemo(() => buildFinalSummary(takeoffRows), [takeoffRows]);
  const takeoffTotals = takeoffSummary.totals;

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

  // 6. Get Pre-estimate total from Lập báo cáo xây dựng
  const preEstimateAmount = useMemo(() => {
    try {
      const localItems = sessionStorage.getItem('hl_construction_items') ? JSON.parse(sessionStorage.getItem('hl_construction_items')!) : [];
      const localConfig = sessionStorage.getItem('hl_construction_config') ? JSON.parse(sessionStorage.getItem('hl_construction_config')!) : { discountPercent: 0 };
      
      const subtotal = localItems.reduce((acc: number, item: any) => acc + (item.totalPrice || 0), 0);
      // Chiết khấu thầu (%) đã được loại bỏ khỏi hồ sơ Xây dựng.
      const totalQuoteAmount = subtotal;

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

  const takeoffCostTotal = takeoffTotals.total;
  const priceDifference = takeoffCostTotal - preEstimateAmount;
  const priceDifferencePercent = preEstimateAmount > 0 ? (priceDifference / preEstimateAmount) * 100 : 0;

  // 8. Save quote action with Print preview tab trigger
  const handleSaveFinalQuote = async () => {
    if (loadedQuote ? !canEditFinalQuote : !canCreateFinalQuote) {
      addToast({ title: '⛔ Không đủ quyền', message: `Bạn không có quyền "${loadedQuote ? 'Sửa' : 'Thêm'}" báo giá xây dựng.`, type: 'warning' });
      return;
    }
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
      // Danh sách hạng mục lấy từ bảng bóc tách (hợp đồng đọc lại để chia giá)
      finalItems: takeoffToFinalItems(takeoffRows),
      takeoffRows: takeoffRows,
      takeoffTotals: { cost: takeoffTotals.total, vatTu: takeoffTotals.vatTu, nhanCong: takeoffTotals.nhanCong },
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

  // 10. Print action
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 w-full text-slate-100 font-sans text-left" id="final_construction_quote_component">
      
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm print:hidden no-print">
        <div className="space-y-0.5">
          <h2 className="text-sm font-black uppercase text-indigo-400 tracking-wider">
            ⚙️ Quản lý Báo Giá Cuối Cùng
          </h2>
          <p className="text-[11px] text-slate-400">
            Tổng hợp giá trị theo từng phần từ Bảng Bóc Tách Chi Tiết (giống bảng PL Hợp đồng). Muốn sửa số liệu, hãy sửa ở Bảng Bóc Tách Chi Tiết.
          </p>
        </div>
      </div>

      {/* Main Quotation Content / Card */}
      <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-slate-200 text-slate-900 leading-normal max-w-5xl mx-auto my-1 relative print:border-none print:shadow-none print:p-0 print:text-black">
        
        {/* Bảng tổng hợp theo từng phần (từ Bảng Bóc Tách Chi Tiết) */}
        <div className="w-full overflow-x-auto my-4 border border-slate-200 rounded-xl bg-white shadow-sm">
          <TakeoffSummaryTable rows={takeoffRows} />
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
            totalAmount: takeoffCostTotal,
            status: 'approved',
            finalItems: takeoffToFinalItems(takeoffRows),
            takeoffRows: takeoffRows,
            isFinalQuote: true
          })}
          disabled={!isConstructionSaved || !isLocked}
          className="bg-indigo-600 text-white hover:bg-indigo-550 disabled:opacity-30 disabled:cursor-not-allowed font-semibold px-4 py-2.5 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-200 shadow-md"
          title={!isConstructionSaved ? "Vui lòng lưu hồ sơ trước khi Xem & In" : !isLocked ? "Vui lòng hoàn tất chỉnh sửa và lưu trước khi Xem & In" : "Xem chi tiết & In ấn"}
        >
          <Printer className="w-4 h-4" /> Xem & In
        </button>
      </div>

      {/* Dynamic Print Preview Modal — tách ra document.body bằng createPortal (giống
          ConstructionArchive/CabinetArchive/MechanicalArchive) vì modal này nằm sâu trong
          #root có overflow:hidden + height:100% (app-shell cố định). Nếu không tách portal,
          khi in (window.print) trình duyệt chỉ chụp được đúng phần đang hiển thị trong viewport
          của #root rồi cắt cụt/trống các trang sau — đây chính là lỗi "cửa sổ in bị lỗi". */}
      {savedQuoteForPreview && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 select-text text-slate-800 print-portal-backdrop">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200 print-portal-card">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 print-hide">
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

            <div className="p-4 md:p-6 bg-slate-100 overflow-y-auto grow" id="print-area-archive">
              <style>{`
                @media print {
                  #root {
                    display: none !important;
                  }
                  .print-portal-backdrop {
                    position: static !important;
                    display: block !important;
                    background: none !important;
                    padding: 0 !important;
                  }
                  .print-portal-card {
                    max-width: 100% !important;
                    box-shadow: none !important;
                    border: none !important;
                    border-radius: 0 !important;
                    overflow: visible !important;
                  }
                  #print-area-archive {
                    max-height: none !important;
                    overflow: visible !important;
                    padding: 0 !important;
                  }
                  .print-hide {
                    display: none !important;
                  }
                  #print-area-archive .grid {
                    display: block !important;
                  }
                }
              `}</style>
              <QuotationTableSheet quoteData={savedQuoteForPreview} initialTab="final_quote" />
            </div>

            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end gap-2.5 shrink-0 print-hide">
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
        </div>,
        document.body
      )}

    </div>
  );
}
