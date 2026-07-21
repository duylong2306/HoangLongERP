import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Search, Printer, Edit, Save, Check, FolderOpen, Calendar, User, Briefcase, FileText, Info, ShieldAlert, CreditCard, Percent } from 'lucide-react';
import { dbService } from '../lib/dbService';
import { Quote, ArchivedQuote, Customer, Project, Employee, Supplier, Task } from '../types';
import RichTextEditor from './RichTextEditor';
import { docSoTiengViet } from './QuotationTableSheet';
import { useNotification } from '../context';

const DEFAULT_SUBCONTRACTOR_CONTRACT_TEMPLATE = `
<table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 20px;">
<tbody>
<tr style="border: none;">
<td style="width: 40%; text-align: left; border: none; vertical-align: top;">
<p style="margin: 0; font-size: 13px;"><strong>[TEN_CTY]</strong></p>
<p style="margin: 5px 0 0 0; font-size: 13px;">Số: <strong>[SO_HD]/HĐ-GK</strong></p>
</td>
<td style="width: 60%; text-align: center; border: none; vertical-align: top;">
<p style="margin: 0; font-size: 13px; text-transform: uppercase;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></p>
<p style="margin: 5px 0 0 0; font-size: 13px;"><strong>Độc lập – Tự do – Hạnh phúc</strong></p>
<div style="text-align: center; margin-top: 5px; letter-spacing: 2px;">• • • • • • • • • • • • • • •</div>
</td>
</tr>
</tbody>
</table>

<p style="text-align: right; font-style: italic; font-size: 13px; margin-top: 10px;">[DIA_DIEM_KY], ngày [NGAY] tháng [THANG] năm [NAM]</p>

<h2 style="text-align: center; margin-top: 20px; font-family: sans-serif; font-size: 18px;"><strong>HỢP ĐỒNG GIAO KHOÁN</strong></h2>
<p style="text-align: center; font-style: italic; margin-top: 5px; font-size: 13px;">(Khoán kết quả công việc theo Điều 513 Bộ luật Dân sự 2015)</p>
<p>&nbsp;</p>

<p style="font-style: italic; margin-bottom: 6px; font-size: 13px;">Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015;</p>
<p style="font-style: italic; margin-bottom: 6px; font-size: 13px;">Căn cứ Bộ luật Lao động số 45/2019/QH14 ngày 20/11/2019;</p>
<p style="font-style: italic; margin-bottom: 6px; font-size: 13px;">Căn cứ Luật Thương mại số 36/2005/QH11 ngày 14/6/2005;</p>
<p style="font-style: italic; margin-bottom: 6px; font-size: 13px;">Căn cứ Thông tư 111/2013/TT-BTC ngày 15/8/2013 của Bộ Tài chính hướng dẫn về thuế thu nhập cá nhân;</p>
<p style="font-style: italic; margin-bottom: 6px; font-size: 13px;">Căn cứ nhu cầu và khả năng thực tế của hai bên,</p>
<p style="font-style: italic; margin-bottom: 12px; font-size: 13px;">Hai bên cùng thỏa thuận ký Hợp đồng giao khoán với các điều khoản sau:</p>
<p>&nbsp;</p>

<p style="font-size: 13px; margin-bottom: 8px;"><strong>BÊN GIAO KHOÁN (BÊN A):</strong></p>
<p style="font-size: 13px; margin: 4px 0;">Tên đơn vị: <strong>[TEN_CTY]</strong></p>
<p style="font-size: 13px; margin: 4px 0;">Mã số thuế: <strong>[MST_CTY]</strong></p>
<p style="font-size: 13px; margin: 4px 0;">Địa chỉ: <strong>[DIA_CHI_CTY]</strong></p>
<p style="font-size: 13px; margin: 4px 0;">Điện thoại: <strong>[SDT_CTY]</strong> &nbsp;&nbsp;&nbsp;&nbsp; Email: <strong>[EMAIL_CTY]</strong></p>
<p style="font-size: 13px; margin: 4px 0;">Đại diện: Ông/Bà <strong>[DAI_DIEN_A]</strong> &nbsp;&nbsp;&nbsp;&nbsp; Chức vụ: <strong>[CHUC_VU_A]</strong></p>
<p style="font-size: 13px; margin: 4px 0;">Số tài khoản: <strong>[STK_CTY]</strong> Tại: <strong>[NGAN_HANG_CTY]</strong></p>
<p>&nbsp;</p>

<p style="font-size: 13px; margin-bottom: 8px;"><strong>BÊN NHẬN KHOÁN (BÊN B):</strong></p>
<p style="font-size: 13px; margin: 4px 0;">Họ và tên: <strong>[HO_TEN_B]</strong> &nbsp;&nbsp;&nbsp;&nbsp; Giới tính: <strong>[GIOI_TINH_B]</strong></p>
<p style="font-size: 13px; margin: 4px 0;">Ngày sinh: <strong>[NGAY_SINH_B]</strong></p>
<p style="font-size: 13px; margin: 4px 0;">CCCD số: <strong>[CCCD_B]</strong> &nbsp;&nbsp;&nbsp;&nbsp; Ngày cấp: <strong>[NGAY_CAP_B]</strong> &nbsp;&nbsp;&nbsp;&nbsp; Nơi cấp: <strong>[NOI_CAP_B]</strong></p>
<p style="font-size: 13px; margin: 4px 0;">Địa chỉ thường trú: <strong>[DIA_CHI_B]</strong></p>
<p style="font-size: 13px; margin: 4px 0;">Điện thoại: <strong>[SDT_B]</strong> &nbsp;&nbsp;&nbsp;&nbsp; Email: <strong>[EMAIL_B]</strong></p>
<p style="font-size: 13px; margin: 4px 0;">Mã số thuế cá nhân: <strong>[MST_CN_B]</strong></p>
<p style="font-size: 13px; margin: 4px 0;">Số tài khoản: <strong>[STK_B]</strong> &nbsp;&nbsp;&nbsp;&nbsp; Tại: <strong>[NGAN_HANG_B]</strong></p>
<p>&nbsp;</p>

<p style="font-size: 13px; margin-bottom: 8px;"><strong>Điều 1. Đối tượng và phạm vi giao khoán</strong></p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">1.1. Tên công việc giao khoán: <strong>[TEN_CONG_VIEC_KHOAN]</strong></p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">1.2. Mô tả kết quả phải bàn giao: <strong>[MO_TA_KQ_BAN_GIAO]</strong></p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">1.3. Địa điểm thực hiện công việc: <strong>[DIA_DIEM_THUC_HIEN]</strong></p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">1.4. Chi tiết khối lượng và tiêu chuẩn từng hạng mục được mô tả tại Phụ lục 01 — Mô tả sản phẩm bàn giao kèm theo Hợp đồng này.</p>
<p>&nbsp;</p>

<p style="font-size: 13px; margin-bottom: 8px;"><strong>Điều 2. Tiến độ và thời gian thực hiện</strong></p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">2.1. Ngày bắt đầu: <strong>[NGAY_BAT_DAU]</strong>. Ngày hoàn thành dự kiến: <strong>[NGAY_KET_THUC]</strong>.</p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">2.2. Bên B tự chủ động bố trí thời gian, nhân lực, công cụ, phương pháp thực hiện công việc; Bên A không yêu cầu Bên B có mặt theo giờ hành chính, không chấm công, không quản lý điều hành quá trình thực hiện công việc của Bên B.</p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">2.3. Bên B chịu trách nhiệm toàn bộ về cách thức thực hiện công việc và tự chịu mọi rủi ro phát sinh trong quá trình thực hiện cho đến khi bàn giao kết quả được nghiệm thu.</p>
<p>&nbsp;</p>

<p style="font-size: 13px; margin-bottom: 8px;"><strong>Điều 3. Giá trị hợp đồng và phương thức thanh toán</strong></p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">3.1. Tổng giá trị hợp đồng (trước thuế TNCN): <strong>[GIA_TRI_HD]</strong> đồng.</p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">Bằng chữ: <strong>[GIA_TRI_HD_BANG_CHU]</strong> đồng.</p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">3.2. Bên A có trách nhiệm khấu trừ thuế thu nhập cá nhân theo mức <strong>[TY_LE_KHAU_TRU_TNCN]%</strong> trên giá trị hợp đồng trước khi chi trả cho Bên B, theo quy định tại Điểm i Khoản 1 Điều 25 Thông tư 111/2013/TT-BTC. Trường hợp Bên B thuộc đối tượng được làm cam kết theo Mẫu 08/CK-TNCN, Bên B nộp bản cam kết hợp lệ cho Bên A trước khi nhận thu nhập.</p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">3.3. Phương thức thanh toán: chuyển khoản vào tài khoản của Bên B ghi tại Hợp đồng này. Tiến độ thanh toán theo nghiệm thu kết quả công việc:</p>
<p style="font-size: 13px; margin: 4px 0 4px 30px;">– Tạm ứng (nếu có): <strong>[TIEN_TAM_UNG]</strong> đồng, thanh toán trong vòng <strong>[SO_NGAY_TAM_UNG]</strong> ngày kể từ ngày ký Hợp đồng.</p>
<p style="font-size: 13px; margin: 4px 0 4px 30px;">– Thanh toán phần còn lại sau khi hai bên ký Biên bản nghiệm thu và Bên B xuất chứng từ hợp lệ, trong vòng <strong>[SO_NGAY_THANH_TOAN]</strong> ngày.</p>
<p>&nbsp;</p>

<p style="font-size: 13px; margin-bottom: 8px;"><strong>Điều 4. Tiêu chuẩn nghiệm thu</strong></p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">4.1. Kết quả công việc được nghiệm thu khi đáp ứng đầy đủ tiêu chuẩn nêu tại Phụ lục 01 và các tiêu chí bổ sung sau: <strong>[DIEU_KHOAN_NGHIEM_THU]</strong>.</p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">4.2. Trường hợp kết quả công việc chưa đạt tiêu chuẩn, Bên B có trách nhiệm khắc phục, bổ sung, hoàn thiện theo yêu cầu của Bên A trong thời gian hai bên thống nhất, mọi chi phí khắc phục do Bên B chịu.</p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">4.3. Hai bên lập Biên bản nghiệm thu xác nhận kết quả công việc; biên bản là căn cứ để Bên B đề nghị thanh toán theo Điều 3.</p>
<p>&nbsp;</p>

<p style="font-size: 13px; margin-bottom: 8px;"><strong>Điều 5. Quyền và nghĩa vụ của Bên A</strong></p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">5.1. Cung cấp thông tin, yêu cầu kỹ thuật, mặt bằng (nếu cần) cho Bên B để thực hiện công việc; không can thiệp vào cách thức Bên B tổ chức thực hiện.</p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">5.2. Nghiệm thu, thanh toán đầy đủ và đúng hạn theo Hợp đồng; khấu trừ và kê khai thuế TNCN theo quy định.</p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">5.3. Có quyền từ chối nghiệm thu nếu kết quả không đạt tiêu chuẩn; có quyền yêu cầu Bên B bồi thường thiệt hại do lỗi của Bên B gây ra.</p>
<p>&nbsp;</p>

<p style="font-size: 13px; margin-bottom: 8px;"><strong>Điều 6. Quyền và nghĩa vụ của Bên B</strong></p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">6.1. Tự tổ chức, quyết định cách thức, công cụ, nhân lực, thời gian thực hiện công việc để đạt kết quả đã thỏa thuận; tự chịu mọi rủi ro và chi phí phát sinh trong quá trình thực hiện trước khi nghiệm thu.</p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">6.2. Bàn giao kết quả công việc đúng tiêu chuẩn, đúng tiến độ; bảo hành kết quả công việc theo Điều 7 (nếu có).</p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">6.3. Tự chịu trách nhiệm thực hiện nghĩa vụ về bảo hiểm xã hội, bảo hiểm y tế của bản thân (Hợp đồng này không phát sinh quan hệ lao động, Bên A không có nghĩa vụ tham gia BHXH bắt buộc cho Bên B).</p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">6.4. Nhận thanh toán đầy đủ, đúng hạn theo Điều 3.</p>
<p>&nbsp;</p>

<p style="font-size: 13px; margin-bottom: 8px;"><strong>Điều 7. Bảo hành và phạt vi phạm</strong></p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">7.1. Thời gian bảo hành kết quả công việc (nếu có): <strong>[THOI_GIAN_BAO_HANH]</strong>.</p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">7.2. Trường hợp Bên B chậm tiến độ do lỗi của Bên B, Bên B chịu phạt <strong>[TY_LE_PHAT_CHAM]%</strong> giá trị Hợp đồng cho mỗi ngày chậm, tối đa không quá <strong>[MUC_PHAT_TOI_DA]%</strong> giá trị Hợp đồng (theo Điều 301 Luật Thương mại 2005).</p>
<p>&nbsp;</p>

<p style="font-size: 13px; margin-bottom: 8px;"><strong>Điều 8. Chấm dứt hợp đồng</strong></p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">8.1. Hợp đồng tự động chấm dứt khi hai bên hoàn thành nghĩa vụ và ký Biên bản thanh lý.</p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">8.2. Một bên có quyền đơn phương chấm dứt Hợp đồng nếu bên còn lại vi phạm nghiêm trọng nghĩa vụ và không khắc phục sau khi được thông báo bằng văn bản; bên vi phạm có trách nhiệm bồi thường thiệt hại thực tế phát sinh.</p>
<p>&nbsp;</p>

<p style="font-size: 13px; margin-bottom: 8px;"><strong>Điều 9. Điều khoản chung</strong></p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">9.1. Hợp đồng này điều chỉnh quan hệ giao khoán kết quả công việc theo Bộ luật Dân sự 2015, không phải hợp đồng lao động theo Bộ luật Lao động 2019. Bản chất thực tế của quan hệ phải phù hợp với nội dung Hợp đồng.</p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">9.2. Mọi sửa đổi, bổ sung phải được lập thành văn bản có chữ ký của hai bên.</p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">9.3. Tranh chấp phát sinh do hai bên thương lượng; trường hợp không thỏa thuận được, Tòa án có thẩm quyền giải quyết theo quy định pháp luật.</p>
<p style="font-size: 13px; margin: 4px 0 4px 15px;">9.4. Hợp đồng có hiệu lực kể từ ngày ký, lập thành 02 bản tiếng Việt có giá trị pháp lý như nhau, mỗi bên giữ 01 bản. Phụ lục 01 là phần không tách rời của Hợp đồng.</p>
<p>&nbsp;</p>

<table style="width: 100%; border-collapse: collapse; border: none; margin-top: 30px;">
<tbody>
<tr style="border: none;">
<td style="width: 50%; text-align: center; border: none; vertical-align: top;">
<p style="font-size: 13px;"><strong>ĐẠI DIỆN BÊN A</strong></p>
<p style="font-style: italic; font-size: 11px;">(Ký, ghi rõ họ tên, đóng dấu)</p>
<p>&nbsp;</p>
<p>&nbsp;</p>
<p>&nbsp;</p>
<p style="font-size: 13px;"><strong>[DAI_DIEN_A]</strong></p>
</td>
<td style="width: 50%; text-align: center; border: none; vertical-align: top;">
<p style="font-size: 13px;"><strong>ĐẠI DIỆN BÊN B</strong></p>
<p style="font-style: italic; font-size: 11px;">(Ký, ghi rõ họ tên)</p>
<p>&nbsp;</p>
<p>&nbsp;</p>
<p>&nbsp;</p>
<p style="font-size: 13px;"><strong>[HO_TEN_B]</strong></p>
</td>
</tr>
</tbody>
</table>
`;

const DEFAULT_SUBCONTRACTOR_ACCEPTANCE_TEMPLATE = `
<div class="times-roman-print font-serif text-slate-900 max-w-3xl mx-auto p-4 md:p-8" style="font-family: 'Times New Roman', Times, serif; line-height: 1.5; font-size: 14px; color: #000;">
  <table style="width: 100%; border: none; border-collapse: collapse; margin-bottom: 20px;">
    <tbody>
      <tr style="border: none;">
        <td style="width: 45%; text-align: left; vertical-align: top; border: none; font-size: 14px;">
          [TEN_CTY]<br>
          Số: [SO_BBNT]/BBNT
        </td>
        <td style="width: 55%; text-align: center; vertical-align: top; border: none; font-size: 14px;">
          <strong style="font-size: 14px; text-transform: uppercase;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br>
          <strong style="font-size: 13px;">Độc lập – Tự do – Hạnh phúc</strong><br>
          <span style="font-size: 13px; font-style: italic;">[DIA_DIEM_NGHIEM_THU], ngày [NGAY] tháng [THANG] năm [NAM]</span>
        </td>
      </tr>
    </tbody>
  </table>

  <h2 style="text-align: center; font-size: 18px; font-weight: bold; margin-top: 25px; margin-bottom: 5px;">BIÊN BẢN NGHIỆM THU</h2>
  <p style="text-align: center; font-style: italic; font-size: 14px; margin-bottom: 25px;">Kết quả công việc giao khoán</p>

  <p style="margin-bottom: 10px; text-indent: 20px;">– Căn cứ Hợp đồng giao khoán số [SO_HD] ký ngày [NGAY_KY_HD];</p>
  <p style="margin-bottom: 15px; text-indent: 20px;">– Căn cứ Phụ lục 01 và kết quả công việc do Bên B bàn giao;</p>
  
  <p style="margin-bottom: 15px;">Hôm nay, hai bên cùng tiến hành nghiệm thu kết quả công việc với các nội dung sau:</p>

  <h4 style="font-weight: bold; font-size: 14px; margin-top: 15px; margin-bottom: 8px;">I. Thành phần tham dự</h4>
  
  <p style="margin-bottom: 6px;">1. Đại diện Bên giao khoán (Bên A):</p>
  <p style="margin-left: 20px; margin-bottom: 6px;">– Ông/Bà: [DAI_DIEN_A] &nbsp;&nbsp;&nbsp;&nbsp; Chức vụ: [CHUC_VU_A]</p>
  
  <p style="margin-top: 10px; margin-bottom: 6px;">2. Đại diện Bên nhận khoán (Bên B):</p>
  <p style="margin-left: 20px; margin-bottom: 15px;">– Ông/Bà: [HO_TEN_B] &nbsp;&nbsp;&nbsp;&nbsp; CCCD: [CCCD_B]</p>

  <h4 style="font-weight: bold; font-size: 14px; margin-top: 20px; margin-bottom: 8px;">II. Nội dung công việc đã thực hiện</h4>
  <p style="margin-left: 20px; margin-bottom: 6px;">Tên công việc: [TEN_CONG_VIEC_KHOAN]</p>
  <p style="margin-left: 20px; margin-bottom: 6px;">Địa điểm thực hiện: [DIA_DIEM_THUC_HIEN]</p>
  <p style="margin-left: 20px; margin-bottom: 15px;">Thời gian thực hiện: từ [NGAY_BAT_DAU] đến [NGAY_KET_THUC].</p>

  <h4 style="font-weight: bold; font-size: 14px; margin-top: 20px; margin-bottom: 8px;">III. Kết luận nghiệm thu</h4>
  <p style="margin-left: 20px; margin-bottom: 6px;">1. Tình trạng hoàn thành: [TINH_TRANG_HOAN_THANH]</p>
  <p style="margin-left: 20px; margin-bottom: 6px;">2. Đánh giá chất lượng: [DANH_GIA_CHAT_LUONG]</p>
  <p style="margin-left: 20px; margin-bottom: 6px;">3. Kết luận: [KET_LUAN_NGHIEM_THU]</p>
  <p style="margin-left: 20px; margin-bottom: 15px;">4. Giá trị nghiệm thu được làm căn cứ thanh toán: [GIA_TRI_NGHIEM_THU] đồng.</p>

  <p style="margin-top: 20px; margin-bottom: 25px; text-align: justify; text-indent: 20px;">
    Biên bản được lập thành 02 bản tiếng Việt có giá trị pháp lý như nhau, mỗi bên giữ 01 bản, là căn cứ để Bên B đề nghị thanh toán theo Điều 3 Hợp đồng.
  </p>

  <table style="width: 100%; border: none; border-collapse: collapse; margin-top: 35px;">
    <tbody>
      <tr style="border: none;">
        <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
          <strong style="font-size: 13px;">ĐẠI DIỆN BÊN A</strong><br>
          <span style="font-style: italic; font-size: 11px;">(Ký, ghi rõ họ tên, đóng dấu)</span>
          <div style="height: 100px;"></div>
          <strong style="font-size: 13px;">[DAI_DIEN_A]</strong>
        </td>
        <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
          <strong style="font-size: 13px;">ĐẠI DIỆN BÊN B</strong><br>
          <span style="font-style: italic; font-size: 11px;">(Ký, ghi rõ họ tên)</span>
          <div style="height: 100px;"></div>
          <strong style="font-size: 13px;">[HO_TEN_B]</strong>
        </td>
      </tr>
    </tbody>
  </table>
</div>
`;

const DEFAULT_SUBCONTRACTOR_LIQUIDATION_TEMPLATE = `
<div class="times-roman-print font-serif text-slate-900 max-w-3xl mx-auto p-4 md:p-8" style="font-family: 'Times New Roman', Times, serif; line-height: 1.5; font-size: 14px; color: #000;">
  <table style="width: 100%; border: none; border-collapse: collapse; margin-bottom: 20px;">
    <tbody>
      <tr style="border: none;">
        <td style="width: 45%; text-align: left; vertical-align: top; border: none; font-size: 14px;">
          [TEN_CTY]<br>
          Số: [SO_BBTL]/BBTL-GK
        </td>
        <td style="width: 55%; text-align: center; vertical-align: top; border: none; font-size: 14px;">
          <strong style="font-size: 14px; text-transform: uppercase;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br>
          <strong style="font-size: 13px;">Độc lập – Tự do – Hạnh phúc</strong><br>
          <span style="font-size: 13px; font-style: italic;">[DIA_DIEM_KY], ngày [NGAY] tháng [THANG] năm [NAM]</span>
        </td>
      </tr>
    </tbody>
  </table>

  <h2 style="text-align: center; font-size: 18px; font-weight: bold; margin-top: 25px; margin-bottom: 5px;">BIÊN BẢN THANH LÝ HỢP ĐỒNG GIAO KHOÁN</h2>
  <p style="text-align: center; font-style: italic; font-size: 14px; margin-bottom: 25px;">(Thanh lý Hợp đồng số [SO_HD] ngày [NGAY_KY_HD])</p>

  <p style="margin-bottom: 10px; text-indent: 20px;">– Căn cứ Bộ luật Dân sự số 91/2015/QH13;</p>
  <p style="margin-bottom: 10px; text-indent: 20px;">– Căn cứ Hợp đồng giao khoán số [SO_HD] đã ký giữa hai bên;</p>
  <p style="margin-bottom: 15px; text-indent: 20px;">– Căn cứ Biên bản nghiệm thu số [SO_BBNT] và kết quả thực hiện thực tế giữa hai bên,</p>
  
  <p style="margin-bottom: 15px;">Hôm nay, hai bên thống nhất ký Biên bản thanh lý với các nội dung sau:</p>

  <p style="margin-bottom: 8px;">BÊN A: [TEN_CTY] — đại diện: [DAI_DIEN_A], chức vụ: [CHUC_VU_A].</p>
  <p style="margin-bottom: 15px;">BÊN B: Ông/Bà [HO_TEN_B] — CCCD: [CCCD_B].</p>

  <h4 style="font-weight: bold; font-size: 14px; margin-top: 20px; margin-bottom: 8px;">Điều 1. Xác nhận kết quả thực hiện hợp đồng</h4>
  <p style="margin-left: 20px; margin-bottom: 6px; text-align: justify;">1.1. Bên B đã hoàn thành công việc theo Hợp đồng giao khoán nêu trên, kết quả công việc đã được hai bên nghiệm thu.</p>
  <p style="margin-left: 20px; margin-bottom: 15px;">1.2. Lý do thanh lý: [LY_DO_THANH_LY]</p>

  <h4 style="font-weight: bold; font-size: 14px; margin-top: 20px; margin-bottom: 8px;">Điều 2. Quyết toán giá trị hợp đồng</h4>
  <p style="margin-left: 20px; margin-bottom: 6px;">2.1. Tổng giá trị Hợp đồng đã ký: [GIA_TRI_HD] đồng.</p>
  <p style="margin-left: 20px; margin-bottom: 6px;">2.2. Tổng giá trị thực tế nghiệm thu: [GIA_TRI_NGHIEM_THU] đồng.</p>
  <p style="margin-left: 20px; margin-bottom: 6px;">2.3. Tổng số tiền Bên A đã thanh toán cho Bên B: [TONG_GIA_TRI_DA_TT] đồng (đã khấu trừ thuế TNCN).</p>
  <p style="margin-left: 20px; margin-bottom: 6px; text-align: justify;">2.4. Tổng số thuế TNCN Bên A đã khấu trừ và nộp thay Bên B: [TONG_TNCN_KHAU_TRU] đồng (10% theo Điểm i Khoản 1 Điều 25 TT 111/2013/TT-BTC).</p>
  <p style="margin-left: 20px; margin-bottom: 15px;">2.5. Số tiền còn phải thanh toán (nếu có): [SO_TIEN_CON_LAI] đồng.</p>

  <h4 style="font-weight: bold; font-size: 14px; margin-top: 20px; margin-bottom: 8px;">Điều 3. Cam kết của hai bên</h4>
  <p style="margin-left: 20px; margin-bottom: 8px; text-align: justify;">3.1. Hai bên xác nhận đã hoàn thành đủ nghĩa vụ theo Hợp đồng; không có khoản công nợ hoặc khiếu nại nào còn tồn đọng giữa hai bên (trừ số tiền nêu tại khoản 2.5 sẽ được thanh toán theo thỏa thuận).</p>
  <p style="margin-left: 20px; margin-bottom: 15px; text-align: justify;">3.2. Bên B xác nhận đã nhận đủ Chứng từ khấu trừ thuế TNCN do Bên A cấp đối với phần thuế nêu tại khoản 2.4 (nếu Bên B có yêu cầu nhận).</p>

  <h4 style="font-weight: bold; font-size: 14px; margin-top: 20px; margin-bottom: 8px;">Điều 4. Hiệu lực</h4>
  <p style="margin-left: 20px; margin-bottom: 6px;">4.1. Kết luận: [KET_LUAN_THANH_LY]</p>
  <p style="margin-left: 20px; margin-bottom: 15px; text-align: justify;">4.2. Hợp đồng giao khoán nêu trên chấm dứt hiệu lực kể từ ngày ký Biên bản thanh lý này. Biên bản lập thành 02 bản tiếng Việt có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</p>

  <table style="width: 100%; border: none; border-collapse: collapse; margin-top: 35px;">
    <tbody>
      <tr style="border: none;">
        <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
          <strong style="font-size: 13px;">ĐẠI DIỆN BÊN A</strong><br>
          <span style="font-style: italic; font-size: 11px;">(Ký, ghi rõ họ tên, đóng dấu)</span>
          <div style="height: 100px;"></div>
          <strong style="font-size: 13px;">[DAI_DIEN_A]</strong>
        </td>
        <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
          <strong style="font-size: 13px;">ĐẠI DIỆN BÊN B</strong><br>
          <span style="font-style: italic; font-size: 11px;">(Ký, ghi rõ họ tên)</span>
          <div style="height: 100px;"></div>
          <strong style="font-size: 13px;">[HO_TEN_B]</strong>
        </td>
      </tr>
    </tbody>
  </table>
</div>
`;

interface SubcontractorEstimatorProps {
  onAddQuote?: (newQuote: Quote) => void;
  customers: Customer[];
  projects: Project[];
  preselectedCustomerId?: string;
  preselectedProjectId?: string;
  currentUser?: Employee;
  isCabinetSaved?: boolean;
  setIsCabinetSaved?: (val: boolean) => void;
  isLocked?: boolean;
  setIsLocked?: (val: boolean) => void;
  loadedQuote?: Quote | ArchivedQuote | null;
  setLoadedQuote?: (val: Quote | ArchivedQuote | null) => void;
  showTemplateOnly?: boolean;
}

export default function SubcontractorEstimator({ 
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
}: SubcontractorEstimatorProps) {
  const { addToast } = useNotification();
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [archivedQuotesList, setArchivedQuotesList] = useState<ArchivedQuote[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [activePrintTab, setActivePrintTab] = useState<'contract' | 'acceptance' | 'liquidation'>('contract');
  const [isEditingPrint, setIsEditingPrint] = useState(false);
  const [printContractHtml, setPrintContractHtml] = useState<string | null>(null);
  const [printAcceptanceHtml, setPrintAcceptanceHtml] = useState<string | null>(null);
  const [printLiquidationHtml, setPrintLiquidationHtml] = useState<string | null>(null);
  const printEditorRef = useRef<HTMLDivElement>(null);

  // Load suppliers list from localStorage
  useEffect(() => {
    const loadSuppliers = () => {
      const saved = localStorage.getItem('hl_acc_suppliers');
      if (saved) {
        try {
          setSuppliers(JSON.parse(saved));
        } catch (err) {
          console.error("Lỗi parse danh sách thầu phụ:", err);
        }
      }
    };
    loadSuppliers();
    window.addEventListener('hl-suppliers-updated', loadSuppliers);
    return () => {
      window.removeEventListener('hl-suppliers-updated', loadSuppliers);
    };
  }, []);

  // Load archived subcontractor contracts to calculate the serial number
  const fetchArchives = async () => {
    try {
      const list = await dbService.archivedSubcontractorQuotes.list();
      setArchivedQuotesList(list);
    } catch (err) {
      console.error("Lỗi khi tải hồ sơ thầu phụ:", err);
    }
  };

  useEffect(() => {
    fetchArchives();
    const handleSubcontractorQuotesUpdated = () => fetchArchives();
    window.addEventListener('hl-archived-subcontractor-quotes-updated', handleSubcontractorQuotesUpdated);
    return () => {
      window.removeEventListener('hl-archived-subcontractor-quotes-updated', handleSubcontractorQuotesUpdated);
    };
  }, [projects]);

  // Khách hàng & dự án được chọn
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

  // Tự động nạp thông tin dự án và khách hàng tương ứng khi selectedProjectId thay đổi
  useEffect(() => {
    if (!loadedQuote && selectedProjectId && projects && projects.length > 0) {
      const proj = projects.find(p => p.id === selectedProjectId);
      if (proj) {
        const cust = customers.find(c => c.id === proj.customerId);
        setProjectName(proj.name || '');
        setCustomerName(cust ? cust.name : '');
        setCustomerPhone(cust ? cust.phone : '');
        setCustomerAddress(proj.address || (cust ? cust.address : ''));
        if (proj.customerId) {
          setSelectedCustomerId(proj.customerId);
        }
      }
    }
  }, [selectedProjectId, projects, customers, loadedQuote]);

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

  // --- HỢP ĐỒNG THẦU PHỤ NEW FIELDS ---
  const [contractCode, setContractCode] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [workName, setWorkName] = useState('');
  const [contractValue, setContractValue] = useState<number>(0);
  const [createdDate, setCreatedDate] = useState(() => {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  });
  const [signedDate, setSignedDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [contractStatus, setContractStatus] = useState('Đã Lập');
  const [notes, setNotes] = useState('');

  // Bên B (Nhận khoán)
  const [hoTenB, setHoTenB] = useState('');
  const [gioiTinhB, setGioiTinhB] = useState('Nam');
  const [ngaySinhB, setNgaySinhB] = useState('');
  const [cccdB, setCccdB] = useState('');
  const [ngayCapB, setNgayCapB] = useState('');
  const [noiCapB, setNoiCapB] = useState('');
  const [diaChiB, setDiaChiB] = useState('');
  const [sdtB, setSdtB] = useState('');
  const [emailB, setEmailB] = useState('');
  const [mstCnB, setMstCnB] = useState('');
  const [stkB, setStkB] = useState('');
  const [nganHangB, setNganHangB] = useState('');

  // Điều khoản bổ sung
  const [moTaKqBanGiao, setMoTaKqBanGiao] = useState('');
  const [diaDiemThucHien, setDiaDiemThucHien] = useState('');
  const [tyLeKhauTruTncn, setTyLeKhauTruTncn] = useState<number>(10);
  const [tienTamUng, setTienTamUng] = useState<number>(0);
  const [soNgayTamUng, setSoNgayTamUng] = useState<number>(3);
  const [soNgayThanhToan, setSoNgayThanhToan] = useState<number>(5);
  const [dieuKhoanNghiemThu, setDieuKhoanNghiemThu] = useState('Đáp ứng đầy đủ yêu cầu kỹ thuật và thẩm mỹ');
  const [thoiGianBaoHanh, setThoiGianBaoHanh] = useState('12 tháng');
  const [tyLePhatCham, setTyLePhatCham] = useState<number>(0.05);
  const [mucPhatToiDa, setMucPhatToiDa] = useState<number>(8);

  // States cho Template (Mẫu thầu phụ)
  const [activeTemplateTab, setActiveTemplateTab] = useState<'contract' | 'acceptance' | 'liquidation'>('contract');
  const [contractTemplate, setContractTemplate] = useState(() => {
    const local = localStorage.getItem('hl_subcontractor_contract_template');
    if (local && (local.includes('HỢP ĐỒNG KINH TẾ') || local.includes('THI CÔNG CƠ KHÍ') || local.includes('{{CONG_TRINH}}'))) {
      return DEFAULT_SUBCONTRACTOR_CONTRACT_TEMPLATE;
    }
    return local || DEFAULT_SUBCONTRACTOR_CONTRACT_TEMPLATE;
  });
  const [acceptanceTemplate, setAcceptanceTemplate] = useState(() => {
    const local = localStorage.getItem('hl_subcontractor_acceptance_template');
    if (local && (local.includes('BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO CƠ KHÍ') || local.includes('{{SO_BIEN_BAN_NT}}') || local.includes('CƠ KHÍ') || local.includes('{{CONG_TRINH}}'))) {
      return DEFAULT_SUBCONTRACTOR_ACCEPTANCE_TEMPLATE;
    }
    return local || DEFAULT_SUBCONTRACTOR_ACCEPTANCE_TEMPLATE;
  });
  const [liquidationTemplate, setLiquidationTemplate] = useState(() => {
    const local = localStorage.getItem('hl_subcontractor_liquidation_template');
    if (local && (local.includes('THANH LÝ HỢP ĐỒNG THI CÔNG CƠ KHÍ') || local.includes('CƠ KHÍ') || local.includes('{{CONG_TRINH}}'))) {
      return DEFAULT_SUBCONTRACTOR_LIQUIDATION_TEMPLATE;
    }
    return local || DEFAULT_SUBCONTRACTOR_LIQUIDATION_TEMPLATE;
  });
  const [isTemplateEditable, setIsTemplateEditable] = useState(false);
  const [dbSaving, setDbSaving] = useState(false);

  const handleSetAsDefault = async () => {
    setDbSaving(true);
    try {
      let defaultData = await dbService.quotationConfigs.get('subcontractor_default') || {};
      
      if (activeTemplateTab === 'contract') {
        defaultData.contractTemplate = contractTemplate;
        localStorage.setItem('hl_subcontractor_default_contract_template', contractTemplate);
      } else if (activeTemplateTab === 'acceptance') {
        defaultData.acceptanceTemplate = acceptanceTemplate;
        localStorage.setItem('hl_subcontractor_default_acceptance_template', acceptanceTemplate);
      } else if (activeTemplateTab === 'liquidation') {
        defaultData.liquidationTemplate = liquidationTemplate;
        localStorage.setItem('hl_subcontractor_default_liquidation_template', liquidationTemplate);
      }
      
      await dbService.quotationConfigs.save('subcontractor_default', defaultData);
      
      setFeedback({
        type: 'success',
        message: `Đã thiết lập ${
          activeTemplateTab === 'contract' ? 'Mẫu hợp đồng' :
          activeTemplateTab === 'acceptance' ? 'Mẫu nghiệm thu' : 'Mẫu thanh lý'
        } làm mặc định hệ thống thành công!`
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Lỗi khi đặt làm mặc định:", err);
      addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi lưu thiết lập mặc định!', type: 'error' });
    } finally {
      setDbSaving(false);
    }
  };

  const handleRestoreDefault = async () => {
    setDbSaving(true);
    try {
      const defaultData = await dbService.quotationConfigs.get('subcontractor_default');
      const typeText = activeTemplateTab === 'contract' 
        ? 'hợp đồng giao khoán thầu phụ' 
        : activeTemplateTab === 'acceptance' 
          ? 'biên bản nghiệm thu thầu phụ' 
          : 'biên bản thanh lý thầu phụ';

      if (window.confirm(`Bạn có chắc chắn muốn khôi phục ${typeText} về mặc định ban đầu không?`)) {
        if (activeTemplateTab === 'contract') {
          const template = defaultData?.contractTemplate ?? localStorage.getItem('hl_subcontractor_default_contract_template') ?? DEFAULT_SUBCONTRACTOR_CONTRACT_TEMPLATE;
          setContractTemplate(template);
          localStorage.setItem('hl_subcontractor_contract_template', template);
        } else if (activeTemplateTab === 'acceptance') {
          const template = defaultData?.acceptanceTemplate ?? localStorage.getItem('hl_subcontractor_default_acceptance_template') ?? DEFAULT_SUBCONTRACTOR_ACCEPTANCE_TEMPLATE;
          setAcceptanceTemplate(template);
          localStorage.setItem('hl_subcontractor_acceptance_template', template);
        } else if (activeTemplateTab === 'liquidation') {
          const template = defaultData?.liquidationTemplate ?? localStorage.getItem('hl_subcontractor_default_liquidation_template') ?? DEFAULT_SUBCONTRACTOR_LIQUIDATION_TEMPLATE;
          setLiquidationTemplate(template);
          localStorage.setItem('hl_subcontractor_liquidation_template', template);
        }
        
        setFeedback({
          type: 'success',
          message: `Đã khôi phục ${typeText} về mặc định ban đầu thành công!`
        });
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err) {
      console.error("Lỗi khi khôi phục mặc định:", err);
      // Fallback to static defaults
      if (activeTemplateTab === 'contract') {
        setContractTemplate(DEFAULT_SUBCONTRACTOR_CONTRACT_TEMPLATE);
        localStorage.setItem('hl_subcontractor_contract_template', DEFAULT_SUBCONTRACTOR_CONTRACT_TEMPLATE);
      } else if (activeTemplateTab === 'acceptance') {
        setAcceptanceTemplate(DEFAULT_SUBCONTRACTOR_ACCEPTANCE_TEMPLATE);
        localStorage.setItem('hl_subcontractor_acceptance_template', DEFAULT_SUBCONTRACTOR_ACCEPTANCE_TEMPLATE);
      } else if (activeTemplateTab === 'liquidation') {
        setLiquidationTemplate(DEFAULT_SUBCONTRACTOR_LIQUIDATION_TEMPLATE);
        localStorage.setItem('hl_subcontractor_liquidation_template', DEFAULT_SUBCONTRACTOR_LIQUIDATION_TEMPLATE);
      }
      setFeedback({
        type: 'success',
        message: `Đã khôi phục về mặc định hệ thống thành công!`
      });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setDbSaving(false);
    }
  };

  // States cho Công việc con (nhiệm vụ liên kết)
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Fetch tasks of the selected project
  useEffect(() => {
    const fetchTasks = async () => {
      if (!selectedProjectId) {
        setProjectTasks([]);
        setSelectedTaskId('');
        return;
      }
      setLoadingTasks(true);
      try {
        const list = await dbService.tasks.list();
        // Filter tasks belonging to the selected project
        const filtered = list.filter(t => t.projectId === selectedProjectId);
        setProjectTasks(filtered);
      } catch (err) {
        console.error("Lỗi khi tải danh sách công việc con:", err);
      } finally {
        setLoadingTasks(false);
      }
    };
    fetchTasks();
  }, [selectedProjectId]);

  // Tự động load công việc con và thầu phụ liên kết từ localStorage (khi chuyển từ Phòng Dự Án / Công Việc sang)
  useEffect(() => {
    if (projectTasks.length > 0) {
      const preselectedTaskId = localStorage.getItem('hl_preselected_task_id');
      const preselectedSubcontractorId = localStorage.getItem('hl_preselected_subcontractor_id');
      const preselectedWorkName = localStorage.getItem('hl_preselected_work_name');

      if (preselectedTaskId) {
        const foundTask = projectTasks.find(t => t.id === preselectedTaskId);
        if (foundTask) {
          setSelectedTaskId(preselectedTaskId);
          setWorkName(foundTask.name || preselectedWorkName || '');
          if (foundTask.subcontractorId) {
            setSelectedSupplierId(foundTask.subcontractorId);
          } else if (preselectedSubcontractorId) {
            setSelectedSupplierId(preselectedSubcontractorId);
          }
          
          // Clear preselected keys from localStorage so it doesn't run again unexpectedly
          localStorage.removeItem('hl_preselected_task_id');
          localStorage.removeItem('hl_preselected_subcontractor_id');
          localStorage.removeItem('hl_preselected_work_name');
        }
      } else if (preselectedSubcontractorId) {
        // Fallback if only subcontractor was specified
        setSelectedSupplierId(preselectedSubcontractorId);
        if (preselectedWorkName) {
          setWorkName(preselectedWorkName);
        }
        // Try to find a task belonging to this subcontractor
        const matchingTask = projectTasks.find(t => t.subcontractorId === preselectedSubcontractorId);
        if (matchingTask) {
          setSelectedTaskId(matchingTask.id);
        }
        
        localStorage.removeItem('hl_preselected_task_id');
        localStorage.removeItem('hl_preselected_subcontractor_id');
        localStorage.removeItem('hl_preselected_work_name');
      }
    }
  }, [projectTasks, suppliers]);

  // Search thầu phụ dropdown
  const [isSupDropdownOpen, setIsSupDropdownOpen] = useState(false);
  const [supSearchQuery, setSupSearchQuery] = useState('');

  // Load subcontractor templates from DB
  useEffect(() => {
    const fetchSubcontractorConfig = async () => {
      try {
        const dbConfig = await dbService.quotationConfigs.get('subcontractor');
        if (dbConfig) {
          let updatedContract = dbConfig.contractTemplate;
          let updatedAcceptance = dbConfig.acceptanceTemplate;
          let updatedLiquidation = dbConfig.liquidationTemplate;
          let needUpdateDb = false;

          // Check if loaded template is the old mechanical contract template
          if (
            dbConfig.contractTemplate &&
            (dbConfig.contractTemplate.includes('HỢP ĐỒNG KINH TẾ') ||
             dbConfig.contractTemplate.includes('CÔNG TRÌNH: {{CONG_TRINH}}') ||
             dbConfig.contractTemplate.includes('THI CÔNG CƠ KHÍ'))
          ) {
            updatedContract = DEFAULT_SUBCONTRACTOR_CONTRACT_TEMPLATE;
            needUpdateDb = true;
          }

          // Check if loaded template is the old mechanical acceptance template
          if (
            dbConfig.acceptanceTemplate &&
            (dbConfig.acceptanceTemplate.includes('BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO CƠ KHÍ') ||
             dbConfig.acceptanceTemplate.includes('{{SO_BIEN_BAN_NT}}') ||
             dbConfig.acceptanceTemplate.includes('CƠ KHÍ') ||
             dbConfig.acceptanceTemplate.includes('{{CONG_TRINH}}'))
          ) {
            updatedAcceptance = DEFAULT_SUBCONTRACTOR_ACCEPTANCE_TEMPLATE;
            needUpdateDb = true;
          }

          // Check if loaded template is the old mechanical liquidation template
          if (
            dbConfig.liquidationTemplate &&
            (dbConfig.liquidationTemplate.includes('THANH LÝ HỢP ĐỒNG THI CÔNG CƠ KHÍ') ||
             dbConfig.liquidationTemplate.includes('CƠ KHÍ') ||
             dbConfig.liquidationTemplate.includes('{{CONG_TRINH}}'))
          ) {
            updatedLiquidation = DEFAULT_SUBCONTRACTOR_LIQUIDATION_TEMPLATE;
            needUpdateDb = true;
          }

          if (updatedContract) {
            setContractTemplate(updatedContract);
            localStorage.setItem('hl_subcontractor_contract_template', updatedContract);
          } else {
            setContractTemplate(DEFAULT_SUBCONTRACTOR_CONTRACT_TEMPLATE);
            localStorage.setItem('hl_subcontractor_contract_template', DEFAULT_SUBCONTRACTOR_CONTRACT_TEMPLATE);
          }

          if (updatedAcceptance) {
            setAcceptanceTemplate(updatedAcceptance);
            localStorage.setItem('hl_subcontractor_acceptance_template', updatedAcceptance);
          } else {
            setAcceptanceTemplate(DEFAULT_SUBCONTRACTOR_ACCEPTANCE_TEMPLATE);
            localStorage.setItem('hl_subcontractor_acceptance_template', DEFAULT_SUBCONTRACTOR_ACCEPTANCE_TEMPLATE);
          }

          if (updatedLiquidation) {
            setLiquidationTemplate(updatedLiquidation);
            localStorage.setItem('hl_subcontractor_liquidation_template', updatedLiquidation);
          } else {
            setLiquidationTemplate(DEFAULT_SUBCONTRACTOR_LIQUIDATION_TEMPLATE);
            localStorage.setItem('hl_subcontractor_liquidation_template', DEFAULT_SUBCONTRACTOR_LIQUIDATION_TEMPLATE);
          }

          if (needUpdateDb) {
            await dbService.quotationConfigs.save('subcontractor', {
              ...dbConfig,
              contractTemplate: updatedContract || DEFAULT_SUBCONTRACTOR_CONTRACT_TEMPLATE,
              acceptanceTemplate: updatedAcceptance || DEFAULT_SUBCONTRACTOR_ACCEPTANCE_TEMPLATE,
              liquidationTemplate: updatedLiquidation || DEFAULT_SUBCONTRACTOR_LIQUIDATION_TEMPLATE,
            });
            console.log("Successfully auto-updated subcontractor templates in DB from Mechanical to Subcontractor versions.");
          }
        } else {
          // No dbConfig exists, set defaults
          setContractTemplate(DEFAULT_SUBCONTRACTOR_CONTRACT_TEMPLATE);
          localStorage.setItem('hl_subcontractor_contract_template', DEFAULT_SUBCONTRACTOR_CONTRACT_TEMPLATE);
          setAcceptanceTemplate(DEFAULT_SUBCONTRACTOR_ACCEPTANCE_TEMPLATE);
          localStorage.setItem('hl_subcontractor_acceptance_template', DEFAULT_SUBCONTRACTOR_ACCEPTANCE_TEMPLATE);
          setLiquidationTemplate(DEFAULT_SUBCONTRACTOR_LIQUIDATION_TEMPLATE);
          localStorage.setItem('hl_subcontractor_liquidation_template', DEFAULT_SUBCONTRACTOR_LIQUIDATION_TEMPLATE);
        }
      } catch (err) {
        console.error("Lỗi khi tải mẫu hồ sơ thầu phụ:", err);
      }
    };
    fetchSubcontractorConfig();
  }, []);

  // Sync contractor supplier's data to Bên B fields
  useEffect(() => {
    if (selectedSupplierId && suppliers.length > 0) {
      const sup = suppliers.find(s => s.id === selectedSupplierId);
      if (sup) {
        setHoTenB(sup.representative || sup.name || '');
        setGioiTinhB(sup.gender || 'Nam');
        setNgaySinhB(sup.birthDate || '');
        setCccdB(sup.cccd || sup.taxCode || '');
        setNgayCapB(sup.cccdDate || '');
        setNoiCapB(sup.cccdPlace || '');
        setDiaChiB(sup.address || '');
        setSdtB(sup.phone || '');
        setEmailB(sup.email || '');
        setMstCnB(sup.taxCode || '');
        setStkB(sup.bankAccount || sup.bankNo || '');
        setNganHangB(sup.bankName || '');
      }
    }
  }, [selectedSupplierId, suppliers]);

  // Sync diaDiemThucHien to customerAddress when customerAddress changes
  useEffect(() => {
    if (customerAddress && !diaDiemThucHien) {
      setDiaDiemThucHien(customerAddress);
    }
  }, [customerAddress]);

  // Generate automatic contract code: HĐTP{STT}-{ddmmyy}
  const generateNewContractCode = (list: any[]) => {
    const nextNum = list.length + 1;
    const paddedNum = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    return `HĐTP${paddedNum}-${dd}${mm}${yy}`;
  };

  // Sync automatic code on start or list change
  useEffect(() => {
    if (!loadedQuote) {
      const code = generateNewContractCode(archivedQuotesList);
      setContractCode(code);
    }
  }, [archivedQuotesList, loadedQuote]);

  // Load data if loadedQuote is selected
  useEffect(() => {
    if (loadedQuote) {
      setContractCode(loadedQuote.code || '');
      setSelectedProjectId(loadedQuote.projectId || '');
      setSelectedCustomerId(loadedQuote.customerId || '');
      setProjectName(loadedQuote.projectName || '');
      setCustomerName(loadedQuote.customerName || '');
      setCustomerPhone(loadedQuote.customerPhone || '');
      setCustomerAddress(loadedQuote.customerAddress || '');
      setSelectedSupplierId(loadedQuote.subcontractorId || '');
      setSelectedTaskId(loadedQuote.taskId || '');
      setWorkName(loadedQuote.workName || '');
      setContractValue(Number(loadedQuote.contractValue || 0));
      setCreatedDate(loadedQuote.createdDate || '');
      setSignedDate(loadedQuote.signedDate || '');
      setStartDate(loadedQuote.startDate || '');
      setEndDate(loadedQuote.endDate || '');
      setContractStatus(loadedQuote.status || 'Đã Lập');
      setNotes(loadedQuote.notes || '');

      // Load Bên B fields
      setHoTenB(loadedQuote.hoTenB || '');
      setGioiTinhB(loadedQuote.gioiTinhB || 'Nam');
      setNgaySinhB(loadedQuote.ngaySinhB || '');
      setCccdB(loadedQuote.cccdB || '');
      setNgayCapB(loadedQuote.ngayCapB || '');
      setNoiCapB(loadedQuote.noiCapB || '');
      setDiaChiB(loadedQuote.diaChiB || '');
      setSdtB(loadedQuote.sdtB || '');
      setEmailB(loadedQuote.emailB || '');
      setMstCnB(loadedQuote.mstCnB || '');
      setStkB(loadedQuote.stkB || '');
      setNganHangB(loadedQuote.nganHangB || '');

      // Load Điều khoản fields
      setMoTaKqBanGiao(loadedQuote.moTaKqBanGiao || '');
      setDiaDiemThucHien(loadedQuote.diaDiemThucHien || '');
      setTyLeKhauTruTncn(Number(loadedQuote.tyLeKhauTruTncn ?? 10));
      setTienTamUng(Number(loadedQuote.tienTamUng ?? 0));
      setSoNgayTamUng(Number(loadedQuote.soNgayTamUng ?? 3));
      setSoNgayThanhToan(Number(loadedQuote.soNgayThanhToan ?? 5));
      setDieuKhoanNghiemThu(loadedQuote.dieuKhoanNghiemThu || 'Đáp ứng đầy đủ yêu cầu kỹ thuật và thẩm mỹ');
      setThoiGianBaoHanh(loadedQuote.thoiGianBaoHanh || '12 tháng');
      setTyLePhatCham(Number(loadedQuote.tyLePhatCham ?? 0.05));
      setMucPhatToiDa(Number(loadedQuote.mucPhatToiDa ?? 8));
      
      setPrintContractHtml(loadedQuote.contractHtml || null);
      setPrintAcceptanceHtml(loadedQuote.acceptanceHtml || null);
      setPrintLiquidationHtml(loadedQuote.liquidationHtml || null);

      if (setIsCabinetSaved) setIsCabinetSaved(true);
      if (setIsLocked) setIsLocked(true);
    } else {
      // Start new
      setPrintContractHtml(null);
      setPrintAcceptanceHtml(null);
      setPrintLiquidationHtml(null);
      setSelectedProjectId(preselectedProjectId || '');
      setSelectedCustomerId(preselectedCustomerId || '');
      
      if (preselectedProjectId && projects && projects.length > 0) {
        const proj = projects.find(p => p.id === preselectedProjectId);
        if (proj) {
          const cust = customers.find(c => c.id === proj.customerId);
          setProjectName(proj.name || '');
          setCustomerName(cust ? cust.name : '');
          setCustomerPhone(cust ? cust.phone : '');
          setCustomerAddress(proj.address || (cust ? cust.address : ''));
          if (proj.customerId) {
            setSelectedCustomerId(proj.customerId);
          }
        } else {
          setProjectName('');
          setCustomerName('');
          setCustomerPhone('');
          setCustomerAddress('');
        }
      } else {
        setProjectName('');
        setCustomerName('');
        setCustomerPhone('');
        setCustomerAddress('');
      }
      
      setSelectedSupplierId('');
      setWorkName('');
      setContractValue(0);
      const now = new Date();
      setCreatedDate(`${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`);
      setSignedDate('');
      setStartDate('');
      setEndDate('');
      setContractStatus('Đã Lập');
      setNotes('');
      const code = generateNewContractCode(archivedQuotesList);
      setContractCode(code);

      // Reset Bên B fields
      setHoTenB('');
      setGioiTinhB('Nam');
      setNgaySinhB('');
      setCccdB('');
      setNgayCapB('');
      setNoiCapB('');
      setDiaChiB('');
      setSdtB('');
      setEmailB('');
      setMstCnB('');
      setStkB('');
      setNganHangB('');

      // Reset Điều khoản fields
      setMoTaKqBanGiao('');
      setDiaDiemThucHien('');
      setTyLeKhauTruTncn(10);
      setTienTamUng(0);
      setSoNgayTamUng(3);
      setSoNgayThanhToan(5);
      setDieuKhoanNghiemThu('Đáp ứng đầy đủ yêu cầu kỹ thuật và thẩm mỹ');
      setThoiGianBaoHanh('12 tháng');
      setTyLePhatCham(0.05);
      setMucPhatToiDa(8);
      
      if (setIsCabinetSaved) setIsCabinetSaved(false);
      if (setIsLocked) setIsLocked(false);
    }
  }, [loadedQuote, archivedQuotesList]);

  // Trigger print preview if redirecting from TaskDetailModal with the print flag set
  useEffect(() => {
    if (loadedQuote) {
      const triggerPreview = localStorage.getItem('hl_trigger_print_preview');
      if (triggerPreview === 'true') {
        setShowPrintPreview(true);
        localStorage.removeItem('hl_trigger_print_preview');
      }
    }
  }, [loadedQuote]);

  // Select customer from list
  const handleSelectCustomer = (cust: any) => {
    setSelectedCustomerId(cust.id);
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone || '');
    setCustomerAddress(cust.address || '');
    setIsCustDropdownOpen(false);
    setCustSearchQuery('');
  };

  // Quick Create Customer
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

  // Sync Project and Customer info
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

  // Handle save contract
  const handleSaveContract = async () => {
    if (!selectedProjectId) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng chọn Liên kết Dự Án từ phòng dự án!', type: 'warning' });
      return;
    }
    if (!customerName.trim()) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng chọn hoặc điền thông tin Khách hàng!', type: 'warning' });
      return;
    }
    if (!selectedSupplierId) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng chọn Thầu phụ liên kết!', type: 'warning' });
      return;
    }
    if (!workName.trim()) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng điền nội dung Công việc!', type: 'warning' });
      return;
    }
    if (contractValue <= 0) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng điền Giá trị hợp đồng lớn hơn 0!', type: 'warning' });
      return;
    }

    const matchedSupplier = suppliers.find(s => s.id === selectedSupplierId);
    const subcontractorName = matchedSupplier ? matchedSupplier.name : 'Vãng lai';

    const quoteId = loadedQuote ? loadedQuote.id : `archived_quote_${Date.now()}`;
    const archivedRecord: ArchivedQuote = {
      id: quoteId,
      code: contractCode,
      customerId: selectedCustomerId || `cust_${Date.now()}`,
      projectId: selectedProjectId || undefined,
      projectName: projectName.trim(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim(),
      subcontractorId: selectedSupplierId,
      subcontractorName: subcontractorName,
      taskId: selectedTaskId || undefined,
      workName: workName.trim(),
      contractValue: Number(contractValue),
      createdDate: createdDate,
      signedDate: signedDate,
      startDate: startDate,
      endDate: endDate,
      status: 'Đã Lập' as any, // Default status is "Đã Lập" when user saves
      notes: notes.trim(),
      creatorId: currentUser?.id || 'emp_1',
      creatorName: currentUser?.name || 'Cán bộ Kế toán',
      sector: 'subcontractor',
      createdAt: loadedQuote?.createdAt || new Date().toLocaleDateString('vi-VN'),
      date: (loadedQuote as any)?.date || new Date().toISOString().split('T')[0],
      items: (loadedQuote as any)?.items || [],
      config: (loadedQuote as any)?.config || {
        discountPercent: 0,
        accessoryPercent: 0,
        laborPercent: 0,
        generalPercent: 0,
        profitPercent: 0,
        wastagePercent: 0,
        vatPercent: 0,
      },
      totalAmount: Number(contractValue), // mapping to standard archivedQuote property
      contractHtml: printContractHtml || undefined,
      acceptanceHtml: printAcceptanceHtml || undefined,
      liquidationHtml: printLiquidationHtml || undefined,

      // Bên B fields
      hoTenB: hoTenB.trim(),
      gioiTinhB,
      ngaySinhB,
      cccdB: cccdB.trim(),
      ngayCapB,
      noiCapB: noiCapB.trim(),
      diaChiB: diaChiB.trim(),
      sdtB: sdtB.trim(),
      emailB: emailB.trim(),
      mstCnB: mstCnB.trim(),
      stkB: stkB.trim(),
      nganHangB: nganHangB.trim(),

      // Điều khoản fields
      moTaKqBanGiao: moTaKqBanGiao.trim(),
      diaDiemThucHien: diaDiemThucHien.trim(),
      tyLeKhauTruTncn: Number(tyLeKhauTruTncn),
      tienTamUng: Number(tienTamUng),
      soNgayTamUng: Number(soNgayTamUng),
      soNgayThanhToan: Number(soNgayThanhToan),
      dieuKhoanNghiemThu: dieuKhoanNghiemThu.trim(),
      thoiGianBaoHanh: thoiGianBaoHanh.trim(),
      tyLePhatCham: Number(tyLePhatCham),
      mucPhatToiDa: Number(mucPhatToiDa)
    };

    try {
      await dbService.archivedSubcontractorQuotes.save(archivedRecord);
      
      if (setIsCabinetSaved) setIsCabinetSaved(true);
      if (setIsLocked) setIsLocked(true);
      if (setLoadedQuote) setLoadedQuote(archivedRecord);

      // Dispatch custom event to reload tables
      window.dispatchEvent(new CustomEvent('hl-archived-subcontractor-quotes-updated'));

      setFeedback({
        message: `Đã lưu thành công Hợp đồng thầu phụ ${contractCode} với trạng thái Đã Lập!`,
        type: 'success'
      });
      setTimeout(() => setFeedback(null), 5000);
      fetchArchives();
    } catch (err) {
      console.error("Lỗi lưu hợp đồng thầu phụ:", err);
      addToast({ title: '❌ Lỗi', message: 'Lỗi khi lưu trữ hợp đồng thầu phụ.', type: 'error' });
    }
  };

  const [savingPrint, setSavingPrint] = useState(false);

  const handleSavePrintDoc = async () => {
    if (!printEditorRef.current) return;
    const newHtml = printEditorRef.current.innerHTML;
    
    if (activePrintTab === 'contract') {
      setPrintContractHtml(newHtml);
    } else if (activePrintTab === 'acceptance') {
      setPrintAcceptanceHtml(newHtml);
    } else {
      setPrintLiquidationHtml(newHtml);
    }

    if (loadedQuote) {
      setSavingPrint(true);
      try {
        const fields: any = {};
        if (activePrintTab === 'contract') {
          fields.contractHtml = newHtml;
          loadedQuote.contractHtml = newHtml;
        } else if (activePrintTab === 'acceptance') {
          fields.acceptanceHtml = newHtml;
          loadedQuote.acceptanceHtml = newHtml;
        } else {
          fields.liquidationHtml = newHtml;
          loadedQuote.liquidationHtml = newHtml;
        }

        await dbService.updateQuoteDocHtml(loadedQuote.id, fields);
        setArchivedQuotesList(prev => prev.map(q => q.id === loadedQuote.id ? { ...q, ...fields } : q));
        addToast({ title: '💾 Đã lưu', message: 'đã lưu nội dung bản in tùy chỉnh thành công!', type: 'success' });
      } catch (err) {
        console.error('Lỗi khi lưu bản in tùy chỉnh:', err);
        addToast({ title: '⚠️ Thiếu thông tin', message: 'Không thể lưu bản in. vui lòng thử lại!', type: 'warning' });
      } finally {
        setSavingPrint(false);
      }
    } else {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng lưu Hợp đồng thầu phụ này trước khi tùy chỉnh và lưu bản in!', type: 'warning' });
    }
    setIsEditingPrint(false);
  };

  const handleRestorePrintDocDefault = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bản tùy chỉnh này và khôi phục về bản mặc định?')) return;
    
    if (activePrintTab === 'contract') {
      setPrintContractHtml(null);
    } else if (activePrintTab === 'acceptance') {
      setPrintAcceptanceHtml(null);
    } else {
      setPrintLiquidationHtml(null);
    }

    if (loadedQuote) {
      setSavingPrint(true);
      try {
        const fields: any = {};
        if (activePrintTab === 'contract') {
          fields.contractHtml = '';
          loadedQuote.contractHtml = '';
        } else if (activePrintTab === 'acceptance') {
          fields.acceptanceHtml = '';
          loadedQuote.acceptanceHtml = '';
        } else {
          fields.liquidationHtml = '';
          loadedQuote.liquidationHtml = '';
        }

        await dbService.updateQuoteDocHtml(loadedQuote.id, fields);
        setArchivedQuotesList(prev => prev.map(q => q.id === loadedQuote.id ? { ...q, ...fields } : q));
        addToast({ title: '✅ Thành công', message: 'Đã khôi phục bản in mặc định thành công!', type: 'success' });
      } catch (err) {
        console.error('Lỗi khi khôi phục bản in mặc định:', err);
        addToast({ title: '⚠️ Thiếu thông tin', message: 'Không thể khôi phục bản in mặc định. vui lòng thử lại!', type: 'warning' });
      } finally {
        setSavingPrint(false);
      }
    }
    setIsEditingPrint(false);
  };

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  const getRenderedContractHTML = () => {
    let tpl = contractTemplate;
    
    // Replace Bên A & Thông tin chung
    tpl = tpl.replaceAll('[TEN_CTY]', 'CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG');
    tpl = tpl.replaceAll('[MST_CTY]', '5801452655');
    tpl = tpl.replaceAll('[DIA_CHI_CTY]', 'Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng');
    tpl = tpl.replaceAll('[SDT_CTY]', '0966 545 959');
    tpl = tpl.replaceAll('[EMAIL_CTY]', 'hoanglongld.com@gmail.com');
    tpl = tpl.replaceAll('[DAI_DIEN_A]', 'Nguyễn Văn Hoàng');
    tpl = tpl.replaceAll('[CHUC_VU_A]', 'Giám đốc');
    tpl = tpl.replaceAll('[STK_CTY]', '799201899999');
    tpl = tpl.replaceAll('[NGAN_HANG_CTY]', 'Ngân hàng TMCP Quân Đội (MB BANK)');

    // Replace các thông tin chung hợp đồng
    tpl = tpl.replaceAll('[SO_HD]', contractCode || '...........................................');
    
    const now = new Date();
    tpl = tpl.replaceAll('[DIA_DIEM_KY]', 'Lâm Đồng');
    tpl = tpl.replaceAll('[NGAY]', String(now.getDate()).padStart(2, '0'));
    tpl = tpl.replaceAll('[THANG]', String(now.getMonth() + 1).padStart(2, '0'));
    tpl = tpl.replaceAll('[NAM]', String(now.getFullYear()));

    // Replace Bên B
    tpl = tpl.replaceAll('[HO_TEN_B]', hoTenB || selectedSupplier?.representative || '...........................................');
    tpl = tpl.replaceAll('[GIOI_TINH_B]', gioiTinhB || 'Nam');
    tpl = tpl.replaceAll('[NGAY_SINH_B]', ngaySinhB ? new Date(ngaySinhB).toLocaleDateString('vi-VN') : '...........................................');
    tpl = tpl.replaceAll('[CCCD_B]', cccdB || '...........................................');
    tpl = tpl.replaceAll('[NGAY_CAP_B]', ngayCapB ? new Date(ngayCapB).toLocaleDateString('vi-VN') : '...........................................');
    tpl = tpl.replaceAll('[NOI_CAP_B]', noiCapB || '...........................................');
    tpl = tpl.replaceAll('[DIA_CHI_B]', diaChiB || selectedSupplier?.address || '...........................................');
    tpl = tpl.replaceAll('[SDT_B]', sdtB || selectedSupplier?.phone || '...........................................');
    tpl = tpl.replaceAll('[EMAIL_B]', emailB || selectedSupplier?.email || '...........................................');
    tpl = tpl.replaceAll('[MST_CN_B]', mstCnB || selectedSupplier?.taxCode || '...........................................');
    tpl = tpl.replaceAll('[STK_B]', stkB || '...........................................');
    tpl = tpl.replaceAll('[NGAN_HANG_B]', nganHangB || '...........................................');

    // Replace Điều khoản
    tpl = tpl.replaceAll('[TEN_CONG_VIEC_KHOAN]', workName || '...........................................');
    tpl = tpl.replaceAll('[MO_TA_KQ_BAN_GIAO]', moTaKqBanGiao || 'Theo đúng hồ sơ thiết kế kỹ thuật được duyệt.');
    tpl = tpl.replaceAll('[DIA_DIEM_THUC_HIEN]', diaDiemThucHien || customerAddress || '...........................................');
    
    tpl = tpl.replaceAll('[NGAY_BAT_DAU]', startDate ? new Date(startDate).toLocaleDateString('vi-VN') : '...........................................');
    tpl = tpl.replaceAll('[NGAY_KET_THUC]', endDate ? new Date(endDate).toLocaleDateString('vi-VN') : '...........................................');

    tpl = tpl.replaceAll('[GIA_TRI_HD]', contractValue ? contractValue.toLocaleString('vi-VN') : '0');
    
    const DocSoTienBangChu = (soTien: number) => {
      if (soTien === 0) return 'Không đồng';
      const response = docSoTiengViet(soTien);
      return response.charAt(0).toUpperCase() + response.slice(1);
    };
    tpl = tpl.replaceAll('[GIA_TRI_HD_BANG_CHU]', contractValue ? DocSoTienBangChu(contractValue) : '...........................................');
    
    tpl = tpl.replaceAll('[TY_LE_KHAU_TRU_TNCN]', String(tyLeKhauTruTncn));
    tpl = tpl.replaceAll('[TIEN_TAM_UNG]', tienTamUng ? tienTamUng.toLocaleString('vi-VN') : '0');
    tpl = tpl.replaceAll('[SO_NGAY_TAM_UNG]', String(soNgayTamUng));
    tpl = tpl.replaceAll('[SO_NGAY_THANH_TOAN]', String(soNgayThanhToan));
    
    tpl = tpl.replaceAll('[DIEU_KHOAN_NGHIEM_THU]', dieuKhoanNghiemThu || 'Đáp ứng đầy đủ yêu cầu kỹ thuật và thẩm mỹ.');
    tpl = tpl.replaceAll('[THOI_GIAN_BAO_HANH]', thoiGianBaoHanh || '12 tháng');
    tpl = tpl.replaceAll('[TY_LE_PHAT_CHAM]', String(tyLePhatCham));
    tpl = tpl.replaceAll('[MUC_PHAT_TOI_DA]', String(mucPhatToiDa));

    return tpl;
  };

  const getRenderedAcceptanceHTML = () => {
    let tpl = acceptanceTemplate;
    
    tpl = tpl.replaceAll('[TEN_CTY]', 'CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG');
    tpl = tpl.replaceAll('[MST_CTY]', '5801452655');
    tpl = tpl.replaceAll('[DIA_CHI_CTY]', 'Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng');
    tpl = tpl.replaceAll('[SDT_CTY]', '0966 545 959');
    tpl = tpl.replaceAll('[EMAIL_CTY]', 'hoanglongld.com@gmail.com');
    tpl = tpl.replaceAll('[DAI_DIEN_A]', 'Nguyễn Văn Hoàng');
    tpl = tpl.replaceAll('[CHUC_VU_A]', 'Giám đốc');

    tpl = tpl.replaceAll('[SO_HD]', contractCode || '...........................................');
    tpl = tpl.replaceAll('[SO_BIEN_BAN_NT]', contractCode ? `${contractCode}-NT` : '...........................................');
    tpl = tpl.replaceAll('[SO_BBNT]', contractCode ? `${contractCode}-NT` : '...........................................');
    
    const now = new Date();
    tpl = tpl.replaceAll('[DIA_DIEM_KY]', 'Lâm Đồng');
    tpl = tpl.replaceAll('[DIA_DIEM_NGHIEM_THU]', diaDiemThucHien || customerAddress || 'Lâm Đồng');
    tpl = tpl.replaceAll('[NGAY]', String(now.getDate()).padStart(2, '0'));
    tpl = tpl.replaceAll('[THANG]', String(now.getMonth() + 1).padStart(2, '0'));
    tpl = tpl.replaceAll('[NAM]', String(now.getFullYear()));
    tpl = tpl.replaceAll('[NGAY_KY_HĐ]', signedDate ? new Date(signedDate).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN'));
    tpl = tpl.replaceAll('[NGAY_KY_HD]', signedDate ? new Date(signedDate).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN'));

    tpl = tpl.replaceAll('[CONG_TRINH]', projectName || 'Dự án độc lập');

    tpl = tpl.replaceAll('[HO_TEN_B]', hoTenB || selectedSupplier?.representative || '...........................................');
    tpl = tpl.replaceAll('[CCCD_B]', cccdB || '...........................................');
    tpl = tpl.replaceAll('[NGAY_CAP_B]', ngayCapB ? new Date(ngayCapB).toLocaleDateString('vi-VN') : '...........................................');
    tpl = tpl.replaceAll('[NOI_CAP_B]', noiCapB || '...........................................');
    tpl = tpl.replaceAll('[DIA_CHI_B]', diaChiB || selectedSupplier?.address || '...........................................');
    tpl = tpl.replaceAll('[SDT_B]', sdtB || selectedSupplier?.phone || '...........................................');

    tpl = tpl.replaceAll('[TEN_CONG_VIEC_KHOAN]', workName || '...........................................');
    tpl = tpl.replaceAll('[MO_TA_KQ_BAN_GIAO]', moTaKqBanGiao || 'Theo đúng hồ sơ thiết kế kỹ thuật được duyệt.');
    tpl = tpl.replaceAll('[DIA_DIEM_THUC_HIEN]', diaDiemThucHien || customerAddress || '...........................................');

    tpl = tpl.replaceAll('[GIA_TRI_HD]', contractValue ? contractValue.toLocaleString('vi-VN') : '0');
    tpl = tpl.replaceAll('[GIA_TRI_NGHIEM_THU]', contractValue ? contractValue.toLocaleString('vi-VN') : '0');
    tpl = tpl.replaceAll('[TINH_TRANG_HOAN_THANH]', 'Hoàn thành 100% khối lượng công việc được giao');
    tpl = tpl.replaceAll('[DANH_GIA_CHAT_LUONG]', 'Đạt tiêu chuẩn chất lượng kỹ thuật, mỹ thuật theo yêu cầu');
    tpl = tpl.replaceAll('[KET_LUAN_NGHIEM_THU]', 'Đồng ý nghiệm thu bàn giao và thanh lý');

    const DocSoTienBangChu = (soTien: number) => {
      if (soTien === 0) return 'Không đồng';
      const response = docSoTiengViet(soTien);
      return response.charAt(0).toUpperCase() + response.slice(1);
    };
    tpl = tpl.replaceAll('[GIA_TRI_HD_BANG_CHU]', contractValue ? DocSoTienBangChu(contractValue) : '...........................................');

    tpl = tpl.replaceAll('[NGAY_BAT_DAU]', startDate ? new Date(startDate).toLocaleDateString('vi-VN') : '...........................................');
    tpl = tpl.replaceAll('[NGAY_KET_THUC]', endDate ? new Date(endDate).toLocaleDateString('vi-VN') : '...........................................');

    return tpl;
  };

  const getRenderedLiquidationHTML = () => {
    let tpl = liquidationTemplate;
    
    tpl = tpl.replaceAll('[TEN_CTY]', 'CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG');
    tpl = tpl.replaceAll('[MST_CTY]', '5801452655');
    tpl = tpl.replaceAll('[DIA_CHI_CTY]', 'Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng');
    tpl = tpl.replaceAll('[SDT_CTY]', '0966 545 959');
    tpl = tpl.replaceAll('[EMAIL_CTY]', 'hoanglongld.com@gmail.com');
    tpl = tpl.replaceAll('[DAI_DIEN_A]', 'Nguyễn Văn Hoàng');
    tpl = tpl.replaceAll('[CHUC_VU_A]', 'Giám đốc');

    tpl = tpl.replaceAll('[SO_HD]', contractCode || '...........................................');
    tpl = tpl.replaceAll('[SO_BIEN_BAN_NT]', contractCode ? `${contractCode}-NT` : '...........................................');
    tpl = tpl.replaceAll('[SO_BBNT]', contractCode ? `${contractCode}-NT` : '...........................................');
    tpl = tpl.replaceAll('[SO_THANH_LY]', contractCode ? `${contractCode}-TL` : '...........................................');
    tpl = tpl.replaceAll('[SO_BBTL]', contractCode ? `${contractCode}-TL` : '...........................................');
    
    const now = new Date();
    tpl = tpl.replaceAll('[DIA_DIEM_KY]', 'Lâm Đồng');
    tpl = tpl.replaceAll('[NGAY]', String(now.getDate()).padStart(2, '0'));
    tpl = tpl.replaceAll('[THANG]', String(now.getMonth() + 1).padStart(2, '0'));
    tpl = tpl.replaceAll('[NAM]', String(now.getFullYear()));
    tpl = tpl.replaceAll('[NGAY_KY_HĐ]', signedDate ? new Date(signedDate).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN'));
    tpl = tpl.replaceAll('[NGAY_KY_HD]', signedDate ? new Date(signedDate).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN'));
    tpl = tpl.replaceAll('[NGAY_NGHIEM_THU]', endDate ? new Date(endDate).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN'));

    tpl = tpl.replaceAll('[CONG_TRINH]', projectName || 'Dự án độc lập');

    tpl = tpl.replaceAll('[HO_TEN_B]', hoTenB || selectedSupplier?.representative || '...........................................');
    tpl = tpl.replaceAll('[CCCD_B]', cccdB || '...........................................');

    tpl = tpl.replaceAll('[LY_DO_THANH_LY]', 'Đã hoàn thành toàn bộ công việc theo hợp đồng giao khoán và phụ lục đính kèm.');
    tpl = tpl.replaceAll('[GIA_TRI_HD]', contractValue ? contractValue.toLocaleString('vi-VN') : '0');
    tpl = tpl.replaceAll('[GIA_TRI_NGHIEM_THU]', contractValue ? contractValue.toLocaleString('vi-VN') : '0');
    tpl = tpl.replaceAll('[TIEN_TAM_UNG]', tienTamUng ? tienTamUng.toLocaleString('vi-VN') : '0');
    tpl = tpl.replaceAll('[TONG_GIA_TRI_DA_TT]', tienTamUng ? tienTamUng.toLocaleString('vi-VN') : '0');
    tpl = tpl.replaceAll('[SO_NGAY_THANH_TOAN]', String(soNgayThanhToan));

    const tncnKhauTru = contractValue * (tyLeKhauTruTncn / 100);
    tpl = tpl.replaceAll('[TONG_TNCN_KHAU_TRU]', tncnKhauTru ? tncnKhauTru.toLocaleString('vi-VN') : '0');

    const soTienConLai = Math.max(0, contractValue - tienTamUng - tncnKhauTru);
    tpl = tpl.replaceAll('[SO_TIEN_CON_LAI]', soTienConLai ? soTienConLai.toLocaleString('vi-VN') : '0');
    tpl = tpl.replaceAll('[KET_LUAN_THANH_LY]', 'Hai bên thống nhất thanh lý hợp đồng giao khoán nêu trên. Bên A hoàn tất thanh toán số tiền còn lại cho Bên B.');

    return tpl;
  };

  if (showTemplateOnly) {
    return (
      <div className="space-y-6 text-left animate-fadeIn" id="subcontractor_template_panel">
        {feedback && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold animate-pulse" id="template_feedback">
            {feedback.message}
          </div>
        )}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-slate-800 pb-1 gap-4">
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => setActiveTemplateTab('contract')}
              className={`text-xs font-extrabold uppercase tracking-wider relative pb-3 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTemplateTab === 'contract' 
                  ? 'text-amber-500 border-b-2 border-amber-500' 
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              📜 Mẫu HĐ Giao Khoán Thầu Phụ
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
              📋 Mẫu Biên Bản Nghiệm Thu
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
              🤝 Mẫu Biên Bản Thanh Lý
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

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-slate-100">
          <div className="mb-4 border-b border-slate-800 pb-4">
            <h4 className="font-extrabold text-base text-amber-500 uppercase tracking-wider flex items-center gap-2">
              {activeTemplateTab === 'contract' && "📜 Soạn thảo Mẫu Hợp đồng Giao khoán Thầu phụ"}
              {activeTemplateTab === 'acceptance' && "📋 Soạn thảo Mẫu Biên bản Nghiệm thu Thầu phụ"}
              {activeTemplateTab === 'liquidation' && "🤝 Soạn thảo Mẫu Biên bản Thanh lý Thầu phụ"}
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              {activeTemplateTab === 'contract' && "Cho phép tùy chỉnh nội dung hợp đồng giao khoán kết quả công việc với tổ thợ, đội khoán, hoặc thầu phụ liên kết. Các biến trong ngoặc vuông [] sẽ tự động được thay thế bằng dữ liệu thực tế khi xuất in."}
              {activeTemplateTab === 'acceptance' && "Cho phép tùy chỉnh nội dung biên bản nghiệm thu bàn giao kết quả công việc của thầu phụ/tổ đội khoán. Các biến trong ngoặc vuông [] sẽ tự động được thay thế bằng dữ liệu thực tế."}
              {activeTemplateTab === 'liquidation' && "Cho phép tùy chỉnh nội dung biên bản thanh lý hợp đồng giao khoán, quyết toán giá trị thi công và tất toán tài chính. Các biến trong ngoặc vuông [] sẽ tự động được thay thế bằng dữ liệu thực tế."}
            </p>
          </div>
          
          <div className="grid grid-cols-12 gap-6 mt-4">
            <div className="col-span-12 lg:col-span-8">
              {activeTemplateTab === 'contract' && (
                <RichTextEditor
                  value={contractTemplate}
                  onChange={(html) => setContractTemplate(html)}
                  disabled={!isTemplateEditable}
                  themeColor="orange"
                />
              )}
              {activeTemplateTab === 'acceptance' && (
                <RichTextEditor
                  value={acceptanceTemplate}
                  onChange={(html) => setAcceptanceTemplate(html)}
                  disabled={!isTemplateEditable}
                  themeColor="orange"
                />
              )}
              {activeTemplateTab === 'liquidation' && (
                <RichTextEditor
                  value={liquidationTemplate}
                  onChange={(html) => setLiquidationTemplate(html)}
                  disabled={!isTemplateEditable}
                  themeColor="orange"
                />
              )}
            </div>
            <div className="col-span-12 lg:col-span-4 bg-slate-950 border border-slate-800 rounded-xl p-4 self-start space-y-4">
              <div>
                <h5 className="font-bold text-xs text-amber-400 uppercase tracking-wider mb-2">
                  Hướng dẫn chèn biến (Placeholders)
                </h5>
                <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">
                  Sao chép các mã bên dưới dán vào bất kỳ vị trí nào trong mẫu hợp đồng thầu phụ. Hệ thống sẽ tự động thay bằng dữ liệu thực tế khi kết xuất:
                </p>
              </div>
              <div className="space-y-2 text-xs overflow-y-auto max-h-[450px] pr-1">
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[SO_HD]</code>
                  <span className="text-slate-400 text-[10px] text-right">Số Hợp đồng thầu phụ</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[TEN_CTY]</code>
                  <span className="text-slate-400 text-[10px] text-right">Tên doanh nghiệp Bên A</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[MST_CTY]</code>
                  <span className="text-slate-400 text-[10px] text-right">Mã số thuế Bên A</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[DIA_CHI_CTY]</code>
                  <span className="text-slate-400 text-[10px] text-right">Địa chỉ Bên A</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[DAI_DIEN_A]</code>
                  <span className="text-slate-400 text-[10px] text-right">Người đại diện Bên A</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[CHUC_VU_A]</code>
                  <span className="text-slate-400 text-[10px] text-right">Chức vụ đại diện A</span>
                </div>
                
                {/* Bên B */}
                <div className="pt-2 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">Thông tin Bên B</div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[HO_TEN_B]</code>
                  <span className="text-slate-400 text-[10px] text-right">Họ tên Bên B nhận khoán</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[GIOI_TINH_B]</code>
                  <span className="text-slate-400 text-[10px] text-right">Giới tính Bên B</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[NGAY_SINH_B]</code>
                  <span className="text-slate-400 text-[10px] text-right">Ngày sinh Bên B</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[CCCD_B]</code>
                  <span className="text-slate-400 text-[10px] text-right">Số CCCD Bên B</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[NGAY_CAP_B]</code>
                  <span className="text-slate-400 text-[10px] text-right">Ngày cấp CCCD</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[NOI_CAP_B]</code>
                  <span className="text-slate-400 text-[10px] text-right">Nơi cấp CCCD</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[DIA_CHI_B]</code>
                  <span className="text-slate-400 text-[10px] text-right">Địa chỉ thường trú B</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[SDT_B]</code>
                  <span className="text-slate-400 text-[10px] text-right">SĐT Bên B</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[EMAIL_B]</code>
                  <span className="text-slate-400 text-[10px] text-right">Email Bên B</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[MST_CN_B]</code>
                  <span className="text-slate-400 text-[10px] text-right">Mã số thuế cá nhân B</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[STK_B]</code>
                  <span className="text-slate-400 text-[10px] text-right">Số tài khoản Bên B</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[NGAN_HANG_B]</code>
                  <span className="text-slate-400 text-[10px] text-right">Ngân hàng thụ hưởng B</span>
                </div>

                {/* Scope & Money */}
                <div className="pt-2 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">Phạm vi &amp; Tài chính</div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[TEN_CONG_VIEC_KHOAN]</code>
                  <span className="text-slate-400 text-[10px] text-right">Tên công việc khoán</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[MO_TA_KQ_BAN_GIAO]</code>
                  <span className="text-slate-400 text-[10px] text-right">Kết quả phải bàn giao</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[SO_NGAY_THANH_TOAN]</code>
                  <span className="text-slate-400 text-[10px] text-right">Hạn thanh toán (số ngày)</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[SO_BIEN_BAN_NT]</code>
                  <span className="text-slate-400 text-[10px] text-right">Số biên bản nghiệm thu</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[SO_THANH_LY]</code>
                  <span className="text-slate-400 text-[10px] text-right">Số biên bản thanh lý</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[NGAY_NGHIEM_THU]</code>
                  <span className="text-slate-400 text-[10px] text-right">Ngày nghiệm thu thầu phụ</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1.5 gap-2">
                  <code className="text-amber-400 select-all font-mono font-bold">[SO_TIEN_CON_LAI]</code>
                  <span className="text-slate-400 text-[10px] text-right">Số tiền còn lại sau tạm ứng</span>
                </div>
              </div>
            </div>
          </div>

          {/* Success Alert Banner indicating autosave is active */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-950 border border-slate-850 p-5 rounded-xl shadow-xl mt-6">
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
                  try {
                    await dbService.quotationConfigs.save('subcontractor', {
                      contractTemplate: contractTemplate,
                      acceptanceTemplate: acceptanceTemplate,
                      liquidationTemplate: liquidationTemplate,
                    });
                    localStorage.setItem('hl_subcontractor_contract_template', contractTemplate);
                    localStorage.setItem('hl_subcontractor_acceptance_template', acceptanceTemplate);
                    localStorage.setItem('hl_subcontractor_liquidation_template', liquidationTemplate);
                    setIsTemplateEditable(false);
                    setFeedback({
                      message: "Đã thiết lập các mẫu hồ sơ thầu phụ tùy biến làm mặc định thành công và đồng bộ hóa thành công trên toàn ứng dụng!",
                      type: 'success'
                    });
                    setTimeout(() => setFeedback(null), 4000);
                  } catch (err) {
                    console.error(err);
                    addToast({ title: '❌ Lỗi', message: 'Lỗi khi lưu cấu hình các mẫu hồ sơ mặc định.', type: 'error' });
                  } finally {
                    setDbSaving(false);
                  }
                }}
                className={`w-full sm:w-auto px-5 py-3 font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
                  dbSaving || !isTemplateEditable
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed pointer-events-none'
                    : 'bg-amber-500 hover:bg-amber-400 text-white'
                }`}
              >
                <Save className={`w-4 h-4 ${dbSaving ? 'animate-spin' : ''}`} />
                {dbSaving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 text-left" id="linked_project_info_panel">
          <div className="border-b border-slate-800 pb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-blue-500" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-200">
                Thông tin dự án liên kết
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Chọn dự án hiện có */}
            <div className="relative">
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
                Liên kết Dự Án từ phòng dự án <span className="text-rose-500 font-bold">*</span>
              </label>
              
              <button
                type="button"
                onClick={() => !isLocked && setIsProjDropdownOpen(!isProjDropdownOpen)}
                disabled={isLocked}
                className={`w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-xl p-2.5 outline-none font-semibold text-xs text-left hover:border-slate-700 transition-all flex items-center justify-between shadow-md ${
                  isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <span className="truncate">
                  {selectedProjectId ? (
                    <span className="text-blue-400 font-extrabold">📂 {projects.find(p => p.id === selectedProjectId)?.name}</span>
                  ) : (
                    <span className="text-slate-500 font-medium">🔍 Gõ tìm hoặc chọn Dự án...</span>
                  )}
                </span>
                <span className="text-[10px] text-slate-500">▼</span>
              </button>

              {isProjDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-2.5 z-55 max-h-70 overflow-y-auto">
                  <div className="relative mb-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-blue-500 font-medium placeholder-slate-500 transition-all"
                      placeholder="Tìm dự án theo tên hoặc mã..."
                    />
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  </div>

                  <div className="space-y-1">
                    {(() => {
                      const matches = projects.filter(p => 
                        (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (p.code || '').toLowerCase().includes(searchQuery.toLowerCase())
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
                            className={`w-full text-left px-2.5 py-2 rounded-lg text-xs cursor-pointer block transition-all ${
                              selectedProjectId === p.id 
                                ? 'bg-blue-950/50 text-blue-400 border border-blue-900 font-bold' 
                                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-250'
                            }`}
                          >
                            <div className="font-bold text-slate-200 text-left flex items-center justify-between">
                              <span className="truncate">{p.name}</span>
                              {hasArchive && (
                                <span className="ml-1.5 shrink-0 inline-flex items-center gap-0.5 text-[8px] bg-blue-950 text-blue-400 px-1.5 py-0.5 rounded font-black border border-blue-900">
                                  📁 CÓ HĐ
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate text-left mt-0.5">{p.code}</div>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Công việc con (nhiệm vụ liên kết) */}
            <div className="relative">
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
                Công việc con liên kết
              </label>
              <select
                disabled={isLocked || !selectedProjectId}
                value={selectedTaskId}
                onChange={(e) => {
                  const taskId = e.target.value;
                  setSelectedTaskId(taskId);
                  const task = projectTasks.find(t => t.id === taskId);
                  if (task) {
                    setWorkName(task.name);
                    if (task.subcontractorId) {
                      setSelectedSupplierId(task.subcontractorId);
                    }
                  }
                }}
                className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                  isLocked || !selectedProjectId ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-emerald-500"
                }`}
              >
                {!selectedProjectId ? (
                  <option value="">-- Vui lòng chọn Dự án trước --</option>
                ) : (
                  <>
                    <option value="">-- Chọn Công việc con --</option>
                    {projectTasks.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
              {selectedProjectId && selectedTaskId && (() => {
                const currentTask = projectTasks.find(t => t.id === selectedTaskId);
                if (currentTask && currentTask.subcontractorId) {
                  const linkedSub = suppliers.find(s => s.id === currentTask.subcontractorId);
                  return (
                    <div className="absolute left-0 right-0 mt-1 z-10 text-[9px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/90 border border-emerald-900/30 p-1.5 rounded-lg shadow-lg">
                      <span>✅ Thầu phụ: {linkedSub?.name || currentTask.subcontractorName}</span>
                    </div>
                  );
                } else if (currentTask) {
                  return (
                    <div className="absolute left-0 right-0 mt-1 z-10 text-[9px] text-amber-400 font-semibold flex items-center gap-1 bg-amber-950/90 border border-amber-900/30 p-1.5 rounded-lg shadow-lg">
                      <span>⚠️ Chưa liên kết thầu phụ.</span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Tên khách hàng */}
            <div className="relative">
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Tên Khách Hàng <span className="text-rose-500 font-bold">*</span></label>
              
              <button
                type="button"
                onClick={() => !isLocked && setIsCustDropdownOpen(!isCustDropdownOpen)}
                disabled={isLocked}
                className={`w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-xl p-2.5 outline-none font-semibold text-xs text-left hover:border-slate-700 transition-all flex items-center justify-between shadow-md ${
                  isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <span className="truncate">
                  {customerName || <span className="text-slate-500 font-normal">Chọn khách hàng từ danh sách *</span>}
                </span>
                <span className="text-[10px] text-slate-500">▼</span>
              </button>

              {isCustDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-2.5 z-55 max-h-70 overflow-y-auto">
                  <div className="relative mb-2">
                    <input
                      type="text"
                      value={custSearchQuery}
                      onChange={(e) => setCustSearchQuery(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-blue-500 font-medium placeholder-slate-500 transition-all"
                      placeholder="Tìm khách hàng..."
                    />
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
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
                          className={`w-full text-left px-2.5 py-2 rounded-lg text-xs cursor-pointer block transition-all ${
                            selectedCustomerId === c.id 
                              ? 'bg-blue-950/50 text-blue-400 border border-blue-900 font-bold' 
                              : 'text-slate-400 hover:bg-slate-900 hover:text-slate-250'
                          }`}
                        >
                          <div className="font-bold text-slate-200 text-left">{c.name}</div>
                          <div className="text-[10px] text-slate-500 text-left mt-0.5">
                            SĐT: {c.phone} | {c.address}
                          </div>
                        </button>
                      ));
                    })()}
                  </div>
                </div>
              )}
              
              {!isLocked && (
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => setShowQuickCreateCust(true)}
                    className="text-[9px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-0.5 cursor-pointer hover:underline"
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
                className="w-full rounded-xl p-2.5 border border-slate-850 text-slate-400 bg-slate-950 cursor-not-allowed font-semibold text-xs border-dashed"
                placeholder="Chọn Khách hàng để nạp SĐT *"
              />
            </div>

            {/* Địa chỉ công trình */}
            <div className="md:col-span-2">
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Địa chỉ công trình <span className="text-rose-500 font-bold">*</span></label>
              <input
                type="text"
                value={customerAddress}
                disabled={true}
                className="w-full rounded-xl p-2.5 border border-slate-850 text-slate-400 bg-slate-950 cursor-not-allowed font-semibold text-xs border-dashed"
                placeholder="Chọn Khách hàng để nạp Địa chỉ *"
              />
            </div>
          </div>
        </div>

        {/* BOTTOM COLUMN: CONTRACT DETAILS & INPUTS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-6 text-left" id="contract_inputs_panel">
          <div className="border-b border-slate-800 pb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-amber-500" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-200">
                Chi tiết Hợp Đồng Thầu Phụ Giao Khoán
              </h3>
            </div>
            {isLocked && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 border border-amber-500/25 text-amber-400 animate-pulse">
                🔒 CHẾ ĐỘ XEM (ĐÃ LƯU)
              </span>
            )}
          </div>

          <div className="space-y-6">
            {/* PHẦN 1: THÔNG TIN HỢP ĐỒNG & BÊN NHẬN KHOÁN (BÊN B) */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="border-b border-slate-850 pb-2 flex items-center gap-1.5 text-xs font-bold text-amber-500">
                <User className="w-3.5 h-3.5" />
                <span>BÊN NHẬN KHOÁN (BÊN B)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Mã HĐ Thầu Phụ */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Mã HĐ Thầu Phụ <span className="text-blue-500 font-bold">(Tự sinh)</span></label>
                  <input
                    type="text"
                    value={contractCode}
                    disabled={true}
                    className="w-full rounded-xl p-2.5 border border-slate-850 bg-slate-950 text-blue-400 font-mono font-bold text-xs cursor-not-allowed"
                  />
                </div>

                {/* Tên Thầu Phụ liên kết */}
                <div className="relative">
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Thầu Phụ liên kết <span className="text-rose-500 font-bold">*</span></label>
                  <button
                    type="button"
                    onClick={() => !isLocked && setIsSupDropdownOpen(!isSupDropdownOpen)}
                    disabled={isLocked}
                    className={`w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-xl p-2.5 outline-none font-semibold text-xs text-left hover:border-slate-700 transition-all flex items-center justify-between shadow-md ${
                      isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <span className="truncate">
                      {selectedSupplierId ? (
                        <span className="text-emerald-400 font-extrabold">🤝 {suppliers.find(s => s.id === selectedSupplierId)?.name}</span>
                      ) : (
                        <span className="text-slate-500 font-medium">Chọn Thầu Phụ liên kết...</span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-500">▼</span>
                  </button>

                  {isSupDropdownOpen && (
                    <div className="absolute left-0 mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-2.5 z-55 max-h-70 overflow-y-auto">
                      <div className="relative mb-2">
                        <input
                          type="text"
                          value={supSearchQuery}
                          onChange={(e) => setSupSearchQuery(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-blue-500 font-medium placeholder-slate-500 transition-all"
                          placeholder="Tìm thầu phụ theo tên..."
                        />
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                      </div>

                      <div className="space-y-1">
                        {(() => {
                          const matches = suppliers.filter(s => 
                            (s.name || '').toLowerCase().includes(supSearchQuery.toLowerCase()) ||
                            (s.id || '').toLowerCase().includes(supSearchQuery.toLowerCase())
                          );

                          if (matches.length === 0) {
                            return (
                              <div className="text-center py-2.5 text-[11px] text-slate-500 italic">
                                Chưa có thầu phụ nào, vui lòng thêm trong Kế toán - Thầu phụ
                              </div>
                            );
                          }

                          return matches.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSelectedSupplierId(s.id);
                                setIsSupDropdownOpen(false);
                                setSupSearchQuery('');
                              }}
                              className={`w-full text-left px-2.5 py-2 rounded-lg text-xs cursor-pointer block transition-all ${
                                selectedSupplierId === s.id 
                                  ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900 font-bold' 
                                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-250'
                              }`}
                            >
                              <div className="font-bold text-slate-200 text-left">{s.name}</div>
                              <div className="text-[10px] text-slate-500 text-left mt-0.5">
                                Mã: <span className="font-mono text-emerald-500 font-bold">{s.id}</span> | Đại diện: {s.representative}
                              </div>
                            </button>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Họ tên Bên B */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Họ tên nhận khoán (Bên B) <span className="text-rose-500 font-bold">*</span></label>
                  <input
                    type="text"
                    value={hoTenB}
                    disabled={isLocked}
                    onChange={(e) => setHoTenB(e.target.value)}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Nhập họ tên Bên B..."
                  />
                </div>

                {/* Giới tính */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Giới tính Bên B</label>
                  <select
                    value={gioiTinhB}
                    disabled={isLocked}
                    onChange={(e) => setGioiTinhB(e.target.value)}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>

                {/* Ngày sinh */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Ngày sinh Bên B</label>
                  <input
                    type="date"
                    value={ngaySinhB}
                    disabled={isLocked}
                    onChange={(e) => setNgaySinhB(e.target.value)}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                  />
                </div>

                {/* CCCD số */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Số CCCD Bên B</label>
                  <input
                    type="text"
                    value={cccdB}
                    disabled={isLocked}
                    onChange={(e) => setCccdB(e.target.value)}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold font-mono shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Nhập số CCCD..."
                  />
                </div>

                {/* Ngày cấp */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Ngày cấp CCCD</label>
                  <input
                    type="date"
                    value={ngayCapB}
                    disabled={isLocked}
                    onChange={(e) => setNgayCapB(e.target.value)}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                  />
                </div>

                {/* Nơi cấp */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Nơi cấp CCCD</label>
                  <input
                    type="text"
                    value={noiCapB}
                    disabled={isLocked}
                    onChange={(e) => setNoiCapB(e.target.value)}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Ví dụ: Cục CSQLHC về TTXH"
                  />
                </div>

                {/* Địa chỉ thường trú */}
                <div className="md:col-span-2">
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Địa chỉ thường trú</label>
                  <input
                    type="text"
                    value={diaChiB}
                    disabled={isLocked}
                    onChange={(e) => setDiaChiB(e.target.value)}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Nhập địa chỉ thường trú..."
                  />
                </div>

                {/* Điện thoại */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Điện thoại Bên B</label>
                  <input
                    type="text"
                    value={sdtB}
                    disabled={isLocked}
                    onChange={(e) => setSdtB(e.target.value)}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold font-mono shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Nhập số điện thoại Bên B..."
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Email Bên B</label>
                  <input
                    type="email"
                    value={emailB}
                    disabled={isLocked}
                    onChange={(e) => setEmailB(e.target.value)}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Nhập email Bên B..."
                  />
                </div>

                {/* MST cá nhân */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Mã số thuế cá nhân Bên B</label>
                  <input
                    type="text"
                    value={mstCnB}
                    disabled={isLocked}
                    onChange={(e) => setMstCnB(e.target.value)}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold font-mono shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Nhập MST cá nhân..."
                  />
                </div>

                {/* Số tài khoản */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Số tài khoản Bên B</label>
                  <input
                    type="text"
                    value={stkB}
                    disabled={isLocked}
                    onChange={(e) => setStkB(e.target.value)}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold font-mono shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Nhập số tài khoản..."
                  />
                </div>

                {/* Ngân hàng */}
                <div className="md:col-span-2">
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Mở tại Ngân hàng</label>
                  <input
                    type="text"
                    value={nganHangB}
                    disabled={isLocked}
                    onChange={(e) => setNganHangB(e.target.value)}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Ví dụ: MB Bank - CN Lâm Đồng"
                  />
                </div>
              </div>
            </div>

            {/* PHẦN 2: PHẠM VI GIAO KHOÁN & TIẾN ĐỘ */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="border-b border-slate-850 pb-2 flex items-center gap-1.5 text-xs font-bold text-amber-500">
                <Briefcase className="w-3.5 h-3.5" />
                <span>ĐIỀU 1 & 2: PHẠM VI GIAO KHOÁN & TIẾN ĐỘ</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Công việc thầu phụ */}
                <div className="md:col-span-2">
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Nội dung công việc thầu phụ <span className="text-rose-500 font-bold">*</span></label>
                  <input
                    type="text"
                    value={workName}
                    disabled={isLocked}
                    onChange={(e) => setWorkName(e.target.value)}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Ví dụ: Thi công khung thép mái che, Lắp đặt đá bếp, Gia công tủ áo mộc..."
                  />
                </div>

                {/* Mô tả kết quả bàn giao */}
                <div className="md:col-span-2">
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Mô tả kết quả phải bàn giao</label>
                  <textarea
                    value={moTaKqBanGiao}
                    disabled={isLocked}
                    onChange={(e) => setMoTaKqBanGiao(e.target.value)}
                    rows={2}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Mô tả chất lượng, sản phẩm bàn giao (Ví dụ: Sản phẩm hoàn thiện sơn phủ chống rỉ...)"
                  />
                </div>

                {/* Địa điểm thực hiện công việc */}
                <div className="md:col-span-2">
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Địa điểm thực hiện công việc</label>
                  <input
                    type="text"
                    value={diaDiemThucHien}
                    disabled={isLocked}
                    onChange={(e) => setDiaDiemThucHien(e.target.value)}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Nhập địa điểm thi công, lắp đặt..."
                  />
                </div>

                {/* Ngày bắt đầu */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Ngày bắt đầu thực hiện</label>
                  <input
                    type="date"
                    value={startDate}
                    disabled={isLocked}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                  />
                </div>

                {/* Ngày kết thúc */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Ngày hoàn thành dự kiến</label>
                  <input
                    type="date"
                    value={endDate}
                    disabled={isLocked}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* PHẦN 3: ĐIỀU KHOẢN TÀI CHÍNH, THANH TOÁN & NGHIỆM THU */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="border-b border-slate-850 pb-2 flex items-center gap-1.5 text-xs font-bold text-amber-500">
                <CreditCard className="w-3.5 h-3.5" />
                <span>ĐIỀU 3 & 4: TÀI CHÍNH, THANH TOÁN & NGHIỆM THU</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Giá trị hợp đồng */}
                <div className="md:col-span-2">
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Tổng giá trị hợp đồng (VND) <span className="text-rose-500 font-bold">*</span></label>
                  <input
                    type="number"
                    value={contractValue || ''}
                    disabled={isLocked}
                    onChange={(e) => setContractValue(Number(e.target.value))}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold font-mono shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Nhập giá trị tiền hợp đồng..."
                  />
                  {contractValue > 0 && (
                    <div className="mt-1 text-[10px] text-emerald-400 font-bold flex flex-col gap-0.5">
                      <span>💰 {contractValue.toLocaleString('vi-VN')} VND</span>
                      <span className="text-slate-400 italic text-[9px] font-normal">({docSoTiengViet(contractValue)} đồng chẵn)</span>
                    </div>
                  )}
                </div>

                {/* Tỷ lệ khấu trừ thuế TNCN */}
                <div className="md:col-span-2">
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Khấu trừ thuế TNCN (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={tyLeKhauTruTncn}
                      disabled={isLocked}
                      onChange={(e) => setTyLeKhauTruTncn(Number(e.target.value))}
                      className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 pr-8 ${
                        isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                      }`}
                      placeholder="Mặc định: 10"
                    />
                    <Percent className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-3" />
                  </div>
                </div>

                {/* Tiền tạm ứng */}
                <div className="md:col-span-2">
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Tiền tạm ứng (nếu có)</label>
                  <input
                    type="number"
                    value={tienTamUng || ''}
                    disabled={isLocked}
                    onChange={(e) => setTienTamUng(Number(e.target.value))}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold font-mono shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Nhập số tiền tạm ứng..."
                  />
                  {tienTamUng > 0 && (
                    <span className="text-[10px] text-amber-500 block mt-1">💰 {tienTamUng.toLocaleString('vi-VN')} VND</span>
                  )}
                </div>

                {/* Hạn tạm ứng */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Hạn tạm ứng (số ngày)</label>
                  <input
                    type="number"
                    value={soNgayTamUng}
                    disabled={isLocked}
                    onChange={(e) => setSoNgayTamUng(Number(e.target.value))}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Mặc định: 3"
                  />
                </div>

                {/* Hạn thanh toán còn lại */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Hạn thanh toán (ngày)</label>
                  <input
                    type="number"
                    value={soNgayThanhToan}
                    disabled={isLocked}
                    onChange={(e) => setSoNgayThanhToan(Number(e.target.value))}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Mặc định: 5"
                  />
                </div>

                {/* Tiêu chuẩn nghiệm thu bổ sung */}
                <div className="md:col-span-4">
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Tiêu chuẩn nghiệm thu bổ sung</label>
                  <textarea
                    value={dieuKhoanNghiemThu}
                    disabled={isLocked}
                    onChange={(e) => setDieuKhoanNghiemThu(e.target.value)}
                    rows={2}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Chi tiết nghiệm thu (mỹ thuật, độ dung sai, dọn dẹp mặt bằng...)"
                  />
                </div>
              </div>
            </div>

            {/* PHẦN 4: BẢO HÀNH & PHẠT VI PHẠM */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="border-b border-slate-850 pb-2 flex items-center gap-1.5 text-xs font-bold text-amber-500">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>CHÍNH SÁCH BẢO HÀNH & PHẠT CHẬM TRỄ</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Thời gian bảo hành */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Thời gian bảo hành</label>
                  <input
                    type="text"
                    value={thoiGianBaoHanh}
                    disabled={isLocked}
                    onChange={(e) => setThoiGianBaoHanh(e.target.value)}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Mặc định: 12 tháng"
                  />
                </div>

                {/* Tỷ lệ phạt chậm */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Tỷ lệ phạt chậm (%/ngày)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={tyLePhatCham}
                    disabled={isLocked}
                    onChange={(e) => setTyLePhatCham(Number(e.target.value))}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Mặc định: 0.05"
                  />
                </div>

                {/* Mức phạt tối đa */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Mức phạt tối đa (%)</label>
                  <input
                    type="number"
                    value={mucPhatToiDa}
                    disabled={isLocked}
                    onChange={(e) => setMucPhatToiDa(Number(e.target.value))}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Mặc định: 8"
                  />
                </div>
              </div>
            </div>

            {/* PHẦN 5: THÔNG TIN QUẢN TRỊ HỒ SƠ */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="border-b border-slate-850 pb-2 flex items-center gap-1.5 text-xs font-bold text-slate-400">
                <Info className="w-3.5 h-3.5" />
                <span>THÔNG TIN QUẢN TRỊ HỒ SƠ</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Trạng thái hợp đồng */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Trạng thái Hợp đồng</label>
                  <select
                    value={contractStatus}
                    disabled={isLocked}
                    onChange={(e) => setContractStatus(e.target.value)}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                  >
                    <option value="Đã Lập">Đã Lập</option>
                    <option value="Đang thực hiện">Đang thực hiện</option>
                    <option value="Hoàn thành">Hoàn thành</option>
                    <option value="Hủy bỏ">Hủy bỏ</option>
                  </select>
                </div>

                {/* Ngày lập */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Ngày lập hồ sơ</label>
                  <input
                    type="text"
                    value={createdDate}
                    disabled={true}
                    className="w-full rounded-xl p-2.5 border border-slate-850 bg-slate-950 text-slate-400 font-semibold text-xs cursor-not-allowed"
                  />
                </div>

                {/* Ngày ký */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Ngày ký hợp đồng</label>
                  <input
                    type="date"
                    value={signedDate}
                    disabled={isLocked}
                    onChange={(e) => setSignedDate(e.target.value)}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                  />
                </div>

                {/* Người tạo */}
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Người tạo hồ sơ</label>
                  <input
                    type="text"
                    value={currentUser?.name || 'Kế toán tổng hợp'}
                    disabled={true}
                    className="w-full rounded-xl p-2.5 border border-slate-850 bg-slate-950 text-slate-400 font-semibold text-xs cursor-not-allowed"
                  />
                </div>

                {/* Ghi chú */}
                <div className="md:col-span-4">
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Ghi chú & Thỏa ước thầu phụ</label>
                  <textarea
                    value={notes}
                    disabled={isLocked}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className={`w-full rounded-xl p-2.5 border text-xs font-semibold shadow-md transition-all outline-none bg-slate-950 ${
                      isLocked ? "border-slate-850 text-slate-400 cursor-not-allowed" : "border-slate-800 text-slate-100 focus:border-blue-500"
                    }`}
                    placeholder="Nhập ghi chú chi tiết, định mức phạt, tạm ứng hoặc các điều khoản phụ trợ..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end items-center gap-3 pt-3 border-t border-slate-800/60">
            {/* Nút Chỉnh sửa */}
            <button
              type="button"
              onClick={() => setIsLocked && setIsLocked(false)}
              disabled={!isCabinetSaved || !isLocked}
              className="bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-30 disabled:cursor-not-allowed font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-200 shadow-md active:scale-95"
              title={!isCabinetSaved ? "Nút Chỉnh sửa chỉ mở khi hồ sơ Đã Lưu" : !isLocked ? "Đang trong chế độ chỉnh sửa" : "Chỉnh sửa số liệu báo giá"}
            >
              <Edit className="w-4 h-4" />
              Chỉnh sửa
            </button>

            {/* Nút Lưu / Đã Lưu */}
            <button
              type="button"
              onClick={handleSaveContract}
              disabled={(isCabinetSaved && isLocked) || !selectedProjectId || !customerName.trim() || !selectedSupplierId || !workName.trim() || contractValue <= 0}
              className={`${isCabinetSaved && isLocked ? 'bg-slate-700 hover:bg-slate-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'} text-white disabled:opacity-30 disabled:cursor-not-allowed font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-200 shadow-md active:scale-95`}
              title="Lưu hồ sơ HĐ Thầu phụ"
            >
              {isCabinetSaved && isLocked ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  Đã Lưu (Đã Lập)
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Lưu Hồ sơ
                </>
              )}
            </button>

            {/* Nút Xem & In */}
            <button
              type="button"
              onClick={() => setShowPrintPreview(true)}
              className="bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-200 shadow-md active:scale-95"
              title="Xem & In Hợp Đồng"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              Xem & In
            </button>
          </div>
        </div>

      {/* QUICK CREATE CUSTOMER MODAL */}
      {showQuickCreateCust && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[110] p-4 text-left">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h4 className="text-sm font-extrabold uppercase text-blue-400 border-b border-slate-800 pb-2 flex items-center gap-1.5">
              <User className="w-4 h-4" />
              Tạo Khách Hàng Chủ Đầu Tư Nhanh
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tên Khách Hàng *</label>
                <input
                  type="text"
                  value={quickCustName}
                  onChange={(e) => setQuickCustName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-blue-500 font-semibold"
                  placeholder="Nhập tên khách hàng..."
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Số Điện Thoại *</label>
                <input
                  type="text"
                  value={quickCustPhone}
                  onChange={(e) => setQuickCustPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-blue-500 font-semibold"
                  placeholder="Nhập SĐT khách hàng..."
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Địa Chỉ *</label>
                <input
                  type="text"
                  value={quickCustAddress}
                  onChange={(e) => setQuickCustAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-blue-500 font-semibold"
                  placeholder="Nhập địa chỉ khách hàng..."
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowQuickCreateCust(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleQuickCreateCustomer}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Khởi tạo ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW MODAL */}
      {showPrintPreview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4 select-text text-left">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl text-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between shrink-0 gap-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                    {activePrintTab === 'contract' && "Xem Trước Hợp Đồng Giao Khoán Thầu Phụ"}
                    {activePrintTab === 'acceptance' && "Xem Trước Biên Bản Nghiệm Thu Thầu Phụ"}
                    {activePrintTab === 'liquidation' && "Xem Trước Biên Bản Thanh Lý Thầu Phụ"}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium font-mono">{contractCode || 'HL-2026'}</p>
                </div>
              </div>

              {/* Document select tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start md:self-auto shrink-0 shadow-inner">
                <button
                  type="button"
                  onClick={() => {
                    setActivePrintTab('contract');
                    setIsEditingPrint(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    activePrintTab === 'contract'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📜 Hợp Đồng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActivePrintTab('acceptance');
                    setIsEditingPrint(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    activePrintTab === 'acceptance'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📋 Nghiệm Thu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActivePrintTab('liquidation');
                    setIsEditingPrint(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    activePrintTab === 'liquidation'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🤝 Thanh Lý
                </button>
              </div>

              <button 
                onClick={() => {
                  setShowPrintPreview(false);
                  setIsEditingPrint(false);
                }}
                className="text-slate-400 hover:text-slate-800 font-black cursor-pointer bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors text-xs self-end md:self-auto"
              >
                ✕
              </button>
            </div>

            {/* Direct Edit Toolbar (only visible on screen, hidden on print) */}
            <div className="bg-amber-50 px-6 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 print:hidden no-print">
              <div className="flex items-center gap-1.5 text-xs text-amber-800 font-bold">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {isEditingPrint 
                    ? "✍️ ĐANG CHỈNH SỬA TRỰC TIẾP: Bạn có thể nhập, sửa văn bản hoặc điền các trường còn thiếu trực tiếp vào bản in." 
                    : "💡 Bạn có thể chỉnh sửa trực tiếp nội dung văn bản này để in hoặc lưu trữ lâu dài."}
                </span>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                {!isEditingPrint ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsEditingPrint(true)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-lg cursor-pointer flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                    >
                      ✍️ Chỉnh sửa bản in
                    </button>
                    {((activePrintTab === 'contract' && printContractHtml) || 
                      (activePrintTab === 'acceptance' && printAcceptanceHtml) || 
                      (activePrintTab === 'liquidation' && printLiquidationHtml)) && (
                      <button
                        type="button"
                        onClick={handleRestorePrintDocDefault}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg cursor-pointer transition-colors"
                      >
                        🔄 Khôi phục mặc định
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={savingPrint}
                      onClick={handleSavePrintDoc}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg cursor-pointer flex items-center gap-1 transition-all active:scale-95 shadow-sm disabled:opacity-50"
                    >
                      💾 Lưu thay đổi
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingPrint(false)}
                      className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg cursor-pointer transition-colors"
                    >
                      Hủy
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Print Body */}
            <div className="p-8 bg-white overflow-y-auto flex-1 font-serif text-sm leading-relaxed text-slate-900 print-agreement" id="print-area">
              <style>{`
                @media print {
                  body * {
                    visibility: hidden;
                  }
                  #print-area, #print-area * {
                    visibility: visible;
                  }
                  #print-area {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    padding: 0;
                    margin: 0;
                  }
                }
                .print-agreement p {
                  margin-bottom: 0.5rem;
                }
                .print-agreement strong {
                  color: #000;
                }
              `}</style>

              <div className="max-w-3xl mx-auto space-y-6">
                <div 
                  ref={printEditorRef}
                  className={`rich-text-content outline-none ${isEditingPrint ? 'ring-2 ring-blue-500 rounded p-3 bg-slate-50' : ''}`}
                  contentEditable={isEditingPrint}
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ 
                    __html: activePrintTab === 'contract' 
                      ? (printContractHtml || getRenderedContractHTML()) 
                      : activePrintTab === 'acceptance' 
                        ? (printAcceptanceHtml || getRenderedAcceptanceHTML()) 
                        : (printLiquidationHtml || getRenderedLiquidationHTML()) 
                  }} 
                />
              </div>
            </div>

            {/* Print Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowPrintPreview(false);
                  setIsEditingPrint(false);
                }}
                className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-all active:scale-95 shadow-md"
              >
                <Printer className="w-3.5 h-3.5" />
                In Ấn Hồ Sơ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
