import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ENFORCED_BY_POSITION, ENFORCED_BY_ROLE_GROUP } from '../projectActionEnforcement';
import { DEFAULT_PROJECT_PERMISSIONS } from '../hrProjectPermissions';

// Canh lệch: bảng "ô nào có tác dụng" phải khớp đúng các chỗ gọi can() trong mã nguồn.
const goc = path.resolve(__dirname, '../..');
const doc = (f: string) => fs.readFileSync(path.join(goc, f), 'utf8');
// Mọi lời gọi can('x', ...) / canProjectAction('x', ...) trong 3 màn dùng ma trận Quyền Dự Án
const goiTrucTiep = new Set<string>();
for (const f of ['ProjectKanbanBoard.tsx', 'ProjectManagement.tsx', 'ConnectedToolsModal.tsx']) {
  for (const m of doc(f).matchAll(/(?:canProjectAction|\bcan)\(\s*'(\w+)'/g)) goiTrucTiep.add(m[1]);
}

describe('Quyền Dự Án — bảng ô có tác dụng khớp mã nguồn', () => {
  it('mọi hành động được can() gọi trực tiếp đều nằm trong ENFORCED_BY_POSITION (và ngược lại)', () => {
    expect([...goiTrucTiep].sort()).toEqual([...ENFORCED_BY_POSITION].sort());
  });
  it('mọi hành động trong bảng là hành động có thật của ma trận', () => {
    const hopLe = new Set(Object.keys(DEFAULT_PROJECT_PERMISSIONS.actions));
    for (const a of ENFORCED_BY_ROLE_GROUP) expect(hopLe.has(a), a).toBe(true);
  });
  it('quyền theo nhóm là tập con-hoặc-bằng đầy đủ của tab vị trí; nhận việc/hoàn thành KHÔNG đọc theo nhóm', () => {
    for (const a of ENFORCED_BY_POSITION) expect(ENFORCED_BY_ROLE_GROUP.has(a)).toBe(true);
    expect(ENFORCED_BY_ROLE_GROUP.has('receiveTask' as any)).toBe(false);
    expect(ENFORCED_BY_ROLE_GROUP.has('completeTask' as any)).toBe(false);
  });
  it('hành động nhóm đọc trong hrTaskPermissions (canDoTaskAction) đều có trong bảng', () => {
    const src = doc('hr/hrTaskPermissions.ts');
    for (const a of ['assignMembers', 'recordViolation', 'issuePenalty', 'proposeAdvance', 'approveResult', 'rejectResult', 'createMission', 'editMission', 'deleteMission', 'assignSubWorker']) {
      expect(src.includes(a), a).toBe(true);
      expect(ENFORCED_BY_ROLE_GROUP.has(a as any), a).toBe(true);
    }
  });
});
