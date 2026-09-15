import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { dbService } from '../lib/dbService';
import { Employee, ArchivedQuote, Supplier } from '../types';
import { FileText, Search, Printer, Trash2, Eye, Calendar, User, Briefcase, ChevronRight, ShieldCheck, Info, CheckCircle2, FileCheck, Save, XCircle, FileDown } from 'lucide-react';
import { useNotification, isUserInRoleGroup } from '../context';
import RichTextEditor from './RichTextEditor';
import { exportHtmlToWord } from '../lib/wordExport';
import { docSoTiengViet } from './QuotationTableSheet';

// Bản in Hợp Đồng Thầu Phụ — trước đây là các ô <input> cố định bind trực tiếp
// vào tempQuote.<field>, nay chuyển sang 1 vùng văn bản tự do (contentEditable)
// giống ContractDocument/AcceptanceDocument/LiquidationDocument, để dùng chung
// toolbar căn chỉnh kiểu Word + xuất Word. Các placeholder {{...}} được thay
// bằng giá trị thật LÚC TẢI hồ sơ (xem generateSubcontractorContractHtml) —
// sau đó người dùng tự gõ/định dạng tự do trong vùng văn bản.
// Mẫu Hợp Đồng Giao Khoán — cập nhật theo mẫu "Mẫu HĐ Thầu Phụ Mới.docx" do chủ
// dự án cung cấp (2026-09-14), thay cho mẫu ngắn gọn trước đây. Giữ nguyên toàn
// bộ nội dung pháp lý của mẫu gốc (Điều 1 → Điều 13, mẫu gốc không có Điều 11);
// chỉ thay các chỗ ghi thông tin công ty mẫu (JUSTEPS) bằng placeholder {{...}}
// tương ứng để in đúng dữ liệu Hoàng Long Lâm Đồng + hồ sơ thầu phụ thực tế.
// Các trường mẫu mới có (ngày sinh/CCCD ngày cấp/nơi cấp/số tài khoản Bên B)
// nhưng hệ thống hiện CHƯA có ô nhập tương ứng trên "Lập HĐ Thầu Phụ" sẽ hiển
// thị "Chưa cập nhật" — xem replacements bên dưới.
const DEFAULT_SUBCONTRACTOR_CONTRACT_TEMPLATE = `
<div style="text-align:center;">
  <p style="margin:0;font-weight:800;">CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</p>
  <p style="margin:2px 0;font-size:11px;color:#64748b;">Số: {{MA_HOP_DONG}}/HĐGK</p>
</div>

<h2 style="text-align:center;margin:18px 0 2px;font-weight:800;text-transform:uppercase;">Hợp Đồng Giao Khoán</h2>
<p style="text-align:center;font-style:italic;margin:0 0 16px;">V/v: Giao khoán thực hiện: {{NOI_DUNG_CONG_VIEC}}</p>

<p style="font-style:italic;color:#64748b;">- Căn cứ Bộ luật Dân sự năm 2015 và các văn bản pháp luật có liên quan;</p>
<p style="font-style:italic;color:#64748b;">- Căn cứ Hợp đồng thi công đã ký giữa {{CHU_DAU_TU}} với Công ty TNHH Hoàng Long Lâm Đồng về việc thực hiện dự án {{CONG_TRINH}};</p>
<p style="font-style:italic;color:#64748b;">- Căn cứ hồ sơ thiết kế, bản vẽ thi công, chỉ dẫn kỹ thuật, biện pháp thi công và các tài liệu dự án được phê duyệt;</p>
<p style="font-style:italic;color:#64748b;">- Căn cứ nhu cầu, năng lực và thỏa thuận của các Bên.</p>

<p><strong>Hôm nay, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}, tại Văn phòng Ban chỉ huy công trường Công ty TNHH Hoàng Long Lâm Đồng, chúng tôi gồm có:</strong></p>

<p><strong>BÊN A (BÊN GIAO KHOÁN): <span style="color:#2563eb;">{{TEN_CONG_TY_A}}</span></strong></p>
<ul>
  <li>Mã số thuế: {{MST_CONG_TY_A}}</li>
  <li>Địa chỉ trụ sở: {{DIA_CHI_CONG_TY_A}}</li>
  <li>Điện thoại: {{DIEN_THOAI_CONG_TY_A}}</li>
  <li>Đại diện: (Ông) {{DAI_DIEN_CONG_TY_A}} &nbsp;&nbsp; Chức vụ: {{CHUC_VU_CONG_TY_A}}</li>
</ul>

<p><strong>BÊN B (BÊN NHẬN KHOÁN): <span style="color:#059669;">{{TEN_THAU_PHU}}</span></strong></p>
<ul>
  <li>Mã Thầu Phụ: {{MA_THAU_PHU}}</li>
  <li>Đại diện: {{DAI_DIEN_THAU_PHU}} - Đại diện tổ đội nhận khoán</li>
  <li>Ngày sinh: {{NGAY_SINH_B}}</li>
  <li>Địa chỉ thường trú: {{DIA_CHI_THAU_PHU}}</li>
  <li>Điện thoại: {{DIEN_THOAI_THAU_PHU}}</li>
  <li>Số CCCD/MST: {{MST_THAU_PHU}} &nbsp;&nbsp; Cấp ngày: {{NGAY_CAP_B}} &nbsp;&nbsp; Nơi cấp: {{NOI_CAP_B}}</li>
  <li>Tài khoản: {{STK_B}} &nbsp;&nbsp; Tại: {{NGAN_HANG_B}}</li>
</ul>
<p>Bên B ký kết Hợp đồng này với tư cách là cá nhân đại diện tổ đội nhận khoán theo Danh sách thành viên tổ đội và văn bản xác nhận/ủy quyền kèm theo Hợp đồng này.</p>

<p><strong>XÉT RẰNG</strong></p>
<p>- Bên A là nhà thầu/đơn vị thi công thực hiện gói thầu, hạng mục thuộc dự án nêu tại Hợp đồng này.</p>
<p>- Bên B là cá nhân đại diện cho tổ đội nhận khoán, có khả năng tự tổ chức nhân sự, công cụ, dụng cụ, vật tư phụ và các điều kiện cần thiết để thực hiện công việc theo phạm vi được giao khoán.</p>
<p>Sau khi thảo luận, Các Bên thống nhất ký kết Hợp đồng giao khoán với các điều khoản sau:</p>

<p><strong>Điều 1. Nội dung giao khoán</strong></p>
<p>Bên A đồng ý giao và Bên B đồng ý nhận thi công {{NOI_DUNG_CONG_VIEC}} thuộc dự án "{{CONG_TRINH}}".</p>
<p>Địa điểm xây dựng: {{DIA_CHI_THI_CONG}}</p>
<p>Công việc giao khoán chi tiết bao gồm các hạng mục được liệt kê tại Phụ lục 01 và/hoặc các hạng mục phát sinh được Các Bên xác nhận bằng văn bản.</p>
<p>Bên B tự tổ chức nhân sự, phương án thực hiện, công cụ dụng cụ thuộc trách nhiệm của mình để hoàn thành công việc đúng tiến độ, chất lượng, kỹ thuật, an toàn lao động và yêu cầu nghiệm thu của Bên A, Tư vấn giám sát và Chủ đầu tư.</p>

<p><strong>Điều 2. Khối lượng, đơn giá Hợp đồng</strong></p>
<p>Khối lượng tạm tính, đơn giá cố định (theo phụ lục số 01 đính kèm).</p>
<p>Tổng giá trị Hợp đồng tạm tính: <strong>{{GIA_TRI_HOP_DONG}}</strong></p>
<p>Bằng chữ: {{GIA_TRI_BANG_CHU}}</p>
<p>Khối lượng Hợp đồng là khối lượng tạm tính hoặc khối lượng theo từng biên bản xác nhận của Bên A. Khối lượng thanh toán, quyết toán là khối lượng thực tế hoàn thành, đạt yêu cầu và được Bên A nghiệm thu xác nhận.</p>
<p>Đơn giá giao khoán là đơn giá cố định/trọn gói theo Phụ lục 01, trừ khi Các Bên có thỏa thuận điều chỉnh bằng văn bản. Đơn giá giao khoán là đơn giá trọn gói cho phần việc thuộc trách nhiệm của Bên B, bao gồm chi phí tổ chức thực hiện, nhân sự do Bên B tự bố trí, công cụ, dụng cụ, vật tư phụ, chi phí vệ sinh khu vực thi công, chi phí an toàn lao động, thuế, phí và các chi phí cần thiết khác để hoàn thành công việc, trừ các khoản thuộc trách nhiệm cung cấp của Bên A theo Hợp đồng/Phụ lục.</p>
<p>Bên A có quyền khấu trừ các khoản thuế, phí, tạm ứng, vi phạm, bồi thường, chi phí khắc phục, chi phí vật tư vượt định mức và nghĩa vụ tài chính khác của Bên B trước khi thanh toán.</p>

<p><strong>Điều 3. Năng lực tổ chức thi công và tiến độ thi công</strong></p>
<p>3.1. Bên B có trách nhiệm tự bố trí đủ năng lực tổ chức thi công, bao gồm nhân sự, công cụ, dụng cụ, vật tư phụ và biện pháp thực hiện cần thiết để bảo đảm hoàn thành công việc theo tiến độ tổng thể của gói thầu, tiến độ chi tiết từng giai đoạn và yêu cầu điều phối thi công hợp lý của Bên A.</p>
<p>3.2. Trường hợp tiến độ thực hiện có nguy cơ chậm hoặc đã chậm so với yêu cầu của gói thầu, Bên A có quyền yêu cầu Bên B lập phương án khắc phục, tăng cường năng lực thi công, bổ sung công cụ/dụng cụ, điều chỉnh biện pháp tổ chức thực hiện hoặc áp dụng biện pháp cần thiết khác để bảo đảm tiến độ.</p>
<p>3.3. Bên B tự quyết định việc phân công, điều phối, bố trí thời gian thực hiện công việc của thành viên tổ đội, bao gồm việc tăng cường nhân sự hoặc tổ chức thực hiện ngoài thời gian thông thường, trên cơ sở bảo đảm tuân thủ quy định pháp luật, an toàn lao động, nội quy công trường và tiến độ đã cam kết.</p>
<p>3.4. Nếu Bên B không khắc phục tiến độ theo yêu cầu hợp lý của Bên A, Bên A có quyền thuê tổ đội/đơn vị khác thực hiện phần việc chậm tiến độ. Toàn bộ chi phí phát sinh, chênh lệch giá, thiệt hại và chi phí quản lý liên quan được khấu trừ vào giá trị thanh toán của Bên B.</p>

<p><strong>Điều 4. Quyền và nghĩa vụ của Bên A</strong></p>
<p>4.1. Cung cấp cho Bên B bản vẽ thiết kế, chỉ dẫn kỹ thuật, yêu cầu thi công, mặt bằng thi công và các thông tin cần thiết liên quan đến phần việc giao khoán.</p>
<p>4.2. Bố trí cán bộ kỹ thuật phối hợp, kiểm tra, hướng dẫn yêu cầu kỹ thuật, tiến độ, an toàn lao động, vệ sinh môi trường và nghiệm thu khối lượng hoàn thành. Việc kiểm tra, hướng dẫn của Bên A chỉ nhằm bảo đảm công việc nhận khoán đáp ứng yêu cầu của dự án, không được hiểu là việc Bên A trực tiếp quản lý, điều hành quan hệ lao động giữa Bên B và thành viên tổ đội.</p>
<p>4.3. Cung cấp vật tư chính thuộc kết cấu công trình, vật tư luân chuyển, vật tư biện pháp thi công, máy móc thiết bị, lái máy, xăng dầu và sửa chữa thiết bị theo phạm vi trách nhiệm của Bên A/Phụ lục Hợp đồng.</p>
<p>4.4. Có quyền yêu cầu Bên B sửa chữa, làm lại hoặc khắc phục các phần việc không đạt yêu cầu kỹ thuật, chất lượng, tiến độ, an toàn lao động hoặc vệ sinh môi trường.</p>
<p>4.5. Có quyền thêm, giảm, tách hoặc điều chuyển một phần khối lượng công việc thuộc phạm vi Hợp đồng phù hợp với yêu cầu thi công thực tế của dự án.</p>
<p>4.6. Có quyền yêu cầu Bên B thực hiện các công việc phát sinh theo yêu cầu công trường; đơn giá áp dụng theo thỏa thuận bổ sung hoặc đơn giá tương tự của tổ đội/đơn vị khác đang thi công tại dự án.</p>
<p>4.7. Có quyền tạm dừng nghiệm thu, tạm dừng thanh toán, khấu trừ chi phí khắc phục, thuê tổ đội/đơn vị khác thực hiện thay, đình chỉ thi công hoặc chấm dứt Hợp đồng nếu Bên B vi phạm nghĩa vụ theo Hợp đồng này.</p>
<p>4.8. Có quyền từ chối nghiệm thu đối với công việc dở dang, không bảo đảm chất lượng, không đủ hồ sơ, không dọn vệ sinh khu vực thi công hoặc chưa được Tư vấn giám sát/Chủ đầu tư chấp thuận nghiệm thu nếu thuộc phạm vi phải được chấp thuận.</p>
<p>4.9. Thanh toán cho Bên B theo khối lượng thực tế được nghiệm thu, hồ sơ thanh toán hợp lệ và điều kiện thanh toán tại Hợp đồng này.</p>

<p><strong>Điều 5. Quyền và nghĩa vụ của Bên B</strong></p>
<p>5.1. Đề nghị Bên A nghiệm thu, tạm ứng, thanh toán khối lượng hoàn thành theo Hợp đồng này sau khi Bên B cung cấp đầy đủ hồ sơ thanh toán hợp lệ.</p>
<p>5.2. Tự tổ chức, quản lý, điều phối và phân công thành viên tổ đội để thực hiện công việc nhận khoán; bảo đảm người tham gia thực hiện công việc có đủ năng lực, sức khỏe, kinh nghiệm, được phổ biến quy định an toàn và tuân thủ nội quy công trường.</p>
<p>5.3. Bên B chịu trách nhiệm cung cấp danh sách thành viên tổ đội, bản sao CCCD, mã số thuế, số tài khoản ngân hàng, thông tin cư trú, hồ sơ an toàn và các hồ sơ cần thiết khác theo yêu cầu của Bên A để phục vụ thủ tục ra/vào công trường, quản lý an toàn, thuế và thanh toán. Việc Bên A tiếp nhận các thông tin này không làm phát sinh quan hệ lao động giữa Bên A và thành viên tổ đội.</p>
<p>5.4. Thực hiện công việc đúng bản vẽ, biện pháp thi công, chỉ dẫn kỹ thuật, yêu cầu chất lượng, tiến độ, an toàn lao động, vệ sinh môi trường và nội quy công trường.</p>
<p>5.5. Cử người phụ trách kỹ thuật hoặc người đại diện có đủ chuyên môn, kinh nghiệm và thẩm quyền để liên lạc, phối hợp, xử lý vướng mắc với Bên A trong suốt quá trình thi công.</p>
<p>5.6. Sử dụng vật tư, thiết bị do Bên A cấp đúng mục đích, đúng định mức, bảo quản cẩn thận và bàn giao/đối chiếu theo yêu cầu của Bên A. Mọi hao hụt, hư hỏng, mất mát hoặc sử dụng vượt định mức do lỗi của Bên B bị khấu trừ vào thanh toán/quyết toán.</p>
<p>5.7. Tự trang bị các thiết bị, máy móc cầm tay, công cụ, dụng cụ và vật tư phụ cần thiết thuộc trách nhiệm của mình để phục vụ thi công, trừ các hạng mục do Bên A cung cấp theo Hợp đồng/Phụ lục.</p>
<p>5.8. Bảo vệ sản phẩm đã thi công đến khi bàn giao cho Bên A, Tư vấn giám sát và/hoặc Chủ đầu tư; chịu trách nhiệm đối với mọi hư hỏng, sai sót, mất mát do lỗi của Bên B hoặc thành viên tổ đội của Bên B.</p>
<p>5.9. Chịu trách nhiệm về nghĩa vụ thuế, hồ sơ chứng từ, phân bổ tiền khoán, an toàn lao động, chế độ và các nghĩa vụ tài chính khác liên quan đến khoản tiền nhận khoán theo quy định pháp luật.</p>
<p>5.10. Bồi thường toàn bộ thiệt hại thực tế phát sinh do lỗi của Bên B hoặc thành viên tổ đội của Bên B gây ra cho Bên A, Chủ đầu tư, bên thứ ba hoặc công trình, bao gồm cả khoản phạt, bồi thường, chi phí khắc phục, chi phí thuê đơn vị thay thế và chi phí quản lý phát sinh mà Bên A phải chịu.</p>
<p>5.11. Bên B có trách nhiệm bảo mật toàn bộ thông tin liên quan đến Hợp đồng, đơn giá, tạm ứng, thanh toán, khấu trừ, phạt vi phạm, hồ sơ kỹ thuật, hồ sơ dự án, thông tin công trường, Bên A và Chủ đầu tư. Bên B không được tự ý tiết lộ, cung cấp, đăng tải, chia sẻ hoặc bình luận các thông tin nêu trên trên Zalo, Facebook, mạng xã hội, phương tiện truyền thông hoặc cho bất kỳ bên thứ ba nào khi chưa được Bên A chấp thuận bằng văn bản. Trường hợp vi phạm, Bên A có quyền tạm dừng nghiệm thu, tạm dừng thanh toán, chấm dứt Hợp đồng, yêu cầu Bên B chịu phạt 50.000.000 đồng/lần vi phạm và bồi thường toàn bộ thiệt hại phát sinh.</p>

<p><strong>Điều 6. Tiêu chuẩn thi công, kiểm tra chất lượng và sửa lỗi</strong></p>
<p>6.1. Các Bên thống nhất sử dụng hồ sơ thiết kế, chỉ dẫn kỹ thuật, biện pháp thi công, tiêu chuẩn nghiệm thu của dự án và hợp đồng giữa Bên A với Chủ đầu tư làm căn cứ thi công, kiểm tra và nghiệm thu chất lượng.</p>
<p>6.2. Khi hoàn thành từng hạng mục/phần việc, Bên B có trách nhiệm thông báo cho Bên A để kiểm tra, nghiệm thu và lập biên bản nghiệm thu làm cơ sở thanh toán.</p>
<p>6.3. Bên B có trách nhiệm sửa chữa, làm lại hoặc khắc phục các lỗi tồn tại trong thời hạn 12 giờ kể từ khi Bên A yêu cầu hoặc trong thời hạn khác do Bên A ấn định phù hợp với tính chất công việc.</p>
<p>6.4. Nếu Bên B không bố trí nhân lực khắc phục hoặc khắc phục không đạt yêu cầu, Bên A có quyền tạm dừng nghiệm thu, tạm dừng xác nhận khối lượng đợt thanh toán kế tiếp, đưa nhân lực công nhật/tổ đội khác/bên thứ ba vào sửa chữa. Toàn bộ chi phí phát sinh được khấu trừ vào khoản thanh toán gần nhất hoặc bất kỳ khoản tiền nào Bên A còn phải thanh toán cho Bên B.</p>
<p>6.5. Việc Bên A nghiệm thu hoặc thanh toán một phần không làm miễn trừ trách nhiệm sửa lỗi, bảo hành, bồi thường hoặc các nghĩa vụ còn tồn tại của Bên B.</p>

<p><strong>Điều 7. Tạm ứng, nghiệm thu, thanh toán và quyết toán</strong></p>
<p>7.1. Phương thức thanh toán: Bên A ưu tiên thanh toán bằng chuyển khoản vào tài khoản do Bên B cung cấp. Việc thanh toán bằng tiền mặt chỉ thực hiện khi phù hợp quy định pháp luật, quy chế tài chính của Bên A và có đầy đủ chứng từ hợp lệ. Đồng tiền thanh toán là Việt Nam đồng (VND).</p>
<p>7.2. Tạm ứng: Trong quá trình thực hiện, căn cứ tiến độ thi công, khối lượng đã triển khai, nhu cầu tổ chức thi công của Bên B và xác nhận của đại diện Bên A tại công trường, Bên A có thể xem xét tạm ứng một phần giá trị giao khoán cho Bên B. Mức tạm ứng, thời điểm tạm ứng và điều kiện tạm ứng do Bên A phê duyệt tại từng thời điểm. Khoản tạm ứng này là tạm ứng giá trị giao khoán, không phải tiền lương hoặc khoản thanh toán trực tiếp của Bên A cho thành viên tổ đội và sẽ được khấu trừ vào các đợt thanh toán tiếp theo.</p>
<p>7.3. Nghiệm thu và thanh toán giai đoạn: Vào ngày 25 hằng tháng hoặc thời điểm khác do Bên A thông báo, Các Bên tiến hành nghiệm thu, xác nhận khối lượng công việc hoàn thành trong tháng để làm cơ sở thanh toán. Hồ sơ thanh toán giai đoạn gồm: (i) Giấy đề nghị thanh toán của Bên B; (ii) Biên bản nghiệm thu khối lượng hoàn thành; (iii) Bảng giá trị khối lượng hoàn thành; (iv) Danh sách lỗi/defect và cam kết khắc phục của Bên B, nếu có; (v) Danh sách thành viên tổ đội, bảng xác nhận phân bổ tiền khoán hoặc tài liệu tương đương do Bên B lập; (vi) Hồ sơ thuế, thông tin cá nhân, mã số thuế, tài khoản ngân hàng và tài liệu phục vụ thanh toán, khấu trừ thuế; (vii) Biên bản giao nhận, đối chiếu vật tư, thiết bị, công cụ, dụng cụ do Bên A cấp hoặc cho mượn, nếu có. Bên A thanh toán tối đa 80% giá trị khối lượng hoàn thành được nghiệm thu hợp lệ trong kỳ, sau khi khấu trừ toàn bộ tạm ứng, thuế, phí, vi phạm, chi phí khắc phục, bồi thường, vật tư vượt định mức và các nghĩa vụ tài chính khác của Bên B, nếu có. Thời hạn thanh toán là 15 ngày làm việc kể từ ngày hồ sơ thanh toán hợp lệ được Bên A chấp thuận và không có căn cứ tạm giữ, khấu trừ hoặc tạm dừng thanh toán.</p>
<p>7.4. Thanh toán phần giá trị còn lại: Phần giá trị còn lại được thanh toán sau khi hạng mục liên quan được Chủ đầu tư/Tư vấn giám sát nghiệm thu, Bên A nhận bàn giao, Các Bên hoàn tất đối chiếu công nợ, hồ sơ thanh toán/quyết toán. Đối với hạng mục có yêu cầu bảo hành, phần tạm giữ được thanh toán sau khi kết thúc thời gian bảo hành hoặc theo Phụ lục thanh toán được Các Bên thống nhất.</p>
<p>7.5. Tạm dừng tạm ứng, nghiệm thu và thanh toán: Bên A có quyền tạm dừng tạm ứng, tạm dừng nghiệm thu hoặc tạm dừng thanh toán nếu Bên B chậm tiến độ, không bảo đảm năng lực tổ chức thi công, vi phạm chất lượng, an toàn, vệ sinh công trường, chưa hoàn thiện hồ sơ thanh toán hoặc còn nghĩa vụ chưa hoàn thành. Việc tạm ứng, nghiệm thu hoặc thanh toán được tiếp tục sau khi Bên B khắc phục đầy đủ và được Bên A xác nhận.</p>
<p>7.6. Quyết toán: Sau khi hạng mục/công việc kết thúc, Bên B thông báo cho Bên A để nghiệm thu, bàn giao và thực hiện quyết toán. Hồ sơ quyết toán bao gồm: (i) Biên bản nghiệm thu bàn giao; (ii) Bảng giá trị quyết toán; (iii) Hồ sơ hoàn công/hoàn công khối lượng thanh toán, nếu có; (iv) Biên bản đối chiếu công nợ; (v) Biên bản đối chiếu giao nhận vật tư, thiết bị, công cụ, dụng cụ, nếu có; (vi) Bảng đối chiếu các khoản tạm ứng, tạm giữ, khấu trừ, vi phạm, bồi thường và nghĩa vụ tài chính khác của Bên B; (vii) Tài liệu khác theo biểu mẫu hoặc yêu cầu hợp lệ của Bên A. Trong vòng 30 ngày kể từ ngày Bên B hoàn thành bàn giao và cung cấp đủ hồ sơ hợp lệ, Bên A thực hiện/phê duyệt hồ sơ quyết toán theo quy trình nội bộ. Thời hạn thanh toán giá trị quyết toán còn lại là 30 ngày kể từ ngày hồ sơ quyết toán được Bên A phê duyệt, sau khi khấu trừ toàn bộ khoản tạm ứng, tạm giữ, vi phạm, bồi thường và nghĩa vụ tài chính khác của Bên B, nếu có.</p>

<p><strong>Điều 8. Thuế, phí và nghĩa vụ tài chính</strong></p>
<p>8.1. Bên B chịu trách nhiệm cung cấp đầy đủ, trung thực và kịp thời thông tin cá nhân, mã số thuế, số tài khoản, hồ sơ thành viên tổ đội và các hồ sơ cần thiết để phục vụ việc thanh toán, kê khai, khấu trừ thuế theo quy định.</p>
<p>8.2. Bên A được quyền khấu trừ, kê khai và nộp thay các khoản thuế, phí hoặc nghĩa vụ tài chính liên quan đến khoản thanh toán cho Bên B/thành viên tổ đội theo quy định pháp luật và yêu cầu quản trị thuế của Bên A.</p>
<p>8.3. Trường hợp Bên B cung cấp thông tin không chính xác, không đầy đủ hoặc không kịp thời dẫn đến phát sinh truy thu, xử phạt, tiền chậm nộp, không được chấp nhận chi phí hoặc thiệt hại cho Bên A, Bên B có trách nhiệm hoàn trả, bồi thường toàn bộ thiệt hại và chi phí phát sinh cho Bên A.</p>

<p><strong>Điều 9. An toàn lao động, vệ sinh môi trường, nội quy công trường và xử lý vi phạm</strong></p>
<p>9.1. Bên B có trách nhiệm phổ biến, hướng dẫn và giám sát thành viên tổ đội tuân thủ đầy đủ quy định về an toàn lao động, vệ sinh môi trường, phòng cháy chữa cháy, an ninh trật tự, bảo hộ lao động và nội quy công trường của Bên A/Chủ đầu tư.</p>
<p>9.2. Bên B không được bố trí người chưa được phổ biến quy định an toàn, người không có bảo hộ phù hợp, người không đủ sức khỏe, người sử dụng ma túy, rượu bia, chất kích thích, người đang bị truy cứu trách nhiệm hình sự hoặc người không đáp ứng điều kiện ra/vào công trường vào thực hiện công việc.</p>
<p>9.3. Bên B có trách nhiệm dọn dẹp vệ sinh khu vực thi công hằng ngày, tập kết vật tư đúng nơi quy định, bảo quản tài sản, vật tư, công cụ, dụng cụ được giao và bàn giao lại mặt bằng sau khi hoàn thành công việc theo yêu cầu của Ban chỉ huy công trường.</p>
<p>9.4. Trường hợp Bên B hoặc thành viên tổ đội vi phạm quy định an toàn, chất lượng, vệ sinh môi trường, an ninh trật tự, nội quy công trường hoặc có hành vi đe dọa, xúc phạm, cản trở cán bộ an toàn, giám sát thi công, kỹ sư phụ trách hoặc đại diện Bên A/Chủ đầu tư, Bên A có quyền lập biên bản vi phạm, yêu cầu người vi phạm rời khỏi công trường, tạm dừng thi công, khấu trừ thanh toán, áp dụng phạt vi phạm 10.000.000 đồng/lần vi phạm và/hoặc chấm dứt Hợp đồng tùy theo mức độ vi phạm.</p>
<p>9.5. Trường hợp xảy ra sự cố, tai nạn lao động, mất an toàn, mất an ninh trật tự hoặc thiệt hại tài sản do lỗi của Bên B hoặc thành viên tổ đội của Bên B, Bên B phải thông báo ngay cho Bên A, phối hợp xử lý và chịu toàn bộ trách nhiệm, chi phí, thiệt hại phát sinh theo quy định của Hợp đồng này và quy định pháp luật.</p>

<p><strong>Điều 10. Trách nhiệm do vi phạm Hợp đồng</strong></p>
<p>10.1. Trường hợp Bên B không bảo đảm năng lực tổ chức thi công theo cam kết, làm ảnh hưởng đến tiến độ chung quá 05 ngày kể từ ngày Bên A thông báo, Bên B chịu phạt vi phạm 500.000 đồng/ngày hoặc mức phạt khác theo Phụ lục Hợp đồng, đồng thời phải lập và thực hiện phương án khắc phục tiến độ theo yêu cầu của Bên A.</p>
<p>10.2. Trường hợp Bên A/Ban chỉ huy công trường yêu cầu Bên B tăng cường năng lực thi công để bảo đảm tiến độ nhưng Bên B không thực hiện hoặc thực hiện không đạt yêu cầu, Bên B chịu phạt 5.000.000 đồng/lần vi phạm.</p>
<p>10.3. Trường hợp Bên B chậm tiến độ quá 03 ngày kể từ ngày Bên A thông báo hoặc yêu cầu khắc phục, Bên B chịu phạt chậm tiến độ 5.000.000 đồng/ngày chậm, tối đa 15.000.000 đồng/lần vi phạm. Bên A đồng thời có quyền thuê tổ đội/đơn vị khác thực hiện thay và khấu trừ toàn bộ chi phí phát sinh vào khoản còn phải thanh toán cho Bên B.</p>
<p>10.4. Trường hợp Bên B tự ý dừng thực hiện công việc trong 02 ngày liên tiếp mà không được Bên A chấp thuận bằng văn bản, Bên B chịu phạt 10.000.000 đồng/ngày, tối đa 20.000.000 đồng/lần vi phạm.</p>
<p>10.5. Trường hợp Bên B tự ý dừng thực hiện công việc quá 03 ngày, bỏ công trường hoặc không bố trí đủ năng lực để tiếp tục thực hiện công việc, Bên A có quyền xác định đây là vi phạm nghiêm trọng, đơn phương chấm dứt Hợp đồng, thuê tổ đội/đơn vị khác thay thế và khấu trừ/bù trừ toàn bộ chi phí huy động, chi phí chậm tiến độ, chi phí quản lý và thiệt hại phát sinh vào các khoản còn phải thanh toán cho Bên B.</p>
<p>10.6. Bên B chịu trách nhiệm bồi thường toàn bộ thiệt hại thực tế do lỗi của Bên B hoặc thành viên tổ đội của Bên B gây ra cho Bên A, Chủ đầu tư, bên thứ ba hoặc công trình, bao gồm chi phí sửa chữa, làm lại, chi phí thuê bên thứ ba, chi phí vật tư vượt định mức, chi phí quản lý, khoản phạt, bồi thường hoặc khấu trừ mà Bên A phải chịu do lỗi của Bên B.</p>
<p>10.7. Nếu các khoản phạt, bồi thường, chi phí khắc phục và nghĩa vụ tài chính của Bên B vượt quá khoản tiền Bên A còn phải thanh toán, Bên B có trách nhiệm hoàn trả phần còn thiếu trong vòng 05 ngày làm việc kể từ ngày Bên A thông báo. Hết thời hạn này mà Bên B không thanh toán, Bên A có quyền áp dụng biện pháp pháp lý cần thiết để thu hồi khoản nợ theo quy định pháp luật.</p>

<p><strong>Điều 12. Tạm dừng, đình chỉ và chấm dứt Hợp đồng</strong></p>
<p>12.1. Bên A có quyền tạm dừng thi công, đình chỉ một phần hoặc toàn bộ công việc, yêu cầu thay thế thành viên tổ đội nếu Bên B vi phạm tiến độ, chất lượng, an toàn lao động, vệ sinh môi trường, an ninh trật tự, nội quy công trường, nghĩa vụ hồ sơ hoặc nghĩa vụ khác theo Hợp đồng này.</p>
<p>12.2. Bên A có quyền chấm dứt Hợp đồng trước thời hạn nếu Bên B vi phạm bất kể điều khoản nào của Hợp đồng.</p>
<p>12.3. Khi Hợp đồng bị chấm dứt, Các Bên lập biên bản xác nhận khối lượng đã thực hiện, giá trị được nghiệm thu, các khoản đã thanh toán, khoản còn phải thanh toán, khoản bị tạm giữ/khấu trừ và các nghĩa vụ còn tồn tại của mỗi Bên. Bên A chỉ thanh toán phần giá trị hợp lệ còn lại sau khi đã khấu trừ toàn bộ nghĩa vụ của Bên B.</p>
<p>12.4. Khi Bên B bị đình chỉ thi công hoặc Hợp đồng bị chấm dứt, toàn bộ máy móc, thiết bị, công cụ, vật tư và tài sản của Bên B chỉ được đưa ra khỏi công trường sau khi được đại diện Bên A chấp thuận và hoàn tất đối chiếu công nợ, vật tư, thiết bị, hồ sơ an toàn, hồ sơ nghiệm thu/quyết toán liên quan.</p>

<p><strong>Điều 13. Điều khoản chung</strong></p>
<p>13.1. Hợp đồng này có hiệu lực kể từ ngày ký và được tự động thanh lý, chấm dứt hiệu lực khi Các Bên đã hoàn thành toàn bộ nghĩa vụ thanh toán, quyết toán, bàn giao hồ sơ, đối chiếu công nợ và các nghĩa vụ khác theo Hợp đồng này, trừ các nghĩa vụ theo bản chất vẫn tiếp tục có hiệu lực sau khi Hợp đồng chấm dứt.</p>
<p>13.2. Hợp đồng này, các Phụ lục, biên bản nghiệm thu, biên bản giao nhận vật tư/thiết bị, thông báo điều phối thi công, biên bản vi phạm và các văn bản được Các Bên xác nhận là bộ phận không tách rời của Hợp đồng.</p>
<p>13.3. Mọi sửa đổi, bổ sung Hợp đồng phải được lập thành văn bản và có chữ ký hoặc xác nhận hợp lệ của Các Bên.</p>
<p>13.4. Mọi tranh chấp phát sinh từ hoặc liên quan đến Hợp đồng này trước hết được giải quyết thông qua thương lượng, hòa giải trên tinh thần thiện chí, hợp tác. Trường hợp Các Bên không giải quyết được tranh chấp trong vòng 30 ngày kể từ ngày một Bên gửi thông báo tranh chấp, tranh chấp được đưa ra Tòa án có thẩm quyền giải quyết theo quy định pháp luật.</p>
<p>13.5. Hợp đồng này được lập thành 03 bản có giá trị pháp lý như nhau; Bên A giữ 02 bản, Bên B giữ 01 bản.</p>
<p>&nbsp;</p>
<p><em>Ghi chú/thỏa ước phụ trợ: {{GHI_CHU}}</em></p>

<table style="width:100%;margin-top:40px;border:none;">
  <tr>
    <td style="width:50%;text-align:center;border:none;padding:0;">
      <p style="font-weight:bold;text-transform:uppercase;margin-bottom:64px;">ĐẠI DIỆN BÊN A (GIAO KHOÁN)<br/><span style="font-weight:normal;font-size:11px;color:#64748b;">Ký, đóng dấu và ghi rõ họ tên</span></p>
      <p style="font-weight:bold;">{{DAI_DIEN_CONG_TY_A}}<br/><span style="font-weight:normal;font-size:11px;color:#64748b;">{{CHUC_VU_CONG_TY_A}} {{TEN_CONG_TY_A}}</span></p>
    </td>
    <td style="width:50%;text-align:center;border:none;padding:0;">
      <p style="font-weight:bold;text-transform:uppercase;margin-bottom:64px;">ĐẠI DIỆN BÊN B (NHẬN KHOÁN)<br/><span style="font-weight:normal;font-size:11px;color:#64748b;">Ký và ghi rõ họ tên</span></p>
      <p style="font-weight:bold;">{{DAI_DIEN_B_KY}}<br/><span style="font-weight:normal;font-size:11px;color:#64748b;">{{TEN_THAU_PHU_KY}}</span></p>
    </td>
  </tr>
</table>
`;

interface SubcontractorArchiveProps {
  currentUser: Employee;
  canEdit?: boolean;
  canDelete?: boolean;
  /** Khi được truyền vào, component sẽ tự động mở print preview cho HĐ này. Dùng khi redirect từ Menu Thầu Phụ (chi tiết công việc / Kanban). */
  viewContractId?: string;
}

export default function SubcontractorArchive({ currentUser, canEdit = true, canDelete = true, viewContractId: propViewContractId }: SubcontractorArchiveProps) {
  const { addToast } = useNotification();
  const [archivedList, setArchivedList] = useState<ArchivedQuote[]>([]);
  const [projectsList, setProjectsList] = useState<{ id: string; name?: string }[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedQuote, setSelectedQuote] = useState<ArchivedQuote | null>(null);
  const [tempQuote, setTempQuote] = useState<ArchivedQuote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArchivedQuote | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);
  // Nội dung bản in tự do (contentEditable) — thay cho các ô input cố định trước
  // đây. isEditing: hồ sơ đã duyệt (tempQuote.isApproved) thì khóa, phải "Hủy
  // phê duyệt" mới sửa lại được (xem effect load bên dưới + toolbar Duyệt/Sửa).
  const [docHtml, setDocHtml] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);
  // Thông tin doanh nghiệp (Bên A) lấy trực tiếp từ Cài Đặt Hệ Thống
  // (business_profile) thay vì hard-code cứng trong mẫu hợp đồng — trước đây
  // mẫu ghi sai cứng MST/địa chỉ/SĐT và cả tên người đại diện ("Nguyễn Văn
  // Hoàng" — không phải tên thật Giám đốc).
  const [businessInfo, setBusinessInfo] = useState<any>(null);
  useEffect(() => {
    dbService.businessProfile.get().then(setBusinessInfo).catch(() => {});
  }, []);

  // Load suppliers list from Supabase (bảng thầu phụ riêng)
  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const data = await dbService.accountingSubcontractors.list();
        setSuppliers(data);
      } catch (err) {
        console.error("Lỗi load thầu phụ từ Supabase:", err);
      }
    };
    loadSuppliers();
    window.addEventListener('hl-suppliers-updated', loadSuppliers);
    return () => {
      window.removeEventListener('hl-suppliers-updated', loadSuppliers);
    };
  }, []);

  const fetchArchives = async () => {
    setLoading(true);
    try {
      const data = await dbService.archivedQuotes.list('subcontractor');
      setArchivedList(data);
      const projs = await dbService.projects.list();
      setProjectsList(projs);
    } catch (error) {
      console.error("Lỗi khi tải hồ sơ thầu phụ:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchives();
    // 'hl-archived-subcontractor-quotes-updated': tự bắn khi CHÍNH tab này lưu
    // (từ SubcontractorEstimator hoặc chính component này). 'hl-archived-quotes-updated':
    // App.tsx bắn định kỳ 5 phút cho bảng archived_quotes (nhóm "ít đổi") — tên
    // ĐÚNG để nhận biết hợp đồng do tab/người khác lập/duyệt, trước đây bị bỏ sót.
    window.addEventListener('hl-archived-subcontractor-quotes-updated', fetchArchives);
    window.addEventListener('hl-archived-quotes-updated', fetchArchives);
    return () => {
      window.removeEventListener('hl-archived-subcontractor-quotes-updated', fetchArchives);
      window.removeEventListener('hl-archived-quotes-updated', fetchArchives);
    };
  }, []);

  // ── TỰ ĐỘNG MỞ PRINT PREVIEW KHI ĐƯỢC REDIRECT TỪ MENU THẦU PHỤ ──
  useEffect(() => {
    if (archivedList.length === 0) return;

    // Ưu tiên prop viewContractId, fallback sang localStorage (từ TaskDetailModal / Kanban)
    const targetId = propViewContractId || localStorage.getItem('hl_view_contract_id');
    if (!targetId) return;

    const found = archivedList.find(q => q.id === targetId);
    if (found) {
      setSelectedQuote(found);
      setTempQuote({ ...found });
      setShowPrintPreview(true);
    }
    // Chỉ dùng 1 lần — xoá ngay sau khi consume
    if (!propViewContractId) {
      localStorage.removeItem('hl_view_contract_id');
    }
  }, [archivedList, propViewContractId]);

  const filteredList = useMemo(() => {
    return archivedList.filter(item => {
      const isCreator = item.creatorId === currentUser.id;
      // Allow viewing if creator, or if user has admin/accountant privileges, but fallback to simple filter
      if (!isCreator && !isUserInRoleGroup(currentUser.id, 'role_admin') && !isUserInRoleGroup(currentUser.id, 'role_accounting')) return false;

      const matchesSearch = 
        (item.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.projectName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.subcontractorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.workName || '').toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
  }, [archivedList, searchTerm, currentUser]);

  const handleDeleteClick = (item: ArchivedQuote, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDelete) {
      addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền XÓA hợp đồng thầu phụ.', type: 'error' });
      return;
    }
    setDeleteTarget(item);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await dbService.archivedQuotes.delete(deleteTarget.id);
      setArchivedList(prev => prev.filter(q => q.id !== deleteTarget.id));
      if (selectedQuote?.id === deleteTarget.id) {
        setSelectedQuote(null);
      }
      setDeleteTarget(null);
      
      // Dispatch custom event to sync drop-downs
      window.dispatchEvent(new CustomEvent('hl-archived-subcontractor-quotes-updated'));
    } catch (error) {
      addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi xóa hồ sơ.', type: 'error' });
    }
  };

  const getStatusBadge = (status: string, isApproved?: boolean) => {
    const statusNormalized = (status || '').trim().toLowerCase();
    if (isApproved || statusNormalized === 'hoàn thành') {
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    }
    return 'bg-amber-50 text-amber-700 border border-amber-200';
  };

  const selectedSupplier = suppliers.find(s => s.id === selectedQuote?.subcontractorId);

  // Thay {{PLACEHOLDER}} bằng giá trị thật từ hồ sơ — gọi 1 LẦN lúc mở/khôi phục
  // bản in (không gọi lại lúc gõ, khác các hàm generateProcessedHtml của 3 hồ sơ
  // kia vì file này không có sẵn "quoteData" tách biệt khỏi state đang sửa).
  const generateSubcontractorContractHtml = (q: ArchivedQuote, supplier?: Supplier): string => {
    let html = DEFAULT_SUBCONTRACTOR_CONTRACT_TEMPLATE;
    const day = q.day || (q.createdAt ? q.createdAt.split('/')[0] : '01');
    const month = q.month || (q.createdAt ? q.createdAt.split('/')[1] : '07');
    const year = q.year || (q.createdAt ? q.createdAt.split('/')[2] : '2026');
    const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('vi-VN') : 'Đang cập nhật';
    const signedLabel = q.signedLabel || (q.signedDate ? `Đã ký ngày ${fmtDate(q.signedDate)}` : 'Chưa ký (Sẽ bổ sung ngày ký sau)');
    const replacements: Record<string, string> = {
      '{{TEN_CONG_TY_A}}': businessInfo?.companyName || 'CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG',
      '{{MST_CONG_TY_A}}': businessInfo?.taxCode || '5801372263',
      '{{DIA_CHI_CONG_TY_A}}': businessInfo?.address || 'Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng',
      '{{DIEN_THOAI_CONG_TY_A}}': businessInfo?.phone || '0966 545 959',
      '{{DAI_DIEN_CONG_TY_A}}': businessInfo?.representative || 'Trương Hữu Long',
      '{{CHUC_VU_CONG_TY_A}}': 'Giám đốc',
      '{{MA_HOP_DONG}}': q.code || 'Chưa cập nhật',
      '{{NGAY}}': String(day), '{{THANG}}': String(month), '{{NAM}}': String(year),
      '{{TEN_THAU_PHU}}': q.subcontractorName || 'Chưa cập nhật',
      '{{MA_THAU_PHU}}': q.subcontractorId || 'N/A',
      '{{DAI_DIEN_THAU_PHU}}': q.representative !== undefined ? q.representative : (supplier?.representative || 'Chưa cập nhật'),
      '{{DIEN_THOAI_THAU_PHU}}': q.phone !== undefined ? q.phone : (supplier?.phone || 'Chưa cập nhật'),
      '{{DIA_CHI_THAU_PHU}}': q.address !== undefined ? q.address : (supplier?.address || 'Chưa cập nhật'),
      '{{MST_THAU_PHU}}': q.taxCode !== undefined ? q.taxCode : (supplier?.taxCode || 'Chưa cập nhật'),
      '{{CONG_TRINH}}': q.projectName || 'Chưa cập nhật',
      '{{CHU_DAU_TU}}': q.customerName || 'Chưa cập nhật',
      '{{SDT_CHU_DAU_TU}}': q.customerPhone || 'Chưa cập nhật',
      '{{DIA_CHI_THI_CONG}}': q.customerAddress || 'Chưa cập nhật',
      '{{NOI_DUNG_CONG_VIEC}}': q.workName || 'Chưa cập nhật',
      '{{NGAY_BAT_DAU}}': fmtDate(q.startDate),
      '{{NGAY_HOAN_THIEN}}': fmtDate(q.endDate),
      '{{GIA_TRI_HOP_DONG}}': `${(q.contractValue || 0).toLocaleString('vi-VN')} VND`,
      '{{TRANG_THAI_KY}}': signedLabel,
      '{{TRANG_THAI_THANH_TOAN}}': q.status || 'Đã Lập',
      '{{GHI_CHU}}': q.notes || 'Không có',
      '{{DAI_DIEN_B_KY}}': q.representative || supplier?.representative || 'Chưa ký',
      '{{TEN_THAU_PHU_KY}}': q.subcontractorName || 'Tổ thợ thầu phụ',
      // Các trường theo mẫu HĐ Giao Khoán mới (ngày sinh/CCCD ngày cấp/nơi cấp/
      // tài khoản ngân hàng của Bên B) — hệ thống hiện chưa có ô nhập riêng cho
      // các trường này trên "Lập HĐ Thầu Phụ" nên mặc định "Chưa cập nhật".
      '{{NGAY_SINH_B}}': q.ngaySinhB ? fmtDate(q.ngaySinhB) : 'Chưa cập nhật',
      '{{NGAY_CAP_B}}': q.ngayCapB ? fmtDate(q.ngayCapB) : 'Chưa cập nhật',
      '{{NOI_CAP_B}}': q.noiCapB || 'Chưa cập nhật',
      '{{STK_B}}': q.stkB || 'Chưa cập nhật',
      '{{NGAN_HANG_B}}': q.nganHangB || 'Chưa cập nhật',
      '{{GIA_TRI_BANG_CHU}}': q.contractValue ? docSoTiengViet(q.contractValue) : 'Chưa cập nhật',
    };
    Object.entries(replacements).forEach(([placeholder, value]) => {
      html = html.split(placeholder).join(value);
    });
    return html;
  };

  // Nạp lại bản in mỗi khi mở 1 hồ sơ khác — ưu tiên contractHtml đã lưu tùy
  // chỉnh trước đó, nếu chưa có thì generate mới từ dữ liệu cấu trúc sẵn có
  // (áp dụng đúng cho cả hồ sơ CŨ trước khi có tính năng này — không mất dữ liệu).
  useEffect(() => {
    if (!showPrintPreview || !tempQuote) return;
    setDocHtml(tempQuote.contractHtml || generateSubcontractorContractHtml(tempQuote, selectedSupplier));
    setIsEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPrintPreview, tempQuote?.id, businessInfo]);

  const handleUnapproveSubcontractorContract = async () => {
    if (!tempQuote) return;
    if (!window.confirm('Hủy phê duyệt để chỉnh sửa lại Hợp Đồng Thầu Phụ?\nSau khi sửa xong cần Duyệt Hợp Đồng lại từ đầu.\nLưu ý: hợp đồng này sẽ tạm thời không còn tính vào Công Nợ Trả cho tới khi được duyệt lại.')) return;
    try {
      // Khi duyệt, "status" được set cứng thành 'Hoàn thành' (xem nút Duyệt Hợp
      // Đồng bên dưới). Nếu hủy phê duyệt mà không trả "status" về lại 'Đã Lập',
      // mọi nơi đang tự suy ra "đã duyệt" từ status==='hoàn thành' (badge danh
      // sách, badge trong modal, Công Nợ Trả ở FinanceManagement.tsx) sẽ TIẾP TỤC
      // hiển thị "Đã Duyệt" dù isApproved đã false — khiến người dùng tưởng hồ sơ
      // vẫn khóa dù vùng soạn thảo bên dưới thực ra đã mở khóa để sửa.
      const updated = { ...tempQuote, isApproved: false, status: 'Đã Lập' } as unknown as ArchivedQuote;
      setTempQuote(updated);
      await dbService.archivedQuotes.save({ ...updated, sector: 'subcontractor' });
      setSelectedQuote(updated);
      setArchivedList(prev => prev.map(q => q.id === updated.id ? updated : q));
      addToast({ title: '🔓 Đã hủy phê duyệt', message: 'Hợp đồng đã được mở khóa để chỉnh sửa.', type: 'info' });
      window.dispatchEvent(new CustomEvent('hl-archived-subcontractor-quotes-updated'));
    } catch (err) {
      console.error('Lỗi khi hủy phê duyệt hợp đồng thầu phụ:', err);
      addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi hủy phê duyệt.', type: 'error' });
    }
  };

  const handleSaveSubcontractorDoc = async () => {
    if (!tempQuote) return;
    setSavingDoc(true);
    try {
      const updated = { ...tempQuote, contractHtml: docHtml };
      await dbService.archivedQuotes.save({ ...updated, sector: 'subcontractor' });
      setTempQuote(updated);
      setSelectedQuote(updated);
      setArchivedList(prev => prev.map(q => q.id === updated.id ? updated : q));
      setIsEditing(false);
      addToast({ title: '💾 Đã lưu', message: 'Đã lưu bản in hợp đồng thầu phụ thành công!', type: 'success' });
      window.dispatchEvent(new CustomEvent('hl-archived-subcontractor-quotes-updated'));
    } catch (err) {
      console.error('Lỗi khi lưu bản in hợp đồng thầu phụ:', err);
      addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi lưu.', type: 'error' });
    } finally {
      setSavingDoc(false);
    }
  };

  const handleExportSubcontractorWord = () => {
    if (!docHtml || !tempQuote) return;
    exportHtmlToWord(docHtml, `HopDongThauPhu_${tempQuote.code || tempQuote.id}`);
  };

  return (
    <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 p-6 space-y-6 text-left" id="subcontractor_archive_workspace">
      <div>
        <h3 className="font-black text-lg text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <span className="p-1 px-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 text-xs">📝 CONTRACT ARCHIVE</span>
          Hồ Sơ Lưu Trữ Hợp Đồng Thầu Phụ
        </h3>
      </div>

      <div className="flex gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800/80">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Tìm theo Mã hợp đồng, Thầu phụ, Công việc, Dự án..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 pl-10 pr-4 py-2.5 rounded-lg text-xs outline-none focus:border-emerald-500 text-slate-100 placeholder-slate-500 font-medium"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500 animate-pulse font-bold uppercase tracking-wider">
          Đang tải dữ liệu hồ sơ thầu phụ...
        </div>
      ) : filteredList.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/10 space-y-2">
          <FileText className="w-8 h-8 text-slate-600 mx-auto" />
          <h5 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">Không tìm thấy hợp đồng nào</h5>
          <p className="text-[10px] text-slate-500 max-w-sm mx-auto">
            Vui lòng chọn tab "Lập HĐ Thầu Phụ" để khởi tạo hợp đồng mới.
          </p>
        </div>
      ) : (
        <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950 shadow-lg">
          <table className="w-full text-slate-300 text-xs text-left">
            <thead>
              <tr className="bg-slate-900 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <th className="px-4 py-3 text-center w-[50px]">STT</th>
                <th className="px-4 py-3">Mã Hợp Đồng</th>
                <th className="px-4 py-3">Dự Án Liên Kết</th>
                <th className="px-4 py-3">Thầu Phụ Nhận Khoán</th>
                <th className="px-4 py-3">Nội Dung Công Việc</th>
                <th className="px-4 py-3">Ngày Lập</th>
                <th className="px-4 py-3 text-right">Giá Trị Khoán</th>
                <th className="px-4 py-3 text-center">Trạng Thái</th>
                <th className="px-4 py-3 text-center">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {filteredList.map((item, idx) => {
                return (
                  <tr 
                    key={item.id}
                    onClick={() => {
                      setSelectedQuote(item);
                      setTempQuote({ ...item });
                      setShowPrintPreview(true);
                    }}
                    className="hover:bg-slate-900/60 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5 text-center font-mono text-slate-500 font-bold border-r border-slate-900">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3.5 font-bold font-mono text-emerald-400 uppercase">
                      {item.code || 'BÁO GIÁ LẺ'}
                    </td>
                    <td className="px-4 py-3.5">
                      <div>
                        <span className="font-semibold block text-slate-200 line-clamp-1">{item.projectName}</span>
                        <span className="text-[10px] text-slate-500">Chủ đầu tư: {item.customerName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div>
                        <span className="font-semibold block text-slate-200">{item.subcontractorName}</span>
                        <span className="text-[10px] text-emerald-500 font-mono font-bold">Mã: {item.subcontractorId}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 max-w-[200px] truncate text-[11px] text-slate-350" title={item.workName}>
                      {item.workName}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 font-medium font-mono">
                      {item.createdAt || 'Chưa cập nhật'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-100">
                      {(item.contractValue || 0).toLocaleString('vi-VN')} đ
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {(() => {
                        const statusNormalized = (item.status || "").trim().toLowerCase();
                        const isApproved = item.isApproved === true || statusNormalized === 'hoàn thành';
                        const displayStatus = isApproved ? 'Đã Duyệt' : 'Chưa Duyệt';
                        const badgeStyle = getStatusBadge(item.status || 'Đã Lập', item.isApproved);
                        return (
                          <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wider ${badgeStyle}`}>
                            {displayStatus}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex justify-center items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedQuote(item);
                            setTempQuote({ ...item });
                            setShowPrintPreview(true);
                          }}
                          className="p-1.5 bg-slate-900 text-slate-300 hover:text-white rounded-lg border border-slate-800 hover:bg-slate-800 transition shadow cursor-pointer"
                          title="Xem & In Hợp Đồng"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteClick(item, e)}
                          className="p-1.5 bg-rose-50 text-rose-600 hover:text-rose-700 rounded-lg border border-rose-200 hover:bg-rose-100 transition shadow cursor-pointer"
                          title="Xóa Hợp Đồng"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[120] p-4 text-left">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h4 className="text-sm font-extrabold uppercase text-rose-500">Xác Nhận Xóa Hợp Đồng</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Bạn có chắc chắn muốn xóa hợp đồng thầu phụ <strong className="text-white">{deleteTarget.code}</strong> khỏi hệ thống lưu trữ? Thao tác này không thể hoàn tác.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Đồng ý xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW MODAL — dùng React Portal render thẳng vào document.body, tách hoàn
          toàn khỏi cây component của ứng dụng để tránh lỗi in đè chữ ở các trang sau. */}
      {showPrintPreview && selectedQuote && tempQuote && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4 select-text text-left print-portal-backdrop">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl text-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 print-portal-card">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 print-hide">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                    Xem &amp; Chỉnh Sửa Hợp Đồng Thầu Phụ
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium font-mono">
                    Mã HĐ: {tempQuote.code} {(tempQuote.isApproved || (tempQuote.status || '').trim().toLowerCase() === 'hoàn thành') ? (
                      <span className="ml-2 text-emerald-600 font-bold">● ĐÃ DUYỆT</span>
                    ) : (
                      <span className="ml-2 text-amber-500 font-bold">● CHƯA DUYỆT</span>
                    )}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setSelectedQuote(null);
                  setTempQuote(null);
                  setShowPrintPreview(false);
                }}
                className="text-slate-400 hover:text-slate-800 font-black cursor-pointer bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors text-xs"
              >
                ✕
              </button>
            </div>

            {/* Print Body */}
            <div className="p-8 bg-white overflow-y-auto flex-1 font-sans text-xs leading-relaxed text-slate-900 print-agreement relative" id="print-area-archive">
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
                    max-height: none !important;
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
                  /* Chrome có lỗi phân trang với CSS Grid/Flex: khi 1 khối grid (VD: khối
                     ký tên 2 cột cuối văn bản) rơi đúng ranh giới giữa 2 trang, nội dung
                     bị vẽ đè/lặp lên trang sau. Ép về dạng khối xếp dọc (block) khi in để
                     tránh lỗi này — chấp nhận đánh đổi 2 cột xếp chồng thành 1 cột khi in. */
                  #print-area-archive .grid {
                    display: block !important;
                  }
                }
              `}</style>

              {/* Approval Watermark Stamp — chỉ hiện trên màn hình, KHÔNG in ra bản in/PDF */}
              {tempQuote.isApproved && (
                <div className="absolute top-20 right-10 md:right-16 transform rotate-12 border-4 border-emerald-500/40 text-emerald-500/50 font-extrabold uppercase px-4 py-2 rounded-lg text-xs tracking-widest font-sans flex items-center gap-1 bg-white/10 shadow-md pointer-events-none select-none z-50 print:hidden print-hide">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500/50 animate-pulse" />
                  ĐÃ PHÊ DUYỆT
                </div>
              )}

              {/* Inline Action Buttons at Top (Hidden on Print) */}
              <div className="absolute top-6 right-6 flex items-center gap-2 print-hide no-print z-45">
                {tempQuote.isApproved ? (
                  <div className="flex items-center gap-1">
                    <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-[10px] font-bold font-sans flex items-center gap-1 shadow-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Hợp Đồng Đã Duyệt
                    </span>
                    <button
                      onClick={handleUnapproveSubcontractorContract}
                      title="Hủy phê duyệt để mở khóa chỉnh sửa"
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors rounded-xl text-[10px] font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Hủy phê duyệt
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      const updated = {
                        ...tempQuote,
                        isApproved: true,
                        approvedAt: new Date().toLocaleString('vi-VN'),
                        approvedBy: currentUser.name || 'Ban Giám Đốc',
                        status: 'Hoàn thành'
                      } as unknown as ArchivedQuote;
                      setTempQuote(updated);
                      try {
                        await dbService.archivedQuotes.save({ ...updated, sector: 'subcontractor' });
                        setSelectedQuote(updated);
                        setArchivedList(prev => prev.map(q => q.id === updated.id ? updated : q));
                        addToast({ title: '✅ Thành công', message: '🎉 Phê duyệt hợp đồng thầu phụ thành công! Hợp đồng này đã được đưa sang Công nợ Trả.', type: 'success' });
                        window.dispatchEvent(new CustomEvent('hl-archived-subcontractor-quotes-updated'));
                        window.dispatchEvent(new CustomEvent('hl-subcontractor-contract-approved', { detail: updated }));
                      } catch (err) {
                        console.error("Lỗi duyệt hợp đồng:", err);
                        addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi phê duyệt hợp đồng.', type: 'error' });
                      }
                    }}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white transition-colors rounded-xl text-[10px] font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm animate-pulse"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    Duyệt Hợp Đồng
                  </button>
                )}

                {/* Hồ sơ đã duyệt: khóa nút "Chỉnh sửa" — phải Hủy phê duyệt ở trên mới sửa lại được. */}
                {tempQuote.isApproved ? (
                  <span className="px-2 text-[9px] text-slate-400 font-sans italic">🔒 Đã duyệt — hủy phê duyệt để sửa</span>
                ) : !isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white transition-colors rounded-xl text-[10px] font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Chỉnh sửa bản in
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700 shadow-sm">
                    <span className="text-[9px] font-bold font-sans text-amber-400 px-1.5">🔓 ĐANG SỬA</span>
                    <button
                      onClick={handleSaveSubcontractorDoc}
                      disabled={savingDoc}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-all rounded-lg text-[10px] font-bold font-sans flex items-center gap-1 cursor-pointer"
                    >
                      {savingDoc ? 'Đang lưu...' : 'Lưu'}
                    </button>
                    <button
                      onClick={() => { setIsEditing(false); setDocHtml(tempQuote.contractHtml || generateSubcontractorContractHtml(tempQuote, selectedSupplier)); }}
                      disabled={savingDoc}
                      className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-slate-200 transition-all rounded-lg text-[10px] font-bold font-sans flex items-center gap-1 cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                )}

                <button
                  onClick={handleExportSubcontractorWord}
                  title="Xuất file Word"
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors rounded-xl text-[10px] font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <FileDown className="w-3.5 h-3.5 text-blue-600" />
                  Xuất Word
                </button>
              </div>

              <div className="max-w-3xl mx-auto space-y-6 pt-4">
                {/* Giá trị hợp đồng — GIỮ dạng ô nhập số RIÊNG (không nằm trong vùng
                    văn bản tự do), vì Công Nợ Trả (Tài Chính) tính trực tiếp từ
                    field contractValue này (mergedLiabilities → sub.contractValue).
                    Nếu gộp vào bên trong bản in tự do, sửa số ở đó sẽ KHÔNG cập nhật
                    đúng Công Nợ Trả — xem ghi chú tương tự ở FinanceManagement.tsx. */}
                <div className="flex items-center gap-2 print-hide no-print bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <span className="text-xs font-bold text-slate-600">Giá trị hợp đồng khoán:</span>
                  <input
                    type="number"
                    disabled={tempQuote.isApproved || !isEditing}
                    value={tempQuote.contractValue || 0}
                    onChange={(e) => setTempQuote({ ...tempQuote, contractValue: Number(e.target.value) })}
                    className="bg-white border border-slate-300 rounded px-2 py-1 outline-none focus:border-blue-500 font-bold text-emerald-600 disabled:opacity-60 disabled:bg-slate-100 w-40"
                  />
                  <span className="text-[10px] text-slate-400 italic">Đồng bộ trực tiếp với Công Nợ Trả</span>
                </div>

                {/* Header Title */}
                <div className="text-center space-y-1">
                  <h2 className="font-extrabold text-sm uppercase tracking-wide">CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</h2>
                  <h3 className="font-bold text-xs uppercase tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h3>
                  <p className="text-xs font-bold">Độc lập – Tự do – Hạnh phúc</p>
                  <div className="border-b border-slate-300 w-36 mx-auto pt-1"></div>
                </div>

                {/* Nội dung hợp đồng — vùng văn bản tự do (contentEditable), thay cho
                    toàn bộ các ô input cố định phía trên trước đây. Toolbar căn
                    chỉnh kiểu Word chỉ hiện khi isEditing=true; khi chỉ xem/in,
                    toolbar tự ẩn (hideToolbarWhenDisabled) và nội dung không sửa
                    được (disabled) — khớp đúng khóa "đã duyệt thì không sửa được". */}
                <RichTextEditor
                  value={docHtml}
                  onChange={setDocHtml}
                  disabled={tempQuote.isApproved || !isEditing}
                  hideToolbarWhenDisabled
                  editorHeightClassName="min-h-[300px] max-h-none prose max-w-none text-left text-sm leading-relaxed"
                />
              </div>
            </div>

            {/* Print Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center shrink-0 print-hide">
              <span className="text-[10px] text-slate-500 italic">
                💡 Bấm "Chỉnh sửa bản in" ở trên để soạn thảo tự do (căn chỉnh, giãn dòng, danh sách...).
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedQuote(null);
                    setTempQuote(null);
                    setShowPrintPreview(false);
                  }}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-all active:scale-95 shadow-md"
                >
                  <Printer className="w-3.5 h-3.5" />
                  In Hợp Đồng
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
