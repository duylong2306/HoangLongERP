/**
 * Hoàng Long ERP — Seed Mẫu Tài Liệu (document_templates) lên Supabase
 * Chạy: node scripts/seed_document_templates.cjs
 *
 * Đọc trực tiếp template HTML từ code nguồn AcceptanceDocument.tsx
 * và cấu hình mặc định trong CabinetEstimator, ConstructionEstimator, MechanicalEstimator.
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://cyuunmrdrymhzxfcruoe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_koAM0ouveX_M1SBE-OfdCw_XeRWJI0h';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Template nội thất (furniture)
 */
const FURN_CONTRACT = `<h3 style="text-align:center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
<h3 style="text-align:center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align:center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align:center;">• • • • • • • • • • • • • • •</div>
<h2 style="text-align:center;margin-top:20px;"><strong>HỢP ĐỒNG MUA BÁN HÀNG HÓA NỘI THẤT</strong></h2>
<p style="text-align:center;">Số: {{SO_HOP_DONG}}</p>
<p style="text-align:right;">Lâm Đồng, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}</p>
<p><strong>Công trình:</strong> {{CONG_TRINH}}</p>
<p><strong>Địa điểm:</strong> {{DIA_DIEM}}</p>
<p><strong>Bên A (Bên bán):</strong> {{TEN_CONG_TY}}</p>
<ul><li>Địa chỉ: {{DIA_CHI_CONG_TY}}</li><li>Điện thoại: {{DIEN_THOAI_CONG_TY}}</li><li>Mã số thuế: {{MST_CONG_TY}}</li></ul>
<p><strong>Bên B (Bên mua):</strong> {{TEN_KHACH_HANG}}</p>
<ul><li>Địa chỉ: {{DIA_CHI_KHACH_HANG}}</li><li>Điện thoại: {{DIEN_THOAI_KHACH_HANG}}</li><li>Mã số thuế: {{MST_KHACH_HANG}}</li></ul>
<p><strong>Nội dung:</strong> Bên A同意cung cấp cho Bên B các sản phẩm nội thất sau:</p>
<p>{{BANG_CHI_TIET}}</p>
<p><strong>Giá trị hợp đồng:</strong> {{TONG_CONG}} VND</p>
<p><strong>Điều khoản thanh toán:</strong> {{THOIDIEM_THANHTOAN}}</p>
<p><strong>Bảo hành:</strong> {{DK_BAOHANH}}</p>
<p>Hợp đồng này có hiệu lực từ ngày ký, được lập thành 03 bản có giá trị pháp lý như nhau.</p>`;

const FURN_ACCEPTANCE = `<h3 style="text-align:center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
<h3 style="text-align:center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align:center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align:center;">• • • • • • • • • • • • • • •</div>
<p style="text-align:right;">Số: {{SO_NGHIEM_THU}}</p>
<p style="text-align:right;">Lâm Đồng, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}</p>
<h2 style="text-align:center;margin-top:20px;"><strong>BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO</strong></h2>
<p><em>Căn cứ vào Hợp đồng số: {{SO_HOP_DONG}}, ký ngày {{NGAY_KY_HĐ}} giữa {{TEN_CONG_TY}} và {{TEN_KHACH_HANG}}.</em></p>
<p><strong>Công trình:</strong> {{CONG_TRINH}}</p>
<p><strong>Hạng mục:</strong> {{HANG_MUC}}</p>
<p><strong>Địa điểm:</strong> {{DIA_DIEM}}</p>
<p>Hôm nay chúng tôi gồm có:</p>
<p><strong>Bên A:</strong> {{TEN_CONG_TY}}</p>
<ul><li>Địa chỉ: {{DIA_CHI_CONG_TY}}</li><li>Điện thoại: {{DIEN_THOAI_CONG_TY}}</li><li>Mã số thuế: {{MST_CONG_TY}}</li><li>Đại diện: {{DAI_DIEN_CONG_TY}} - {{CHUC_VU_CONG_TY}}</li></ul>
<p><strong>Bên B:</strong> {{TEN_KHACH_HANG}}</p>
<ul><li>Địa chỉ: {{DIA_CHI_KHACH_HANG}}</li><li>Điện thoại: {{DIEN_THOAI_KHACH_HANG}}</li><li>Mã số thuế: {{MST_KHACH_HANG}}</li></ul>
<p><strong>Điều 1: Hạng mục bàn giao</strong></p>
<p>{{BANG_CHI_TIET}}</p>
<p>Tổng cộng: <strong>{{TONG_CONG}}</strong> VND</p>
<p><strong>Điều 2: Nghiệm thu</strong></p>
<p>Tất cả các hạng mục đạt chất lượng theo hồ sơ thiết kế được duyệt.</p>
<p><strong>Kết luận:</strong> Đồng ý nghiệm thu bàn giao và đưa vào sử dụng.</p>
<p>Biên bản lập thành 03 bản có giá trị pháp lý như nhau.</p>`;

const FURN_LIQUIDATION = `<h3 style="text-align:center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
<h3 style="text-align:center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align:center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align:center;">• • • • • • • • • • • • • • •</div>
<p style="text-align:right;">Số: {{SO_THANHLY}}/BBNT</p>
<p style="text-align:right;">Lâm Đồng, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}</p>
<h2 style="text-align:center;"><strong>BẢN THANH LÝ HỢP ĐỒNG</strong></h2>
<p><em>Căn cứ vào Hợp đồng số {{SO_HOP_DONG}}, ký ngày {{NGAY_KY_HĐ}} giữa {{TEN_CONG_TY}} và {{TEN_KHACH_HANG}}.</em></p>
<p><strong>Công trình:</strong> {{CONG_TRINH}}</p>
<p><strong>Địa điểm:</strong> {{DIA_DIEM}}</p>
<p><strong>Điều 1: Lý do thanh lý</strong></p>
<p><strong>Điều 2: Trạng thái thực hiện</strong></p>
<p><strong>Điều 3: Quyết toán tài chính</strong></p>
<p><strong>Điều 4: Hiệu lực</strong></p>
<p>Sau khi thanh lý hoàn tất, hợp đồng kết thúc hiệu lực. Hai bên cam kết không khiếu nại thêm.</p>
<p>Biên bản được lập thành 03 bản có giá trị pháp lý như nhau.</p>`;

/**
 * Template xây dựng (construction)
 */
const CONS_CONTRACT = `<h3 style="text-align:center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
<h3 style="text-align:center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align:center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align:center;">• • • • • • • • • • • • • • •</div>
<h2 style="text-align:center;margin-top:20px;"><strong>HỢP ĐỒNG THI CÔNG XÂY DỰNG</strong></h2>
<p style="text-align:center;">Số: {{SO_HOP_DONG}}</p>
<p style="text-align:right;">Lâm Đồng, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}</p>
<p><strong>Công trình:</strong> {{CONG_TRINH}}</p>
<p><strong>Địa điểm:</strong> {{DIA_DIEM}}</p>
<p><strong>Bên A (Chủ đầu tư):</strong> {{TEN_KHACH_HANG}}</p>
<ul><li>Địa chỉ: {{DIA_CHI_KHACH_HANG}}</li><li>Điện thoại: {{DIEN_THOAI_KHACH_HANG}}</li><li>Mã số thuế: {{MST_KHACH_HANG}}</li></ul>
<p><strong>Bên B (Nhà thầu):</strong> {{TEN_CONG_TY}}</p>
<ul><li>Địa chỉ: {{DIA_CHI_CONG_TY}}</li><li>Điện thoại: {{DIEN_THOAI_CONG_TY}}</li><li>Mã số thuế: {{MST_CONG_TY}}</li><li>Đại diện: {{DAI_DIEN_CONG_TY}} - {{CHUC_VU_CONG_TY}}</li></ul>
<p><strong>Giá trị hợp đồng:</strong> {{TONG_CONG}} VND</p>
<p><strong>Thời gian thi công:</strong> {{THOI_GIAN_THI_CONG}}</p>
<p><strong>Điều khoản thanh toán:</strong> {{THOIDIEM_THANHTOAN}}</p>
<p><strong>Bảo hành:</strong> {{DK_BAOHANH}}</p>
<p>Hợp đồng được lập thành 03 bản có giá trị pháp lý như nhau.</p>`;

const CONS_ACCEPTANCE = `<h3 style="text-align:center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
<h3 style="text-align:center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align:center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align:center;">• • • • • • • • • • • • • • •</div>
<p style="text-align:right;">Số: {{SO_NGHIEM_THU}}/BBNT-XD</p>
<p style="text-align:right;">Lâm Đồng, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}</p>
<h2 style="text-align:center;margin-top:20px;"><strong>BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO CÔNG TRÌNH XÂY DỰNG</strong></h2>
<p><em>Căn cứ vào Hợp đồng số: {{SO_HOP_DONG}}, ký ngày {{NGAY_KY_HĐ}} giữa {{TEN_CONG_TY}} và {{TEN_KHACH_HANG}}.</em></p>
<p><strong>Công trình:</strong> {{CONG_TRINH}}</p>
<p><strong>Địa điểm:</strong> {{DIA_DIEM}}</p>
<p><strong>Bên A:</strong> {{TEN_KHACH_HANG}}</p>
<ul><li>Địa chỉ: {{DIA_CHI_KHACH_HANG}}</li><li>Điện thoại: {{DIEN_THOAI_KHACH_HANG}}</li><li>Mã số thuế: {{MST_KHACH_HANG}}</li></ul>
<p><strong>Bên B:</strong> {{TEN_CONG_TY}}</p>
<ul><li>Địa chỉ: {{DIA_CHI_CONG_TY}}</li><li>Điện thoại: {{DIEN_THOAI_CONG_TY}}</li><li>Mã số thuế: {{MST_CONG_TY}}</li><li>Đại diện: {{DAI_DIEN_CONG_TY}} - {{CHUC_VU_CONG_TY}}</li></ul>
<p><strong>Điều 1: Hạng mục bàn giao</strong></p>
<p>{{BANG_CHI_TIET}}</p>
<p>Tổng cộng: <strong>{{TONG_CONG}}</strong> VND</p>
<p><strong>Điều 2: Nghiệm thu</strong></p>
<p>Tất cả các hạng mục đạt chuẩn chất lượng theo hồ sơ thiết kế được duyệt.</p>
<p><strong>Kết luận:</strong> Đồng ý nghiệm thu bàn giao và đưa công trình vào sử dụng.</p>
<p>Biên bản lập thành 03 bản có giá trị pháp lý như nhau.</p>`;

const CONS_LIQUIDATION = `<h3 style="text-align:center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
<h3 style="text-align:center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align:center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align:center;">• • • • • • • • • • • • • • •</div>
<p style="text-align:right;">Số: {{SO_THANHLY}}/BBNT-XD</p>
<p style="text-align:right;">Lâm Đồng, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}</p>
<h2 style="text-align:center;"><strong>BẢN THANH LÝ HỢP ĐỒNG XÂY DỰNG</strong></h2>
<p><em>Căn cứ vào Hợp đồng số {{SO_HOP_DONG}}, ký ngày {{NGAY_KY_HĐ}} giữa {{TEN_CONG_TY}} và {{TEN_KHACH_HANG}}.</em></p>
<p><strong>Công trình:</strong> {{CONG_TRINH}}</p>
<p><strong>Địa điểm:</strong> {{DIA_DIEM}}</p>
<p><strong>Điều 1: Lý do thanh lý</strong></p>
<p><strong>Điều 2: Trạng thái thực hiện thi công</strong></p>
<p><strong>Điều 3: Kiểm toán tài chính</strong></p>
<p><strong>Điều 4: Quyết toán cuối cùng</strong></p>
<p><strong>Điều 5: Hiệu lực</strong></p>
<p>Sau khi thanh lý hoàn tất, hợp đồng kết thúc hiệu lực. Hai bên cam kết không tranh chấp thêm.</p>
<p>Biên bản được lập thành 03 bản có giá trị pháp lý như nhau.</p>`;

/**
 * Template cơ khí (mechanical)
 */
const MECH_CONTRACT = `<h3 style="text-align:center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
<h3 style="text-align:center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align:center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align:center;">• • • • • • • • • • • • • • •</div>
<h2 style="text-align:center;margin-top:20px;"><strong>HỢP ĐỒNG GIA CÔNG CƠ KHÍ</strong></h2>
<p style="text-align:center;">Số: {{SO_HOP_DONG}}</p>
<p style="text-align:right;">Lâm Đồng, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}</p>
<p><strong>Công trình:</strong> {{CONG_TRINH}}</p>
<p><strong>Bên A (Bên mua):</strong> {{TEN_KHACH_HANG}}</p>
<ul><li>Địa chỉ: {{DIA_CHI_KHACH_HANG}}</li><li>Điện thoại: {{DIEN_THOAI_KHACH_HANG}}</li><li>Mã số thuế: {{MST_KHACH_HANG}}</li></ul>
<p><strong>Bên B (Bên bán):</strong> {{TEN_CONG_TY}}</p>
<ul><li>Địa chỉ: {{DIA_CHI_CONG_TY}}</li><li>Điện thoại: {{DIEN_THOAI_CONG_TY}}</li><li>Mã số thuế: {{MST_CONG_TY}}</li><li>Đại diện: {{DAI_DIEN_CONG_TY}} - {{CHUC_VU_CONG_TY}}</li></ul>
<p><strong>Giá trị hợp đồng:</strong> {{TONG_CONG}} VND</p>
<p><strong>Điều khoản thanh toán:</strong> {{THOIDIEM_THANHTOAN}}</p>
<p><strong>Bảo hành:</strong> {{DK_BAOHANH}}</p>
<p>Hợp đồng được lập thành 03 bản có giá trị pháp lý như nhau.</p>`;

const MECH_ACCEPTANCE = `<h3 style="text-align:center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align:center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align:center;">• • • • • • • • • • • • • • •</div>
<h2 style="text-align:center;margin-top:20px;font-family:'Times New Roman',serif;letter-spacing:1px;"><strong>BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO SẢN PHẨM CƠ KHÍ</strong></h2>
<p style="text-align:center;font-style:italic;">Số: {{SO_NGHIEM_THU}}</p>
<p><strong>Công trình:</strong> {{CONG_TRINH}}</p>
<p><strong>Hạng mục:</strong> {{HANG_MUC}}</p>
<p><strong>Địa điểm:</strong> {{DIA_DIEM}}</p>
<p>Căn cứ vào Hợp đồng số {{SO_HOP_DONG}} giữa hai bên.</p>
<p>Hôm nay, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}, chúng tôi gồm có:</p>
<p><strong>Bên A (Bên mua): {{TEN_KHACH_HANG}}</strong></p>
<p><strong>Bên B (Bên bán): {{TEN_CONG_TY}}</strong></p>
<p><strong>Điều 1: Đo đạc thực tế và chất lượng gia công</strong><br />
- Sản phẩm được gia công chính xác theo bản vẽ kỹ thuật, mối hàn ngấu chịu lực tốt, sơn mạ kẽm phủ bóng bảo vệ bề mặt láng mịn.</p>
<p>{{BANG_CHI_TIET}}</p>
<p><strong>Điều 2: Tiến độ thi công và lắp dựng</strong><br />
- Bên B đã hoàn thiện lắp dựng toàn bộ các cấu kiện cơ khí đúng tiến độ, bảo đảm an toàn lao động.</p>
<p><strong>Điều 3: Kết luận chung</strong><br />
- Đồng ý ký nghiệm thu hoàn thành bàn giao toàn bộ sản phẩm cơ khí cho Bên A đưa vào sử dụng.</p>`;

const MECH_LIQUIDATION = `<h3 style="text-align:center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
<h3 style="text-align:center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align:center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align:center;">• • • • • • • • • • • • • • •</div>
<p style="text-align:right;">Số: {{SO_THANHLY}}/BBNT-CK</p>
<p style="text-align:right;">Lâm Đồng, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}</p>
<h2 style="text-align:center;"><strong>BẢN THANH LÝ HỢP ĐỒNG CƠ KHÍ</strong></h2>
<p><em>Căn cứ vào Hợp đồng số {{SO_HOP_DONG}}, ký ngày {{NGAY_KY_HĐ}} giữa {{TEN_CONG_TY}} và {{TEN_KHACH_HANG}}.</em></p>
<p><strong>Công trình:</strong> {{CONG_TRINH}}</p>
<p><strong>Điều 1: Lý do thanh lý</strong></p>
<p><strong>Điều 2: Trạng thái thực hiện</strong></p>
<p><strong>Điều 3: Kiểm tra vật tư</strong></p>
<p><strong>Điều 4: Quyết toán tài chính</strong></p>
<p><strong>Điều 5: Kết thúc</strong></p>
<p>Sau khi thanh lý hoàn tất, hợp đồng kết thúc hiệu lực. Hai bên cam kết không tranh chấp thêm.</p>
<p>Biên bản được lập thành 03 bản có giá trị pháp lý như nhau.</p>`;

/**
 * Template thầu phụ (subcontractor)
 */
const SUB_CONTRACT = `<h3 style="text-align:center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
<h3 style="text-align:center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align:center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align:center;">• • • • • • • • • • • • • • •</div>
<h2 style="text-align:center;margin-top:20px;"><strong>HỢP ĐỒNG THẦU PHỤ</strong></h2>
<p style="text-align:center;">Số: {{SO_HOP_DONG}}</p>
<p style="text-align:right;">Lâm Đồng, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}</p>
<p><strong>Dự án:</strong> {{CONG_TRINH}}</p>
<p><strong>Bên A (Nhà thầu chính):</strong> {{TEN_CONG_TY}}</p>
<ul><li>Địa chỉ: {{DIA_CHI_CONG_TY}}</li><li>Điện thoại: {{DIEN_THOAI_CONG_TY}}</li><li>Mã số thuế: {{MST_CONG_TY}}</li><li>Đại diện: {{DAI_DIEN_CONG_TY}} - {{CHUC_VU_CONG_TY}}</li></ul>
<p><strong>Bên B (Thầu phụ):</strong> {{TEN_KHACH_HANG}}</p>
<ul><li>Địa chỉ: {{DIA_CHI_KHACH_HANG}}</li><li>Điện thoại: {{DIEN_THOAI_KHACH_HANG}}</li><li>Mã số thuế: {{MST_KHACH_HANG}}</li></ul>
<p><strong>Giá trị hợp đồng:</strong> {{TONG_CONG}} VND</p>
<p><strong>Điều khoản thanh toán:</strong> {{THOIDIEM_THANHTOAN}}</p>
<p><strong>Bảo hành:</strong> {{DK_BAOHANH}}</p>
<p>Hợp đồng được lập thành 03 bản có giá trị pháp lý như nhau.</p>`;

const SUB_ACCEPTANCE = `<h3 style="text-align:center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
<h3 style="text-align:center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align:center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align:center;">• • • • • • • • • • • • • • •</div>
<p style="text-align:right;">Số: {{SO_NGHIEM_THU}}/BBNT-TP</p>
<p style="text-align:right;">Lâm Đồng, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}</p>
<h2 style="text-align:center;"><strong>BIÊN BẢN NGHIỆM THU THẦU PHỤ</strong></h2>
<p><em>Căn cứ vào Hợp đồng thầu phụ số {{SO_HOP_DONG}}, ký ngày {{NGAY_KY_HĐ}} giữa {{TEN_CONG_TY}} và {{TEN_KHACH_HANG}}.</em></p>
<p><strong>Dự án:</strong> {{CONG_TRINH}}</p>
<p><strong>Hạng mục:</strong> {{HANG_MUC}}</p>
<p><strong>Địa điểm:</strong> {{DIA_DIEM}}</p>
<p><strong>Bên A:</strong> {{TEN_CONG_TY}}</p>
<ul><li>Địa chỉ: {{DIA_CHI_CONG_TY}}</li><li>Điện thoại: {{DIEN_THOAI_CONG_TY}}</li><li>Mã số thuế: {{MST_CONG_TY}}</li><li>Đại diện: {{DAI_DIEN_CONG_TY}} - {{CHUC_VU_CONG_TY}}</li></ul>
<p><strong>Bên B:</strong> {{TEN_KHACH_HANG}}</p>
<ul><li>Địa chỉ: {{DIA_CHI_KHACH_HANG}}</li><li>Điện thoại: {{DIEN_THOAI_KHACH_HANG}}</li><li>Mã số thuế: {{MST_KHACH_HANG}}</li></ul>
<p><strong>Điều 1: Hạng mục bàn giao</strong></p>
<p>{{BANG_CHI_TIET}}</p>
<p>Tổng cộng: <strong>{{TONG_CONG}}</strong> VND</p>
<p><strong>Điều 2: Nghiệm thu</strong></p>
<p>Hoàn thành các hạng mục đúng tiến độ và chất lượng yêu cầu.</p>
<p><strong>Kết luận:</strong> Đồng ý nghiệm thu bàn giao.</p>
<p>Biên bản lập thành 03 bản có giá trị pháp lý như nhau.</p>`;

const SUB_LIQUIDATION = `<h3 style="text-align:center;"><strong>CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</strong></h3>
<h3 style="text-align:center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align:center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align:center;">• • • • • • • • • • • • • • •</div>
<p style="text-align:right;">Số: {{SO_THANHLY}}/BBNT-TP</p>
<p style="text-align:right;">Lâm Đồng, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}</p>
<h2 style="text-align:center;"><strong>BẢN THANH LÝ HỢP ĐỒNG THẦU PHỤ</strong></h2>
<p><em>Căn cứ vào Hợp đồng thầu phụ số {{SO_HOP_DONG}}, ký ngày {{NGAY_KY_HĐ}} giữa {{TEN_CONG_TY}} và {{TEN_KHACH_HANG}}.</em></p>
<p><strong>Dự án:</strong> {{CONG_TRINH}}</p>
<p><strong>Điều 1: Lý do thanh lý</strong></p>
<p><strong>Điều 2: Trạng thái thực hiện</strong></p>
<p><strong>Điều 3: Quyết toán tài chính</strong></p>
<p><strong>Điều 4: Kết thúc</strong></p>
<p>Sau khi thanh lý hoàn tất, hợp đồng kết thúc hiệu lực. Hai bên cam kết không tranh chấp thêm.</p>
<p>Biên bản được lập thành 03 bản có giá trị pháp lý như nhau.</p>`;

// // ── Main ──────────────────────────────────────────────────

(async () => {
  console.log('🚀 Bắt đầu seed Mẫu Tài Liệu lên Supabase...\n');

  const payload = {
    id: 'global',
    // Nội thất
    contract_template:                FURN_CONTRACT,
    acceptance_template:              FURN_ACCEPTANCE,
    liquidation_template:             FURN_LIQUIDATION,
    final_quote_template:             FURN_CONTRACT,
    // Xây dựng
    construction_contract_template:    CONS_CONTRACT,
    construction_acceptance_template:  CONS_ACCEPTANCE,
    construction_liquidation_template: CONS_LIQUIDATION,
    // Cơ khí
    mechanical_contract_template:      MECH_CONTRACT,
    mechanical_acceptance_template:    MECH_ACCEPTANCE,
    mechanical_liquidation_template:   MECH_LIQUIDATION,
    // Thầu phụ
    subcontractor_contract_template:    SUB_CONTRACT,
    subcontractor_acceptance_template:  SUB_ACCEPTANCE,
    subcontractor_liquidation_template: SUB_LIQUIDATION,
  };

  console.log('📋 1/1 Upsert document_templates...');
  const { error } = await supabase
    .from('document_templates')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
  console.log('   ✅ Đã upsert 12 mẫu tài liệu\n');

  // Verify
  console.log('🔍 Kiểm tra lại...');
  const { data, error: qErr } = await supabase
    .from('document_templates')
    .select('*')
    .eq('id', 'global')
    .single();

  if (qErr) {
    console.error('❌ Verify lỗi:', qErr.message);
    process.exit(1);
  }

  const fields = [
    'contract_template', 'acceptance_template', 'liquidation_template',
    'final_quote_template',
    'construction_contract_template', 'construction_acceptance_template', 'construction_liquidation_template',
    'mechanical_contract_template', 'mechanical_acceptance_template', 'mechanical_liquidation_template',
    'subcontractor_contract_template', 'subcontractor_acceptance_template', 'subcontractor_liquidation_template',
  ];

  fields.forEach(f => {
    const val = data[f];
    const len = val ? val.length : 0;
    const icon = len > 0 ? '✅' : '❌';
    const name = f.replace('_template', '').replace(/_/g, ' ');
    console.log(`   ${icon} ${name}: ${len} ký tự`);
  });

  console.log('\n🎉 Seed Mẫu Tài Liệu hoàn tất!');
})();
