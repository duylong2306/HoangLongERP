/**
 * Hoàng Long ERP — Thao tác dữ liệu một lần (yêu cầu người dùng)
 * 1) Chuyển các Đề Xuất Chi ở cột "Hoàn Thành" (status='completed') về "Chờ Lập Phiếu" (status='pending_payment')
 * 2) Xóa 2 phiếu chi PC-2026-110 và PC-2026-146 (trạng thái chờ duyệt / pending)
 *
 * Chạy: node scripts/fix_proposals_payments.cjs
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://cyuunmrdrymhzxfcruoe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_koAM0ouveX_M1SBE-OfdCw_XeRWJI0h';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async () => {
  // ── 1) Đề xuất Hoàn Thành → Chờ Lập Phiếu ──────────────────────────────
  const { data: completed, error: e1 } = await supabase
    .from('subcontractor_advances')
    .select('id, status, type')
    .eq('status', 'completed');

  if (e1) {
    console.error('❌ Lỗi truy vấn subcontractor_advances:', e1);
    return;
  }
  console.log(`🔎 Tìm thấy ${completed.length} Đề Xuất Chi ở cột "Hoàn Thành":`, completed.map(p => p.id));

  if (completed.length) {
    const ids = completed.map(p => p.id);
    const { error: u1 } = await supabase
      .from('subcontractor_advances')
      .update({ status: 'pending_payment' })
      .in('id', ids);
    if (u1) console.error('❌ Lỗi cập nhật status đề xuất:', u1);
    else console.log(`✅ Đã chuyển ${ids.length} Đề Xuất Chi → "Chờ Lập Phiếu" (pending_payment)`);
  }

  // ── 2) Xóa 2 phiếu chi PC-2026-110 & PC-2026-146 (chờ duyệt) ───────────
  const codes = ['PC-2026-110', 'PC-2026-146'];
  const { data: pays, error: e2 } = await supabase
    .from('payments')
    .select('id, code, status')
    .in('code', codes);

  if (e2) {
    console.error('❌ Lỗi truy vấn payments:', e2);
    return;
  }
  console.log('🔎 Phiếu chi tìm thấy:', pays);

  if (pays && pays.length) {
    const ids = pays.map(p => p.id);
    const { error: d1 } = await supabase
      .from('payments')
      .delete()
      .in('id', ids);
    if (d1) console.error('❌ Lỗi xóa phiếu chi:', d1);
    else console.log(`✅ Đã xóa ${ids.length} phiếu chi: ${codes.join(', ')}`);
  } else {
    console.log('⚠️ Không tìm thấy phiếu chi nào với mã PC-2026-110 / PC-2026-146.');
  }
})();
