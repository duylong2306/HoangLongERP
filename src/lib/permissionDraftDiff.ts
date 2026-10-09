// ĐẾM SỐ THAY ĐỔI CHƯA LƯU của các màn hình phân quyền (cơ chế "bản nháp": tích ô chỉ đổi trên màn hình, phải bấm Lưu mới có hiệu lực).
// Dùng để hiện cho người dùng "Có N thay đổi chưa lưu" và tô nổi đúng những ô đã đổi — trước đây chỉ có 1 chữ "Chưa lưu" nhỏ nằm tít cuối trang
// nên rất dễ tưởng đã lưu (VD tích quyền cho Kế toán rồi bỏ đi mà chưa bấm Lưu → quyền không có hiệu lực).

/** Số phần tử khác nhau giữa 2 tập (thêm + bớt). */
export function countSetChanges(a: readonly string[] | undefined, b: readonly string[] | undefined): number {
  const A = new Set(a || []), B = new Set(b || []);
  let n = 0;
  for (const x of A) if (!B.has(x)) n++;
  for (const x of B) if (!A.has(x)) n++;
  return n;
}

type RoleGroupActions = { roleGroupActions?: Record<string, string[]> } | undefined | null;

/** Ma trận "Vai trò nhóm HRM": mỗi ô (nhóm × hành động) đổi tích/bỏ tích tính 1 thay đổi. */
export function countRoleGroupMatrixChanges(draft: RoleGroupActions, saved: RoleGroupActions): number {
  const d = draft?.roleGroupActions || {}, s = saved?.roleGroupActions || {};
  let n = 0;
  for (const gid of new Set([...Object.keys(d), ...Object.keys(s)])) n += countSetChanges(d[gid], s[gid]);
  return n;
}

/** Ô (nhóm × hành động) này có khác bản đã lưu không — để tô nổi ô. */
export function isRoleGroupCellChanged(draft: RoleGroupActions, saved: RoleGroupActions, gid: string, action: string): boolean {
  const inDraft = !!draft?.roleGroupActions?.[gid]?.includes(action);
  const inSaved = !!saved?.roleGroupActions?.[gid]?.includes(action);
  return inDraft !== inSaved;
}

type ProjectMatrix = { actions?: Record<string, string[]>; visibility?: Record<string, string>; inheritBelow?: boolean } | undefined | null;

/** Ma trận "Theo vị trí trong dự án": ô (hành động × vai trò) đổi + tầm nhìn đổi + công tắc kế thừa đổi. (Bỏ qua phần nhóm HRM — đếm riêng.) */
export function countProjectMatrixChanges(draft: ProjectMatrix, saved: ProjectMatrix): number {
  const da = draft?.actions || {}, sa = saved?.actions || {};
  let n = 0;
  for (const act of new Set([...Object.keys(da), ...Object.keys(sa)])) n += countSetChanges(da[act], sa[act]);
  const dv = draft?.visibility || {}, sv = saved?.visibility || {};
  for (const r of new Set([...Object.keys(dv), ...Object.keys(sv)])) if (dv[r] !== sv[r]) n++;
  if (draft && saved && !!draft.inheritBelow !== !!saved.inheritBelow) n++;
  return n;
}

export function isProjectCellChanged(draft: ProjectMatrix, saved: ProjectMatrix, action: string, role: string): boolean {
  return !!draft?.actions?.[action]?.includes(role) !== !!saved?.actions?.[action]?.includes(role);
}

/** Danh sách có `id` (VD các nhóm vai trò): đếm mục thêm / xóa / sửa. */
export function countListChangesById(draft: any[] | undefined, saved: any[] | undefined): number {
  const d = new Map((draft || []).map(x => [x?.id, JSON.stringify(x)])), s = new Map((saved || []).map(x => [x?.id, JSON.stringify(x)]));
  let n = 0;
  for (const [id, js] of d) if (!s.has(id) || s.get(id) !== js) n++;
  for (const id of s.keys()) if (!d.has(id)) n++;
  return n;
}

/** Đếm số "lá" khác nhau giữa 2 giá trị JSON (dùng cho cấu hình lồng nhau như quyền phê duyệt). */
export function countJsonChanges(a: any, b: any): number {
  if (a === b) return 0;
  const ta = typeof a, tb = typeof b;
  if (a && b && ta === 'object' && tb === 'object') {
    if (Array.isArray(a) && Array.isArray(b) && a.every(x => typeof x !== 'object') && b.every(x => typeof x !== 'object')) return countSetChanges(a.map(String), b.map(String));
    let n = 0;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) n += countJsonChanges((a as any)[k], (b as any)[k]);
    return n;
  }
  return JSON.stringify(a) === JSON.stringify(b) ? 0 : 1;
}

// ─── Quyền Công việc (ma trận hrTaskPermissions): mỗi ô (hành động × vai trò) đổi tích/bỏ tích tính 1 thay đổi ───
type TaskMatrix = { actions?: Record<string, string[]> } | undefined | null;
export function countTaskMatrixChanges(draft: TaskMatrix, saved: TaskMatrix): number {
  const d = draft?.actions || {}, s = saved?.actions || {};
  let n = 0;
  for (const a of new Set([...Object.keys(d), ...Object.keys(s)])) n += countSetChanges(d[a], s[a]);
  return n;
}
export function isTaskCellChanged(draft: TaskMatrix, saved: TaskMatrix, action: string, role: string): boolean {
  return !!draft?.actions?.[action]?.includes(role) !== !!saved?.actions?.[action]?.includes(role);
}

/**
 * Nhóm vai trò: đếm theo TỪNG THAY ĐỔI cụ thể (trước đây đếm theo nhóm nên thêm 5 người vào 4 nhóm chỉ báo "4 thay đổi"):
 * nhóm thêm/xóa = 1; đổi tên/mô tả = 1 mỗi cái; mỗi ô quyền phân hệ (xem/thêm/sửa/xóa) đổi = 1; mỗi thành viên vào/ra = 1.
 */
export function countRoleGroupChanges(draft: any[] | undefined, saved: any[] | undefined): number {
  const d = new Map((draft || []).map(x => [x?.id, x])), s = new Map((saved || []).map(x => [x?.id, x]));
  let n = 0;
  for (const [id, g] of d) {
    const old = s.get(id);
    if (!old) { n++; continue; }
    if ((g.name || '') !== (old.name || '')) n++;
    if ((g.description || '') !== (old.description || '')) n++;
    const pa = g.permissions || {}, pb = old.permissions || {};
    for (const m of new Set([...Object.keys(pa), ...Object.keys(pb)])) {
      for (const q of ['view', 'create', 'edit', 'delete'] as const) if (!!pa[m]?.[q] !== !!pb[m]?.[q]) n++;
    }
    n += countSetChanges(g.memberIds, old.memberIds);
  }
  for (const id of s.keys()) if (!d.has(id)) n++;
  return n;
}
