import React, { useState, useEffect } from 'react';
import { Printer, CheckCircle2, FileCheck } from 'lucide-react';
import { dbService } from '../lib/dbService';
import { useNotification } from '../context';

const DEFAULT_MECH_ACCEPTANCE_TEMPLATE = `<h3 style="text-align: center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align: center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align: center; margin-top: -10px;">• • • • • • • • • • • • • • •</div>
<h2 style="text-align: center; margin-top: 20px; font-family: 'Times New Roman', Times, serif; letter-spacing: 1px;"><strong>BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO SẢN PHẨM</strong></h2>
<p style="text-align: center; font-style: italic;">Số: {{SO_BIEN_BAN_NT}}</p>

<p><strong>CÔNG TRÌNH:</strong> {{CONG_TRINH}}</p>
<p><strong>HẠNG MỤC:</strong> {{HANG_MUC}}</p>
<p><strong>ĐỊA ĐIỂM:</strong> {{DIA_DIEM}}</p>

<p>Căn cứ vào Hợp đồng số {{SO_HOP_DONG}} giữa hai bên.</p>

<p>Hôm nay, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}, chúng tôi gồm có:</p>

<p><strong>BÊN A (BÊN MUA): {{TEN_KHACH_HANG}}</strong></p>
<p><strong>BÊN B (BÊN BÁN): {{TEN_CONG_TY}}</strong></p>

<p>Hai bên cùng tiến hành đo đạc nghiệm thu, kiểm tra chất lượng sản phẩm gia công cơ khí hoàn thiện tại công trình với các nội dung sau:</p>

<p><strong>ĐIỀU 1: ĐO ĐẠC THỰC TẾ VÀ CHẤT LƯỢNG GIA CÔNG</strong><br />
- Sản phẩm được gia công chính xác theo bản vẽ kỹ thuật, mối hàn ngấu chịu lực tốt, sơn mạ kẽm phủ bóng bảo vệ bề mặt láng mịn, không trầy xước rỉ sét.<br />
- Kích thước đo đạc thực tế nghiệm thu hoàn toàn khớp với phụ lục chi tiết dưới đây:</p>

<p>{{BANG_CHI_TIET_BÁO_GIÁ}}</p>

<p><strong>ĐIỀU 2: TIẾN ĐỘ THI CÔNG VÀ LẮP DỰNG</strong><br />
- Bên B đã tiến hành hoàn thiện lắp dựng toàn bộ các cấu kiện sắt thép/cơ khí đúng tiến độ đề ra, bảo đảm an toàn lao động và không ảnh hưởng đến các hạng mục xây dựng xung quanh công trình.</p>

<p><strong>ĐIỀU 3: KẾT LUẬN CHUNG</strong><br />
- Đồng ý ký nghiệm thu hoàn thành bàn giao toàn bộ sản phẩm cơ khí công trình cho Bên A đưa vào sử dụng và làm căn cứ thanh quyết toán tài chính.</p>
`;

const DEFAULT_CONS_ACCEPTANCE_TEMPLATE = `<h3 style="text-align: center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
<h3 style="text-align: center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align: center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align: center; margin-top: -10px;">• • • • • • • • • • • • • • •</div>
<p style="text-align: right; font-style: italic;">Số: {{SO_NGHIEM_THU}}/BBNT-XD</p>
<p style="text-align: right; font-style: italic;">Lâm Đồng, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}</p>
<h2 style="text-align: center; margin-top: 20px;"><strong>BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO CÔNG TRÌNH XÂY DỰNG</strong></h2>

<p><em>Căn cứ vào Hợp đồng số: {{SO_HOP_DONG}}, ký ngày {{NGAY_KY_HĐ}} giữa {{TEN_CONG_TY}} và {{TEN_KHACH_HANG}}.</em></p>
<p><strong>Công trình:</strong> {{CONG_TRINH}}</p>
<p><strong>Địa điểm:</strong> {{DIA_DIEM}}</p>

<p>Sau khi thi công hoàn thành và bàn giao đưa vào sử dụng. Hôm nay chúng tôi gồm có:</p>

<p><strong>Bên A (Bên nhận): {{TEN_KHACH_HANG}}</strong></p>
<ul>
  <li>Địa chỉ: {{DIA_CHI_KHACH_HANG}}</li>
  <li>Điện thoại: {{DIEN_THOAI_KHACH_HANG}}</li>
  <li>Mã số thuế: {{MST_KHACH_HANG}}</li>
</ul>

<p><strong>Bên B (Bên giao): {{TEN_CONG_TY}}</strong></p>
<ul>
  <li>Địa chỉ: {{DIA_CHI_CONG_TY}}</li>
  <li>Điện thoại: {{DIEN_THOAI_CONG_TY}}</li>
  <li>Mã số thuế: {{MST_CONG_TY}}</li>
  <li>Đại diện là: {{DAI_DIEN_CONG_TY}} - Chức vụ: {{CHUC_VU_CONG_TY}}</li>
</ul>

<p>Hai bên cùng tiến hành kiểm tra, nghiệm thu, bàn giao với nội dung như sau:</p>

<p><strong>Điều 1: Hạng mục bàn giao</strong></p>
<p>Hạng mục bàn giao theo bảng chi tiết như sau:</p>
<p>{{BANG_CHI_TIET_BÁO_GIÁ}}</p>
<p>Tổng cộng: <strong>{{TONG_CONG}}</strong> VND</p>

<p><strong>Điều 2. Nghiệm thu:</strong></p>
<p>Tất cả các hạng mục công trình do bên B thi công hoàn thành đạt chuẩn chất lượng theo đúng hồ sơ thiết kế được duyệt.</p>
<p>Bên B đã cung cấp vật tư, hoàn thành thi công theo đúng yêu cầu kỹ thuật của Hợp đồng.</p>
<p><strong>Kết luận:</strong> Đồng ý nghiệm thu bàn giao và đưa hạng mục công trình vào sử dụng.</p>
<p>Biên bản kết thúc cùng ngày và được lập thành 03 (ba) bản bên A giữ 1 bản, bên B giữ 2 bản có giá trị pháp lý như nhau.</p>
`;

const DEFAULT_FURN_ACCEPTANCE_TEMPLATE = `<h3 style="text-align: center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
<h3 style="text-align: center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align: center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align: center; margin-top: -10px;">• • • • • • • • • • • • • • •</div>
<p style="text-align: right; font-style: italic;">Số: {{SO_NGHIEM_THU}}</p>
<p style="text-align: right; font-style: italic;">Lâm Đồng, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}</p>
<h2 style="text-align: center; margin-top: 20px;"><strong>BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO</strong></h2>

<p><em>Căn cứ vào Hợp đồng số: {{SO_HOP_DONG}}, ký ngày {{NGAY_KY_HĐ}} giữa {{TEN_CONG_TY}} và {{TEN_KHACH_HANG}}.</em></p>
<p><strong>Công trình:</strong> {{CONG_TRINH}}</p>
<p><strong>Hạng mục:</strong> {{HANG_MUC}}</p>
<p><strong>Địa điểm:</strong> {{DIA_DIEM}}</p>

<p>Sau khi lắp đặt và đưa vào sử dụng. Hôm nay chúng tôi gồm có:</p>

<p><strong>Bên A (Bên nhận): {{TEN_KHACH_HANG}}</strong></p>
<ul>
  <li>Địa chỉ: {{DIA_CHI_KHACH_HANG}}</li>
  <li>Điện thoại: {{DIEN_THOAI_KHACH_HANG}}</li>
  <li>Mã số thuế: {{MST_KHACH_HANG}}</li>
  <li>Số tài khoản: {{STK_KHACH_HANG}}</li>
</ul>

<p><strong>Bên B (Bên giao): {{TEN_CONG_TY}}</strong></p>
<ul>
  <li>Địa chỉ: {{DIA_CHI_CONG_TY}}</li>
  <li>Điện thoại: {{DIEN_THOAI_CONG_TY}}</li>
  <li>Mã số thuế: {{MST_CONG_TY}}</li>
  <li>Số tài khoản: {{STK_CONG_TY}}</li>
  <li>Đại diện là: {{DAI_DIEN_CONG_TY}} - Chức vụ: {{CHUC_VU_CONG_TY}}</li>
</ul>

<p>Hai bên cùng tiến hành kiểm tra, nghiệm thu, bàn giao với nội dung như sau:</p>

<p><strong>Điều 1: Hạng mục bàn giao</strong></p>
<p>Hạng mục bàn giao theo bảng chi tiết như sau:</p>
<p>{{BANG_CHI_TIET_BÁO_GIÁ}}</p>
<p>Tổng cộng: <strong>{{TONG_CONG}}</strong> VND</p>

<p><strong>Điều 2. Nghiệm thu:</strong></p>
<p>Tất cả các hạng mục đồ nội thất do bên B lắp đặt hoàn thành đúng tiến độ đạt chất lượng thẩm mỹ theo đúng yêu cầu đã thỏa thuận.</p>
<p>Bên B bàn giao cho bên A toàn bộ trang thiết bị nội thất hoàn chỉnh và hướng dẫn sử dụng bảo quản đúng cách.</p>
<p><strong>Kết luận:</strong> Đồng ý nghiệm thu và bàn giao đưa vào sử dụng chính thức.</p>
<p>Biên bản lập thành 02 (hai) bản mỗi bên giữ 01 bản có giá trị pháp lý tương đương.</p>
`;

interface AcceptanceDocumentProps {
  quoteData: any;
}

export default function AcceptanceDocument({ quoteData }: AcceptanceDocumentProps) {
  const { addToast } = useNotification();
  const items = quoteData.items || [];
  const discountPercent = quoteData.discountPercent || 0;
  const rawTotal = items.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
  const discountValue = rawTotal * (discountPercent / 100);
  const grandTotal = rawTotal - discountValue;

  const isMechanical = quoteData.sector === 'mechanical';
  const isConstruction = quoteData.sector === 'construction';
  const isFurniture = !isMechanical && !isConstruction;

  const sector = isMechanical ? 'mechanical' : isConstruction ? 'construction' : 'furniture';
  const fallbackTemplate = isMechanical 
    ? DEFAULT_MECH_ACCEPTANCE_TEMPLATE 
    : isConstruction 
      ? DEFAULT_CONS_ACCEPTANCE_TEMPLATE 
      : DEFAULT_FURN_ACCEPTANCE_TEMPLATE;

  const [docHtml, setDocHtml] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingCustom, setLoadingCustom] = useState(true);
  const [acceptanceApproved, setAcceptanceApproved] = useState<boolean>(() => {
    return !!quoteData.acceptanceApproved;
  });

  const handleApproveAcceptance = async () => {
    try {
      setSaving(true);
      await dbService.updateQuoteDocHtml(quoteData.id, { acceptanceApproved: true });
      quoteData.acceptanceApproved = true;
      setAcceptanceApproved(true);
      addToast({ title: '✅ Phê duyệt', message: 'Đã phê duyệt Nghiệm Thu thành công!', type: 'success' });
    } catch (err) {
      console.error('Lỗi khi phê duyệt nghiệm thu:', err);
      addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi phê duyệt. Vui lòng thử lại!', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const editorRef = React.useRef<HTMLDivElement>(null);

  const today = new Date();
  const currentDay = today.getDate().toString().padStart(2, '0');
  const currentMonth = (today.getMonth() + 1).toString().padStart(2, '0');
  const currentYear = today.getFullYear().toString();
  const formattedToday = `${currentDay}/${currentMonth}/${currentYear}`;

  const generateProcessedHtml = (templateToProcess: string) => {
    let html = templateToProcess;
    
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; text-align: left; font-family: 'Times New Roman', Times, serif; color: #000000; border: 1px solid #000000;">
        <thead>
          <tr style="background-color: #fcfcfc; border-bottom: 1px solid #000000;">
            <th style="padding: 8px; border: 1px solid #000000; font-weight: bold; text-align: center;">STT</th>
            <th style="padding: 8px; border: 1px solid #000000; font-weight: bold;">Tên sản phẩm / Quy cách vật tư</th>
            <th style="padding: 8px; border: 1px solid #000000; font-weight: bold; text-align: center;">ĐVT</th>
            <th style="padding: 8px; border: 1px solid #000000; font-weight: bold; text-align: center;">Số lượng</th>
            <th style="padding: 8px; border: 1px solid #000000; font-weight: bold; text-align: right;">Đơn giá (đ)</th>
            <th style="padding: 8px; border: 1px solid #000000; font-weight: bold; text-align: right;">Thành tiền (đ)</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item: any, idx: number) => `
            <tr style="border-bottom: 1px solid #000000;">
              <td style="padding: 8px; border: 1px solid #000000; text-align: center;">${idx + 1}</td>
              <td style="padding: 8px; border: 1px solid #000000;">
                <strong>${item.productName || item.name || ''}</strong>
                ${item.material ? `<br/><span style="font-size: 11px; color: #000000;">${item.material}</span>` : ''}
              </td>
              <td style="padding: 8px; border: 1px solid #000000; text-align: center;">${item.unit || 'Cái'}</td>
              <td style="padding: 8px; border: 1px solid #000000; text-align: center;">${item.qty || 1}</td>
              <td style="padding: 8px; border: 1px solid #000000; text-align: right;">${(item.unitPrice || 0).toLocaleString('vi-VN')}</td>
              <td style="padding: 8px; border: 1px solid #000000; text-align: right;">${(item.totalPrice || 0).toLocaleString('vi-VN')}</td>
            </tr>
          `).join('')}
          <tr style="font-weight: bold; background-color: #fcfcfc;">
            <td colspan="5" style="padding: 8px; border: 1px solid #000000; text-align: right;">Tổng cộng khối lượng nghiệm thu:</td>
            <td style="padding: 8px; border: 1px solid #000000; text-align: right;">${grandTotal.toLocaleString('vi-VN')}</td>
          </tr>
        </tbody>
      </table>
    `;

    const repName = quoteData.config?.customerRepresentative || quoteData.customerName || 'Chưa cập nhật';

    const replacements: Record<string, string> = {
      '{{SO_BIEN_BAN_NT}}': quoteData.code ? `${quoteData.code}/BBNT-HL` : 'BG-2026/BBNT-HL',
      '{{SO_NGHIEM_THU}}': quoteData.code ? `${quoteData.code}/BBNT-HL` : 'BG-2026/BBNT-HL',
      '{{SO_HOP_DONG}}': quoteData.code ? `${quoteData.code}/HĐ-HL` : 'BG-2026/HĐ-HL',
      '{{CONG_TRINH}}': quoteData.projectName || 'Dự án',
      '{{HANG_MUC}}': items[0]?.productName || items[0]?.name || 'Hạng mục thi công',
      '{{DIA_DIEM}}': quoteData.customerAddress || 'Lâm Đồng',
      '{{NGAY}}': currentDay,
      '{{THANG}}': currentMonth,
      '{{NAM}}': currentYear,
      '{{NGAY_KY_HĐ}}': formattedToday,
      '{{TEN_KHACH_HANG}}': quoteData.customerName || 'Chưa cập nhật',
      '{{DIA_CHI_KHACH_HANG}}': quoteData.customerAddress || 'Chưa cập nhật',
      '{{DIEN_THOAI_KHACH_HANG}}': quoteData.customerPhone || 'Chưa cập nhật',
      '{{MST_KHACH_HANG}}': quoteData.config?.customerTaxCode || 'Chưa cập nhật',
      '{{STK_KHACH_HANG}}': quoteData.config?.customerBankAccount || 'Chưa cập nhật',
      '{{TEN_CONG_TY}}': quoteData.companyLogoText || 'CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG',
      '{{DIA_CHI_CONG_TY}}': 'Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng',
      '{{DIEN_THOAI_CONG_TY}}': '0966 545 959',
      '{{MST_CONG_TY}}': '5801372263',
      '{{STK_CONG_TY}}': '799201899999 tại ngân hàng MB Bank Lâm Đồng',
      '{{DAI_DIEN_CONG_TY}}': 'Ông Trương Hữu Long',
      '{{CHUC_VU_CONG_TY}}': 'Giám đốc',
      '{{TONG_CONG}}': grandTotal.toLocaleString('vi-VN'),
      '{{BANG_CHI_TIET_BÁO_GIÁ}}': tableHtml
    };

    Object.entries(replacements).forEach(([placeholder, value]) => {
      const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(escapedPlaceholder, 'g'), value);
    });

    return html;
  };

  useEffect(() => {
    const loadCustomTemplate = async () => {
      try {
        if (quoteData.acceptanceHtml) {
          setDocHtml(quoteData.acceptanceHtml);
          setLoadingCustom(false);
          return;
        }

        const template = quoteData.acceptanceTemplate || (await dbService.quotationConfigs.get(sector))?.acceptanceTemplate || fallbackTemplate;
        setDocHtml(generateProcessedHtml(template));
      } catch (err) {
        console.error(`Lỗi khi tải mẫu nghiệm thu ${sector}:`, err);
        setDocHtml(generateProcessedHtml(fallbackTemplate));
      } finally {
        setLoadingCustom(false);
      }
    };
    loadCustomTemplate();
  }, [sector, fallbackTemplate, quoteData.acceptanceHtml, quoteData.acceptanceTemplate, quoteData.id]);

  const handlePrint = () => {
    window.print();
  };

  const handleSave = async () => {
    if (!editorRef.current) return;
    setSaving(true);
    try {
      const newHtml = editorRef.current.innerHTML;
      await dbService.updateQuoteDocHtml(quoteData.id, { acceptanceHtml: newHtml });
      quoteData.acceptanceHtml = newHtml;
      setDocHtml(newHtml);
      setIsEditing(false);
      addToast({ title: '💾 Đã lưu', message: 'Đã lưu bản in nghiệm thu thành công!', type: 'success' });
    } catch (err) {
      console.error('Lỗi khi lưu bản in nghiệm thu:', err);
      addToast({ title: '❌ Lỗi', message: 'Không thể lưu bản in nghiệm thu. Vui lòng kiểm tra lại kết nối!', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (quoteData.acceptanceHtml) {
      setDocHtml(quoteData.acceptanceHtml);
    } else {
      if (quoteData.acceptanceTemplate) {
        setDocHtml(generateProcessedHtml(quoteData.acceptanceTemplate));
      } else {
        setLoadingCustom(true);
        dbService.quotationConfigs.get(sector).then(config => {
          const template = config?.acceptanceTemplate || fallbackTemplate;
          setDocHtml(generateProcessedHtml(template));
          setLoadingCustom(false);
        }).catch(() => {
          setDocHtml(generateProcessedHtml(fallbackTemplate));
          setLoadingCustom(false);
        });
      }
    }
  };

  const handleRestoreDefault = async () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa tất cả các tùy chỉnh và khôi phục về bản in mặc định?')) {
      setSaving(true);
      try {
        await dbService.updateQuoteDocHtml(quoteData.id, { acceptanceHtml: '' });
        quoteData.acceptanceHtml = '';
        setIsEditing(false);
        setLoadingCustom(true);
        const template = quoteData.acceptanceTemplate || (await dbService.quotationConfigs.get(sector))?.acceptanceTemplate || fallbackTemplate;
        setDocHtml(generateProcessedHtml(template));
        addToast({ title: '✅ Đã khôi phục', message: 'Đã khôi phục bản in nghiệm thu mặc định thành công!', type: 'success' });
      } catch (err) {
        console.error('Lỗi khi khôi phục bản in nghiệm thu:', err);
        addToast({ title: '❌ Lỗi', message: 'Không thể khôi phục bản in nghiệm thu. Vui lòng thử lại!', type: 'error' });
      } finally {
        setLoadingCustom(false);
        setSaving(false);
      }
    }
  };

  const repName = quoteData.config?.customerRepresentative || quoteData.customerName || 'Chưa cập nhật';

  if (loadingCustom) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        Đang tải mẫu nghiệm thu từ cơ sở dữ liệu...
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
        }
        .times-roman-print ul {
          list-style-type: disc !important;
          padding-left: 20px !important;
          margin-bottom: 10px !important;
        }
      `}</style>

      {/* Edit/Save Actions Toolbar */}
      <div className="absolute left-6 top-6 flex items-center gap-2 print:hidden no-print z-10" contentEditable={false}>
        {acceptanceApproved ? (
          <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold font-sans flex items-center gap-1 shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Đã Duyệt
          </span>
        ) : (
          <button
            onClick={handleApproveAcceptance}
            disabled={saving}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white transition-colors rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm animate-pulse active:scale-95"
          >
            <FileCheck className="w-3.5 h-3.5" />
            Duyệt Nghiệm Thu
          </button>
        )}

        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
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
        {quoteData.acceptanceHtml && !isEditing && (
          <button
            onClick={handleRestoreDefault}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-all rounded-xl text-xs font-bold font-sans flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
          >
            Khôi phục mặc định
          </button>
        )}
      </div>

      {/* Approved Stamp on the printed document */}
      {acceptanceApproved && (
        <div className="absolute top-24 right-10 md:right-16 transform rotate-12 border-4 border-emerald-500 text-emerald-500 font-extrabold uppercase px-4 py-2 rounded-lg text-sm tracking-widest font-sans flex items-center gap-1 bg-white/95 shadow-md pointer-events-none select-none z-50">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 animate-pulse" />
          ĐÃ PHÊ DUYỆT
        </div>
      )}

      {/* Print Button floating */}
      <div className="absolute right-6 top-6 flex items-center gap-2 print:hidden no-print" contentEditable={false}>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-[#00a651] text-white hover:bg-[#008f45] transition-colors rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
        >
          <Printer className="w-4 h-4" />
          In Biên Bản Nghiệm Thu {isConstruction ? 'Xây Dựng' : isMechanical ? 'Cơ Khí' : 'Nội Thất'}
        </button>
      </div>

      {/* Freeform editor */}
      <div 
        ref={editorRef}
        className="times-roman-print prose max-w-none text-left text-base space-y-4 print:prose-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: docHtml }}
        contentEditable={isEditing}
        suppressContentEditableWarning={true}
      />
      
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
          <p className="font-bold underline decoration-dotted">TRƯƠNG HỮU LONG</p>
        </div>
      </div>
    </div>
  );
}
