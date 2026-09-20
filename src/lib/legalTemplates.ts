/**
 * Mẫu mặc định "Hồ sơ pháp lý dự án" cho 3 lĩnh vực (Nội thất / Xây dựng / Cơ khí).
 * Dùng các tham số {{...}} có trong docPlaceholders.ts. Người dùng sửa tự do trong
 * tab "Mẫu hồ sơ" (lưu ở quotation_configs khóa legal_<lĩnh vực>).
 */

export type LegalSector = 'furniture' | 'construction' | 'mechanical';

interface SectorWording {
  workType: string;      // Loại công việc trong câu mở đầu
  legalBasis: string[];  // Căn cứ pháp lý riêng của lĩnh vực
  documents: string[];   // Danh mục giấy tờ pháp lý cần có
}

const WORDING: Record<LegalSector, SectorWording> = {
  furniture: {
    workType: 'thiết kế, sản xuất và lắp đặt nội thất',
    legalBasis: [
      'Bộ luật Dân sự số 91/2015/QH13;',
      'Luật Thương mại số 36/2005/QH11;',
      'Hợp đồng số {{SO_HOP_DONG}} ký ngày {{NGAY_KY_HĐ}} giữa hai bên.',
    ],
    documents: [
      'Hợp đồng thi công nội thất và các phụ lục (nếu có)',
      'Bản vẽ thiết kế, phối cảnh đã được Bên A xác nhận',
      'Giấy tờ chứng minh quyền sử dụng / cho phép thi công tại địa điểm công trình',
      'Biên bản bàn giao mặt bằng',
      'Cam kết an toàn lao động, phòng cháy chữa cháy tại công trình',
      'Giấy ủy quyền của người đại diện (nếu có)',
    ],
  },
  construction: {
    workType: 'thi công xây dựng công trình',
    legalBasis: [
      'Luật Xây dựng số 50/2014/QH13 và Luật sửa đổi, bổ sung số 62/2020/QH14;',
      'Nghị định số 15/2021/NĐ-CP về quản lý dự án đầu tư xây dựng;',
      'Bộ luật Dân sự số 91/2015/QH13;',
      'Hợp đồng số {{SO_HOP_DONG}} ký ngày {{NGAY_KY_HĐ}} giữa hai bên.',
    ],
    documents: [
      'Giấy phép xây dựng (hoặc văn bản miễn giấy phép xây dựng)',
      'Giấy chứng nhận quyền sử dụng đất / quyền sở hữu nhà ở của chủ đầu tư',
      'Hồ sơ thiết kế bản vẽ thi công đã được thẩm tra / phê duyệt',
      'Hợp đồng thi công xây dựng và các phụ lục (nếu có)',
      'Biên bản bàn giao mặt bằng thi công',
      'Bảo hiểm công trình, bảo hiểm người lao động',
      'Cam kết an toàn lao động, vệ sinh môi trường, phòng cháy chữa cháy',
      'Giấy ủy quyền của người đại diện (nếu có)',
    ],
  },
  mechanical: {
    workType: 'gia công, chế tạo và lắp đặt sản phẩm cơ khí, nhôm kính',
    legalBasis: [
      'Bộ luật Dân sự số 91/2015/QH13;',
      'Luật Thương mại số 36/2005/QH11;',
      'Hợp đồng số {{SO_HOP_DONG}} ký ngày {{NGAY_KY_HĐ}} giữa hai bên.',
    ],
    documents: [
      'Hợp đồng gia công, lắp đặt cơ khí và các phụ lục (nếu có)',
      'Bản vẽ kỹ thuật, chi tiết kết cấu đã được Bên A xác nhận',
      'Chứng chỉ, chứng nhận xuất xứ / chất lượng vật tư chính (nhôm, kính, thép...)',
      'Biên bản bàn giao mặt bằng lắp đặt',
      'Cam kết an toàn lao động khi thi công trên cao, hàn cắt',
      'Giấy ủy quyền của người đại diện (nếu có)',
    ],
  },
};

const buildLegalTemplate = (sector: LegalSector): string => {
  const w = WORDING[sector];
  const basis = w.legalBasis.map(b => `<p><em>Căn cứ ${b}</em></p>`).join('\n');
  const rows = w.documents
    .map((d, i) => `  <tr><td style="text-align:center;width:40px">${i + 1}</td><td>${d}</td><td style="text-align:center;width:90px">☐ Đã có<br/>☐ Chưa có</td><td style="width:140px">&nbsp;</td></tr>`)
    .join('\n');

  return `<h3 style="text-align: center;"><strong>{{TEN_CONG_TY}}</strong></h3>
<h3 style="text-align: center;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></h3>
<p style="text-align: center;"><strong>Độc lập - Tự do - Hạnh phúc</strong></p>
<div style="text-align: center; margin-top: -10px;">• • • • • • • • • • • • • • •</div>
<p style="text-align: right; font-style: italic;">Số: {{SO_HO_SO_PHAP_LY}}</p>
<p style="text-align: right; font-style: italic;">Lâm Đồng, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}</p>
<h2 style="text-align: center; margin-top: 20px;"><strong>HỒ SƠ PHÁP LÝ DỰ ÁN</strong></h2>

${basis}

<p><strong>Công trình:</strong> {{CONG_TRINH}}</p>
<p><strong>Hạng mục:</strong> {{HANG_MUC}}</p>
<p><strong>Địa điểm:</strong> {{DIA_DIEM}}</p>

<p>Hôm nay, hai bên lập hồ sơ pháp lý phục vụ việc ${w.workType}, gồm có:</p>

<p><strong>Bên A (Chủ đầu tư): {{TEN_KHACH_HANG}}</strong></p>
<ul>
  <li>Địa chỉ: {{DIA_CHI_KHACH_HANG}}</li>
  <li>Điện thoại: {{DIEN_THOAI_KHACH_HANG}}</li>
  <li>Mã số thuế: {{MST_KHACH_HANG}}</li>
  <li>Số tài khoản: {{STK_KHACH_HANG}}</li>
  <li>Đại diện là: {{DAI_DIEN_KHACH_HANG}} - Chức vụ: {{CHUC_VU_KHACH_HANG}}</li>
</ul>

<p><strong>Bên B (Đơn vị thi công): {{TEN_CONG_TY}}</strong></p>
<ul>
  <li>Địa chỉ: {{DIA_CHI_CONG_TY}}</li>
  <li>Điện thoại: {{DIEN_THOAI_CONG_TY}}</li>
  <li>Mã số thuế: {{MST_CONG_TY}}</li>
  <li>Số tài khoản: {{STK_CONG_TY}}</li>
  <li>Đại diện là: {{DAI_DIEN_CONG_TY}} - Chức vụ: {{CHUC_VU_CONG_TY}}</li>
</ul>

<p><strong>Điều 1. Danh mục hồ sơ pháp lý của dự án:</strong></p>
<table style="width:100%; border-collapse: collapse;" border="1">
  <tr><th style="width:40px">STT</th><th>Tên giấy tờ / tài liệu</th><th style="width:90px">Tình trạng</th><th style="width:140px">Ghi chú (số, ngày cấp)</th></tr>
${rows}
</table>

<p><strong>Điều 2. Cam kết của các bên:</strong></p>
<p>Bên A cam kết các giấy tờ pháp lý liên quan đến đất đai, quyền thi công tại địa điểm công trình nêu trên là hợp pháp và chịu trách nhiệm về tính chính xác của thông tin đã cung cấp.</p>
<p>Bên B cam kết thực hiện đúng phạm vi công việc, tuân thủ quy định pháp luật về an toàn lao động, phòng cháy chữa cháy và bảo vệ môi trường trong suốt quá trình thi công.</p>
<p>Giá trị hợp đồng: <strong>{{TONG_CONG}}</strong> đồng (Bằng chữ: <em>{{TONG_CONG_CHU}}</em>).</p>

<p><strong>Điều 3. Hiệu lực:</strong></p>
<p>Hồ sơ này được lập thành 02 (hai) bản, mỗi bên giữ 01 (một) bản có giá trị pháp lý như nhau và là một phần không tách rời của hợp đồng đã ký.</p>
`;
};

export const DEFAULT_FURN_LEGAL_TEMPLATE = buildLegalTemplate('furniture');
export const DEFAULT_CONS_LEGAL_TEMPLATE = buildLegalTemplate('construction');
export const DEFAULT_MECH_LEGAL_TEMPLATE = buildLegalTemplate('mechanical');

export const getDefaultLegalTemplate = (sector: LegalSector): string =>
  sector === 'construction' ? DEFAULT_CONS_LEGAL_TEMPLATE
  : sector === 'mechanical' ? DEFAULT_MECH_LEGAL_TEMPLATE
  : DEFAULT_FURN_LEGAL_TEMPLATE;

/** Khóa lưu mẫu ở bảng quotation_configs (tách riêng, không đụng config báo giá của lĩnh vực). */
export const legalConfigKey = (sector: LegalSector): string => `legal_${sector}`;
export const legalConfigDefaultKey = (sector: LegalSector): string => `legal_${sector}_default`;
