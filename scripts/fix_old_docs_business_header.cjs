/**
 * Hoàng Long ERP — Thao tác dữ liệu một lần (yêu cầu người dùng)
 * Các hồ sơ Hợp Đồng/Nghiệm Thu/Thanh Lý ĐÃ ĐƯỢC TẠO TRƯỚC ĐÂY lưu sẵn 1 bản HTML
 * (contract_html/acceptance_html/liquidation_html) trong đó địa chỉ + SĐT công ty
 * bị hard-code cứng trong code cũ (ContractDocument/AcceptanceDocument/
 * LiquidationDocument.tsx) — nay code đã sửa để đọc từ business_profile, nhưng
 * các bản HTML CŨ đã lưu thì vẫn còn "đóng băng" giá trị sai, cần thay chuỗi
 * trực tiếp trong dữ liệu đã lưu.
 *
 * Chạy: node scripts/fix_old_docs_business_header.cjs
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://cyuunmrdrymhzxfcruoe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_koAM0ouveX_M1SBE-OfdCw_XeRWJI0h';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Chuỗi cũ (hard-code trong code trước khi sửa) -> chuỗi mới (đúng theo Cài Đặt Hệ Thống)
const REPLACEMENTS = [
  ['Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng', '54/20 Kim Đồng, Phường Cam Ly - Đà Lạt, tỉnh Lâm Đồng'],
  ['0966 545 959', '0966.54.59.59'],
];

const HTML_COLUMNS = ['contract_html', 'acceptance_html', 'liquidation_html'];

(async () => {
  const { data: rows, error } = await supabase
    .from('archived_quotes')
    .select('id, contract_html, acceptance_html, liquidation_html');

  if (error) {
    console.error('❌ Lỗi truy vấn archived_quotes:', error);
    return;
  }

  console.log(`🔎 Tổng số hồ sơ kiểm tra: ${rows.length}`);
  let fixedCount = 0;

  for (const row of rows) {
    const patch = {};
    for (const col of HTML_COLUMNS) {
      const original = row[col];
      if (!original) continue;
      let updated = original;
      for (const [oldStr, newStr] of REPLACEMENTS) {
        updated = updated.split(oldStr).join(newStr);
      }
      if (updated !== original) {
        patch[col] = updated;
      }
    }

    if (Object.keys(patch).length > 0) {
      const { error: updateErr } = await supabase
        .from('archived_quotes')
        .update(patch)
        .eq('id', row.id);
      if (updateErr) {
        console.error(`❌ Lỗi cập nhật hồ sơ ${row.id}:`, updateErr);
        continue;
      }
      fixedCount++;
      console.log(`✅ Đã sửa hồ sơ ${row.id}: ${Object.keys(patch).join(', ')}`);
    }
  }

  console.log(`🏁 Hoàn tất. Đã sửa ${fixedCount}/${rows.length} hồ sơ.`);
})();
