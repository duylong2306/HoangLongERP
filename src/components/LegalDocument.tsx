import React, { useState, useEffect } from 'react';
import { Printer, CheckCircle2, FileCheck, XCircle, FileDown } from 'lucide-react';
import { docSoTiengViet } from './QuotationTableSheet';
import { dbService } from '../lib/dbService';
import { useNotification } from '../context';
import RichTextEditor from './RichTextEditor';
import { exportHtmlToWord } from '../lib/wordExport';
import { replacePlaceholders } from '../lib/docPlaceholders';
import { getDefaultLegalTemplate, legalConfigKey, LegalSector } from '../lib/legalTemplates';

/**
 * HỒ SƠ PHÁP LÝ DỰ ÁN — loại tài liệu thứ 5 của hồ sơ báo giá (cạnh Báo giá, Hợp đồng,
 * Nghiệm thu, Thanh lý). Khung lập → sửa → duyệt → in/xuất Word giống LiquidationDocument.
 *
 * Thứ tự lấy nội dung: bản đã lưu (legalHtml) → mẫu của lĩnh vực ở tab "Mẫu hồ sơ"
 * (quotation_configs khóa legal_<lĩnh vực>) → mẫu mặc định trong code.
 */

interface LegalDocumentProps {
  quoteData: any;
}

export default function LegalDocument({ quoteData }: LegalDocumentProps) {
  const { addToast } = useNotification();
  const items = quoteData.items || [];
  const grandTotal = items.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);

  const isMechanical = quoteData.sector === 'mechanical';
  const isConstruction = quoteData.sector === 'construction';
  const sector: LegalSector = isMechanical ? 'mechanical' : isConstruction ? 'construction' : 'furniture';
  const fallbackTemplate = getDefaultLegalTemplate(sector);

  const [docHtml, setDocHtml] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingCustom, setLoadingCustom] = useState(true);
  // Thông tin doanh nghiệp lấy từ Cài Đặt Hệ Thống (business_profile), không hard-code
  const [businessInfo, setBusinessInfo] = useState<any>(null);
  useEffect(() => {
    dbService.businessProfile.get().then(setBusinessInfo).catch(() => {});
  }, []);
  const [legalApproved, setLegalApproved] = useState<boolean>(() => !!quoteData.legalApproved);

  const handleApprove = async () => {
    try {
      setSaving(true);
      await dbService.updateQuoteDocHtml(quoteData.id, { legalApproved: true });
      quoteData.legalApproved = true;
      setLegalApproved(true);
      addToast({ title: '✅ Thành công', message: 'Đã phê duyệt Hồ Sơ Pháp Lý thành công!', type: 'success' });
    } catch (err) {
      console.error('Lỗi khi phê duyệt hồ sơ pháp lý:', err);
      addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi phê duyệt. Vui lòng thử lại!', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Hủy phê duyệt để mở khóa chỉnh sửa lại — cùng cách làm ở Hợp đồng / Thanh lý
  const handleUnapprove = async () => {
    if (!window.confirm('Hủy phê duyệt để chỉnh sửa lại Hồ Sơ Pháp Lý?\nSau khi sửa xong cần Duyệt lại từ đầu.')) return;
    try {
      setSaving(true);
      await dbService.updateQuoteDocHtml(quoteData.id, { legalApproved: false });
      quoteData.legalApproved = false;
      setLegalApproved(false);
      addToast({ title: '🔓 Đã hủy phê duyệt', message: 'Hồ Sơ Pháp Lý đã được mở khóa để chỉnh sửa.', type: 'info' });
    } catch (err) {
      console.error('Lỗi khi hủy phê duyệt hồ sơ pháp lý:', err);
      addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi hủy phê duyệt. Vui lòng thử lại!', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleExportWord = () => {
    if (!docHtml) return;
    exportHtmlToWord(docHtml, `HoSoPhapLy_${quoteData.code || quoteData.id}`);
  };

  const today = new Date();
  const currentDay = today.getDate().toString().padStart(2, '0');
  const currentMonth = (today.getMonth() + 1).toString().padStart(2, '0');
  const currentYear = today.getFullYear().toString();
  const formattedToday = `${currentDay}/${currentMonth}/${currentYear}`;

  // Điền các tham số {{...}} bằng dữ liệu báo giá + thông tin doanh nghiệp
  const generateProcessedHtml = (templateToProcess: string) => {
    const repName = quoteData.config?.customerRepresentative || quoteData.customerName || 'Chưa cập nhật';
    const replacements: Record<string, string> = {
      '{{SO_HO_SO_PHAP_LY}}': quoteData.code ? `${quoteData.code}/PL-HL` : 'BG-2026/PL-HL',
      '{{SO_HOP_DONG}}': quoteData.code ? `${quoteData.code}/HĐ-HL` : 'BG-2026/HĐ-HL',
      '{{NGAY_KY_HĐ}}': formattedToday,
      '{{CONG_TRINH}}': quoteData.projectName || 'Dự án',
      '{{HANG_MUC}}': items[0]?.productName || items[0]?.name || 'Hạng mục thi công',
      '{{DIA_DIEM}}': quoteData.customerAddress || 'Lâm Đồng',
      '{{NGAY}}': currentDay,
      '{{THANG}}': currentMonth,
      '{{NAM}}': currentYear,
      '{{TEN_KHACH_HANG}}': quoteData.customerName || 'Chưa cập nhật',
      '{{DIA_CHI_KHACH_HANG}}': quoteData.customerAddress || 'Chưa cập nhật',
      '{{DIEN_THOAI_KHACH_HANG}}': quoteData.customerPhone || 'Chưa cập nhật',
      '{{MST_KHACH_HANG}}': quoteData.config?.customerTaxCode || 'Chưa cập nhật',
      '{{STK_KHACH_HANG}}': quoteData.config?.customerBankAccount || 'Chưa cập nhật',
      '{{DAI_DIEN_KHACH_HANG}}': repName,
      '{{CHUC_VU_KHACH_HANG}}': quoteData.config?.customerRepRole || 'Đại diện',
      '{{TEN_CONG_TY}}': businessInfo?.companyName || quoteData.companyLogoText || 'CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG',
      '{{DIA_CHI_CONG_TY}}': businessInfo?.address || 'Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng',
      '{{DIEN_THOAI_CONG_TY}}': businessInfo?.phone || '0966 545 959',
      '{{MST_CONG_TY}}': businessInfo?.taxCode || '5801372263',
      '{{STK_CONG_TY}}': businessInfo?.bankInfo || '799201899999 tại ngân hàng MB Bank Lâm Đồng',
      '{{DAI_DIEN_CONG_TY}}': businessInfo?.representative ? `Ông ${businessInfo.representative}` : 'Ông Trương Hữu Long',
      '{{CHUC_VU_CONG_TY}}': 'Giám đốc',
      '{{TONG_CONG}}': grandTotal.toLocaleString('vi-VN'),
      '{{TONG_CONG_CHU}}': docSoTiengViet(grandTotal),
    };
    return replacePlaceholders(templateToProcess, replacements);
  };

  // Mẫu của lĩnh vực (nếu người dùng đã thiết kế ở tab "Mẫu hồ sơ") hoặc mẫu mặc định
  const loadSectorTemplate = async (): Promise<string> => {
    const cfg = await dbService.quotationConfigs.get(legalConfigKey(sector));
    return cfg?.legalTemplate || fallbackTemplate;
  };

  useEffect(() => {
    const load = async () => {
      try {
        if (quoteData.legalHtml) {
          setDocHtml(quoteData.legalHtml);
          return;
        }
        setDocHtml(generateProcessedHtml(await loadSectorTemplate()));
      } catch (err) {
        console.error(`Lỗi khi tải mẫu hồ sơ pháp lý ${sector}:`, err);
        setDocHtml(generateProcessedHtml(fallbackTemplate));
      } finally {
        setLoadingCustom(false);
      }
    };
    load();
  }, [sector, fallbackTemplate, quoteData.legalHtml, quoteData.id, businessInfo]);

  const handleSave = async () => {
    // docHtml luôn đồng bộ với nội dung đang soạn qua RichTextEditor.onChange
    setSaving(true);
    try {
      await dbService.updateQuoteDocHtml(quoteData.id, { legalHtml: docHtml });
      quoteData.legalHtml = docHtml;
      setIsEditing(false);
      addToast({ title: '💾 Đã lưu', message: 'Đã lưu hồ sơ pháp lý thành công!', type: 'success' });
    } catch (err) {
      console.error('Lỗi khi lưu hồ sơ pháp lý:', err);
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Không thể lưu hồ sơ pháp lý. Vui lòng kiểm tra lại kết nối!', type: 'warning' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    setIsEditing(false);
    if (quoteData.legalHtml) {
      setDocHtml(quoteData.legalHtml);
      return;
    }
    setLoadingCustom(true);
    try {
      setDocHtml(generateProcessedHtml(await loadSectorTemplate()));
    } catch {
      setDocHtml(generateProcessedHtml(fallbackTemplate));
    } finally {
      setLoadingCustom(false);
    }
  };

  const handleRestoreDefault = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tất cả các tùy chỉnh và khôi phục về mẫu hồ sơ pháp lý mặc định?')) return;
    setSaving(true);
    try {
      await dbService.updateQuoteDocHtml(quoteData.id, { legalHtml: '' });
      quoteData.legalHtml = '';
      setIsEditing(false);
      setLoadingCustom(true);
      setDocHtml(generateProcessedHtml(await loadSectorTemplate()));
      addToast({ title: '✅ Thành công', message: 'Đã khôi phục hồ sơ pháp lý mặc định!', type: 'success' });
    } catch (err) {
      console.error('Lỗi khi khôi phục hồ sơ pháp lý:', err);
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Không thể khôi phục hồ sơ pháp lý. Vui lòng thử lại!', type: 'warning' });
    } finally {
      setLoadingCustom(false);
      setSaving(false);
    }
  };

  const repName = quoteData.config?.customerRepresentative || quoteData.customerName || 'Chưa cập nhật';

  if (loadingCustom) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        Đang tải mẫu hồ sơ pháp lý từ cơ sở dữ liệu...
      </div>
    );
  }

  return (
    <div className="bg-white p-4 md:p-12 rounded-2xl shadow-sm border border-slate-200 select-text max-w-4xl mx-auto my-2 relative print:border-none print:shadow-none print:p-0">
      <style>{`
        .times-roman-print, .times-roman-print * {
          font-family: 'Times New Roman', Times, serif !important;
          color: #000000 !important;
        }
        .times-roman-print table,
        .times-roman-print th,
        .times-roman-print td {
          border: 1px solid #000000 !important;
          color: #000000 !important;
          font-family: 'Times New Roman', Times, serif !important;
          padding: 4px 6px;
        }
        .times-roman-print ul {
          list-style-type: disc !important;
          padding-left: 20px !important;
          margin-bottom: 10px !important;
        }
      `}</style>

      {/* Thanh duyệt / chỉnh sửa */}
      <div className="absolute left-6 top-6 flex items-center gap-2 print:hidden no-print z-10" contentEditable={false}>
        {legalApproved ? (
          <div className="flex items-center gap-1">
            <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold font-sans flex items-center gap-1 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Đã Duyệt
            </span>
            <button
              onClick={handleUnapprove}
              disabled={saving}
              title="Hủy phê duyệt để mở khóa chỉnh sửa"
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 border border-rose-200 transition-colors rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            >
              <XCircle className="w-3.5 h-3.5" />
              Hủy phê duyệt
            </button>
          </div>
        ) : (
          <button
            onClick={handleApprove}
            disabled={saving}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white transition-colors rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm animate-pulse active:scale-95"
          >
            <FileCheck className="w-3.5 h-3.5" />
            Duyệt Hồ Sơ Pháp Lý
          </button>
        )}

        {legalApproved ? (
          <span className="px-3 py-1.5 text-[10px] text-slate-500 font-sans italic flex items-center gap-1">
            🔒 Đã duyệt — hủy phê duyệt để chỉnh sửa
          </span>
        ) : !isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white transition-all rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
          >
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
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-all rounded-lg text-xs font-bold font-sans flex items-center gap-1 cursor-pointer active:scale-95"
            >
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 transition-all rounded-lg text-xs font-bold font-sans flex items-center gap-1 cursor-pointer active:scale-95"
            >
              Hủy
            </button>
          </div>
        )}
        {quoteData.legalHtml && !isEditing && !legalApproved && (
          <button
            onClick={handleRestoreDefault}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-all rounded-xl text-xs font-bold font-sans flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
          >
            Khôi phục mặc định
          </button>
        )}
      </div>

      {/* Dấu đã duyệt — chỉ hiện trên màn hình, KHÔNG in ra bản in/PDF */}
      {legalApproved && (
        <div className="absolute top-20 right-10 md:right-16 transform rotate-12 border-4 border-emerald-500/40 text-emerald-500/50 font-extrabold uppercase px-4 py-2 rounded-lg text-sm tracking-widest font-sans flex items-center gap-1 bg-white/10 shadow-md pointer-events-none select-none z-50 print:hidden">
          <CheckCircle2 className="w-5 h-5 text-emerald-500/50 animate-pulse" />
          ĐÃ PHÊ DUYỆT
        </div>
      )}

      {/* Nút in / xuất Word */}
      <div className="absolute right-6 top-6 flex items-center gap-2 print:hidden no-print" contentEditable={false}>
        <button
          onClick={handleExportWord}
          className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
        >
          <FileDown className="w-4 h-4 text-blue-600" />
          Xuất Word
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-[#00a651] text-white hover:bg-[#008f45] transition-colors rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
        >
          <Printer className="w-4 h-4" />
          In Hồ Sơ Pháp Lý {isConstruction ? 'Xây Dựng' : isMechanical ? 'Cơ Khí' : 'Nội Thất'}
        </button>
      </div>

      <div className="times-roman-print">
        <RichTextEditor
          value={docHtml}
          onChange={setDocHtml}
          disabled={!isEditing}
          hideToolbarWhenDisabled
          editorHeightClassName="min-h-[200px] max-h-none prose max-w-none text-left text-base space-y-4 print:prose-sm leading-relaxed"
        />
      </div>

      <div className="times-roman-print mt-12 border-t border-dashed border-slate-300 pt-8 grid grid-cols-2 text-center text-sm" contentEditable={false}>
        <div>
          <p className="font-bold uppercase">ĐẠI DIỆN BÊN A</p>
          <p className="text-xs italic mt-0.5">(Ký và ghi rõ họ tên)</p>
          <div className="h-24"></div>
          <p className="font-bold underline decoration-dotted">{repName}</p>
        </div>
        <div>
          <p className="font-bold uppercase">ĐẠI DIỆN BÊN B</p>
          <p className="text-xs italic mt-0.5">(Ký, đóng dấu và ghi rõ họ tên)</p>
          <div className="h-24"></div>
          <p className="font-bold underline decoration-dotted">
            {businessInfo?.representative ? String(businessInfo.representative).toUpperCase() : 'TRƯƠNG HỮU LONG'}
          </p>
        </div>
      </div>
    </div>
  );
}
