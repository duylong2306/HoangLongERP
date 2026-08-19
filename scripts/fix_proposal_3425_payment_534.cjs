/**
 * Hoàng Long ERP — Thao tác dữ liệu một lần (yêu cầu người dùng)
 * 1) Đưa Đề Xuất Chi DX-EXP-20260819-3425 về cột "Chờ Lập Phiếu" (pending_payment)
 *    và gỡ liên kết phiếu chi cũ (payment_id = null).
 * 2) Xóa phiếu chi PC-2026-534.
 *
 * Chạy: node scripts/fix_proposal_3425_payment_534.cjs
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://cyuunmrdrymhzxfcruoe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_koAM0ouveX_M1SBE-OfdCw_XeRWJI0h';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PROPOSAL_ID = 'DX-EXP-20260819-3425';
const PAYMENT_CODE = 'PC-2026-534';

(async () => {
  // ── 1) Đề xuất → Chờ Lập Phiếu ─────────────────────────────────────────
  // Lưu ý: bảng subcontractor_advances KHÔNG có cột payment_id; liên kết
  // đề xuất↔phiếu chi nằm ở payments.related_advance_id (phiếu chi trỏ ngược).
  // Do đó chỉ cần chuyển status; link sẽ được gỡ khi xóa phiếu chi ở bước 2.
  const { data: prop, error: e1 } = await supabase
    .from('subcontractor_advances')
    .select('id, status')
    .eq('id', PROPOSAL_ID)
    .maybeSingle();

  if (e1) {
    console.error('❌ Lỗi truy vấn đề xuất:', e1);
    return;
  }
  if (!prop) {
    console.log(`⚠️ Không tìm thấy đề xuất ${PROPOSAL_ID}.`);
  } else {
    console.log(`🔎 Đề xuất ${PROPOSAL_ID}: trạng thái hiện tại = "${prop.status}"`);
    const { error: u1 } = await supabase
      .from('subcontractor_advances')
      .update({ status: 'pending_payment' })
      .eq('id', PROPOSAL_ID);
    if (u1) console.error('❌ Lỗi cập nhật đề xuất:', u1);
    else console.log(`✅ Đã chuyển ${PROPOSAL_ID} → "Chờ Lập Phiếu" (pending_payment).`);
  }

  // ── 2) Xóa phiếu chi PC-2026-534 ───────────────────────────────────────
  const { data: pays, error: e2 } = await supabase
    .from('payments')
    .select('id, code, status')
    .eq('code', PAYMENT_CODE);

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
    else console.log(`✅ Đã xóa ${ids.length} phiếu chi: ${PAYMENT_CODE}`);
  } else {
    console.log(`⚠️ Không tìm thấy phiếu chi nào với mã ${PAYMENT_CODE}.`);
  }
})();
