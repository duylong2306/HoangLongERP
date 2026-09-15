/**
 * Kiểm tra (read-only): các phiếu chi (payments) xuất phát từ đề xuất
 * "Chi Nhà Cung Cấp" (subcontractor_advances.type = 'supplier_payment_proposal')
 * đang bị gắn nhầm project_id do bug cũ ở form "Tạo Đề Xuất Chi Mới" (fallback
 * sai chọn dự án đầu tiên trong danh sách khi đề xuất Chi Nhà Cung Cấp vốn
 * không gắn dự án). Bug cũ có thể còn làm SAI CẢ category (không chỉ project_id)
 * nên không lọc theo payments.category mà lọc theo LOẠI ĐỀ XUẤT GỐC.
 *
 * Chạy: node scripts/_inspect_supplier_payment_project_mismatch.cjs
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://cyuunmrdrymhzxfcruoe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_koAM0ouveX_M1SBE-OfdCw_XeRWJI0h';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async () => {
  // 1) Toàn bộ đề xuất Chi Nhà Cung Cấp
  const { data: advs, error: eAdv } = await supabase
    .from('subcontractor_advances')
    .select('id, type, project_id, project_name, subcontractor_name, amount, approved_amount, status')
    .eq('type', 'supplier_payment_proposal');
  if (eAdv) { console.error('❌ Lỗi truy vấn subcontractor_advances:', eAdv); return; }
  console.log(`📋 Tổng số đề xuất Chi Nhà Cung Cấp: ${advs?.length || 0}`);
  const advWithProject = (advs || []).filter(a => a.project_id);
  console.log(`   trong đó có project_id (bất thường vì loại này KHÔNG có ô chọn dự án khi tạo): ${advWithProject.length}`);
  advWithProject.forEach(a => console.log(`   - ${a.id} | project_id=${a.project_id} | project_name=${a.project_name} | ${a.subcontractor_name}`));

  const advIds = (advs || []).map(a => a.id);
  const advById = new Map((advs || []).map(a => [a.id, a]));

  // 2) Payments có related_advance_id trỏ tới các đề xuất Chi Nhà Cung Cấp này
  const { data: pays, error: ePay } = await supabase
    .from('payments')
    .select('id, code, date, recipient, project_id, category, amount, notes, related_advance_id, status')
    .in('related_advance_id', advIds.length ? advIds : ['__none__'])
    .order('date', { ascending: true });
  if (ePay) { console.error('❌ Lỗi truy vấn payments:', ePay); return; }

  console.log(`\n📋 Tổng số phiếu chi lập từ các đề xuất Chi Nhà Cung Cấp: ${pays?.length || 0}`);
  const mismatched = (pays || []).filter(p => !!p.project_id);
  console.log(`   trong đó ĐANG BỊ gắn project_id (SAI, lẽ ra phải để trống): ${mismatched.length}\n`);
  mismatched.forEach(p => {
    const adv = advById.get(p.related_advance_id);
    console.log(`- ${p.code} | ${p.date} | recipient=${p.recipient} | category=${p.category} | project_id=${p.project_id} | amount=${p.amount?.toLocaleString('vi-VN')}đ | status=${p.status} | đề xuất=${p.related_advance_id}(${adv?.subcontractor_name || '?'})`);
  });

  // 3) Cũng liệt kê các phiếu category sai (không phải 'supplier_payment') để biết cần sửa cả category
  const wrongCategory = (pays || []).filter(p => p.category !== 'supplier_payment');
  console.log(`\n📋 Phiếu chi có category KHÁC 'supplier_payment' (cũng cần sửa lại category): ${wrongCategory.length}`);
  wrongCategory.forEach(p => console.log(`- ${p.code} | category hiện tại = "${p.category}"`));
})();
