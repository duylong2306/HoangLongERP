// ─── Tab "Quyền Công việc" — chỉnh ma trận quyền THAO TÁC TRONG CHI TIẾT CÔNG VIỆC ───────────────────
// Trước đây ma trận này (hrTaskPermissions.ts) KHÔNG có màn hình chỉnh nào: cả 2 công ty đều đang dùng mặc định trong code, chủ doanh nghiệp
// không đổi được. Màn này cho chỉnh theo cơ chế bản nháp (tích ô → phải bấm Lưu), có số thay đổi chưa lưu và nhật ký.
// Quyết định ai làm được thao tác nào TRONG công việc: nhận việc, hoàn thành, duyệt, giao thợ phụ, tạm ứng, ghi vi phạm, sửa/xóa công việc...
import React from 'react';
import { Eye, CheckCircle2, Shield, Users, AlertTriangle, DollarSign, FileText, Info, ListTodo } from 'lucide-react';
import { TaskPermissionMatrix, TaskAction, RoleScope } from '../hrTaskPermissions';
import { countTaskMatrixChanges, isTaskCellChanged } from '../../../lib/permissionDraftDiff';
import HelpTip from '../../ui/HelpTip';
import { TASK_ACTION_HELP } from '../../../lib/permissionHelp';

/** Nhãn tiếng Việt của từng thao tác */
export const TASK_ACTION_LABELS: Record<TaskAction, string> = {
  view: 'Xem công việc',
  receiveTask: 'Nhận việc',
  completeTask: 'Tự hoàn thành công việc',
  approveResult: 'Duyệt kết quả',
  rejectResult: 'Từ chối duyệt kết quả',
  assignMembers: 'Thêm/xóa người tham gia',
  assignSubWorkers: 'Gán thợ phụ cho nhiệm vụ',
  recordViolation: 'Ghi nhận vi phạm',
  issuePenalty: 'Lập phiếu phạt',
  proposeAdvance: 'Đề xuất tạm ứng',
  settlePayment: 'Quyết toán thanh toán',
  manageDocs: 'Quản lý hồ sơ liên thông',
  editTask: 'Đổi người phụ trách chính',
  deleteTask: 'Xóa công việc',
  manageSubTask: 'Tạo / nhập Excel nhiệm vụ',
  editMissionInfo: 'Sửa / xóa nhiệm vụ',
  assignMission: 'Phân công nhiệm vụ (phụ trách chính, thành viên)',
  executeMission: 'Thực hiện nhiệm vụ (checklist, báo cáo + tệp, công tác phí, hoàn thành)',
};

const GROUPS: { group: string; icon: React.ReactNode; actions: TaskAction[] }[] = [
  { group: 'XEM', icon: <Eye className="w-3.5 h-3.5" />, actions: ['view'] },
  { group: 'NHẬN & HOÀN THÀNH', icon: <CheckCircle2 className="w-3.5 h-3.5" />, actions: ['receiveTask', 'completeTask'] },
  { group: 'DUYỆT & TỪ CHỐI', icon: <Shield className="w-3.5 h-3.5" />, actions: ['approveResult', 'rejectResult'] },
  { group: 'PHÂN CÔNG', icon: <Users className="w-3.5 h-3.5" />, actions: ['assignMembers'] },
  { group: 'KỶ LUẬT & HIỆU SUẤT', icon: <AlertTriangle className="w-3.5 h-3.5" />, actions: ['recordViolation'] },
  { group: 'TÀI CHÍNH', icon: <DollarSign className="w-3.5 h-3.5" />, actions: ['proposeAdvance'] },
  // Đã gỡ khỏi giao diện (dữ liệu đã lưu giữ nguyên) các ô không điều khiển nút nào: Xóa công việc, Lập phiếu phạt, Quyết toán thanh toán, Quản lý hồ sơ liên thông, Gán thợ phụ.
  // (Quyết toán/hồ sơ do Quyền Dự Án quyết định; lập phiếu phạt và thợ phụ chưa có chức năng.) Chi tiết bên dưới về riêng ô Xóa công việc:
  // Đã gỡ ô 'Xóa công việc' (deleteTask) khỏi giao diện: nút xóa công việc ở Kanban chỉ do ô 'Xóa công việc' của Quyền Dự Án quyết định, ô này trùng và không điều khiển nút nào (dữ liệu đã lưu giữ nguyên).
  { group: 'QUẢN LÝ CÔNG VIỆC', icon: <FileText className="w-3.5 h-3.5" />, actions: ['editTask'] },
  { group: 'NHIỆM VỤ', icon: <ListTodo className="w-3.5 h-3.5" />, actions: ['manageSubTask', 'editMissionInfo', 'assignMission', 'executeMission'] },
];

// Các vai trò chỉnh được (bỏ "Không liên quan": cấp quyền cho người chẳng liên quan gì tới công việc dễ lộ dữ liệu)
const COT: { key: RoleScope; label: string; desc: string }[] = [
  { key: 'director', label: 'Giám Đốc', desc: 'Quản trị viên luôn được phép mọi thao tác quản lý (trừ Nhận việc/Hoàn thành) — không chỉnh được' },
  { key: 'pm', label: 'Trưởng Dự Án', desc: 'Trưởng dự án của dự án chứa công việc (project.pmId)' },
  { key: 'assigner', label: 'Người Giao Việc', desc: 'Người giao công việc (task.assignerId)' },
  { key: 'assignee', label: 'Phụ Trách CV', desc: 'Người phụ trách công việc (task.assigneeId)' },
  { key: 'missionAssignee', label: 'Phụ Trách NV', desc: 'Người phụ trách chính một nhiệm vụ con (mission.mainAssigneeId)' },
  { key: 'accountant', label: 'Kế Toán', desc: 'Nhân viên thuộc nhóm có Loại nhóm "Kế toán"' },
];

/**
 * Thao tác hiện CHƯA nối vào nút nào trong cửa sổ chi tiết công việc (khai báo quyền nhưng không dùng) — tick hay bỏ tick đều chưa đổi gì.
 * Xóa công việc ở Kanban dùng ma trận Quyền Dự Án; quyết toán/hồ sơ dùng Quyền Dự Án; "Gán thợ phụ" nay gộp vào "Quản lý nhiệm vụ con".
 */
export const TASK_ACTIONS_NOT_APPLIED: ReadonlySet<TaskAction> = new Set<TaskAction>([]); // hiện không còn ô nào chưa nối: các ô thừa đã gỡ khỏi bảng

/** Nhận việc / Hoàn thành chỉ dành cho người được giao: ứng dụng chỉ đọc 2 vai trò này, các ô khác không có tác dụng. */
const CHI_NGUOI_DUOC_GIAO: TaskAction[] = ['receiveTask', 'completeTask'];
const CELL_DA_DOI = ' bg-amber-100 ring-2 ring-inset ring-amber-400 rounded';

interface Props {
  value: TaskPermissionMatrix;
  onChange: (m: TaskPermissionMatrix) => void;
  savedValue: TaskPermissionMatrix;
}

export default function TaskPermissionEditor({ value, onChange, savedValue }: Props) {
  const soDoi = countTaskMatrixChanges(value, savedValue);

  const toggle = (action: TaskAction, role: RoleScope) => {
    const cur = value.actions[action] || [];
    const next = cur.includes(role) ? cur.filter(r => r !== role) : [...cur, role];
    onChange({ ...value, actions: { ...value.actions, [action]: next } });
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 text-left" data-testid="task-permission-editor">
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
        <h4 className="font-extrabold text-sm text-white flex items-center gap-2"><Shield className="w-4 h-4 text-sky-500" /> Cấu hình Quyền Công việc</h4>
        <p className="text-[10.5px] text-slate-400 mt-1">
          Quyết định ai được làm thao tác nào BÊN TRONG một công việc và các nhiệm vụ con của nó: nhận việc, hoàn thành, duyệt/từ chối, thêm người tham gia, ghi vi phạm,
          đề xuất tạm ứng thầu phụ, đổi người phụ trách chính, và thao tác trên từng nhiệm vụ (tạo/nhập, sửa/xóa, phân công, thực hiện).
          Tích ô rồi bấm <b>Lưu thay đổi</b> ở thanh dưới mới có hiệu lực (người đang đăng nhập nhận quyền mới trong khoảng 1 phút). Áp dụng cho TOÀN doanh nghiệp.
        </p>
      </div>

      <div className="flex gap-2 text-[10px] text-slate-400 bg-slate-950/60 border border-slate-850 rounded-lg p-3" role="note">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-sky-400" />
        <ul className="space-y-0.5 list-disc pl-3.5">
          <li>Mỗi người chỉ được tính MỘT vai trò ở mỗi công việc, theo thứ tự ưu tiên: Giám đốc → Trưởng DA → Người giao việc → Phụ trách CV → Phụ trách NV → Kế toán. (Người vừa là Người giao việc vừa là Phụ trách CV được tính là Người giao việc.)</li>
          <li><b>Nhận việc / Hoàn thành</b> chỉ dành cho người được giao (Phụ trách CV, Phụ trách NV) — kể cả Giám đốc cũng không nhận hộ việc của người khác; các ô khác ở 2 dòng này bị khóa.</li>
          <li>Quyền cấp cho từng NHÓM ở tab <b>Quyền Dự Án → Vai trò nhóm HRM</b> được cộng thêm vào đây (trừ Nhận việc / Hoàn thành).</li>
          <li>Nhóm <b>Nhiệm vụ</b> tính theo TỪNG nhiệm vụ: người phụ trách chính của một nhiệm vụ (cột <b>Phụ Trách NV</b>) chỉ làm được trên nhiệm vụ của chính mình, không lan sang nhiệm vụ của người khác.</li>
        </ul>
      </div>

      {soDoi > 0 && <div role="status" className="text-[11px] font-bold text-amber-400">⚠️ Có {soDoi} thay đổi chưa lưu ở tab này.</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
              <th className="p-3 font-bold w-64">Thao tác trong công việc</th>
              {COT.map(c => <th key={c.key} className="p-3 font-bold text-center w-24" title={c.desc}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850">
            {GROUPS.map(g => (
              <React.Fragment key={g.group}>
                <tr className="bg-slate-950/60">
                  <td colSpan={COT.length + 1} className="p-2 px-3 text-[10px] text-sky-400 font-extrabold uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1.5">{g.icon} {g.group}</span>
                  </td>
                </tr>
                {g.actions.map(action => (
                  <tr key={action} className="hover:bg-slate-900/40">
                    <td className="p-3 pl-6 font-medium text-slate-300 text-[11px]">
                      {TASK_ACTION_LABELS[action]}<HelpTip text={TASK_ACTION_HELP[action] || TASK_ACTION_LABELS[action]} label={TASK_ACTION_LABELS[action]} />
                      {TASK_ACTIONS_NOT_APPLIED.has(action) && (
                        <span className="ml-1.5 text-[8.5px] font-bold uppercase tracking-wide text-slate-500 border border-slate-600 rounded px-1 py-px align-middle" title="Hiện chưa có nút nào trong chi tiết công việc dùng quyền này — tick hay bỏ tick đều chưa đổi gì.">Chưa áp dụng</span>
                      )}
                    </td>
                    {COT.map(c => {
                      const nguoiDuocGiao = c.key === 'assignee' || c.key === 'missionAssignee';
                      const khoa = c.key === 'director' ? true : (CHI_NGUOI_DUOC_GIAO.includes(action) && !nguoiDuocGiao);
                      // Giám đốc: luôn được (trừ nhận việc/hoàn thành). Hiển thị tích cứng, không chỉnh.
                      const checked = c.key === 'director' ? !CHI_NGUOI_DUOC_GIAO.includes(action) : (value.actions[action] || []).includes(c.key);
                      const doi = !khoa && isTaskCellChanged(value, savedValue, action, c.key);
                      return (
                        <td key={c.key} className={'p-2 text-center' + (doi ? CELL_DA_DOI : '')} title={doi ? 'Đã đổi — chưa lưu' : (khoa ? 'Không chỉnh được' : undefined)}>
                          <input
                            type="checkbox"
                            aria-label={`${TASK_ACTION_LABELS[action]} — ${c.label}`}
                            checked={checked}
                            disabled={khoa}
                            onChange={() => toggle(action, c.key)}
                            className="w-4 h-4 rounded accent-sky-500 cursor-pointer mx-auto disabled:opacity-40 disabled:cursor-not-allowed"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
