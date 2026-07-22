import React, { useState, useEffect } from 'react';
import { QuoteConfig, QuoteItem, ProductGroup, Quote, ArchivedQuote, ProductCatalogItem } from '../types';
import { useNotification } from '../context';
import { DEFAULT_QUOTE_CONFIG } from '../data';
import { INITIAL_PRODUCTS } from './ProductCatalogTable';
import { Plus, Trash2, Sliders, Calculator, FileSpreadsheet, FileText, CheckCircle2, DollarSign, Search, Send, Printer, AlertTriangle, Save, Edit, Check, XCircle } from 'lucide-react';
import { dbService } from '../lib/dbService';
import QuotationTableSheet, { docSoTiengViet } from './QuotationTableSheet';
import RichTextEditor from './RichTextEditor';

export interface HouseEstimatePrice {
  stt: number;
  type: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  features: string;
}

export const HOUSE_ESTIMATE_PRICES = [
  {
    stt: 1,
    type: 'Nhà cấp 4 mái thái',
    avgPrice: 7300000,
    minPrice: 5600000,
    maxPrice: 9300000,
    features: 'Móng đơn/bằng, cột BTCT, tường 200, mái thép + ngói xi măng/đất nung'
  },
  {
    stt: 2,
    type: 'Nhà cấp 4 mái nhật',
    avgPrice: 8000000,
    minPrice: 6200000,
    maxPrice: 10200000,
    features: 'Móng bằng BTCT, cột thép hoặc BTCT, xà gồ thép, tấm lợp cao cấp'
  },
  {
    stt: 3,
    type: 'Nhà cấp 4 mái tôn',
    avgPrice: 5600000,
    minPrice: 4500000,
    maxPrice: 7200000,
    features: 'Móng đơn, tường gạch không cần cột lớn, xà gồ thép mạ kẽm + tôn'
  },
  {
    stt: 4,
    type: 'Nhà cấp 4 mái bằng',
    avgPrice: 7500000,
    minPrice: 5900000,
    maxPrice: 9300000,
    features: 'Móng bằng, cột dầm sàn BTCT M250, chống thấm Sika 2 lớp'
  },
  {
    stt: 5,
    type: 'Nhà phố',
    avgPrice: 11200000,
    minPrice: 8900000,
    maxPrice: 15100000,
    features: 'Móng cọc/bằng, BTCT chịu lực, tường 200, hoàn thiện đá hoa cương'
  },
  {
    stt: 6,
    type: 'Nhà ống',
    avgPrice: 10700000,
    minPrice: 8300000,
    maxPrice: 14000000,
    features: 'Giống nhà phố, chiều ngang 3-5m, chiều sâu 15-20m, 3-5 tầng'
  },
  {
    stt: 7,
    type: 'Biệt thự hiện đại',
    avgPrice: 14800000,
    minPrice: 10800000,
    maxPrice: 21200000,
    features: 'Móng cọc BTCT, khung cột dầm lớn, kính Low-E, đá tự nhiên, nội thất cao cấp'
  },
  {
    stt: 8,
    type: 'Biệt thự tân cổ điển',
    avgPrice: 17500000,
    minPrice: 12100000,
    maxPrice: 24100000,
    features: 'BTCT toàn khối, vữa GRC đúc phào, đá marble, sơn giả đá, cổng sắt nghệ thuật'
  },
  {
    stt: 9,
    type: 'Nhà vườn',
    avgPrice: 12300000,
    minPrice: 8700000,
    maxPrice: 17500000,
    features: 'Kết hợp BTCT + gỗ tự nhiên, mái ngói/mái xanh, cảnh quan sân vườn'
  },
  {
    stt: 10,
    type: 'Biệt thự cổ điển',
    avgPrice: 20100000,
    minPrice: 14300000,
    maxPrice: 28500000,
    features: 'BTCT toàn khối, ốp đá tự nhiên, cửa gỗ cổ điển, đèn chùm, trần thạch cao phào'
  },
  {
    stt: 11,
    type: 'Nhà khung thép tiền chế',
    avgPrice: 7000000,
    minPrice: 5300000,
    maxPrice: 9300000,
    features: 'Cột thép H/I, xà ngang thép, panel tường+mái EPS sandwich, móng đơn'
  }
];

export const DEFAULT_CONS_PAYMENT_TERMS = `<p><strong>1. Thời gian thực hiện:</strong> 10-12 ngày.</p>
<p><strong>2. Bảo hành:</strong> Bảo hành 1 năm. Lỗi phụ kiện thay mới.</p>
<p><strong>3. Thanh toán:</strong></p>
<ul style="padding-left: 20px; list-style-type: disc;">
  <li><strong>3.1 Đặt cọc:</strong> <span style="color: #4f46e5;"><strong>50%</strong></span> giá trị đơn hàng là ngay khi xác nhận báo giá để xưởng tiến hành sản xuất.</li>
  <li style="list-style-type: none; margin-left: -10px;">🏦 <strong>Thông tin tài khoản:</strong> <span style="color: #4f46e5; font-weight: bold;">799201899999 MB BANK - Công ty TNHH Hoàng Long Lâm Đồng</span></li>
  <li><strong>3.2 Thanh toán:</strong> Thanh toán <span style="color: #4f46e5;"><strong>50%</strong></span> còn lại ngay khi hoàn thành công việc (Không quá 05 ngày kể từ ngày nhận được hóa đơn tài chính, bên mua trả phí chuyển khoản)</li>
  <li><strong>3.3 Hiệu lực báo giá:</strong> 05 ngày kể từ ngày báo giá.</li>
</ul>
<p><strong>Lưu ý:</strong> <em>Báo giá được áp dụng theo thiết kế và quy cách đã thống nhất. Mọi thay đổi về thiết kế, kích thước, vật liệu hoặc phụ kiện (nếu có) sẽ được xem xét điều chỉnh lại đơn giá cho phù hợp với giá trị sản phẩm thực tế.</em></p>
<p>Xin vui lòng liên hệ với chúng tôi nếu quý khách hàng có cần thêm các yêu cầu nào khác.</p>
<p><strong>Trân trọng cảm ơn.</strong></p>`;

export const DEFAULT_CONS_CONTRACT_TEMPLATE = `<h3 style="text-align: center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
<h3 style="text-align: center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align: center;"><strong>Độc lập – Tự do – Hạnh phúc</strong></p>
<div style="text-align: center; margin-top: -10px;">• • • • • • • • • • • • • • •</div>
<p style="text-align: right; font-style: italic;">Số: <span style="color: red;">{{SO_HOP_DONG}}</span>/HĐ-XD</p>
<h2 style="text-align: center; margin-top: 20px;"><strong>HỢP ĐỒNG XÂY DỰNG (THI CÔNG TRỌN GÓI)</strong></h2>

<p><em>Căn cứ:</em></p>
<p><em>- Luật Xây dựng số 50/2014/QH13 (sửa đổi bởi Luật số 62/2020/QH14);</em></p>
<p><em>- Nghị định số 37/2015/NĐ-CP ngày 22/4/2015 về hợp đồng xây dựng;</em></p>
<p><em>- Bộ luật Dân sự số 91/2015/QH13; hồ sơ mời thầu, hồ sơ dự thầu và tài liệu kèm theo (nếu có).</em></p>

<p>Hôm nay, ngày <span style="color: red;">{{NGAY}}</span> tháng <span style="color: red;">{{THANG}}</span> năm <span style="color: red;">{{NAM}}</span>, tại <span style="color: red;">{{DIA_DIEM_KY}}</span>, chúng tôi gồm:</p>

<p><strong>BÊN GIAO THẦU (BÊN A):</strong></p>
<ul>
  <li>Tên công ty/Chủ đầu tư: <span style="color: red;">{{TEN_KHACH_HANG}}</span></li>
  <li>Địa chỉ: <span style="color: red;">{{DIA_CHI_KHACH_HANG}}</span></li>
  <li>Mã số thuế: <span style="color: red;">{{MST_KHACH_HANG}}</span></li>
  <li>Đại diện: <span style="color: red;">{{DAI_DIEN_KHACH_HANG}}</span> Chức vụ: <span style="color: red;">{{CHUC_VU_KHACH_HANG}}</span></li>
  <li>Điện thoại: <span style="color: red;">{{DIEN_THOAI_KHACH_HANG}}</span> Email: <span style="color: red;">{{EMAIL_KHACH_HANG}}</span></li>
</ul>

<p><strong>BÊN NHẬN THẦU (BÊN B):</strong></p>
<ul>
  <li>Tên công ty: <span style="color: red;">{{TEN_CONG_TY}}</span></li>
  <li>Địa chỉ: <span style="color: red;">{{DIA_CHI_CONG_TY}}</span></li>
  <li>Mã số thuế: <span style="color: red;">{{MST_CONG_TY}}</span></li>
  <li>Đại diện: <span style="color: red;">{{DAI_DIEN_CONG_TY}}</span> Chức vụ: <span style="color: red;">{{CHUC_VU_CONG_TY}}</span></li>
  <li>Điện thoại: <span style="color: red;">{{DIEN_THOAI_CONG_TY}}</span> Email: <span style="color: red;">{{EMAIL_CONG_TY}}</span></li>
</ul>

<p>Hai bên thống nhất ký kết Hợp đồng xây dựng với các điều khoản sau:</p>

<p><strong>Điều 1. Nội dung và khối lượng công việc</strong></p>
<p>1.1. Tên công trình: <span style="color: red;">{{CONG_TRINH}}</span></p>
<p>1.2. Địa điểm xây dựng: <span style="color: red;">{{DIA_DIEM}}</span></p>
<p>1.3. Loại, cấp công trình: <span style="color: red;">{{LOAI_CAP_CONG_TRINH}}</span></p>
<p>1.4. Quy mô / Diện tích: <span style="color: red;">{{QUY_MO_DIEN_TICH}}</span></p>
<p>1.5. Nội dung công việc nhận thầu: Bên Nhận thầu thực hiện thi công xây dựng, cung cấp vật tư, nhân công, máy móc thiết bị để hoàn thành công trình theo hồ sơ thiết kế, bản vẽ thi công và các tài liệu kèm theo được duyệt.</p>
<p>Bảng khối lượng công việc:</p>
<p>{{BANG_CHI_TIET_BÁO_GIÁ}}</p>

<p><strong>Điều 2. Chất lượng và yêu cầu kỹ thuật</strong></p>
<p>2.1. Công trình phải được thi công đúng thiết kế được duyệt, tuân thủ các tiêu chuẩn, quy chuẩn kỹ thuật quốc gia (TCVN, QCVN) hiện hành và các quy định về quản lý chất lượng công trình xây dựng.</p>
<p>2.2. Vật liệu, thiết bị đưa vào công trình phải có chứng chỉ xuất xứ, chứng nhận hợp quy và được nghiệm thu trước khi sử dụng.</p>

<p><strong>Điều 3. Thời gian thực hiện hợp đồng</strong></p>
<p>3.1. Ngày khởi công: <span style="color: red;">{{NGAY_KHOI_CONG}}</span></p>
<p>3.2. Ngày hoàn thành: <span style="color: red;">{{NGAY_HOAN_THANH}}</span></p>
<p>3.3. Tiến độ thi công tổng thể được lập chi tiết, chia theo các giai đoạn: chuẩn bị mặt bằng, thi công phần móng, phần thân, hoàn thiện và nghiệm thu bàn giao.</p>
<p>3.4. Bên Nhận thầu được gia hạn tiến độ trong trường hợp bất khả kháng, do lỗi của Bên Giao thầu hoặc phát sinh khối lượng được chấp thuận, với thời gian gia hạn tương ứng.</p>

<p><strong>Điều 4. Giá hợp đồng và điều chỉnh giá</strong></p>
<p>4.1. Loại giá hợp đồng: <span style="color: red;">{{LOAI_GIA_HOP_DONG}}</span></p>
<p>4.2. Giá trị hợp đồng: <span style="color: red;">{{TONG_CONG}}</span> VNĐ (Bằng chữ: <span style="color: red;">{{TONG_CONG_CHU}}</span>)</p>
<p>4.3. Việc điều chỉnh giá hợp đồng thực hiện theo Điều 143 Luật Xây dựng 2020 và Nghị định 37/2015/NĐ-CP, áp dụng đối với hợp đồng theo đơn giá điều chỉnh hoặc khi có thay đổi khối lượng, chính sách của Nhà nước.</p>

<p><strong>Điều 5. Tạm ứng, thanh toán và quyết toán</strong></p>
<p>5.1. Tạm ứng: <span style="color: red;">{{SO_TIEN_TAM_UNG}}</span> VNĐ (tương đương với <span style="color: red;">{{TY_LE_TAM_UNG}}</span>% tổng giá trị hợp đồng)</p>
<p>5.2. Thanh toán theo tiến độ thực hiện trên cơ sở khối lượng hoàn thành được nghiệm thu, thành nhiều đợt; mỗi đợt thanh toán khấu trừ tương ứng phần tạm ứng đã cấp.</p>
<p>5.3. Tài khoản: <span style="color: red;">{{STK_CONG_TY}}</span></p>
<p>5.4. Quyết toán hợp đồng được lập sau khi công trình hoàn thành, nghiệm thu và bàn giao đưa vào sử dụng theo quy định.</p>

<p><strong>Điều 6. Bảo đảm thực hiện hợp đồng</strong></p>
<p>6.1. Bảo lãnh thực hiện hợp đồng: <span style="color: red;">{{GIA_TRI_BAO_LANH}}</span></p>

<p><strong>Điều 7. Bảo hiểm công trình</strong></p>
<p>7.1. Giá trị bảo hiểm công trình: <span style="color: red;">{{GIA_TRI_BAO_HIEM}}</span></p>

<p><strong>Điều 8. An toàn lao động và vệ sinh môi trường</strong></p>
<p>8.1. Bên Nhận thầu chịu trách nhiệm bảo đảm an toàn lao động, phòng chống cháy nổ và vệ sinh môi trường tại công trường theo quy định pháp luật.</p>

<p><strong>Điều 9. Điều chỉnh, tạm dừng, chấm dứt hợp đồng</strong></p>
<p>9.1. Hợp đồng có thể được điều chỉnh, tạm dừng hoặc chấm dứt theo thỏa thuận hoặc theo quy định tại Nghị định 37/2015/NĐ-CP khi một bên vi phạm nghiêm trọng hoặc do bất khả kháng kéo dài.</p>

<p><strong>Điều 10. Nghiệm thu và bàn giao công trình</strong></p>
<p>10.1. Việc nghiệm thu được thực hiện theo từng giai đoạn với sự tham gia của các bên liên quan, lập biên bản nghiệm thu theo mẫu.</p>
<p>10.2. Công trình được bàn giao cho Bên Giao thầu sau khi nghiệm thu hoàn thành và đủ điều kiện đưa vào sử dụng theo quy định.</p>`;

export const DEFAULT_CONS_ACCEPTANCE_TEMPLATE = `<h3 style="text-align: center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
<h3 style="text-align: center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align: center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align: center; margin-top: -10px;">• • • • • • • • • • • • • • •</div>
<p style="text-align: right; font-style: italic;">Số: <span style="color: red;">{{SO_NGHIEM_THU}}</span>/BBNT-XD</p>
<p style="text-align: right; font-style: italic;">Lâm Đồng, ngày <span style="color: red;">{{NGAY}}</span> tháng <span style="color: red;">{{THANG}}</span> năm <span style="color: red;">{{NAM}}</span></p>
<h2 style="text-align: center; margin-top: 20px;"><strong>BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO CÔNG TRÌNH XÂY DỰNG</strong></h2>

<p><em>Căn cứ vào Hợp đồng số: <span style="color: red;">{{SO_HOP_DONG}}</span>, ký ngày <span style="color: red;">{{NGAY_KY_HĐ}}</span> giữa <span style="color: red;">{{TEN_CONG_TY}}</span> và <span style="color: red;">{{TEN_KHACH_HANG}}</span>.</em></p>
<p><strong>Công trình:</strong> <span style="color: red;">{{CONG_TRINH}}</span></p>
<p><strong>Địa điểm:</strong> <span style="color: red;">{{DIA_DIEM}}</span></p>

<p>Sau khi thi công hoàn thành và bàn giao đưa vào sử dụng. Hôm nay chúng tôi gồm có:</p>

<p><strong>Bên A (Bên nhận): <span style="color: red;">{{TEN_KHACH_HANG}}</span></strong></p>
<ul>
  <li>Địa chỉ: <span style="color: red;">{{DIA_CHI_KHACH_HANG}}</span></li>
  <li>Điện thoại: <span style="color: red;">{{DIEN_THOAI_KHACH_HANG}}</span></li>
  <li>Mã số thuế: <span style="color: red;">{{MST_KHACH_HANG}}</span></li>
</ul>

<p><strong>Bên B (Bên giao): <span style="color: red;">{{TEN_CONG_TY}}</span></strong></p>
<ul>
  <li>Địa chỉ: <span style="color: red;">{{DIA_CHI_CONG_TY}}</span></li>
  <li>Điện thoại: <span style="color: red;">{{DIEN_THOAI_CONG_TY}}</span></li>
  <li>Mã số thuế: <span style="color: red;">{{MST_CONG_TY}}</span></li>
  <li>Đại diện là: <span style="color: red;">{{DAI_DIEN_CONG_TY}}</span> - Chức vụ: <span style="color: red;">{{CHUC_VU_CONG_TY}}</span></li>
</ul>

<p>Hai bên cùng tiến hành kiểm tra, nghiệm thu, bàn giao với nội dung như sau:</p>

<p><strong>Điều 1: Hạng mục bàn giao</strong></p>
<p>Hạng mục bàn giao theo bảng chi tiết như sau:</p>
<p>{{BANG_CHI_TIET_BÁO_GIÁ}}</p>
<p>Tổng cộng: <strong><span style="color: red;">{{TONG_CONG}}</span></strong> VND</p>

<p><strong>Điều 2. Nghiệm thu:</strong></p>
<p>Tất cả các hạng mục công trình do bên B thi công hoàn thành đạt chuẩn chất lượng theo đúng hồ sơ thiết kế được duyệt.</p>
<p>Bên B đã cung cấp vật tư, hoàn thành thi công theo đúng yêu cầu kỹ thuật của Hợp đồng.</p>
<p><strong>Kết luận:</strong> Đồng ý nghiệm thu bàn giao và đưa hạng mục công trình vào sử dụng.</p>
<p>Biên bản kết thúc cùng ngày và được lập thành 03 (ba) bản bên A giữ 1 bản, bên B giữ 2 bản có giá trị pháp lý như nhau.</p>`;

export const DEFAULT_CONS_LIQUIDATION_TEMPLATE = `<h3 style="text-align: center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
<h3 style="text-align: center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align: center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align: center; margin-top: -10px;">• • • • • • • • • • • • • • •</div>
<p style="text-align: right; font-style: italic;">Số: <span style="color: red;">{{SO_THANH_LY}}</span>/TLHĐ-XD</p>
<p style="text-align: right; font-style: italic;">Lâm Đồng, ngày <span style="color: red;">{{NGAY}}</span> tháng <span style="color: red;">{{THANG}}</span> năm <span style="color: red;">{{NAM}}</span></p>
<h2 style="text-align: center; margin-top: 20px;"><strong>BIÊN BẢN THANH LÝ HỢP ĐỒNG THI CÔNG XÂY DỰNG</strong></h2>

<p><em>Căn cứ vào Hợp đồng số: <span style="color: red;">{{SO_HOP_DONG}}</span>, ký ngày <span style="color: red;">{{NGAY_KY_HĐ}}</span>.</em></p>
<p><em>Căn cứ vào biên bản nghiệm thu số: <span style="color: red;">{{SO_NGHIEM_THU}}</span>, ký ngày <span style="color: red;">{{NGAY_NGHIEM_THU}}</span> giữa <span style="color: red;">{{TEN_CONG_TY}}</span> và <span style="color: red;">{{TEN_KHACH_HANG}}</span>.</em></p>

<p><strong>Công trình:</strong> <span style="color: red;">{{CONG_TRINH}}</span></p>
<p><strong>Địa điểm:</strong> <span style="color: red;">{{DIA_DIEM}}</span></p>

<p>Sau khi hoàn thành thi công và bàn giao đưa vào sử dụng. Hôm nay chúng tôi gồm có:</p>

<p><strong>Bên A (Bên nhận): <span style="color: red;">{{TEN_KHACH_HANG}}</span></strong></p>
<ul>
  <li>Địa chỉ: <span style="color: red;">{{DIA_CHI_KHACH_HANG}}</span></li>
  <li>Điện thoại: <span style="color: red;">{{DIEN_THOAI_KHACH_HANG}}</span></li>
  <li>Mã số thuế: <span style="color: red;">{{MST_KHACH_HANG}}</span></li>
</ul>

<p><strong>Bên B (Bên giao): <span style="color: red;">{{TEN_CONG_TY}}</span></strong></p>
<ul>
  <li>Địa chỉ: <span style="color: red;">{{DIA_CHI_CONG_TY}}</span></li>
  <li>Điện thoại: <span style="color: red;">{{DIEN_THOAI_CONG_TY}}</span></li>
  <li>Mã số thuế: <span style="color: red;">{{MST_CONG_TY}}</span></li>
  <li>Đại diện là: <span style="color: red;">{{DAI_DIEN_CONG_TY}}</span> - Chức vụ: <span style="color: red;">{{CHUC_VU_CONG_TY}}</span></li>
</ul>

<p>Hai bên cùng tiến hành kiểm tra, nghiệm thu, bàn giao với nội dung như sau:</p>
<p>Bên B đã cung cấp vật tư và thi công đầy đủ khối lượng theo biên bản nghiệm thu bàn giao đã ký ngày <span style="color: red;">{{NGAY_NGHIEM_THU}}</span>.</p>
<p>Hai bên thống nhất nghiệm thu toàn phần và thanh lý Hợp đồng đã ký kết.</p>

<p><strong>Điều 2. Giá trị thanh lý:</strong></p>
<p>Tổng giá trị khối lượng theo hợp đồng: <strong><span style="color: red;">{{TONG_CONG}}</span></strong> đồng (Bằng chữ: <em><span style="color: red;">{{TONG_CONG_CHU}}</span></em>).</p>
<p>Bên A phải thanh toán cho bên B số tiền: <strong><span style="color: red;">{{TONG_CONG}}</span></strong> đồng (Bằng chữ: <em><span style="color: red;">{{TONG_CONG_CHU}}</span></em>).</p>
<p>Biên bản kết thúc cùng ngày và được lập thành 03 (ba) bản Bên A giữ 1 bản, bên B giữ 02 (hai) bản có giá trị pháp lý như nhau.</p>`;


interface ConstructionEstimatorProps {
  onAddQuote?: (newQuote: any) => void;
  customers: any[];
  projects: any[];
  preselectedCustomerId?: string;
  preselectedProjectId?: string;
  currentUser?: any;
  houseEstimatePrices?: HouseEstimatePrice[];

  // Shared props
  selectedCustomerId?: string;
  setSelectedCustomerId?: (val: string) => void;
  selectedProjectId?: string;
  setSelectedProjectId?: (val: string) => void;
  projectName?: string;
  setProjectName?: (val: string) => void;
  customerName?: string;
  setCustomerName?: (val: string) => void;
  customerPhone?: string;
  setCustomerPhone?: (val: string) => void;
  customerAddress?: string;
  setCustomerAddress?: (val: string) => void;
  hideMetadataHeader?: boolean;

  // Saved & Lock control props
  isConstructionSaved?: boolean;
  setIsConstructionSaved?: (val: boolean) => void;
  isLocked?: boolean;
  setIsLocked?: (val: boolean) => void;
  loadedQuote?: any;
  setLoadedQuote?: (quote: any) => void;

  // Lifted estimator states
  chieuDai?: number;
  setChieuDai?: (val: number) => void;
  chieuRong?: number;
  setChieuRong?: (val: number) => void;
  soTang?: number;
  setSoTang?: (val: number) => void;
  selectedHouseType?: string;
  setSelectedHouseType?: (val: string) => void;
  donGiaKhaiToan?: number;
  setDonGiaKhaiToan?: (val: number) => void;
  nganSachNoiThat?: number;
  setNganSachNoiThat?: (val: number) => void;
  quoteItems?: QuoteItem[];
  setQuoteItems?: React.Dispatch<React.SetStateAction<QuoteItem[]>>;
  showTemplateOnly?: boolean;
}

export default function ConstructionEstimator(props: ConstructionEstimatorProps) {
  const { 
    onAddQuote, 
    customers, 
    projects,
    preselectedCustomerId,
    preselectedProjectId,
    currentUser,
    houseEstimatePrices: propsHouseEstimatePrices,
    hideMetadataHeader = false,
    isConstructionSaved = false,
    setIsConstructionSaved,
    isLocked = false,
    setIsLocked,
    loadedQuote,
    setLoadedQuote,
    showTemplateOnly = false
  } = props;

  // Read house estimate prices reactively (from prop or localStorage)
  const houseEstimatePrices = React.useMemo<HouseEstimatePrice[]>(() => {
    if (propsHouseEstimatePrices) return propsHouseEstimatePrices;
    const local = localStorage.getItem('house_estimate_prices');
    return local ? (JSON.parse(local) as HouseEstimatePrice[]) : HOUSE_ESTIMATE_PRICES;
  }, [propsHouseEstimatePrices]);
  // Config tỉ lệ % đặc thù xây dựng thô
  const [config, setConfig] = useState<QuoteConfig>({
    discountPercent: 2,
    accessoryPercent: 5, // Trị số dự phòng thiết kế
    laborPercent: 25,    // Phần trăm nhân công thầu xây thô
    generalPercent: 8,   // Chi phí quản lý & vận hành giàn giáo
    profitPercent: 12,   // Lợi nhuận thầu định mức
    wastagePercent: 10,  // Hao hụt hao phí vật tư gạch đá cát xi măng
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
        const list = await dbService.archivedQuotes.list('construction');
        if (active) {
          setArchivedQuotesList(list);
        }
      } catch (err) {
        console.error("Lỗi khi tải hồ sơ lưu trữ:", err);
      }
    };
    fetchArchivedQuotes();
    const handleConstructionUpdated = () => fetchArchivedQuotes();
    window.addEventListener('hl-archived-quotes-updated', handleConstructionUpdated);
    return () => {
      active = false;
      window.removeEventListener('hl-archived-quotes-updated', handleConstructionUpdated);
    };
  }, [projects]);

  // Khách hàng & dự án được chọn cho báo giá này
  const [localSelectedCustomerId, setLocalSelectedCustomerId] = useState(preselectedCustomerId || '');
  const selectedCustomerId = props.selectedCustomerId !== undefined ? props.selectedCustomerId : localSelectedCustomerId;
  const setSelectedCustomerId = props.setSelectedCustomerId || setLocalSelectedCustomerId;

  const [localSelectedProjectId, setLocalSelectedProjectId] = useState(preselectedProjectId || '');
  const selectedProjectId = props.selectedProjectId !== undefined ? props.selectedProjectId : localSelectedProjectId;
  const setSelectedProjectId = props.setSelectedProjectId || setLocalSelectedProjectId;

  const [localProjectName, setLocalProjectName] = useState('');
  const projectName = props.projectName !== undefined ? props.projectName : localProjectName;
  const setProjectName = props.setProjectName || setLocalProjectName;

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
  const [localCustomerName, setLocalCustomerName] = useState('');
  const customerName = props.customerName !== undefined ? props.customerName : localCustomerName;
  const setCustomerName = props.setCustomerName || setLocalCustomerName;

  const [localCustomerAddress, setLocalCustomerAddress] = useState('');
  const customerAddress = props.customerAddress !== undefined ? props.customerAddress : localCustomerAddress;
  const setCustomerAddress = props.setCustomerAddress || setLocalCustomerAddress;

  const [localCustomerPhone, setLocalCustomerPhone] = useState('');
  const customerPhone = props.customerPhone !== undefined ? props.customerPhone : localCustomerPhone;
  const setCustomerPhone = props.setCustomerPhone || setLocalCustomerPhone;

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
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng nhập đầy đủ Tên, Số điện thoại và Địa chỉ!', type: 'warning' });
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

  const [quoteNotes, setQuoteNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState(() => localStorage.getItem('hl_construction_payment_terms') || sessionStorage.getItem('hl_construction_payment_terms') || DEFAULT_CONS_PAYMENT_TERMS);

  const [companyLogoImg, setCompanyLogoImg] = useState(() => localStorage.getItem('hl_construction_company_logo') || sessionStorage.getItem('hl_construction_company_logo') || '');
  const [companyLogoText, setCompanyLogoText] = useState(() => localStorage.getItem('hl_construction_company_name') || sessionStorage.getItem('hl_construction_company_name') || 'HOANG LONG');
  const [companySlogan, setCompanySlogan] = useState(() => localStorage.getItem('hl_construction_company_slogan') || sessionStorage.getItem('hl_construction_company_slogan') || 'Construction - Furniture - Doors');
  const [companyAddressInfo, setCompanyAddressInfo] = useState(() => localStorage.getItem('hl_construction_company_address') || sessionStorage.getItem('hl_construction_company_address') || '<p>📍 <strong>Trụ sở chính:</strong> Hẻm 24 Ngô Quyền, Phường 6, TP. Đà Lạt, Lâm Đồng</p><p>🏢 <strong>Chi nhánh xưởng:</strong> Phi Nôm, Hiệp Thạnh, Đức Trọng, Lâm Đồng</p>');
  const [companyContactInfo, setCompanyContactInfo] = useState(() => localStorage.getItem('hl_construction_company_contact') || sessionStorage.getItem('hl_construction_company_contact') || '<p>📞 <strong>Hotline:</strong> 0979.201.899</p><p>✉️ <strong>Email:</strong> hoanglongdoors@gmail.com</p><p>🌐 <strong>Website:</strong> hoanglongdoors.com</p>');

  const [contractTemplate, setContractTemplate] = useState(() => localStorage.getItem('hl_construction_contract_template') || DEFAULT_CONS_CONTRACT_TEMPLATE);
  const [acceptanceTemplate, setAcceptanceTemplate] = useState(() => localStorage.getItem('hl_construction_acceptance_template') || DEFAULT_CONS_ACCEPTANCE_TEMPLATE);
  const [liquidationTemplate, setLiquidationTemplate] = useState(() => localStorage.getItem('hl_construction_liquidation_template') || DEFAULT_CONS_LIQUIDATION_TEMPLATE);
  const [activeTemplateTab, setActiveTemplateTab] = useState<'quote' | 'contract' | 'acceptance' | 'liquidation'>('quote');
  const [isTemplateEditable, setIsTemplateEditable] = useState(false);

  const handleSetAsDefault = async () => {
    setDbSaving(true);
    setDbSaveSuccess(false);
    setDbSaveError(null);
    try {
      let defaultData = await dbService.quotationConfigs.get('construction_default') || {};
      
      if (activeTemplateTab === 'quote') {
        defaultData.companyLogoImg = companyLogoImg;
        defaultData.companyLogoText = companyLogoText;
        defaultData.companySlogan = companySlogan;
        defaultData.companyAddressInfo = companyAddressInfo;
        defaultData.companyContactInfo = companyContactInfo;
        defaultData.paymentTerms = paymentTerms;
        
        localStorage.setItem('hl_construction_default_logo', companyLogoImg);
        localStorage.setItem('hl_construction_default_company_name', companyLogoText);
        localStorage.setItem('hl_construction_default_company_slogan', companySlogan);
        localStorage.setItem('hl_construction_default_company_address', companyAddressInfo);
        localStorage.setItem('hl_construction_default_company_contact', companyContactInfo);
        localStorage.setItem('hl_construction_default_payment_terms', paymentTerms);
      } else if (activeTemplateTab === 'contract') {
        defaultData.contractTemplate = contractTemplate;
        localStorage.setItem('hl_construction_default_contract_template', contractTemplate);
      } else if (activeTemplateTab === 'acceptance') {
        defaultData.acceptanceTemplate = acceptanceTemplate;
        localStorage.setItem('hl_construction_default_acceptance_template', acceptanceTemplate);
      } else if (activeTemplateTab === 'liquidation') {
        defaultData.liquidationTemplate = liquidationTemplate;
        localStorage.setItem('hl_construction_default_liquidation_template', liquidationTemplate);
      }
      
      await dbService.quotationConfigs.save('construction_default', defaultData);
      
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
      const defaultData = await dbService.quotationConfigs.get('construction_default');
      
      if (activeTemplateTab === 'quote') {
        const logo = defaultData?.companyLogoImg ?? localStorage.getItem('hl_construction_default_logo') ?? '';
        const name = defaultData?.companyLogoText ?? localStorage.getItem('hl_construction_default_company_name') ?? 'HOANG LONG';
        const slogan = defaultData?.companySlogan ?? localStorage.getItem('hl_construction_default_company_slogan') ?? 'Construction - Furniture - Doors';
        const address = defaultData?.companyAddressInfo ?? localStorage.getItem('hl_construction_default_company_address') ?? '<p>📍 <strong>Trụ sở chính:</strong> Hẻm 24 Ngô Quyền, Phường 6, TP. Đà Lạt, Lâm Đồng</p><p>🏢 <strong>Chi nhánh xưởng:</strong> Phi Nôm, Hiệp Thạnh, Đức Trọng, Lâm Đồng</p>';
        const contact = defaultData?.companyContactInfo ?? localStorage.getItem('hl_construction_default_company_contact') ?? '<p>📞 <strong>Hotline:</strong> 0979.201.899</p><p>✉️ <strong>Email:</strong> hoanglongdoors@gmail.com</p><p>🌐 <strong>Website:</strong> hoanglongdoors.com</p>';
        const terms = defaultData?.paymentTerms ?? localStorage.getItem('hl_construction_default_payment_terms') ?? DEFAULT_CONS_PAYMENT_TERMS;
        
        setCompanyLogoImg(logo);
        setCompanyLogoText(name);
        setCompanySlogan(slogan);
        setCompanyAddressInfo(address);
        setCompanyContactInfo(contact);
        setPaymentTerms(terms);
      } else if (activeTemplateTab === 'contract') {
        const template = defaultData?.contractTemplate ?? localStorage.getItem('hl_construction_default_contract_template') ?? DEFAULT_CONS_CONTRACT_TEMPLATE;
        setContractTemplate(template);
      } else if (activeTemplateTab === 'acceptance') {
        const template = defaultData?.acceptanceTemplate ?? localStorage.getItem('hl_construction_default_acceptance_template') ?? DEFAULT_CONS_ACCEPTANCE_TEMPLATE;
        setAcceptanceTemplate(template);
      } else if (activeTemplateTab === 'liquidation') {
        const template = defaultData?.liquidationTemplate ?? localStorage.getItem('hl_construction_default_liquidation_template') ?? DEFAULT_CONS_LIQUIDATION_TEMPLATE;
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
        setCompanyAddressInfo('<p>📍 <strong>Trụ sở chính:</strong> Hẻm 24 Ngô Quyền, Phường 6, TP. Đà Lạt, Lâm Đồng</p><p>🏢 <strong>Chi nhánh xưởng:</strong> Phi Nôm, Hiệp Thạnh, Đức Trọng, Lâm Đồng</p>');
        setCompanyContactInfo('<p>📞 <strong>Hotline:</strong> 0979.201.899</p><p>✉️ <strong>Email:</strong> hoanglongdoors@gmail.com</p><p>🌐 <strong>Website:</strong> hoanglongdoors.com</p>');
        setPaymentTerms(DEFAULT_CONS_PAYMENT_TERMS);
      } else if (activeTemplateTab === 'contract') {
        setContractTemplate(DEFAULT_CONS_CONTRACT_TEMPLATE);
      } else if (activeTemplateTab === 'acceptance') {
        setAcceptanceTemplate(DEFAULT_CONS_ACCEPTANCE_TEMPLATE);
      } else if (activeTemplateTab === 'liquidation') {
        setLiquidationTemplate(DEFAULT_CONS_LIQUIDATION_TEMPLATE);
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

  // --- THÔNG SỐ KHÁI TOÁN XÂY DỰNG SPREADSHEET ---
  const [localChieuDai, setLocalChieuDai] = useState<number>(0);
  const chieuDai = props.chieuDai !== undefined ? props.chieuDai : localChieuDai;
  const setChieuDai = props.setChieuDai || setLocalChieuDai;

  const [localChieuRong, setLocalChieuRong] = useState<number>(0);
  const chieuRong = props.chieuRong !== undefined ? props.chieuRong : localChieuRong;
  const setChieuRong = props.setChieuRong || setLocalChieuRong;

  const [localSoTang, setLocalSoTang] = useState<number>(0);
  const soTang = props.soTang !== undefined ? props.soTang : localSoTang;
  const setSoTang = props.setSoTang || setLocalSoTang;

  const [localSelectedHouseType, setLocalSelectedHouseType] = useState<string>('');
  const selectedHouseType = props.selectedHouseType !== undefined ? props.selectedHouseType : localSelectedHouseType;
  const setSelectedHouseType = props.setSelectedHouseType || setLocalSelectedHouseType;

  const [localDonGiaKhaiToan, setLocalDonGiaKhaiToan] = useState<number>(0);
  const donGiaKhaiToan = props.donGiaKhaiToan !== undefined ? props.donGiaKhaiToan : localDonGiaKhaiToan;
  const setDonGiaKhaiToan = props.setDonGiaKhaiToan || setLocalDonGiaKhaiToan;

  const [localNganSachNoiThat, setLocalNganSachNoiThat] = useState<number>(0);
  const nganSachNoiThat = props.nganSachNoiThat !== undefined ? props.nganSachNoiThat : localNganSachNoiThat;
  const setNganSachNoiThat = props.setNganSachNoiThat || setLocalNganSachNoiThat;

  const [localQuoteItems, setLocalQuoteItems] = useState<QuoteItem[]>([]);
  const quoteItems = props.quoteItems !== undefined ? props.quoteItems : localQuoteItems;
  const setQuoteItems = props.setQuoteItems || setLocalQuoteItems;

  const [isHouseDropdownOpen, setIsHouseDropdownOpen] = useState(false);
  const [houseTypeSearchQuery, setHouseTypeSearchQuery] = useState('');

  // Tự động cập nhật Đơn giá khái toán khi loại nhà thay đổi
  useEffect(() => {
    const matched = houseEstimatePrices.find(h => h.type === selectedHouseType);
    if (matched) {
      setDonGiaKhaiToan(matched.avgPrice);
    } else if (selectedHouseType === '') {
      setDonGiaKhaiToan(0);
    }
  }, [selectedHouseType, houseEstimatePrices]);

  // Save states reactively to sessionStorage for takeoff or integration
  useEffect(() => {
    sessionStorage.setItem('hl_construction_house_type', selectedHouseType);
    sessionStorage.setItem('hl_construction_chieu_dai', chieuDai.toString());
    sessionStorage.setItem('hl_construction_chieu_rong', chieuRong.toString());
    sessionStorage.setItem('hl_construction_so_tang', soTang.toString());
    sessionStorage.setItem('hl_construction_don_gia', donGiaKhaiToan.toString());
    sessionStorage.setItem('hl_construction_ngan_sach', nganSachNoiThat.toString());
    sessionStorage.setItem('hl_construction_items', JSON.stringify(quoteItems));
    sessionStorage.setItem('hl_construction_notes', quoteNotes);
    sessionStorage.setItem('hl_construction_payment_terms', paymentTerms);
    sessionStorage.setItem('hl_construction_config', JSON.stringify(config));
    sessionStorage.setItem('hl_construction_company_logo', companyLogoImg);
    sessionStorage.setItem('hl_construction_company_name', companyLogoText);
    sessionStorage.setItem('hl_construction_company_slogan', companySlogan);
    sessionStorage.setItem('hl_construction_company_address', companyAddressInfo);
    sessionStorage.setItem('hl_construction_company_contact', companyContactInfo);

    localStorage.setItem('hl_construction_company_logo', companyLogoImg);
    localStorage.setItem('hl_construction_company_name', companyLogoText);
    localStorage.setItem('hl_construction_company_slogan', companySlogan);
    localStorage.setItem('hl_construction_company_address', companyAddressInfo);
    localStorage.setItem('hl_construction_company_contact', companyContactInfo);
    localStorage.setItem('hl_construction_payment_terms', paymentTerms);

    localStorage.setItem('hl_construction_contract_template', contractTemplate);
    localStorage.setItem('hl_construction_acceptance_template', acceptanceTemplate);
    localStorage.setItem('hl_construction_liquidation_template', liquidationTemplate);
  }, [selectedHouseType, chieuDai, chieuRong, soTang, donGiaKhaiToan, nganSachNoiThat, quoteItems, quoteNotes, paymentTerms, config, companyLogoImg, companyLogoText, companySlogan, companyAddressInfo, companyContactInfo, contractTemplate, acceptanceTemplate, liquidationTemplate]);

  const [dbLoading, setDbLoading] = useState(false);
  const [dbSaving, setDbSaving] = useState(false);
  const [dbSaveSuccess, setDbSaveSuccess] = useState(false);
  const [dbSaveError, setDbSaveError] = useState<string | null>(null);

  // Load configuration from database on mount
  useEffect(() => {
    const fetchDbConfig = async () => {
      setDbLoading(true);
      try {
        // Load from 'construction_default' (matches the save key in handleSetAsDefault)
        const dbConfig = await dbService.quotationConfigs.get('construction_default');
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
        console.error("Lỗi khi tải cấu hình báo giá Xây dựng từ database:", e);
      } finally {
        setDbLoading(false);
      }
    };
    fetchDbConfig();
  }, []);

  // Load quote details reactively when loadedQuote changes from Quick Search
  useEffect(() => {
    if (loadedQuote) {
      if (loadedQuote.chieuDai !== undefined) setChieuDai(loadedQuote.chieuDai);
      if (loadedQuote.chieuRong !== undefined) setChieuRong(loadedQuote.chieuRong);
      if (loadedQuote.soTang !== undefined) setSoTang(loadedQuote.soTang);
      if (loadedQuote.selectedHouseType) setSelectedHouseType(loadedQuote.selectedHouseType);
      if (loadedQuote.donGiaKhaiToan !== undefined) setDonGiaKhaiToan(loadedQuote.donGiaKhaiToan);
      if (loadedQuote.nganSachNoiThat !== undefined) setNganSachNoiThat(loadedQuote.nganSachNoiThat);
      if (loadedQuote.items) setQuoteItems(loadedQuote.items);
      if (loadedQuote.notes) setQuoteNotes(loadedQuote.notes);
      if (loadedQuote.paymentTerms) setPaymentTerms(loadedQuote.paymentTerms);
      if (loadedQuote.config) setConfig(loadedQuote.config);
      if (loadedQuote.companyLogoImg !== undefined) setCompanyLogoImg(loadedQuote.companyLogoImg || '');
      if (loadedQuote.companyLogoText) setCompanyLogoText(loadedQuote.companyLogoText);
      if (loadedQuote.companySlogan) setCompanySlogan(loadedQuote.companySlogan);
      if (loadedQuote.companyAddressInfo) setCompanyAddressInfo(loadedQuote.companyAddressInfo);
      if (loadedQuote.companyContactInfo) setCompanyContactInfo(loadedQuote.companyContactInfo);
    }
  }, [loadedQuote]);

  const handleCalculateHouseEstimate = () => {
    if (isLocked) return;
    const matched = houseEstimatePrices.find(h => h.type === selectedHouseType);
    
    const singleFloorArea = chieuDai * chieuRong;
    const totalFloorArea = singleFloorArea * soTang;
    const totalBuildingBudget = totalFloorArea * donGiaKhaiToan;

    const items: QuoteItem[] = [
      {
        id: `est_1_${Date.now()}`,
        productGroup: 'custom',
        productName: 'Pháp lý & Tư vấn (phí thiết kế, giám sát, xin phép XD)',
        qty: 1,
        unit: 'Gói',
        unitPrice: Math.round(totalBuildingBudget * 0.02),
        totalPrice: Math.round(totalBuildingBudget * 0.02),
        notes: 'Phí CĐT 2021 = 0.5–2% GT XD | Giám sát = 1–2% GT XD',
        ratioPercent: '2%',
        pricingMethod: 'quick'
      },
      {
        id: `est_2_${Date.now()}`,
        productGroup: 'custom',
        productName: 'Chuẩn bị mặt bằng (san nền, đào móng, rào chắn, điện nước tạm)',
        qty: 1,
        unit: 'Gói',
        unitPrice: Math.round(totalBuildingBudget * 0.03),
        totalPrice: Math.round(totalBuildingBudget * 0.03),
        notes: 'Đào đất cơ giới 45k–80k/m³ | San nền cơ giới 25–50k/m³',
        ratioPercent: '3%',
        pricingMethod: 'quick'
      },
      {
        id: `est_3_${Date.now()}`,
        productGroup: 'custom',
        productName: 'Vật tư phần thô (móng, cột, dầm, sàn, tường gạch)',
        qty: 1,
        unit: 'Gói',
        unitPrice: Math.round(totalBuildingBudget * 0.35),
        totalPrice: Math.round(totalBuildingBudget * 0.35),
        notes: 'XM, cát, đá, thép, gạch – chiếm tỷ trọng lớn nhất',
        ratioPercent: '35%',
        pricingMethod: 'quick'
      },
      {
        id: `est_4_${Date.now()}`,
        productGroup: 'custom',
        productName: 'Vật tư hoàn thiện (trát, sơn, ốp lát, cửa, mái, chống thấm)',
        qty: 1,
        unit: 'Gói',
        unitPrice: Math.round(totalBuildingBudget * 0.30),
        totalPrice: Math.round(totalBuildingBudget * 0.30),
        notes: 'Gạch ốp lát, sơn, cửa, thiết bị vệ sinh, điện nước',
        ratioPercent: '30%',
        pricingMethod: 'quick'
      },
      {
        id: `est_5_${Date.now()}`,
        productGroup: 'custom',
        productName: 'Chi phí nhân công (toàn bộ hạng mục thi công)',
        qty: 1,
        unit: 'Gói',
        unitPrice: Math.round(totalBuildingBudget * 0.20),
        totalPrice: Math.round(totalBuildingBudget * 0.20),
        notes: 'Thợ xây, đổ BT, cốt thép, trát, lát, sơn, điện, nước',
        ratioPercent: '20%',
        pricingMethod: 'quick'
      },
      {
        id: `est_6_${Date.now()}`,
        productGroup: 'custom',
        productName: 'Máy móc & Phụ trợ (cầu, bơm BT, trộn, giàn giáo)',
        qty: 1,
        unit: 'Gói',
        unitPrice: Math.round(totalBuildingBudget * 0.03),
        totalPrice: Math.round(totalBuildingBudget * 0.03),
        notes: 'Thuê thiết bị 2–3% GT XD | Tăng với nhà cao tầng',
        ratioPercent: '3%',
        pricingMethod: 'quick'
      },
      {
        id: `est_7_${Date.now()}`,
        productGroup: 'custom',
        productName: 'Nội thất (theo ngân sách tùy chọn)',
        qty: 1,
        unit: 'Gói',
        unitPrice: nganSachNoiThat,
        totalPrice: nganSachNoiThat,
        notes: 'Nhập ngân sách nội thất ở trên',
        ratioPercent: 'Tùy chọn',
        pricingMethod: 'quick'
      },
      {
        id: `est_8_${Date.now()}`,
        productGroup: 'custom',
        productName: 'Quản lý, dự phòng & phát sinh (7%)',
        qty: 1,
        unit: 'Gói',
        unitPrice: Math.round(totalBuildingBudget * 0.07),
        totalPrice: Math.round(totalBuildingBudget * 0.07),
        notes: 'Phát sinh TK = 3–5% | Quản lý CĐT = 2–3% | Trượt giá = 2%',
        ratioPercent: '7%',
        pricingMethod: 'quick'
      }
    ];

    setQuoteItems(items);
    setFeedback({
      message: 'Tính toán phân bổ ngân sách thầu thành công!',
      type: 'success'
    });
    setTimeout(() => setFeedback(null), 3000);
  };

  // --- HỆ THỐNG THÊM SẢN PHẨM TỪ DANH MỤC TIÊU CHUẨN XÂY DỰNG ---
  const [catalogProducts, setCatalogProducts] = useState<ProductCatalogItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<ProductCatalogItem | null>(null);
  const [selectedPriceOption, setSelectedPriceOption] = useState<string>('');
  const [chosenPrice, setChosenPrice] = useState<number>(0);
  const [productQty, setProductQty] = useState<number>(1);
  const [searchCategoryQuery, setSearchCategoryQuery] = useState<string>('');
  const [searchProductQuery, setSearchProductQuery] = useState<string>('');
  const { addToast } = useNotification();
  const [customMaterial, setCustomMaterial] = useState<string>('');
  
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const [isProdDropdownOpen, setIsProdDropdownOpen] = useState(false);

  // --- ADD CUSTOM OTHER PRODUCT ---
  const [addMethod, setAddMethod] = useState<'catalog' | 'other'>('catalog');
  const [customProductOtherName, setCustomProductOtherName] = useState<string>('');
  const [customProductOtherQty, setCustomProductOtherQty] = useState<number>(1);
  const [customProductOtherUnitPrice, setCustomProductOtherUnitPrice] = useState<number>(1000000);

  // Nạp danh mục sản phẩm lĩnh vực Xây dựng
  useEffect(() => {
    const saved = localStorage.getItem('hl_acc_products');
    let loadedProducts = [];
    if (saved) {
      try {
        loadedProducts = JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    
    if (!Array.isArray(loadedProducts) || loadedProducts.length === 0) {
      loadedProducts = INITIAL_PRODUCTS;
      localStorage.setItem('hl_acc_products', JSON.stringify(INITIAL_PRODUCTS));
    } else {
      // Merge defaults if missing
      const hasConst = loadedProducts.some(p => p.linhVuc === 'Xây dựng');
      const hasMech = loadedProducts.some(p => p.linhVuc === 'Cơ khí');
      if (!hasConst || !hasMech) {
        const merged = [...loadedProducts];
        INITIAL_PRODUCTS.forEach(item => {
          if (!merged.some(m => m.id === item.id)) {
            merged.push(item);
          }
        });
        localStorage.setItem('hl_acc_products', JSON.stringify(merged));
        loadedProducts = merged;
      }
    }
    
    const domainProducts = loadedProducts.filter(p => p.linhVuc === 'Xây dựng');
    setCatalogProducts(domainProducts);
  }, []);

  const categories = Array.from(new Set(catalogProducts.map(p => p.danhMuc as string).filter(Boolean)));

  const [selectedMaterialOption, setSelectedMaterialOption] = useState<string>('');

  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0]);
    }
  }, [catalogProducts]);

  // Get all active linked prices for selectedProduct
  const getProductLinkedPrices = () => {
    if (!selectedProduct) return [];
    try {
      const savedPrices = localStorage.getItem('hl_acc_product_prices');
      if (!savedPrices) return [];
      const allPrices = JSON.parse(savedPrices);
      return allPrices.filter((pr: any) => pr.productId === selectedProduct.id);
    } catch (e) {
      return [];
    }
  };

  // Get all active linked materials for selectedProduct
  const getProductLinkedMaterials = () => {
    if (!selectedProduct) return [];
    try {
      const savedMaterials = localStorage.getItem('hl_acc_product_materials');
      if (!savedMaterials) return [];
      const allMaterials = JSON.parse(savedMaterials);
      return allMaterials.filter((m: any) => m.productId === selectedProduct.id);
    } catch (e) {
      return [];
    }
  };

  useEffect(() => {
    const probables = catalogProducts.filter(p => p.danhMuc === selectedCategory);
    if (probables.length > 0) {
      const defaultProd = probables[0];
      setSelectedProduct(defaultProd);
      
      let subPrices: any[] = [];
      try {
        const savedPrices = localStorage.getItem('hl_acc_product_prices');
        if (savedPrices) {
          const allPrices = JSON.parse(savedPrices);
          subPrices = allPrices.filter((pr: any) => pr.productId === defaultProd.id);
        }
      } catch (err) {
        console.error("Error loading product prices:", err);
      }
      
      if (subPrices.length > 0) {
        setSelectedPriceOption(subPrices[0].tenGia);
        setChosenPrice(subPrices[0].donGia);
      } else {
        setSelectedPriceOption('Tự chọn');
        setChosenPrice(0);
      }

      let subMats: any[] = [];
      try {
        const savedMaterials = localStorage.getItem('hl_acc_product_materials');
        if (savedMaterials) {
          const allMaterials = JSON.parse(savedMaterials);
          subMats = allMaterials.filter((m: any) => m.productId === defaultProd.id);
        }
      } catch (err) {
        console.error("Error loading product materials:", err);
      }

      if (subMats.length > 0) {
        setSelectedMaterialOption(subMats[0].tenChatLieu);
        setCustomMaterial(subMats[0].tenChatLieu);
      } else {
        setSelectedMaterialOption('Tự nhập');
        setCustomMaterial(defaultProd.chatLieu || '');
      }
    } else {
      setSelectedProduct(null);
      setCustomMaterial('');
      setChosenPrice(0);
      setSelectedMaterialOption('');
    }
  }, [selectedCategory, catalogProducts]);

  const handleProductSelect = (prod: any) => {
    setSelectedProduct(prod);
    setIsProdDropdownOpen(false);
    
    let subPrices: any[] = [];
    try {
      const savedPrices = localStorage.getItem('hl_acc_product_prices');
      if (savedPrices) {
        const allPrices = JSON.parse(savedPrices);
        subPrices = allPrices.filter((pr: any) => pr.productId === prod.id);
      }
    } catch (err) {
      console.error(err);
    }
    
    if (subPrices.length > 0) {
      setSelectedPriceOption(subPrices[0].tenGia);
      setChosenPrice(subPrices[0].donGia);
    } else {
      setSelectedPriceOption('Tự chọn');
      setChosenPrice(0);
    }

    let subMats: any[] = [];
    try {
      const savedMaterials = localStorage.getItem('hl_acc_product_materials');
      if (savedMaterials) {
        const allMaterials = JSON.parse(savedMaterials);
        subMats = allMaterials.filter((m: any) => m.productId === prod.id);
      }
    } catch (err) {
      console.error(err);
    }

    if (subMats.length > 0) {
      setSelectedMaterialOption(subMats[0].tenChatLieu);
      setCustomMaterial(subMats[0].tenChatLieu);
    } else {
      setSelectedMaterialOption('Tự nhập');
      setCustomMaterial(prod.chatLieu || '');
    }
  };

  const handlePriceOptionChange = (option: string) => {
    setSelectedPriceOption(option);
    if (!selectedProduct) return;
    if (option === 'Tự chọn') return;
    
    try {
      const savedPrices = localStorage.getItem('hl_acc_product_prices');
      if (savedPrices) {
        const allPrices = JSON.parse(savedPrices);
        const match = allPrices.find((pr: any) => pr.productId === selectedProduct.id && pr.tenGia === option);
        if (match) {
          setChosenPrice(match.donGia);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMaterialOptionChange = (option: string) => {
    setSelectedMaterialOption(option);
    if (option === 'Tự nhập') return;
    setCustomMaterial(option);
  };

  const handleAddProductToQuote = () => {
    if (!selectedProduct) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng chọn sản phẩm trước!', type: 'warning' });
      return;
    }
    
    const newItem: QuoteItem = {
      id: `qi_prod_${Date.now()}`,
      productGroup: 'custom',
      productName: selectedProduct.tenSanPham,
      qty: productQty,
      material: customMaterial,
      unit: selectedProduct.donVi || 'Mét vuông',
      unitPrice: chosenPrice,
      pricingMethod: 'quick',
      totalPrice: productQty * chosenPrice
    };
    
    setQuoteItems(prev => [...prev, newItem]);
    setProductQty(1);
    
    setFeedback({
      message: `Đã thêm hạng mục công tác "${selectedProduct.tenSanPham}" vào báo giá thành công!`,
      type: 'success'
    });
    setTimeout(() => setFeedback(null), 3000);
  };

  // Tính tiền thô của 1 hạng mục bất kỳ
  const calculateItemPrice = (item: Partial<QuoteItem>, currentConfig: QuoteConfig): number => {
    if (item.pricingMethod === 'quick') {
      return (item.unitPrice || 0) * (item.qty || 1);
    } else {
      const baseWoodCost = (item.boardPanelsQty || 0) * (item.boardPanelUnitPrice || 0);
      const accCost = item.accessoryCost || 0;
      
      const woodWithWastage = baseWoodCost * (1 + currentConfig.wastagePercent / 100);
      const totalHardware = accCost * (1 + currentConfig.accessoryPercent / 100);
      
      const primeCost = woodWithWastage + totalHardware;
      
      const laborCost = primeCost * (currentConfig.laborPercent / 100);
      const generalCost = primeCost * (currentConfig.generalPercent / 100);
      const profitCost = primeCost * (currentConfig.profitPercent / 100);
      
      return Math.round((primeCost + laborCost + generalCost + profitCost) * (item.qty || 1));
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

  const handleRemoveItem = (id: string) => {
    if (isLocked) return;
    setQuoteItems(quoteItems.filter(item => item.id !== id));
  };

  const handleAddCustomOtherProduct = () => {
    if (isLocked) return;
    if (!customProductOtherName.trim()) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng nhập tên công tác!', type: 'warning' });
      return;
    }

    const newItem: any = {
      id: `item_custom_${Date.now()}`,
      productName: customProductOtherName.trim(),
      productGroup: 'custom',
      qty: customProductOtherQty,
      unit: 'gói',
      unitPrice: customProductOtherUnitPrice,
      totalPrice: customProductOtherQty * customProductOtherUnitPrice,
      material: 'Chủ đầu tư chỉ định',
      pricingMethod: 'quick',
      notes: ''
    };

    setQuoteItems([...quoteItems, newItem]);
    
    setCustomProductOtherName('');
    setCustomProductOtherQty(1);
    setCustomProductOtherUnitPrice(1000000);
  };

  const handleSendToProject = () => {
    if (!selectedProjectId) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng chọn hoặc liên kết dự án trước khi gửi báo giá!', type: 'warning' });
      return;
    }
    if (quoteItems.length === 0) {
      addToast({ title: '⚠️ Báo giá trống', message: 'Báo giá của bạn đang trống! Vui lòng thêm ít nhất một công tác.', type: 'warning' });
      return;
    }

    const targetProject = projects?.find(p => p.id === selectedProjectId);
    if (!targetProject) {
      addToast({ title: '❌ Lỗi', message: 'Không tìm thấy thông tin dự án!', type: 'error' });
      return;
    }

    const confirmSend = window.confirm(`Bạn có chắc chắn muốn liên thông gửi bảng dữ liệu báo giá này trực tiếp sang dự án "${targetProject.name}"?\nHành động này sẽ ghi đè tài liệu báo giá liên kết chính thức của dự án này.`);
    if (!confirmSend) return;

    const itemCode = `BGXD-HL-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const pdfName = `Bao_gia_Xay_dung_${(customerName || 'Khach_hang').trim().replace(/\s+/g, '_')}.pdf`;

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
          action: 'Đã tự động gửi thông tin hồ sơ báo giá xây thô lên dự án liên thông',
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
          discountPercent: config.discountPercent,
          items: quoteItems,
          customerName: customerName || 'Khách hàng',
          customerPhone: customerPhone || 'Chưa cung cấp',
          customerAddress: customerAddress || 'Chưa cung cấp',
          paymentTerms: paymentTerms,
          quoteNotes: quoteNotes,
          companyLogoImg: companyLogoImg,
          companyLogoText: companyLogoText,
          companySlogan: companySlogan,
          companyAddressInfo: companyAddressInfo,
          companyContactInfo: companyContactInfo,
          code: itemCode,
          content: `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nBẢNG BÁO GIÁ CHI TIẾT THI CÔNG XÂY DỰNG NĂM 2026\n--------------------------------------\nSố báo giá: ${itemCode}\nKhách hàng: ${customerName || 'Khách hàng'}\nSố điện thoại: ${customerPhone || 'Không có'}\nĐịa chỉ: ${customerAddress || 'Không có'}\nDự án liên kết: ${p.name}\n\nDANH SÁCH HẠNG MỤC CÔNG TÁC SƠ BỘ:\n${quoteItems.map((item, index) => `${index + 1}. ${item.productName} - Số lượng: ${item.qty} - Thành tiền: ${item.totalPrice.toLocaleString('vi-VN')} đ`).join('\n')}\n\n--------------------------------------\nTỔNG CỘNG CHƯA CHIẾT KHẤU: ${subtotal.toLocaleString('vi-VN')} đ\nCHIẾT KHẤU GIẢM GIÁ (${config.discountPercent}%): -${discountVal.toLocaleString('vi-VN')} đ\nTỔNG GIÁ TRỊ THÔ: ${totalQuoteAmount.toLocaleString('vi-VN')} đ\nVAT (${vatPercent}%): ${vatAmount.toLocaleString('vi-VN')} đ\nTỔNG GIÁ TRỊ TOÀN BỘ (ĐÃ BAO GỒM VAT): ${totalWithVat.toLocaleString('vi-VN')} đ\n\nNơi nhận: Khách hàng\nĐại diện bàn giao báo giá.`
        };

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
      message: `Đã gửi file dự toán thầu dạng PDF thành công vào trường Báo giá của dự án "${targetProject.name}"${taskUpdatedCount > 0 ? ` và cập nhật hoàn tất ${taskUpdatedCount} công việc con liên quan!` : ''}!`,
      type: 'success'
    });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Tổng cộng hóa đơn
  const subtotal = quoteItems.reduce((acc, i) => acc + i.totalPrice, 0);
  const discountVal = subtotal * (config.discountPercent / 100);
  const totalQuoteAmount = subtotal - discountVal;
  const vatPercent = config.vatPercent !== undefined ? config.vatPercent : 8;
  const vatAmount = totalQuoteAmount * (vatPercent / 100);
  const totalWithVat = totalQuoteAmount + vatAmount;

  const handleSaveQuote = async () => {
    if (!loadedQuote && selectedProjectId) {
      try {
        const archivedList = await dbService.archivedQuotes.list('construction');
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
      const matchedHouse = houseEstimatePrices.find(h => h.type === selectedHouseType);
      const takeoffLocal = sessionStorage.getItem('takeoff_rows') || localStorage.getItem('takeoff_rows');
      const takeoffRows = takeoffLocal ? JSON.parse(takeoffLocal) : [];
      
      const quoteId = loadedQuote ? loadedQuote.id : `archived_quote_${Date.now()}`;
      const quoteCode = loadedQuote ? loadedQuote.code : `BGXD-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`;

      const generatedQuote: Quote = {
        id: quoteId,
        code: quoteCode,
        customerId: finalCustomerId,
        projectId: selectedProjectId || undefined,
        projectName: projectName.trim(),
        chieuDai: chieuDai,
        chieuRong: chieuRong,
        soTang: soTang,
        selectedHouseType: selectedHouseType,
        donGiaKhaiToan: donGiaKhaiToan,
        nganSachNoiThat: nganSachNoiThat,
        features: matchedHouse?.features || '',
        minPrice: matchedHouse?.minPrice || 0,
        maxPrice: matchedHouse?.maxPrice || 0,
        dienTichSan: chieuDai * chieuRong,
        tongDienTichXayDung: chieuDai * chieuRong * soTang,
        date: new Date().toISOString().split('T')[0],
        items: quoteItems,
        config: config,
        status: 'draft',
        notes: quoteNotes,
        paymentTerms: paymentTerms,
        companyLogoImg: companyLogoImg,
        companyLogoText: companyLogoText,
        companySlogan: companySlogan,
        companyAddressInfo: companyAddressInfo,
        companyContactInfo: companyContactInfo,
        customerName: customerName.trim() || 'Khách mới',
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        takeoffRows: takeoffRows,
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
        creatorId: currentUser?.id || 'emp_1',
        creatorName: currentUser?.name || 'Nhân viên Báo giá',
        sector: 'construction',
        createdAt: loadedQuote?.createdAt || new Date().toLocaleDateString('vi-VN'),
        totalAmount: totalQuoteAmount
      };

      try {
        await dbService.archivedQuotes.save({ ...archivedRecord, sector: 'construction' });
        if (setIsConstructionSaved) setIsConstructionSaved(true);
        if (setIsLocked) setIsLocked(true);
        if (setLoadedQuote) setLoadedQuote(archivedRecord);
        
        // Dispatch custom event to trigger reloading of search dropdown
        window.dispatchEvent(new CustomEvent('hl-archived-quotes-updated'));

        setFeedback({
          message: `Đã lưu thành công hồ sơ dự toán thầu ${generatedQuote.code} vào cơ sở dữ liệu!`,
          type: 'success'
        });
        setTimeout(() => setFeedback(null), 5000);
      } catch (err) {
        console.error("Lỗi lưu trữ hồ sơ:", err);
        addToast({ title: '❌ Lỗi', message: 'Lỗi khi lưu trữ hồ sơ báo giá.', type: 'error' });
      }
    }
  };

  // Giả lập xuất tập tin sang máy người dùng
  const triggerExport = (type: 'pdf' | 'excel') => {
    const activeCustomerName = customerName || 'Khách hàng thầu';
    const filename = `Du_toan_Xay_dung_${activeCustomerName.replace(/\s+/g, '_')}_2026.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
    
    const element = document.createElement("a");
    const file = new Blob([`EXPORT FILE ${type.toUpperCase()}: HOÀNG LONG INTERNAL ERP\n====================\nKhách thầu: ${activeCustomerName}\nGiấy tờ: Báo giá thi công xây thô\nTổng cộng: ${totalQuoteAmount.toLocaleString('vi-VN')} VND\nThời gian: 2026-06-06`], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    setFeedback({
      message: `Đã hoàn tất trích xuất tập tin file ${type.toUpperCase()} dự toán tự động: ${filename}`,
      type: 'success'
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  if (showTemplateOnly) {
    return (
      <div className="space-y-6 text-left" id="construction_template_panel">
        {/* Tab selection */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-slate-200 pb-1 gap-4">
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => setActiveTemplateTab('quote')}
              className={`text-xs font-extrabold uppercase tracking-wider relative pb-3 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTemplateTab === 'quote' 
                  ? 'text-indigo-600 border-b-2 border-indigo-600' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              📝 Mẫu báo giá
            </button>
            <button
              type="button"
              onClick={() => setActiveTemplateTab('contract')}
              className={`text-xs font-extrabold uppercase tracking-wider relative pb-3 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTemplateTab === 'contract' 
                  ? 'text-indigo-600 border-b-2 border-indigo-600' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              📜 Mẫu hợp đồng
            </button>
            <button
              type="button"
              onClick={() => setActiveTemplateTab('acceptance')}
              className={`text-xs font-extrabold uppercase tracking-wider relative pb-3 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTemplateTab === 'acceptance' 
                  ? 'text-indigo-600 border-b-2 border-indigo-600' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              📋 Mẫu nghiệm thu
            </button>
            <button
              type="button"
              onClick={() => setActiveTemplateTab('liquidation')}
              className={`text-xs font-extrabold uppercase tracking-wider relative pb-3 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTemplateTab === 'liquidation' 
                  ? 'text-indigo-600 border-b-2 border-indigo-600' 
                  : 'text-slate-500 hover:text-slate-800'
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
                  ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 cursor-pointer active:scale-95'
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
                  ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 cursor-pointer active:scale-95'
              }`}
            >
              🔄 Khôi phục mặc định
            </button>
          </div>
        </div>

        {activeTemplateTab === 'quote' && (
          <>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="mb-6">
                <h4 className="font-extrabold text-base text-indigo-700 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-indigo-600 animate-pulse"></span>
                  Cấu hình Header Báo giá (Logo & Doanh nghiệp) - Xây Dựng
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Những thay đổi này tự động lưu trữ và áp dụng trực tiếp khi lập báo giá hoặc xuất PDF cho lĩnh vực Xây Dựng.
                </p>
              </div>
              
              <div className="grid grid-cols-1 gap-6">
                {/* Logo Uploader */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row items-center gap-6">
                  <div className="shrink-0 text-center">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Logo Hiện Tại</label>
                    <div className="w-20 h-20 bg-white border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden shadow-inner">
                      {companyLogoImg ? (
                        <img 
                          src={companyLogoImg} 
                          referrerPolicy="no-referrer" 
                          className="w-full h-full object-contain" 
                          alt="Company Logo" 
                        />
                      ) : (
                        <div className="text-[10px] text-slate-400 font-semibold px-2">Mặc định (SVG)</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grow w-full text-center md:text-left space-y-2">
                    <label className="block text-slate-700 font-extrabold text-xs">Thay đổi Logo Doanh nghiệp</label>
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
                        id="company-logo-input-construction-tmpl"
                      />
                      <label 
                        htmlFor={isTemplateEditable ? "company-logo-input-construction-tmpl" : undefined}
                        className={`px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 ${
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
                          className={`px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            !isTemplateEditable ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
                          }`}
                        >
                          Xóa logo tùy biến
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">Hỗ trợ các định dạng PNG, JPG, WEBP. Ảnh tự động chuyển thành Base64 lưu trữ offline.</p>
                  </div>
                </div>

                {/* Tên & Slogan */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 font-extrabold text-xs mb-1.5">Tên doanh nghiệp / Logo chữ</label>
                    <input 
                      type="text"
                      value={companyLogoText}
                      disabled={!isTemplateEditable}
                      onChange={(e) => setCompanyLogoText(e.target.value)}
                      className="w-full text-xs p-3 border border-slate-200 bg-white text-slate-800 rounded-lg outline-none focus:border-indigo-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Ví dụ: HOANG LONG"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-extrabold text-xs mb-1.5">Slogan / Lĩnh vực hoạt động</label>
                    <input 
                      type="text"
                      value={companySlogan}
                      disabled={!isTemplateEditable}
                      onChange={(e) => setCompanySlogan(e.target.value)}
                      className="w-full text-xs p-3 border border-slate-200 bg-white text-slate-800 rounded-lg outline-none focus:border-indigo-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Ví dụ: Construction - Furniture - Doors"
                    />
                  </div>
                </div>

                {/* Địa chỉ & Liên hệ Rich Texts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 font-extrabold text-xs mb-1.5">Thông tin Địa chỉ</label>
                    <RichTextEditor
                      value={companyAddressInfo}
                      onChange={(html) => setCompanyAddressInfo(html)}
                      disabled={!isTemplateEditable}
                      themeColor="indigo"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-extrabold text-xs mb-1.5">Thông tin Liên hệ (Hotline/Email/Web)</label>
                    <RichTextEditor
                      value={companyContactInfo}
                      onChange={(html) => setCompanyContactInfo(html)}
                      disabled={!isTemplateEditable}
                      themeColor="indigo"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Thông tin điều khoản và lưu ý tùy biến */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="mb-4">
                <h4 className="font-extrabold text-base text-indigo-700 uppercase tracking-wider flex items-center gap-2">
                  📝 Điều khoản & Ghi chú Báo giá Xây Dựng
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Soạn thảo điều khoản thanh toán, phương thức đặt cọc, thông tin tài khoản ngân hàng và chính sách bảo hành mặc định cho hồ sơ Xây Dựng.
                </p>
              </div>
              
              <RichTextEditor
                value={paymentTerms}
                onChange={(html) => setPaymentTerms(html)}
                disabled={!isTemplateEditable}
                themeColor="indigo"
              />
            </div>
          </>
        )}

        {activeTemplateTab === 'contract' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="mb-2 border-b border-slate-200 pb-4">
              <h4 className="font-extrabold text-base text-indigo-700 uppercase tracking-wider">
                📜 Soạn thảo Mẫu Hợp đồng Thi công Xây Dựng
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Cho phép tùy chỉnh nội dung hợp đồng kinh tế lĩnh vực xây dựng và hoàn thiện kiến trúc. Các biến màu đỏ sẽ tự động thay bằng dữ liệu thực tế khi xuất in.
              </p>
            </div>
            
            <div className="grid grid-cols-12 gap-6 mt-4">
              <div className="col-span-12 lg:col-span-8">
                <RichTextEditor
                  value={contractTemplate}
                  onChange={(html) => setContractTemplate(html)}
                  disabled={!isTemplateEditable}
                  themeColor="indigo"
                />
              </div>
              <div className="col-span-12 lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-4 self-start">
                <h5 className="font-bold text-xs text-indigo-700 uppercase tracking-wider mb-2">
                  Hướng dẫn chèn biến (Placeholders)
                </h5>
                <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">
                  Sao chép các mã bên dưới dán vào bất kỳ vị trí nào trong hợp đồng. Hệ thống sẽ tự động thay bằng dữ liệu thực tế của dự án và bôi đỏ nổi bật khi in ấn:
                </p>
                <div className="space-y-2 text-xs max-h-96 overflow-y-auto pr-1">
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{SO_HOP_DONG}}"}</code>
                    <span className="text-slate-500 text-[10px]">Số hợp đồng (mã dự án)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{CONG_TRINH}}"}</code>
                    <span className="text-slate-500 text-[10px]">Tên công trình</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{DIA_DIEM}}"}</code>
                    <span className="text-slate-500 text-[10px]">Địa chỉ công trình</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{NGAY}}"}</code>
                    <span className="text-slate-500 text-[10px]">Ngày lập</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{TEN_KHACH_HANG}}"}</code>
                    <span className="text-slate-500 text-[10px]">Tên khách hàng</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{DIA_CHI_KHACH_HANG}}"}</code>
                    <span className="text-slate-500 text-[10px]">Địa chỉ khách hàng</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{DIEN_THOAI_KHACH_HANG}}"}</code>
                    <span className="text-slate-500 text-[10px]">SĐT khách hàng</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{TONG_CONG}}"}</code>
                    <span className="text-slate-500 text-[10px]">Tổng cộng (số)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{TONG_CONG_CHU}}"}</code>
                    <span className="text-slate-500 text-[10px]">Tổng tiền bằng chữ</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{BANG_CHI_TIET_BÁO_GIÁ}}"}</code>
                    <span className="text-slate-500 text-[10px]">Bảng phụ lục khối lượng</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{NGAY_KHOI_CONG}}"}</code>
                    <span className="text-slate-500 text-[10px]">Ngày khởi công</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{NGAY_HOAN_THANH}}"}</code>
                    <span className="text-slate-500 text-[10px]">Ngày hoàn thành</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTemplateTab === 'acceptance' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="mb-2 border-b border-slate-200 pb-4">
              <h4 className="font-extrabold text-base text-indigo-700 uppercase tracking-wider">
                📋 Soạn thảo Mẫu Biên bản Nghiệm thu Bàn giao Xây Dựng
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Cho phép tùy chỉnh nội dung biên bản nghiệm thu kỹ thuật và bàn giao công trình xây dựng cho khách hàng.
              </p>
            </div>
            
            <div className="grid grid-cols-12 gap-6 mt-4">
              <div className="col-span-12 lg:col-span-8">
                <RichTextEditor
                  value={acceptanceTemplate}
                  onChange={(html) => setAcceptanceTemplate(html)}
                  disabled={!isTemplateEditable}
                  themeColor="indigo"
                />
              </div>
              <div className="col-span-12 lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-4 self-start">
                <h5 className="font-bold text-xs text-indigo-700 uppercase tracking-wider mb-2">
                  Hướng dẫn chèn biến (Placeholders)
                </h5>
                <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">
                  Sao chép các mã bên dưới dán vào bất kỳ vị trí nào trong nghiệm thu:
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{SO_NGHIEM_THU}}"}</code>
                    <span className="text-slate-500 text-[10px]">Số biên bản nghiệm thu</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{SO_HOP_DONG}}"}</code>
                    <span className="text-slate-500 text-[10px]">Số hợp đồng (mã dự án)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{CONG_TRINH}}"}</code>
                    <span className="text-slate-500 text-[10px]">Tên công trình</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{DIA_DIEM}}"}</code>
                    <span className="text-slate-500 text-[10px]">Địa chỉ công trình</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{NGAY}}"}</code>
                    <span className="text-slate-500 text-[10px]">Ngày lập</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{TEN_KHACH_HANG}}"}</code>
                    <span className="text-slate-500 text-[10px]">Tên khách hàng</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{BANG_CHI_TIET_BÁO_GIÁ}}"}</code>
                    <span className="text-slate-500 text-[10px]">Bảng chi tiết khối lượng</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTemplateTab === 'liquidation' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="mb-2 border-b border-slate-200 pb-4">
              <h4 className="font-extrabold text-base text-indigo-700 uppercase tracking-wider">
                🤝 Soạn thảo Mẫu Biên bản Thanh lý Hợp đồng Xây Dựng
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Cho phép tùy chỉnh nội dung biên bản thanh lý tài chính và tất toán hợp đồng thi công xây dựng.
              </p>
            </div>
            
            <div className="grid grid-cols-12 gap-6 mt-4">
              <div className="col-span-12 lg:col-span-8">
                <RichTextEditor
                  value={liquidationTemplate}
                  onChange={(html) => setLiquidationTemplate(html)}
                  disabled={!isTemplateEditable}
                  themeColor="indigo"
                />
              </div>
              <div className="col-span-12 lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-4 self-start">
                <h5 className="font-bold text-xs text-indigo-700 uppercase tracking-wider mb-2">
                  Hướng dẫn chèn biến (Placeholders)
                </h5>
                <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">
                  Sao chép các mã bên dưới dán vào bất kỳ vị trí nào trong thanh lý:
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{SO_THANH_LY}}"}</code>
                    <span className="text-slate-500 text-[10px]">Số biên bản thanh lý</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{SO_HOP_DONG}}"}</code>
                    <span className="text-slate-500 text-[10px]">Số hợp đồng (mã dự án)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{SO_NGHIEM_THU}}"}</code>
                    <span className="text-slate-500 text-[10px]">Số nghiệm thu</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{NGAY_NGHIEM_THU}}"}</code>
                    <span className="text-slate-500 text-[10px]">Ngày nghiệm thu bàn giao</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{TEN_KHACH_HANG}}"}</code>
                    <span className="text-slate-500 text-[10px]">Tên khách hàng</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{TONG_CONG}}"}</code>
                    <span className="text-slate-500 text-[10px]">Khối lượng quyết toán</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <code className="text-indigo-600 select-all font-mono">{"{{TONG_CONG_CHU}}"}</code>
                    <span className="text-slate-500 text-[10px]">Tổng tiền thanh lý bằng chữ</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Success Alert Banner indicating autosave is active */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50 border border-slate-200 p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="flex h-2.5 w-2.5 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600"></span>
            </span>
            <div>
              <span className="font-bold text-indigo-700">Chế độ tự động lưu cục bộ đang hoạt động:</span> Thay đổi được lưu vào trình duyệt này. Để đồng bộ và dùng chung cho toàn bộ ứng dụng trên các thiết bị khác nhau, vui lòng bấm nút lưu lên Cơ sở dữ liệu đám mây.
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsTemplateEditable(!isTemplateEditable)}
              className={`w-full sm:w-auto px-5 py-3 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95 ${
                isTemplateEditable 
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/50'
                  : 'bg-indigo-600/15 text-indigo-700 hover:bg-indigo-600/25 border border-indigo-500/30'
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
                  await dbService.quotationConfigs.save('construction', {
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
                  console.error("Lỗi khi lưu cấu hình Xây dựng lên database:", e);
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
                  ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed pointer-events-none'
                  : 'bg-indigo-650 hover:bg-indigo-600 text-white'
              }`}
            >
              <Save className={`w-4 h-4 ${dbSaving ? 'animate-spin' : ''}`} />
              {dbSaving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </div>

        {dbSaveSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl text-xs flex items-center gap-3 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold">Lưu thành công:</span> Cấu hình mẫu báo giá Xây dựng đã được lưu vào hệ thống cơ sở dữ liệu đám mây và đồng bộ hóa thành công trên toàn ứng dụng!
            </div>
          </div>
        )}
        {dbSaveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs flex items-center gap-3 animate-fadeIn">
            <XCircle className="w-4 h-4 text-red-600 shrink-0" />
            <div>
              <span className="font-bold">Lỗi lưu:</span> {dbSaveError}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left" id="const_quote_estimator_panel">
      {feedback && (
        <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 p-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-md relative overflow-hidden" id="const_estimator_feedback">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>
          <span className="pl-2">{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-emerald-600 font-black hover:text-emerald-950 px-2 cursor-pointer transition-colors">✕</button>
        </div>
      )}

      {/* Bảng báo giá (Ngang rộng rãi phía dưới) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-md p-5 flex flex-col justify-between space-y-4 text-slate-800" id="const_quotation_analysis_panel">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-2 gap-2">
              <span className="font-extrabold text-slate-900 text-sm tracking-wide">BẢNG BÁO GIÁ THI CÔNG XÂY DỰNG</span>
            </div>

            {/* Thông tin metadata của Báo giá */}
            {!hideMetadataHeader ? (
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200 text-xs text-left">
                {/* Dự án (searchable custom selection) */}
                <div className="relative">
                  <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1">Dự Án <span className="text-rose-500 font-bold">*</span></label>
                  
                  {/* Searchable Custom Trigger Button */}
                  <button
                    type="button"
                    onClick={() => setIsProjDropdownOpen(!isProjDropdownOpen)}
                    className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg p-2.5 outline-none font-medium text-left hover:border-slate-350 focus:border-indigo-500 transition-all flex items-center justify-between shadow-sm cursor-pointer animate-none"
                  >
                    <span className="truncate font-semibold">
                      {selectedProjectId ? (
                        (() => {
                          const activeProj = projects.find(p => p.id === selectedProjectId);
                          return activeProj ? `${activeProj.name}` : selectedProjectId;
                        })()
                      ) : (
                        <span className="text-amber-600 font-bold">Báo giá Độc lập</span>
                      )}
                    </span>
                    <Sliders className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-2" />
                  </button>

                  {/* Dropdown Popup Panel */}
                  {isProjDropdownOpen && (
                    <div className="absolute left-0 mt-1.5 w-72 md:w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 z-55 max-h-72 overflow-y-auto">
                      {/* Search Field inside */}
                      <div className="relative mb-2">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onClick={(e) => e.stopPropagation()} // stop close dropdown
                          className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-indigo-500 font-medium placeholder-slate-400 transition-all"
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
                          className="w-full text-left px-2.5 py-2 hover:bg-rose-50 text-coral-600 font-bold border border-coral-200 rounded-lg text-xs mb-2 transition-colors block"
                        >
                          ❌ Báo giá Độc lập (Nhập tay tên dự án)
                        </button>

                        <div className="text-[9px] uppercase font-bold text-slate-500 px-2.5 py-1">
                          Dự án Đang Làm (Xây dựng)
                        </div>

                        {(() => {
                          const activeProjects = projects.filter(p => p.type === 'construction');
                          const matches = activeProjects.filter(p => 
                            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.code.toLowerCase().includes(searchQuery.toLowerCase())
                          );

                          if (matches.length === 0) {
                            return (
                              <div className="text-center py-3 text-[11px] text-slate-500 italic">
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
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-300 font-bold' 
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                              >
                                <div className="font-bold text-slate-800 text-left flex items-center justify-between">
                                    <span>{p.name}</span>
                                    {hasArchive && (
                                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-black border border-indigo-200">
                                        📁 ĐÃ CÓ HS
                                      </span>
                                    )}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate text-left">{p.code}</div>
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
                  <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1">Tên Dự án <span className="text-rose-500 font-bold">*</span></label>
                  <input
                    type="text"
                    value={projectName}
                    disabled={!!selectedProjectId}
                    onChange={(e) => setProjectName(e.target.value)}
                    className={`w-full rounded-lg p-2.5 border text-xs font-semibold shadow-sm transition-all outline-none ${
                      selectedProjectId 
                        ? "bg-slate-50 border-slate-200 text-slate-550 cursor-not-allowed border-dashed" 
                        : "bg-white border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    }`}
                    placeholder={selectedProjectId ? "" : "Nhập tên Dự án thầu... *"}
                  />
                </div>

                {/* Tên khách hàng */}
                <div className="relative">
                  <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1">Tên Chủ Đầu Tư <span className="text-rose-500 font-bold">*</span></label>
                  
                  <button
                    type="button"
                    onClick={() => setIsCustDropdownOpen(!isCustDropdownOpen)}
                    className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg p-2.5 outline-none font-semibold text-xs text-left hover:border-slate-350 focus:border-indigo-500 transition-all flex items-center justify-between shadow-sm cursor-pointer"
                  >
                    <span className="truncate">
                      {customerName || <span className="text-slate-400 font-normal">Chọn chủ thầu từ danh sách *</span>}
                    </span>
                    <span className="text-[10px] text-slate-400">▼</span>
                  </button>

                  {/* Dropdown list of customers */}
                  {isCustDropdownOpen && (
                    <div className="absolute left-0 mt-1.5 w-72 md:w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 z-55 max-h-72 overflow-y-auto">
                      <div className="relative mb-2">
                        <input
                          type="text"
                          value={custSearchQuery}
                          onChange={(e) => setCustSearchQuery(e.target.value)}
                          onClick={(e) => e.stopPropagation()} // stop close dropdown
                          className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-indigo-500 font-medium placeholder-slate-400 transition-all"
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
                                Chưa có chủ thầu khớp
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
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-250 font-bold' 
                                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                              }`}
                            >
                              <div className="font-bold text-slate-800 text-left">{c.name}</div>
                              <div className="text-[10px] text-slate-500 text-left">
                                SĐT: {c.phone} | {c.address}
                              </div>
                            </button>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                  
                  {/* Nút tạo khách hàng nhanh */}
                  <div className="mt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowQuickCreateCust(true)}
                      className="text-[10px] text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-0.5 cursor-pointer hover:underline"
                    >
                      ➕ Tạo khách hàng nhanh
                    </button>
                  </div>
                </div>

                {/* Số điện thoại */}
                <div>
                  <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1">Số điện thoại <span className="text-rose-500 font-bold">*</span></label>
                  <input
                    type="text"
                    value={customerPhone}
                    disabled={true}
                    className="w-full rounded-lg p-2.5 border border-slate-200 text-slate-550 bg-slate-50 cursor-not-allowed font-semibold text-xs border-dashed"
                    placeholder="Chọn chủ thầu để lấy SĐT *"
                  />
                </div>

                {/* Địa chỉ */}
                <div>
                  <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1">Địa chỉ thi công <span className="text-rose-500 font-bold">*</span></label>
                  <input
                    type="text"
                    value={customerAddress}
                    disabled={true}
                    className="w-full rounded-lg p-2.5 border border-slate-200 text-slate-550 bg-slate-50 cursor-not-allowed font-semibold text-xs border-dashed"
                    placeholder="Chọn chủ thầu để lấy địa chỉ *"
                  />
                </div>

                {/* Chiết khấu (%) */}
                <div>
                  <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1 flex items-center justify-between">
                    <span>Chiết khấu thầu (%)</span>
                    <span className="text-indigo-600 font-black text-[8px] bg-indigo-50 px-1 hover:bg-indigo-100 rounded border border-indigo-200 flex items-center gap-0.5">
                      % GIẢM
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={config.discountPercent}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                      handleConfigChange('discountPercent', val);
                    }}
                    className="w-full bg-white rounded-lg p-2.5 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-semibold transition-all font-mono"
                    placeholder="Nhập % chiết khấu..."
                  />
                </div>

                {/* Thuế VAT (%) */}
                <div>
                  <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1 flex items-center justify-between">
                    <span>Thuế VAT (%)</span>
                    <span className="text-indigo-600 font-black text-[8px] bg-indigo-50 px-1 hover:bg-indigo-100 rounded border border-indigo-200 flex items-center gap-0.5">
                      % VAT
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={config.vatPercent !== undefined ? config.vatPercent : 8}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                      handleConfigChange('vatPercent', val);
                    }}
                    className="w-full bg-white rounded-lg p-2.5 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-semibold transition-all font-mono"
                    placeholder="Nhập % thuế VAT..."
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row justify-end items-center gap-4 mb-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200 text-xs w-full">
                <div className="w-full sm:w-[180px] text-left">
                  <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1 flex items-center justify-between">
                    <span>Chiết khấu thầu (%)</span>
                    <span className="text-indigo-600 font-black text-[8px] bg-indigo-50 px-1 hover:bg-indigo-100 rounded border border-indigo-200 flex items-center gap-0.5">
                      % GIẢM
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={config.discountPercent}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                      handleConfigChange('discountPercent', val);
                    }}
                    className="w-full bg-white rounded-lg p-2.5 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-semibold transition-all font-mono"
                    placeholder="Nhập % chiết khấu..."
                  />
                </div>

                <div className="w-full sm:w-[180px] text-left">
                  <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1 flex items-center justify-between">
                    <span>Thuế VAT (%)</span>
                    <span className="text-indigo-600 font-black text-[8px] bg-indigo-50 px-1 hover:bg-indigo-100 rounded border border-indigo-200 flex items-center gap-0.5">
                      % VAT
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={config.vatPercent !== undefined ? config.vatPercent : 8}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                      handleConfigChange('vatPercent', val);
                    }}
                    className="w-full bg-white rounded-lg p-2.5 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-semibold transition-all font-mono"
                    placeholder="Nhập % thuế VAT..."
                  />
                </div>
              </div>
            )}

            {/* THÊM CÔNG TÁC XÂY DỰNG FORM */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6 relative z-40">
              
              {/* Header của form */}
              <div className="bg-slate-100 px-5 py-3.5 border-b border-slate-205 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-200">
                    <Calculator className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                      Dự toán xây dựng nhà ở
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Hệ thống phân bổ chiết tính dòng chi phí theo Loại nhà thông dụng</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-6">
                {/* Grid các trường nhập liệu khái toán */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Cột trái: Kích thước mặt bằng */}
                  <div className="space-y-4">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-[#1e3a8a] border-b pb-1">
                      📐 THÔNG SỐ VẬT LÝ MẶT BẰNG
                    </span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <label className="sm:col-span-5 text-slate-700 font-bold text-xs">
                        Chiều dài mặt bằng (m):
                      </label>
                      <div className="sm:col-span-7 relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={chieuDai}
                          onChange={(e) => setChieuDai(Math.max(0, parseFloat(e.target.value) || 0))}
                          disabled={isLocked}
                          className="w-full bg-[#f8fafc] disabled:opacity-60 text-[#1e3a8a] border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold font-mono outline-none focus:border-indigo-500 transition-all text-center"
                        />
                        <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-bold">m</span>
                      </div>
                      <p className="sm:col-span-12 text-[10px] text-slate-400 font-medium italic -mt-2">Đo theo mép ngoài tường bao</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <label className="sm:col-span-5 text-slate-700 font-bold text-xs">
                        Chiều rộng mặt bằng (m):
                      </label>
                      <div className="sm:col-span-7 relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={chieuRong}
                          onChange={(e) => setChieuRong(Math.max(0, parseFloat(e.target.value) || 0))}
                          disabled={isLocked}
                          className="w-full bg-[#f8fafc] disabled:opacity-60 text-[#1e3a8a] border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold font-mono outline-none focus:border-indigo-500 transition-all text-center"
                        />
                        <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-bold">m</span>
                      </div>
                      <p className="sm:col-span-12 text-[10px] text-slate-400 font-medium italic -mt-2">Đo theo mép ngoài tường bao</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <label className="sm:col-span-5 text-slate-700 font-bold text-xs">
                        Số tầng xây dựng:
                      </label>
                      <div className="sm:col-span-7 relative">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={soTang}
                          onChange={(e) => setSoTang(Math.max(0, parseFloat(e.target.value) || 0))}
                          disabled={isLocked}
                          className="w-full bg-[#f8fafc] disabled:opacity-60 text-[#1e3a8a] border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold font-mono outline-none focus:border-indigo-500 transition-all text-center"
                        />
                        <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-bold">tầng</span>
                      </div>
                      <p className="sm:col-span-12 text-[10px] text-slate-400 font-medium italic -mt-2">Nhà cấp 4 = 1 tầng; Có mái lửng lẻ thì ghi 1.5</p>
                    </div>
                  </div>

                  {/* Cột phải: Loại nhà & Đơn giá */}
                  <div className="space-y-4">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-[#1e3a8a] border-b pb-1">
                      🏨 PHÂN LOẠI & ĐĂNG KÍ THI THIẾT KẾ
                    </span>

                    {/* Loại nhà Searchable Dropdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <label className="sm:col-span-5 text-slate-700 font-bold text-xs">
                        Phân loại nhà định mức:
                      </label>
                      <div className="sm:col-span-7 relative">
                        <button
                          type="button"
                          onClick={() => !isLocked && setIsHouseDropdownOpen(!isHouseDropdownOpen)}
                          disabled={isLocked}
                          className="w-full bg-white disabled:opacity-60 text-indigo-900 border border-slate-200 rounded-lg px-3 py-2 text-xs hover:border-slate-300 transition-all flex items-center justify-between cursor-pointer focus:ring-1 focus:ring-indigo-500/20 font-bold"
                        >
                          <span className="truncate">{selectedHouseType || '0'}</span>
                          <span className="text-slate-400 ml-1.5 shrink-0 text-[10px]">▼</span>
                        </button>
                        
                        {isHouseDropdownOpen && (
                          <div className="absolute right-0 left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-2 z-55 max-h-56 overflow-y-auto">
                            <div className="relative mb-2">
                              <input
                                type="text"
                                value={houseTypeSearchQuery}
                                onChange={(e) => setHouseTypeSearchQuery(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Gõ tìm nhanh loại nhà..."
                                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-md pl-7 pr-2.5 py-1 text-[11px] outline-none focus:border-indigo-500 font-medium placeholder-slate-400"
                              />
                              <Search className="w-3 h-3 text-slate-405 absolute left-2 top-2" />
                            </div>
                            <div className="space-y-0.5">
                              {houseEstimatePrices
                                .filter(h => h.type.toLowerCase().includes(houseTypeSearchQuery.toLowerCase()))
                                .map((house) => (
                                  <button
                                    key={house.stt}
                                    type="button"
                                    onClick={() => {
                                      setSelectedHouseType(house.type);
                                      setIsHouseDropdownOpen(false);
                                      setHouseTypeSearchQuery('');
                                    }}
                                    className={`w-full text-left px-2.5 py-1.5 rounded text-[11px] cursor-pointer transition-colors ${
                                      selectedHouseType === house.type 
                                        ? 'bg-indigo-50 text-indigo-700 font-extrabold border-l-2 border-indigo-500' 
                                        : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex justify-between items-center">
                                      <span>{house.type}</span>
                                      <span className="text-xs font-mono text-indigo-600">{(house.avgPrice / 1000000).toFixed(1)}M/m²</span>
                                    </div>
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="sm:col-span-12 text-[10px] text-slate-400 font-medium italic -mt-2">Chọn trong các loại nhà tiêu chuẩn định vị</p>
                    </div>

                    {/* Diện tích thi công mỗi tầng & Tổng diện tích sàn */}
                    <div className="grid grid-cols-2 gap-3.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-505 font-extrabold text-left">Diện tích sàn mỗi tầng</span>
                        <div className="text-sm font-extrabold text-emerald-600 font-mono mt-0.5">
                          {(chieuDai * chieuRong).toFixed(2)} <span className="text-[10px] font-normal text-slate-500">m²</span>
                        </div>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-550 font-extrabold text-left">Tổng diện tích xây dựng</span>
                        <div className="text-sm font-extrabold text-indigo-600 font-mono mt-0.5">
                          {(chieuDai * chieuRong * soTang).toFixed(2)} <span className="text-[10px] font-normal text-slate-550">m²</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Đặc điểm kết cấu dòng chảy */}
                <div className="bg-rose-50/40 p-3 rounded-xl border border-rose-100/50 text-xs">
                  <span className="block text-[10px] font-black uppercase text-rose-800 tracking-wider mb-1 flex items-center gap-1">
                    🔧 ĐẶC ĐIỂM KẾT CẤU CHÍNH CỦA LOẠI NHÀ ĐÃ CHỌN
                  </span>
                  <p className="text-indigo-950 font-medium italic leading-relaxed">
                    {houseEstimatePrices.find(h => h.type === selectedHouseType)?.features || 'Đang cập nhật đặc tính kết cấu'}
                  </p>
                </div>

                {/* Tài chính đơn giá */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-slate-700 font-bold text-xs mb-1.5">
                      Đơn giá khái toán trung bình (đ/m² sàn):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={donGiaKhaiToan}
                        onChange={(e) => setDonGiaKhaiToan(Math.max(0, parseInt(e.target.value) || 0))}
                        disabled={isLocked}
                        className="w-full bg-[#f8fafc] disabled:opacity-60 text-[#1e3a8a] border border-slate-200 rounded-lg px-3 py-2 text-xs font-black font-mono outline-none focus:border-indigo-500 transition-all text-center"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-bold">đ/m² sàn</span>
                    </div>
                    {(() => {
                      const matched = houseEstimatePrices.find(h => h.type === selectedHouseType);
                      if (matched) {
                        return (
                          <div className="text-[10px] text-slate-500 font-bold mt-1 text-left">
                            Khoảng dao động tiêu chuẩn: <strong className="text-[#4f46e5] font-mono">{matched.minPrice.toLocaleString('vi-VN')}</strong> – <strong className="text-[#4f46e5] font-mono">{matched.maxPrice.toLocaleString('vi-VN')}</strong> đ/m²
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold text-xs mb-1.5">
                      Ngân sách gói nội thất rời (nhập tay):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={nganSachNoiThat}
                        onChange={(e) => setNganSachNoiThat(Math.max(0, parseInt(e.target.value) || 0))}
                        disabled={isLocked}
                        className="w-full bg-[#f8fafc] disabled:opacity-60 text-[#1e3a8a] border border-slate-200 rounded-lg px-3 py-2 text-xs font-black font-mono outline-none focus:border-indigo-500 transition-all text-center"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-bold">đầu đồng</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium mt-1 text-left leading-relaxed">
                      Cơ bản: 50M-100M | Khá: 100M-300M | Cao cấp: 300M - 1.5 tỷ
                    </div>
                  </div>
                </div>

                {/* Nút hành động tính toán */}
                <div className="pt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={handleCalculateHouseEstimate}
                    disabled={isLocked}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-extrabold text-xs uppercase tracking-wider px-8 py-3 rounded-xl transition-all cursor-pointer shadow-lg flex items-center gap-2"
                  >
                    <Sliders className="w-4 h-4" />
                    ⚡ Tính Toán Báo Giá
                  </button>
                </div>
              </div>

              {/* Hủy bỏ hoàn toàn tab view cũ */}
              <div className="hidden">
                <div className="p-5 space-y-5">
                
                {/* BƯỚC 1: LỰA CHỌN CÔNG TÁC & HOẠT ĐỘNG */}
                <div className="space-y-2">
                  <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                    BƯỚC 1: CHỌN HẠNG MỤC PHÂN KHU & CÔNG TÁC
                  </span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 text-xs">
                    {/* Danh mục */}
                    <div className="relative md:col-span-12 lg:col-span-5 text-left">
                      <label className="block text-slate-600 font-bold uppercase tracking-wider text-[9px] mb-1.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        Hạng Mục {isCatDropdownOpen ? "(Đang lọc)" : ""}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCatDropdownOpen(!isCatDropdownOpen);
                          setIsProdDropdownOpen(false);
                          setSearchCategoryQuery('');
                        }}
                        className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl p-3 text-xs text-left hover:border-slate-300 transition-all flex items-center justify-between cursor-pointer focus:ring-1 focus:ring-indigo-500/20"
                      >
                        <span className="truncate font-semibold">{selectedCategory || "--- Chọn hạng mục ---"}</span>
                        <Sliders className="w-3.5 h-3.5 text-indigo-500 shrink-0 ml-2" />
                      </button>
                      
                      {isCatDropdownOpen && (
                        <div className="absolute right-0 left-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 z-55 max-h-60 overflow-y-auto">
                          <div className="relative mb-2">
                            <input
                              type="text"
                              value={searchCategoryQuery}
                              onChange={(e) => setSearchCategoryQuery(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-indigo-500 transition-all font-medium placeholder-slate-400"
                              placeholder="Tìm nhanh danh mục công tác..."
                            />
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                          </div>
                          <div className="space-y-1">
                            {categories
                              .filter(cat => (cat as string).toLowerCase().includes(searchCategoryQuery.toLowerCase()))
                              .map((cat) => (
                                <button
                                  key={cat as string}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCategory(cat as string);
                                    setIsCatDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-xs cursor-pointer block transition-all ${
                                    selectedCategory === cat 
                                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-extrabold' 
                                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                                  }`}
                                >
                                  {cat as string}
                                </button>
                              ))}
                            {categories.filter(cat => (cat as string).toLowerCase().includes(searchCategoryQuery.toLowerCase())).length === 0 && (
                              <div className="text-center py-2.5 text-slate-500 italic text-[11px]">Không thấy danh mục</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Sản phẩm */}
                    <div className="relative md:col-span-12 lg:col-span-5 text-left font-sans">
                      <label className="block text-slate-600 font-bold uppercase tracking-wider text-[9px] mb-1.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        Công Tác Thi Công {isProdDropdownOpen ? "(Đang tìm)" : ""}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsProdDropdownOpen(!isProdDropdownOpen);
                          setIsCatDropdownOpen(false);
                          setSearchProductQuery('');
                        }}
                        className={`w-full bg-white text-slate-800 border rounded-xl p-3 text-xs text-left transition-all flex items-center justify-between cursor-pointer focus:ring-1 focus:ring-indigo-500/20 ${
                          selectedCategory ? 'border-slate-200 hover:border-slate-355' : 'border-slate-150 opacity-50 cursor-not-allowed'
                        }`}
                        disabled={!selectedCategory}
                      >
                        <span className="truncate font-semibold">{selectedProduct ? selectedProduct.tenSanPham : "--- Chọn công tác ---"}</span>
                        <Sliders className="w-3.5 h-3.5 text-indigo-500 shrink-0 ml-2" />
                      </button>
                      
                      {isProdDropdownOpen && (
                        <div className="absolute right-0 left-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 z-55 max-h-60 overflow-y-auto">
                          <div className="relative mb-2">
                            <input
                              type="text"
                              value={searchProductQuery}
                              onChange={(e) => setSearchProductQuery(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-indigo-500 transition-all font-medium placeholder-slate-400"
                              placeholder="Tìm nhanh công tác..."
                            />
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                          </div>
                          <div className="space-y-1">
                            {catalogProducts
                              .filter(p => p.danhMuc === selectedCategory && p.tenSanPham.toLowerCase().includes(searchProductQuery.toLowerCase()))
                              .map((prod) => (
                                <button
                                  key={prod.id}
                                  type="button"
                                  onClick={() => handleProductSelect(prod)}
                                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs cursor-pointer block transition-all ${
                                    selectedProduct?.id === prod.id
                                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-extrabold' 
                                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                                  }`}
                                >
                                  <div className="font-extrabold text-slate-900 text-left">{prod.tenSanPham}</div>
                                  <div className="text-[10px] text-slate-500 mt-1 select-none leading-normal text-left">{prod.chatLieu}</div>
                                </button>
                              ))}
                            {catalogProducts.filter(p => p.danhMuc === selectedCategory && p.tenSanPham.toLowerCase().includes(searchProductQuery.toLowerCase())).length === 0 && (
                              <div className="text-center py-2.5 text-slate-500 italic text-[11px]">Không thấy công tác</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Đơn vị vị tính & Khối lượng */}
                    <div className="md:col-span-2 grid grid-cols-2 gap-2 text-left">
                      <div>
                        <label className="block text-slate-600 font-bold uppercase tracking-wider text-[9px] mb-1.5 truncate">
                          Đơn Vị
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={selectedProduct ? selectedProduct.donVi : "---"}
                          className="w-full bg-slate-50 text-slate-550 border border-slate-200 rounded-xl p-3 text-xs font-bold text-center outline-none select-none cursor-not-allowed border-dashed"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-bold uppercase tracking-wider text-[9px] mb-1.5 truncate">
                          Khối lượng
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={productQty}
                          onChange={(e) => setProductQty(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-white text-slate-900 border border-slate-200 rounded-xl p-3 text-xs font-bold font-mono outline-none focus:border-indigo-500 text-center"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* BƯỚC 2: CẤU HÌNH VẬT TƯ & ĐƠN GIÁ CÔNG TÁC */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1 border-t border-slate-200 text-xs text-left">
                  
                  {/* Cột Trái: Chỉ định vật tư thô */}
                  <div className="lg:col-span-6 space-y-2">
                    <div>
                      <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                        BƯỚC 2A: VẬT LIỆU CHỈ ĐỊNH
                      </span>
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3">
                      <div>
                        <span className="block text-slate-500 font-extrabold text-[9px] uppercase tracking-wider mb-1.5">
                          Phương án vật liệu gán định mức:
                        </span>
                        
                        {/* Quick Material Choices */}
                        <div className="flex flex-wrap gap-1.5">
                          {getProductLinkedMaterials().map((mat: any) => {
                            const isSelected = selectedMaterialOption === mat.tenChatLieu;
                            return (
                              <button
                                key={mat.id}
                                type="button"
                                onClick={() => handleMaterialOptionChange(mat.tenChatLieu)}
                                className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer leading-normal max-w-[170px] truncate ${
                                  isSelected 
                                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-extrabold' 
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                }`}
                                title={mat.tenChatLieu + (mat.ghiChu ? ` (${mat.ghiChu})` : '')}
                              >
                                {mat.tenChatLieu}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => handleMaterialOptionChange('Tự nhập')}
                            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                              selectedMaterialOption === 'Tự nhập' 
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-extrabold' 
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            Tự nhập kết cấu khác
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={3.5}
                        value={customMaterial}
                        onChange={(e) => {
                          setCustomMaterial(e.target.value);
                          setSelectedMaterialOption('Tự nhập');
                        }}
                        className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 resize-none font-semibold leading-relaxed"
                        placeholder="Hãy lựa chọn phương án vật liệu định mức hoặc ghi chú tự do chi tiết mác vữa, loại đá, phi sắt tại đây..."
                      />
                    </div>
                  </div>

                  {/* Cột Phải: Phương án đơn giá */}
                  <div className="lg:col-span-6 space-y-2">
                    <div>
                      <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                        BƯỚC 2B: CHỌN ĐƠN GIÁ DỰ TOÁN THẦU
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                      <span className="block text-slate-500 font-extrabold text-[9px] uppercase tracking-wider mb-2 text-left">
                        Mức giá liên kết phát hiện cho dòng công tác:
                      </span>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {getProductLinkedPrices().map((pr: any) => {
                          const isSelected = selectedPriceOption === pr.tenGia;
                          return (
                            <label 
                              key={pr.id} 
                              className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all text-left ${
                                isSelected 
                                  ? 'bg-indigo-50 border-indigo-500 text-indigo-750 shadow-sm ring-1 ring-indigo-500/10' 
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <input
                                type="radio"
                                name="priceOptionConst"
                                checked={isSelected}
                                onChange={() => handlePriceOptionChange(pr.tenGia)}
                                className="hidden"
                              />
                              <div className="pt-0.5">
                                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${
                                  isSelected ? 'border-indigo-500 bg-indigo-600' : 'border-slate-300 bg-white'
                                }`}>
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                                </div>
                              </div>
                              <div className="flex flex-col">
                                <span className="font-extrabold text-[11px] text-slate-800 transition-colors">{pr.tenGia}</span>
                                <span className="font-bold font-mono text-[11px] text-indigo-600 mt-1">
                                  {(pr.donGia).toLocaleString('vi-VN')} đ <span className="text-[9px] text-slate-500 font-normal">/{selectedProduct?.donVi || 'm2'}</span>
                                </span>
                              </div>
                            </label>
                          );
                        })}
                        
                        {/* Custom Price selection */}
                        <label 
                          className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all text-left ${
                            selectedPriceOption === 'Tự chọn' 
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-750 shadow-sm ring-1 ring-indigo-500/10' 
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="priceOptionConst"
                            checked={selectedPriceOption === 'Tự chọn'}
                            onChange={() => handlePriceOptionChange('Tự chọn')}
                            className="hidden"
                          />
                          <div className="pt-0.5">
                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${
                              selectedPriceOption === 'Tự chọn' ? 'border-indigo-500 bg-indigo-600' : 'border-slate-300 bg-white'
                            }`}>
                              {selectedPriceOption === 'Tự chọn' && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                            </div>
                          </div>
                          <div className="flex flex-col w-full">
                            <span className="font-extrabold text-[11px] text-slate-800">Đơn giá thầu tự nhập</span>
                            <div className="mt-1 flex items-center gap-1">
                              <input
                                type="number"
                                value={selectedPriceOption === 'Tự chọn' ? chosenPrice : ''}
                                onChange={(e) => {
                                  setSelectedPriceOption('Tự chọn');
                                  setChosenPrice(Math.max(0, parseInt(e.target.value) || 0));
                                }}
                                disabled={selectedPriceOption !== 'Tự chọn'}
                                placeholder="Gõ đơn giá..."
                                className="w-full bg-white text-indigo-600 border border-slate-200 rounded px-2 py-0.5 text-[11px] font-bold font-mono focus:border-indigo-500 outline-none"
                              />
                            </div>
                          </div>
                        </label>
                      </div>

                      {selectedProduct && getProductLinkedPrices().length === 0 && (
                        <div className="text-slate-500 italic text-[10px] py-3.5 bg-slate-50 rounded-xl text-center border border-slate-200 mt-2">
                          Công tác này chưa được thiết lập tập đơn giá định mức nào trong danh mục.
                        </div>
                      )}
                      {!selectedProduct && (
                        <div className="text-slate-500 italic text-[10.5px] py-4 bg-slate-50 rounded-xl text-center border border-slate-200 mt-2">
                          Vui lòng lọc chỉ định công tác tại Bước 1 để tự động đồng bộ & hiển thị các mức đơn giá thầu thô...
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* BƯỚC 3: TỔNG HỢP & NẠP VÀO BẢNG BÚT TOÁN */}
                {selectedProduct && (
                  <div className="bg-indigo-50 border border-indigo-200/60 rounded-2xl p-4.5 flex flex-col md:flex-row items-center justify-between gap-4 animate-none text-left">
                    <div className="space-y-1 text-center md:text-left">
                      <div className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                        HOẠT ĐỘNG KIỂM SOÁT KIÊN QUYẾT TỔNG QUAN
                      </div>
                      <div className="text-xs text-slate-850 leading-relaxed">
                        Công tác đang soạn: <span className="font-extrabold text-indigo-600">{selectedProduct.tenSanPham}</span> ({selectedProduct.id})
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium font-sans">
                        Phương án: <span className="font-bold text-slate-800">{selectedPriceOption}</span> — Đơn giá: <span className="font-extrabold font-mono text-slate-900">{chosenPrice.toLocaleString('vi-VN')} đ/{selectedProduct.donVi}</span> x <span className="font-extrabold font-mono text-slate-900">{productQty}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                      <div className="text-center sm:text-right">
                        <div className="text-[9px] uppercase font-bold tracking-widest text-slate-500">DỰ TOÁN HẠNG MỤC SƠ KHỞI</div>
                        <div className="text-lg font-black font-mono text-indigo-600 tracking-tight">
                          {(chosenPrice * productQty).toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-500">đ</span>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={handleAddProductToQuote}
                        className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-550 active:bg-indigo-700 text-white font-extrabold py-3 px-6 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-indigo-700/20"
                      >
                        <Plus className="w-4 h-4 shrink-0" />
                        Thêm công tác
                      </button>
                    </div>
                  </div>
                )}

              </div>
              <div className="hidden">
                /* NHẬP CÔNG TÁC PHỤ TRỢ NGOÀI DANH MỤC */
                <div className="p-5 space-y-5 text-left">
                  <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                    BẢNG ĐĂNG KÝ HẠNG MỤC PHỤ TRỢ NGOÀI DANH MỤC XÂY DỰNG
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Tên công tác */}
                    <div className="md:col-span-6">
                      <label className="block text-slate-600 font-bold uppercase tracking-wider text-[9px] mb-1.5">
                        Tên công tác/sản phẩm khác <span className="text-rose-500 font-extrabold">*</span>
                      </label>
                      <input
                        type="text"
                        value={customProductOtherName}
                        onChange={(e) => setCustomProductOtherName(e.target.value)}
                        className="w-full bg-white text-slate-950 border border-slate-200 rounded-xl p-3 text-xs focus:border-indigo-500 outline-none font-semibold transition-all placeholder-slate-400"
                        placeholder="Ví dụ: Thiết kế kết cấu móng lót phụ dùng coffa nhựa..."
                      />
                    </div>

                    {/* Số lượng */}
                    <div className="md:col-span-2">
                      <label className="block text-slate-600 font-bold uppercase tracking-wider text-[9px] mb-1.5">
                        Số lượng <span className="text-rose-500 font-extrabold">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={customProductOtherQty}
                        onChange={(e) => setCustomProductOtherQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-white text-slate-950 border border-slate-200 rounded-xl p-3 text-xs focus:border-indigo-500 outline-none font-bold font-mono transition-all text-center"
                      />
                    </div>

                    {/* Đơn giá */}
                    <div className="md:col-span-4">
                      <label className="block text-slate-600 font-bold uppercase tracking-wider text-[9px] mb-1.5">
                        Đơn giá dự thô (đ) <span className="text-rose-500 font-extrabold">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={customProductOtherUnitPrice}
                        onChange={(e) => setCustomProductOtherUnitPrice(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-white text-indigo-600 border border-slate-200 rounded-xl p-3 text-xs focus:border-indigo-500 outline-none font-bold font-mono transition-all"
                        placeholder="Nhập giá công tác..."
                      />
                    </div>
                  </div>

                  {/* Summary row */}
                  <div className="bg-indigo-50 border border-indigo-200/60 rounded-2xl p-4.5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="space-y-1 text-center md:text-left">
                      <div className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                        BÁO CÁO TỔNG HỢP CÔNG TÁC NGOÀI
                      </div>
                      <div className="text-xs text-slate-800 leading-relaxed font-sans">
                        Chất liệu bổ trợ mặc định: <span className="font-extrabold text-slate-600">Chủ đầu tư lựa chọn chỉ định</span>
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium">
                        Tổng tạm tính hạng mục: <span className="font-extrabold font-mono text-slate-900">{customProductOtherUnitPrice.toLocaleString('vi-VN')} đ</span> x <span className="font-extrabold font-mono text-slate-900">{customProductOtherQty}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                      <div className="text-center sm:text-right">
                        <div className="text-[9px] uppercase font-bold tracking-widest text-slate-500">TỔNG KHỐI LƯỢNG SƠ BỘ</div>
                        <div className="text-lg font-black font-mono text-indigo-600 tracking-tight">
                          {(customProductOtherQty * customProductOtherUnitPrice).toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-500">đ</span>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={handleAddCustomOtherProduct}
                        className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-550 active:bg-indigo-700 text-white font-extrabold py-3 px-6 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-indigo-700/20"
                      >
                        <Plus className="w-4 h-4 shrink-0" />
                        Thêm công tác
                      </button>
                    </div>
                  </div>
                </div>
                </div>
              </div>
            </div>

            {/* Table hiện có */}
            <div className="overflow-x-auto min-h-[180px]">
              <table className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-800 font-bold">
                  <tr>
                    <th className="px-3 py-2.5 text-center w-12 text-slate-700">STT</th>
                    <th className="px-3 py-2 text-slate-700">Dòng công tác xây thô & hoàn thiện</th>
                    {quoteItems.some(i => i.ratioPercent !== undefined) && (
                      <th className="px-3 py-2.5 text-center text-slate-700 w-20">Tỷ lệ (%)</th>
                    )}
                    <th className="px-3 py-2 text-slate-700">Định lượng vật liệu & Ghi chú</th>
                    <th className="px-3 py-2 text-center text-slate-700">Khối lượng</th>
                    <th className="px-3 py-2 text-center text-slate-700">Đơn vị</th>
                    <th className="px-3 py-2 text-right text-slate-700">Đơn giá</th>
                    <th className="px-3 py-2 text-right text-slate-700">Thành tiền (đồng)</th>
                    <th className="px-3 py-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {quoteItems.length === 0 ? (
                    <tr>
                      <td colSpan={quoteItems.some(i => i.ratioPercent !== undefined) ? 9 : 8} className="text-center py-8 text-slate-400 font-medium italic">
                        Chưa có công tác thi công nào trong rà soát thầu xây thô này. Hãy bấm Tính Toán phía trên để tạo báo giá khái toán.
                      </td>
                    </tr>
                  ) : (
                    quoteItems.map((item, idx) => {
                      const unitVal = item.unit || 'm2';
                      const defaultMat = item.material || 'Xây cát đá mác xi măng liên quan';
                      const uPrice = item.unitPrice || 0;
                      const hasRatio = item.ratioPercent !== undefined;
                      return (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2.5 text-center text-slate-500 font-semibold">{idx + 1}</td>
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-slate-900">{item.productName}</div>
                          </td>
                          {quoteItems.some(i => i.ratioPercent !== undefined) && (
                            <td className="px-3 py-2.5 text-center font-black text-[#1e3a8a] bg-slate-50/50 font-mono">
                              {hasRatio ? (
                                item.ratioPercent!.toString().endsWith('%') || item.ratioPercent === 'Tùy chọn'
                                  ? item.ratioPercent
                                  : `${item.ratioPercent}%`
                              ) : 'định mức'}
                            </td>
                          )}
                          <td className="px-3 py-2.5 text-slate-600 max-w-[200px] truncate" title={defaultMat}>
                            {defaultMat}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-900">{item.qty}</td>
                          <td className="px-3 py-2.5 text-center text-slate-500">{unitVal}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600 font-mono">{(uPrice).toLocaleString('vi-VN')} đ</td>
                          <td className="px-3 py-2.5 text-right font-extrabold text-indigo-650 font-mono">{(item.totalPrice).toLocaleString('vi-VN')} đ</td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              onClick={() => !isLocked && handleRemoveItem(item.id)}
                              disabled={isLocked}
                              className={`text-rose-500 hover:text-rose-600 p-1 transition-colors ${isLocked ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                              title={isLocked ? "Không thể xóa khi hồ sơ đang bị khóa" : "Xóa dòng này"}
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

          {/* Phần cộng tài chính lớn của hóa đơn */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
            <div className="grid grid-cols-2 text-xs text-slate-600 gap-y-1.5">
              <span>Hợp tổng thô hạng mục:</span>
              <span className="text-right font-mono font-bold text-slate-800">{subtotal.toLocaleString('vi-VN')} đ</span>
              
              <span>Chiết khấu thầu thô ({config.discountPercent}%):</span>
              <span className="text-right font-mono font-bold text-rose-600">-{discountVal.toLocaleString('vi-VN')} đ</span>
              
              <span>Tổng giá trị thô:</span>
              <span className="text-right font-mono font-semibold text-slate-700">{totalQuoteAmount.toLocaleString('vi-VN')} đ</span>

              <span>Thuế VAT ({vatPercent}%):</span>
              <span className="text-right font-mono font-bold text-indigo-550">+{vatAmount.toLocaleString('vi-VN')} đ</span>

              <div className="col-span-2 border-t border-slate-100 my-1.5"></div>
              
              <span className="text-sm font-bold text-slate-805">TỔNG GIÁ TRỊ TOÀN BỘ (ĐÃ CÓ VAT):</span>
              <span className="text-right text-base font-extrabold text-indigo-600 font-mono">{totalWithVat.toLocaleString('vi-VN')} đ</span>
            </div>

            {/* Các điều khoản */}
            <div className="grid grid-cols-1 gap-2 border-t border-slate-200 pt-3 text-[11px]">
              <div>
                <label className="block text-slate-600 font-semibold mb-0.5 text-left">Tiền bằng chữ sơ ước</label>
                <div className="bg-slate-50 border border-slate-200 text-indigo-700 rounded px-2.5 py-1.5 font-bold italic text-left">
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

            {/* Action Buttons */}
            <div className="flex justify-end items-center gap-2.5 pt-2">
              {/* Nút Chỉnh sửa */}
              <button
                type="button"
                onClick={() => setIsLocked && setIsLocked(false)}
                disabled={!isConstructionSaved || !isLocked}
                className="bg-amber-550 hover:bg-amber-600 text-white disabled:opacity-30 disabled:cursor-not-allowed font-semibold px-4 py-2.5 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-200 shadow-md"
                title={!isConstructionSaved ? "Nút Chỉnh sửa chỉ mở khi hồ sơ Đã Lưu" : !isLocked ? "Đang trong chế độ chỉnh sửa" : "Chỉnh sửa số liệu báo giá"}
              >
                <Edit className="w-4 h-4" />
                Chỉnh sửa
              </button>

              {/* Nút Lưu / Đã Lưu */}
              <button
                type="button"
                onClick={handleSaveQuote}
                disabled={(isConstructionSaved && isLocked) || quoteItems.length === 0 || (!selectedProjectId && !projectName.trim()) || !customerName.trim() || !customerPhone.trim() || !customerAddress.trim()}
                className={`${isConstructionSaved && isLocked ? 'bg-slate-500 hover:bg-slate-500 cursor-not-allowed' : 'bg-[#00a651] hover:bg-[#008f43]'} text-white disabled:opacity-30 disabled:cursor-not-allowed font-semibold px-4 py-2.5 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-200 shadow-md`}
                title={(!selectedProjectId && !projectName.trim()) || !customerName.trim() || !customerPhone.trim() || !customerAddress.trim() ? "Vui lòng nhập đầy đủ các trường bắt buộc (DỰ ÁN/TÊN DỰ ÁN, TÊN KHÁCH HÀNG, SỐ ĐIỆN THOẠI, ĐỊA CHỈ)" : isConstructionSaved && isLocked ? "Hồ sơ đã được lưu" : "Lưu hồ sơ báo giá"}
              >
                {isConstructionSaved && isLocked ? (
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
                  const baseQuote = loadedQuote || {
                    id: `temp_${Date.now()}`,
                    code: 'BGXD-TEMP',
                    customerId: selectedCustomerId || 'temp',
                    projectId: selectedProjectId || undefined,
                    projectName: projectName,
                    chieuDai: chieuDai,
                    chieuRong: chieuRong,
                    soTang: soTang,
                    selectedHouseType: selectedHouseType,
                    donGiaKhaiToan: donGiaKhaiToan,
                    nganSachNoiThat: nganSachNoiThat,
                    dienTichSan: chieuDai * chieuRong,
                    tongDienTichXayDung: chieuDai * chieuRong * soTang,
                    date: new Date().toISOString().split('T')[0],
                    items: quoteItems,
                    config: config,
                    notes: quoteNotes,
                    paymentTerms: paymentTerms,
                    customerName: customerName,
                    customerPhone: customerPhone,
                    customerAddress: customerAddress
                  };
                  setSavedQuoteForPreview({
                    ...baseQuote,
                    companyLogoImg: companyLogoImg,
                    companyLogoText: companyLogoText,
                    companySlogan: companySlogan,
                    companyAddressInfo: companyAddressInfo,
                    companyContactInfo: companyContactInfo
                  });
                }}
                disabled={!isConstructionSaved || !isLocked}
                className="bg-indigo-600 text-white hover:bg-indigo-550 disabled:opacity-30 disabled:cursor-not-allowed font-semibold px-4 py-2.5 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-200 shadow-md"
                title={!isConstructionSaved ? "Vui lòng lưu hồ sơ trước khi Xem & In" : !isLocked ? "Vui lòng hoàn tất chỉnh sửa và lưu trước khi Xem & In" : "Xem chi tiết & In ấn"}
              >
                <Printer className="w-4 h-4" />
                Xem & In
              </button>
            </div>
          </div>

        </div>

        {/* Dynamic Preview Modal */}
        {savedQuoteForPreview && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 select-text">
            <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl text-slate-800 shadow-2xl overflow-hidden">
              <div className="bg-slate-50 px-6 py-4.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-250">
                    <FileText className="w-4 h-4 text-[#4f46e5]" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                      Xem chi tiết hồ sơ dự toán thầu
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium">Biên bản dự toán tạo lập tự động - HOANG LONG ERP</p>
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
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer"
                >
                  Thoát
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="px-5 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-all hover:scale-[1.01]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  In Dự Toán
                </button>
              </div>
            </div>
          </div>
        )}

      {showExistsAlert && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[250] p-4 animate-none">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 text-slate-100 shadow-2xl relative">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <h4 className="font-extrabold text-base uppercase text-white tracking-wide">
                Hồ Sơ Đã Tồn Tại!
              </h4>
              <p className="text-sm text-slate-300 leading-relaxed font-semibold">
                Hồ sơ Dự án này đã có dự toán được tạo lập, vui lòng vào phòng ban <strong className="text-indigo-400 font-extrabold">Lưu Trữ Hồ Sơ</strong> để theo dõi hoặc chỉnh sửa.
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

      {showQuickCreateCust && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[220] p-4 text-left font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm text-slate-800 shadow-2xl overflow-hidden p-6">
            <h4 className="font-extrabold text-sm uppercase text-slate-900 tracking-wider mb-4 flex items-center gap-1">
              <span>➕ Tạo Khách Hàng Thầu Nhanh</span>
            </h4>
            <div className="space-y-3.5">
              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1">Tên chủ thầu/khách hàng *</label>
                <input
                  type="text"
                  value={quickCustName}
                  onChange={(e) => setQuickCustName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-505 font-medium text-slate-900"
                  placeholder="Nhập tên khách hàng..."
                />
              </div>
              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1">Số điện thoại *</label>
                <input
                  type="text"
                  value={quickCustPhone}
                  onChange={(e) => setQuickCustPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-505 font-medium text-slate-900"
                  placeholder="Nhập số điện thoại..."
                />
              </div>
              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1">Địa chỉ thi công *</label>
                <input
                  type="text"
                  value={quickCustAddress}
                  onChange={(e) => setQuickCustAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-505 font-medium text-slate-900"
                  placeholder="Nhập địa chỉ..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => {
                  setQuickCustName('');
                  setQuickCustPhone('');
                  setQuickCustAddress('');
                  setShowQuickCreateCust(false);
                }}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleQuickCreateCustomer}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-extrabold hover:bg-indigo-700 transition-colors shadow cursor-pointer opacity-90 hover:opacity-100"
              >
                Lưu khách hàng
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
  );
}
