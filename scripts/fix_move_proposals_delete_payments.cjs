/**
 * Hoàng Long ERP — Thao tác dữ liệu một lần (yêu cầu người dùng)
 * 1) Chuyển 3 Đề Xuất Chi về cột "Chờ Lập Phiếu" (status='pending_payment'):
 *      DX-EXP-20260819-8380, DX-EXP-20260819-3425, DX-EXP-20260817-5463
 * 2) Xóa 3 phiếu chi:
 *      PC-2026-267, PC-2026-427, PC-2026-525
 *
 * Chạy: node scripts/fix_move_proposals_delete_payments.cjs
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://cyuunmrdrymhzxfcruoe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_koAM0ouveX_M1SBE-OfdCw_XeRWJI0h';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async () => {
  // ── 1) Chuyển 3 Đề Xuất Chi → "Chờ Lập Phiếu" ───────────────────────────
  const proposalIds = [
    'DX-EXP-20260819-8380',
    'DX-EXP-20260819-3425',
    'DX-EXP-20260817-5463',
  ];

  const { data: foundProps, error: e1 } = await supabase
    .from('subcontractor_advances')
    .select('id, status, type')
    .in('id', proposalIds);

  if (e1) {
    console.error('❌ Lỗi truy vấn subcontractor_advances:', e1);
    return;
  }

  const foundIds = (foundProps || []).map(p => p.id);
  const missingIds = proposalIds.filter(id => !foundIds.includes(id));
  console.log(`🔎 Tìm thấy ${foundIds.length}/3 Đề Xuất Chi:`, foundIds);
  if (missingIds.length) console.warn('⚠️ Không tìm thấy:', missingIds);

  if (foundIds.length) {
    const { error: u1 } = await supabase
      .from('subcontractor_advances')
      .update({ status: 'pending_payment' })
      .in('id', foundIds);
    if (u1) console.error('❌ Lỗi cập nhật status đề xuất:', u1);
    else console.log(`✅ Đã chuyển ${foundIds.length} Đề Xuất Chi → "Chờ Lập Phiếu" (pending_payment)`);
  }

  // ── 2) Xóa 3 phiếu chi ──────────────────────────────────────────────────
  const codes = ['PC-2026-767', 'PC-2026-427', 'PC-2026-525'];
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
    console.log('⚠️ Không tìm thấy phiếu chi nào với mã PC-2026-267 / PC-2026-427 / PC-2026-525.');
  }
})();
