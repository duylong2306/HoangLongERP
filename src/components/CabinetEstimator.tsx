import React, { useState, useEffect } from 'react';
import { QuoteConfig, QuoteItem, ProductGroup, Quote, ArchivedQuote, ProductCatalogItem } from '../types';
import { useNotification } from '../context';
import { DEFAULT_QUOTE_CONFIG } from '../data';
import { INITIAL_PRODUCTS } from './ProductCatalogTable';
import { Plus, Trash2, Sliders, Calculator, FileSpreadsheet, FileText, CheckCircle2, DollarSign, Search, Send, Printer, AlertTriangle, Edit, Save, Check } from 'lucide-react';
import { dbService } from '../lib/dbService';
import QuotationTableSheet, { docSoTiengViet } from './QuotationTableSheet';
import RichTextEditor from './RichTextEditor';

export const DEFAULT_FURN_PAYMENT_TERMS = `<p><strong>1. Thời gian thực hiện:</strong> 10-12 ngày.</p>
<p><strong>2. Bảo hành:</strong> Bảo hành 1 năm. Lỗi phụ kiện thay mới.</p>
<p><strong>3. Thanh toán:</strong></p>
<ul style="padding-left: 20px; list-style-type: disc;">
  <li><strong>3.1 Đặt cọc:</strong> <span style="color: #10b981;"><strong>50%</strong></span> giá trị đơn hàng là ngay khi xác nhận báo giá để xưởng tiến hành sản xuất.</li>
  <li style="list-style-type: none; margin-left: -10px;">🏦 <strong>Thông tin tài khoản:</strong> <span style="color: #10b981; font-weight: bold;">799201899999 MB BANK - Công ty TNHH Hoàng Long Lâm Đồng</span></li>
  <li><strong>3.2 Thanh toán:</strong> Thanh toán <span style="color: #10b981;"><strong>50%</strong></span> còn lại ngay khi hoàn thành công việc (Không quá 05 ngày kể từ ngày nhận được hóa đơn tài chính, bên mua trả phí chuyển khoản)</li>
  <li><strong>3.3 Hiệu lực báo giá:</strong> 05 ngày kể từ ngày báo giá.</li>
</ul>
<p><strong>Lưu ý:</strong> <em>Báo giá được áp dụng theo thiết kế và quy cách đã thống nhất. Mọi thay đổi về thiết kế, kích thước, vật liệu hoặc phụ kiện (nếu có) sẽ được xem xét điều chỉnh lại đơn giá cho phù hợp với giá trị sản phẩm thực tế.</em></p>
<p>Xin vui lòng liên hệ với chúng tôi nếu quý khách hàng có cần thêm các yêu cầu nào khác.</p>
<p><strong>Trân trọng cảm ơn.</strong></p>`;

export const DEFAULT_FURN_CONTRACT_TEMPLATE = `<h3 style="text-align: center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
<h3 style="text-align: center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align: center;"><strong>Độc lập – Tự do – Hạnh phúc</strong></p>
<div style="text-align: center; margin-top: -10px;">• • • • • • • • • • • • • • •</div>
<h2 style="text-align: center; margin-top: 20px;"><strong>HỢP ĐỒNG THI CÔNG NỘI THẤT</strong></h2>
<p style="text-align: center; font-style: italic;">Số: {{SO_HOP_DONG}}</p>

<p><em>- Căn cứ Bộ luật dân sự năm 2015 được Quốc hội nước Cộng hòa xã hội chủ nghĩa Việt Nam thông qua ngày 24/11/2015 có hiệu lực ngày 01/01/2017.</em></p>
<p><em>- Căn cứ Luật thương mại năm 2005 được Quốc hội nước Cộng hòa xã hội chủ nghĩa Việt Nam thông qua ngày 14/6/2005 có hiệu lực ngày 01/01/2006.</em></p>
<p><em>- Căn cứ vào nhu cầu và năng lực của hai bên.</em></p>

<p>Hôm nay, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}} tại {{TEN_CONG_TY}}, chúng tôi ký tên dưới đây gồm có:</p>

<p><strong>Bên A: Chủ đầu tư (hoặc đại diện của Chủ đầu tư)</strong></p>
<ul>
  <li>Họ và tên: {{TEN_KHACH_HANG}}</li>
  <li>Địa chỉ: {{DIA_CHI_KHACH_HANG}}</li>
  <li>Điện thoại: {{DIEN_THOAI_KHACH_HANG}}</li>
</ul>

<p><strong>Bên B: Đơn vị thi công nội thất</strong></p>
<ul>
  <li>Tên tổ chức: {{TEN_CONG_TY}}</li>
  <li>MST: {{MST_CONG_TY}}</li>
  <li>Địa chỉ trụ sở: {{DIA_CHI_CONG_TY}}</li>
  <li>Điện thoại: {{DIEN_THOAI_CONG_TY}}</li>
  <li>Đại diện: {{DAI_DIEN_CONG_TY}} - Chức vụ: {{CHUC_VU_CONG_TY}}</li>
</ul>

<p>Hai bên thống nhất ký kết hợp đồng thi công nội thất tại công trình:</p>
<ul>
  <li>Địa chỉ: {{DIA_DIEM}}</li>
  <li>Loại công trình: {{HANG_MUC}}</li>
</ul>

<p><strong>Điều 1. Nội dung và khối lượng công việc cần đề cập trong mẫu hợp đồng thi công</strong></p>
<p>1. Bên A giao cho Bên B thầu thi công toàn bộ sản phẩm nội thất theo đúng bản vẽ kiến trúc, nội thất đã được hai bên thống nhất và ký xác nhận kèm theo hợp đồng này.</p>
<p>2. Bên B sử dụng toàn bộ vật tư, chất liệu, mã số màu theo đúng thông số kỹ thuật, chủng loại, số lượng thể hiện trong phụ lục đã được hai bên thống nhất và ký xác nhận kèm theo hợp đồng này.</p>

<p><strong>Điều 2. Thời hạn thi công</strong></p>
<p>2.1. Thời hạn thi công là 15 ngày, tính từ ngày bên A tạm ứng</p>
<p>2.2. Gia hạn thời gian hoàn thành</p>
<p>Bên B được phép gia hạn thời gian hoàn thành nếu có một trong những lý do sau đây:</p>
<p>1. Có sự thay đổi phạm vi công việc, thiết kế, biện pháp thi công theo yêu cầu của Chủ đầu tư làm ảnh hưởng đến tiến độ thực hiện hợp đồng.</p>
<p>2. Sự chậm trễ, trở ngại trên công trường do Chủ đầu tư, nhân lực của Chủ đầu tư hay các nhà thầu khác của Chủ đầu tư gây ra.</p>
<p>3. Do ảnh hưởng của các trường hợp bất khả kháng như: động đất, bão, lũ, lụt, lốc, sóng thần, lỡ đất, hoạt động núi lửa, chiến tranh, dịch bệnh.</p>

<p><strong>Điều 3. Giá trị hợp đồng thi công</strong></p>
<p>{{BANG_CHI_TIET_BÁO_GIÁ}}</p>
<p>Tổng giá trị hợp đồng: <strong>{{TONG_CONG}}</strong> VND</p>
<p>Viết bằng chữ: <em>{{TONG_CONG_CHU}}</em></p>
<p>Đơn giá chưa bao gồm thuế VAT</p>

<p><strong>Điều 4. Cách thức thanh toán hợp đồng thi công nội thất theo từng giai đoạn (tiền mặt hoặc chuyển khoản)</strong></p>
<p>Khi hợp đồng được ký kết, để đảm bảo vốn sản xuất, Bên A ứng trước cho Bên B 50% kinh phí trên tổng giá trị hợp đồng</p>
<p>Số tiền ứng trước: <strong>{{SO_TIEN_TAM_UNG}}</strong> VND</p>
<p>Bên A thanh toán 50% còn lại sau khi nghiệm thu và bàn giao toàn bộ đồ nội thất</p>
<p>Số tiền còn lại: <strong>{{SO_TIEN_CONG_LAI}}</strong> VND</p>

<p><strong>Điều 5. Trách nhiệm Bên A</strong></p>
<p>1. Chọn người giám sát có chuyên môn và thông báo bằng văn bản cho Nhà thầu về nhân lực chính sẽ theo dõi số lượng và chất lượng sản phẩm trong suốt thời gian sản xuất.</p>
<p>2. Tổ chức cho bộ phận thi công của Bên B được tạm trú tại địa phương.</p>
<p>3. Chuẩn bị đầy đủ kinh phí và thanh toán đúng thời hạn cho Bên B. Nếu chậm thanh toán, Bên B được tính lãi suất Ngân hàng trên số tiền Bên A nợ.</p>

<p><strong>Điều 6. Trách nhiệm Bên B</strong></p>
<p>1. Sản xuất và thi công nội thất đúng với nội dung và khối lượng công việc quy định tại Điều 1.</p>
<p>2. Hoàn thành các hạng mục công trình đúng thời hạn hợp đồng, đảm bảo an toàn, bảo vệ môi trường và phòng chống cháy nổ. Bên B có lỗi chậm hoàn thành công trình sẽ bị phạt 2% mỗi tuần giá trị của khối lượng bị kéo dài (trừ trường hợp do lỗi Bên A gây ra, những ngày thiên tai, mưa bão hoặc trường hợp bất khả kháng không thể thi công được).</p>
<p>3. Chịu toàn bộ chi phí và lệ phí cho các quyền về đường đi lại mà nhà thầu cần có, bao gồm lối vào công trình.</p>

<p><strong>Điều 7. Tạm ngừng và chấm dứt hợp đồng</strong></p>
<p>7.1. Tạm ngừng và chấm dứt hợp đồng bởi Bên A (Chủ đầu tư)</p>
<p>Chủ đầu tư được quyền tạm ngưng hoặc chấm dứt hợp đồng nếu Bên B:</p>
<p>1. Không thực hiện công việc đúng tiến độ mà không phải do lỗi của chủ đầu tư.</p>
<p>2. Giao thầu phụ toàn bộ dự án hoặc chuyển nhượng hợp đồng mà không có sự thỏa thuận của Chủ đầu tư.</p>
<p>3. Bị phá sản, vỡ nợ, bị đóng cửa, bị quản lý tài sản.</p>
<p>7.2. Tạm ngừng và chấm dứt hợp đồng bởi Bên B (Đơn vị thi công)</p>
<p>Bên B được quyền tạm ngưng hoặc chấm dứt hợp đồng nếu Chủ đầu tư:</p>
<p>1. Không hoàn thành nghĩa vụ thanh toán theo thỏa thuận của hợp đồng này.</p>
<p>2. Yêu cầu tạm ngừng thi công bị kéo dài quá 45 ngày.</p>
<p>3. Bị phá sản, vỡ nợ, bị đóng cửa, bị quản lý tài sản.</p>
<p>4. Vi phạm luật Dân Sự, Thương Mại, luật Xây Dựng hiện hành hoặc yêu cầu trái với thuần phong mỹ tục mà Nhà nước không cho phép.</p>
<p>7.3. Thanh toán sau khi chấm dứt hợp đồng</p>
<p>1. Ngay khi thông báo chấm dứt hợp đồng có hiệu lực, Chủ đầu tư xem xét đồng ý hoặc xác định giá trị của công trình, vật tư, vật liệu, tài liệu của Bên B và các khoản tiền phải thanh toán cho Bên B cho các công việc đã thực hiện đúng theo Hợp đồng.</p>
<p>2. Chủ đầu tư có quyền thu lại các phí tổn do hư hỏng, mất mát mà Chủ đầu tư phải chịu sau khi tính đến bất kỳ một khoản nợ nào đối với Bên B.</p>
<p>3. Phạt thanh toán chậm: Trong trường hợp bên A chậm thanh toán theo điều 4 của hợp đồng này, bên B sẽ phạt bên A theo lãi suất cho vay của Ngân hàng Ngoại thương Việt Nam tại thời điểm thanh toán chậm tương ứng với số tiền chậm thanh toán nhưng không quá 30 ngày kể từ ngày đến hạn thanh toán. Nếu quá 30 ngày trên, bên B sẽ được quyền thu hồi vào bất kỳ thời gian nào đối với các sản phẩm đã cung cấp cho bên A theo hợp đồng này mà không cần phải thông báo trước cho bên A.</p>

<p><strong>Điều 8. Bảo hành dự án thi công nội thất</strong></p>
<p>Sau khi nhận được biên bản nghiệm thu công trình, hạng mục công trình để đưa vào sử dụng, Bên B phải:</p>
<p>1. Thực hiện bảo hành công trình trong thời gian 12 tháng.</p>
<p>2. Trong thời gian bảo hành công trình, Bên B phải sửa chữa mọi sai sót, khiếm khuyết do lỗi thi công nội thất bằng chi phí của Bên B. Việc sửa chữa các lỗi này phải được bắt đầu trong vòng không quá 7 ngày sau khi nhận được thông báo của Chủ đầu tư về các lỗi.</p>

<p><strong>Điều 9. Điều khoản chung của mẫu hợp đồng thi công nội thất</strong></p>
<p>1. Màu sắc trong bản vẽ gần với màu thực tế khi thi công trong mức kỹ thuật in hiện đại cho phép.</p>
<p>2. Hàng đã đặt thi công không được phép trả lại.</p>
<p>3. Công trình chỉ được phép đưa vào sử dụng sau khi hai bên cùng ký vào biên bản nghiệm thu.</p>
<p>4. Hợp đồng này có hiệu lực kể từ ngày ký.</p>
<p>5. Hai bên cam kết thực hiện đúng các điều khoản của hợp đồng, bên nào vi phạm sẽ phải chịu trách nhiệm theo đúng qui định của pháp luật về hợp đồng kinh tế.</p>
<p>6. Trong quá trình thực hiện nếu có phát sinh tăng hoặc giảm thì hai bên chủ động thương lượng giải quyết, khi cần sẽ lập phụ lục hợp đồng hoặc biên bản bổ sung hợp đồng.</p>
<p>7. Hợp đồng này được lập thành 02 (hai) bản có giá trị như nhau, mỗi bên giữ 01 (một) bản.</p>
`;

export const DEFAULT_FURN_ACCEPTANCE_TEMPLATE = `<h3 style="text-align: center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
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
<p>Tất cả các loại sản phẩm do bên B cung cấp hoàn toàn mới 100%,</p>
<p>Bên B đã cung cấp, lắp đặt, hướng dẫn sử dụng theo đúng yêu cầu kỹ thuật của Hợp đồng.</p>
<p><strong>Kết luận:</strong> Đồng ý nghiệm thu và đưa vào sử dụng.</p>
<p>Biên bản kết thúc cùng ngày và được lập thành 03 (ba) bản bên A giữa 1 bản, bên B giữa 2 bản có giá trị pháp lý như nhau.</p>
`;

export const DEFAULT_FURN_LIQUIDATION_TEMPLATE = `<h3 style="text-align: center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
<h3 style="text-align: center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align: center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align: center; margin-top: -10px;">• • • • • • • • • • • • • • •</div>
<p style="text-align: right; font-style: italic;">Số: {{SO_THANH_LY}}</p>
<p style="text-align: right; font-style: italic;">Lâm Đồng, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}</p>
<h2 style="text-align: center; margin-top: 20px;"><strong>BIÊN BẢN THANH LÝ HỢP ĐỒNG</strong></h2>

<p><em>Căn cứ vào Hợp đồng số: {{SO_HOP_DONG}}, ký ngày {{NGAY_KY_HĐ}}.</em></p>
<p><em>Căn cứ vào biên bản nghiệm thu số: {{SO_NGHIEM_THU}}, ký ngày {{NGAY_NGHIEM_THU}} giữa {{TEN_CONG_TY}} và {{TEN_KHACH_HANG}}.</em></p>

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
<p>Bên B đã cung cấp và lắp đặt đầy đủ khối lượng theo biên bản nghiệm thu bàn giao đã ký ngày {{NGAY_NGHIEM_THU}}.</p>
<p>Hai bên thống nhất nghiệm thu và thanh lý Hợp đồng đã ký kết.</p>

<p><strong>Điều 2. Giá trị thanh lý:</strong></p>
<p>Tổng giá trị khối lượng theo hợp đồng: <strong>{{TONG_CONG}}</strong> đồng (Bằng chữ: <em>{{TONG_CONG_CHU}}</em>).</p>
<p>Bên A phải thanh toán cho bên B số tiền: <strong>{{TONG_CONG}}</strong> đồng (Bằng chữ: <em>{{TONG_CONG_CHU}}</em>).</p>
<p>Biên bản kết thúc cùng ngày và được lập thành 03 (ba) bản Bên A giữ 1 bản, bên B giữa 02 (hai) bản có giá trị pháp lý như nhau.</p>
`;

interface CabinetEstimatorProps {
  onAddQuote?: (newQuote: any) => void;
  customers: any[];
  projects: any[];
  preselectedCustomerId?: string;
  preselectedProjectId?: string;
  currentUser?: any;
  isCabinetSaved?: boolean;
  setIsCabinetSaved?: (val: boolean) => void;
  isLocked?: boolean;
  setIsLocked?: (val: boolean) => void;
  loadedQuote?: any;
  setLoadedQuote?: (val: any) => void;
  showTemplateOnly?: boolean;
}

export default function CabinetEstimator({ 
  onAddQuote, 
  customers, 
  projects,
  preselectedCustomerId,
  preselectedProjectId,
  currentUser,
  isCabinetSaved = false,
  setIsCabinetSaved,
  isLocked = false,
  setIsLocked,
  loadedQuote,
  setLoadedQuote,
  showTemplateOnly = false
}: CabinetEstimatorProps) {
  const { addToast } = useNotification();
  // Config tỉ lệ %
  const [config, setConfig] = useState<QuoteConfig>(DEFAULT_QUOTE_CONFIG);
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
        const list = await dbService.archivedQuotes.list('furniture');
        if (active) {
          setArchivedQuotesList(list);
        }
      } catch (err) {
        console.error("Lỗi khi tải hồ sơ lưu trữ:", err);
      }
    };
    fetchArchivedQuotes();
    const handleCabinetUpdated = () => fetchArchivedQuotes();
    window.addEventListener('hl-archived-cabinet-quotes-updated', handleCabinetUpdated);
    window.addEventListener('hl-archived-quotes-updated', handleCabinetUpdated);
    return () => {
      active = false;
      window.removeEventListener('hl-archived-cabinet-quotes-updated', handleCabinetUpdated);
      window.removeEventListener('hl-archived-quotes-updated', handleCabinetUpdated);
    };
  }, [projects]);

  // Khách hàng & dự án được chọn cho báo giá này
  const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustomerId || '');
  const [selectedProjectId, setSelectedProjectId] = useState(preselectedProjectId || '');
  const [projectName, setProjectName] = useState('');

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
  const [paymentTerms, setPaymentTerms] = useState(() => localStorage.getItem('hl_cabinet_payment_terms') || DEFAULT_FURN_PAYMENT_TERMS);

  const [companyLogoImg, setCompanyLogoImg] = useState(() => localStorage.getItem('hl_cabinet_company_logo') || '');
  const [companyLogoText, setCompanyLogoText] = useState(() => localStorage.getItem('hl_cabinet_company_name') || 'HOANG LONG');
  const [companySlogan, setCompanySlogan] = useState(() => localStorage.getItem('hl_cabinet_company_slogan') || 'Construction - Furniture - Doors');
  const [companyAddressInfo, setCompanyAddressInfo] = useState(() => localStorage.getItem('hl_cabinet_company_address') || `<p>📍 <strong>Địa điểm kinh doanh:</strong> Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng</p>\n<p>🏠 <strong>Địa chỉ:</strong> 54/20 Kim Đồng, Phường 6, TP. Đà Lạt, tỉnh Lâm Đồng</p>`);
  const [companyContactInfo, setCompanyContactInfo] = useState(() => localStorage.getItem('hl_cabinet_company_contact') || `<p>📞 <strong>Hotline:</strong> 0966 545 959 - 0374 883 979</p>\n<p>✉ <strong>Email:</strong> hoanglongld.com@gmail.com</p>\n<p>🌐 <strong>Web:</strong> hoanglongld.com</p>`);

  const [contractTemplate, setContractTemplate] = useState(() => localStorage.getItem('hl_cabinet_contract_template') || DEFAULT_FURN_CONTRACT_TEMPLATE);
  const [acceptanceTemplate, setAcceptanceTemplate] = useState(() => localStorage.getItem('hl_cabinet_acceptance_template') || DEFAULT_FURN_ACCEPTANCE_TEMPLATE);
  const [liquidationTemplate, setLiquidationTemplate] = useState(() => localStorage.getItem('hl_cabinet_liquidation_template') || DEFAULT_FURN_LIQUIDATION_TEMPLATE);
  const [activeTemplateTab, setActiveTemplateTab] = useState<'quote' | 'contract' | 'acceptance' | 'liquidation'>('quote');
  const [isTemplateEditable, setIsTemplateEditable] = useState(false);

  const handleSetAsDefault = async () => {
    setDbSaving(true);
    setDbSaveSuccess(false);
    try {
      let defaultData = await dbService.quotationConfigs.get('furniture_default') || {};
      
      if (activeTemplateTab === 'quote') {
        defaultData.companyLogoImg = companyLogoImg;
        defaultData.companyLogoText = companyLogoText;
        defaultData.companySlogan = companySlogan;
        defaultData.companyAddressInfo = companyAddressInfo;
        defaultData.companyContactInfo = companyContactInfo;
        defaultData.paymentTerms = paymentTerms;
        
        localStorage.setItem('hl_cabinet_default_logo', companyLogoImg);
        localStorage.setItem('hl_cabinet_default_company_name', companyLogoText);
        localStorage.setItem('hl_cabinet_default_company_slogan', companySlogan);
        localStorage.setItem('hl_cabinet_default_company_address', companyAddressInfo);
        localStorage.setItem('hl_cabinet_default_company_contact', companyContactInfo);
        localStorage.setItem('hl_cabinet_default_payment_terms', paymentTerms);
      } else if (activeTemplateTab === 'contract') {
        defaultData.contractTemplate = contractTemplate;
        localStorage.setItem('hl_cabinet_default_contract_template', contractTemplate);
      } else if (activeTemplateTab === 'acceptance') {
        defaultData.acceptanceTemplate = acceptanceTemplate;
        localStorage.setItem('hl_cabinet_default_acceptance_template', acceptanceTemplate);
      } else if (activeTemplateTab === 'liquidation') {
        defaultData.liquidationTemplate = liquidationTemplate;
        localStorage.setItem('hl_cabinet_default_liquidation_template', liquidationTemplate);
      }
      
      await dbService.quotationConfigs.save('furniture_default', defaultData);
      
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
      setFeedback({
        type: 'error',
        message: 'Có lỗi xảy ra khi lưu thiết lập mặc định!'
      });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setDbSaving(false);
    }
  };

  const handleRestoreDefault = async () => {
    setDbSaving(true);
    setDbSaveSuccess(false);
    try {
      const defaultData = await dbService.quotationConfigs.get('furniture_default');
      
      if (activeTemplateTab === 'quote') {
        const logo = defaultData?.companyLogoImg ?? localStorage.getItem('hl_cabinet_default_logo') ?? '';
        const name = defaultData?.companyLogoText ?? localStorage.getItem('hl_cabinet_default_company_name') ?? 'HOANG LONG';
        const slogan = defaultData?.companySlogan ?? localStorage.getItem('hl_cabinet_default_company_slogan') ?? 'Construction - Furniture - Doors';
        const address = defaultData?.companyAddressInfo ?? localStorage.getItem('hl_cabinet_default_company_address') ?? `<p>📍 <strong>Địa điểm kinh doanh:</strong> Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng</p>\n<p>🏠 <strong>Địa chỉ:</strong> 54/20 Kim Đồng, Phường 6, TP. Đà Lạt, tỉnh Lâm Đồng</p>`;
        const contact = defaultData?.companyContactInfo ?? localStorage.getItem('hl_cabinet_default_company_contact') ?? `<p>📞 <strong>Hotline:</strong> 0966 545 959 - 0374 883 979</p>\n<p>✉ <strong>Email:</strong> hoanglongld.com@gmail.com</p>\n<p>🌐 <strong>Web:</strong> hoanglongld.com</p>`;
        const terms = defaultData?.paymentTerms ?? localStorage.getItem('hl_cabinet_default_payment_terms') ?? DEFAULT_FURN_PAYMENT_TERMS;
        
        setCompanyLogoImg(logo);
        setCompanyLogoText(name);
        setCompanySlogan(slogan);
        setCompanyAddressInfo(address);
        setCompanyContactInfo(contact);
        setPaymentTerms(terms);
      } else if (activeTemplateTab === 'contract') {
        const template = defaultData?.contractTemplate ?? localStorage.getItem('hl_cabinet_default_contract_template') ?? DEFAULT_FURN_CONTRACT_TEMPLATE;
        setContractTemplate(template);
      } else if (activeTemplateTab === 'acceptance') {
        const template = defaultData?.acceptanceTemplate ?? localStorage.getItem('hl_cabinet_default_acceptance_template') ?? DEFAULT_FURN_ACCEPTANCE_TEMPLATE;
        setAcceptanceTemplate(template);
      } else if (activeTemplateTab === 'liquidation') {
        const template = defaultData?.liquidationTemplate ?? localStorage.getItem('hl_cabinet_default_liquidation_template') ?? DEFAULT_FURN_LIQUIDATION_TEMPLATE;
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
        setPaymentTerms(DEFAULT_FURN_PAYMENT_TERMS);
      } else if (activeTemplateTab === 'contract') {
        setContractTemplate(DEFAULT_FURN_CONTRACT_TEMPLATE);
      } else if (activeTemplateTab === 'acceptance') {
        setAcceptanceTemplate(DEFAULT_FURN_ACCEPTANCE_TEMPLATE);
      } else if (activeTemplateTab === 'liquidation') {
        setLiquidationTemplate(DEFAULT_FURN_LIQUIDATION_TEMPLATE);
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

  // Auto-persist template changes to localStorage
  useEffect(() => {
    localStorage.setItem('hl_cabinet_company_logo', companyLogoImg);
    localStorage.setItem('hl_cabinet_company_name', companyLogoText);
    localStorage.setItem('hl_cabinet_company_slogan', companySlogan);
    localStorage.setItem('hl_cabinet_company_address', companyAddressInfo);
    localStorage.setItem('hl_cabinet_company_contact', companyContactInfo);
    localStorage.setItem('hl_cabinet_payment_terms', paymentTerms);
    localStorage.setItem('hl_cabinet_contract_template', contractTemplate);
    localStorage.setItem('hl_cabinet_acceptance_template', acceptanceTemplate);
    localStorage.setItem('hl_cabinet_liquidation_template', liquidationTemplate);
  }, [companyLogoImg, companyLogoText, companySlogan, companyAddressInfo, companyContactInfo, paymentTerms, contractTemplate, acceptanceTemplate, liquidationTemplate]);

  const [dbLoading, setDbLoading] = useState(false);
  const [dbSaving, setDbSaving] = useState(false);
  const [dbSaveSuccess, setDbSaveSuccess] = useState(false);

  // Load configuration from database on mount
  useEffect(() => {
    const fetchDbConfig = async () => {
      setDbLoading(true);
      try {
        const dbConfig = await dbService.quotationConfigs.get('furniture');
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
        console.error("Lỗi khi tải cấu hình báo giá Nội thất từ database:", e);
      } finally {
        setDbLoading(false);
      }
    };
    fetchDbConfig();
  }, []);

  // Các hạng mục trong báo giá hiện tại
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);

  // Load quote details reactively when loadedQuote changes from Quick Search
  useEffect(() => {
    if (loadedQuote && loadedQuote.sector === 'furniture') {
      if (loadedQuote.items) setQuoteItems(loadedQuote.items);
      if (loadedQuote.config) setConfig(loadedQuote.config);
      if (loadedQuote.notes) setQuoteNotes(loadedQuote.notes);
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
      setCompanyAddressInfo(loadedQuote.companyAddressInfo || `<p>📍 <strong>Địa điểm kinh doanh:</strong> Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng</p>\n<p>������ <strong>Địa chỉ:</strong> 54/20 Kim Đồng, Phường 6, TP. Đà Lạt, tỉnh Lâm Đồng</p>`);
      setCompanyContactInfo(loadedQuote.companyContactInfo || `<p>📞 <strong>Hotline:</strong> 0966 545 959 - 0374 883 979</p>\n<p>✉ <strong>Email:</strong> hoanglongld.com@gmail.com</p>\n<p>🌐 <strong>Web:</strong> hoanglongld.com</p>`);

      if (setIsCabinetSaved) setIsCabinetSaved(true);
      if (setIsLocked) setIsLocked(true);
    }
  }, [loadedQuote, setIsCabinetSaved, setIsLocked]);

  // Reset fields when starting fresh
  useEffect(() => {
    if (!loadedQuote && !isCabinetSaved) {
      setQuoteItems([]);
      setSelectedCustomerId('');
      setSelectedProjectId('');
      setProjectName('');
      setCustomerName('');
      setCustomerAddress('');
      setCustomerPhone('');
      setQuoteNotes('');
      setPaymentTerms(`<p><strong>1. Thời gian thực hiện:</strong> 10-12 ngày.</p>
<p><strong>2. Bảo hành:</strong> Bảo hành 1 năm. Lỗi phụ kiện thay mới.</p>
<p><strong>3. Thanh toán:</strong></p>
<ul style="padding-left: 20px; list-style-type: disc;">
  <li><strong>3.1 Đặt cọc:</strong> <span style="color: #10b981;"><strong>50%</strong></span> giá trị đơn hàng là ngay khi xác nhận báo giá để xưởng tiến hành sản xuất.</li>
  <li style="list-style-type: none; margin-left: -10px;">🏦 <strong>Thông tin tài khoản:</strong> <span style="color: #10b981; font-weight: bold;">799201899999 MB BANK - Công ty TNHH Hoàng Long Lâm Đồng</span></li>
  <li><strong>3.2 Thanh toán:</strong> Thanh toán <span style="color: #10b981;"><strong>50%</strong></span> còn lại ngay khi hoàn thành công việc (Không quá 05 ngày kể từ ngày nhận được hóa đơn tài chính, bên mua trả phí chuyển khoản)</li>
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
      setIsSentToProject(false);
    }
  }, [loadedQuote, isCabinetSaved]);

  // --- HỆ THỐNG THÊM SẢN PHẨM TỪ DANH MỤC TIÊU CHUẨN ---
  const [catalogProducts, setCatalogProducts] = useState<ProductCatalogItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<ProductCatalogItem | null>(null);
  const [selectedPriceOption, setSelectedPriceOption] = useState<string>('');
  const [chosenPrice, setChosenPrice] = useState<number | string>('');
  const [productQty, setProductQty] = useState<number | string>('');
  const [searchCategoryQuery, setSearchCategoryQuery] = useState<string>('');
  const [searchProductQuery, setSearchProductQuery] = useState<string>('');
  const [customMaterial, setCustomMaterial] = useState<string>('');
  
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const [isProdDropdownOpen, setIsProdDropdownOpen] = useState(false);

  // --- ADD CUSTOM OTHER PRODUCT ---
  const [addMethod, setAddMethod] = useState<'catalog' | 'other'>('catalog');
  const [customProductOtherName, setCustomProductOtherName] = useState<string>('');
  const [customProductOtherQty, setCustomProductOtherQty] = useState<number | string>('');
  const [customProductOtherUnitPrice, setCustomProductOtherUnitPrice] = useState<number | string>('');
  const [customProductOtherMaterial, setCustomProductOtherMaterial] = useState<string>('');

  // Nạp danh mục sản phẩm lĩnh vực Nội thất
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
    
    const domainProducts = loadedProducts.filter(p => p.linhVuc === 'Nội thất');
    setCatalogProducts(domainProducts);
  }, []);

  const categories = Array.from(new Set(catalogProducts.map(p => p.danhMuc as string).filter(Boolean)));

  const [selectedMaterialOption, setSelectedMaterialOption] = useState<string>('');

  useEffect(() => {
    // Để trống toàn bộ giá trị đầu vào mặc định, không tự động chọn danh mục đầu tiên
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
    // Không tự chọn sản phẩm đầu tiên khi đổi danh mục để trống các ô nhập liệu theo yêu cầu
    setSelectedProduct(null);
    setCustomMaterial('');
    setChosenPrice('');
    setSelectedMaterialOption('');
    setSelectedPriceOption('');
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
      setSelectedMaterialOption('Tự nhập');
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
    if (option === 'Tự nhập') return;
    setCustomMaterial(option);
  };

  const handleAddProductToQuote = () => {
    if (!selectedProduct) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng chọn sản phẩm trước!', type: 'warning' });
      return;
    }
    
    const specQty = typeof productQty === 'number' ? productQty : parseInt(productQty as any) || 1;
    const specPrice = typeof chosenPrice === 'number' ? chosenPrice : parseInt(chosenPrice as any) || 0;

    const newItem: QuoteItem = {
      id: `qi_prod_${Date.now()}`,
      productGroup: 'custom',
      productName: selectedProduct.tenSanPham,
      qty: specQty,
      material: customMaterial,
      unit: selectedProduct.donVi || 'Chiếc',
      unitPrice: specPrice,
      pricingMethod: 'quick',
      totalPrice: specQty * specPrice
    };
    
    setQuoteItems(prev => [...prev, newItem]);
    setProductQty('');
    
    setFeedback({
      message: `Đã thêm sản phẩm "${selectedProduct.tenSanPham}" vào báo giá thành công!`,
      type: 'success'
    });
    setTimeout(() => setFeedback(null), 3000);
  };
  // -----------------------------------------------------

  // Hạng mục đang soạn để Thêm vào bảng
  const [productGroup, setProductGroup] = useState<ProductGroup>('kitchen_cabinet');
  const [productName, setProductName] = useState('');
  const [qty, setQty] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [pricingMethod, setPricingMethod] = useState<'quick' | 'detail'>('quick');

  // Thông số m dài (bếp)
  const [lowerCabinetLength, setLowerCabinetLength] = useState<string>('');
  const [upperCabinetLength, setUpperCabinetLength] = useState<string>('');
  const [lowerCabinetMaterial, setLowerCabinetMaterial] = useState('');
  const [upperCabinetMaterial, setUpperCabinetMaterial] = useState('');
  const [wingMaterial, setWingMaterial] = useState('');
  const [stoneBrand, setStoneBrand] = useState('');
  const [glassType, setGlassType] = useState('');
  const [accessories, setAccessories] = useState('');
  const [lowerCabinetUnitPrice, setLowerCabinetUnitPrice] = useState<string>('');
  const [upperCabinetUnitPrice, setUpperCabinetUnitPrice] = useState<string>('');
  const [stoneUnitPrice, setStoneUnitPrice] = useState<string>('');
  const [glassUnitPrice, setGlassUnitPrice] = useState<string>('');
  const [accessoryCost, setAccessorCost] = useState<string>('');

  // Thông số m2 / m3 chi tiết (Sản phẩm khác như Tủ áo, Giường, v.v.)
  const [width, setWidth] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [depth, setDepth] = useState<string>('');
  // Cho chế độ chi tiết
  const [boardPanelsQty, setBoardPanelsQty] = useState<string>('');
  const [boardPanelUnitPrice, setBoardPanelUnitPrice] = useState<string>('');

  const productGroupNames: Record<ProductGroup, string> = {
    kitchen_cabinet: '1. Tủ bếp',
    wardrobe: '2. Tủ áo',
    tv_shelf: '3. Kệ tivi',
    bed: '4. Giường',
    shoe_cabinet: '5. Tủ giày',
    desk: '6. Bàn làm việc',
    document_cabinet: '7. Tủ hồ sơ',
    reception_desk: '8. Quầy lễ tân',
    wall_decor: '9. Vách trang trí',
    custom: '10. Sản phẩm tùy chỉnh'
  };

  // Cập nhật tên mặc định và phương tính giá thích hợp khi đổi loại tủ
  useEffect(() => {
    // Giữ trống các ô nhập liệu theo yêu cầu
  }, [productGroup]);

  // Tính tiền cho 1 hạng mục bất kỳ
  const calculateItemPrice = (item: Partial<QuoteItem>, currentConfig: QuoteConfig): number => {
    if (item.pricingMethod === 'quick') {
      if (item.productGroup === 'kitchen_cabinet') {
        const lCabinetPrice = (item.lowerCabinetLength || 0) * (item.lowerCabinetUnitPrice || 0);
        const uCabinetPrice = (item.upperCabinetLength || 0) * (item.upperCabinetUnitPrice || 0);
        const stoneVal = (item.lowerCabinetLength || 0) * (item.stoneUnitPrice || 0);
        const glassVal = (item.lowerCabinetLength || 0) * (item.glassUnitPrice || 0);
        const accVal = item.accessoryCost || 0;
        return (lCabinetPrice + uCabinetPrice + stoneVal + glassVal + accVal) * (item.qty || 1);
      } else {
        // Hàng khác tính theo rộng/m dài cơ bản
        const widthVal = item.width || 1.5;
        const unitPrice = item.lowerCabinetUnitPrice || 2500000; // mượn biến này làm đơn giá mét dài của sp khác
        return widthVal * unitPrice * (item.qty || 1);
      }
    } else {
      // Chế độ B: Báo giá chi tiết theo khoa học vật tư
      // Vật liệu gỗ
      const baseWoodCost = (item.boardPanelsQty || 0) * (item.boardPanelUnitPrice || 0);
      const accCost = item.accessoryCost || 0;
      
      const woodWithWastage = baseWoodCost * (1 + currentConfig.wastagePercent / 100);
      const totalHardware = accCost * (1 + currentConfig.accessoryPercent / 100);
      
      // Tổng chi phí thô
      const primeCost = woodWithWastage + totalHardware;
      
      // Các chi phí khác phân bổ theo %
      const laborCost = primeCost * (currentConfig.laborPercent / 100);
      const generalCost = primeCost * (currentConfig.generalPercent / 100);
      const profitCost = primeCost * (currentConfig.profitPercent / 100);
      
      return Math.round((primeCost + laborCost + generalCost + profitCost) * (item.qty || 1));
    }
  };

  // Cập nhật lại giá của các item trong bảng khi config tỷ lệ % thay đổi
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

  // Thêm hạng mục vào bảng báo giá nháp
  const handleAddItem = () => {
    const isKitchen = productGroup === 'kitchen_cabinet';
    const newItem: QuoteItem = {
      id: `qi_${Date.now()}`,
      productGroup,
      productName,
      qty: Number(qty),
      notes: notes || undefined,
      pricingMethod,
      width: Number(width),
      height: Number(height),
      depth: Number(depth),
      lowerCabinetLength: Number(lowerCabinetLength),
      upperCabinetLength: Number(upperCabinetLength),
      lowerCabinetMaterial,
      upperCabinetMaterial,
      wingMaterial,
      stoneBrand,
      glassType,
      accessories,
      lowerCabinetUnitPrice: Number(lowerCabinetUnitPrice),
      upperCabinetUnitPrice: Number(upperCabinetUnitPrice),
      stoneUnitPrice: Number(stoneUnitPrice),
      glassUnitPrice: Number(glassUnitPrice),
      accessoryCost: Number(accessoryCost),
      boardPanelsQty: Number(boardPanelsQty),
      boardPanelUnitPrice: Number(boardPanelUnitPrice),
      totalPrice: 0 // Sẽ điền sau
    };

    newItem.totalPrice = calculateItemPrice(newItem, config);
    setQuoteItems([...quoteItems, newItem]);
    
    // Clear bớt trạng thái gõ
    setNotes('');
  };

  const handleRemoveItem = (id: string) => {
    setQuoteItems(quoteItems.filter(item => item.id !== id));
  };

  const handleAddCustomOtherProduct = () => {
    if (!customProductOtherName.trim()) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng nhập tên sản phẩm!', type: 'warning' });
      return;
    }

    const newItem: any = {
      id: `item_custom_${Date.now()}`,
      productName: customProductOtherName.trim(),
      productType: 'Sản phẩm khác',
      calcMethod: 'Đơn chiếc / Khác',
      qty: customProductOtherQty,
      unit: 'bộ',
      unitPrice: customProductOtherUnitPrice,
      totalPrice: Number(customProductOtherQty) * Number(customProductOtherUnitPrice),
      material: customProductOtherMaterial.trim() || 'Tự chọn theo ý khách',
      notes: ''
    };

    setQuoteItems([...quoteItems, newItem]);
    
    // reset inputs
    setCustomProductOtherName('');
    setCustomProductOtherQty(1);
    setCustomProductOtherUnitPrice(1000000);
    setCustomProductOtherMaterial('Tự chọn theo ý khách');
  };

  // Tổng cộng hóa đơn
  const subtotal = quoteItems.reduce((acc, i) => acc + i.totalPrice, 0);
  const discountVal = subtotal * (config.discountPercent / 100);
  const totalQuoteAmount = subtotal - discountVal;
  const vatPercent = config.vatPercent !== undefined ? config.vatPercent : 8;
  const vatAmount = totalQuoteAmount * (vatPercent / 100);
  const totalWithVat = totalQuoteAmount + vatAmount;

  const handleSendToProject = () => {
    if (!selectedProjectId) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'Vui lòng chọn hoặc liên kết dự án ở phía trên trước khi gửi báo giá!', type: 'warning' });
      return;
    }
    if (quoteItems.length === 0) {
      addToast({ title: '⚠️ Báo giá trống', message: 'Báo giá của bạn đang trống! Vui lòng thêm ít nhất một sản phẩm.', type: 'warning' });
      return;
    }

    const targetProject = projects?.find(p => p.id === selectedProjectId);
    if (!targetProject) {
      addToast({ title: '❌ Lỗi', message: 'Không tìm thấy thông tin dự án!', type: 'error' });
      return;
    }

    const confirmSend = window.confirm(`Bạn có chắc chắn muốn liên thông gửi bảng dữ liệu báo giá này trực tiếp sang dự án "${targetProject.name}"?\nHành động này sẽ ghi đè tài liệu báo giá liên kết chính thức của dự án này.`);
    if (!confirmSend) return;

    const itemCode = `BG-HL-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const pdfName = `Bao_gia_Noi_that_${(customerName || 'Khach_hang').trim().replace(/\s+/g, '_')}.pdf`;

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
          action: 'Đã tự động gửi thông tin hồ sơ báo giá lên dự án liên thông',
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
          code: itemCode,
          content: `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nBẢNG BÁO GIÁ CHI TIẾT NỘI THẤT NĂM 2026\n--------------------------------------\nSố báo giá: ${itemCode}\nKhách hàng: ${customerName || 'Khách hàng'}\nSố điện thoại: ${customerPhone || 'Không có'}\nĐịa chỉ: ${customerAddress || 'Không có'}\nDự án liên kết: ${p.name}\n\nDANH SÁCH HẠNG MỤC SẢN PHẨM SƠ BỘ:\n${quoteItems.map((item, index) => `${index + 1}. ${item.productName} - Số lượng: ${item.qty} - Thành tiền: ${item.totalPrice.toLocaleString('vi-VN')} đ`).join('\n')}\n\n--------------------------------------\nTỔNG CỘNG CHƯA CHIẾT KHẤU: ${subtotal.toLocaleString('vi-VN')} đ\nCHIẾT KHẤU GIẢM GIÁ (${config.discountPercent}%): -${discountVal.toLocaleString('vi-VN')} đ\nTỔNG GIÁ TRỊ THÔ: ${totalQuoteAmount.toLocaleString('vi-VN')} đ\nVAT (${vatPercent}%): ${vatAmount.toLocaleString('vi-VN')} đ\nTỔNG GIÁ TRỊ TOÀN BỘ (ĐÃ BAO GỒM VAT): ${totalWithVat.toLocaleString('vi-VN')} đ\n\nNơi nhận: Khách hàng\nĐại diện bàn giao báo giá.`
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

      // Fire and forget matched tasks dbService save
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
      message: `Đã gửi file báo giá dạng PDF thành công vào trường Báo giá của dự án "${targetProject.name}"${taskUpdatedCount > 0 ? ` và cập nhật hoàn tất ${taskUpdatedCount} công việc con liên quan!` : ''}!`,
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

  const handleSaveQuote = async () => {
    if (!loadedQuote && selectedProjectId) {
      try {
        const archivedList = await dbService.archivedQuotes.list('furniture');
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
      const quoteId = loadedQuote ? loadedQuote.id : `archived_quote_${Date.now()}`;
      const quoteCode = loadedQuote ? loadedQuote.code : `BG-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`;
      
      const generatedQuote: Quote = {
        id: quoteId,
        code: quoteCode,
        customerId: finalCustomerId,
        projectId: selectedProjectId || undefined,
        projectName: projectName.trim(),
        date: new Date().toISOString().split('T')[0],
        items: quoteItems,
        config: config,
        status: 'draft',
        notes: quoteNotes,
        paymentTerms: paymentTerms,
        customerName: customerName.trim() || 'Khách mới',
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
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
        creatorId: currentUser?.id || 'emp_1',
        creatorName: currentUser?.name || 'Cán bộ Kế toán',
        sector: 'furniture',
        createdAt: loadedQuote?.createdAt || new Date().toLocaleDateString('vi-VN'),
        totalAmount: totalQuoteAmount
      };

      try {
        await dbService.archivedQuotes.save({ ...archivedRecord, sector: 'furniture' });
        
        // Update control states
        if (setIsCabinetSaved) setIsCabinetSaved(true);
        if (setIsLocked) setIsLocked(true);
        if (setLoadedQuote) setLoadedQuote(archivedRecord);

        // Dispatch custom event to trigger reloading of search dropdown
        window.dispatchEvent(new CustomEvent('hl-archived-cabinet-quotes-updated'));

        setIsSentToProject(false);

        setFeedback({
          message: `Đã lưu thành công hồ sơ báo giá nội thất ${generatedQuote.code} vào cơ sở dữ liệu!`,
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
    const activeCustomerName = customerName || 'Khách hàng vãng lai';
    const filename = `Bao_gia_Noi_that_${activeCustomerName.replace(/\s+/g, '_')}_2026.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
    
    // Tạo mốc file ảo để download
    const element = document.createElement("a");
    const file = new Blob([`EXPORT FILE ${type.toUpperCase()}: HOÀNG LONG INTERNAL ERP\n====================\nKhách hàng: ${activeCustomerName}\nGiấy tờ: Báo giá nội thất\nTổng cộng: ${totalQuoteAmount.toLocaleString('vi-VN')} VND\nThời gian: 2026-06-06`], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    setFeedback({
      message: `Đã hoàn tất trích xuất tập tin file ${type.toUpperCase()} lưu trữ tự động: ${filename}`,
      type: 'success'
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  if (showTemplateOnly) {
    return (
      <div className="space-y-6 text-left" id="cabinet_template_panel">
        {/* Tab selection */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-slate-800 pb-1 gap-4">
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => setActiveTemplateTab('quote')}
              className={`text-xs font-extrabold uppercase tracking-wider relative pb-3 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTemplateTab === 'quote' 
                  ? 'text-amber-500 border-b-2 border-amber-500' 
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
                  ? 'text-amber-500 border-b-2 border-amber-500' 
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
                  ? 'text-amber-500 border-b-2 border-amber-500' 
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
                  ? 'text-amber-500 border-b-2 border-amber-500' 
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
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30 cursor-pointer active:scale-95'
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
                <h4 className="font-extrabold text-base text-amber-500 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></span>
                  Cấu hình Header Báo giá (Logo & Doanh nghiệp) - Nội Thất
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Những thay đổi này tự động lưu trữ và áp dụng trực tiếp khi lập báo giá hoặc xuất PDF cho lĩnh vực Nội thất.
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
                        onChange={handleLogoUpload}
                        className="hidden"
                        id="company-logo-input-cabinet-tmpl"
                      />
                      <label 
                        htmlFor={isTemplateEditable ? "company-logo-input-cabinet-tmpl" : undefined}
                        className={`px-4 py-2 bg-amber-600/10 text-amber-400 hover:bg-amber-600/20 border border-amber-500/30 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 ${
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
                      className="w-full text-xs p-3 border border-slate-800 bg-slate-950 text-slate-100 rounded-lg outline-none focus:border-amber-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className="w-full text-xs p-3 border border-slate-800 bg-slate-950 text-slate-100 rounded-lg outline-none focus:border-amber-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
                      themeColor="orange"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-extrabold text-xs mb-1.5">Thông tin Liên hệ (Hotline/Email/Web)</label>
                    <RichTextEditor
                      value={companyContactInfo}
                      onChange={(html) => setCompanyContactInfo(html)}
                      disabled={!isTemplateEditable}
                      themeColor="orange"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Thông tin điều khoản và lưu ý tùy biến */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <div className="mb-4">
                <h4 className="font-extrabold text-base text-amber-500 uppercase tracking-wider flex items-center gap-2">
                  📝 Điều khoản & Ghi chú Báo giá Nội Thất
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Soạn thảo điều khoản thanh toán, phương thức đặt cọc, thông tin tài khoản ngân hàng và chính sách bảo hành mặc định cho hồ sơ Nội thất.
                </p>
              </div>
              
              <RichTextEditor
                value={paymentTerms}
                onChange={(html) => setPaymentTerms(html)}
                disabled={!isTemplateEditable}
                themeColor="orange"
              />
            </div>
          </>
        )}

        {activeTemplateTab === 'contract' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <div className="mb-2 border-b border-slate-800 pb-4">
              <h4 className="font-extrabold text-base text-amber-500 uppercase tracking-wider">
                📜 Soạn thảo Mẫu Hợp đồng Thi công Nội thất
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Cho phép tùy chỉnh nội dung hợp đồng kinh tế lĩnh vực thi công lắp đặt nội thất. Các biến màu đỏ sẽ tự động thay bằng dữ liệu thực tế khi xuất in.
              </p>
            </div>
            
            <div className="grid grid-cols-12 gap-6 mt-4">
              <div className="col-span-12 lg:col-span-8">
                <RichTextEditor
                  value={contractTemplate}
                  onChange={(html) => setContractTemplate(html)}
                  disabled={!isTemplateEditable}
                  themeColor="orange"
                />
              </div>
              <div className="col-span-12 lg:col-span-4 bg-slate-950/40 border border-slate-800 rounded-xl p-4 self-start">
                <h5 className="font-bold text-xs text-amber-400 uppercase tracking-wider mb-2">
                  Hướng dẫn chèn biến (Placeholders)
                </h5>
                <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
                  Sao chép các mã bên dưới dán vào bất kỳ vị trí nào trong hợp đồng. Hệ thống sẽ tự động thay bằng dữ liệu thực tế của dự án và bôi đỏ nổi bật khi in ấn:
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{SO_HOP_DONG}}"}</code>
                    <span className="text-slate-400 text-[10px]">Số hợp đồng (mã dự án)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{CONG_TRINH}}"}</code>
                    <span className="text-slate-400 text-[10px]">Tên công trình</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{HANG_MUC}}"}</code>
                    <span className="text-slate-400 text-[10px]">Loại công trình</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{DIA_DIEM}}"}</code>
                    <span className="text-slate-400 text-[10px]">Địa chỉ công trình</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{NGAY}}"}</code>
                    <span className="text-slate-400 text-[10px]">Ngày lập (ngày/tháng/năm)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{TEN_KHACH_HANG}}"}</code>
                    <span className="text-slate-400 text-[10px]">Tên khách hàng</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{DIA_CHI_KHACH_HANG}}"}</code>
                    <span className="text-slate-400 text-[10px]">Địa chỉ khách hàng</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{DIEN_THOAI_KHACH_HANG}}"}</code>
                    <span className="text-slate-400 text-[10px]">SĐT khách hàng</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{TONG_CONG}}"}</code>
                    <span className="text-slate-400 text-[10px]">Tổng cộng (số)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{TONG_CONG_CHU}}"}</code>
                    <span className="text-slate-400 text-[10px]">Tổng tiền bằng chữ</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{SO_TIEN_TAM_UNG}}"}</code>
                    <span className="text-slate-400 text-[10px]">Số tiền tạm ứng (50%)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{SO_TIEN_CONG_LAI}}"}</code>
                    <span className="text-slate-400 text-[10px]">Số tiền còn lại (50%)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{BANG_CHI_TIET_BÁO_GIÁ}}"}</code>
                    <span className="text-slate-400 text-[10px]">Bảng phụ lục nội thất</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTemplateTab === 'acceptance' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <div className="mb-2 border-b border-slate-800 pb-4">
              <h4 className="font-extrabold text-base text-amber-500 uppercase tracking-wider">
                📋 Soạn thảo Mẫu Biên bản Nghiệm thu Bàn giao Nội thất
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Cho phép tùy chỉnh nội dung biên bản nghiệm thu kỹ thuật và bàn giao hạng mục nội thất cho khách hàng.
              </p>
            </div>
            
            <div className="grid grid-cols-12 gap-6 mt-4">
              <div className="col-span-12 lg:col-span-8">
                <RichTextEditor
                  value={acceptanceTemplate}
                  onChange={(html) => setAcceptanceTemplate(html)}
                  disabled={!isTemplateEditable}
                  themeColor="orange"
                />
              </div>
              <div className="col-span-12 lg:col-span-4 bg-slate-950/40 border border-slate-800 rounded-xl p-4 self-start">
                <h5 className="font-bold text-xs text-amber-400 uppercase tracking-wider mb-2">
                  Hướng dẫn chèn biến (Placeholders)
                </h5>
                <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
                  Sao chép các mã bên dưới dán vào bất kỳ vị trí nào trong nghiệm thu:
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{SO_NGHIEM_THU}}"}</code>
                    <span className="text-slate-400 text-[10px]">Số nghiệm thu (mã dự án)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{SO_HOP_DONG}}"}</code>
                    <span className="text-slate-400 text-[10px]">Số hợp đồng</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{CONG_TRINH}}"}</code>
                    <span className="text-slate-400 text-[10px]">Tên công trình</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{HANG_MUC}}"}</code>
                    <span className="text-slate-400 text-[10px]">Hạng mục nghiệm thu</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{DIA_DIEM}}"}</code>
                    <span className="text-slate-400 text-[10px]">Địa chỉ công trình</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{NGAY}}"}</code>
                    <span className="text-slate-400 text-[10px]">Ngày lập (ngày/tháng/năm)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{TEN_KHACH_HANG}}"}</code>
                    <span className="text-slate-400 text-[10px]">Tên khách hàng</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{BANG_CHI_TIET_BÁO_GIÁ}}"}</code>
                    <span className="text-slate-400 text-[10px]">Bảng phụ lục bàn giao</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTemplateTab === 'liquidation' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <div className="mb-2 border-b border-slate-800 pb-4">
              <h4 className="font-extrabold text-base text-amber-500 uppercase tracking-wider">
                🤝 Soạn thảo Mẫu Biên bản Thanh lý Hợp đồng Nội thất
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Cho phép tùy chỉnh nội dung biên bản thanh lý tài chính và tất toán hợp đồng thi công nội thất.
              </p>
            </div>
            
            <div className="grid grid-cols-12 gap-6 mt-4">
              <div className="col-span-12 lg:col-span-8">
                <RichTextEditor
                  value={liquidationTemplate}
                  onChange={(html) => setLiquidationTemplate(html)}
                  disabled={!isTemplateEditable}
                  themeColor="orange"
                />
              </div>
              <div className="col-span-12 lg:col-span-4 bg-slate-950/40 border border-slate-800 rounded-xl p-4 self-start">
                <h5 className="font-bold text-xs text-amber-400 uppercase tracking-wider mb-2">
                  Hướng dẫn chèn biến (Placeholders)
                </h5>
                <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
                  Sao chép các mã bên dưới dán vào bất kỳ vị trí nào trong thanh lý:
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{SO_THANH_LY}}"}</code>
                    <span className="text-slate-400 text-[10px]">Số biên bản thanh lý</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{SO_HOP_DONG}}"}</code>
                    <span className="text-slate-400 text-[10px]">Số hợp đồng (mã dự án)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{SO_NGHIEM_THU}}"}</code>
                    <span className="text-slate-400 text-[10px]">Số nghiệm thu</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{NGAY_NGHIEM_THU}}"}</code>
                    <span className="text-slate-400 text-[10px]">Ngày nghiệm thu bàn giao</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{TEN_KHACH_HANG}}"}</code>
                    <span className="text-slate-400 text-[10px]">Tên khách hàng</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{TONG_CONG}}"}</code>
                    <span className="text-slate-400 text-[10px]">Khối lượng thanh toán thực tế</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <code className="text-amber-400 select-all font-mono">{"{{TONG_CONG_CHU}}"}</code>
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
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <div>
              <span className="font-bold text-amber-400">Chế độ tự động lưu cục bộ đang hoạt động:</span> Thay đổi được lưu vào trình duyệt này. Để đồng bộ và dùng chung cho toàn bộ ứng dụng trên các thiết bị khác nhau, vui lòng bấm nút lưu lên Cơ sở dữ liệu đám mây.
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsTemplateEditable(!isTemplateEditable)}
              className={`w-full sm:w-auto px-5 py-3 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95 ${
                isTemplateEditable 
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/50'
                  : 'bg-amber-600/15 text-amber-400 hover:bg-amber-600/25 border border-amber-500/30'
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
                try {
                  await dbService.quotationConfigs.save('furniture', {
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
                  setIsTemplateEditable(false);
                  setTimeout(() => setDbSaveSuccess(false), 4000);
                } catch (e) {
                  console.error("Lỗi khi lưu cấu hình Nội thất lên database:", e);
                } finally {
                  setDbSaving(false);
                }
              }}
              className="w-full sm:w-auto px-5 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
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
              <span className="font-bold">Lưu thành công:</span> Cấu hình mẫu hồ sơ và báo giá Nội thất đã được lưu vào hệ thống cơ sở dữ liệu đám mây và đồng bộ hóa thành công trên toàn ứng dụng!
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left" id="quote_estimator_panel">
      {feedback && (
        <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 p-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-md relative overflow-hidden" id="estimator_feedback">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>
          <span className="pl-2">{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-emerald-600 font-black hover:text-emerald-950 px-2 cursor-pointer transition-colors">✕</button>
        </div>
      )}


      {/* Bảng báo giá (Ngang rộng rãi phía dưới) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-md p-5 flex flex-col justify-between space-y-4 text-slate-800" id="quotation_analysis_panel">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-2 gap-2">
              <span className="font-extrabold text-slate-900 text-sm tracking-wide">BẢNG BÁO GIÁ</span>
            </div>

            {/* Thông tin metadata của Báo giá */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200 text-xs text-left">
              {/* Dự án (searchable custom selection) */}
              <div className="relative">
                <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1">Dự Án <span className="text-rose-500 font-bold">*</span></label>
                
                {/* Searchable Custom Trigger Button */}
                <button
                  type="button"
                  onClick={() => !isLocked && setIsProjDropdownOpen(!isProjDropdownOpen)}
                  disabled={isLocked}
                  className={`w-full bg-white text-slate-800 border border-slate-200 rounded-lg p-2.5 outline-none font-medium text-left hover:border-slate-350 focus:border-emerald-500 transition-all flex items-center justify-between shadow-sm ${
                    isLocked ? 'opacity-65 cursor-not-allowed bg-slate-50' : 'cursor-pointer'
                  }`}
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
                  <Sliders className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-2" />
                </button>

                {/* Dropdown Popup Panel */}
                {isProjDropdownOpen && (
                  <div className="absolute left-0 mt-1.5 w-72 md:w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 z-55 max-h-72 overflow-y-auto animate-scaleIn">
                    {/* Search Field inside */}
                    <div className="relative mb-2">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()} // stop close dropdown
                        className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-emerald-500 font-medium placeholder-slate-400 transition-all"
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
                        Dự án Đang Làm (Phòng dự án)
                      </div>

                      {(() => {
                        const activeProjects = projects.filter(p => p.type === 'furniture');
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
                                  ? 'bg-emerald-55 text-emerald-700 border border-emerald-300 font-bold' 
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
                  disabled={!!selectedProjectId || isLocked}
                  onChange={(e) => setProjectName(e.target.value)}
                  className={`w-full rounded-lg p-2.5 border text-xs font-semibold shadow-sm transition-all outline-none ${
                    selectedProjectId || isLocked
                      ? "bg-slate-50 border-slate-200 text-slate-550 cursor-not-allowed border-dashed" 
                      : "bg-white border-slate-200 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  }`}
                  placeholder={selectedProjectId ? "" : isLocked ? "" : "Nhập tên Dự án nội thất... *"}
                />
              </div>

              {/* Tên khách hàng */}
              <div className="relative">
                <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1">Tên Khách Hàng <span className="text-rose-500 font-bold">*</span></label>
                
                <button
                  type="button"
                  onClick={() => !isLocked && setIsCustDropdownOpen(!isCustDropdownOpen)}
                  disabled={isLocked}
                  className={`w-full bg-white text-slate-800 border border-slate-200 rounded-lg p-2.5 outline-none font-semibold text-xs text-left hover:border-slate-350 focus:border-emerald-500 transition-all flex items-center justify-between shadow-sm ${
                    isLocked ? 'opacity-65 cursor-not-allowed bg-slate-50' : 'cursor-pointer'
                  }`}
                >
                  <span className="truncate">
                    {customerName || <span className="text-slate-400 font-normal">Chọn khách hàng từ danh sách *</span>}
                  </span>
                  <span className="text-[10px] text-slate-400">▼</span>
                </button>

                {/* Dropdown list of customers */}
                {isCustDropdownOpen && (
                  <div className="absolute left-0 mt-1.5 w-72 md:w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 z-55 max-h-72 overflow-y-auto animate-scaleIn">
                    <div className="relative mb-2">
                      <input
                        type="text"
                        value={custSearchQuery}
                        onChange={(e) => setCustSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()} // stop close dropdown
                        className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-emerald-500 font-medium placeholder-slate-400 transition-all"
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
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-250 font-bold' 
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
                {!isLocked && (
                  <div className="mt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowQuickCreateCust(true)}
                      className="text-[10px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-0.5 cursor-pointer hover:underline"
                    >
                      ➕ Tạo khách hàng nhanh
                    </button>
                  </div>
                )}
              </div>

              {/* Số điện thoại */}
              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1">Số điện thoại <span className="text-rose-500 font-bold">*</span></label>
                <input
                  type="text"
                  value={customerPhone}
                  disabled={true}
                  className="w-full rounded-lg p-2.5 border border-slate-200 text-slate-550 bg-slate-50 cursor-not-allowed font-semibold text-xs border-dashed"
                  placeholder="Chọn Khách hàng để nạp SĐT *"
                />
              </div>

              {/* Địa chỉ */}
              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1">Địa chỉ <span className="text-rose-500 font-bold">*</span></label>
                <input
                  type="text"
                  value={customerAddress}
                  disabled={true}
                  className="w-full rounded-lg p-2.5 border border-slate-200 text-slate-550 bg-slate-50 cursor-not-allowed font-semibold text-xs border-dashed"
                  placeholder="Chọn Khách hàng để nạp địa chỉ *"
                />
              </div>
            </div>

            {/* Chiết khấu và VAT */}
            <div className="flex flex-col sm:flex-row justify-end items-center gap-4 mb-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200 text-xs w-full">
              {/* Chiết khấu (%) */}
              <div className="w-full sm:w-[180px] text-left">
                <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1 flex items-center justify-between">
                  <span>Chiết khấu (%)</span>
                  <span className="text-emerald-650 font-black text-[8px] bg-emerald-50 px-1 hover:bg-emerald-100 rounded border border-emerald-200 flex items-center gap-0.5">
                    % GIẢM
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={config.discountPercent}
                  disabled={isLocked}
                  onChange={(e) => {
                    const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                    handleConfigChange('discountPercent', val);
                  }}
                  className={`w-full rounded-lg p-2.5 border text-slate-900 outline-none text-xs font-semibold transition-all font-mono ${
                    isLocked ? 'bg-slate-50 border-slate-200 text-slate-550 cursor-not-allowed border-dashed' : 'bg-white border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                  }`}
                  placeholder="Nhập % chiết khấu..."
                />
              </div>

              {/* Thuế VAT (%) */}
              <div className="w-full sm:w-[180px] text-left">
                <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1 flex items-center justify-between">
                  <span>Thuế VAT (%)</span>
                  <span className="text-emerald-650 font-black text-[8px] bg-emerald-50 px-1 hover:bg-emerald-100 rounded border border-emerald-200 flex items-center gap-0.5">
                    % VAT
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={config.vatPercent !== undefined ? config.vatPercent : 8}
                  disabled={isLocked}
                  onChange={(e) => {
                    const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                    handleConfigChange('vatPercent', val);
                  }}
                  className={`w-full rounded-lg p-2.5 border text-slate-900 outline-none text-xs font-semibold transition-all font-mono ${
                    isLocked ? 'bg-slate-50 border-slate-200 text-slate-550 cursor-not-allowed border-dashed' : 'bg-white border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                  }`}
                  placeholder="Nhập % VAT..."
                />
              </div>
            </div>

            {/* THÊM SẢN PHẨM FORM */}
            {!isLocked && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6 relative z-40">
              
              {/* Header của form */}
              <div className="bg-slate-100 px-5 py-3.5 border-b border-slate-205 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-orange-50 flex items-center justify-center border border-orange-200">
                    <Calculator className="w-3.5 h-3.5 text-orange-600 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                      Thêm sản phẩm báo giá
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Bổ sung danh mục sản phẩm tiêu chuẩn hoặc nhập sản phẩm khác bên ngoài</p>
                  </div>
                </div>

                {/* Tab switchers in header */}
                <div className="flex bg-slate-200/80 rounded-lg p-0.5 border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setAddMethod('catalog')}
                    className={`px-3 py-1.5 text-[10.5px] font-bold transition-all rounded cursor-pointer flex items-center gap-1.5 ${
                      addMethod === 'catalog'
                        ? 'bg-orange-600 text-white shadow-md font-extrabold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    📂 Danh mục tiêu chuẩn
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMethod('other')}
                    className={`px-3 py-1.5 text-[10.5px] font-bold transition-all rounded cursor-pointer flex items-center gap-1.5 ${
                      addMethod === 'other'
                        ? 'bg-orange-600 text-white shadow-md font-extrabold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    ✏️ Nhập sản phẩm khác
                  </button>
                </div>
              </div>

              {addMethod === 'catalog' ? (
                <div className="p-5 space-y-5">
                
                {/* BƯỚC 1: LỰA CHỌN SẢN PHẨM & ĐỊNH LƯỢNG */}
                <div className="space-y-2">
                  <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                    BƯỚC 1: CHỌN SẢN PHẨM & ĐỊNH LƯỢNG
                  </span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 text-xs">
                    {/* Danh mục */}
                    <div className="relative md:col-span-5">
                      <label className="block text-slate-600 font-bold uppercase tracking-wider text-[9px] mb-1.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                        Danh Mục {isCatDropdownOpen ? "(Đang tìm)" : ""}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCatDropdownOpen(!isCatDropdownOpen);
                          setIsProdDropdownOpen(false);
                          setSearchCategoryQuery('');
                        }}
                        className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl p-3 text-xs text-left hover:border-slate-300 transition-all flex items-center justify-between cursor-pointer focus:ring-1 focus:ring-orange-500/20"
                      >
                        <span className="truncate font-semibold">{selectedCategory || "--- Chọn danh mục ---"}</span>
                        <Sliders className="w-3.5 h-3.5 text-orange-500 shrink-0 ml-2" />
                      </button>
                      
                      {isCatDropdownOpen && (
                        <div className="absolute right-0 left-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 z-55 max-h-60 overflow-y-auto">
                          <div className="relative mb-2">
                            <input
                              type="text"
                              value={searchCategoryQuery}
                              onChange={(e) => setSearchCategoryQuery(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-orange-500 transition-all font-medium placeholder-slate-400"
                              placeholder="Tìm nhanh danh mục..."
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
                                      ? 'bg-orange-50 text-orange-700 border border-orange-200 font-extrabold' 
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
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                        Sản phẩm {isProdDropdownOpen ? "(Đang tìm)" : ""}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsProdDropdownOpen(!isProdDropdownOpen);
                          setIsCatDropdownOpen(false);
                          setSearchProductQuery('');
                        }}
                        className={`w-full bg-white text-slate-800 border rounded-xl p-3 text-xs text-left transition-all flex items-center justify-between cursor-pointer focus:ring-1 focus:ring-orange-500/20 ${
                          selectedCategory ? 'border-slate-200 hover:border-slate-350' : 'border-slate-150 opacity-50 cursor-not-allowed'
                        }`}
                        disabled={!selectedCategory}
                      >
                        <span className="truncate font-semibold">{selectedProduct ? selectedProduct.tenSanPham : "--- Chọn sản phẩm ---"}</span>
                        <Sliders className="w-3.5 h-3.5 text-orange-500 shrink-0 ml-2" />
                      </button>
                      
                      {isProdDropdownOpen && (
                        <div className="absolute right-0 left-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 z-55 max-h-60 overflow-y-auto">
                          <div className="relative mb-2">
                            <input
                              type="text"
                              value={searchProductQuery}
                              onChange={(e) => setSearchProductQuery(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-orange-500 transition-all font-medium placeholder-slate-400"
                              placeholder="Tìm nhanh sản phẩm..."
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
                                      ? 'bg-orange-50 text-orange-700 border border-orange-200 font-extrabold' 
                                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                                  }`}
                                >
                                  <div className="font-extrabold text-slate-900">{prod.tenSanPham}</div>
                                  <div className="text-[10px] text-slate-550 mt-1 select-none leading-normal">{prod.chatLieu}</div>
                                </button>
                              ))}
                            {catalogProducts.filter(p => p.danhMuc === selectedCategory && p.tenSanPham.toLowerCase().includes(searchProductQuery.toLowerCase())).length === 0 && (
                              <div className="text-center py-2.5 text-slate-500 italic text-[11px]">Không thấy sản phẩm</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Đơn vị vị tính & Định lượng */}
                    <div className="md:col-span-2 grid grid-cols-2 gap-2 text-left">
                      <div>
                        <label className="block text-slate-600 font-bold uppercase tracking-wider text-[9px] mb-1.5 truncate">
                          Đơn Vị
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={selectedProduct ? selectedProduct.donVi : "---"}
                          className="w-full bg-slate-50 text-slate-500 border border-slate-200 rounded-xl p-3 text-xs font-bold text-center outline-none select-none cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-bold uppercase tracking-wider text-[9px] mb-1.5 truncate">
                          Số lượng
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={productQty}
                          onChange={(e) => setProductQty(e.target.value)}
                          className="w-full bg-white text-slate-905 border border-slate-200 rounded-xl p-3 text-xs font-bold font-mono outline-none focus:border-orange-500 text-center"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* BƯỚC 2: CẤU HÌNH CHI TIẾT CHẤT LIỆU & ĐƠN GIÁ */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1 border-t border-slate-200 text-xs text-left">
                  
                  {/* Cột Trái: Chất liệu thi công */}
                  <div className="lg:col-span-6 space-y-2">
                    <div>
                      <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                        BƯỚC 2A: CHẤT LIỆU THI CÔNG
                      </span>
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3">
                      <div>
                        <span className="block text-slate-500 font-extrabold text-[9px] uppercase tracking-wider mb-1.5">
                          Mẫu liên kết nhanh của sản phẩm:
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
                                    ? 'bg-orange-50 border-orange-500 text-orange-700 font-extrabold' 
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
                            onClick={() => handleMaterialOptionChange('Tự nhập')}
                            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                              selectedMaterialOption === 'Tự nhập' 
                                ? 'bg-orange-50 border-orange-500 text-orange-700 font-extrabold' 
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            Tự nhập nội dung khác
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={3.5}
                        value={customMaterial}
                        onChange={(e) => {
                          setCustomMaterial(e.target.value);
                          setSelectedMaterialOption('Tự nhập');
                        }}
                        className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 resize-none font-semibold leading-relaxed"
                        placeholder="Hãy chọn mẫu có sẵn của sản phẩm ở trên hoặc tự do ghi chú chi tiết kết cấu tại đây..."
                      />
                    </div>
                  </div>

                  {/* Cột Phải: Phương án đơn giá */}
                  <div className="lg:col-span-6 space-y-2">
                    <div>
                      <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                        BƯỚC 2B: CHỌN ĐƠN GIÁ BÁO GIÁ
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                      <span className="block text-slate-500 font-extrabold text-[9px] uppercase tracking-wider mb-2 text-left">
                        Phương án giá liên kết phát hiện: Lựa chọn một phương án phù hợp
                      </span>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {getProductLinkedPrices().map((pr: any) => {
                          const isSelected = selectedPriceOption === pr.tenGia;
                          return (
                            <label 
                              key={pr.id} 
                              className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all text-left ${
                                isSelected 
                                  ? 'bg-orange-50 border-orange-500 text-orange-750 shadow-sm ring-1 ring-orange-500/10' 
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <input
                                type="radio"
                                name="priceOption"
                                checked={isSelected}
                                onChange={() => handlePriceOptionChange(pr.tenGia)}
                                className="hidden"
                              />
                              <div className="pt-0.5">
                                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${
                                  isSelected ? 'border-orange-500 bg-orange-600' : 'border-slate-300 bg-white'
                                }`}>
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                                </div>
                              </div>
                              <div className="flex flex-col">
                                <span className="font-extrabold text-[11px] text-slate-800 transition-colors">{pr.tenGia}</span>
                                <span className="font-bold font-mono text-[11px] text-orange-600 mt-1">
                                  {(pr.donGia).toLocaleString('vi-VN')} đ <span className="text-[9px] text-slate-500 font-normal shadow-none">/{selectedProduct?.donVi || 'đơn vị'}</span>
                                </span>
                              </div>
                            </label>
                          );
                        })}
                        
                        {/* Custom Price selection */}
                        <label 
                          className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all text-left ${
                            selectedPriceOption === 'Tự chọn' 
                              ? 'bg-orange-50 border-orange-500 text-orange-750 shadow-sm ring-1 ring-orange-500/10' 
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="priceOption"
                            checked={selectedPriceOption === 'Tự chọn'}
                            onChange={() => handlePriceOptionChange('Tự chọn')}
                            className="hidden"
                          />
                          <div className="pt-0.5">
                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${
                              selectedPriceOption === 'Tự chọn' ? 'border-orange-500 bg-orange-600' : 'border-slate-300 bg-white'
                            }`}>
                              {selectedPriceOption === 'Tự chọn' && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                            </div>
                          </div>
                          <div className="flex flex-col w-full">
                            <span className="font-extrabold text-[11px] text-slate-800">Tùy chọn đơn giá khác</span>
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
                                className="w-full bg-white text-orange-600 border border-slate-200 rounded px-2 py-0.5 text-[11px] font-bold font-mono focus:border-orange-500 outline-none"
                              />
                            </div>
                          </div>
                        </label>
                      </div>

                      {selectedProduct && getProductLinkedPrices().length === 0 && (
                        <div className="text-slate-500 italic text-[10px] py-3.5 bg-slate-50 rounded-xl text-center border border-slate-200 mt-2">
                          Sản phẩm này chưa được gán tập đơn giá liên kết nào trong danh mục.
                        </div>
                      )}
                      {!selectedProduct && (
                        <div className="text-slate-500 italic text-[10.5px] py-4 bg-slate-50 rounded-xl text-center border border-slate-200 mt-2">
                          Vui lòng chỉ định dòng sản phẩm ở Bước 1 để tự động đồng bộ & hiển thị các mức đơn giá...
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* BƯỚC 3: TỔNG HỢP & NẠP VÀO BẢNG BÁO GIÁ */}
                {selectedProduct && (
                  <div className="bg-orange-50 border border-orange-200/60 rounded-2xl p-4.5 flex flex-col md:flex-row items-center justify-between gap-4 animate-scale-up text-left">
                    <div className="space-y-1 text-center md:text-left">
                      <div className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                        BÁO CÁO TỔNG HỢP KIỂM SOÁT NHANH
                      </div>
                      <div className="text-xs text-slate-850 leading-relaxed">
                        Đang soạn: <span className="font-extrabold text-orange-600">{selectedProduct.tenSanPham}</span> ({selectedProduct.id})
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium font-sans">
                        Phương án: <span className="font-bold text-slate-800">{selectedPriceOption}</span> — Đơn giá: <span className="font-extrabold font-mono text-slate-900">{(typeof chosenPrice === 'number' ? chosenPrice : parseInt(chosenPrice) || 0).toLocaleString('vi-VN')} đ/{selectedProduct.donVi}</span> x <span className="font-extrabold font-mono text-slate-900">{productQty || 0}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                      <div className="text-center sm:text-right">
                        <div className="text-[9px] uppercase font-bold tracking-widest text-slate-500">TỔNG KHỐI LƯỢNG SƠ BỘ</div>
                        <div className="text-lg font-black font-mono text-orange-600 tracking-tight">
                          {((typeof chosenPrice === 'number' ? chosenPrice : parseInt(chosenPrice) || 0) * (typeof productQty === 'number' ? productQty : parseInt(productQty) || 0)).toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-500">đ</span>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={handleAddProductToQuote}
                        className="w-full sm:w-auto bg-orange-600 hover:bg-orange-550 active:bg-orange-700 text-white font-extrabold py-3 px-6 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-orange-700/20"
                      >
                        <Plus className="w-4 h-4 shrink-0" />
                        Thêm sản phẩm
                      </button>
                    </div>
                  </div>
                )}

              </div>
              ) : (
                /* NHẬP SẢN PHẨM KHÁC FORM BODY */
                <div className="p-5 space-y-5 animate-scaleIn text-left">
                  <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                    BẢNG ĐĂNG KÝ HẠNG MỤC PHỤ TRỢ NGOÀI DANH MỤC
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Tên sản phẩm */}
                    <div className="md:col-span-4">
                      <label className="block text-slate-600 font-bold uppercase tracking-wider text-[9px] mb-1.5">
                        Tên sản phẩm khác <span className="text-rose-500 font-extrabold">*</span>
                      </label>
                      <input
                        type="text"
                        value={customProductOtherName}
                        onChange={(e) => setCustomProductOtherName(e.target.value)}
                        className="w-full bg-white text-slate-950 border border-slate-200 rounded-xl p-3 text-xs focus:border-orange-500 outline-none font-semibold transition-all placeholder-slate-400"
                        placeholder="Ví dụ: Thiết kế bổ sung vườn ban công, lót gạch..."
                      />
                    </div>

                    {/* Chất liệu */}
                    <div className="md:col-span-4">
                      <label className="block text-slate-600 font-bold uppercase tracking-wider text-[9px] mb-1.5">
                        Chất liệu
                      </label>
                      <input
                        type="text"
                        value={customProductOtherMaterial}
                        onChange={(e) => setCustomProductOtherMaterial(e.target.value)}
                        className="w-full bg-white text-slate-950 border border-slate-200 rounded-xl p-3 text-xs focus:border-orange-500 outline-none font-semibold transition-all placeholder-slate-400"
                        placeholder="Ví dụ: Gỗ công nghiệp An Cường, Nhựa Picomat..."
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
                        onChange={(e) => setCustomProductOtherQty(e.target.value)}
                        className="w-full bg-white text-slate-950 border border-slate-200 rounded-xl p-3 text-xs focus:border-orange-500 outline-none font-bold font-mono transition-all text-center"
                      />
                    </div>

                    {/* Đơn giá */}
                    <div className="md:col-span-2">
                      <label className="block text-slate-600 font-bold uppercase tracking-wider text-[9px] mb-1.5">
                        Đơn giá (đ) <span className="text-rose-500 font-extrabold">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={customProductOtherUnitPrice}
                        onChange={(e) => setCustomProductOtherUnitPrice(e.target.value)}
                        className="w-full bg-white text-orange-600 border border-slate-200 rounded-xl p-3 text-xs focus:border-orange-500 outline-none font-bold font-mono transition-all"
                        placeholder="Nhập giá mỗi sản phẩm..."
                      />
                    </div>
                  </div>

                  {/* Summary row */}
                  <div className="bg-orange-50 border border-orange-200/60 rounded-2xl p-4.5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="space-y-1 text-center md:text-left">
                      <div className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                        BÁO CÁO TỔNG HỢP SẢN PHẨM KHÁC
                      </div>
                      <div className="text-xs text-slate-800 leading-relaxed font-sans">
                        Chất liệu: <span className="font-extrabold text-slate-600">{customProductOtherMaterial || 'Tự chọn theo ý khách'}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium">
                        Tổng tạm tính: <span className="font-extrabold font-mono text-slate-900">{(typeof customProductOtherUnitPrice === 'number' ? customProductOtherUnitPrice : parseInt(customProductOtherUnitPrice) || 0).toLocaleString('vi-VN')} đ</span> x <span className="font-extrabold font-mono text-slate-900">{customProductOtherQty || 0}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                      <div className="text-center sm:text-right">
                        <div className="text-[9px] uppercase font-bold tracking-widest text-slate-500">TỔNG KHỐI LƯỢNG SƠ BỘ</div>
                        <div className="text-lg font-black font-mono text-orange-600 tracking-tight">
                          {((typeof customProductOtherQty === 'number' ? customProductOtherQty : parseInt(customProductOtherQty) || 0) * (typeof customProductOtherUnitPrice === 'number' ? customProductOtherUnitPrice : parseInt(customProductOtherUnitPrice) || 0)).toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-500">đ</span>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={handleAddCustomOtherProduct}
                        className="w-full sm:w-auto bg-orange-600 hover:bg-orange-550 active:bg-orange-700 text-white font-extrabold py-3 px-6 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-orange-700/20"
                      >
                        <Plus className="w-4 h-4 shrink-0" />
                        Thêm sản phẩm
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Table hiện có */}
            <div className="overflow-x-auto min-h-[180px]">
              <table className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-800 font-bold">
                  <tr>
                    <th className="px-3 py-2.5 text-center w-12 text-slate-700">STT</th>
                    <th className="px-3 py-2 text-slate-700">Tên sản phẩm</th>
                    <th className="px-3 py-2 text-slate-700">Chất liệu</th>
                    <th className="px-3 py-2 text-center text-slate-700">Số lượng</th>
                    <th className="px-3 py-2 text-center text-slate-700">Đơn vị</th>
                    <th className="px-3 py-2 text-right text-slate-700">Đơn giá</th>
                    <th className="px-3 py-2 text-right text-slate-700">Thành tiền</th>
                    <th className="px-3 py-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {quoteItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400 font-medium italic">
                        Chưa có sản phẩm nào trong báo giá này. Hãy chọn và thêm từ khung phía trên.
                      </td>
                    </tr>
                  ) : (
                    quoteItems.map((item, idx) => {
                      const unitVal = item.unit || 'm';
                      const defaultMat = item.material || 'Gỗ MDF An Cường chống ẩm';
                      const uPrice = item.unitPrice || 0;
                      return (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2.5 text-center text-slate-500 font-semibold">{idx + 1}</td>
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-slate-900">{item.productName}</div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 max-w-[200px] truncate" title={defaultMat}>
                            {defaultMat}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-900">{item.qty}</td>
                          <td className="px-3 py-2.5 text-center text-slate-500">{unitVal}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600 font-mono">{(uPrice).toLocaleString('vi-VN')} đ</td>
                          <td className="px-3 py-2.5 text-right font-extrabold text-emerald-600 font-mono">{(item.totalPrice).toLocaleString('vi-VN')} đ</td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              onClick={() => !isLocked && handleRemoveItem(item.id)}
                              disabled={isLocked}
                              className={`text-rose-500 hover:text-rose-600 p-1 transition-colors ${
                                isLocked ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'
                              }`}
                              title={isLocked ? 'Không thể xóa khi hồ sơ đang bị khóa' : 'Xóa dòng này'}
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
              <span>Hạng tổng thô các mục:</span>
              <span className="text-right font-mono font-bold text-slate-800">{subtotal.toLocaleString('vi-VN')} đ</span>
              
              <span>Tổng Chiết Khấu ({config.discountPercent}%):</span>
              <span className="text-right font-mono font-bold text-rose-600">-{discountVal.toLocaleString('vi-VN')} đ</span>
              
              <span>Tổng giá trị thô:</span>
              <span className="text-right font-mono font-semibold text-slate-700">{totalQuoteAmount.toLocaleString('vi-VN')} đ</span>

              <span>Thuế VAT ({vatPercent}%):</span>
              <span className="text-right font-mono font-bold text-emerald-650">+{vatAmount.toLocaleString('vi-VN')} đ</span>

              <div className="col-span-2 border-t border-slate-100 my-1.5"></div>
              
              <span className="text-sm font-bold text-slate-800">TỔNG GIÁ TRỊ TOÀN BỘ (ĐÃ CÓ VAT):</span>
              <span className="text-right text-base font-extrabold text-emerald-600 font-mono">{totalWithVat.toLocaleString('vi-VN')} đ</span>
            </div>

            {/* Các điều khoản */}
            <div className="grid grid-cols-1 gap-2 border-t border-slate-200 pt-3 text-[11px]">
              <div>
                <label className="block text-slate-600 font-semibold mb-0.5 text-left">Tiền bằng chữ</label>
                <div className="bg-slate-50 border border-slate-200 text-emerald-700 rounded px-2.5 py-1.5 font-bold italic text-left">
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
                disabled={!isCabinetSaved || !isLocked}
                className="bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-30 disabled:cursor-not-allowed font-semibold px-4 py-2.5 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-200 shadow-md"
                title={!isCabinetSaved ? "Nút Chỉnh sửa chỉ mở khi hồ sơ Đã Lưu" : !isLocked ? "Đang trong chế độ chỉnh sửa" : "Chỉnh sửa số liệu báo giá"}
              >
                <Edit className="w-4 h-4" />
                Chỉnh sửa
              </button>

              {/* Nút Lưu / Đã Lưu */}
              <button
                type="button"
                onClick={handleSaveQuote}
                disabled={(isCabinetSaved && isLocked) || quoteItems.length === 0 || (!selectedProjectId && !projectName.trim()) || !customerName.trim() || !customerPhone.trim() || !customerAddress.trim()}
                className={`${isCabinetSaved && isLocked ? 'bg-slate-500 hover:bg-slate-500 cursor-not-allowed' : 'bg-[#00a651] hover:bg-[#008f43]'} text-white disabled:opacity-30 disabled:cursor-not-allowed font-semibold px-4 py-2.5 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-200 shadow-md`}
                title={(!selectedProjectId && !projectName.trim()) || !customerName.trim() || !customerPhone.trim() || !customerAddress.trim() ? "Vui lòng nhập đầy đủ các trường bắt buộc (DỰ ÁN/TÊN DỰ ÁN, TÊN KHÁCH HÀNG, SỐ ĐIỆN THOẠI, ĐỊA CHỈ)" : isCabinetSaved && isLocked ? "Hồ sơ đã được lưu" : "Lưu hồ sơ báo giá"}
              >
                {isCabinetSaved && isLocked ? (
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
                    id: loadedQuote ? loadedQuote.id : `archived_quote_${Date.now()}`,
                    code: loadedQuote ? loadedQuote.code : `BG-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`,
                    customerId: selectedCustomerId,
                    projectId: selectedProjectId || undefined,
                    projectName: projectName.trim(),
                    date: new Date().toISOString().split('T')[0],
                    items: quoteItems,
                    config: config,
                    status: 'draft' as const,
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
                    sector: 'furniture' as const,
                    createdAt: loadedQuote?.createdAt || new Date().toLocaleDateString('vi-VN'),
                    totalAmount: totalQuoteAmount
                  };
                  setSavedQuoteForPreview(archivedRecord);
                }}
                disabled={!isCabinetSaved || !isLocked}
                className="bg-indigo-600 hover:bg-indigo-550 text-white disabled:opacity-30 disabled:cursor-not-allowed font-semibold px-4 py-2.5 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-200 shadow-md"
                title={!isCabinetSaved ? "Vui lòng lưu hồ sơ trước khi Xem & In" : !isLocked ? "Vui lòng hoàn tất chỉnh sửa và lưu trước khi Xem & In" : "Xem chi tiết & In ấn"}
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
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-250">
                    <FileText className="w-4 h-4 text-[#00a651]" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                      Xem chi tiết hóa đơn báo giá
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium">Báo giá vừa tạo - HOANG LONG ERP</p>
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
                  className="px-5 py-2.5 bg-[#00a651] hover:bg-[#008f45] text-white font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-all hover:scale-[1.01]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  In Báo Giá
                </button>
              </div>
            </div>
          </div>
        )}

      {showExistsAlert && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[250] p-4 animate-scaleIn">
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

      {showQuickCreateCust && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[220] p-4 text-left font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm text-slate-800 shadow-2xl overflow-hidden animate-scaleIn p-6">
            <h4 className="font-extrabold text-sm uppercase text-slate-900 tracking-wider mb-4 flex items-center gap-1">
              <span>➕ Tạo Khách Hàng Nhanh</span>
            </h4>
            <div className="space-y-3.5">
              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1">Tên khách hàng *</label>
                <input
                  type="text"
                  value={quickCustName}
                  onChange={(e) => setQuickCustName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 font-medium text-slate-900"
                  placeholder="Nhập tên khách hàng..."
                />
              </div>
              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1">Số điện thoại *</label>
                <input
                  type="text"
                  value={quickCustPhone}
                  onChange={(e) => setQuickCustPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 font-medium text-slate-900"
                  placeholder="Nhập số điện thoại..."
                />
              </div>
              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px] mb-1">Địa chỉ *</label>
                <input
                  type="text"
                  value={quickCustAddress}
                  onChange={(e) => setQuickCustAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 font-medium text-slate-900"
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
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-extrabold hover:bg-emerald-700 transition-colors shadow cursor-pointer opacity-90 hover:opacity-100"
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
