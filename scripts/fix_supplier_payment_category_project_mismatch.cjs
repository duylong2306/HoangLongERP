/**
 * Hoàng Long ERP — Thao tác dữ liệu một lần (yêu cầu người dùng, 2026-08-25)
 *
 * Sửa 37 phiếu chi "Chi Nhà Cung Cấp" (lập từ đề xuất subcontractor_advances
 * .type = 'supplier_payment_proposal') bị lỗi do bug cũ ở form "Tạo Đề Xuất
 * Chi Mới" trong FinanceManagement.tsx (trước khi sửa code ngày 2026-08-25):
 *   - category  : 'subcontractor_advance' → phải là 'supplier_payment'
 *   - project_id: bị gán nhầm dự án "CHỊ MAI HƯƠNG - NGUYỄN DU (XÂY DỰNG)"
 *                 (proj_1785565943616) → phải để trống (null), vì Chi Nhà Cung
 *                 Cấp không gắn dự án cụ thể.
 *   - subcontractor_id: đang lưu nhầm ID nhà cung cấp (dạng NCC_IMP_...) vào
 *                 cột này → chuyển sang supplier_id, xóa subcontractor_id.
 *
 * Hậu quả trước khi sửa: Bảng sổ tổng hợp lãi gộp phân mục theo công trình của
 * dự án CHỊ MAI HƯƠNG - NGUYỄN DU (XÂY DỰNG) bị cộng nhầm ~5.1 tỷ đồng chi phí
 * Nhà Cung Cấp không thuộc công trình này.
 *
 * Chạy: node scripts/fix_supplier_payment_category_project_mismatch.cjs
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://cyuunmrdrymhzxfcruoe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_koAM0ouveX_M1SBE-OfdCw_XeRWJI0h';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async () => {
  // 1) Toàn bộ đề xuất Chi Nhà Cung Cấp
  const { data: advs, error: eAdv } = await supabase
    .from('subcontractor_advances')
    .select('id')
    .eq('type', 'supplier_payment_proposal');
  if (eAdv) { console.error('❌ Lỗi truy vấn subcontractor_advances:', eAdv); return; }
  const advIds = (advs || []).map(a => a.id);

  // 2) Các phiếu chi lập từ các đề xuất này, đang còn bị gắn nhầm project_id
  //    (điều kiện chốt để chỉ sửa ĐÚNG các phiếu bị lỗi, không đụng phiếu khác)
  const { data: pays, error: ePay } = await supabase
    .from('payments')
    .select('id, code, category, project_id, subcontractor_id, supplier_id, recipient, amount')
    .in('related_advance_id', advIds.length ? advIds : ['__none__'])
    .not('project_id', 'is', null);
  if (ePay) { console.error('❌ Lỗi truy vấn payments:', ePay); return; }

  console.log(`🔎 Sẽ sửa ${pays?.length || 0} phiếu chi.\n`);

  let okCount = 0;
  let failCount = 0;
  for (const p of pays || []) {
    const newSupplierId = p.supplier_id || p.subcontractor_id || null;
    const { error: uErr } = await supabase
      .from('payments')
      .update({
        category: 'supplier_payment',
        project_id: null,
        supplier_id: newSupplierId,
        subcontractor_id: null,
      })
      .eq('id', p.id);
    if (uErr) {
      failCount++;
      console.error(`❌ Lỗi sửa ${p.code}:`, uErr.message);
    } else {
      okCount++;
      console.log(`✅ ${p.code} | ${p.recipient} | ${(p.amount || 0).toLocaleString('vi-VN')}đ | category: ${p.category} → supplier_payment | project_id: ${p.project_id} → null | supplier_id: → ${newSupplierId}`);
    }
  }

  console.log(`\n📊 Kết quả: ${okCount} phiếu sửa thành công, ${failCount} phiếu lỗi.`);
})();
