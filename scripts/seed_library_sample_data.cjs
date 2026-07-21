/**
 * Hoàng Long ERP — Seed dữ liệu mẫu Thư Viện Hồ Sơ lên Supabase
 * Chạy: node scripts/seed_library_sample_data.cjs
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://cyuunmrdrymhzxfcruoe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_koAM0ouveX_M1SBE-OfdCw_XeRWJI0h';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Dữ liệu mẫu ──────────────────────────────────────────

const SAMPLE_CUSTOMERS = [
  { id: 'cust_1', name: 'Phan Văn Nam', phone: '0912111222', email: 'namphan@gmail.com', address: 'Biệt Thự B2-15 Hoa Lam, Đà Lạt, Lâm Đồng', company: 'Công ty Cổ phần Đầu tư Nam Phát' },
  { id: 'cust_2', name: 'Nguyễn Thu Trang', phone: '0987333444', email: 'trangnt@nhaphunu.com', address: 'Số 45 Trần Phú, Bảo Lộc, Lâm Đồng' },
  { id: 'cust_3', name: 'Phạm Đức Minh', phone: '0933555666', email: 'minhpd@cokhithanhcong.com', address: 'Khu công nghiệp Lộc Sơn, Bảo Lộc, Lâm Đồng', company: 'Xưởng Cơ khí Thành Công' },
];

const SAMPLE_PROJECTS = [
  { id: 'proj_lib_1', name: 'Biệt thự vườn Nam Phát - giai đoạn 1', type: 'construction', status: 'new', customer_id: 'cust_1' },
  { id: 'proj_lib_2', name: 'Nội thất penthouse chị Trang', type: 'furniture', status: 'new', customer_id: 'cust_2' },
  { id: 'proj_lib_3', name: 'Nhà kho kết cấu thép Cơ khí Thành Công', type: 'mechanical', status: 'new', customer_id: 'cust_3' },
  { id: 'proj_lib_4', name: 'Thầu phụ phần xây dựng dự án Nam Phát', type: 'general', status: 'new', customer_id: 'cust_1' },
];

const SAMPLE_ARCHIVED_QUOTES = [
  {
    id: 'arch_lib_xd_001',
    sector: 'construction',
    code: 'BG-XD-2026-001',
    customer_id: 'cust_1',
    project_id: 'proj_lib_1',
    subcontractor_id: null,
    contract_value: 4500000000,
    status: 'approved',
    scope_work: 'Thi công xây dựng trọn gói phần thô và hoàn thiện',
    items: [
      { name: 'Móng + móng cọc', qty: 1, price: 900000000 },
      { name: 'Khung BTCT', qty: 1, price: 1800000000 },
      { name: 'Hoàn thiện', qty: 1, price: 1800000000 },
    ],
    creator_id: 'emp_admin',
    created_at: '2026-06-01T08:30:00+07:00',
    updated_at: '2026-06-01T08:30:00+07:00',
  },
  {
    id: 'arch_lib_nt_002',
    sector: 'furniture',
    code: 'BG-NT-2026-002',
    customer_id: 'cust_2',
    project_id: 'proj_lib_2',
    subcontractor_id: null,
    contract_value: 1250000000,
    status: 'approved',
    scope_work: 'Thiết kế, sản xuất và lắp đặt nội thất trọn gói',
    items: [
      { name: 'Phòng khách', qty: 1, price: 450000000 },
      { name: 'Phòng ngủ master', qty: 1, price: 350000000 },
      { name: 'Bếp + pantry', qty: 1, price: 450000000 },
    ],
    creator_id: 'emp_admin',
    created_at: '2026-06-05T10:15:00+07:00',
    updated_at: '2026-06-05T10:15:00+07:00',
  },
  {
    id: 'arch_lib_ck_003',
    sector: 'mechanical',
    code: 'BG-CK-2026-003',
    customer_id: 'cust_3',
    project_id: 'proj_lib_3',
    subcontractor_id: null,
    contract_value: 850000000,
    status: 'approved',
    scope_work: 'Chế tạo và lắp đặt kết cấu vì kèo thép nhà kho',
    items: [
      { name: 'Hệ vì kèo thép', qty: 1, price: 520000000 },
      { name: 'Mái tôn + panel', qty: 1, price: 230000000 },
      { name: 'Gia công + vận chuyển', qty: 1, price: 100000000 },
    ],
    creator_id: 'emp_admin',
    created_at: '2026-06-10T14:00:00+07:00',
    updated_at: '2026-06-10T14:00:00+07:00',
  },
  {
    id: 'arch_lib_tp_004',
    sector: 'subcontractor',
    code: 'BG-TP-2026-004',
    customer_id: 'cust_1',
    project_id: 'proj_lib_4',
    subcontractor_id: 'sub_001',
    contract_value: 680000000,
    status: 'approved',
    scope_work: 'Thầu phụ phần xây dựng thô + hoàn thiện cơ bản',
    items: [
      { name: 'Thi công phần thô', qty: 1, price: 430000000 },
      { name: 'Hoàn thiện cơ bản', qty: 1, price: 250000000 },
    ],
    creator_id: 'emp_admin',
    created_at: '2026-06-12T09:00:00+07:00',
    updated_at: '2026-06-12T09:00:00+07:00',
  },
];

// ── Hàm helper: upsert không lỗi nếu row đã tồn tại ──────

async function safeUpsert(table, rows, onConflict = 'id') {
  const { data, error } = await supabase.from(table).upsert(rows, { onConflict, ignoreDuplicates: false });
  if (error) {
    // Nếu vì lý do nào đó upsert fails, thử insert từng row và bỏ qua row trùng
    console.warn(`  ⚠️  Upsert batch lỗi (${table}): ${error.message}. Thử từng row...`);
    for (const row of rows) {
      const { error: e2 } = await supabase.from(table).upsert(row, { onConflict });
      if (e2 && !e2.message.includes('duplicate') && !e2.message.includes('23505')) {
        console.error(`    ❌ Row ${row.id || JSON.stringify(row).slice(0, 60)}: ${e2.message}`);
      }
    }
  }
  return { data, error };
}

// ── Main ──────────────────────────────────────────────────

(async () => {
  console.log('🚀 Bắt đầu seed dữ liệu mẫu Thư Viện...\n');

  // 1. Khách hàng
  console.log('📋 1/3 Insert khách hàng...');
  await safeUpsert('customers', SAMPLE_CUSTOMERS);
  console.log('   ✅ OK\n');

  // 2. Dự án
  console.log('📋 2/3 Insert dự án...');
  await safeUpsert('projects', SAMPLE_PROJECTS);
  console.log('   ✅ OK\n');

  // 3. Hồ sơ báo giá lưu trữ
  console.log('📋 3/3 Insert hồ sơ báo giá lưu trữ...');
  await safeUpsert('archived_quotes', SAMPLE_ARCHIVED_QUOTES);
  console.log('   ✅ OK\n');

  // 4. Verify
  console.log('🔍 Kiểm tra dữ liệu đã upsert...');
  const { data: countData, error: countError } = await supabase
    .from('archived_quotes')
    .select('id, code, sector, status');

  if (countError) {
    console.error('❌ Lỗi verify:', countError.message);
  } else {
    console.log(`   Tổng hồ sơ trong archived_quotes: ${countData.length}`);
    countData.forEach((r) => {
      console.log(`   - [${r.sector}] ${r.code} (${r.status})`);
    });
  }

  console.log('\n🎉 Seed dữ liệu mẫu Thư Viện hoàn tất!');
})();
