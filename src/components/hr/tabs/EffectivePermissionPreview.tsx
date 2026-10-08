// ─── Xem quyền của một nhân viên (Quyền Dự Án) ───────────────────────────────────────────────────
// Chọn một nhân viên → bảng "người này thực sự làm được gì" ở từng tình huống, kèm nguồn quyền (vị trí / nhóm / toàn quyền).
// Dùng đúng hàm can() của ứng dụng (xem effectivePermissions.ts) và cấu hình ĐÃ LƯU — nên khớp hành vi thật, không phải đoán theo ma trận.
import React from 'react';
import { Eye, Check, Minus } from 'lucide-react';
import type { Employee } from '../../../types';
import { loadHrmRoleGroups, getRoleGroupKind, ROLE_GROUP_KIND_LABELS } from '../../../context';
import { loadProjectPermissions } from '../hrProjectPermissions';
import { actionGroups } from './ProjectPermissionModal';
import { previewEmployeePermissions, resolveRoleGroupIds, SITUATION_LABELS, Situation, Source } from '../effectivePermissions';

const COT: Situation[] = ['board', 'pm', 'assigner', 'assignee', 'missionAssignee', 'teamMember'];
const NHAN_NGUON: Record<string, { chu: string; mau: string; tip: string }> = {
  vitri: { chu: 'Vị trí', mau: 'text-emerald-400', tip: 'Có quyền nhờ ma trận "Theo vị trí trong dự án"' },
  nhom: { chu: 'Nhóm', mau: 'text-amber-400', tip: 'Có quyền nhờ ma trận "Vai trò nhóm HRM" của nhóm người này' },
  toanquyen: { chu: 'Toàn quyền', mau: 'text-sky-400', tip: 'Quản trị viên / Siêu Admin: luôn được phép' },
};

interface Props { employees: { id: string; name: string; roleGroupIds?: string[]; status?: string }[]; }

export default function EffectivePermissionPreview({ employees }: Props) {
  const [empId, setEmpId] = React.useState('');
  // Tính lại khi ma trận được lưu/đồng bộ (sự kiện do App/RolesTab phát) để bảng luôn theo cấu hình mới nhất
  const [phienBan, setPhienBan] = React.useState(0);
  React.useEffect(() => {
    const f = () => setPhienBan(v => v + 1);
    window.addEventListener('hl-project-permissions-updated', f);
    return () => window.removeEventListener('hl-project-permissions-updated', f);
  }, []);
  const groups = React.useMemo(() => loadHrmRoleGroups(), []);
  const emp = React.useMemo<Employee | undefined>(() => {
    const e = employees.find(x => x.id === empId);
    return e ? ({ ...e, roleGroupIds: resolveRoleGroupIds(e, groups) } as any) : undefined;
  }, [empId, employees, groups]);
  const rows = React.useMemo(() => (emp ? previewEmployeePermissions(emp, loadProjectPermissions()) : []), [emp, phienBan]);
  const theoAction = React.useMemo(() => new Map(rows.map(r => [r.action, r])), [rows]);
  const nhomCuaNguoi = emp ? groups.filter(g => (emp.roleGroupIds || []).includes(g.id)) : [];

  const o = (c: Source | 'khongapdung') => {
    if (c === 'khongapdung') return <span className="text-slate-700" title="Không áp dụng cho tình huống này">·</span>;
    if (!c) return <span title="Không có quyền"><Minus className="w-3.5 h-3.5 mx-auto text-slate-600" /></span>;
    const n = NHAN_NGUON[c];
    return <span title={n.tip} className={`inline-flex flex-col items-center leading-none ${n.mau}`}><Check className="w-3.5 h-3.5" /><span className="text-[8px] font-bold mt-0.5">{n.chu}</span></span>;
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 text-left" data-testid="effective-permission-preview">
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
        <h4 className="font-extrabold text-sm text-white flex items-center gap-2"><Eye className="w-4 h-4 text-emerald-500" /> Xem quyền của một nhân viên</h4>
        <p className="text-[10.5px] text-slate-400 mt-1">
          Chọn nhân viên để xem người này THỰC SỰ làm được gì ở từng tình huống (theo cấu hình đã lưu, tính bằng đúng quy tắc của ứng dụng).
          Chưa gồm các thao tác trong chi tiết công việc (nhận việc, hoàn thành, duyệt, tạm ứng...) — những thao tác đó theo ma trận quyền công việc (hiện là cấu hình mặc định của hệ thống, chưa có màn hình chỉnh).
        </p>
      </div>

      <select
        value={empId}
        onChange={e => setEmpId(e.target.value)}
        aria-label="Chọn nhân viên"
        className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none w-full sm:w-72"
      >
        <option value="">— Chọn nhân viên —</option>
        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>

      {emp && (
        <>
          <div className="text-[11px] text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Nhóm vai trò: {nhomCuaNguoi.length === 0 ? <i className="text-slate-500">chưa thuộc nhóm nào</i> : nhomCuaNguoi.map(g => {
              const k = getRoleGroupKind(g.permissions as any);
              return <b key={g.id} className="text-amber-300 mr-2">{g.name}{k ? <span className="text-slate-500 font-normal"> ({ROLE_GROUP_KIND_LABELS[k]})</span> : null}</b>;
            })}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9.5px] text-slate-400">
            <span><b className="text-emerald-400">✓ Vị trí</b> = nhờ ma trận Theo vị trí</span>
            <span><b className="text-amber-400">✓ Nhóm</b> = nhờ ma trận Vai trò nhóm HRM</span>
            <span><b className="text-sky-400">✓ Toàn quyền</b> = quản trị viên</span>
            <span><b className="text-slate-500">–</b> không có quyền · <b className="text-slate-600">·</b> không áp dụng</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                  <th className="p-3 font-bold w-56">Hành động</th>
                  {COT.map(s => <th key={s} className="p-3 font-bold text-center text-[10px] max-w-[110px] whitespace-normal leading-tight">{SITUATION_LABELS[s]}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {actionGroups.map(g => {
                  const dong = g.actions.filter(a => theoAction.has(a.action));
                  if (dong.length === 0) return null;
                  return (
                    <React.Fragment key={g.group}>
                      <tr className="bg-slate-950/60"><td colSpan={COT.length + 1} className="p-2 px-3 text-[10px] text-amber-400 font-extrabold uppercase tracking-wider">{g.group}</td></tr>
                      {dong.map(({ action, label }) => (
                        <tr key={action} className="hover:bg-slate-900/40">
                          <td className="p-3 pl-6 font-medium text-slate-300 text-[11px]">{label}</td>
                          {COT.map(s => <td key={s} className="p-2 text-center">{o(theoAction.get(action)!.cells[s])}</td>)}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
