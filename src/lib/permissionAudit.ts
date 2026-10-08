// ─── NHẬT KÝ THAY ĐỔI PHÂN QUYỀN ─────────────────────────────────────────────────────────────────────
// Mỗi lần bấm "Lưu thay đổi" ở màn hình Phân Quyền Và Vai Trò, ghi lại: ai đổi, lúc nào, vùng nào, đổi gì (từ → sang) để khi có sự cố
// ("sao Kế toán bỗng không tạo được dự án?") truy ra ngay ai đã sửa gì.
// Phần "tính đổi gì" (diff*) là hàm thuần, có test. Phần ghi/đọc DB (record/load) KHÔNG BAO GIỜ làm hỏng việc lưu phân quyền:
// lỗi (VD chưa chạy migration 20261019) chỉ trả false/ghi log.
import { getSupabase, getCurrentCompanyId } from './supabase';

export type AuditArea = 'role_group' | 'project_position' | 'project_group' | 'approval' | 'task_permission';
export const AUDIT_AREA_LABELS: Record<AuditArea, string> = {
  role_group: 'Nhóm vai trò (quyền phân hệ, thành viên)',
  project_position: 'Quyền Dự Án — theo vị trí',
  project_group: 'Quyền Dự Án — theo nhóm HRM',
  approval: 'Quyền Phê Duyệt',
  task_permission: 'Quyền Công việc',
};

export interface AuditChange { label: string; from: string; to: string }
export interface AuditDiff { target: string; summary: string; changes: AuditChange[] }
export interface AuditRow {
  id: string; actorId?: string; actorName?: string; area: AuditArea; target?: string; summary?: string; changes: AuditChange[]; createdAt: string;
}

type LabelFn = (key: string) => string;
const id = (k: string) => k;
const CO = 'Có', KHONG = 'Không';

export const SCOPE_LABELS: Record<string, string> = {
  director: 'Giám đốc', pm: 'Trưởng DA', assigner: 'Người giao việc', assignee: 'Phụ trách CV',
  missionAssignee: 'Phụ trách NV', teamMember: 'Thành viên', accountant: 'Kế toán',
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Quyền Dự Án — theo vị trí: mỗi (hành động × vai trò) được thêm/bỏ tick là 1 thay đổi; cộng thêm công tắc kế thừa. */
export function diffProjectPosition(before: any, after: any, actionLabel: LabelFn = id): AuditDiff | null {
  const b = before?.actions || {}, a = after?.actions || {};
  const changes: AuditChange[] = [];
  for (const act of new Set([...Object.keys(b), ...Object.keys(a)])) {
    const B = new Set<string>(b[act] || []), A = new Set<string>(a[act] || []);
    for (const r of A) if (!B.has(r)) changes.push({ label: `${actionLabel(act)} — ${SCOPE_LABELS[r] || r}`, from: KHONG, to: CO });
    for (const r of B) if (!A.has(r)) changes.push({ label: `${actionLabel(act)} — ${SCOPE_LABELS[r] || r}`, from: CO, to: KHONG });
  }
  if (before && after && !!before.inheritBelow !== !!after.inheritBelow) {
    changes.push({ label: 'Kế thừa quyền xuống vai trò thấp hơn', from: before.inheritBelow ? 'Bật' : 'Tắt', to: after.inheritBelow ? 'Bật' : 'Tắt' });
  }
  if (!changes.length) return null;
  const them = changes.filter(c => c.to === CO).length, bot = changes.filter(c => c.to === KHONG).length;
  return { target: 'Theo vị trí trong dự án', summary: `Theo vị trí: +${them} quyền, −${bot} quyền`, changes };
}

/** Quyền Công việc: mỗi (hành động × vai trò) được thêm/bỏ tick là 1 thay đổi. */
export function diffTaskMatrix(before: any, after: any, actionLabel: LabelFn = id): AuditDiff | null {
  const b = before?.actions || {}, a = after?.actions || {};
  const changes: AuditChange[] = [];
  for (const act of new Set([...Object.keys(b), ...Object.keys(a)])) {
    const B = new Set<string>(b[act] || []), A = new Set<string>(a[act] || []);
    for (const r of A) if (!B.has(r)) changes.push({ label: `${actionLabel(act)} — ${SCOPE_LABELS[r] || r}`, from: KHONG, to: CO });
    for (const r of B) if (!A.has(r)) changes.push({ label: `${actionLabel(act)} — ${SCOPE_LABELS[r] || r}`, from: CO, to: KHONG });
  }
  if (!changes.length) return null;
  const them = changes.filter(c => c.to === CO).length, bot = changes.filter(c => c.to === KHONG).length;
  return { target: 'Quyền Công việc', summary: `Quyền Công việc: +${them} quyền, −${bot} quyền`, changes };
}

/** Quyền Dự Án — theo nhóm HRM: mỗi (nhóm × hành động). Trả về 1 diff gộp (target = tên các nhóm bị ảnh hưởng). */
export function diffProjectGroup(before: any, after: any, groupName: LabelFn = id, actionLabel: LabelFn = id): AuditDiff | null {
  const b = before?.roleGroupActions || {}, a = after?.roleGroupActions || {};
  const changes: AuditChange[] = []; const nhom = new Set<string>();
  for (const g of new Set([...Object.keys(b), ...Object.keys(a)])) {
    const B = new Set<string>(b[g] || []), A = new Set<string>(a[g] || []);
    for (const x of A) if (!B.has(x)) { changes.push({ label: `${groupName(g)} — ${actionLabel(x)}`, from: KHONG, to: CO }); nhom.add(groupName(g)); }
    for (const x of B) if (!A.has(x)) { changes.push({ label: `${groupName(g)} — ${actionLabel(x)}`, from: CO, to: KHONG }); nhom.add(groupName(g)); }
  }
  if (!changes.length) return null;
  const them = changes.filter(c => c.to === CO).length, bot = changes.filter(c => c.to === KHONG).length;
  return { target: [...nhom].join(', '), summary: `${[...nhom].join(', ')}: +${them} quyền, −${bot} quyền`, changes };
}

const QUYEN = ['view', 'create', 'edit', 'delete'] as const;
const QUYEN_VN: Record<string, string> = { view: 'Xem', create: 'Thêm', edit: 'Sửa', delete: 'Xóa' };
const KIND_PREFIX = '__role_kind__';
const moTa = (p: any) => QUYEN.filter(q => p?.[q]).map(q => QUYEN_VN[q]).join('/') || 'Không có';

/** Nhóm vai trò: nhóm thêm/xóa, quyền phân hệ đổi (Xem/Thêm/Sửa/Xóa), thành viên vào/ra, loại nhóm. Mỗi nhóm bị đổi cho 1 diff riêng. */
export function diffRoleGroups(before: any[], after: any[], moduleLabel: LabelFn = id, memberName: LabelFn = id): AuditDiff[] {
  const out: AuditDiff[] = [];
  const B = new Map((before || []).map(g => [g.id, g])), A = new Map((after || []).map(g => [g.id, g]));
  for (const [gid, g] of A) {
    const old = B.get(gid);
    if (!old) { out.push({ target: g.name, summary: `Thêm nhóm "${g.name}"`, changes: [{ label: 'Nhóm vai trò', from: '—', to: g.name }] }); continue; }
    const changes: AuditChange[] = [];
    if (old.name !== g.name) changes.push({ label: 'Tên nhóm', from: old.name, to: g.name });
    const pb = old.permissions || {}, pa = g.permissions || {};
    for (const m of new Set([...Object.keys(pb), ...Object.keys(pa)])) {
      if (m.startsWith(KIND_PREFIX)) {
        const had = !!pb[m]?.view, has = !!pa[m]?.view;
        if (had !== has) changes.push({ label: `Loại nhóm "${m.slice(KIND_PREFIX.length)}"`, from: had ? 'Có' : 'Không', to: has ? 'Có' : 'Không' });
        continue;
      }
      if (!same(moTa(pb[m]), moTa(pa[m]))) changes.push({ label: `Phân hệ ${moduleLabel(m)}`, from: moTa(pb[m]), to: moTa(pa[m]) });
    }
    const mb = new Set<string>(old.memberIds || []), ma = new Set<string>(g.memberIds || []);
    for (const x of ma) if (!mb.has(x)) changes.push({ label: `Thành viên ${memberName(x)}`, from: 'Chưa thuộc nhóm', to: 'Thêm vào nhóm' });
    for (const x of mb) if (!ma.has(x)) changes.push({ label: `Thành viên ${memberName(x)}`, from: 'Thuộc nhóm', to: 'Bỏ khỏi nhóm' });
    if (changes.length) out.push({ target: g.name, summary: `${g.name}: ${changes.length} thay đổi`, changes });
  }
  for (const [gid, g] of B) if (!A.has(gid)) out.push({ target: g.name, summary: `Xóa nhóm "${g.name}"`, changes: [{ label: 'Nhóm vai trò', from: g.name, to: '—' }] });
  return out;
}

/** Quyền Phê Duyệt: so từng loại chứng từ — người duyệt, người quyết toán, bật/tắt quyền duyệt. Chuỗi người dùng truyền vào để giải mã (JSON mảng tên → "A, B"). */
export function diffApproval(before: any[], after: any[], nameText: (raw: any) => string = raw => String(raw ?? '')): AuditDiff | null {
  const B = new Map((before || []).map(c => [c.documentType, c])), A = new Map((after || []).map(c => [c.documentType, c]));
  const changes: AuditChange[] = [];
  const hienThi = (v: string) => v || '(chưa chọn)';
  for (const [t, c] of A) {
    const old = B.get(t); const ten = c.documentTypeLabel || t;
    const duyetCu = old ? nameText(old.approverName) : '—', duyetMoi = nameText(c.approverName);
    if (duyetCu !== duyetMoi) changes.push({ label: `${ten} — người duyệt`, from: hienThi(duyetCu), to: hienThi(duyetMoi) });
    const qtCu = old ? nameText(old.settlerName) : '—', qtMoi = nameText(c.settlerName);
    if (qtCu !== qtMoi) changes.push({ label: `${ten} — người quyết toán`, from: hienThi(qtCu), to: hienThi(qtMoi) });
    if (old && !!old.canApprove !== !!c.canApprove) changes.push({ label: `${ten} — quyền duyệt`, from: old.canApprove ? 'Bật' : 'Tắt', to: c.canApprove ? 'Bật' : 'Tắt' });
  }
  if (!changes.length) return null;
  return { target: 'Quyền Phê Duyệt', summary: `Quyền Phê Duyệt: ${changes.length} thay đổi`, changes };
}

// ─── Ghi / đọc DB (không bao giờ ném lỗi) ──────────────────────────────────────────────────────────
export async function recordPermissionAudit(area: AuditArea, diff: AuditDiff | null | undefined, actor?: { id?: string; name?: string }): Promise<boolean> {
  if (!diff || !diff.changes.length) return false;
  try {
    const supabase = getSupabase(); const companyId = getCurrentCompanyId();
    if (!supabase || !companyId) return false;
    const { error } = await supabase.from('permission_audit_log').insert({
      company_id: companyId, actor_id: actor?.id ?? null, actor_name: actor?.name ?? null,
      area, target: diff.target, summary: diff.summary, changes: diff.changes,
    });
    if (error) { console.warn('Ghi nhật ký phân quyền thất bại:', error.message); return false; }
    return true;
  } catch (e: any) {
    console.warn('Ghi nhật ký phân quyền lỗi:', e?.message || e);
    return false;
  }
}

// Kiểu phẳng (không dùng union phân biệt) vì tsconfig của dự án không bật strict nên TypeScript không thu hẹp kiểu theo `ok`.
export interface LoadAuditResult { ok: boolean; rows?: AuditRow[]; notEnabled?: boolean; message?: string }

/** Đọc nhật ký mới nhất. notEnabled=true khi bảng chưa tồn tại (chưa chạy migration). */
export async function loadPermissionAudit(limit = 100): Promise<LoadAuditResult> {
  try {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, notEnabled: false, message: 'Chưa kết nối cơ sở dữ liệu.' };
    const { data, error } = await supabase.from('permission_audit_log').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) {
      const code = (error as any).code as string | undefined;
      const missing = code === '42P01' || code === 'PGRST205' || /does not exist|schema cache|Could not find the table/i.test(error.message || '');
      return { ok: false, notEnabled: missing, message: error.message };
    }
    return { ok: true, rows: (data || []).map((r: any) => ({ id: r.id, actorId: r.actor_id, actorName: r.actor_name, area: r.area, target: r.target, summary: r.summary, changes: Array.isArray(r.changes) ? r.changes : [], createdAt: r.created_at })) };
  } catch (e: any) {
    return { ok: false, notEnabled: false, message: e?.message || String(e) };
  }
}
