import React, { useState, useEffect, useMemo } from 'react';
import { Printer, CheckCircle2, FileCheck } from 'lucide-react';
import { docSoTiengViet } from './QuotationTableSheet';
import { dbService } from '../lib/dbService';
import { useNotification } from '../context';

const DEFAULT_MECH_CONTRACT_TEMPLATE = `<h3 style="text-align: center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align: center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align: center; margin-top: -10px;">• • • • • • • • • • • • • • •</div>
<h2 style="text-align: center; margin-top: 20px; font-family: 'Times New Roman', Times, serif; letter-spacing: 1px;"><strong>HỢP ĐỒNG KINH TẾ (THI CÔNG CƠ KHÍ)</strong></h2>
<p style="text-align: center; font-style: italic;">Số: {{SO_HOP_DONG}}</p>

<p><strong>CÔNG TRÌNH:</strong> {{CONG_TRINH}}</p>
<p><strong>HẠNG MỤC:</strong> {{HANG_MUC}}</p>
<p><strong>ĐỊA ĐIỂM:</strong> {{DIA_DIEM}}</p>

<p><em>- Căn cứ Bộ luật Dân sự số 91/2015/QH13 ban hành ngày 24/11/2015;</em></p>
<p><em>- Căn cứ Luật Thương mại số 36/2005/QH11 ban hành ngày 14/06/2005;</em></p>
<p><em>- Căn cứ vào nhu cầu và khả năng thực tế của hai bên.</em></p>

<p>Hôm nay, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}, chúng tôi gồm có:</p>

<p><strong>BÊN GIAO THẦU (BÊN A): {{TEN_KHACH_HANG}}</strong></p>
<ul>
  <li>Địa chỉ: {{DIA_CHI_KHACH_HANG}}</li>
  <li>Điện thoại: {{DIEN_THOAI_KHACH_HANG}}</li>
  <li>Mã số thuế: {{MST_KHACH_HANG}}</li>
  <li>Số tài khoản: {{STK_KHACH_HANG}}</li>
  <li>Đại diện bởi: {{DAI_DIEN_KHACH_HANG}} - Chức vụ: {{CHUC_VU_KHACH_HANG}}</li>
</ul>

<p><strong>BÊN NHẬN THẦU (BÊN B): {{TEN_CONG_TY}}</strong></p>
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
Mọi tranh chấp được giải quyết qua thương lượng hài hòa. Trường hợp chậm trễ tiến độ thi công do lỗi chủ quan sẽ bị phạt 0.1% giá trị hợp đồng cho mỗi ngày chậm trễ nhưng không vượt quá 12% tổng giá trị.</p>

<p><strong>ĐIỀU 8: ĐIỀU KHOẢN CHUNG</strong><br />
Hợp đồng này có hiệu lực từ ngày ký đến khi hoàn tất thanh lý. Hợp đồng lập thành 03 bản có giá trị pháp lý tương đương, Bên A giữ 01 bản, Bên B giữ 02 bản.</p>

<p style="margin-top: 40px; font-weight: bold;">PHỤ LỤC 01: DANH SÁCH CHI TIẾT SẢN PHẨM GIA CÔNG CƠ KHÍ</p>
<p>{{BANG_CHI_TIET_BÁO_GIÁ}}</p>
`;

const DEFAULT_CONS_CONTRACT_TEMPLATE = `<h3 style="text-align: center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align: center;"><strong>Độc lập – Tự do – Hạnh phúc</strong></p>
<div style="text-align: center; margin-top: -10px;">• • • • • • • • • • • • • • •</div>
<p style="text-align: right; font-style: italic;">Số: {{SO_HOP_DONG}}/HĐ-XD</p>
<h2 style="text-align: center; margin-top: 20px;"><strong>HỢP ĐỒNG XÂY DỰNG (THI CÔNG TRỌN GÓI)</strong></h2>

<p><em>Căn cứ:</em></p>
<p><em>- Luật Xây dựng số 50/2014/QH13 (sửa đổi bởi Luật số 62/2020/QH14);</em></p>
<p><em>- Nghị định số 37/2015/NĐ-CP ngày 22/4/2015 về hợp đồng xây dựng;</em></p>
<p><em>- Bộ luật Dân sự số 91/2015/QH13; hồ sơ mời thầu, hồ sơ dự thầu và tài liệu kèm theo (nếu có).</em></p>

<p>Hôm nay, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}, tại {{DIA_DIEM_KY}}, chúng tôi gồm:</p>

<p><strong>BÊN GIAO THẦU (BÊN A):</strong></p>
<ul>
  <li>Tên công ty/Chủ đầu tư: {{TEN_KHACH_HANG}}</li>
  <li>Địa chỉ: {{DIA_CHI_KHACH_HANG}}</li>
  <li>Mã số thuế: {{MST_KHACH_HANG}}</li>
  <li>Đại diện: {{DAI_DIEN_KHACH_HANG}} Chức vụ: {{CHUC_VU_KHACH_HANG}}</li>
  <li>Điện thoại: {{DIEN_THOAI_KHACH_HANG}} Email: {{EMAIL_KHACH_HANG}}</li>
</ul>

<p><strong>BÊN NHẬN THẦU (BÊN B):</strong></p>
<ul>
  <li>Tên công ty: {{TEN_CONG_TY}}</li>
  <li>Địa chỉ: {{DIA_CHI_CONG_TY}}</li>
  <li>Mã số thuế: {{MST_CONG_TY}}</li>
  <li>Đại diện: {{DAI_DIEN_CONG_TY}} Chức vụ: {{CHUC_VU_CONG_TY}}</li>
  <li>Điện thoại: {{DIEN_THOAI_CONG_TY}} Email: {{EMAIL_CONG_TY}}</li>
</ul>

<p>Hai bên thống nhất ký kết Hợp đồng xây dựng với các điều khoản sau:</p>

<p><strong>Điều 1. Nội dung và khối lượng công việc</strong></p>
<p>1.1. Tên công trình: {{CONG_TRINH}}</p>
<p>1.2. Địa điểm xây dựng: {{DIA_DIEM}}</p>
<p>1.3. Loại, cấp công trình: {{LOAI_CAP_CONG_TRINH}}</p>
<p>1.4. Quy mô / Diện tích: {{QUY_MO_DIEN_TICH}}</p>
<p>1.5. Nội dung công việc nhận thầu: Bên Nhận thầu thực hiện thi công xây dựng, cung cấp vật tư, nhân công, máy móc thiết bị để hoàn thành công trình theo hồ sơ thiết kế, bản vẽ thi công và các tài liệu kèm theo được duyệt.</p>
<p>Bảng khối lượng công việc:</p>
<p>{{BANG_CHI_TIET_BÁO_GIÁ}}</p>

<p><strong>Điều 2. Chất lượng và yêu cầu kỹ thuật</strong></p>
<p>2.1. Công trình phải được thi công đúng thiết kế được duyệt, tuân thủ các tiêu chuẩn, quy chuẩn kỹ thuật quốc gia (TCVN, QCVN) hiện hành và các quy định về quản lý chất lượng công trình xây dựng.</p>
<p>2.2. Vật liệu, thiết bị đưa vào công trình phải có chứng chỉ xuất xứ, chứng nhận hợp quy và được nghiệm thu trước khi sử dụng.</p>

<p><strong>Điều 3. Thời gian thực hiện hợp đồng</strong></p>
<p>3.1. Ngày khởi công: {{NGAY_KHOI_CONG}}</p>
<p>3.2. Ngày hoàn thành: {{NGAY_HOAN_THANH}}</p>
<p>3.3. Tiến độ thi công tổng thể được lập chi tiết, chia theo các giai đoạn: chuẩn bị mặt bằng, thi công phần móng, phần thân, hoàn thiện và nghiệm thu bàn giao.</p>
<p>3.4. Bên Nhận thầu được gia hạn tiến độ trong trường hợp bất khả kháng, do lỗi của Bên Giao thầu hoặc phát sinh khối lượng được chấp thuận, với thời gian gia hạn tương ứng.</p>

<p><strong>Điều 4. Giá hợp đồng và điều chỉnh giá</strong></p>
<p>4.1. Loại giá hợp đồng: {{LOAI_GIA_HOP_DONG}}</p>
<p>4.2. Giá trị hợp đồng: {{TONG_CONG}} VNĐ (Bằng chữ: {{TONG_CONG_CHU}})</p>
<p>4.3. Việc điều chỉnh giá hợp đồng thực hiện theo Điều 143 Luật Xây dựng 2020 và Nghị định 37/2015/NĐ-CP, áp dụng đối với hợp đồng theo đơn giá điều chỉnh hoặc khi có thay đổi khối lượng, chính sách của Nhà nước.</p>

<p><strong>Điều 5. Tạm ứng, thanh toán và quyết toán</strong></p>
<p>5.1. Tạm ứng: {{SO_TIEN_TAM_UNG}} VNĐ (tương đương với {{TY_LE_TAM_UNG}}% tổng giá trị hợp đồng)</p>
<p>5.2. Thanh toán theo tiến độ thực hiện trên cơ sở khối lượng hoàn thành được nghiệm thu, thành nhiều đợt; mỗi đợt thanh toán khấu trừ tương ứng phần tạm ứng đã cấp.</p>
<p>5.3. Tài khoản: {{STK_CONG_TY}}</p>
<p>5.4. Quyết toán hợp đồng được lập sau khi công trình hoàn thành, nghiệm thu và bàn giao đưa vào sử dụng theo quy định.</p>

<p><strong>Điều 6. Bảo đảm thực hiện hợp đồng</strong></p>
<p>6.1. Bảo lãnh thực hiện hợp đồng: {{GIA_TRI_BAO_LANH}}</p>

<p><strong>Điều 7. Bảo hiểm công trình</strong></p>
<p>7.1. Giá trị bảo hiểm công trình: {{GIA_TRI_BAO_HIEM}}</p>

<p><strong>Điều 8. An toàn lao động và vệ sinh môi trường</strong></p>
<p>8.1. Bên Nhận thầu chịu trách nhiệm bảo đảm an toàn lao động, phòng chống cháy nổ và vệ sinh môi trường tại công trường theo quy định pháp luật.</p>

<p><strong>Điều 9. Điều chỉnh, tạm dừng, chấm dứt hợp đồng</strong></p>
<p>9.1. Hợp đồng có thể được điều chỉnh, tạm dừng hoặc chấm dứt theo thỏa thuận hoặc theo quy định tại Nghị định 37/2015/NĐ-CP khi một bên vi phạm nghiêm trọng hoặc do bất khả kháng kéo dài.</p>

<p><strong>Điều 10. Nghiệm thu và bàn giao công trình</strong></p>
<p>10.1. Việc nghiệm thu được thực hiện theo từng giai đoạn với sự tham gia của các bên liên quan, lập biên bản nghiệm thu theo mẫu.</p>
<p>10.2. Công trình được bàn giao cho Bên Giao thầu sau khi nghiệm thu hoàn thành và đủ điều kiện đưa vào sử dụng theo quy định.</p>

<p><strong>Điều 11. Bảo hành công trình</strong></p>
<p>11.1. Thời gian bảo hành công trình: {{THOI_GIAN_BAO_HANH}}</p>
<p>11.2. Bảo lãnh bảo hành: {{GIA_TRI_BAO_LANH_BAO_HANH}}</p>

<p><strong>Điều 12. Phạt vi phạm</strong></p>
<p>12.1. Phạt chậm tiến độ: {{TI_LE_PHAT_CHAM}}%/ngày tính trên giá trị phần việc bị chậm.</p>

<p><strong>Điều 13. Quyền và nghĩa vụ của Bên Giao thầu</strong></p>
<p>a) Bàn giao mặt bằng, hồ sơ thiết kế và các điều kiện cần thiết cho thi công;</p>
<p>b) Thanh toán đầy đủ, đúng hạn theo Điều 5;</p>
<p>c) Tổ chức giám sát, nghiệm thu công trình.</p>

<p><strong>Điều 14. Quyền và nghĩa vụ của Bên Nhận thầu</strong></p>
<p>a) Thi công đúng thiết kế, tiến độ, bảo đảm chất lượng và an toàn;</p>
<p>b) Cung cấp vật tư, nhân lực, thiết bị đáp ứng yêu cầu công trình;</p>
<p>c) Bảo hành công trình theo Điều 11.</p>

<p><strong>Điều 15. Bất khả kháng</strong></p>
<p>15.1. Các trường hợp thiên tai, hỏa hoạn, lũ lụt, dịch bệnh, chiến tranh hoặc thay đổi luật pháp ngăn cản trực tiếp việc thi công được coi là bất khả kháng.</p>

<p><strong>Điều 16. Giải quyết tranh chấp</strong></p>
<p>16.1. Mọi tranh chấp được giải quyết trước hết qua thương lượng hòa giải. Nếu không thành công sẽ đưa ra Tòa án nhân dân có thẩm quyền.</p>

<p><strong>Điều 17. Điều khoản chung</strong></p>
<p>17.1. Hợp đồng này có hiệu lực kể từ ngày ký và lập thành 04 bản, mỗi bên giữ 02 bản.</p>

<p style="margin-top: 30px;"><strong>ĐẠI DIỆN BÊN A &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ĐẠI DIỆN BÊN B</strong></p>
<p><em>(Ký, ghi rõ họ tên) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (Ký, ghi rõ họ tên và đóng dấu)</em></p>
`;

const DEFAULT_FURN_CONTRACT_TEMPLATE = `<h3 style="text-align: center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
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

interface ContractDocumentProps {
  quoteData: any;
}

export default function ContractDocument({ quoteData }: ContractDocumentProps) {
  const { addToast } = useNotification();
  const items = quoteData.items || [];
  const discountPercent = quoteData.discountPercent || 0;
  const rawTotal = items.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
  const discountValue = rawTotal * (discountPercent / 100);
  const subtotalAfterDiscount = rawTotal - discountValue;
  const vatAmount = Math.round(subtotalAfterDiscount * 0.08); // 8% VAT
  const grandTotal = subtotalAfterDiscount + vatAmount;

  // Detect sector
  const isMechanical = quoteData.sector === 'mechanical';
  const isConstruction = quoteData.sector === 'construction';
  const isFurniture = !isMechanical && !isConstruction; // Anything else is furniture/cabinet

  // ===== REVERSE CALCULATION FOR CONSTRUCTION FINAL QUOTE =====
  // When a final quote result is selected, we reverse-calculate the unit prices
  // Formula: Selected Final Quote Result ÷ % ratio of each Product/Spec = Unit Price
  const contractItems = useMemo(() => {
    if (!isConstruction || !quoteData.selectedFinalResult) {
      return items;
    }

    // Get the final items from the final quote
    const finalItems = quoteData.finalItems || [];
    if (finalItems.length === 0) return items;

    // Selected final amount (from the Final Quote selection)
    const selectedFinalAmount = quoteData.selectedFinalResult === 'preEstimate'
      ? (quoteData.preEstimateAmount || rawTotal)
      : (quoteData.takeoffCostTotal || rawTotal);

    // Calculate total of final items amounts (using their qty * default price as base ratio)
    const totalFinalBaseCost = finalItems.reduce((sum: number, item: any) => {
      return sum + (item.qty * item.price);
    }, 0);

    if (totalFinalBaseCost === 0) return items;

    // Reverse calculate: each item's ratio = (item.qty * item.price) / totalFinalBaseCost
    // Then unit price = selectedFinalAmount * ratio / item.qty
    return finalItems.map((item: any) => {
      const itemBaseCost = item.qty * item.price;
      const ratio = itemBaseCost / totalFinalBaseCost;
      const itemTotal = selectedFinalAmount * ratio;
      const reverseUnitPrice = item.qty > 0 ? itemTotal / item.qty : 0;

      return {
        id: item.id,
        productName: item.name,
        material: item.note || '',
        unit: item.unit,
        qty: item.qty,
        unitPrice: Math.round(reverseUnitPrice),
        totalPrice: Math.round(itemTotal),
        ratioPercent: (ratio * 100).toFixed(2)
      };
    });
  }, [isConstruction, quoteData.selectedFinalResult, quoteData.finalItems, quoteData.preEstimateAmount, quoteData.takeoffCostTotal, items, rawTotal]);

  // Use contractItems for table generation
  const tableItems = isConstruction && quoteData.selectedFinalResult ? contractItems : items;
  const tableRawTotal = tableItems.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
  const tableDiscountValue = tableRawTotal * (discountPercent / 100);
  const tableSubtotalAfterDiscount = tableRawTotal - tableDiscountValue;
  const tableVatAmount = Math.round(tableSubtotalAfterDiscount * 0.08);
  const tableGrandTotal = tableSubtotalAfterDiscount + tableVatAmount;

  const sector = isMechanical ? 'mechanical' : isConstruction ? 'construction' : 'furniture';
  const fallbackTemplate = isMechanical 
    ? DEFAULT_MECH_CONTRACT_TEMPLATE 
    : isConstruction 
      ? DEFAULT_CONS_CONTRACT_TEMPLATE 
      : DEFAULT_FURN_CONTRACT_TEMPLATE;

  const [docHtml, setDocHtml] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingCustom, setLoadingCustom] = useState(true);
  const [contractApproved, setContractApproved] = useState<boolean>(() => {
    return !!quoteData.contractApproved;
  });

  const handleApproveContract = async () => {
    try {
      setSaving(true);
      await dbService.updateQuoteDocHtml(quoteData.id, { contractApproved: true });
      quoteData.contractApproved = true;
      setContractApproved(true);
      addToast({ title: '✅ Phê duyệt', message: 'Đã phê duyệt Hợp Đồng thành công!', type: 'success' });
    } catch (err) {
      console.error('Lỗi khi phê duyệt hợp đồng:', err);
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

  // Generate processed html with unstyled standard replacements
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
            ${isConstruction && quoteData.selectedFinalResult ? `<th style="padding: 8px; border: 1px solid #000000; font-weight: bold; text-align: center;">Tỷ lệ %</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${tableItems.map((item: any, idx: number) => `
            <tr style="border-bottom: 1px solid #000000;">
              <td style="padding: 8px; border: 1px solid #000000; text-align: center;">${idx + 1}</td>
              <td style="padding: 8px; border: 1px solid #000000;">
                <strong>${item.productName || item.name || ''}</strong>
                ${item.material ? `<br/><span style="font-size: 11px; color: #000000;">${item.material}</span>` : ''}
                ${item.notes ? `<br/><span style="font-size: 11px; color: #000000; font-style: italic;">Ghi chú: ${item.notes}</span>` : ''}
              </td>
              <td style="padding: 8px; border: 1px solid #000000; text-align: center;">${item.unit || 'Cái'}</td>
              <td style="padding: 8px; border: 1px solid #000000; text-align: center;">${item.qty || 1}</td>
              <td style="padding: 8px; border: 1px solid #000000; text-align: right;">${(item.unitPrice || 0).toLocaleString('vi-VN')}</td>
              <td style="padding: 8px; border: 1px solid #000000; text-align: right;">${(item.totalPrice || 0).toLocaleString('vi-VN')}</td>
              ${isConstruction && quoteData.selectedFinalResult ? `<td style="padding: 8px; border: 1px solid #000000; text-align: center;">${item.ratioPercent || '0'}%</td>` : ''}
            </tr>
          `).join('')}
          <tr style="font-weight: bold; background-color: #fcfcfc;">
            <td colspan="5" style="padding: 8px; border: 1px solid #000000; text-align: right;">Cộng thành tiền trước chiết khấu:</td>
            <td style="padding: 8px; border: 1px solid #000000; text-align: right;">${tableRawTotal.toLocaleString('vi-VN')}</td>
            ${isConstruction && quoteData.selectedFinalResult ? `<td style="padding: 8px; border: 1px solid #000000; text-align: center;">100%</td>` : ''}
          </tr>
          ${tableDiscountValue > 0 ? `
            <tr style="font-weight: bold; background-color: #fcfcfc;">
              <td colspan="5" style="padding: 8px; border: 1px solid #000000; text-align: right;">Chiết khấu (${discountPercent}%):</td>
              <td style="padding: 8px; border: 1px solid #000000; text-align: right;">-${tableDiscountValue.toLocaleString('vi-VN')}</td>
              ${isConstruction && quoteData.selectedFinalResult ? `<td style="padding: 8px; border: 1px solid #000000;"></td>` : ''}
            </tr>
          ` : ''}
          <tr style="font-weight: bold; background-color: #fcfcfc;">
            <td colspan="5" style="padding: 8px; border: 1px solid #000000; text-align: right;">Tổng cộng thanh toán:</td>
            <td style="padding: 8px; border: 1px solid #000000; text-align: right; font-size: 13px;">${tableGrandTotal.toLocaleString('vi-VN')}</td>
            ${isConstruction && quoteData.selectedFinalResult ? `<td style="padding: 8px; border: 1px solid #000000;"></td>` : ''}
          </tr>
        </tbody>
      </table>
    `;

    const repName = quoteData.config?.customerRepresentative || quoteData.customerName || 'Chưa cập nhật';
    const advanceAmount = Math.round(tableGrandTotal * 0.5);
    const balanceAmount = tableGrandTotal - advanceAmount;

    const replacements: Record<string, string> = {
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
      '{{DAI_DIEN_KHACH_HANG}}': repName,
      '{{CHUC_VU_KHACH_HANG}}': quoteData.config?.customerRepRole || 'Đại diện',
      
      '{{TEN_CONG_TY}}': quoteData.companyLogoText || 'CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG',
      '{{DIA_CHI_CONG_TY}}': 'Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng',
      '{{DIEN_THOAI_CONG_TY}}': '0966 545 959',
      '{{MST_CONG_TY}}': '5801372263',
      '{{STK_CONG_TY}}': '799201899999 tại ngân hàng MB Bank Lâm Đồng',
      '{{DAI_DIEN_CONG_TY}}': 'Ông Trương Hữu Long',
      '{{CHUC_VU_CONG_TY}}': 'Giám đốc',
      
      '{{TONG_CONG}}': tableGrandTotal.toLocaleString('vi-VN'),
      '{{TONG_CONG_CHU}}': docSoTiengViet(tableGrandTotal),
      '{{SO_TIEN_TAM_UNG}}': advanceAmount.toLocaleString('vi-VN'),
      '{{SO_TIEN_CONG_LAI}}': balanceAmount.toLocaleString('vi-VN'),
      '{{BANG_CHI_TIET_BÁO_GIÁ}}': tableHtml,

      // Additional parameters
      '{{DIA_DIEM_KY}}': quoteData.customerAddress || 'Lâm Đồng',
      '{{EMAIL_KHACH_HANG}}': quoteData.customerEmail || 'Chưa cập nhật',
      '{{EMAIL_CONG_TY}}': 'long.nd2306@gmail.com',
      '{{LOAI_CAP_CONG_TRINH}}': 'Cấp IV',
      '{{QUY_MO_DIEN_TICH}}': quoteData.projectName || 'Dự án',
      '{{NGAY_KHOI_CONG}}': formattedToday,
      '{{NGAY_HOAN_THANH}}': formattedToday,
      '{{LOAI_GIA_HOP_DONG}}': 'Trọn gói',
      '{{TY_LE_TAM_UNG}}': '50',
      '{{GIA_TRI_BAO_LANH}}': 'Cam kết uy tín thương hiệu',
      '{{GIA_TRI_BAO_HIEM}}': 'Bảo hiểm công trình theo quy định',
      '{{THOI_GIAN_BAO_HANH}}': '12 tháng',
      '{{GIA_TRI_BAO_LANH_BAO_HANH}}': '5%',
      '{{TI_LE_PHAT_CHAM}}': '0.1'
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
        if (quoteData.contractHtml) {
          setDocHtml(quoteData.contractHtml);
          setLoadingCustom(false);
          return;
        }

        const template = quoteData.contractTemplate || (await dbService.quotationConfigs.get(sector))?.contractTemplate || fallbackTemplate;
        setDocHtml(generateProcessedHtml(template));
      } catch (err) {
        console.error(`Lỗi khi tải mẫu hợp đồng ${sector}:`, err);
        setDocHtml(generateProcessedHtml(fallbackTemplate));
      } finally {
        setLoadingCustom(false);
      }
    };
    loadCustomTemplate();
  }, [sector, fallbackTemplate, quoteData.contractHtml, quoteData.contractTemplate, quoteData.id]);

  const handlePrint = () => {
    window.print();
  };

  const handleSave = async () => {
    if (!editorRef.current) return;
    setSaving(true);
    try {
      const newHtml = editorRef.current.innerHTML;
      await dbService.updateQuoteDocHtml(quoteData.id, { contractHtml: newHtml });
      quoteData.contractHtml = newHtml;
      setDocHtml(newHtml);
      setIsEditing(false);
      addToast({ title: '💾 Đã lưu', message: 'Đã lưu bản in hợp đồng thành công!', type: 'success' });
    } catch (err) {
      console.error('Lỗi khi lưu bản in hợp đồng:', err);
      addToast({ title: '❌ Lỗi', message: 'Không thể lưu bản in hợp đồng. Vui lòng kiểm tra lại kết nối!', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (quoteData.contractHtml) {
      setDocHtml(quoteData.contractHtml);
    } else {
      if (quoteData.contractTemplate) {
        setDocHtml(generateProcessedHtml(quoteData.contractTemplate));
      } else {
        setLoadingCustom(true);
        dbService.quotationConfigs.get(sector).then(config => {
          const template = config?.contractTemplate || fallbackTemplate;
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
        await dbService.updateQuoteDocHtml(quoteData.id, { contractHtml: '' });
        quoteData.contractHtml = '';
        setIsEditing(false);
        setLoadingCustom(true);
        const template = quoteData.contractTemplate || (await dbService.quotationConfigs.get(sector))?.contractTemplate || fallbackTemplate;
        setDocHtml(generateProcessedHtml(template));
        addToast({ title: '✅ Đã khôi phục', message: 'Đã khôi phục bản in hợp đồng mặc định thành công!', type: 'success' });
      } catch (err) {
        console.error('Lỗi khi khôi phục bản in hợp đồng:', err);
        addToast({ title: '❌ Lỗi', message: 'Không thể khôi phục bản in hợp đồng. Vui lòng thử lại!', type: 'error' });
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
        Đang tải mẫu hợp đồng từ cơ sở dữ liệu...
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
        /* Tables styles for print */
        .times-roman-print table, 
        .times-roman-print th, 
        .times-roman-print td {
          border: 1px solid #000000 !important;
          color: #000000 !important;
          font-family: 'Times New Roman', Times, serif !important;
        }
        /* Form list or list spacing */
        .times-roman-print ul {
          list-style-type: disc !important;
          padding-left: 20px !important;
          margin-bottom: 10px !important;
        }
      `}</style>

      {/* Edit/Save Actions Toolbar */}
      <div className="absolute left-6 top-6 flex items-center gap-2 print:hidden no-print z-10" contentEditable={false}>
        {isConstruction && quoteData.selectedFinalResult && (
          <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            Đã tính ngược từ Báo Giá Cuối Cùng
            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded text-[9px] font-mono">
              {quoteData.selectedFinalResult === 'preEstimate' ? 'Khái Toán' : 'Bóc Tách'}
            </span>
          </span>
        )}

        {contractApproved ? (
          <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold font-sans flex items-center gap-1 shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Đã Duyệt
          </span>
        ) : (
          <button
            onClick={handleApproveContract}
            disabled={saving}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white transition-colors rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm animate-pulse active:scale-95"
          >
            <FileCheck className="w-3.5 h-3.5" />
            Duyệt Hợp Đồng
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
        {quoteData.contractHtml && !isEditing && (
          <button
            onClick={handleRestoreDefault}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-all rounded-xl text-xs font-bold font-sans flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
          >
            Khôi phục mặc định
          </button>
        )}
      </div>

      {/* Approved Stamp on the printed document */}
      {contractApproved && (
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
          In Hợp Đồng {isConstruction ? 'Xây Dựng' : isMechanical ? 'Cơ Khí' : 'Nội Thất'}
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
