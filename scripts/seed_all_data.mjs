#!/usr/bin/env node
// =============================================================================
// seed_all_data.mjs — Seed toàn bộ dữ liệu mẫu (INITIAL_*) lên Supabase
// Usage:  node scripts/seed_all_data.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── Đọc .env ──────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(root, '.env');
  const raw = readFileSync(envPath, 'utf-8');
  const vars = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong .env');
  process.exit(1);
}

console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Helper ────────────────────────────────────────────────────────────────
async function seedTable(tableName, rows) {
  if (!rows || rows.length === 0) {
    console.log(`  ⏭  ${tableName}: 0 rows — bỏ qua`);
    return { ok: 0, fail: 0 };
  }
  const { error } = await sb.from(tableName).upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error(`  ❌ ${tableName}: ${error.message}`);
    return { ok: 0, fail: rows.length };
  }
  console.log(`  ✅ ${tableName}: ${rows.length} rows`);
  return { ok: rows.length, fail: 0 };
}

// ── Dữ liệu mẫu ──────────────────────────────────────────────────────────

const EMPLOYEES = [
  { id: 'emp_admin', name: 'Administrator', role: 'director', email: 'admin@hoanglong.vn', phone: '0000000000', department: 'Ban Giám Đốc', username: 'admin', password: '$2a$10$placeholder' }
];

const CUSTOMERS = [
  { id: 'cust_1', name: 'Phan Văn Nam', phone: '0912111222', email: 'namphan@gmail.com', address: 'Biệt Thự B2-15 Hoa Lam, Đà Lạt, Lâm Đồng', company: 'Công ty Cổ phần Đầu tư Nam Phát' },
  { id: 'cust_2', name: 'Nguyễn Thu Trang', phone: '0987333444', email: 'trangnt@nhaphunu.com', address: 'Số 45 Trần Phú, Bảo Lộc, Lâm Đồng' },
  { id: 'cust_3', name: 'Phạm Đức Minh', phone: '0933555666', email: 'minhpd@cokhithanhcong.com', address: 'Khu công nghiệp Lộc Sơn, Bảo Lộc, Lâm Đồng', company: 'Xưởng Cơ khí Thành Công' }
];

// projects: dùng schema thật — contract_value, type (không phải value/sector)
const PROJECTS = [
  { id: 'proj_lib_1', name: 'Biệt thự vườn Nam Phát - giai đoạn 1', status: 'in_progress', code: 'CT-2026-001', customer_id: 'cust_1', type: 'construction', start_date: '2026-01-15', end_date: '2026-12-31', contract_value: 4500000000, notes: 'Xây dựng biệt thự vườn trọn gói' },
  { id: 'proj_lib_2', name: 'Nội thất penthouse chị Trang', status: 'in_progress', code: 'CB-2026-002', customer_id: 'cust_2', type: 'cabinet', start_date: '2026-03-01', end_date: '2026-09-30', contract_value: 1250000000, notes: 'Thiết kế + sản xuất + lắp đặt nội thất' },
  { id: 'proj_lib_3', name: 'Nhà kho kết cấu thép Cơ khí Thành Công', status: 'in_progress', code: 'MC-2026-003', customer_id: 'cust_3', type: 'mechanical', start_date: '2026-05-10', end_date: '2026-11-30', contract_value: 850000000, notes: 'Chế tạo + dựng ráp kết cấu thép' },
  { id: 'proj_lib_4', name: 'Thầu phụ phần xây dựng dự án Nam Phát', status: 'in_progress', code: 'SC-2026-004', customer_id: 'cust_1', type: 'subcontractor', start_date: '2026-01-20', end_date: '2026-08-30', contract_value: 1800000000, notes: 'Thầu phụ xây dựng phần thô + hoàn thiện' }
];

const TASKS = [
  { id: 'task_1', name: 'Khảo sát hiện trạng biệt thự Nam Phát', project_id: 'proj_lib_1', assignee_id: 'emp_admin', status: 'completed', priority: 'high', column_id: 'col_done', department: 'Kiến trúc', deadline: '2026-01-20' },
  { id: 'task_2', name: 'Hoàn thiện bản vẽ nội thất penthouse Trang', project_id: 'proj_lib_2', assignee_id: 'emp_admin', status: 'doing', priority: 'high', column_id: 'col_doing', department: 'Thiết kế', deadline: '2026-04-15' },
  { id: 'task_3', name: 'Gia công kết cấu thép nhà kho Thành Công', project_id: 'proj_lib_3', assignee_id: 'emp_admin', status: 'todo', priority: 'medium', column_id: 'col_todo', department: 'Cơ khí', deadline: '2026-06-30' }
];

const RECEIPTS = [
  { id: 'rec_1', code: 'PT-2026-001', date: '2026-01-20', customer_id: 'cust_1', project_id: 'proj_lib_1', amount: 1350000000, payment_method: 'transfer', notes: 'Tạm ứng đợt 1 ngay sau khi ký hợp đồng thi công biệt thự vườn (30% giá trị hợp đồng).', collector: 'Lê Thị Mai', attachment_name: 'ủy_nhiệm_chi_PT-001.pdf' },
  { id: 'rec_2', code: 'PT-2026-002', date: '2026-04-10', customer_id: 'cust_1', project_id: 'proj_lib_1', amount: 1000000000, payment_method: 'transfer', notes: 'Tạm ứng đợt 2 sau khi xong móng và đổ cột tầng trệt biệt thự.', collector: 'Lê Thị Mai', attachment_name: 'báo_có_vcb_PT-002.png' },
  { id: 'rec_3', code: 'PT-2026-003', date: '2026-03-05', customer_id: 'cust_2', project_id: 'proj_lib_2', amount: 500000000, payment_method: 'transfer', notes: 'Tạm ứng đợt 1 sản xuất nội thất penhouse chị Trang (40%).', collector: 'Lê Thị Mai', attachment_name: 'unc_chig_trang_PT-003.pdf' }
];

const PAYMENTS = [
  { id: 'pay_1', code: 'PC-2026-001', date: '2026-02-15', recipient: 'Đại lý Thép Miền Trung', project_id: 'proj_lib_1', category: 'material', amount: 320000000, payment_method: 'transfer', notes: 'Thanh toán tiền thép đợt 1 móng biệt thự Nam Phát.', proposer: 'Nguyễn Văn Hải', approver: 'Trương Hữu Long', status: 'approved', attachment_name: 'hoa_don_vat_thep.pdf' },
  { id: 'pay_2', code: 'PC-2026-002', date: '2026-04-20', recipient: 'Công ty Cổ Phần Gỗ An Cường', project_id: 'proj_lib_2', category: 'material', amount: 180000000, payment_method: 'transfer', notes: 'Mua ván MDF Acrylic và MDF Melamine chuẩn bị gia công nội thất hộ Trang.', proposer: 'Phạm Thanh Thảo', approver: 'Trương Hữu Long', status: 'approved', attachment_name: 'phieu_xuat_kho_an_cuong.pdf' },
  { id: 'pay_3', code: 'PC-2026-003', date: '2026-05-18', recipient: 'Tổ thợ xây thầu phụ - Anh Năm', project_id: 'proj_lib_1', category: 'labor', amount: 120000000, payment_method: 'cash', notes: 'Ứng lương đợt thi công đổ dầm sàn bê tông thô cho thầu phụ xây dựng.', proposer: 'Nguyễn Văn Hải', approver: 'Trương Hữu Long', status: 'approved', attachment_name: 'giay_ky_nhan_tien_mat.pdf' },
  { id: 'pay_4', code: 'PC-2026-004', date: '2026-06-05', recipient: 'Đại lý gạch ốp lát Hoàng Gia', project_id: 'proj_lib_1', category: 'material', amount: 65000000, payment_method: 'transfer', notes: 'Đề xuất tạm ứng mua gạch ốp lát Prime 80x80 cho biệt thự vườn.', proposer: 'Nguyễn Văn Hải', approver: 'Trương Hữu Long', status: 'pending', attachment_name: 'phieu_bao_gia_kem_don_hang.pdf' }
];

const QUOTES = []; // rỗng trong dữ liệu mẫu

// ── Chạy seed ────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 Bắt đầu seed dữ liệu mẫu lên Supabase...\n');

  const tables = [
    ['employees', EMPLOYEES],
    ['customers', CUSTOMERS],
    ['projects',  PROJECTS],
    ['tasks',     TASKS],
    ['receipts',  RECEIPTS],
    ['payments',  PAYMENTS],
    ['quotes',    QUOTES],
  ];

  let totalOk = 0;
  let totalFail = 0;

  for (const [name, rows] of tables) {
    const res = await seedTable(name, rows);
    totalOk += res.ok;
    totalFail += res.fail;
  }

  console.log(`\n📊 Tổng kết: ${totalOk} rows thành công, ${totalFail} rows thất bại`);
  if (totalFail === 0) {
    console.log('🎉 Seed hoàn tất — hãy reload ứng dụng để thấy dữ liệu mới!\n');
  } else {
    console.log('⚠️  Có lỗi — kiểm tra output phía trên.\n');
  }
}

main().catch(err => {
  console.error('❌ Lỗi không mong đợi:', err);
  process.exit(1);
});
