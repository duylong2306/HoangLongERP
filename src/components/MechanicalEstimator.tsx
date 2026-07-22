import React, { useState, useEffect } from 'react';
import { QuoteConfig, QuoteItem, Customer, Project, ProjectDoc, Quote, ArchivedQuote, ProductCatalogItem } from '../types';
import { DEFAULT_QUOTE_CONFIG } from '../data';
import { Plus, Trash2, Sliders, Calculator, FileSpreadsheet, FileText, CheckCircle2, DollarSign, Search, Printer, Send, AlertTriangle, Edit, Save, Check, XCircle } from 'lucide-react';
import { dbService } from '../lib/dbService';
import QuotationTableSheet, { docSoTiengViet } from './QuotationTableSheet';
import RichTextEditor from './RichTextEditor';
import { useNotification } from '../context';

interface MechanicalEstimatorProps {
  onAddQuote?: (newQuote: any) => void;
  customers: Customer[];
  projects: Project[];
  preselectedCustomerId?: string;
  preselectedProjectId?: string;
  currentUser?: any;
  isMechanicalSaved?: boolean;
  setIsMechanicalSaved?: (val: boolean) => void;
  isLocked?: boolean;
  setIsLocked?: (val: boolean) => void;
  loadedQuote?: any;
  setLoadedQuote?: (val: any) => void;
  showTemplateOnly?: boolean;
}

const DEFAULT_MECH_PAYMENT_TERMS = `<p><strong>1. Thời gian thực hiện:</strong> 10-12 ngày.</p>
<p><strong>2. Bảo hành:</strong> Bảo hành 1 năm. Lỗi phụ kiện thay mới.</p>
<p><strong>3. Thanh toán:</strong></p>
<ul style="padding-left: 20px; list-style-type: disc;">
  <li><strong>3.1 Đặt cọc:</strong> <span style="color: #ef4444;"><strong>50%</strong></span> giá trị đơn hàng là ngay khi xác nhận báo giá để xưởng tiến hành sản xuất.</li>
  <li style="list-style-type: none; margin-left: -10px;">🏦 <strong>Thông tin tài khoản:</strong> <span style="color: #ef4444; font-weight: bold;">799201899999 MB BANK - Công ty TNHH Hoàng Long Lâm Đồng</span></li>
  <li><strong>3.2 Thanh toán:</strong> Thanh toán <span style="color: #ef4444;"><strong>50%</strong></span> còn lại ngay khi hoàn thành công việc (Không quá 05 ngày kể từ ngày nhận được hóa đơn tài chính, bên mua trả phí chuyển khoản)</li>
  <li><strong>3.3 Hiệu lực báo giá:</strong> 05 ngày kể từ ngày báo giá.</li>
</ul>
<p><strong>Lưu ý:</strong> <em>Báo giá được áp dụng theo thiết kế và quy cách đã thống nhất. Mọi thay đổi về thiết kế, kích thước, vật liệu hoặc phụ kiện (nếu có) sẽ được xem xét điều chỉnh lại đơn giá cho phù hợp with giá trị sản phẩm thực tế.</em></p>
<p>Xin vui lòng liên hệ với chúng tôi nếu quý khách hàng có cần thêm các yêu cầu nào khác.</p>
<p><strong>Trân trọng cảm ơn.</strong></p>`;

const DEFAULT_MECH_CONTRACT_TEMPLATE = `<h3 style="text-align: center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align: center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align: center; margin-top: -10px;">• • • • • • • • • • • • • • •</div>
<h2 style="text-align: center; margin-top: 20px; font-family: sans-serif; letter-spacing: 1px;"><strong>HỢP ĐỒNG KINH TẾ (THI CÔNG CƠ KHÍ)</strong></h2>
<p style="text-align: center; font-style: italic;">Số: {{SO_HOP_DONG}}</p>

<p><strong>CÔNG TRÌNH:</strong> {{CONG_TRINH}}</p>
<p><strong>HẠNG MỤC:</strong> {{HANG_MUC}}</p>
<p><strong>ĐỊA ĐIỂM:</strong> {{DIA_DIEM}}</p>

<p><em>- Căn cứ Bộ luật Dân sự số 91/2015/QH13 ban hành ngày 24/11/2015;</em></p>
<p><em>- Căn cứ Luật Thương mại số 36/2005/QH11 ban hành ngày 14/06/2005;</em></p>
<p><em>- Căn cứ vào nhu cầu và khả năng thực tế của hai bên.</em></p>

<p>Hôm nay, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}, chúng tôi gồm có:</p>

<p><strong>BÊN A (BÊN MUA): {{TEN_KHACH_HANG}}</strong></p>
<ul>
  <li>Địa chỉ: {{DIA_CHI_KHACH_HANG}}</li>
  <li>Điện thoại: {{DIEN_THOAI_KHACH_HANG}}</li>
  <li>Mã số thuế: {{MST_KHACH_HANG}}</li>
  <li>Số tài khoản: {{STK_KHACH_HANG}}</li>
  <li>Đại diện bởi: {{DAI_DIEN_KHACH_HANG}} - Chức vụ: {{CHUC_VU_KHACH_HANG}}</li>
</ul>

<p><strong>BÊN B (BÊN BÁN): {{TEN_CONG_TY}}</strong></p>
<ul>
  <li>Địa chỉ: {{DIA_CHI_CONG_TY}}</li>
  <li>Điện thoại: {{DIEN_THOAI_CONG_TY}}</li>
  <li>Mã số thuế: {{MST_CONG_TY}}</li>
  <li>Số tài khoản: {{STK_CONG_TY}}</li>
  <li>Đại diện bởi: {{DAI_DIEN_CONG_TY}} - Chức vụ: {{CHUC_VU_CONG_TY}}</li>
</ul>

<p>Sau khi bàn bạc thảo luận, hai bên cùng thống nhất ký kết hợp đồng thi công cơ khí với các điều khoản dưới đây:</p>

<p><strong>ĐIỀU 1: QUY CÁCH VÀ CHẤT LƯỢNG SẢN PHẨM</strong><br />
Số lượng, chủng loại, quy cách kỹ thuật gia công cơ khí được thống nhất chi tiết theo Bảng phụ lục chi tiết đính kèm hợp đồng này.</p>

<p><strong>ĐIỀU 2: THỜI HẠN VÀ ĐỊA ĐIỂM THI CÔNG GIAO HÀNG</strong><br />
Bên B sẽ tiến hành sản xuất gia công và lắp đặt tại địa điểm: {{DIA_DIEM}} theo đúng tiến độ được hai bên thỏa thuận.</p>

<p><strong>ĐIỀU 3: LẮP ĐẶT VÀ NGHIỆM THU</strong><br />
Bên B thi công theo đúng bản vẽ thiết kế do bên A cung cấp. Quá trình lắp dựng bên B phối hợp thợ nền Bên A để đảm bảo độ chính xác vuông góc. Bên A chuẩn bị mặt bằng thi công sạch sẽ và cấp nguồn điện an toàn phục vụ công tác hàn, lắp dựng sản phẩm. Sau khi bên B hoàn tất lắp dựng, hai bên tiến hành nghiệm thu bàn giao đưa vào sử dụng.</p>

<p><strong>ĐIỀU 4: CHÍNH SÁCH BẢO HÀNH</strong><br />
Thời gian bảo hành là 12 tháng kể từ ngày ký Biên bản nghiệm thu bàn giao công trình. Bảo hành toàn diện các lỗi mối hàn nứt gãy, biến dạng kết cấu không do ngoại lực tác động bất thường hoặc sử dụng hóa chất sai chỉ định.</p>

<p><strong>ĐIỀU 5: GIÁ TRỊ HỢP ĐỒNG VÀ PHƯƠNG THỨC THANH TOÁN</strong><br />
- Tổng giá trị hợp đồng: <strong>{{TONG_CONG}}</strong> đồng (Bằng chữ: <em>{{TONG_CONG_CHU}}</em>)<br />
- Thanh toán bằng phương thức chuyển khoản vào tài khoản ngân hàng của Bên B.<br />
- Điều khoản thanh toán: Thanh toán 100% trong vòng 10 ngày kể từ khi nghiệm thu hoàn thành bàn giao và bên A nhận đủ Hóa đơn hợp lệ, Biên bản nghiệm thu, Biên bản thanh lý hợp đồng.</p>

<p><strong>ĐIỀU 6: TRÁCH NHIỆM CỦA MỖI BÊN</strong><br />
- Bên A: Chuẩn bị mặt bằng và nguồn cấp điện, thanh toán đúng hạn quy định.<br />
- Bên B: Gia công cơ khí chính xác theo đúng bản vẽ, đúng chủng loại sắt thép và đảm bảo tiến độ bàn giao.</p>

<p><strong>ĐIỀU 7: GIẢI QUYẾT TRANH CHẤP VÀ PHẠT VI PHẠM</strong><br />
Mọi tranh chấp được ưu tiên giải quyết qua thương lượng hài hòa. Trường hợp chậm trễ tiến độ thi công do lỗi chủ quan sẽ bị phạt 0.1% giá trị hợp đồng cho mỗi ngày chậm trễ nhưng không vượt quá 12% tổng giá trị.</p>

<p><strong>ĐIỀU 8: ĐIỀU KHOẢN CHUNG</strong><br />
Hợp đồng này có hiệu lực từ ngày ký đến khi hoàn tất thanh lý. Hợp đồng lập thành 03 bản có giá trị pháp lý tương đương, Bên A giữ 01 bản, Bên B giữ 02 bản.</p>

<p style="margin-top: 40px; font-weight: bold; text-decoration: underline;">PHỤ LỤC 01: DANH SÁCH CHI TIẾT SẢN PHẨM GIA CÔNG CƠ KHÍ</p>
<p>{{BANG_CHI_TIET_BÁO_GIÁ}}</p>
`;

const DEFAULT_MECH_ACCEPTANCE_TEMPLATE = `<h3 style="text-align: center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align: center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align: center; margin-top: -10px;">• • • • • • • • • • • • • • •</div>
<h2 style="text-align: center; margin-top: 20px; font-family: sans-serif;"><strong>BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO CƠ KHÍ</strong></h2>
<p style="text-align: center; font-style: italic;">Số: {{SO_BIEN_BAN_NT}}</p>

<p>Căn cứ vào Hợp đồng kinh tế số: {{SO_HOP_DONG}} ký ngày {{NGAY_KY_HĐ}} giữa Bên mua và Bên bán.</p>
<p><strong>Công trình:</strong> {{CONG_TRINH}}</p>
<p><strong>Hạng mục:</strong> {{HANG_MUC}}</p>
<p><strong>Địa điểm:</strong> {{DIA_DIEM}}</p>

<p>Hôm nay, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}, chúng tôi tiến hành nghiệm thu bàn giao gồm:</p>

<p><strong>BÊN A (BÊN NHẬN): {{TEN_KHACH_HANG}}</strong></p>
<ul>
  <li>Địa chỉ: {{DIA_CHI_KHACH_HANG}}</li>
  <li>Đại diện bởi: {{DAI_DIEN_KHACH_HANG}} - Chức vụ: {{CHUC_VU_KHACH_HANG}}</li>
</ul>

<p><strong>BÊN B (BÊN GIAO): {{TEN_CONG_TY}}</strong></p>
<ul>
  <li>Địa chỉ: {{DIA_CHI_CONG_TY}}</li>
  <li>Đại diện bởi: {{DAI_DIEN_CONG_TY}} - Chức vụ: {{CHUC_VU_CONG_TY}}</li>
</ul>

<p>Hai bên cùng tiến hành đo đạc, kiểm tra nghiệm thu kết quả thi công thực tế như sau:</p>

<p><strong>ĐIỀU 1: HẠNG MỤC BÀN GIAO CHI TIẾT</strong></p>
<p>{{BANG_CHI_TIET_BÁO_GIÁ}}</p>

<p><strong>ĐIỀU 2: ĐÁNH GIÁ CHẤT LƯỢNG VÀ KẾT LUẬN</strong><br />
- Về chất lượng sản phẩm: Toàn bộ cấu kiện thi công đạt chuẩn bản vẽ thiết kế thống nhất, mối hàn mài nhẵn sơn chống rỉ đầy đủ, các kích thước khớp đúng dung sai.<br />
- Về tiến độ lắp dựng: Đúng tiến độ hợp đồng đề ra.<br />
- Kết luận: Đồng ý nghiệm thu bàn giao và đưa vào vận hành sử dụng chính thức kể từ hôm nay.</p>

<p>Biên bản nghiệm thu được lập thành 03 bản, Bên A giữ 01 bản, Bên B giữ 02 bản.</p>
`;

const DEFAULT_MECH_LIQUIDATION_TEMPLATE = `<h3 style="text-align: center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align: center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align: center; margin-top: -10px;">• • • • • • • • • • • • • • •</div>
<h2 style="text-align: center; margin-top: 20px; font-family: sans-serif;"><strong>BIÊN BẢN THANH LÝ HỢP ĐỒNG KINH TẾ (CƠ KHÍ)</strong></h2>
<p style="text-align: center; font-style: italic;">Số: {{SO_THANH_LY}}</p>

<p>Căn cứ vào Hợp đồng số: {{SO_HOP_DONG}} ký ngày {{NGAY_KY_HĐ}}<br />
Căn cứ vào Biên bản nghiệm thu bàn giao số: {{SO_BIEN_BAN_NT}} ký ngày {{NGAY_NGHIEM_THU}}</p>

<p>Hôm nay, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}, chúng tôi tiến hành thanh lý hợp đồng gồm:</p>

<p><strong>BÊN A: {{TEN_KHACH_HANG}}</strong></p>
<p><strong>BÊN B: {{TEN_CONG_TY}}</strong></p>

<p>Hai bên cùng thống nhất các nội dung thanh lý hợp đồng như sau:</p>

<p><strong>ĐIỀU 1: NỘI DUNG CÔNG VIỆC HOÀN THÀNH</strong><br />
Bên B đã hoàn thành toàn bộ công tác sản xuất, lắp ráp và bàn giao nghiệm thu hạng mục cơ khí theo biên bản nghiệm thu ngày {{NGAY_NGHIEM_THU}}. Bên A xác nhận hài lòng về chất lượng sản phẩm.</p>

<p><strong>ĐIỀU 2: GIÁ TRỊ THANH TOÁN VÀ THANH LÝ TÀI CHÍNH</strong><br />
- Tổng giá trị thanh toán thực tế theo khối lượng nghiệm thu: <strong>{{TONG_CONG}}</strong> đồng (Bằng chữ: <em>{{TONG_CONG_CHU}}</em>).<br />
- Bên A có trách nhiệm thanh toán số tiền còn lại là: <strong>{{TONG_CONG}}</strong> đồng (Bằng chữ: <em>{{TONG_CONG_CHU}}</em>) cho bên B để hoàn tất nghĩa vụ hợp đồng.</p>

<p>- Biên bản lập thành 04 bản có giá trị pháp lý như nhau, Bên A giữ 02 bản, Bên B giữ 02 bản.</p>
`;

export default function MechanicalEstimator({ 
  onAddQuote, 
  customers, 
  projects,
  preselectedCustomerId,
  preselectedProjectId,
  currentUser,
  isMechanicalSaved = false,
  setIsMechanicalSaved,
  isLocked = false,
  setIsLocked,
  loadedQuote,
  setLoadedQuote,
  showTemplateOnly = false
}: MechanicalEstimatorProps) {
  const { addToast } = useNotification();
  // Local fallback states if props not passed (backward compatibility)
  const [localIsSaved, setLocalIsSaved] = useState(false);
  const [localIsLocked, setLocalIsLocked] = useState(false);
  const [localLoadedQuote, setLocalLoadedQuote] = useState<Quote | null>(null);
  const [activeTemplateTab, setActiveTemplateTab] = useState<'quote' | 'contract' | 'acceptance' | 'liquidation'>('quote');
  const [isTemplateEditable, setIsTemplateEditable] = useState(false);

  const handleSetAsDefault = async () => {
    setDbSaving(true);
    setDbSaveSuccess(false);
    setDbSaveError(null);
    try {
      let defaultData = await dbService.quotationConfigs.get('mechanical') || {};
      
      if (activeTemplateTab === 'quote') {
        defaultData.companyLogoImg = companyLogoImg;
        defaultData.companyLogoText = companyLogoText;
        defaultData.companySlogan = companySlogan;
        defaultData.companyAddressInfo = companyAddressInfo;
        defaultData.companyContactInfo = companyContactInfo;
        defaultData.paymentTerms = paymentTerms;
        
        localStorage.setItem('hl_mechanical_company_logo', companyLogoImg);
        localStorage.setItem('hl_mechanical_company_name', companyLogoText);
        localStorage.setItem('hl_mechanical_company_slogan', companySlogan);
        localStorage.setItem('hl_mechanical_company_address', companyAddressInfo);
        localStorage.setItem('hl_mechanical_company_contact', companyContactInfo);
        localStorage.setItem('hl_mechanical_payment_terms', paymentTerms);
      } else if (activeTemplateTab === 'contract') {
        defaultData.contractTemplate = contractTemplate;
        localStorage.setItem('hl_mechanical_contract_template', contractTemplate);
      } else if (activeTemplateTab === 'acceptance') {
        defaultData.acceptanceTemplate = acceptanceTemplate;
        localStorage.setItem('hl_mechanical_acceptance_template', acceptanceTemplate);
      } else if (activeTemplateTab === 'liquidation') {
        defaultData.liquidationTemplate = liquidationTemplate;
        localStorage.setItem('hl_mechanical_liquidation_template', liquidationTemplate);
      }
      
      await dbService.quotationConfigs.save('mechanical', defaultData);
      
      setFeedback({
        type: 'success',
        message: `Đã thiết lập ${
          activeTemplateTab === 'quote' ? 'Mẫu báo giá' :
          activeTemplateTab === 'contract' ? 'Mẫu hợp đồng' :
          activeTemplateTab === 'acceptance' ? 'Mẫu nghiệm thu' : 'Mẫu thanh lý'
        } làm mặc định hệ thống thành công!`
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Lỗi khi đặt làm mặc định:", err);
      setDbSaveError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu thiết lập mặc định!');
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu thiết lập mặc định!'
      });
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setDbSaving(false);
    }
  };

  const handleRestoreDefault = async () => {
    setDbSaving(true);
    setDbSaveSuccess(false);
    try {
      const defaultData = await dbService.quotationConfigs.get('mechanical');
      
      if (activeTemplateTab === 'quote') {
        const logo = defaultData?.companyLogoImg ?? localStorage.getItem('hl_mechanical_company_logo') ?? '';
        const name = defaultData?.companyLogoText ?? localStorage.getItem('hl_mechanical_company_name') ?? 'HOANG LONG';
        const slogan = defaultData?.companySlogan ?? localStorage.getItem('hl_mechanical_company_slogan') ?? 'Construction - Furniture - Doors';
        const address = defaultData?.companyAddressInfo ?? localStorage.getItem('hl_mechanical_company_address') ?? `<p>📍 <strong>Địa điểm kinh doanh:</strong> Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng</p>\n<p>🏠 <strong>Địa chỉ:</strong> 54/20 Kim Đồng, Phường 6, TP. Đà Lạt, tỉnh Lâm Đồng</p>`;
        const contact = defaultData?.companyContactInfo ?? localStorage.getItem('hl_mechanical_company_contact') ?? `<p>📞 <strong>Hotline:</strong> 0966 545 959 - 0374 883 979</p>\n<p>✉ <strong>Email:</strong> hoanglongld.com@gmail.com</p>\n<p>🌐 <strong>Web:</strong> hoanglongld.com</p>`;
        const terms = defaultData?.paymentTerms ?? localStorage.getItem('hl_mechanical_payment_terms') ?? DEFAULT_MECH_PAYMENT_TERMS;

        setCompanyLogoImg(logo);
        setCompanyLogoText(name);
        setCompanySlogan(slogan);
        setCompanyAddressInfo(address);
        setCompanyContactInfo(contact);
        setPaymentTerms(terms);
      } else if (activeTemplateTab === 'contract') {
        const template = defaultData?.contractTemplate ?? localStorage.getItem('hl_mechanical_contract_template') ?? DEFAULT_MECH_CONTRACT_TEMPLATE;
        setContractTemplate(template);
      } else if (activeTemplateTab === 'acceptance') {
        const template = defaultData?.acceptanceTemplate ?? localStorage.getItem('hl_mechanical_acceptance_template') ?? DEFAULT_MECH_ACCEPTANCE_TEMPLATE;
        setAcceptanceTemplate(template);
      } else if (activeTemplateTab === 'liquidation') {
        const template = defaultData?.liquidationTemplate ?? localStorage.getItem('hl_mechanical_liquidation_template') ?? DEFAULT_MECH_LIQUIDATION_TEMPLATE;
        setLiquidationTemplate(template);
      }
      
      setFeedback({
        type: 'success',
        message: `Đã khôi phục ${
          activeTemplateTab === 'quote' ? 'Mẫu báo giá' :
          activeTemplateTab === 'contract' ? 'Mẫu hợp đồng' :
          activeTemplateTab === 'acceptance' ? 'Mẫu nghiệm thu' : 'Mẫu thanh lý'
        } về phiên bản mặc định thành công!`
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Lỗi khi khôi phục mặc định:", err);
      if (activeTemplateTab === 'quote') {
        setCompanyLogoImg('');
        setCompanyLogoText('HOANG LONG');
        setCompanySlogan('Construction - Furniture - Doors');
        setCompanyAddressInfo(`<p>📍 <strong>Địa điểm kinh doanh:</strong> Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng</p>\n<p>🏠 <strong>Địa chỉ:</strong> 54/20 Kim Đồng, Phường 6, TP. Đà Lạt, tỉnh Lâm Đồng</p>`);
        setCompanyContactInfo(`<p>📞 <strong>Hotline:</strong> 0966 545 959 - 0374 883 979</p>\n<p>✉ <strong>Email:</strong> hoanglongld.com@gmail.com</p>\n<p>🌐 <strong>Web:</strong> hoanglongld.com</p>`);
        setPaymentTerms(DEFAULT_MECH_PAYMENT_TERMS);
      } else if (activeTemplateTab === 'contract') {
        setContractTemplate(DEFAULT_MECH_CONTRACT_TEMPLATE);
      } else if (activeTemplateTab === 'acceptance') {
        setAcceptanceTemplate(DEFAULT_MECH_ACCEPTANCE_TEMPLATE);
      } else if (activeTemplateTab === 'liquidation') {
        setLiquidationTemplate(DEFAULT_MECH_LIQUIDATION_TEMPLATE);
      }
      setFeedback({
        type: 'success',
        message: `Đã khôi phục ${
          activeTemplateTab === 'quote' ? 'Mẫu báo giá' :
          activeTemplateTab === 'contract' ? 'Mẫu hợp đồng' :
          activeTemplateTab === 'acceptance' ? 'Mẫu nghiệm thu' : 'Mẫu thanh lý'
        } về mặc định hệ thống thành công!`
      });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setDbSaving(false);
    }
  };

  const isMechSavedVal = isMechanicalSaved !== undefined ? isMechanicalSaved : localIsSaved;
  const setIsMechSavedVal = setIsMechanicalSaved !== undefined ? setIsMechanicalSaved : setLocalIsSaved;
  const isLockedVal = isLocked !== undefined ? isLocked : localIsLocked;
  const setIsLockedVal = setIsLocked !== undefined ? setIsLocked : setLocalIsLocked;
  const loadedQuoteVal = loadedQuote !== undefined ? loadedQuote : localLoadedQuote;
  const setLoadedQuoteVal = setLoadedQuote !== undefined ? setLoadedQuote : setLocalLoadedQuote;
  // Config tỉ lệ % đặc thù cơ khí chế tạo thô
  const [config, setConfig] = useState<QuoteConfig>({
    discountPercent: 1.5,
    accessoryPercent: 8, // Trị số mạ kẽm nguội bóng
    laborPercent: 30,    // Nhân công thầu thợ hàn thợ cơ khí lành nghề
    generalPercent: 12,  // Chi phí máy hàn hơi, máy cắt plasma CNC
    profitPercent: 15,   // Lợi nhuận gộp cơ tính
    wastagePercent: 7,   // Hao hụt mạt kim loại rỉ sét đầu thừa đuôi thẹo
    vatPercent: 8,       // Mặc định VAT 8%
  });
  
  const [showConfig, setShowConfig] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [savedQuoteForPreview, setSavedQuoteForPreview] = useState<Quote | ArchivedQuote | null>(null);
  const [isSentToProject, setIsSentToProject ] = useState(false);
  const [showExistsAlert, setShowExistsAlert] = useState(false);
  const [archivedQuotesList, setArchivedQuotesList] = useState<ArchivedQuote[]>([]);

  useEffect(() => {
    let active = true;
    const fetchArchivedQuotes = async () => {
      try {
        const list = await dbService.archivedQuotes.list('mechanical');
        if (active) {
          setArchivedQuotesList(list);
        }
      } catch (err) {
        console.error("Lỗi khi tải hồ sơ lưu trữ:", err);
      }
    };
    fetchArchivedQuotes();
    const handleMechanicalUpdated = () => fetchArchivedQuotes();
    window.addEventListener('hl-archived-mechanical-quotes-updated', handleMechanicalUpdated);
    window.addEventListener('hl-archived-quotes-updated', handleMechanicalUpdated);
    return () => {
      active = false;
      window.removeEventListener('hl-archived-mechanical-quotes-updated', handleMechanicalUpdated);
      window.removeEventListener('hl-archived-quotes-updated', handleMechanicalUpdated);
    };
  }, [projects]);

  // Khách hàng & dự án được chọn cho báo giá cơ khí
  const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustomerId || '');
  const [selectedProjectId, setSelectedProjectId] = useState(preselectedProjectId || '');

  // Đồng bộ props preselectedProjectId và preselectedCustomerId khi thay đổi từ bên ngoài
  useEffect(() => {
    if (preselectedProjectId) {
      setSelectedProjectId(preselectedProjectId);
    }
  }, [preselectedProjectId]);

  useEffect(() => {
    if (preselectedCustomerId) {
      setSelectedCustomerId(preselectedCustomerId);
    }
  }, [preselectedCustomerId]);

  // Các trường thông tin Khách hàng tự nạp hoặc có sẵn từ dự án
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [projectName, setProjectName] = useState('');

  // Trạng thái cho bộ tìm kiếm dự án nhanh (searchable dropdown)
  const [isProjDropdownOpen, setIsProjDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamics for Custom Customer Dropdown & Quick Creation
  const [isCustDropdownOpen, setIsCustDropdownOpen] = useState(false);
  const [custSearchQuery, setCustSearchQuery] = useState('');
  const [showQuickCreateCust, setShowQuickCreateCust] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustAddress, setQuickCustAddress] = useState('');

  const handleSelectCustomer = (cust: any) => {
    setSelectedCustomerId(cust.id);
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone || '');
    setCustomerAddress(cust.address || '');
    setIsCustDropdownOpen(false);
    setCustSearchQuery('');

    // If there is an active project, update it
    if (selectedProjectId) {
      const proj = projects.find(p => p.id === selectedProjectId);
      if (proj && proj.customerId !== cust.id) {
        dbService.projects.save({
          ...proj,
          customerId: cust.id,
          address: cust.address || proj.address
        }).then(() => {
          window.dispatchEvent(new CustomEvent('hl-projects-updated'));
        }).catch(err => console.error(err));
      }
    }
  };

  const handleQuickCreateCustomer = async () => {
    if (!quickCustName.trim() || !quickCustPhone.trim() || !quickCustAddress.trim()) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng nhập đầy đủ Tên, Số điện thoại và Địa chỉ!', type: 'warning' });
      return;
    }
    const newCustId = `cust_${Date.now()}`;
    const newCust = {
      id: newCustId,
      name: quickCustName.trim(),
      phone: quickCustPhone.trim(),
      address: quickCustAddress.trim(),
      email: '',
    };
    try {
      await dbService.customers.save(newCust);
      window.dispatchEvent(new CustomEvent('hl-customers-updated'));
      
      // Auto select
      setSelectedCustomerId(newCustId);
      setCustomerName(newCust.name);
      setCustomerPhone(newCust.phone);
      setCustomerAddress(newCust.address);
      
      setQuickCustName('');
      setQuickCustPhone('');
      setQuickCustAddress('');
      setShowQuickCreateCust(false);
    } catch (err) {
      console.error("Lỗi tạo khách hàng nhanh:", err);
      addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi tạo khách hàng.', type: 'error' });
    }
  };

  // Đồng bộ thông tin Dự án, Khách hàng khi có thay đổi
  useEffect(() => {
    if (selectedProjectId) {
      const proj = projects.find(p => p.id === selectedProjectId);
      if (proj) {
        const cust = customers.find(c => c.id === proj.customerId);
        setCustomerName(cust ? cust.name : '');
        setCustomerAddress(proj.address || (cust ? cust.address : ''));
        setCustomerPhone(cust ? cust.phone : '');
        setSelectedCustomerId(proj.customerId);
        setProjectName(proj.name);
      }
    }
  }, [selectedProjectId, projects, customers]);


  // Load quote details reactively khi loadedQuote thay đổi từ Quick Search
  useEffect(() => {
    if (loadedQuote && loadedQuote.sector === 'mechanical') {
      if (loadedQuote.items) {
        const loadedItems = loadedQuote.items.map((it: any) => {
          return {
            id: it.id,
            name: it.productName || it.name,
            qty: it.qty,
            totalPrice: it.totalPrice,
            pricingMethod: it.pricingMethod || 'quick',
            sign: it.sign || '',
            drawingType: it.drawingType || 'steel_frame',
            ngang: it.ngang || 0,
            cao: it.cao || 0,
            he: it.he || '',
            mauSac: it.mauSac || '',
            kinh: it.kinh || '',
            phuKien: it.phuKien || '',
            unit: it.unit || 'M2',
            notes: it.notes || '',
            weightKg: it.weightKg || 0,
            unitPricePerKg: it.unitPricePerKg || 0,
            materials: it.materials || '',
            steelTons: it.steelTons || 0,
            steelPricePerTon: it.steelPricePerTon || 0,
            zincCoatLiters: it.zincCoatLiters || 0,
            zincCoatPricePerLiter: it.zincCoatPricePerLiter || 0,
            weldingRodBoxes: it.weldingRodBoxes || 0,
            weldingRodPricePerBox: it.weldingRodPricePerBox || 0,
            directWelderLabor: it.directWelderLabor || 0
          };
        });
        setQuoteItems(loadedItems);
      }
      if (loadedQuote.paymentTerms) setPaymentTerms(loadedQuote.paymentTerms);
      if (loadedQuote.customerId) setSelectedCustomerId(loadedQuote.customerId);
      if (loadedQuote.projectId) setSelectedProjectId(loadedQuote.projectId || '');
      if (loadedQuote.projectName) setProjectName(loadedQuote.projectName);
      if (loadedQuote.customerName) setCustomerName(loadedQuote.customerName);
      if (loadedQuote.customerPhone) setCustomerPhone(loadedQuote.customerPhone || '');
      if (loadedQuote.customerAddress) setCustomerAddress(loadedQuote.customerAddress || '');
      
      // Load custom company header if they exist
      setCompanyLogoImg(loadedQuote.companyLogoImg || '');
      setCompanyLogoText(loadedQuote.companyLogoText || 'HOANG LONG');
      setCompanySlogan(loadedQuote.companySlogan || 'Construction - Furniture - Doors');
      setCompanyAddressInfo(loadedQuote.companyAddressInfo || `<p>📍 <strong>Địa điểm kinh doanh:</strong> Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng</p>\n<p>🏠 <strong>Địa chỉ:</strong> 54/20 Kim Đồng, Phường 6, TP. Đà Lạt, tỉnh Lâm Đồng</p>`);
      setCompanyContactInfo(loadedQuote.companyContactInfo || `<p>📞 <strong>Hotline:</strong> 0966 545 959 - 0374 883 979</p>\n<p>✉ <strong>Email:</strong> hoanglongld.com@gmail.com</p>\n<p>🌐 <strong>Web:</strong> hoanglongld.com</p>`);

      if (loadedQuote.estimatorMode) {
        setEstimatorMode(loadedQuote.estimatorMode);
      } else if (loadedQuote.items && loadedQuote.items.some((it: any) => it.drawingType || it.sign)) {
        setEstimatorMode('door');
      } else {
        setEstimatorMode('steel');
      }

      if (setIsMechanicalSaved) setIsMechanicalSaved(true);
      if (setIsLocked) setIsLocked(true);
    }
  }, [loadedQuote, setIsMechanicalSaved, setIsLocked]);

  useEffect(() => {
    if (!loadedQuote && !isMechSavedVal) {
      // Clear when loading is blank and not saved
      setQuoteItems([]);
      setProjectName('');
      setSelectedProjectId('');
      setQuoteNotes('');
      setPaymentTerms(`<p><strong>1. Thời gian thực hiện:</strong> 10-12 ngày.</p>
<p><strong>2. Bảo hành:</strong> Bảo hành 1 năm. Lỗi phụ kiện thay mới.</p>
<p><strong>3. Thanh toán:</strong></p>
<ul style="padding-left: 20px; list-style-type: disc;">
  <li><strong>3.1 Đặt cọc:</strong> <span style="color: #ef4444;"><strong>50%</strong></span> giá trị đơn hàng là ngay khi xác nhận báo giá để xưởng tiến hành sản xuất.</li>
  <li style="list-style-type: none; margin-left: -10px;">🏦 <strong>Thông tin tài khoản:</strong> <span style="color: #ef4444; font-weight: bold;">799201899999 MB BANK - Công ty TNHH Hoàng Long Lâm Đồng</span></li>
  <li><strong>3.2 Thanh toán:</strong> Thanh toán <span style="color: #ef4444;"><strong>50%</strong></span> còn lại ngay khi hoàn thành công việc (Không quá 05 ngày kể từ ngày nhận được hóa đơn tài chính, bên mua trả phí chuyển khoản)</li>
  <li><strong>3.3 Hiệu lực báo giá:</strong> 05 ngày kể từ ngày báo giá.</li>
</ul>
<p><strong>Lưu ý:</strong> <em>Báo giá được áp dụng theo thiết kế và quy cách đã thống nhất. Mọi thay đổi về thiết kế, kích thước, vật liệu hoặc phụ kiện (nếu có) sẽ được xem xét điều chỉnh lại đơn giá cho phù hợp với giá trị sản phẩm thực tế.</em></p>
<p>Xin vui lòng liên hệ với chúng tôi nếu quý khách hàng có cần thêm các yêu cầu nào khác.</p>
<p><strong>Trân trọng cảm ơn.</strong></p>`);
      setCompanyLogoImg('');
      setCompanyLogoText('HOANG LONG');
      setCompanySlogan('Construction - Furniture - Doors');
      setCompanyAddressInfo(`<p>📍 <strong>Địa điểm kinh doanh:</strong> Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng</p>\n<p>🏠 <strong>Địa chỉ:</strong> 54/20 Kim Đồng, Phường 6, TP. Đà Lạt, tỉnh Lâm Đồng</p>`);
      setCompanyContactInfo(`<p>📞 <strong>Hotline:</strong> 0966 545 959 - 0374 883 979</p>\n<p>✉ <strong>Email:</strong> hoanglongld.com@gmail.com</p>\n<p>🌐 <strong>Web:</strong> hoanglongld.com</p>`);
    }
  }, [loadedQuote, isMechSavedVal]);

  const [quoteNotes, setQuoteNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState(() => localStorage.getItem('hl_mechanical_payment_terms') || DEFAULT_MECH_PAYMENT_TERMS);

  const [companyLogoImg, setCompanyLogoImg] = useState(() => localStorage.getItem('hl_mechanical_company_logo') || '');
  const [companyLogoText, setCompanyLogoText] = useState(() => localStorage.getItem('hl_mechanical_company_name') || 'HOANG LONG');
  const [companySlogan, setCompanySlogan] = useState(() => localStorage.getItem('hl_mechanical_company_slogan') || 'Construction - Furniture - Doors');
  const [companyAddressInfo, setCompanyAddressInfo] = useState(() => localStorage.getItem('hl_mechanical_company_address') || `<p>📍 <strong>Địa điểm kinh doanh:</strong> Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng</p>\n<p>🏠 <strong>Địa chỉ:</strong> 54/20 Kim Đồng, Phường 6, TP. Đà Lạt, tỉnh Lâm Đồng</p>`);
  const [companyContactInfo, setCompanyContactInfo] = useState(() => localStorage.getItem('hl_mechanical_company_contact') || `<p>📞 <strong>Hotline:</strong> 0966 545 959 - 0374 883 979</p>\n<p>✉ <strong>Email:</strong> hoanglongld.com@gmail.com</p>\n<p>🌐 <strong>Web:</strong> hoanglongld.com</p>`);

  const [contractTemplate, setContractTemplate] = useState(() => localStorage.getItem('hl_mechanical_contract_template') || DEFAULT_MECH_CONTRACT_TEMPLATE);
  const [acceptanceTemplate, setAcceptanceTemplate] = useState(() => localStorage.getItem('hl_mechanical_acceptance_template') || DEFAULT_MECH_ACCEPTANCE_TEMPLATE);
  const [liquidationTemplate, setLiquidationTemplate] = useState(() => localStorage.getItem('hl_mechanical_liquidation_template') || DEFAULT_MECH_LIQUIDATION_TEMPLATE);

  // Auto-persist template changes to localStorage
  useEffect(() => {
    localStorage.setItem('hl_mechanical_company_logo', companyLogoImg);
    localStorage.setItem('hl_mechanical_company_name', companyLogoText);
    localStorage.setItem('hl_mechanical_company_slogan', companySlogan);
    localStorage.setItem('hl_mechanical_company_address', companyAddressInfo);
    localStorage.setItem('hl_mechanical_company_contact', companyContactInfo);
    localStorage.setItem('hl_mechanical_payment_terms', paymentTerms);
    localStorage.setItem('hl_mechanical_contract_template', contractTemplate);
    localStorage.setItem('hl_mechanical_acceptance_template', acceptanceTemplate);
    localStorage.setItem('hl_mechanical_liquidation_template', liquidationTemplate);
  }, [companyLogoImg, companyLogoText, companySlogan, companyAddressInfo, companyContactInfo, paymentTerms, contractTemplate, acceptanceTemplate, liquidationTemplate]);

  const [dbLoading, setDbLoading] = useState(false);
  const [dbSaving, setDbSaving] = useState(false);
  const [dbSaveSuccess, setDbSaveSuccess] = useState(false);
  const [dbSaveError, setDbSaveError] = useState<string | null>(null);

  // Load configuration from database on mount
  useEffect(() => {
    const fetchDbConfig = async () => {
      setDbLoading(true);
      try {
        const dbConfig = await dbService.quotationConfigs.get('mechanical');
        if (dbConfig) {
          if (dbConfig.companyLogoImg !== undefined) setCompanyLogoImg(dbConfig.companyLogoImg);
          if (dbConfig.companyLogoText !== undefined) setCompanyLogoText(dbConfig.companyLogoText);
          if (dbConfig.companySlogan !== undefined) setCompanySlogan(dbConfig.companySlogan);
          if (dbConfig.companyAddressInfo !== undefined) setCompanyAddressInfo(dbConfig.companyAddressInfo);
          if (dbConfig.companyContactInfo !== undefined) setCompanyContactInfo(dbConfig.companyContactInfo);
          if (dbConfig.paymentTerms !== undefined) setPaymentTerms(dbConfig.paymentTerms);
          if (dbConfig.contractTemplate !== undefined) setContractTemplate(dbConfig.contractTemplate);
          if (dbConfig.acceptanceTemplate !== undefined) setAcceptanceTemplate(dbConfig.acceptanceTemplate);
          if (dbConfig.liquidationTemplate !== undefined) setLiquidationTemplate(dbConfig.liquidationTemplate);
        }
      } catch (e) {
        console.error("Lỗi khi tải cấu hình báo giá Cơ khí từ database:", e);
      } finally {
        setDbLoading(false);
      }
    };
    fetchDbConfig();
  }, []);

  // Các hạng mục trong báo giá hiện tại
  const [quoteItems, setQuoteItems] = useState<any[]>([]);

  // Hàng mục cơ khí đang soạn
  const [group, setGroup] = useState<string>('iron_frame');
  const [name, setName] = useState('');
  const [qty, setQty] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [pricingMethod, setPricingMethod] = useState<'quick' | 'detail'>('quick');

  // Thông số cơ bản m/kg
  const [weightKg, setWeightKg] = useState<string>('');
  const [unitPricePerKg, setUnitPricePerKg] = useState<string>('');
  const [materials, setMaterials] = useState('');

  // Cho phân tích chi tiết (Thép hộp phi, Thép ống lùa, Sơn kẽm, Que hàn tấn, Ngày công thợ kim khí)
  const [steelTons, setSteelTons] = useState<string>('');
  const [steelPricePerTon, setSteelPricePerTon] = useState<string>(''); // 18.5M per ton
  const [zincCoatLiters, setZincCoatLiters] = useState<string>('');
  const [zincCoatPricePerLiter, setZincCoatPricePerLiter] = useState<string>(''); // 165k per L
  const [weldingRodBoxes, setWeldingRodBoxes] = useState<string>('');
  const [weldingRodPricePerBox, setWeldingRodPricePerBox] = useState<string>(''); // 240k per box
  const [directWelderLabor, setDirectWelderLabor] = useState<string>(''); // Nhân công trực thuộc thợ chính thợ phụ

  // State variables for Aluminum Door/Blind Mode (Mode PDF)
  const [estimatorMode, setEstimatorMode] = useState<'door' | 'steel'>('door');
  const [sign, setSign] = useState('');
  const [drawingType, setDrawingType] = useState('');
  const [ngang, setNgang] = useState<string>('');
  const [cao, setCao] = useState<string>('');
  const [he, setHe] = useState('');
  const [mauSac, setMauSac] = useState('');
  const [kinh, setKinh] = useState('');
  const [phuKien, setPhuKien] = useState('');
  const [unit, setUnit] = useState('');
  const [unitPrice, setUnitPrice] = useState<string>('');

  const groupNames: Record<string, string> = {
    iron_frame: '1. Khung kèo kết cấu thép vững chịu lực',
    roofing: '2. Mái che Polycarbon, mái kính an toàn',
    railing_stairs: '3. Lan can sắt mỹ thuật & cầu thang thoát hiểm',
    gate_fence: '4. Cửa cổng sắt đúc mỹ nghệ & rào bao quanh',
    cnc_cutting: '5. Tấm CNC kim loại hoạ tiết sơn tĩnh điện',
    custom: '6. Kết cấu máy cơ khí khung máy phụ trợ mộc'
  };

  // Dự toán logic kết quả cơ khí thép
  const calculateItemPrice = (item: any, currentConfig: QuoteConfig): number => {
    if (item.pricingMethod === 'quick') {
      const basicCost = (item.weightKg || 0) * (item.unitPricePerKg || 0);
      return Math.round(basicCost * (item.qty || 1));
    } else {
      // Phân bổ bóc gối vật tư cơ khí thô xưởng hàn
      const materialCost = 
        ((item.steelTons || 0) * (item.steelPricePerTon || 0)) +
        ((item.zincCoatLiters || 0) * (item.zincCoatPricePerLiter || 0)) +
        ((item.weldingRodBoxes || 0) * (item.weldingRodPricePerBox || 0));
      
      const basicLabor = item.directWelderLabor || 0;
      
      // Áp hao hụt phôi
      const materialWithWastage = materialCost * (1 + currentConfig.wastagePercent / 100);
      
      // Cơ tính tổ hợp giá gốc thô
      const primeCost = materialWithWastage + basicLabor;
      
      // Phụ gia bù đắp sơn phủ mạ điện kẽm nhúng
      const electroZincSurplus = primeCost * (currentConfig.accessoryPercent / 100);
      
      // Khác phân bổ quản trị máy móc CNC khấu hao
      const cncDepreciation = primeCost * (currentConfig.generalPercent / 100);
      const profitCost = primeCost * (currentConfig.profitPercent / 100);
      const laborMargin = primeCost * (currentConfig.laborPercent / 100);
      
      return Math.round((primeCost + electroZincSurplus + cncDepreciation + profitCost + laborMargin) * (item.qty || 1));
    }
  };

  const handleRecalculateAll = (newConfig: QuoteConfig) => {
    const updated = quoteItems.map(item => ({
      ...item,
      totalPrice: calculateItemPrice(item, newConfig)
    }));
    setQuoteItems(updated);
  };

  const handleConfigChange = (field: keyof QuoteConfig, value: number) => {
    const updatedConfig = { ...config, [field]: value };
    setConfig(updatedConfig);
    handleRecalculateAll(updatedConfig);
  };

  const handleAddItem = () => {
    if (estimatorMode === 'door') {
      if (!name.trim()) {
        addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng nhập Tên sản phẩm!', type: 'warning' });
        return;
      }
      
      const specNgang = typeof ngang === 'number' ? ngang : parseFloat(ngang as any) || 0;
      const specCao = typeof cao === 'number' ? cao : parseFloat(cao as any) || 0;
      const specQty = typeof qty === 'number' ? qty : parseInt(qty as any) || 1;
      const specUnitPrice = typeof unitPrice === 'number' ? unitPrice : parseInt(unitPrice as any) || 0;
      
      // Tính diện tích
      let area = 1;
      if (specNgang && specCao) {
        area = Math.round(specNgang * specCao * 100) / 100;
      }
      const calculatedPrice = Math.round(area * specUnitPrice * specQty);

      const newItem = {
        id: `q_mech_${Date.now()}`,
        name: name.trim(),
        qty: specQty,
        notes: notes || undefined,
        pricingMethod: 'quick',
        sign: sign.trim() || undefined,
        drawingType,
        ngang: specNgang,
        cao: specCao,
        he: he.trim(),
        mauSac: mauSac.trim(),
        kinh: kinh.trim(),
        phuKien: phuKien.trim(),
        unit,
        unitPrice: specUnitPrice,
        totalPrice: calculatedPrice
      };

      setQuoteItems([...quoteItems, newItem]);
      
      // Reset inputs
      setSign('');
      setName('');
      setNgang('');
      setCao('');
      setHe('');
      setMauSac('');
      setKinh('');
      setPhuKien('');
      setUnitPrice('');
      setNotes('');
      setQty('');
    } else {
      if (!name.trim()) {
        addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng nhập Tên sản phẩm!', type: 'warning' });
        return;
      }

      const specQty = typeof qty === 'number' ? qty : parseInt(qty as any) || 1;
      const specWeightKg = typeof weightKg === 'number' ? weightKg : parseInt(weightKg as any) || 0;
      const specUnitPricePerKg = typeof unitPricePerKg === 'number' ? unitPricePerKg : parseInt(unitPricePerKg as any) || 0;
      const specSteelTons = typeof steelTons === 'number' ? steelTons : parseFloat(steelTons as any) || 0;
      const specSteelPricePerTon = typeof steelPricePerTon === 'number' ? steelPricePerTon : parseInt(steelPricePerTon as any) || 0;
      const specZincCoatLiters = typeof zincCoatLiters === 'number' ? zincCoatLiters : parseInt(zincCoatLiters as any) || 0;
      const specZincCoatPricePerLiter = typeof zincCoatPricePerLiter === 'number' ? zincCoatPricePerLiter : parseInt(zincCoatPricePerLiter as any) || 0;
      const specWeldingRodBoxes = typeof weldingRodBoxes === 'number' ? weldingRodBoxes : parseInt(weldingRodBoxes as any) || 0;
      const specWeldingRodPricePerBox = typeof weldingRodPricePerBox === 'number' ? weldingRodPricePerBox : parseInt(weldingRodPricePerBox as any) || 0;
      const specDirectWelderLabor = typeof directWelderLabor === 'number' ? directWelderLabor : parseInt(directWelderLabor as any) || 0;

      const newItem = {
        id: `q_mech_${Date.now()}`,
        group,
        name: name.trim(),
        qty: specQty,
        notes: notes || undefined,
        pricingMethod,
        weightKg: specWeightKg,
        unitPricePerKg: specUnitPricePerKg,
        materials,
        steelTons: specSteelTons,
        steelPricePerTon: specSteelPricePerTon,
        zincCoatLiters: specZincCoatLiters,
        zincCoatPricePerLiter: specZincCoatPricePerLiter,
        weldingRodBoxes: specWeldingRodBoxes,
        weldingRodPricePerBox: specWeldingRodPricePerBox,
        directWelderLabor: specDirectWelderLabor,
        totalPrice: 0
      };

      newItem.totalPrice = calculateItemPrice(newItem, config);
      setQuoteItems([...quoteItems, newItem]);
      
      // Reset inputs
      setName('');
      setQty('');
      setNotes('');
      setWeightKg('');
      setUnitPricePerKg('');
      setMaterials('');
      setSteelTons('');
      setSteelPricePerTon('');
      setZincCoatLiters('');
      setZincCoatPricePerLiter('');
      setWeldingRodBoxes('');
      setWeldingRodPricePerBox('');
      setDirectWelderLabor('');
    }
  };

  const handleRemoveItem = (id: string) => {
    setQuoteItems(quoteItems.filter(item => item.id !== id));
  };

  // Tài chính cộng hóa đơn
  const subtotal = quoteItems.reduce((acc, i) => acc + i.totalPrice, 0);
  const discountVal = subtotal * (config.discountPercent / 100);
  const totalQuoteAmount = subtotal - discountVal;
  const vatPercent = config.vatPercent !== undefined ? config.vatPercent : 8;
  const vatAmount = totalQuoteAmount * (vatPercent / 100);
  const totalWithVat = totalQuoteAmount + vatAmount;

  const handleSaveQuote = async () => {
    if ((!selectedProjectId && !projectName.trim()) || !customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Thiếu thông tin bắt buộc! vui lòng chọn/điền đầy đủ các trường: DỰ ÁN/TÊN DỰ ÁN, TÊN KHÁCH HÀNG, SỐ ĐIỆN THOẠI và ĐỊA CHỈ để có thể thực hiện thao tác này.', type: 'warning' });
      return;
    }

    if (!loadedQuote && selectedProjectId) {
      try {
        const archivedList = await dbService.archivedQuotes.list('mechanical');
        const existing = archivedList.find(q => q.projectId === selectedProjectId);
        if (existing) {
          setShowExistsAlert(true);
          return;
        }
      } catch (err) {
        console.error("Lỗi kiểm tra hồ sơ dự án:", err);
      }
    }

    if (onAddQuote) {
      const finalCustomerId = selectedCustomerId || `cust_${Date.now()}`;
      const quoteId = loadedQuote ? loadedQuote.id : `quote_mech_${Date.now()}`;
      const quoteCode = loadedQuote ? loadedQuote.code : `BGME-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 105)}`;

      const generatedQuote = {
        id: quoteId,
        code: quoteCode,
        customerId: finalCustomerId,
        projectId: selectedProjectId || undefined,
        projectName: projectName.trim(),
        date: loadedQuote ? loadedQuote.date : new Date().toISOString().split('T')[0],
        items: quoteItems,
        config: config,
        status: 'draft',
        notes: `[BÁO GIÁ CƠ KHÍ CHẾ TẠO] ${quoteNotes}`,
        paymentTerms: paymentTerms,
        customerName: customerName.trim() || 'Khách mới',
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        estimatorMode,
        companyLogoImg: companyLogoImg,
        companyLogoText: companyLogoText,
        companySlogan: companySlogan,
        companyAddressInfo: companyAddressInfo,
        companyContactInfo: companyContactInfo,
        contractTemplate: loadedQuote?.contractTemplate || contractTemplate,
        acceptanceTemplate: loadedQuote?.acceptanceTemplate || acceptanceTemplate,
        liquidationTemplate: loadedQuote?.liquidationTemplate || liquidationTemplate,
        contractHtml: loadedQuote?.contractHtml,
        acceptanceHtml: loadedQuote?.acceptanceHtml,
        liquidationHtml: loadedQuote?.liquidationHtml,
        finalQuoteHtml: loadedQuote?.finalQuoteHtml
      };

      onAddQuote(generatedQuote);

      // Save to Archived Quotes as requested
      const archivedRecord = {
        ...generatedQuote,
        id: loadedQuote ? loadedQuote.id : `archived_quote_${Date.now()}`,
        creatorId: currentUser?.id || 'emp_1',
        creatorName: currentUser?.name || 'Cán bộ Kế toán',
        sector: 'mechanical',
        createdAt: loadedQuote?.createdAt || new Date().toLocaleDateString('vi-VN'),
        totalAmount: totalQuoteAmount
      };

      try {
        await dbService.archivedQuotes.save({ ...archivedRecord, sector: 'mechanical' });
        window.dispatchEvent(new CustomEvent('hl-archived-mechanical-quotes-updated'));
        setIsMechSavedVal(true);
        setIsLockedVal(true);
        setIsSentToProject(false);

        // Update local list of archived quotes to reflect immediately
        const list = await dbService.archivedQuotes.list('mechanical');
        setArchivedQuotesList(list);

        setFeedback({
          message: `Đã lưu hồ sơ báo giá nhôm kính/cơ khí ${quoteCode} thành công! Hãy nhấn nút "Xem & In" để xem mẫu hóa đơn chi tiết.`,
          type: 'success'
        });
        setTimeout(() => setFeedback(null), 5000);
      } catch (err) {
        console.error("Lỗi lưu trữ hồ sơ:", err);
        addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi lưu trữ báo giá.', type: 'error' });
      }
    }
  };

  const handleSendToProject = () => {
    if (!selectedProjectId) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng chọn hoặc liên kết dự án ở phía trên trước khi gửi báo giá qua dự án!', type: 'warning' });
      return;
    }
    if (quoteItems.length === 0) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Báo giá của bạn đang trống! vui lòng thêm ít nhất một sản phẩm.', type: 'warning' });
      return;
    }

    const targetProject = projects?.find(p => p.id === selectedProjectId);
    if (!targetProject) {
      addToast({ title: 'ℹ️ Thông báo', message: 'Không tìm thấy thông tin dự án!', type: 'warning' });
      return;
    }

    const confirmSend = window.confirm(`Bạn có chắc chắn muốn liên thông gửi bảng dữ liệu báo giá này trực tiếp sang dự án "${targetProject.name}"?\nHành động này sẽ ghi đè tài liệu báo giá liên kết chính thức của dự án này.`);
    if (!confirmSend) return;

    const itemCode = `BGME-HL-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const pdfName = `Bao_gia_Co_khi_${(customerName || 'Khach_hang').trim().replace(/\s+/g, '_')}.pdf`;

    // Sync child tasks in local storage
    const rawTasks = localStorage.getItem('hl_erp_tasks');
    let currentTasks: any[] = [];
    if (rawTasks) {
      try {
        currentTasks = JSON.parse(rawTasks);
      } catch (e) {
        console.error("Lỗi đọc tasks từ localStorage:", e);
      }
    }

    let taskUpdatedCount = 0;
    const updatedTasks = currentTasks.map(t => {
      const isMatchProj = t.projectId === selectedProjectId;
      const tNameLower = (t.name || '').toLowerCase();
      const tDescLower = (t.description || '').toLowerCase();
      const matchesQuote = tNameLower.includes('báo giá') || 
                           tNameLower.includes('bảo giá') || 
                           tNameLower.includes('baogia') || 
                           tNameLower.includes('dự toán') || 
                           tNameLower.includes('dutoan') ||
                           tDescLower.includes('báo giá') || 
                           tDescLower.includes('bảo giá') || 
                           tDescLower.includes('baogia') || 
                           tDescLower.includes('dự toán') || 
                           tDescLower.includes('dutoan') ||
                           t.isDocGenerationEnabled === true;

      if (isMatchProj && matchesQuote) {
        taskUpdatedCount++;
        const logId = `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const newLog = {
          id: logId,
          actorId: currentUser?.id || 'emp_1',
          actorName: currentUser?.name || 'Hệ thống',
          action: 'Đã tự động gửi thông tin hồ sơ báo giá cơ khí lắp đặt lên dự án liên thông',
          timestamp: new Date().toLocaleString('vi-VN'),
          notes: `Báo giá mã ${itemCode} với tổng tiền ${totalQuoteAmount.toLocaleString('vi-VN')} đ đã đồng bộ.`
        };

        const checklistTexts = t.checklistTexts || [];

        return {
          ...t,
          status: 'completed' as const,
          completionRate: 100,
          attachmentName: pdfName,
          completedChecklistTexts: [...checklistTexts],
          workLogs: t.workLogs ? [newLog, ...t.workLogs] : [newLog]
        };
      }
      return t;
    });

    // Save projects
    const updatedProjects = projects.map(p => {
      if (p.id === selectedProjectId) {
        const projBaoGiaFile = {
          name: pdfName,
          size: `${Math.round(110 + Math.random() * 30)} KB`,
          createdAt: new Date().toLocaleDateString('vi-VN'),
          totalAmount: totalQuoteAmount,
          discountPercent: config.discountPercent || 0,
          items: quoteItems,
          customerName: customerName || 'Khách hàng',
          customerPhone: customerPhone || 'Chưa cung cấp',
          customerAddress: customerAddress || 'Chưa cung cấp',
          paymentTerms: paymentTerms,
          quoteNotes: quoteNotes,
          code: itemCode,
          content: `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nBẢNG BÁO GIÁ CƠ KHÍ CHI TIẾT NĂM 2026\n--------------------------------------\nSố báo giá: ${itemCode}\nKhách hàng: ${customerName || 'Khách hàng'}\nSố điện thoại: ${customerPhone || 'Không có'}\nĐịa chỉ: ${customerAddress || 'Không có'}\nDự án liên kết: ${p.name}\n\nDANH SÁCH HẠNG MỤC CƠ KHÍ SƠ BỘ:\n${quoteItems.map((item, index) => `${index + 1}. ${item.name} - Thành tiền: ${item.totalPrice.toLocaleString('vi-VN')} đ`).join('\n')}\n\n--------------------------------------\nTỔNG CỘNG CHƯA CHIẾT KHẤU: ${subtotal.toLocaleString('vi-VN')} đ\nCHIẾT KHẤU GIẢM GIÁ (${config.discountPercent}%): -${discountVal.toLocaleString('vi-VN')} đ\nTỔNG GIÁ TRỊ THÔ: ${totalQuoteAmount.toLocaleString('vi-VN')} đ\nVAT (${vatPercent}%): ${vatAmount.toLocaleString('vi-VN')} đ\nTỔNG GIÁ TRỊ TOÀN BỘ (ĐÃ BAO GỒM VAT): ${totalWithVat.toLocaleString('vi-VN')} đ\n\nNơi nhận: Khách hàng\nĐại diện bàn giao báo giá.`
        };

        // Fire and forget dbService save
        dbService.projects.save({
          ...p,
          baoGiaFile: projBaoGiaFile
        }).catch(err => console.error("Error saving project to cloud db:", err));

        return {
          ...p,
          baoGiaFile: projBaoGiaFile
        };
      }
      return p;
    });

    localStorage.setItem('hl_erp_projects', JSON.stringify(updatedProjects));
    window.dispatchEvent(new CustomEvent('hl-projects-updated'));

    if (taskUpdatedCount > 0) {
      localStorage.setItem('hl_erp_tasks', JSON.stringify(updatedTasks));
      window.dispatchEvent(new CustomEvent('hl-tasks-updated'));

      updatedTasks.forEach(t => {
        const isMatchProj = t.projectId === selectedProjectId;
        const tNameLower = (t.name || '').toLowerCase();
        const tDescLower = (t.description || '').toLowerCase();
        const matchesQuote = tNameLower.includes('báo giá') || 
                             tNameLower.includes('bảo giá') || 
                             tNameLower.includes('baogia') || 
                             tNameLower.includes('dự toán') || 
                             tNameLower.includes('dutoan') ||
                             tDescLower.includes('báo giá') || 
                             tDescLower.includes('bảo giá') || 
                             tDescLower.includes('baogia') || 
                             tDescLower.includes('dự toán') || 
                             tDescLower.includes('dutoan') ||
                             t.isDocGenerationEnabled === true;
        if (isMatchProj && matchesQuote) {
          dbService.tasks.save(t).catch(err => console.error("Error saving task to cloud db:", err));
        }
      });
    }

    setIsSentToProject(true);

    setFeedback({
      message: `Đã gửi báo giá dạng PDF thành công vào trường Báo giá của dự án "${targetProject.name}"${taskUpdatedCount > 0 ? ` và cập nhật hoàn thành ${taskUpdatedCount} công việc con liên quan!` : ''}!`,
      type: 'success'
    });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCompanyLogoImg(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerExport = (type: 'pdf' | 'excel') => {
    const activeCustomerName = customerName || 'Khách hàng vãng lai';
    const filename = `Bao_gia_Co_khi_${activeCustomerName.replace(/\s+/g, '_')}_2026.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
    
    const element = document.createElement("a");
    const file = new Blob([`EXPORT FILE ${type.toUpperCase()}: HOÀNG LONG METALS ERP\n====================\nKhách hàng: ${activeCustomerName}\nGiấy tờ: Báo giá Gia công cơ khí & Cửa sắt CNC mạ kẽm\nTổng cộng: ${totalQuoteAmount.toLocaleString('vi-VN')} VND\nThời gian: 2026-06-06`], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    setFeedback({
      message: `Tài liệu cơ khí đã được trích xuất kỹ thuật: ${filename}`,
      type: 'success'
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  if (showTemplateOnly) {
    return (
      <div className="space-y-6 text-left" id="mechanical_template_panel">
        {/* Tab selection */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-slate-800 pb-1 gap-4">
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => setActiveTemplateTab('quote')}
              className={`text-xs font-extrabold uppercase tracking-wider relative pb-3 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTemplateTab === 'quote' 
                  ? 'text-pink-500 border-b-2 border-pink-500' 
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              📝 Mẫu báo giá
            </button>
            <button
              type="button"
              onClick={() => setActiveTemplateTab('contract')}
              className={`text-xs font-extrabold uppercase tracking-wider relative pb-3 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTemplateTab === 'contract' 
                  ? 'text-pink-500 border-b-2 border-pink-500' 
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              📜 Mẫu hợp đồng
            </button>
            <button
              type="button"
              onClick={() => setActiveTemplateTab('acceptance')}
              className={`text-xs font-extrabold uppercase tracking-wider relative pb-3 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTemplateTab === 'acceptance' 
                  ? 'text-pink-500 border-b-2 border-pink-500' 
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              📋 Mẫu nghiệm thu
            </button>
            <button
              type="button"
              onClick={() => setActiveTemplateTab('liquidation')}
              className={`text-xs font-extrabold uppercase tracking-wider relative pb-3 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTemplateTab === 'liquidation' 
                  ? 'text-pink-500 border-b-2 border-pink-500' 
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              🤝 Mẫu thanh lý
            </button>
          </div>

          {/* Action buttons for defaults */}
          <div className="flex flex-wrap items-center gap-2 pb-2 lg:pb-0">
            <button
              type="button"
              disabled={dbSaving || !isTemplateEditable}
              onClick={handleSetAsDefault}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm border ${
                dbSaving || !isTemplateEditable
                  ? 'bg-slate-800/50 text-slate-500 border-slate-800 cursor-not-allowed opacity-50'
                  : 'bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border-pink-500/30 cursor-pointer active:scale-95'
              }`}
            >
              ⭐ Đặt làm mặc định
            </button>
            <button
              type="button"
              disabled={dbSaving || !isTemplateEditable}
              onClick={handleRestoreDefault}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm border ${
                dbSaving || !isTemplateEditable
                  ? 'bg-slate-800/50 text-slate-500 border-slate-800 cursor-not-allowed opacity-50'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 cursor-pointer active:scale-95'
              }`}
            >
              🔄 Khôi phục mặc định
            </button>
          </div>
        </div>

        {activeTemplateTab === 'quote' && (
          <>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <div className="mb-6">
                <h4 className="font-extrabold text-base text-pink-500 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-pink-500 animate-pulse"></span>
                  Cấu hình Header Báo giá (Logo & Doanh nghiệp) - Cơ khí
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Những thay đổi này tự động lưu trữ và áp dụng trực tiếp khi lập báo giá hoặc xuất PDF cho lĩnh vực Cơ khí.
                </p>
              </div>
              
              <div className="grid grid-cols-1 gap-6">
                {/* Logo Uploader */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row items-center gap-6">
                  <div className="shrink-0 text-center">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Logo Hiện Tại</label>
                    <div className="w-20 h-20 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center overflow-hidden shadow-inner">
                      {companyLogoImg ? (
                        <img 
                          src={companyLogoImg} 
                          referrerPolicy="no-referrer" 
                          className="w-full h-full object-contain" 
                          alt="Company Logo" 
                        />
                      ) : (
                        <div className="text-[10px] text-slate-500 font-semibold px-2">Mặc định (SVG)</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grow w-full text-center md:text-left space-y-2">
                    <label className="block text-slate-300 font-extrabold text-xs">Thay đổi Logo Doanh nghiệp</label>
                    <div className="flex flex-wrap items-center gap-2.5 justify-center md:justify-start">
                      <input 
                        type="file"
                        accept="image/*"
                        disabled={!isTemplateEditable}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                setCompanyLogoImg(event.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                        id="company-logo-input-mechanical-tmpl"
                      />
                      <label 
                        htmlFor={isTemplateEditable ? "company-logo-input-mechanical-tmpl" : undefined}
                        className={`px-4 py-2 bg-pink-600/10 text-pink-400 hover:bg-pink-600/20 border border-pink-500/30 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 ${
                          !isTemplateEditable ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
                        }`}
                      >
                        Chọn file ảnh logo
                      </label>
                      {companyLogoImg && (
                        <button
                          type="button"
                          disabled={!isTemplateEditable}
                          onClick={() => setCompanyLogoImg('')}
                          className={`px-4 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            !isTemplateEditable ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
                          }`}
                        >
                          Xóa logo tùy biến
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500">Hỗ trợ các định dạng PNG, JPG, WEBP. Ảnh tự động chuyển thành Base64 lưu trữ offline.</p>
                  </div>
                </div>

                {/* Tên & Slogan */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-extrabold text-xs mb-1.5">Tên doanh nghiệp / Logo chữ</label>
                    <input 
                      type="text"
                      value={companyLogoText}
                      disabled={!isTemplateEditable}
                      onChange={(e) => setCompanyLogoText(e.target.value)}
                      className="w-full text-xs p-3 border border-slate-800 bg-slate-950 text-slate-100 rounded-lg outline-none focus:border-pink-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Ví dụ: HOANG LONG"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-extrabold text-xs mb-1.5">Slogan / Lĩnh vực hoạt động</label>
                    <input 
                      type="text"
                      value={companySlogan}
                      disabled={!isTemplateEditable}
                      onChange={(e) => setCompanySlogan(e.target.value)}
                      className="w-full text-xs p-3 border border-slate-800 bg-slate-950 text-slate-100 rounded-lg outline-none focus:border-pink-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Ví dụ: Construction - Furniture - Doors"
                    />
                  </div>
                </div>

                {/* Địa chỉ & Liên hệ Rich Texts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-extrabold text-xs mb-1.5">Thông tin Địa chỉ</label>
                    <RichTextEditor
                      value={companyAddressInfo}
                      onChange={(html) => setCompanyAddressInfo(html)}
                      disabled={!isTemplateEditable}
                      themeColor="pink"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-extrabold text-xs mb-1.5">Thông tin Liên hệ (Hotline/Email/Web)</label>
                    <RichTextEditor
                      value={companyContactInfo}
                      onChange={(html) => setCompanyContactInfo(html)}
                      disabled={!isTemplateEditable}
                      themeColor="pink"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Thông tin điều khoản và lưu ý tùy biến */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <div className="mb-4">
                <h4 className="font-extrabold text-base text-pink-500 uppercase tracking-wider flex items-center gap-2">
                  📝 Điều khoản & Ghi chú Báo giá Cơ khí
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Soạn thảo điều khoản thanh toán, phương thức đặt cọc, thông tin tài khoản ngân hàng và chính sách bảo hành mặc định cho hồ sơ Cơ khí.
                </p>
              </div>
              
              <RichTextEditor
                value={paymentTerms}
                onChange={(html) => setPaymentTerms(html)}
                disabled={!isTemplateEditable}
                themeColor="pink"
              />
            </div>
          </>
        )}

        {activeTemplateTab === 'contract' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <div className="mb-2 border-b border-slate-800 pb-4">
              <h4 className="font-extrabold text-base text-pink-500 uppercase tracking-wider">
                📜 Soạn thảo Mẫu Hợp đồng Thi công Cơ khí
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Cho phép tùy chỉnh nội dung hợp đồng kinh tế lĩnh vực gia công chế tạo cơ khí. Các biến màu đỏ sẽ tự động thay bằng dữ liệu thực tế khi xuất in.
              </p>
            </div>
            
            <div className="grid grid-cols-12 gap-6 mt-4">
              <div className="col-span-12 lg:col-span-8">
                <RichTextEditor
                  value={contractTemplate}
                  onChange={(html) => setContractTemplate(html)}
                  disabled={!isTemplateEditable}
                  themeColor="pink"
                />
              </div>
              <div className="col-span-12 lg:col-span-4 bg-slate-950/40 border border-slate-800 rounded-xl p-4 self-start">
                <h5 className="font-bold text-xs text-pink-400 uppercase tracking-wider mb-2">
                  Hướng dẫn chèn biến (Placeholders)
                </h5>
                <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
                  Sao chép các mã bên dưới dán vào bất kỳ vị trí nào trong hợp đồng. Hệ thống sẽ tự động thay bằng dữ liệu thực tế của dự án và bôi đỏ nổi bật khi in ấn:
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{SO_HOP_DONG}}"}</code>
                    <span className="text-slate-400 text-[10px]">Số hợp đồng (mã dự án)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{CONG_TRINH}}"}</code>
                    <span className="text-slate-400 text-[10px]">Tên công trình</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{HANG_MUC}}"}</code>
                    <span className="text-slate-400 text-[10px]">Tên sản phẩm đầu tiên</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{DIA_DIEM}}"}</code>
                    <span className="text-slate-400 text-[10px]">Địa chỉ công trình</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{NGAY}}"}</code>
                    <span className="text-slate-400 text-[10px]">Ngày lập (ngày/tháng/năm)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{TEN_KHACH_HANG}}"}</code>
                    <span className="text-slate-400 text-[10px]">Tên khách hàng</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{DIA_CHI_KHACH_HANG}}"}</code>
                    <span className="text-slate-400 text-[10px]">Địa chỉ khách hàng</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{DIEN_THOAI_KHACH_HANG}}"}</code>
                    <span className="text-slate-400 text-[10px]">SĐT khách hàng</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{TONG_CONG}}"}</code>
                    <span className="text-slate-400 text-[10px]">Tổng cộng (số)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{TONG_CONG_CHU}}"}</code>
                    <span className="text-slate-400 text-[10px]">Tổng tiền bằng chữ</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{BANG_CHI_TIET_BÁO_GIÁ}}"}</code>
                    <span className="text-slate-400 text-[10px]">Bảng phụ lục cơ khí</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTemplateTab === 'acceptance' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <div className="mb-2 border-b border-slate-800 pb-4">
              <h4 className="font-extrabold text-base text-pink-500 uppercase tracking-wider">
                📋 Soạn thảo Mẫu Biên bản Nghiệm thu Bàn giao Cơ khí
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Cho phép tùy chỉnh nội dung biên bản nghiệm thu kỹ thuật và bàn giao hạng mục cơ khí cho khách hàng.
              </p>
            </div>
            
            <div className="grid grid-cols-12 gap-6 mt-4">
              <div className="col-span-12 lg:col-span-8">
                <RichTextEditor
                  value={acceptanceTemplate}
                  onChange={(html) => setAcceptanceTemplate(html)}
                  disabled={!isTemplateEditable}
                  themeColor="pink"
                />
              </div>
              <div className="col-span-12 lg:col-span-4 bg-slate-950/40 border border-slate-800 rounded-xl p-4 self-start">
                <h5 className="font-bold text-xs text-pink-400 uppercase tracking-wider mb-2">
                  Hướng dẫn chèn biến (Placeholders)
                </h5>
                <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
                  Sao chép các mã bên dưới dán vào bất kỳ vị trí nào trong nghiệm thu:
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{SO_BIEN_BAN_NT}}"}</code>
                    <span className="text-slate-400 text-[10px]">Số biên bản nghiệm thu</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{SO_HOP_DONG}}"}</code>
                    <span className="text-slate-400 text-[10px]">Số hợp đồng (mã dự án)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{CONG_TRINH}}"}</code>
                    <span className="text-slate-400 text-[10px]">Tên công trình</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{HANG_MUC}}"}</code>
                    <span className="text-slate-400 text-[10px]">Tên sản phẩm đầu tiên</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{DIA_DIEM}}"}</code>
                    <span className="text-slate-400 text-[10px]">Địa chỉ công trình</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{NGAY}}"}</code>
                    <span className="text-slate-400 text-[10px]">Ngày lập (ngày/tháng/năm)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{TEN_KHACH_HANG}}"}</code>
                    <span className="text-slate-400 text-[10px]">Tên khách hàng</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{BANG_CHI_TIET_BÁO_GIÁ}}"}</code>
                    <span className="text-slate-400 text-[10px]">Bảng phụ lục cơ khí</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTemplateTab === 'liquidation' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <div className="mb-2 border-b border-slate-800 pb-4">
              <h4 className="font-extrabold text-base text-pink-500 uppercase tracking-wider">
                🤝 Soạn thảo Mẫu Biên bản Thanh lý Hợp đồng Cơ khí
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Cho phép tùy chỉnh nội dung biên bản thanh lý tài chính và tất toán hợp đồng thi công cơ khí.
              </p>
            </div>
            
            <div className="grid grid-cols-12 gap-6 mt-4">
              <div className="col-span-12 lg:col-span-8">
                <RichTextEditor
                  value={liquidationTemplate}
                  onChange={(html) => setLiquidationTemplate(html)}
                  disabled={!isTemplateEditable}
                  themeColor="pink"
                />
              </div>
              <div className="col-span-12 lg:col-span-4 bg-slate-950/40 border border-slate-800 rounded-xl p-4 self-start">
                <h5 className="font-bold text-xs text-pink-400 uppercase tracking-wider mb-2">
                  Hướng dẫn chèn biến (Placeholders)
                </h5>
                <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
                  Sao chép các mã bên dưới dán vào bất kỳ vị trí nào trong thanh lý:
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{SO_THANH_LY}}"}</code>
                    <span className="text-slate-400 text-[10px]">Số biên bản thanh lý</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{SO_HOP_DONG}}"}</code>
                    <span className="text-slate-400 text-[10px]">Số hợp đồng (mã dự án)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{SO_BIEN_BAN_NT}}"}</code>
                    <span className="text-slate-400 text-[10px]">Số nghiệm thu</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{NGAY_NGHIEM_THU}}"}</code>
                    <span className="text-slate-400 text-[10px]">Ngày nghiệm thu bàn giao</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{TEN_KHACH_HANG}}"}</code>
                    <span className="text-slate-400 text-[10px]">Tên khách hàng</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{TONG_CONG}}"}</code>
                    <span className="text-slate-400 text-[10px]">Khối lượng thanh toán thực tế</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-pink-400 select-all font-mono">{"{{TONG_CONG_CHU}}"}</code>
                    <span className="text-slate-400 text-[10px]">Tổng tiền thanh lý bằng chữ</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Success Alert Banner indicating autosave is active */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-xl">
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span className="flex h-2.5 w-2.5 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pink-500"></span>
            </span>
            <div>
              <span className="font-bold text-pink-400">Chế độ tự động lưu cục bộ đang hoạt động:</span> Thay đổi được lưu vào trình duyệt này. Để đồng bộ và dùng chung cho toàn bộ ứng dụng trên các thiết bị khác nhau, vui lòng bấm nút lưu lên Cơ sở dữ liệu đám mây.
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsTemplateEditable(!isTemplateEditable)}
              className={`w-full sm:w-auto px-5 py-3 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95 ${
                isTemplateEditable 
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/50'
                  : 'bg-pink-600/15 text-pink-400 hover:bg-pink-600/25 border border-pink-500/30'
              }`}
            >
              {isTemplateEditable ? '🔒 Khóa' : '✍️ Chỉnh sửa'}
            </button>

            <button
              type="button"
              disabled={dbSaving || !isTemplateEditable}
              onClick={async () => {
                setDbSaving(true);
                setDbSaveSuccess(false);
                setDbSaveError(null);
                try {
                  await dbService.quotationConfigs.save('mechanical', {
                    companyLogoImg,
                    companyLogoText,
                    companySlogan,
                    companyAddressInfo,
                    companyContactInfo,
                    paymentTerms,
                    contractTemplate,
                    acceptanceTemplate,
                    liquidationTemplate
                  });
                  setDbSaveSuccess(true);
                  setIsTemplateEditable(false); // Auto-lock after successfully saving
                  setTimeout(() => setDbSaveSuccess(false), 4000);
                } catch (e) {
                  console.error("Lỗi khi lưu cấu hình Cơ khí lên database:", e);
                  setDbSaveSuccess(false);
                  setDbSaveError(e instanceof Error ? e.message : 'Lỗi khi lưu lên Supabase');
                  setFeedback({
                    type: 'error',
                    message: e instanceof Error ? e.message : 'Lỗi khi lưu lên Supabase'
                  });
                  setTimeout(() => setFeedback(null), 5000);
                } finally {
                  setDbSaving(false);
                }
              }}
              className={`w-full sm:w-auto px-5 py-3 font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
                dbSaving || !isTemplateEditable
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed pointer-events-none'
                  : 'bg-pink-600 hover:bg-pink-500 text-white'
              }`}
            >
              <Save className={`w-4 h-4 ${dbSaving ? 'animate-spin' : ''}`} />
              {dbSaving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </div>

        {dbSaveSuccess && (
          <div className="bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl text-xs flex items-center gap-3 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold">Lưu thành công:</span> Cấu hình mẫu báo giá Cơ khí đã được lưu vào hệ thống cơ sở dữ liệu đám mây và đồng bộ hóa thành công trên toàn ứng dụng!
            </div>
          </div>
        )}
        {dbSaveError && (
          <div className="bg-red-950/20 border border-red-500/30 text-red-400 p-4 rounded-xl text-xs flex items-center gap-3 animate-fadeIn">
            <XCircle className="w-4 h-4 text-red-400 shrink-0" />
            <div>
              <span className="font-bold">Lỗi lưu:</span> {dbSaveError}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6" id="mech_estimator_panel">
      {feedback && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xl relative overflow-hidden" id="estimator_mech_feedback">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>
          <span className="pl-2">{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-emerald-400 font-black hover:text-white px-2 cursor-pointer transition-colors">✕</button>
        </div>
      )}

      {/* Bảng báo giá (Ngang rộng rãi phía dưới) */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl p-5 flex flex-col justify-between space-y-4 text-slate-200" id="quotation_analysis_panel">
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-2 gap-2">
              <span className="font-bold text-slate-100 text-sm tracking-wide">BẢNG QUYẾT TOÁN CHI ĐỘNG CƠ KHÍ & GIA CÔNG</span>
            </div>

            {/* Thông tin metadata của Báo giá */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-3 p-4 bg-slate-950/60 rounded-xl border border-slate-850 text-xs text-left">
              {/* Dự án (searchable custom selection) */}
              <div className="relative">
                <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Dự Án <span className="text-rose-500 font-bold">*</span></label>
                
                {/* Searchable Custom Trigger Button */}
                <button
                  type="button"
                  onClick={() => !isLockedVal && setIsProjDropdownOpen(!isProjDropdownOpen)}
                  disabled={isLockedVal}
                  className={`w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-lg p-2.5 outline-none font-medium text-left hover:border-slate-700 focus:border-pink-500 transition-all flex items-center justify-between shadow-sm cursor-pointer ${isLockedVal ? 'opacity-65 cursor-not-allowed bg-slate-950/40 border-dashed' : ''}`}
                >
                  <span className="truncate">
                    {selectedProjectId ? (
                      (() => {
                        const activeProj = projects.find(p => p.id === selectedProjectId);
                        return activeProj ? `${activeProj.name}` : selectedProjectId;
                      })()
                    ) : (
                      <span className="text-pink-400 font-bold">Báo giá Độc lập</span>
                    )}
                  </span>
                  <Sliders className="w-3.5 h-3.5 text-pink-500 shrink-0 ml-2" />
                </button>

                {/* Dropdown Popup Panel */}
                {isProjDropdownOpen && (
                  <div className="absolute left-0 mt-1.5 w-72 md:w-80 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-2.5 z-55 max-h-72 overflow-y-auto">
                    {/* Search Field inside */}
                    <div className="relative mb-2">
                       <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()} // stop close dropdown
                        className="w-full bg-slate-900 text-slate-200 border border-slate-850 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-pink-500 font-medium placeholder-slate-500 transition-all"
                        placeholder="Tìm dự án theo tên hoặc mã..."
                      />
                      <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>

                    {/* Options list */}
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProjectId('');
                          setProjectName('');
                          setIsProjDropdownOpen(false);
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-2.5 py-2 hover:bg-rose-950 text-rose-400 font-bold border border-rose-900/30 rounded-lg text-xs mb-2 transition-colors block"
                      >
                        ❌ Báo giá Độc lập (Nhập tay tên dự án)
                      </button>

                      <div className="text-[9px] uppercase font-bold text-slate-500 px-2.5 py-1">
                        Dự án Đang Làm (Phòng cơ khí)
                      </div>

                      {(() => {
                        const activeProjects = projects.filter(p => p.type === 'mechanical');
                        const matches = activeProjects.filter(p => 
                          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.code.toLowerCase().includes(searchQuery.toLowerCase())
                        );

                        if (matches.length === 0) {
                          return (
                            <div className="text-center py-3 text-[11px] text-slate-600 italic">
                              Không tìm thấy dự án hợp lệ
                            </div>
                          );
                        }

                        return matches.map((p) => {
                          const hasArchive = archivedQuotesList.some(q => q.projectId === p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedProjectId(p.id);
                                setIsProjDropdownOpen(false);
                                setSearchQuery('');
                              }}
                              className={`w-full text-left px-2.5 py-2.5 rounded-lg text-xs cursor-pointer block transition-all ${
                                selectedProjectId === p.id 
                                  ? 'bg-pink-600/20 text-pink-400 border border-pink-500/20 font-bold' 
                                  : 'text-slate-300 hover:bg-slate-900 hover:text-slate-100'
                              }`}
                            >
                              <div className="font-bold text-slate-100 flex items-center justify-between">
                                <span>{p.name}</span>
                                {hasArchive && (
                                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-[9px] bg-pink-500/10 text-pink-400 px-1.5 py-0.5 rounded font-black border border-pink-500/25 animate-pulse">
                                    📁 ĐÃ CÓ HS
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-400 truncate">{p.code}</div>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Tên Dự án */}
              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Tên Dự án <span className="text-rose-500 font-bold">*</span></label>
                <input
                  type="text"
                  value={projectName}
                  disabled={!!selectedProjectId || isLockedVal}
                  onChange={(e) => setProjectName(e.target.value)}
                  className={`w-full rounded-lg p-2.5 border text-xs font-semibold shadow-sm transition-all outline-none ${
                    selectedProjectId || isLockedVal
                      ? "bg-slate-950/50 border-slate-800 text-slate-400 cursor-not-allowed border-dashed" 
                      : "bg-slate-900 border-slate-800 text-slate-100 focus:border-pink-500"
                  }`}
                  placeholder={selectedProjectId ? "" : isLockedVal ? "" : "Nhập tên Dự án cơ khí... *"}
                />
              </div>

              {/* Tên khách hàng */}
              <div className="relative">
                <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Tên Khách Hàng <span className="text-rose-500 font-bold">*</span></label>
                
                <button
                  type="button"
                  onClick={() => !isLockedVal && setIsCustDropdownOpen(!isCustDropdownOpen)}
                  disabled={isLockedVal}
                  className={`w-full bg-slate-900 text-slate-100 border border-slate-805 rounded-lg p-2.5 outline-none font-semibold text-xs text-left hover:border-slate-700 focus:border-pink-500 transition-all flex items-center justify-between shadow-sm cursor-pointer ${isLockedVal ? 'opacity-65 cursor-not-allowed bg-slate-950/40 border-dashed' : ''}`}
                >
                  <span className="truncate">
                    {customerName || <span className="text-slate-500 font-normal">Chọn khách hàng từ danh sách *</span>}
                  </span>
                  <span className="text-[10px] text-slate-400">▼</span>
                </button>

                {/* Dropdown list of customers */}
                {isCustDropdownOpen && (
                  <div className="absolute left-0 mt-1.5 w-72 md:w-80 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-2.5 z-55 max-h-72 overflow-y-auto">
                    <div className="relative mb-2">
                      <input
                        type="text"
                        value={custSearchQuery}
                        onChange={(e) => setCustSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()} // stop close dropdown
                        className="w-full bg-slate-900 text-slate-200 border border-slate-805 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-pink-500 font-medium placeholder-slate-500 transition-all"
                        placeholder="Tìm khách hàng theo tên hoặc SĐT..."
                      />
                      <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>

                    <div className="space-y-1">
                      {(() => {
                        const matches = customers.filter(c => 
                          (c.name || '').toLowerCase().includes(custSearchQuery.toLowerCase()) ||
                          (c.phone || '').toLowerCase().includes(custSearchQuery.toLowerCase())
                        );

                        if (matches.length === 0) {
                          return (
                            <div className="text-center py-2.5 text-[11px] text-slate-500 italic">
                              Chưa có khách hàng khớp
                            </div>
                          );
                        }

                        return matches.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectCustomer(c)}
                            className={`w-full text-left px-2.5 py-2.5 rounded-lg text-xs cursor-pointer block transition-all ${
                              selectedCustomerId === c.id 
                                ? 'bg-pink-600/20 text-pink-400 border border-pink-500/20 font-bold' 
                                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                            }`}
                          >
                            <div className="font-bold text-slate-100 text-left">{c.name}</div>
                            <div className="text-[10px] text-slate-400 text-left">
                              SĐT: {c.phone} | {c.address}
                            </div>
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                )}
                
                {/* Nút tạo khách hàng nhanh */}
                {!isLockedVal && (
                  <div className="mt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowQuickCreateCust(true)}
                      className="text-[10px] text-pink-400 hover:text-pink-300 font-semibold flex items-center gap-0.5 cursor-pointer hover:underline"
                    >
                      ➕ Tạo khách hàng nhanh
                    </button>
                  </div>
                )}
              </div>

              {/* Số điện thoại */}
              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Số điện thoại <span className="text-rose-500 font-bold">*</span></label>
                <input
                  type="text"
                  value={customerPhone}
                  disabled={true}
                  className="w-full rounded-lg p-2.5 border border-slate-800 text-slate-400 bg-slate-950/50 cursor-not-allowed font-medium text-xs border-dashed"
                  placeholder="Chọn Khách hàng để nạp SĐT *"
                />
              </div>

              {/* Địa chỉ */}
              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Địa chỉ <span className="text-rose-500 font-bold">*</span></label>
                <input
                  type="text"
                  value={customerAddress}
                  disabled={true}
                  className="w-full rounded-lg p-2.5 border border-slate-800 text-slate-400 bg-slate-950/50 cursor-not-allowed font-medium text-xs border-dashed"
                  placeholder="Chọn Khách hàng để nạp địa chỉ *"
                />
              </div>
            </div>

            {/* Điều chỉnh Chiết khấu (%) và Thuế VAT (%) */}
            <div className="flex flex-col sm:flex-row justify-end items-center gap-4 mb-3 p-4 bg-slate-950/60 rounded-xl border border-slate-850 text-xs w-full">
              {/* Chiết khấu thầu cơ khí (%) */}
              <div className="w-full sm:w-[180px] text-left">
                <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1 flex items-center justify-between">
                  <span>Chiết khấu (%)</span>
                  <span className="text-pink-400 font-black text-[8px] bg-pink-950/40 px-1 hover:bg-pink-900/40 rounded border border-pink-900/30 flex items-center gap-0.5">
                    % GIẢM
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  disabled={isLockedVal}
                  value={config.discountPercent}
                  onChange={(e) => {
                    const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                    handleConfigChange('discountPercent', val);
                  }}
                  className={`w-full rounded-lg p-2.5 border text-xs font-semibold shadow-sm transition-all outline-none ${
                    isLockedVal
                      ? "bg-slate-950/50 border-slate-800 text-slate-400 cursor-not-allowed border-dashed" 
                      : "bg-slate-900 border-slate-800 text-slate-100 focus:border-pink-500"
                  }`}
                  placeholder="Nhập % chiết khấu..."
                />
              </div>

              {/* Thuế VAT (%) */}
              <div className="w-full sm:w-[180px] text-left">
                <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1 flex items-center justify-between">
                  <span>Thuế VAT (%)</span>
                  <span className="text-indigo-400 font-black text-[8px] bg-indigo-950/40 px-1 hover:bg-indigo-900/40 rounded border border-indigo-900/30 flex items-center gap-0.5">
                    % VAT
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  disabled={isLockedVal}
                  value={config.vatPercent !== undefined ? config.vatPercent : 8}
                  onChange={(e) => {
                    const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                    handleConfigChange('vatPercent', val);
                  }}
                  className={`w-full rounded-lg p-2.5 border text-xs font-semibold shadow-sm transition-all outline-none ${
                    isLockedVal
                      ? "bg-slate-950/50 border-slate-800 text-slate-400 cursor-not-allowed border-dashed" 
                      : "bg-slate-900 border-slate-800 text-slate-100 focus:border-pink-500"
                  }`}
                  placeholder="Nhập % thuế VAT..."
                />
              </div>
            </div>

            {/* THÊM HẠNG MỤC MỚI */}
            {!isLockedVal ? (
              <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-850 space-y-4 mb-4" id="mech_add_item_form">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3 gap-2">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-pink-500" />
                    <span className="font-extrabold text-slate-100 text-xs uppercase tracking-wider">Thêm hạng mục báo giá cơ khí (Cửa Nhôm Kính & Sắt CNC)</span>
                  </div>
                </div>

                {estimatorMode === 'door' ? (
                  /* GIAO DIỆN NHẬP CỬA NHÔM KÍNH / SẮT CNC (MẪU ĐÍNH KÈM) */
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-left">
                    <div>
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Ký hiệu (ví dụ: D1, W2)</label>
                      <input
                        type="text"
                        value={sign}
                        onChange={(e) => setSign(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                        placeholder="Nhập ký hiệu..."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Tên sản phẩm / Mô tả <span className="text-rose-500 font-bold">*</span></label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                        placeholder="Ví dụ: Cửa đi 4 cánh Xingfa nhập khẩu..."
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Bản vẽ / Phân loại</label>
                      <input
                        type="text"
                        value={drawingType}
                        onChange={(e) => setDrawingType(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-semibold"
                        placeholder="Ví dụ: Cửa đi 1 cánh mở quay..."
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Chiều ngang (m) <span className="text-rose-500 font-bold">*</span></label>
                      <input
                        type="number"
                        step="0.001"
                        value={ngang}
                        onChange={(e) => setNgang(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                        placeholder="Ví dụ: 0.915"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Chiều cao (m) <span className="text-rose-500 font-bold">*</span></label>
                      <input
                        type="number"
                        step="0.001"
                        value={cao}
                        onChange={(e) => setCao(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                        placeholder="Ví dụ: 2.765"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Đơn vị tính</label>
                      <input
                        type="text"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                        placeholder="Bộ hoặc M2..."
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Số lượng <span className="text-rose-500 font-bold">*</span></label>
                      <input
                        type="number"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        min="1"
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                        placeholder="Ví dụ: 1"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Hệ nhôm / Loại sắt</label>
                      <input
                        type="text"
                        value={he}
                        onChange={(e) => setHe(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                        placeholder="XINGFA HỆ 55, Sắt hộp 40x80..."
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Màu sắc</label>
                      <input
                        type="text"
                        value={mauSac}
                        onChange={(e) => setMauSac(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                        placeholder="Xám ghi, đen, vân gỗ..."
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Loại kính</label>
                      <input
                        type="text"
                        value={kinh}
                        onChange={(e) => setKinh(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                        placeholder="Kính cường lực 8mm, 10mm..."
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Phụ kiện đi kèm</label>
                      <input
                        type="text"
                        value={phuKien}
                        onChange={(e) => setPhuKien(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                        placeholder="Kinlong, Draho, Huy Hoàng..."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Ghi chú kỹ thuật lắp ráp</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                        placeholder="Ví dụ: Khoan lỗ thoát nước đáy cửa chính..."
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Đơn giá định mức (đ/m2) <span className="text-rose-500 font-bold">*</span></label>
                      <input
                        type="number"
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-emerald-400 rounded-lg p-2.5 outline-none focus:border-pink-500 font-extrabold text-xs"
                        placeholder="Ví dụ: 2200000"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold p-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-[0.98]"
                      >
                        <Plus className="w-4 h-4" />
                        Thêm vào bảng
                      </button>
                    </div>
                  </div>
                ) : (
                  /* GIAO DIỆN NHẬP KẾT CẤU THÉP & MÁI CHE */
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-left">
                    <div>
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Nhóm kết cấu cơ khí</label>
                      <select
                        value={group}
                        onChange={(e) => setGroup(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-semibold"
                      >
                        <option value="iron_frame">1. Khung kèo thép vững chịu lực</option>
                        <option value="roofing">2. Mái che Poly, mái kính an toàn</option>
                        <option value="railing_stairs">3. Lan can sắt mỹ thuật & cầu thang</option>
                        <option value="gate_fence">4. Cửa cổng sắt đúc & rào bao quanh</option>
                        <option value="cnc_cutting">5. Tấm CNC kim loại sơn tĩnh điện</option>
                        <option value="custom">6. Kết cấu máy cơ khí khung mộc</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Tên kết cấu / Hạng mục gia công <span className="text-rose-500 font-bold">*</span></label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                        placeholder="Ví dụ: Giàn hoa sắt hộp mạ kẽm..."
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Phương pháp tính dự toán</label>
                      <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 h-10 items-center">
                        <button
                          type="button"
                          onClick={() => setPricingMethod('quick')}
                          className={`flex-1 py-1 px-2 rounded-md text-[9px] font-bold transition-all cursor-pointer ${pricingMethod === 'quick' ? 'bg-slate-800 text-pink-400 font-black' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          Gia công Kg/M
                        </button>
                        <button
                          type="button"
                          onClick={() => setPricingMethod('detail')}
                          className={`flex-1 py-1 px-2 rounded-md text-[9px] font-bold transition-all cursor-pointer ${pricingMethod === 'detail' ? 'bg-slate-800 text-pink-400 font-black' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          Bốc tách Thép
                        </button>
                      </div>
                    </div>

                    {pricingMethod === 'quick' ? (
                      <>
                        <div>
                          <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Khối lượng ước tính (kg) <span className="text-rose-500 font-bold">*</span></label>
                          <input
                            type="number"
                            value={weightKg}
                            onChange={(e) => setWeightKg(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                            placeholder="Ví dụ: 1200"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Đơn giá gia công thô (đ/kg) <span className="text-rose-500 font-bold">*</span></label>
                          <input
                            type="number"
                            value={unitPricePerKg}
                            onChange={(e) => setUnitPricePerKg(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                            placeholder="Ví dụ: 38000"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Mác thép / Vật tư chính sử dụng</label>
                          <input
                            type="text"
                            value={materials}
                            onChange={(e) => setMaterials(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                            placeholder="Ví dụ: Thép hộp Hòa Phát mạ kẽm..."
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Khối lượng thép thép hình (tấn) <span className="text-rose-500 font-bold">*</span></label>
                          <input
                            type="number"
                            step="0.001"
                            value={steelTons}
                            onChange={(e) => setSteelTons(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                            placeholder="Ví dụ: 1.8"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Đơn giá thép đen thô (đ/tấn) <span className="text-rose-500 font-bold">*</span></label>
                          <input
                            type="number"
                            value={steelPricePerTon}
                            onChange={(e) => setSteelPricePerTon(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                            placeholder="Ví dụ: 18500000"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Sơn chống rỉ kẽm (Lít)</label>
                          <input
                            type="number"
                            value={zincCoatLiters}
                            onChange={(e) => setZincCoatLiters(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                            placeholder="Ví dụ: 35"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Đơn giá sơn (đ/lít)</label>
                          <input
                            type="number"
                            value={zincCoatPricePerLiter}
                            onChange={(e) => setZincCoatPricePerLiter(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                            placeholder="Ví dụ: 165000"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Que hàn (Hộp 5kg)</label>
                          <input
                            type="number"
                            value={weldingRodBoxes}
                            onChange={(e) => setWeldingRodBoxes(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                            placeholder="Ví dụ: 12"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Đơn giá que hàn (đ/hộp)</label>
                          <input
                            type="number"
                            value={weldingRodPricePerBox}
                            onChange={(e) => setWeldingRodPricePerBox(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                            placeholder="Ví dụ: 240000"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Chi phí nhân công thợ (đ)</label>
                          <input
                            type="number"
                            value={directWelderLabor}
                            onChange={(e) => setDirectWelderLabor(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                            placeholder="Ví dụ: 14000000"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Số lượng <span className="text-rose-500 font-bold">*</span></label>
                      <input
                        type="number"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        min="1"
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                        placeholder="Ví dụ: 1"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Ghi chú thiết kế gia cường</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none focus:border-pink-500 font-medium"
                        placeholder="Ví dụ: Bản mã dày 8ly khoan neo 4 lỗ..."
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold p-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-[0.98]"
                      >
                        <Plus className="w-4 h-4" />
                        Thêm vào bảng
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 mb-4 bg-slate-950/45 border border-dashed border-slate-800 text-slate-400 rounded-xl text-center text-xs font-semibold">
                🔒 Hồ sơ báo giá đang ở chế độ <strong>Khóa số liệu</strong>. Vui lòng bấm nút <strong className="text-pink-400 font-black">"Chỉnh sửa"</strong> ở thanh hành động bên dưới để cập nhật lại số liệu.
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto min-h-[180px]">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-200 font-bold">
                  <tr>
                    <th className="px-3 py-2 text-center w-12">Ký hiệu / STT</th>
                    <th className="px-3 py-2">Chi tiết sản phẩm & thông số kỹ thuật</th>
                    <th className="px-3 py-2 text-center">Kích thước (Ngang x Cao)</th>
                    <th className="px-3 py-2 text-center">ĐVT</th>
                    <th className="px-3 py-2 text-center">SL</th>
                    <th className="px-3 py-2 text-right">Đơn giá định mức</th>
                    <th className="px-3 py-2 text-right">Thành tiền thực tế</th>
                    <th className="px-3 py-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {quoteItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-500 font-medium italic">Không có hạng mục mỏ hàn cơ khí nào trong bảng này.</td>
                    </tr>
                  ) : (
                    quoteItems.map((item, idx) => {
                      const isDoor = item.estimatorMode === 'door' || (!item.estimatorMode && item.ngang && item.cao);
                      return (
                        <tr key={item.id} className="border-b border-slate-850 hover:bg-slate-950/40 transition-colors">
                          <td className="px-3 py-2.5 text-center font-mono text-slate-400">
                            {isDoor ? (item.sign || `C${idx + 1}`) : `STT ${idx + 1}`}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-slate-100">{item.name}</div>
                            {isDoor ? (
                              <div className="text-[10px] text-slate-400 mt-1 space-y-0.5">
                                <div>• Hệ nhôm: <strong className="text-slate-300">{item.he || 'Tiêu chuẩn'}</strong> | Màu sắc: <strong className="text-slate-300">{item.mauSac || 'Tự chọn'}</strong></div>
                                <div>• Loại kính: <strong className="text-slate-300">{item.kinh || 'Kính Temper 8mm'}</strong> | Phụ kiện: <strong className="text-slate-300">{item.phuKien || 'Đồng bộ'}</strong></div>
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400 mt-1">
                                {groupNames[item.group]} | 
                                {item.pricingMethod === 'quick' ? (
                                  <span>Định mức: {item.weightKg} kg x {item.unitPricePerKg?.toLocaleString('vi-VN')} đ/kg</span>
                                ) : (
                                  <span>Bóc gối sắt hộp {item.steelTons} tấn và chi phí phụ trợ</span>
                                )}
                              </div>
                            )}
                            {item.notes && <div className="text-[10px] text-pink-400 italic mt-1">Ghi chú: *{item.notes}</div>}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-slate-300">
                            {isDoor && item.ngang && item.cao ? (
                              <span>{item.ngang.toFixed(3)}m x {item.cao.toFixed(3)}m<br/><span className="text-[10px] text-slate-500">({(item.ngang * item.cao).toFixed(3)} m2)</span></span>
                            ) : (
                              <span className="text-slate-500 italic">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-300 font-bold">
                            {item.unit || (isDoor ? 'Bộ' : 'Hạng mục')}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-100">
                            {item.qty}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-200">
                            {isDoor ? (
                              <span>{(item.unitPrice || 0).toLocaleString('vi-VN')} đ/m2</span>
                            ) : (
                              <span>{(item.pricingMethod === 'quick' ? (item.weightKg * item.unitPricePerKg) : (item.totalPrice / (item.qty || 1))).toLocaleString('vi-VN')} đ</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-extrabold text-emerald-400 font-mono">
                            {(item.totalPrice).toLocaleString('vi-VN')} đ
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              disabled={isLockedVal}
                              onClick={() => !isLockedVal && handleRemoveItem(item.id)}
                              className="text-rose-500 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer p-1 transition-colors"
                              title={isLockedVal ? "Hồ sơ đã khóa" : "Xóa dòng này"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tài chính */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 text-slate-800">
            <div className="grid grid-cols-2 text-xs text-slate-600 gap-y-1.5 text-left">
              <span>Hợp tổng thô cơ bản:</span>
              <span className="text-right font-mono font-bold text-slate-800">{subtotal.toLocaleString('vi-VN')} đ</span>
              
              <span>Chiết khấu sắt thép ({config.discountPercent}%):</span>
              <span className="text-right font-mono font-bold text-rose-600">-{discountVal.toLocaleString('vi-VN')} đ</span>
              
              <span>Giá trước thuế (Giá trị thô):</span>
              <span className="text-right font-mono font-bold text-slate-800">{totalQuoteAmount.toLocaleString('vi-VN')} đ</span>

              <span>Thuế VAT ({vatPercent}%):</span>
              <span className="text-right font-mono font-bold text-indigo-600">+{vatAmount.toLocaleString('vi-VN')} đ</span>

              <div className="col-span-2 border-t border-slate-150 my-1.5 font-bold"></div>
              
              <span className="text-sm font-bold text-slate-800 font-sans">TỔNG CỘNG THANH TOÁN (ĐÃ CÓ VAT):</span>
              <span className="text-right text-base font-extrabold text-[#00a651] font-mono">{totalWithVat.toLocaleString('vi-VN')} đ</span>
            </div>

            <div className="grid grid-cols-1 gap-2 border-t border-slate-150 pt-3 text-[11px] text-left">
              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Tiền bằng chữ sơ ước</label>
                <div className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-bold text-emerald-700 italic">
                  {totalWithVat > 0 ? (
                    (() => {
                      const words = docSoTiengViet(Math.round(totalWithVat));
                      return words ? (words.charAt(0).toUpperCase() + words.slice(1) + " đồng chẵn.") : "Không đồng.";
                    })()
                  ) : (
                    "Không đồng."
                  )}
                </div>
              </div>
            </div>
          </div>

            <div className="flex flex-col md:flex-row justify-end items-center gap-4 pt-4 border-t border-slate-800">
              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
                {((!selectedProjectId && !projectName.trim()) || !customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) && (
                  <span className="text-[10px] text-rose-400 font-semibold animate-pulse mr-2">
                    ⚠️ Yêu cầu chọn đầy đủ Dự án/Tên Dự án & Khách hàng
                  </span>
                )}

                {/* Nút Chỉnh sửa */}
                <button
                  type="button"
                  onClick={() => setIsLockedVal(false)}
                  disabled={!isMechSavedVal || !isLockedVal}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed font-semibold px-4 py-2.5 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-200 border border-slate-700 shadow-md"
                  title={!isMechSavedVal ? "Nút Chỉnh sửa chỉ mở khi hồ sơ Đã Lưu" : !isLockedVal ? "Đang trong chế độ chỉnh sửa" : "Chỉnh sửa số liệu báo giá"}
                >
                  <Edit className="w-4 h-4 text-pink-400" />
                  Chỉnh sửa
                </button>

                {/* Nút Lưu / Đã Lưu */}
                <button
                  type="button"
                  onClick={handleSaveQuote}
                  disabled={(isMechSavedVal && isLockedVal) || quoteItems.length === 0 || (!selectedProjectId && !projectName.trim()) || !customerName.trim() || !customerPhone.trim() || !customerAddress.trim()}
                  className={`${isMechSavedVal && isLockedVal ? 'bg-slate-750 hover:bg-slate-750 text-slate-400 border border-slate-850 cursor-not-allowed' : 'bg-pink-600 hover:bg-pink-500 text-white'} disabled:opacity-30 disabled:cursor-not-allowed font-semibold px-4 py-2.5 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-200 shadow-md`}
                  title={(!selectedProjectId && !projectName.trim()) || !customerName.trim() || !customerPhone.trim() || !customerAddress.trim() ? "Vui lòng nhập đầy đủ Dự án/Tên Dự án và Khách hàng" : isMechSavedVal && isLockedVal ? "Hồ sơ đã được lưu" : "Lưu hồ sơ báo giá"}
                >
                  {isMechSavedVal && isLockedVal ? (
                    <>
                      <Check className="w-4 h-4" />
                      Đã Lưu
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Lưu
                    </>
                  )}
                </button>

                {/* Nút Xem & In */}
                <button
                  type="button"
                  onClick={() => {
                    const archivedRecord = {
                      id: loadedQuoteVal ? loadedQuoteVal.id : `archived_quote_${Date.now()}`,
                      code: loadedQuoteVal ? loadedQuoteVal.code : `BGME-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 105)}`,
                      customerId: selectedCustomerId,
                      projectId: selectedProjectId || undefined,
                      projectName: selectedProjectId ? (projects.find(p => p.id === selectedProjectId)?.name || '').trim() : projectName.trim(),
                      date: new Date().toISOString().split('T')[0],
                      items: quoteItems,
                      config: config,
                      status: 'draft',
                      notes: quoteNotes,
                      paymentTerms: paymentTerms,
                      customerName: customerName.trim(),
                      customerPhone: customerPhone.trim(),
                      customerAddress: customerAddress.trim(),
                      companyLogoImg: companyLogoImg,
                      companyLogoText: companyLogoText,
                      companySlogan: companySlogan,
                      companyAddressInfo: companyAddressInfo,
                      companyContactInfo: companyContactInfo,
                      creatorId: currentUser?.id || 'emp_1',
                      creatorName: currentUser?.name || 'Nhân viên Báo giá',
                      sector: 'mechanical',
                      estimatorMode: estimatorMode,
                      createdAt: loadedQuoteVal?.createdAt || new Date().toLocaleDateString('vi-VN'),
                      totalAmount: totalQuoteAmount,
                      contractTemplate: loadedQuoteVal?.contractTemplate || contractTemplate,
                      acceptanceTemplate: loadedQuoteVal?.acceptanceTemplate || acceptanceTemplate,
                      liquidationTemplate: loadedQuoteVal?.liquidationTemplate || liquidationTemplate,
                      contractHtml: loadedQuoteVal?.contractHtml,
                      acceptanceHtml: loadedQuoteVal?.acceptanceHtml,
                      liquidationHtml: loadedQuoteVal?.liquidationHtml,
                      finalQuoteHtml: loadedQuoteVal?.finalQuoteHtml
                    };
                    setSavedQuoteForPreview(archivedRecord as any);
                  }}
                  disabled={!isMechSavedVal || !isLockedVal}
                  className="bg-indigo-600 hover:bg-indigo-555 text-white disabled:opacity-30 disabled:cursor-not-allowed font-semibold px-4 py-2.5 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-200 shadow-md"
                  title={!isMechSavedVal ? "Vui lòng lưu hồ sơ trước khi Xem & In" : !isLockedVal ? "Vui lòng hoàn tất chỉnh sửa và lưu trước khi Xem & In" : "Xem chi tiết & In ấn"}
                >
                  <Printer className="w-4 h-4" />
                  Xem & In
                </button>
              </div>
            </div>
          </div>

        {/* Dynamic Preview Modal */}
        {savedQuoteForPreview && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 select-text text-left font-sans">
            <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl text-slate-800 shadow-2xl overflow-hidden">
              <div className="bg-slate-50 px-6 py-4.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#fff0f6] flex items-center justify-center border border-[#ffd8e8]">
                    <FileText className="w-4 h-4 text-pink-600" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                      Xem chi tiết hóa đơn cơ khí gia tâm
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium">Báo giá cơ khí vừa tạo - HOANG LONG ERP</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSavedQuoteForPreview(null)}
                  className="text-slate-400 hover:text-slate-800 font-black cursor-pointer bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 md:p-6 bg-slate-100 max-h-[70vh] overflow-y-auto">
                <QuotationTableSheet quoteData={savedQuoteForPreview} />
              </div>
              <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSavedQuoteForPreview(null)}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-705 font-extrabold text-xs rounded-xl cursor-pointer"
                >
                  Thoát
                </button>
                <button
                  type="button"
                  onClick={() => {
                        window.print();
                      }}
                  className="px-5 py-2.5 bg-[#00a651] hover:bg-[#008f45] text-white font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-all hover:scale-[1.01]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  In Báo Giá
                </button>
              </div>
            </div>
          </div>
        )}

      {showQuickCreateCust && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[220] p-4 text-left">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 text-slate-100 shadow-2xl relative">
            <h4 className="font-extrabold text-base uppercase text-emerald-400 tracking-wide mb-4">
              Tạo Khách Hàng Nhanh
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">
                  Tên Khách Hàng <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={quickCustName}
                  onChange={(e) => setQuickCustName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 outline-none text-xs text-slate-100 focus:border-emerald-500 font-medium"
                  placeholder="Nhập tên khách hàng..."
                />
              </div>
              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">
                  Số Điện Thoại <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={quickCustPhone}
                  onChange={(e) => setQuickCustPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 outline-none text-xs text-slate-100 focus:border-emerald-500 font-medium"
                  placeholder="Nhập số điện thoại..."
                />
              </div>
              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">
                  Địa Chỉ <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={quickCustAddress}
                  onChange={(e) => setQuickCustAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 outline-none text-xs text-slate-100 focus:border-emerald-500 font-medium"
                  placeholder="Địa chỉ giao hàng / thi công..."
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2.5 mt-6 border-t border-slate-800/65 pt-3">
              <button
                type="button"
                onClick={() => {
                  setShowQuickCreateCust(false);
                  setQuickCustName('');
                  setQuickCustPhone('');
                  setQuickCustAddress('');
                }}
                className="px-4 py-2 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleQuickCreateCustomer}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Tạo mới
              </button>
            </div>
          </div>
        </div>
      )}

      {showExistsAlert && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[250] p-4 select-none animate-scaleIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 text-slate-100 shadow-2xl relative">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <h4 className="font-extrabold text-base uppercase text-white tracking-wide">
                Hồ Sơ Đã Tồn Tại!
              </h4>
              <p className="text-sm text-slate-300 leading-relaxed font-semibold">
                Hồ sơ Dự án đã tồn tại, vui lòng vào <strong className="text-emerald-400 font-extrabold">Lưu Trữ Hồ Sơ</strong> để theo dõi.
              </p>
              <button
                type="button"
                onClick={() => setShowExistsAlert(false)}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider py-3 rounded-xl transition-colors cursor-pointer shadow-md mt-2"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    );
  }
