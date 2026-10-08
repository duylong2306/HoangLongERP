// Tạo DOANH NGHIỆP MỚI + tài khoản quản trị đầu tiên — dùng chung cho:
//   • api/platform.ts (chủ nền tảng tạo công ty ở trang quản trị lolo.io.vn/quantri);
//   • api/register-company.ts (khách tự đăng ký ở website công khai — Giai đoạn 2).
// Tách ra 1 chỗ để 2 luồng luôn tạo công ty GIỐNG HỆT nhau (không lệch quy ước emp_admin...).
// File bắt đầu bằng "_" nên Vercel không coi là endpoint. KHÔNG import từ src/ (xem api/login.ts).
import type { SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DEFAULT_ROLE_GROUPS, buildInitialProjectPermissionMatrix } from './_defaultRoleGroups.js';

export interface NewCompanyInput {
  slug: string;            // đã chuẩn hóa chữ thường
  name: string;
  adminUsername: string;   // đã chuẩn hóa chữ thường
  adminPassword: string;   // mật khẩu thô — hàm này tự băm bcrypt
  adminName?: string;      // họ tên người quản trị (mặc định "Quản trị viên")
  adminEmail?: string;
  adminPhone?: string;
  // Hạn dùng ban đầu: expiresAt=null (hoặc bỏ trống) = KHÔNG giới hạn; isTrial=true = đang dùng thử.
  // Chỉ gửi 2 cột này khi được truyền → thiếu cột (chưa chạy migration 20261011) không làm hỏng luồng cũ.
  expiresAt?: string | null;
  isTrial?: boolean;
}

// ok=true → có `company`; ok=false → có `status` + `error`. (Không dùng union phân biệt vì tsconfig của dự án
// không bật strict nên TypeScript không thu hẹp kiểu theo `ok`.)
export interface CreateCompanyResult {
  ok: boolean;
  company?: { id: string; slug: string; name: string; active: boolean };
  status?: number;
  error?: string;
}

export async function createCompanyWithAdmin(supabase: SupabaseClient, input: NewCompanyInput): Promise<CreateCompanyResult> {
  const { slug, name, adminUsername, adminPassword } = input;

  const { data: existing } = await supabase.from('companies').select('id').eq('slug', slug).maybeSingle();
  if (existing) {
    return { ok: false, status: 409, error: `Mã công ty "${slug}" đã tồn tại.` };
  }

  const companyId = randomUUID();
  const { error: companyErr } = await supabase.from('companies').insert({
    id: companyId, slug, name, active: true,
    ...(input.expiresAt !== undefined ? { expires_at: input.expiresAt } : {}),
    ...(input.isTrial !== undefined ? { is_trial: input.isTrial } : {}),
  });
  if (companyErr) {
    // 23505 = trùng slug do 2 yêu cầu cùng lúc lọt qua bước kiểm tra ở trên (slug có ràng buộc unique)
    if ((companyErr as any).code === '23505') {
      return { ok: false, status: 409, error: `Mã công ty "${slug}" đã tồn tại.` };
    }
    return { ok: false, status: 500, error: `Tạo công ty thất bại: ${companyErr.message}` };
  }

  // Tài khoản quản trị đầu tiên của công ty mới — bắt buộc phải có, nếu
  // không sẽ không ai đăng nhập được vào công ty vừa tạo.
  //
  // id CỐ ĐỊNH 'emp_admin' (không random) — đây là quy ước admin gốc mà
  // isUserInRoleGroup() (src/context/SettingsContext.tsx) đã nhận diện sẵn
  // qua fallback `empId === 'emp_admin'`, luôn full quyền bất kể công ty đó
  // đã cấu hình hrm_role_groups hay chưa. Không dùng random UUID vì công ty
  // MỚI TẠO CHƯA CÓ role_groups nào — nếu không rơi vào fallback này, tài
  // khoản quản trị đầu tiên sẽ bị chặn "Không đủ quyền" ở mọi thao tác
  // (phát hiện qua test thực tế: tạo công ty test, đăng nhập, bấm "Thêm vật
  // tư" ở Kho → bị chặn vì permissions rỗng). An toàn đổi vì employees.id
  // giờ là 1 vế của PK GHÉP (company_id, id) — mỗi công ty có "emp_admin"
  // riêng, không đụng nhau (xem migration 20260929d).
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const { error: empErr } = await supabase.from('employees').insert({
    id: 'emp_admin',
    company_id: companyId,
    name: input.adminName || 'Quản trị viên',
    ...(input.adminEmail ? { email: input.adminEmail } : {}),
    ...(input.adminPhone ? { phone: input.adminPhone } : {}),
    role: 'director',
    department: 'Ban Giám Đốc',
    username: adminUsername,
    password: passwordHash,
    role_group_ids: ['role_admin'],
    status: 'working',
    has_system_account: true,
  });
  if (empErr) {
    // Dọn lại công ty vừa tạo nếu tạo tài khoản admin thất bại — tránh để lại
    // 1 công ty "mồ côi" không ai đăng nhập được.
    await supabase.from('companies').delete().eq('id', companyId);
    return { ok: false, status: 500, error: `Tạo tài khoản quản trị thất bại: ${empErr.message}` };
  }

  // Cấp sẵn bộ NHÓM VAI TRÒ mẫu (có "Loại nhóm") + Quyền Dự Án theo nhóm — để chủ công ty không phải dựng từ đầu và
  // không bị lỗi "nhóm không có Loại nhóm nên không được tính là Giám đốc/Kế toán". Làm theo kiểu "cố gắng hết sức":
  // nếu bước này lỗi vẫn KHÔNG hủy việc tạo công ty (emp_admin vẫn full quyền nhờ quy ước ở trên), chỉ ghi log để xử lý sau.
  try {
    const { error: grpErr } = await supabase.from('hrm_role_groups').insert(DEFAULT_ROLE_GROUPS.map(g => ({
      ...g, company_id: companyId,
      member_ids: g.id === 'role_admin' ? ['emp_admin'] : [], // tài khoản quản trị đầu tiên thuộc nhóm Ban Giám Đốc
    })));
    if (grpErr) console.warn('Seed nhóm vai trò mặc định thất bại:', grpErr.message);
    const { error: ppErr } = await supabase.from('project_permissions').insert({
      id: companyId, company_id: companyId, matrix: buildInitialProjectPermissionMatrix(),
    });
    if (ppErr) console.warn('Seed Quyền Dự Án mặc định thất bại:', ppErr.message);
  } catch (e: any) {
    console.warn('Seed phân quyền mặc định lỗi:', e?.message || e);
  }

  return { ok: true, company: { id: companyId, slug, name, active: true } };
}
