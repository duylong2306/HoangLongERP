/**
 * Hoàng Long ERP — Thao tác dữ liệu một lần (yêu cầu người dùng)
 *
 * Xóa 2 dòng Công Nợ Trả (bảng accounting_liabilities) là công nợ tạm ứng
 * thầu phụ được sinh tự động khi thanh toán đề xuất DX-EXP-20260817-5463:
 *   - Lê Nguyễn Gia Ny              (7.575.000 đ)  notes = "Tạm ứng thầu phụ DX-EXP-20260817-5463"
 *   - TRẠM CHẾ BIẾN VÀ NHÀ Ở ...   (441.000 đ)    notes = "Tạm ứng thầu phụ DX-EXP-20260817-5463"
 *
 * Khớp theo notes chứa mã đề xuất (không phụ thuộc vào tên có dấu),
 * log từng dòng tìm thấy rồi xóa theo id.
 *
 * Chạy: node scripts/fix_delete_liabilities_dx5463.cjs
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://cyuunmrdrymhzxfcruoe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_koAM0ouveX_M1SBE-OfdCw_XeRWJI0h';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const RELATED_PROPOSAL = 'DX-EXP-20260817-5463';

(async () => {
  // ── Tìm các dòng Công Nợ Trả gắn với đề xuất ───────────────────────────────
  const { data: rows, error: e1 } = await supabase
    .from('accounting_liabilities')
    .select('id, name, category, value, notes, related_advance_id')
    .like('notes', `%${RELATED_PROPOSAL}%`);

  if (e1) {
    console.error('❌ Lỗi truy vấn accounting_liabilities:', e1);
    return;
  }

  console.log(`🔎 Tìm thấy ${rows.length} dòng Công Nợ Trả gắn với ${RELATED_PROPOSAL}:`);
  (rows || []).forEach(r =>
    console.log(`   • id=${r.id} | name=${r.name} | category=${r.category} | value=${r.value} | notes=${r.notes}`)
  );

  if (!rows || rows.length === 0) {
    console.log('⚠️ Không có dòng nào để xóa.');
    return;
  }

  // ── Xóa từng dòng theo id ──────────────────────────────────────────────────
  const ids = rows.map(r => r.id);
  const { error: e2 } = await supabase
    .from('accounting_liabilities')
    .delete()
    .in('id', ids);

  if (e2) {
    console.error('❌ Lỗi xóa accounting_liabilities:', e2);
    return;
  }

  console.log(`✅ Đã xóa ${ids.length} dòng Công Nợ Trả: ${ids.join(', ')}`);
})();
