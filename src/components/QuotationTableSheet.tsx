import React, { useState, useEffect } from 'react';
import { sanitizeHTML } from '../lib/sanitize';
import { FileText, Printer, Download, ClipboardList, FileSignature, FileCheck, Coins, CheckCircle2 } from 'lucide-react';
import ContractDocument from './ContractDocument';
import AcceptanceDocument from './AcceptanceDocument';
import LiquidationDocument from './LiquidationDocument';
import FinalQuoteDocument from './FinalQuoteDocument';
import { dbService } from '../lib/dbService';

// Helper function to read Vietnamese numbers aloud in text format
export function docSoTiengViet(number: number): string {
  if (number === 0) return "Không đồng";
  
  const units = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const places = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  
  const readThreeDigits = (num: number, hasTrieu: boolean) => {
    let hundred = Math.floor(num / 100);
    let ten = Math.floor((num % 100) / 10);
    let unit = num % 10;
    let res = "";
    
    if (hundred > 0 || hasTrieu) {
      res += units[hundred] + " trăm ";
    }
    
    if (ten > 1) {
      res += units[ten] + " mươi ";
    } else if (ten === 1) {
      res += "mười ";
    } else if (hundred > 0 && unit > 0) {
      res += "lẻ ";
    }
    
    if (unit > 0) {
      if (unit === 1 && ten > 1) {
        res += "mốt";
      } else if (unit === 5 && ten > 0) {
        res += "lăm";
      } else if (unit === 4 && ten > 1) {
        res += "tư";
      } else {
        res += units[unit];
      }
    }
    return res.trim();
  };

  let strNum = Math.floor(number).toString();
  let chunks: string[] = [];
  while (strNum.length > 0) {
    chunks.push(strNum.substring(Math.max(0, strNum.length - 3)));
    strNum = strNum.substring(0, Math.max(0, strNum.length - 3));
  }
  
  let result = "";
  for (let i = chunks.length - 1; i >= 0; i--) {
    let val = parseInt(chunks[i]);
    if (val > 0) {
      let isFirst = i === chunks.length - 1;
      let chunkStr = readThreeDigits(val, !isFirst);
      result += " " + chunkStr + " " + places[i];
    }
  }
  
  result = result.trim().replace(/\s+/g, " ") + " đồng";
  return result.charAt(0).toUpperCase() + result.slice(1);
}

interface QuotationTableSheetProps {
  quoteData: {
    name?: string;
    code?: string;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    createdAt?: string;
    totalAmount?: number;
    discountPercent?: number;
    config?: any;
    items?: any[];
    content?: string;
    paymentTerms?: string;
    quoteNotes?: string;
    projectName?: string;
    takeoffRows?: any[];
    companyLogoImg?: string;
    companyLogoText?: string;
    companySlogan?: string;
    companyAddressInfo?: string;
    companyContactInfo?: string;
    chieuDai?: number;
    chieuRong?: number;
    soTang?: number;
    selectedHouseType?: string;
    donGiaKhaiToan?: number;
    nganSachNoiThat?: number;
    features?: string;
    minPrice?: number;
    maxPrice?: number;
    dienTichSan?: number;
    tongDienTichXayDung?: number;
    isFinalQuote?: boolean;
    finalItems?: any[];
    sector?: string;
    estimatorMode?: string;
  };
  initialTab?: 'quote' | 'contract' | 'acceptance' | 'liquidation' | 'final_quote';
}

export default function QuotationTableSheet({ quoteData, initialTab }: QuotationTableSheetProps) {
  // If items list is missing, we try to create an item list from fallback or text content parsed
  let items = quoteData.items || [];
  
  if (items.length === 0 && quoteData.content) {
    // Attempt simple parsing of plaintext context if items is empty
    const lines = quoteData.content.split('\n');
    const parsedItems: any[] = [];
    let parsingItems = false;
    
    for (const line of lines) {
      if (line.includes('DANH SÁCH HẠNG MỤC')) {
        parsingItems = true;
        continue;
      }
      if (line.includes('----------------') || line.includes('TỔNG CỘNG')) {
        if (parsingItems) parsingItems = false;
      }
      
      if (parsingItems && line.trim()) {
        const itemMatch = line.match(/^\d+\.\s+(.*?)\s+-\s+Số lượng:\s+(\d+)\s+-\s+Thành tiền:\s+([\d.,]+)\s*đ/);
        if (itemMatch) {
          const name = itemMatch[1].trim();
          const qty = parseInt(itemMatch[2]) || 1;
          const totalVal = parseFloat(itemMatch[3].replace(/[.,]/g, '')) || 0;
          parsedItems.push({
            id: `item_p_${Math.random()}`,
            productName: name,
            qty: qty,
            material: "Theo tiêu chuẩn thiết kế",
            unit: "Cái",
            unitPrice: Math.round(totalVal / qty),
            totalPrice: totalVal
          });
        }
      }
    }
    if (parsedItems.length > 0) {
      items = parsedItems;
    }
  }

  // Backup data if items list is still empty
  if (items.length === 0) {
    items = [
      {
        id: '1',
        productName: 'Hệ tủ bếp gỗ cao cấp',
        qty: 1,
        material: 'Ván MDF chịu ẩm Ba Thanh phủ Melamine',
        unit: 'Bộ',
        unitPrice: quoteData.totalAmount || 15000000,
        totalPrice: quoteData.totalAmount || 15000000,
      }
    ];
  }

  // Financial values
  const totalAmount = quoteData.totalAmount || items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const discountPercent = quoteData.discountPercent || 0;
  
  // Calculate Subtotal back from totalAmount and discount
  // totalAmount = subtotal * (1 - discountPercent/100)
  const subtotalBeforeDiscount = discountPercent > 0 
    ? Math.round(totalAmount / (1 - discountPercent / 100))
    : items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    
  const discountValue = subtotalBeforeDiscount * (discountPercent / 100);
  const subtotalAfterDiscount = subtotalBeforeDiscount - discountValue;
  const sheetVatPercent = quoteData.config?.vatPercent !== undefined ? quoteData.config.vatPercent : 8;
  const vatAmount = Math.round(subtotalAfterDiscount * (sheetVatPercent / 100)); // Dynamic VAT
  const grandTotal = subtotalAfterDiscount + vatAmount;

  const [isApproved, setIsApproved] = useState<boolean>(() => {
    return !!(quoteData as any).isApproved;
  });

  const handleApproveQuote = async () => {
    try {
      if ((quoteData as any).id) {
        await dbService.updateQuoteDocHtml((quoteData as any).id, { isApproved: true });
        (quoteData as any).isApproved = true;
      }

      const saved = localStorage.getItem('hl_erp_projects');
      if (saved) {
        const projs = JSON.parse(saved);
        let found = false;
        const updatedProjs = projs.map((p: any) => {
          const isMatch = 
            (p.baoGiaFile?.code && quoteData.code && p.baoGiaFile.code === quoteData.code) ||
            (p.id && (quoteData as any).projectId && p.id === (quoteData as any).projectId) ||
            (p.name && quoteData.projectName && p.name === quoteData.projectName);
          
          if (isMatch) {
            found = true;
            return {
              ...p,
              baoGiaFile: {
                ...p.baoGiaFile,
                name: p.baoGiaFile?.name || `${quoteData.code || 'BAO_GIA'}.pdf`,
                size: p.baoGiaFile?.size || '1.2 MB',
                createdAt: p.baoGiaFile?.createdAt || quoteData.createdAt || new Date().toLocaleDateString('vi-VN'),
                totalAmount: p.baoGiaFile?.totalAmount || quoteData.totalAmount || totalAmount || 0,
                discountPercent: p.baoGiaFile?.discountPercent !== undefined ? p.baoGiaFile.discountPercent : (quoteData.config?.discountPercent || discountPercent || 0),
                items: p.baoGiaFile?.items || quoteData.items || items || [],
                content: p.baoGiaFile?.content || quoteData.content || '',
                isApproved: true,
                approvedAt: new Date().toLocaleString('vi-VN'),
                approvedBy: 'Trương Hữu Long (Giám Đốc)'
              }
            };
          }
          return p;
        });

        if (found) {
          localStorage.setItem('hl_erp_projects', JSON.stringify(updatedProjs));
          setIsApproved(true);
          
          const matchedProj = updatedProjs.find((p: any) => 
            (p.baoGiaFile?.code && quoteData.code && p.baoGiaFile.code === quoteData.code) ||
            (p.id && (quoteData as any).projectId && p.id === (quoteData as any).projectId) ||
            (p.name && quoteData.projectName && p.name === quoteData.projectName)
          );
          if (matchedProj) {
            await dbService.projects.save(matchedProj).catch(err => {
              console.error("Lỗi đồng bộ duyệt báo giá lên Firestore:", err);
            });
          }
          
          window.dispatchEvent(new CustomEvent('hl-projects-updated'));
        }
      }
    } catch (e) {
      console.error("Lỗi khi duyệt báo giá:", e);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const [activeTab, setActiveTab] = useState<'quote' | 'contract' | 'acceptance' | 'liquidation' | 'final_quote'>(initialTab || 'quote');
  const [subQuoteTab, setSubQuoteTab] = useState<'estimator' | 'takeoff' | 'final_quote'>('estimator');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Read takeoff rows from quote or fallback to sessionStorage
  const takeoffRows = React.useMemo(() => {
    let list = quoteData.takeoffRows || [];
    if (list.length === 0 && quoteData.selectedHouseType) {
      try {
        const local = sessionStorage.getItem('takeoff_rows');
        if (local) {
          list = JSON.parse(local);
        }
      } catch (err) {
        console.error("Error reading fallback takeoff rows:", err);
      }
    }
    return list;
  }, [quoteData.takeoffRows, quoteData.selectedHouseType]);

  const takeoffTotals = React.useMemo(() => {
    let klTong = 0;
    let gach = 0;
    let ximang = 0;
    let cat = 0;
    let da = 0;
    let thep = 0;
    let cost = 0;
    takeoffRows.forEach((r: any) => {
      klTong += parseFloat(r.klTong || 0);
      gach += parseFloat(r.gach || 0);
      ximang += parseFloat(r.ximang || 0);
      cat += parseFloat(r.cat || 0);
      da += parseFloat(r.da || 0);
      thep += parseFloat(r.thep || 0);
      cost += parseFloat(r.cost || 0);
    });
    return { klTong, gach, ximang, cat, da, thep, cost };
  }, [takeoffRows]);

  const renderActiveDocument = () => {
    switch (activeTab) {
      case 'contract':
        return <ContractDocument quoteData={quoteData} />;
      case 'acceptance':
        return <AcceptanceDocument quoteData={quoteData} />;
      case 'liquidation':
        return <LiquidationDocument quoteData={quoteData} />;
      case 'final_quote':
        return <FinalQuoteDocument quoteData={quoteData} />;
      default:
        return (
          <div className="space-y-4 w-full">
            {/* Sub tabs for construction quotes (hidden during print) */}
            {quoteData.selectedHouseType && (
              <div className="flex items-center justify-center gap-2 mb-2 p-1.5 bg-slate-100 rounded-xl max-w-md mx-auto print:hidden no-print border border-slate-200 font-sans">
                <button
                  type="button"
                  onClick={() => setSubQuoteTab('estimator')}
                  className={`flex-1 py-1 px-2.5 text-[10px] font-extrabold uppercase rounded-lg transition-all cursor-pointer ${
                    subQuoteTab === 'estimator'
                      ? 'bg-[#00a651] text-white shadow-sm'
                      : 'text-slate-650 hover:bg-slate-200'
                  }`}
                >
                  📋 Báo Giá Xây Dựng
                </button>
                <button
                  type="button"
                  onClick={() => setSubQuoteTab('takeoff')}
                  className={`flex-1 py-1 px-2.5 text-[10px] font-extrabold uppercase rounded-lg transition-all cursor-pointer ${
                    subQuoteTab === 'takeoff'
                      ? 'bg-[#00a651] text-white shadow-sm'
                      : 'text-slate-650 hover:bg-slate-200'
                  }`}
                >
                  📐 Bóc Tách Chi Tiết
                </button>
                <button
                  type="button"
                  onClick={() => setSubQuoteTab('final_quote')}
                  className={`flex-1 py-1 px-2.5 text-[10px] font-extrabold uppercase rounded-lg transition-all cursor-pointer ${
                    subQuoteTab === 'final_quote'
                      ? 'bg-[#00a651] text-white shadow-sm'
                      : 'text-slate-650 hover:bg-slate-200'
                  }`}
                >
                  💰 Báo Giá Cuối Cùng
                </button>
              </div>
            )}

            {quoteData.selectedHouseType && subQuoteTab === 'takeoff' ? (
              <div className="bg-white p-3 md:p-8 rounded-2xl shadow-sm border border-slate-250 select-text font-serif text-slate-900 leading-normal max-w-5xl mx-auto my-1 relative print:border-none print:shadow-none print:p-0">
                {/* Print Trigger Button */}
                <div className="absolute right-6 top-6 flex items-center gap-2 print:hidden no-print">
                  {isApproved ? (
                    <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold font-sans flex items-center gap-1 shadow-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Đã Duyệt
                    </span>
                  ) : (
                    <button
                      onClick={handleApproveQuote}
                      className="px-3.5 py-1.5 bg-amber-500 text-white hover:bg-amber-600 transition-colors rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm animate-pulse"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      Duyệt Báo Giá
                    </button>
                  )}
                  <button
                    onClick={handlePrint}
                    className="px-3.5 py-1.5 bg-[#00a651] text-white hover:bg-[#008f45] transition-colors rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    In Chi Tiết Bóc Tách
                  </button>
                </div>

                {isApproved && (
                  <div className="absolute top-24 right-10 md:right-16 transform rotate-12 border-4 border-emerald-500 text-emerald-500 font-extrabold uppercase px-4 py-2 rounded-lg text-sm tracking-widest font-sans flex items-center gap-1 bg-white/95 shadow-md pointer-events-none select-none z-50">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 animate-pulse" />
                    ĐÃ PHÊ DUYỆT
                  </div>
                )}

                {/* 1. COMP-HEADER */}
                <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-4 border-b border-[#00a651] pb-4 mb-5">
                  <div className="flex items-center gap-3">
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

                {/* Title */}
                <div className="bg-[#00a651] py-2.5 px-4 mb-4 text-center rounded-md">
                  <h2 className="text-lg font-black text-white uppercase tracking-widest m-0 font-sans">
                    BẢNG BÓC TÁCH KHỐI LƯỢNG VẬT TƯ CHI TIẾT
                  </h2>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-12 gap-x-6 gap-y-3 pb-4 pt-1 mb-2 text-xs border border-slate-200 border-dashed p-4 rounded-xl bg-slate-50/50 font-sans">
                  <div className="col-span-12 md:col-span-7 space-y-2">
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
                  <div className="col-span-12 md:col-span-5 space-y-2">
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

                <p className="text-[11px] leading-relaxed my-4 text-slate-700 italic font-sans text-left">
                  Công ty TNHH Hoàng Long xin trân trọng kính gửi đến quý đối tác/khách hàng bảng bóc tách, thống kê chi tiết khối lượng vật tư (gạch, xi măng, cát, đá, thép) dự tính cho từng hạng mục thi công công trình dưới đây:
                </p>

                {/* Table */}
                <div className="w-full overflow-x-auto my-4 border border-slate-200 rounded-xl bg-white">
                  <table className="w-full text-left border-collapse border border-slate-200 font-sans" style={{ fontSize: '8.5px', lineHeight: '1.2' }}>
                    <thead>
                      <tr className="bg-slate-50 font-bold border-b border-slate-300 uppercase tracking-wider text-slate-800 text-center">
                        <th rowSpan={2} className="px-1 py-1.5 border border-slate-300 w-[25px]">STT</th>
                        <th rowSpan={2} className="px-1 py-1.5 border border-slate-300 text-left w-[130px]">Tên hạng mục / công tác</th>
                        <th rowSpan={2} className="px-1 py-1.5 border border-slate-300 w-[70px]">Mã ĐM</th>
                        <th rowSpan={2} className="px-1 py-1.5 border border-slate-300 w-[25px]">ĐVT</th>
                        <th colSpan={3} className="px-1 py-0.5 border border-slate-300">Kích thước (m)</th>
                        <th rowSpan={2} className="px-1 py-1.5 border border-slate-300 w-[25px]">S.L</th>
                        <th rowSpan={2} className="px-1 py-1.5 border border-slate-300 w-[45px]">KL Tổng</th>
                        <th rowSpan={2} className="px-1 py-1.5 border border-slate-300 w-[25px]">H.H (%)</th>
                        <th colSpan={5} className="px-1 py-0.5 border border-slate-300">Khối lượng vật tư chi tiết bóc tách</th>
                        <th rowSpan={2} className="px-1 py-1.5 border border-slate-300 text-right w-[65px]">Đơn giá (đ)</th>
                        <th rowSpan={2} className="px-1 py-1.5 border border-slate-300 text-right w-[75px]">Thành tiền (đ)</th>
                      </tr>
                      <tr className="bg-slate-50 font-bold border-b border-slate-300 text-slate-700 text-center">
                        <th className="px-1 py-0.5 border border-slate-300 w-[25px]">Dài</th>
                        <th className="px-1 py-0.5 border border-slate-300 w-[25px]">Rộng</th>
                        <th className="px-1 py-0.5 border border-slate-300 w-[25px]">Cao</th>
                        <th className="px-1 py-0.5 border border-slate-300 w-[45px] text-sky-700">Gạch (v)</th>
                        <th className="px-1 py-0.5 border border-slate-300 w-[45px] text-sky-700">Xi măng (kg)</th>
                        <th className="px-1 py-0.5 border border-slate-300 w-[40px] text-sky-700">Cát (m³)</th>
                        <th className="px-1 py-0.5 border border-slate-300 w-[40px] text-sky-700">Đá (m³)</th>
                        <th className="px-1 py-0.5 border border-slate-300 w-[45px] text-sky-700">Thép (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const categories = [
                          'I. PHẦN MÓNG & NỀN MÓNG',
                          'II. PHẦN THÂN - CỘT, DẦM, SÀN',
                          'III. PHẦN TƯỜNG XÂY GẠCH',
                          'IV. PHẦN TRÁT, CHỐNG THẤM, HOÀN THIỆN',
                          'V. ỐP LÁT & HOÀN THIỆN MẶT'
                        ];
                        let stt = 1;

                        return categories.map(cat => {
                          const catRows = takeoffRows.filter((r: any) => r.category === cat);
                          if (catRows.length === 0) return null;

                          return (
                            <React.Fragment key={cat}>
                              <tr className="bg-slate-100 font-bold text-slate-800">
                                <td colSpan={17} className="px-2 py-1 text-left border border-slate-200">
                                  {cat}
                                </td>
                              </tr>

                              {catRows.map((row: any) => {
                                const hasDim = row.dai > 0 || row.rong > 0 || row.cao > 0;
                                return (
                                  <tr key={row.id} className="hover:bg-slate-50 transition-colors text-center text-slate-700">
                                    <td className="px-1 py-1 border border-slate-200">{stt++}</td>
                                    <td className="px-1.5 py-1 border border-slate-200 text-left font-medium text-slate-900 leading-tight">{row.name}</td>
                                    <td className="px-1 py-1 border border-slate-200 truncate">{row.maDM || '-'}</td>
                                    <td className="px-1 py-1 border border-slate-200">{row.unit}</td>
                                    <td className="px-1 py-1 border border-slate-200 font-mono">{hasDim && row.dai > 0 ? row.dai.toFixed(2) : '-'}</td>
                                    <td className="px-1 py-1 border border-slate-200 font-mono">{hasDim && row.rong > 0 ? row.rong.toFixed(2) : '-'}</td>
                                    <td className="px-1 py-1 border border-slate-200 font-mono">{hasDim && row.cao > 0 ? row.cao.toFixed(2) : '-'}</td>
                                    <td className="px-1 py-1 border border-slate-200 font-mono">{row.qty > 0 ? row.qty : '-'}</td>
                                    <td className="px-1 py-1 border border-slate-200 text-right font-bold font-mono">{row.klTong > 0 ? row.klTong.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                                    <td className="px-1 py-1 border border-slate-200 font-mono">{row.haoHut > 0 ? `${row.haoHut}%` : '-'}</td>
                                    
                                    <td className="px-1 py-1 border border-slate-200 text-right text-slate-650 font-mono">{row.gach > 0 ? row.gach.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                                    <td className="px-1 py-1 border border-slate-200 text-right text-slate-650 font-mono">{row.ximang > 0 ? row.ximang.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                                    <td className="px-1 py-1 border border-slate-200 text-right text-slate-650 font-mono">{row.cat > 0 ? row.cat.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                                    <td className="px-1 py-1 border border-slate-200 text-right text-slate-650 font-mono">{row.da > 0 ? row.da.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                                    <td className="px-1 py-1 border border-slate-200 text-right text-slate-650 font-mono">{row.thep > 0 ? row.thep.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                                    
                                    <td className="px-1.5 py-1 border border-slate-200 text-right font-mono">{row.price ? row.price.toLocaleString('vi-VN') : '-'}</td>
                                    <td className="px-1.5 py-1 border border-slate-200 text-right font-bold text-slate-800 font-mono">{(row.cost || 0).toLocaleString('vi-VN')}</td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        });
                      })()}

                      <tr className="bg-emerald-50/60 border-t-2 border-slate-300 text-[9px] font-black uppercase text-slate-900 text-center">
                        <td colSpan={2} className="px-2 py-1.5 text-left border border-slate-300 font-bold">TỔNG CỘNG HỒ SƠ</td>
                        <td colSpan={6} className="border border-slate-300"></td>
                        <td className="px-1 py-1.5 text-right border border-slate-300 font-mono text-emerald-800">{takeoffTotals.klTong.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="border border-slate-300"></td>
                        <td className="px-1 py-1.5 text-right border border-slate-300 font-mono text-sky-800">{takeoffTotals.gach.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-1 py-1.5 text-right border border-slate-300 font-mono text-sky-800">{takeoffTotals.ximang.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-1 py-1.5 text-right border border-slate-300 font-mono text-sky-800">{takeoffTotals.cat.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-1 py-1.5 text-right border border-slate-300 font-mono text-sky-800">{takeoffTotals.da.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-1 py-1.5 text-right border border-slate-300 font-mono text-sky-800">{takeoffTotals.thep.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="border border-slate-300"></td>
                        <td className="px-1.5 py-1.5 text-right border border-slate-300 font-mono text-emerald-800 text-[10px] font-black">{(takeoffTotals.cost).toLocaleString('vi-VN')} đ</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs font-semibold italic text-left mb-6 font-sans text-slate-800 flex items-center gap-1.5 shadow-inner">
                  <span className="text-[#00a651] font-bold not-italic">Số tiền bằng chữ:</span>
                  <span className="text-slate-800 font-serif font-semibold">{docSoTiengViet(takeoffTotals.cost)}</span>
                </div>

                {/* SIGNATURE BLOCK */}
                <div className="grid grid-cols-2 gap-4 pt-10 mt-6 font-sans text-xs">
                  <div className="text-center space-y-12">
                    <div>
                      <p className="font-black text-slate-900 uppercase tracking-wide leading-tight">CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</p>
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-0.5">Tổng Giám đốc</p>
                    </div>
                    <div className="pt-2">
                      <span className="font-black text-[#00a651] text-xs underline decoration-dotted tracking-wider font-sans">Trương Hữu Long</span>
                    </div>
                  </div>
                  <div className="text-center space-y-12">
                    <div>
                      <p className="font-black text-slate-900 uppercase tracking-wide leading-tight">Duyệt và xác nhận</p>
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-0.5">KHÁCH HÀNG</p>
                    </div>
                    <div className="pt-2">
                      <span className="font-black text-slate-800 text-xs underline decoration-dotted tracking-wider font-sans">
                        {quoteData.customerName || 'Ngon Nguyễn'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : quoteData.selectedHouseType && subQuoteTab === 'final_quote' ? (
              <FinalQuoteDocument quoteData={quoteData} />
            ) : (
              <div className="bg-white p-3 md:p-8 rounded-2xl shadow-sm border border-slate-250 select-text font-serif text-slate-900 leading-normal max-w-4xl mx-auto my-1 relative print:border-none print:shadow-none print:p-0">
                {/* Print Trigger & Approval Buttons (Visible only on UI screen, hidden during printing) */}
                <div className="absolute right-6 top-6 flex items-center gap-2 print:hidden no-print">
                  {isApproved ? (
                    <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold font-sans flex items-center gap-1 shadow-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Đã Duyệt
                    </span>
                  ) : (
                    <button
                      onClick={handleApproveQuote}
                      className="px-3.5 py-1.5 bg-amber-500 text-white hover:bg-amber-600 transition-colors rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm animate-pulse"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      Duyệt Báo Giá
                    </button>
                  )}
                  <button
                    onClick={handlePrint}
                    className="px-3.5 py-1.5 bg-[#00a651] text-white hover:bg-[#008f45] transition-colors rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    In Báo Giá
                  </button>
                </div>

                {isApproved && (
                  <div className="absolute top-24 right-10 md:right-16 transform rotate-12 border-4 border-emerald-500 text-emerald-500 font-extrabold uppercase px-4 py-2 rounded-lg text-sm tracking-widest font-sans flex items-center gap-1 bg-white/95 shadow-md pointer-events-none select-none z-50">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 animate-pulse" />
                    ĐÃ PHÊ DUYỆT
                  </div>
                )}

      {/* 1. COMP-HEADER: LOGO & COMPANY INFO */}
      <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-4 border-b border-[#00a651] pb-4 mb-5">
        <div className="flex items-center gap-3 text-left">
          {quoteData.companyLogoImg ? (
            <div className="max-w-[120px] max-h-[60px] flex items-center justify-center overflow-hidden shrink-0">
              <img 
                src={quoteData.companyLogoImg} 
                referrerPolicy="no-referrer" 
                className="max-w-full max-h-[60px] object-contain rounded-lg" 
                alt="Logo" 
              />
            </div>
          ) : (
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center border border-[#00a651]/20 p-2 shrink-0">
              <svg viewBox="0 0 100 100" className="w-10 h-10 text-[#00a651]" fill="currentColor">
                <path d="M50 15 L15 48 L25 48 L25 85 L75 85 L75 48 L85 48 Z" fill="none" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
                <path d="M42 85 L42 55 L58 55 L58 85" fill="none" stroke="currentColor" strokeWidth="6" />
                <path d="M15 15 L45 42 L35 48" fill="none" stroke="currentColor" strokeWidth="4" />
              </svg>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-black tracking-widest text-[#00a651] font-sans m-0 leading-tight">
              {quoteData.companyLogoText !== undefined && quoteData.companyLogoText !== '' ? quoteData.companyLogoText : "HOANG LONG"}
            </h1>
            <p className="text-[10px] font-bold text-slate-600 tracking-widest uppercase font-sans m-0 leading-tight">
              {quoteData.companySlogan !== undefined && quoteData.companySlogan !== '' ? quoteData.companySlogan : "Construction - Furniture - Doors"}
            </p>
            {quoteData.companyAddressInfo ? (
              <div 
                className="text-[9px] text-slate-500 font-sans mt-1 space-y-0.5" 
                dangerouslySetInnerHTML={{ __html: sanitizeHTML(quoteData.companyAddressInfo) }}
              />
            ) : (
              <div className="text-[9px] text-slate-500 font-sans mt-1">
                <p className="m-0">📍 Địa điểm kinh doanh: Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng</p>
                <p className="m-0">🏠 Địa chỉ: 54/20 Kim Đồng, Phường 6, TP. Đà Lạt, tỉnh Lâm Đồng</p>
              </div>
            )}
          </div>
        </div>

        {quoteData.companyContactInfo ? (
          <div 
            className="text-center md:text-right font-sans text-[10px] text-slate-500 space-y-0.5 md:pt-1 text-left md:text-right" 
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(quoteData.companyContactInfo) }}
          />
        ) : (
          <div className="text-center md:text-right font-sans text-[10px] text-slate-500 space-y-0.5 md:pt-1">
            <p className="m-0"><span className="font-bold text-slate-700">📞 Hotline:</span> 0966 545 959 - 0374 883 979</p>
            <p className="m-0"><span className="font-bold text-slate-700">✉ Email:</span> hoanglongld.com@gmail.com</p>
            <p className="m-0"><span className="font-bold text-slate-700">🌐 Web:</span> hoanglongld.com</p>
          </div>
        )}
      </div>

      {/* 2. TITLE GRID: BẢNG BÁO GIÁ */}
      <div className="bg-[#00a651] py-2.5 px-4 mb-4 text-center rounded-md">
        <h2 className="text-lg font-black text-white uppercase tracking-widest m-0 font-sans">
          {quoteData.selectedHouseType 
            ? "BẢNG PHÂN BỔ KINH PHÍ & KHÁI TOÁN XÂY DỰNG" 
            : quoteData.sector === 'mechanical'
              ? "BẢNG QUYẾT TOÁN CHI ĐỘNG CƠ KHÍ & GIA CÔNG"
              : "BẢNG BÁO GIÁ NỘI THẤT CHI TIẾT"}
        </h2>
      </div>

      {/* 3. METADATA PROFILE */}
      <div className="grid grid-cols-12 gap-x-6 gap-y-3 pb-4 pt-1 mb-2 text-xs border border-slate-200 border-dashed p-4 rounded-xl bg-slate-50/50">
        <div className="col-span-12 md:col-span-7 space-y-2">
          <div className="flex items-baseline">
            <span className="font-bold text-slate-700 w-24 shrink-0">Mã báo giá:</span>
            <span className="text-slate-800 font-bold border-b border-dotted border-slate-300 grow pb-0.5">{quoteData.code || `BG-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 899)}`}</span>
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

        <div className="col-span-12 md:col-span-5 space-y-2">
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

      {/* 3.1 CONSTRUCTION SPECIFICATIONS (if construction quote) */}
      {quoteData.selectedHouseType && (
        <div className="my-4 border border-dashed border-[#00a651]/40 rounded-xl p-4 bg-emerald-50/20 font-sans text-xs space-y-4">
          <h3 className="font-extrabold text-[11px] text-[#00a651] uppercase tracking-wider border-b border-emerald-100 pb-2 flex items-center gap-1.5">
            📊 THÔNG SỐ KỸ THUẬT & LOẠI NHÀ ĐÃ CHỌN
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* PANEL 1: THÔNG SỐ VẬT LÝ MẶT BẰNG */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm space-y-2">
              <span className="block font-black text-[#1e3a8a] border-b pb-1 text-[10px] uppercase tracking-wide">
                📐 THÔNG SỐ VẬT LÝ MẶT BẰNG
              </span>
              <div className="space-y-1.5 pt-1 text-left">
                <div className="flex justify-between">
                  <span className="text-slate-500">Chiều dài mặt bằng:</span>
                  <span className="font-bold text-slate-800 font-mono">{quoteData.chieuDai} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Chiều rộng mặt bằng:</span>
                  <span className="font-bold text-slate-800 font-mono">{quoteData.chieuRong} m</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1.5">
                  <span className="text-slate-500 font-bold">Diện tích sàn / tầng:</span>
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
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm space-y-2">
              <span className="block font-black text-[#1e3a8a] border-b pb-1 text-[10px] uppercase tracking-wide">
                🏨 PHÂN LOẠI & THI THIẾT KẾ
              </span>
              <div className="space-y-1.5 pt-1 text-left">
                <div className="flex justify-between">
                  <span className="text-slate-500">Loại nhà đã chọn:</span>
                  <span className="font-extrabold text-indigo-700">{quoteData.selectedHouseType}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1.5">
                  <span className="text-slate-600 font-semibold">Đơn giá định mức TB:</span>
                  <span className="font-black text-[#00a651] font-mono">{quoteData.donGiaKhaiToan?.toLocaleString('vi-VN')} đ/m²</span>
                </div>
                <div className="flex justify-between pt-1 text-[10px]">
                  <span className="text-slate-500">Mức gia dao động:</span>
                  <span className="font-semibold text-slate-500 font-mono">
                    {quoteData.minPrice?.toLocaleString('vi-VN')} - {quoteData.maxPrice?.toLocaleString('vi-VN')} đ/m²
                  </span>
                </div>
                {quoteData.nganSachNoiThat ? (
                  <div className="flex justify-between border-t border-slate-100 pt-1.5">
                    <span className="text-slate-500">Ngân sách nội thất rời:</span>
                    <span className="font-extrabold text-amber-600 font-mono">{quoteData.nganSachNoiThat?.toLocaleString('vi-VN')} đ</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* PANEL 3: ĐẶC ĐIỂM KẾT CẤU CHÍNH */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm space-y-2 text-left">
              <span className="block font-black text-[#1e3a8a] border-b pb-1 text-[10px] uppercase tracking-wide">
                🏗️ ĐẶC ĐIỂM KẾT CẤU CHÍNH
              </span>
              <p className="text-slate-700 leading-relaxed font-semibold italic text-[10.5px] pt-1">
                {quoteData.features || "Đặc điểm kết cấu móng đơn/bằng, dầm cột dầm lớn BTCT chịu lực vững chãi, quy hoạch xây thô và hoàn thiện cơ bản theo thiết kế chi tiết."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* GREETING */}
      <div className="my-4 text-xs italic text-slate-600 leading-relaxed font-sans text-left space-y-1">
        <p className="m-0">Trước hết, chúng tôi xin chân thành cảm ơn sự tin tưởng và hợp tác của quý khách hàng đối với Công ty TNHH Hoàng Long.</p>
        <p className="m-0">
          {quoteData.selectedHouseType
            ? "Theo yêu cầu tư vấn và thiết kế công trình xây thô biệt thự/nhà ở của quý khách, chúng tôi trân trọng gửi bảng phân bổ khái toán kinh phí thầu như sau:"
            : quoteData.sector === 'mechanical'
              ? "Theo yêu cầu khảo sát, tư vấn thiết kế chế tạo kết cấu phụ trợ sắt thép nhôm kính của quý khách, chúng tôi trân trọng gửi bảng quyết toán kinh phí chi tiết như sau:"
              : "Theo yêu cầu tư vấn và thiết kế của quý khách hàng, chúng tôi trân trọng gửi bảng báo giá thi công hoàn thiện chi tiết như sau:"}
        </p>
      </div>

      {/* 4. MAIN QUOTATION TABLE */}
      <div className="overflow-x-auto my-5 border border-slate-200 rounded-lg shadow-sm">
        <table className="w-full text-xs text-left border-collapse font-sans">
          <thead>
            {quoteData.selectedHouseType ? (
              <tr className="bg-[#00a651] text-white text-[11px] font-bold uppercase tracking-wider text-center">
                <th className="py-3 px-2 border border-slate-200 text-center w-10">STT</th>
                <th className="py-3 px-3 border border-slate-200 text-left w-1/3">Dòng công tác xây thô & hoàn thiện</th>
                <th className="py-3 px-2 border border-slate-200 text-center w-24">Tỷ lệ (%)</th>
                <th className="py-3 px-3 border border-slate-200 text-left">Định lượng vật liệu & Ghi chú</th>
                <th className="py-3 px-2 border border-slate-200 text-center w-24">Khối lượng</th>
                <th className="py-3 px-2 border border-slate-200 text-center w-20">Đơn vị</th>
                <th className="py-3 px-3 border border-slate-250 text-right w-28">Đơn giá</th>
                <th className="py-3 px-3 border border-slate-250 text-right w-36">Thành tiền (đồng)</th>
              </tr>
            ) : quoteData.sector === 'mechanical' ? (
              <tr className="bg-[#00a651] text-white text-[11px] font-bold uppercase tracking-wider text-center">
                <th className="py-3 px-2 border border-slate-200 text-center w-10">STT</th>
                <th className="py-3 px-3 border border-slate-200 text-left w-1/4">Chi tiết sản phẩm & thông số kỹ thuật</th>
                <th className="py-3 px-2 border border-slate-200 text-center w-28">Kích thước (Ngang x Cao)</th>
                <th className="py-3 px-3 border border-slate-200 text-left">Hệ nhôm / Màu sắc / Loại kính / Phụ kiện đi kèm</th>
                <th className="py-3 px-2 border border-slate-200 text-center w-12">Đvt</th>
                <th className="py-3 px-2 border border-slate-200 text-center w-12">SL</th>
                <th className="py-3 px-3 border border-slate-200 text-right w-24">Đơn giá định mức</th>
                <th className="py-3 px-3 border border-slate-200 text-right w-28">Thành tiền thực tế</th>
              </tr>
            ) : (
              <tr className="bg-[#00a651] text-white text-[11px] font-bold uppercase tracking-wider text-center">
                <th className="py-3 px-2 border border-slate-200 text-center w-10">STT</th>
                <th className="py-3 px-3 border border-slate-200 text-center w-1/4">Tên sản phẩm</th>
                <th className="py-3 px-2 border border-slate-200 text-center w-18">Hình ảnh</th>
                <th className="py-3 px-3 border border-slate-200 text-center">Thông số kỹ thuật / Vật liệu cấu tạo</th>
                <th className="py-3 px-2 border border-slate-200 text-center w-12">Đvt</th>
                <th className="py-3 px-2 border border-slate-200 text-center w-12">SL</th>
                <th className="py-3 px-3 border border-slate-200 text-right w-24">Đơn giá</th>
                <th className="py-3 px-3 border border-slate-200 text-right w-28">Thành tiền</th>
              </tr>
            )}
          </thead>
          <tbody>
            {items.map((item, idx) => {
              // Build dynamic spec based on dimensions or predefined format
              const hasDimensions = item.width || item.height || item.depth;
              const unitVal = item.unit || 'm';
              const unitPriceVal = item.unitPrice || Math.round(item.totalPrice / (item.qty || 1)) || 0;
              const totalPriceVal = item.totalPrice || (unitPriceVal * (item.qty || 1)) || 0;

              return (
                <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                  {quoteData.selectedHouseType ? (
                    <>
                      {/* STT */}
                      <td className="p-3 border border-slate-200 text-center font-bold text-slate-500">
                        {idx + 1}
                      </td>
                      
                      {/* Dòng công tác */}
                      <td className="p-3 border border-slate-200 font-bold text-slate-900 leading-normal text-left">
                        {item.productName}
                      </td>
                      
                      {/* Tỷ lệ % */}
                      <td className="p-3 border border-slate-200 text-center font-extrabold text-[#1e3a8a] bg-slate-50/50 font-mono">
                        {item.ratioPercent || 'định mức'}
                      </td>
                      
                      {/* Định lượng vật liệu & Ghi chú */}
                      <td className="p-3 border border-slate-200 text-slate-700 leading-relaxed text-left text-[11px]">
                        <div>{item.notes || item.material || 'Xây cát đá mác xi măng liên quan'}</div>
                      </td>
                      
                      {/* Khối lượng */}
                      <td className="p-3 border border-slate-200 text-center font-black text-slate-900 font-mono">
                        {item.qty}
                      </td>
                      
                      {/* Đơn vị */}
                      <td className="p-3 border border-slate-200 text-center text-slate-650 font-medium font-sans">
                        {item.unit || 'Gói'}
                      </td>
                      
                      {/* Đơn giá */}
                      <td className="p-3 border border-slate-200 text-right font-semibold text-slate-700 font-mono">
                        {unitPriceVal.toLocaleString('vi-VN')}
                      </td>
                      
                      {/* Thành tiền (đồng) */}
                      <td className="p-3 border border-slate-200 text-right font-black text-[#00a651] font-mono">
                        {totalPriceVal.toLocaleString('vi-VN')}
                      </td>
                    </>
                  ) : quoteData.sector === 'mechanical' ? (
                    <>
                      {/* STT */}
                      <td className="p-3 border border-slate-200 text-center font-bold text-slate-500">
                        {idx + 1}
                      </td>
                      
                      {/* Chi tiết sản phẩm */}
                      <td className="p-3 border border-slate-200 font-bold text-slate-900 leading-normal text-left">
                        {item.productName || item.name}
                      </td>
                      
                      {/* Kích thước */}
                      <td className="p-3 border border-slate-200 text-center font-mono text-slate-700 font-semibold">
                        {item.ngang || item.width ? `${item.ngang || item.width}m x ${item.cao || item.height}m` : 'Theo thực tế'}
                      </td>
                      
                      {/* Thông số kỹ thuật / Phụ kiện */}
                      <td className="p-3 border border-slate-200 text-slate-700 leading-relaxed text-left text-[11px]">
                        {item.pricingMethod === 'custom' ? (
                          <div className="space-y-1">
                            <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] uppercase">Dự toán phôi</span>
                            <p className="m-0 text-slate-600 font-medium">Bản mã gia cường dày: {(item.weightKg || 0).toLocaleString('vi-VN')} kg phôi sắt</p>
                          </div>
                        ) : (
                          <div className="space-y-0.5 font-medium text-slate-800">
                            {item.he && <div><span className="text-slate-400 font-bold">Hệ:</span> {item.he}</div>}
                            {item.mauSac && <div><span className="text-slate-400 font-bold">Màu:</span> {item.mauSac}</div>}
                            {item.kinh && <div><span className="text-slate-400 font-bold">Kính:</span> {item.kinh}</div>}
                            {item.phuKien && <div><span className="text-slate-400 font-bold">Phụ kiện:</span> {item.phuKien}</div>}
                            {item.notes && <div className="text-rose-600 italic font-semibold mt-1">📍 Ghi chú: {item.notes}</div>}
                          </div>
                        )}
                      </td>
                      
                      {/* Đvt */}
                      <td className="p-3 border border-slate-200 text-center text-slate-650">
                        {item.unit || 'm²'}
                      </td>
                      
                      {/* SL */}
                      <td className="p-3 border border-slate-200 text-center font-black text-slate-900">
                        {item.qty}
                      </td>
                      
                      {/* Đơn giá */}
                      <td className="p-3 border border-slate-200 text-right font-semibold text-slate-700 font-mono">
                        {unitPriceVal.toLocaleString('vi-VN')}
                      </td>
                      
                      {/* Thành tiền */}
                      <td className="p-3 border border-slate-200 text-right font-black text-[#00a651] font-mono">
                        {totalPriceVal.toLocaleString('vi-VN')}
                      </td>
                    </>
                  ) : (
                    <>
                      {/* STT */}
                      <td className="p-3 border border-slate-200 text-center font-bold text-slate-500">
                        {idx + 1}
                      </td>
                      
                      {/* Tên sản phẩm */}
                      <td className="p-3 border border-slate-200 font-bold text-slate-900 leading-normal text-left">
                        {item.productName}
                      </td>
                      
                      {/* Hình ảnh */}
                      <td className="p-2 border border-slate-200 text-center text-[10px] text-slate-400 italic">
                        <span className="inline-block px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-bold border border-slate-200">
                          Mẫu thiết kế
                        </span>
                      </td>
                      
                      {/* Thông số kỹ thuật */}
                      <td className="p-3 border border-slate-200 text-slate-700 leading-relaxed text-left text-[11px] whitespace-pre-line space-y-1">
                        <div className="font-semibold text-slate-800">
                          {item.material || item.lowerCabinetMaterial || item.upperCabinetMaterial || 'Gỗ công nghiệp MDF chống ẩm nhập khẩu chuẩn hãng'}
                        </div>
                        {hasDimensions && (
                          <div className="text-slate-650 font-mono text-[10px] leading-tight">
                            📏 Kích thước: {' '}
                            {item.width ? `${item.width}m` : ''} 
                            {item.height ? ` x ${item.height}m` : ''}
                            {item.depth ? ` x ${item.depth}m` : ''}
                          </div>
                        )}
                        {item.notes && (
                          <p className="text-[#c02428] font-bold text-[10px] italic leading-normal mt-1">
                            📍 Chú ý: {item.notes}
                          </p>
                        )}
                      </td>
                      
                      {/* Đvt */}
                      <td className="p-3 border border-slate-200 text-center text-slate-600 font-medium">
                        {unitVal}
                      </td>
                      
                      {/* Số lượng */}
                      <td className="p-3 border border-slate-200 text-center font-black text-slate-900">
                        {item.qty}
                      </td>
                      
                      {/* Đơn giá */}
                      <td className="p-3 border border-slate-200 text-right font-semibold text-slate-700 font-mono">
                        {unitPriceVal.toLocaleString('vi-VN')}
                      </td>
                      
                      {/* Thành tiền */}
                      <td className="p-3 border border-slate-200 text-right font-black text-[#00a651] font-mono">
                        {totalPriceVal.toLocaleString('vi-VN')}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}

            {/* FINANCIAL SUMMARY TOTALS */}
            {/* 1. Subtotal trước chiết khấu */}
            {discountPercent > 0 && (
              <tr className="bg-slate-50 font-bold">
                <td colSpan={7} className="py-2.5 px-4 border border-slate-200 text-right uppercase tracking-wider text-[10px] text-slate-500">
                  Cộng gộp (Chưa chiết khấu):
                </td>
                <td className="py-2.5 px-3 border border-slate-200 text-right font-bold text-slate-600 font-mono">
                  {subtotalBeforeDiscount.toLocaleString('vi-VN')} đ
                </td>
              </tr>
            )}

            {/* 2. Chiết khấu giảm giá */}
            {discountPercent > 0 && (
              <tr className="bg-slate-50 font-bold">
                <td colSpan={7} className="py-2.5 px-4 border border-slate-200 text-right uppercase tracking-wider text-[10px] text-rose-650">
                  Chiết khấu giảm giá ({discountPercent}%):
                </td>
                <td className="py-2.5 px-3 border border-slate-200 text-right font-black text-rose-600 font-mono">
                  -{discountValue.toLocaleString('vi-VN')} đ
                </td>
              </tr>
            )}

            {/* 3. Cộng tiền trước VAT (CỘNG) */}
            <tr className="bg-[#00a651] text-white font-bold uppercase text-[11px] tracking-wider text-center">
              <td colSpan={7} className="py-2.5 px-4 border border-slate-200 text-right">
                CỘNG (Hạng mục thi công đã chiết khấu):
              </td>
              <td className="py-2.5 px-3 border border-slate-200 text-right font-black font-mono">
                {subtotalAfterDiscount.toLocaleString('vi-VN')} đ
              </td>
            </tr>

            {/* 4. VAT */}
            <tr className="bg-[#00a651] text-white font-bold uppercase text-[11px] tracking-wider text-center bg-opacity-90">
              <td colSpan={7} className="py-2.5 px-4 border border-slate-200 text-right">
                THUẾ GIÁ TRỊ GIA TĂNG (VAT {sheetVatPercent}%):
              </td>
              <td className="py-2.5 px-3 border border-slate-200 text-right font-black font-mono">
                {vatAmount.toLocaleString('vi-VN')} đ
              </td>
            </tr>

            {/* 5. TỔNG CỘNG THANH TOÁN */}
            <tr className="bg-[#00a651] text-white font-black uppercase text-[12px] tracking-widest text-center">
              <td colSpan={7} className="py-3 px-4 border border-slate-200 text-right">
                TỔNG CỘNG GIÁ TRỊ QUYẾT TOÁN THANH TOÁN:
              </td>
              <td className="py-3 px-3 border border-slate-200 text-right font-extrabold font-mono text-white text-sm">
                {grandTotal.toLocaleString('vi-VN')} đ
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* AMOUNT IN WORDS (DYNAMIC) */}
      <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs font-semibold italic text-left mb-6 font-sans text-slate-800 flex items-center gap-1.5 shadow-inner">
        <span className="text-[#00a651] font-bold not-italic">Số tiền bằng chữ:</span>
        <span className="text-slate-800 font-serif font-semibold">{docSoTiengViet(grandTotal)}</span>
      </div>

      {/* 5. ADDITIONAL TERMS & NOTES */}
      <div className="border border-slate-200 rounded-xl p-5 text-[11px] space-y-3 font-sans text-slate-700 bg-slate-50/40 text-left">
        {!(quoteData.sector === 'furniture' || quoteData.sector === 'mechanical' || quoteData.paymentTerms) && (
          <h4 className="font-black text-xs text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-1.5 mb-2 text-[#00a651]">
            ĐIỀU KHOẢN VÀ THỎA THUẬN THANH TOÁN
          </h4>
        )}
        
        {quoteData.paymentTerms ? (
          <div 
            className="rich-text-output space-y-2 leading-relaxed" 
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(quoteData.paymentTerms) }}
          />
        ) : (
          <>
            <p className="m-0 leading-relaxed font-bold text-slate-800 flex items-center gap-1">
              1. Thời gian thực hiện: <span className="font-semibold text-[#00a651] ml-1">{quoteData.sector === 'mechanical' ? "12-18 ngày kể từ ngày thống nhất phương án chế tạo & bản vẽ gia công kĩ thuật." : "10-15 ngày kể từ ngày duyệt thiết kế 3D hoàn chỉnh."}</span>
            </p>
            
            <p className="m-0 leading-relaxed font-bold text-slate-800">
              2. Bảo hành sản phẩm: <span className="font-semibold text-slate-700">{quoteData.sector === 'mechanical' ? "Cơ Khí & Kết cấu sắt thép nhôm kính được bảo hành 01 năm đối với lỗi kỹ thuật sản xuất và mối hàn chịu lực dầm bệ vững chãi; linh phụ kiện đổi mới hoàn toàn." : "Mộc Nội Thất được bảo hành 01 năm đối với lỗi sản xuất; các linh phụ kiện lỗi đổi mới hoàn toàn."}</span>
            </p>

            <div className="pl-0 spacing-y-2 mt-2">
              <p className="m-0 leading-relaxed font-bold text-slate-800">3. Phương thức thanh toán điều khoản chung:</p>
              <ul className="list-none pl-4 m-0 space-y-1 mt-1 text-slate-650">
                <li className="leading-relaxed">
                  👉 <span className="font-bold text-slate-700">3.1 Đặt cọc triển khai:</span> Tạm ứng trước <span className="font-bold text-[#00a651]">50%</span> giá trị đơn hàng ngay sau khi ký kết thống nhất báo giá để xưởng gia công bắt đầu {quoteData.sector === 'mechanical' ? "nhập nguyên vật liệu hộp sắt thép kẽm và tiến hành pha phôi dầm bệ cơ cấu thô." : "pha gỗ và sản xuất cấu kiện."}
                </li>
                <li className="bg-emerald-50 border border-teal-100 rounded-lg p-2 mt-1 leading-normal text-[10.5px]">
                  🏦 <span className="font-bold text-slate-700">Thông tin tài khoản giao dịch chính thức:</span>
                  <div className="font-semibold text-slate-800 mt-0.5 ml-4 font-mono">
                    Số TK: <span className="text-[#00a651] font-bold text-[11.5px]">799201899999</span> - Ngân hàng TMCP Quân Đội (<span className="font-bold">MB BANK</span>)
                    <br />
                    Chủ tài khoản: <span className="uppercase text-slate-900 font-bold text-[11px]">Công ty TNHH Hoàng Long Lâm Đồng</span>
                  </div>
                </li>
                <li className="leading-relaxed">
                  👉 <span className="font-bold text-slate-700">3.2 Nghiệm thu bàn giao:</span> Thanh toán nốt số tiền <span className="font-bold text-[#00a651]">50%</span> còn lại sau khi hoàn thiện bàn giao nghiệm thu lắp ráp thực tế tại công trình.
                </li>
                <li className="leading-relaxed">
                  👉 <span className="font-bold text-slate-700">3.3 Hiệu lực báo giá:</span> Báo giá có hiệu lực thi công trong vòng 15 ngày kể từ ngày ban hành ký gửi.
                </li>
              </ul>
            </div>

            <div className="border-t border-slate-200 border-dashed pt-2.5 mt-2 text-[10px] text-slate-500 italic space-y-0.5 leading-relaxed">
              <p className="m-0"><span className="font-bold uppercase text-slate-600">Lưu ý khách hàng:</span> Đơn giá trên áp dụng theo đúng thiết kế và vật liệu đã chỉ định. Mọi chỉnh sửa thay đổi khác biệt trong quá trình thi công thực tế do quý khách yêu cầu sẽ được hai bên ghi nhận điều chỉnh phát sinh tăng hoặc giảm bằng văn bản.</p>
              <p className="m-0 mt-1">Xin trân trọng cảm ơn sự theo dõi và hợp tác của Quý khách hàng!</p>
            </div>
          </>
        )}
      </div>

      {/* 6. SIGNATURE BLOCK AT THE BOTTOM */}
      <div className="grid grid-cols-2 gap-4 pt-10 mt-6 font-sans text-xs">
        {/* Company Signature */}
        <div className="text-center space-y-12">
          <div>
            <p className="font-black text-slate-900 uppercase tracking-wide leading-tight">CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</p>
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-0.5">Tổng Giám đốc</p>
          </div>
          <div className="pt-2">
            <span className="font-black text-[#00a651] text-xs underline decoration-dotted tracking-wider">Trương Hữu Long</span>
          </div>
        </div>

        {/* Customer Signature */}
        <div className="text-center space-y-12">
          <div>
            <p className="font-black text-slate-900 uppercase tracking-wide leading-tight">Duyệt và xác nhận</p>
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-0.5">KHÁCH HÀNG</p>
          </div>
          <div className="pt-2">
            <span className="font-black text-slate-800 text-xs underline decoration-dotted tracking-wider">
              {quoteData.customerName || 'Ngon Nguyễn'}
            </span>
          </div>
        </div>
      </div>

              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* 4 Custom Document Tabs with professional look, active indicators and icons */}
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-slate-200 pb-3 print:hidden no-print">
        <button
          onClick={() => setActiveTab('quote')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold font-sans rounded-xl transition-all cursor-pointer ${
            activeTab === 'quote'
              ? 'bg-[#00a651] text-white shadow-sm'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Báo Giá
        </button>
        <button
          onClick={() => setActiveTab('contract')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold font-sans rounded-xl transition-all cursor-pointer ${
            activeTab === 'contract'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileSignature className="w-4 h-4" />
          Hợp Đồng
        </button>
        <button
          onClick={() => setActiveTab('acceptance')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold font-sans rounded-xl transition-all cursor-pointer ${
            activeTab === 'acceptance'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          Nghiệm Thu
        </button>
        <button
          onClick={() => setActiveTab('liquidation')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold font-sans rounded-xl transition-all cursor-pointer ${
            activeTab === 'liquidation'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Thanh Lý
        </button>
      </div>

      {renderActiveDocument()}
    </div>
  );
}
