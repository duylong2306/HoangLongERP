/* ==========================================================================
 * fix_attendance_empid.cjs — Sửa emp_id sai trong bảng attendance_records
 * --------------------------------------------------------------------------
 * BỐI CẢNH LỖI:
 *   DashboardOverview.getEmployeeId(name) trước đây ĐOÁN mã nhân viên từ TÊN
 *   (đọc localStorage 'hl_hrm_employees_v3', nếu không có thì if/else theo
 *   chuỗi con trong tên, cuối cùng trả 'NV999'). Trên máy chưa có cache,
 *   mọi người chấm công đều bị ghi emp_id sai:
 *     - 'NV999'  → mã không tồn tại trong bảng employees
 *     - 'NV002'  → mọi tên chứa 'Anh' / 'Mai' / 'Ngọc'
 *   Tab "Chấm công ngày" lọc theo nhân viên đang làm việc nên các bản ghi
 *   NV999 bị ẩn hoàn toàn (21 bản ghi trên DB → chỉ thấy 8).
 *
 * SCRIPT NÀY LÀM GÌ:
 *   1. Tải bảng employees (id, name, status).
 *   2. Tải toàn bộ attendance_records.
 *   3. Với mỗi bản ghi, đối chiếu emp_name → mã nhân viên đúng
 *      (so khớp không dấu, không phân biệt hoa thường).
 *   4. Nếu emp_id hiện tại KHÁC mã đúng → cập nhật lại.
 *
 * CÁCH CHẠY:
 *   node scripts/fix_attendance_empid.cjs          # DRY RUN (chỉ in ra, không ghi)
 *   node scripts/fix_attendance_empid.cjs --apply  # Thực thi cập nhật
 * ========================================================================== */

const fs = require('fs');
const path = require('path');

// ─── Đọc .env ───────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m) env[m[1]] = m[2];
}
const URL = env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.error('❌ Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY trong .env');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

async function rest(pathAndQuery, init = {}) {
  const res = await fetch(`${URL}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${text}`);
  return text ? JSON.parse(text) : null;
}

/** Chuẩn hoá tên: bỏ dấu tiếng Việt, gộp khoảng trắng, lowercase. */
function normName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

(async () => {
  console.log(`\n🔗 Supabase: ${URL}`);
  console.log(`🔑 Key: ${env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon'}`);
  console.log(APPLY ? '⚙️  CHẾ ĐỘ: APPLY (sẽ ghi dữ liệu)\n' : '🔍 CHẾ ĐỘ: DRY RUN (không ghi gì)\n');

  const employees = await rest('employees?select=id,name,status');
  const records = await rest('attendance_records?select=id,emp_id,emp_name,date&order=date.desc');
  console.log(`📋 employees: ${employees.length} | attendance_records: ${records.length}\n`);

  // Map tên → danh sách nhân viên (phát hiện trùng tên)
  const byName = new Map();
  for (const e of employees) {
    const k = normName(e.name);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(e);
  }
  const knownIds = new Set(employees.map(e => e.id));

  const fixes = [];
  const unresolved = [];
  const ambiguous = [];

  for (const r of records) {
    const matches = byName.get(normName(r.emp_name)) || [];
    if (matches.length === 0) {
      // Không tra được tên: chỉ báo động nếu emp_id cũng không hợp lệ
      if (!knownIds.has(r.emp_id)) unresolved.push(r);
      continue;
    }
    if (matches.length > 1) { ambiguous.push({ r, matches }); continue; }
    const correctId = matches[0].id;
    if (r.emp_id !== correctId) fixes.push({ ...r, correctId });
  }

  if (ambiguous.length) {
    console.log(`⚠️  ${ambiguous.length} bản ghi có TÊN TRÙNG NHAU giữa nhiều nhân viên — bỏ qua, cần sửa tay:`);
    for (const a of ambiguous) {
      console.log(`   ${a.r.date} "${a.r.emp_name}" → ứng viên: ${a.matches.map(m => m.id).join(', ')}`);
    }
    console.log('');
  }
  if (unresolved.length) {
    console.log(`⚠️  ${unresolved.length} bản ghi KHÔNG tra được tên và emp_id không tồn tại — cần sửa tay:`);
    for (const u of unresolved) console.log(`   ${u.date} ${u.emp_id} "${u.emp_name}" (id=${u.id})`);
    console.log('');
  }

  if (!fixes.length) {
    console.log('✅ Không có bản ghi nào cần sửa emp_id.');
    return;
  }

  console.log(`🛠️  ${fixes.length} bản ghi cần sửa emp_id:\n`);
  const byDate = {};
  for (const f of fixes) (byDate[f.date] ||= []).push(f);
  for (const d of Object.keys(byDate).sort().reverse()) {
    console.log(`   ── ${d} (${byDate[d].length}) ──`);
    for (const f of byDate[d]) {
      console.log(`      ${String(f.emp_id).padEnd(8)} → ${String(f.correctId).padEnd(8)}  ${f.emp_name}`);
    }
  }
  console.log('');

  if (!APPLY) {
    console.log('🔍 DRY RUN — chưa ghi gì. Chạy lại với --apply để cập nhật.');
    return;
  }

  let ok = 0, fail = 0;
  for (const f of fixes) {
    try {
      await rest(`attendance_records?id=eq.${encodeURIComponent(f.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ emp_id: f.correctId }),
      });
      ok++;
    } catch (e) {
      fail++;
      console.error(`   ❌ ${f.id} (${f.emp_name}): ${e.message}`);
    }
  }
  console.log(`\n✅ Cập nhật thành công: ${ok} | ❌ Thất bại: ${fail}`);
})().catch(e => { console.error('\n💥 Lỗi:', e.message); process.exit(1); });
