// LÕI KIỂM TRA TRƯỚC KHI DEPLOY (thuần, không gọi mạng/Vercel) — dùng bởi scripts/deploy.mjs, có test: src/lib/__tests__/deployCore.test.ts.
//
// Hai môi trường, hai project Vercel + hai project Supabase RIÊNG:
//   • prod : môi trường THẬT, nhân viên đang dùng (project Vercel "hoanglong-erp-staging", tên cũ giữ nguyên) — chỉ deploy từ nhánh
//            multi-tenant, không có sửa đổi chưa commit, phải gõ xác nhận;
//   • dev  : môi trường THỬ NGHIỆM của lập trình viên (project Vercel riêng, Supabase riêng, dữ liệu giả) — deploy được từ mọi nhánh,
//            kể cả khi còn sửa dở, KHÔNG cần xác nhận.
// Cách chọn project: đặt VERCEL_ORG_ID + VERCEL_PROJECT_ID khi gọi `vercel` (không cần liên kết lại thư mục) lấy từ .vercel/envs.json.

export const ENVS = {
  prod: { branch: 'multi-tenant', needClean: true, needConfirm: true, label: 'MÔI TRƯỜNG THẬT (nhân viên đang dùng)' },
  dev: { branch: null, needClean: false, needConfirm: false, label: 'môi trường thử nghiệm (dữ liệu giả)' },
};
export const PROD_PROJECT_NAME = 'hoanglong-erp-staging';   // tên project Vercel của môi trường thật (tên cũ, đổi tên sau cũng được — id mới là căn cứ chính)
export const CONFIRM_WORD = 'DEPLOY';

const ID_RE = { orgId: /^[A-Za-z0-9_-]{6,64}$/, projectId: /^prj_[A-Za-z0-9]{10,64}$/ };

// Đọc cấu hình môi trường: .vercel/envs.json ({ prod: {...}, dev: {...} }); riêng prod có thể lấy từ .vercel/project.json (liên kết cũ).
export function resolveTarget(env, envsJson, linkedProject) {
  if (!ENVS[env]) return { ok: false, error: `Môi trường "${env}" không hợp lệ (chỉ có: ${Object.keys(ENVS).join(', ')}).` };
  const t = envsJson?.[env] || (env === 'prod' ? linkedProject : null);
  if (!t) {
    return { ok: false, error: env === 'dev'
      ? 'Chưa cấu hình môi trường dev. Chạy: node scripts/setup-dev-env.mjs (cần Project ID + Org ID của project Vercel dev).'
      : 'Chưa liên kết Vercel cho môi trường thật (thiếu .vercel/project.json). Chạy: npx vercel link' };
  }
  for (const k of ['orgId', 'projectId']) if (!ID_RE[k].test(String(t[k] || ''))) return { ok: false, error: `Cấu hình ${env}: ${k} sai định dạng.` };
  return { ok: true, target: { projectName: t.projectName || '', orgId: t.orgId, projectId: t.projectId } };
}

// Các lỗi chặn deploy (mảng rỗng = được phép). `p` = { env, branch, dirty (chuỗi git status), targets: { prod, dev } đã resolve }.
export function checkRules(p) {
  const rule = ENVS[p.env], errs = [];
  if (!rule) return [`Môi trường "${p.env}" không hợp lệ.`];
  if (rule.branch && p.branch !== rule.branch) errs.push(`đang ở nhánh "${p.branch}", môi trường ${p.env} chỉ được deploy từ nhánh "${rule.branch}". Chạy: git checkout ${rule.branch}`);
  if (rule.needClean && p.dirty) errs.push(`còn sửa đổi CHƯA COMMIT (sẽ bị đưa lên nhưng không nằm trong lịch sử git):\n${p.dirty}\n   Hãy commit hoặc hoàn tác trước.`);
  // Chốt chặn quan trọng nhất: dev và prod KHÔNG được trỏ cùng một project (nếu nhầm, bản thử nghiệm sẽ đè lên môi trường thật)
  const { prod, dev } = p.targets || {};
  if (prod && dev && (prod.projectId === dev.projectId || (prod.projectName && prod.projectName === dev.projectName))) {
    errs.push('cấu hình dev và prod đang trỏ CÙNG một project Vercel — dừng để không ghi đè môi trường thật. Kiểm tra .vercel/envs.json.');
  }
  if (p.env === 'dev' && p.targets?.dev?.projectName === PROD_PROJECT_NAME) errs.push(`project dev không được đặt tên "${PROD_PROJECT_NAME}" (đó là tên môi trường thật).`);
  return errs;
}

export const vercelEnv = (target) => ({ VERCEL_ORG_ID: target.orgId, VERCEL_PROJECT_ID: target.projectId });
export const confirmOk = (env, answer) => !ENVS[env]?.needConfirm || String(answer).trim() === CONFIRM_WORD;
