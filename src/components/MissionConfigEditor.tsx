import React, { useState, useRef } from 'react';
import { Employee, SubTaskMissionTemplate } from '../types';
import { CheckSquare, Plus, X, Download, Upload, Briefcase, User } from 'lucide-react';
import SearchableEmployeeSelect from './SearchableEmployeeSelect';
import { useNotification } from '../context';
import * as XLSX from 'xlsx';

interface MissionConfigEditorProps {
  /** Danh sách NHIỆM VỤ CHI TIẾT cấu hình trước */
  value: SubTaskMissionTemplate[];
  onChange: (next: SubTaskMissionTemplate[]) => void;
  employees: Employee[];
  /** Gợi ý hạn mặc định (hiển thị trong placeholder / tooltip) */
  defaultDeadlineHint?: string;
}

/** Định dạng hạn 'YYYY-MM-DD' → 'dd/mm/yyyy' */
const formatDateForExcel = (d?: string): string => {
  if (!d) return '';
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return d;
};

/** Chuyển tên nhân viên → id */
const empIdByName = (employees: Employee[], name?: string): string | undefined => {
  if (!name || !name.trim()) return undefined;
  const trimmed = name.trim();
  const emp = employees.find(e => e.name === trimmed || e.name?.includes(trimmed));
  return emp ? emp.id : undefined;
};

const empNameById = (employees: Employee[], empId?: string): string => {
  if (!empId) return '';
  const emp = employees.find(e => e.id === empId);
  return emp ? emp.name : empId;
};

/**
 * Thẻ NHIỆM VỤ CHI TIẾT (cấu hình trước) — tái sử dụng trong 3 cửa sổ:
 * Tạo thẻ việc con chi tiết, Sửa công việc con, Cấu hình Quy trình tự động công việc con.
 * Cho phép người dùng cấu hình trước các nhiệm vụ cần làm trong công việc con với
 * đầy đủ chức năng giống thẻ NHIỆM VỤ CHI TIẾT (thêm/hạn/phụ trách chính/nhân sự,
 * danh sách, xóa, Import/Export Excel).
 */
export default function MissionConfigEditor({
  value,
  onChange,
  employees,
  defaultDeadlineHint
}: MissionConfigEditorProps) {
  const { addToast } = useNotification();

  // Form thêm nhiệm vụ mới
  const [newName, setNewName] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newMainAssigneeId, setNewMainAssigneeId] = useState('');
  const [newMemberIds, setNewMemberIds] = useState<string[]>([]);

  const excelInputRef = useRef<HTMLInputElement>(null);

  const addMission = () => {
    const name = newName.trim();
    if (!name) {
      addToast({ title: '⚠️ Thiếu tên', message: 'Vui lòng nhập Tên nhiệm vụ trước khi thêm.', type: 'warning' });
      return;
    }
    const next: SubTaskMissionTemplate = {
      id: `ms_cfg_${Date.now()}`,
      name,
      deadline: newDeadline || undefined,
      mainAssigneeId: newMainAssigneeId || undefined,
      memberIds: [...newMemberIds]
    };
    onChange([...value, next]);
    setNewName('');
    setNewDeadline('');
    setNewMainAssigneeId('');
    setNewMemberIds([]);
  };

  const removeMission = (id: string) => {
    onChange(value.filter(m => m.id !== id));
  };

  const addMemberToDraft = (empId: string) => {
    if (!empId) return;
    if (newMemberIds.includes(empId)) return;
    setNewMemberIds([...newMemberIds, empId]);
  };

  const removeMemberFromDraft = (empId: string) => {
    setNewMemberIds(newMemberIds.filter(id => id !== empId));
  };

  const handleExport = () => {
    if (value.length === 0) {
      addToast({ title: '⚠️ Không có dữ liệu', message: 'Chưa cấu hình nhiệm vụ chi tiết nào để xuất Excel.', type: 'warning' });
      return;
    }
    const data = value.map((m, idx) => ({
      'STT': idx + 1,
      'Tên nhiệm vụ': m.name || '',
      'Hạn hoàn thành': formatDateForExcel(m.deadline),
      'Người phụ trách chính': empNameById(employees, m.mainAssigneeId),
      'Thành viên': (m.memberIds || []).map(id => empNameById(employees, id)).join(', '),
    }));
    try {
      const headers = ['STT', 'Tên nhiệm vụ', 'Hạn hoàn thành', 'Người phụ trách chính', 'Thành viên'];
      const ws = XLSX.utils.json_to_sheet(data, { header: headers });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'NhiemVuCauHinh');
      XLSX.writeFile(wb, `NhiemVuChiTiet_CauHinhTruoc_${Date.now()}.xlsx`);
      addToast({ title: '✅ Xuất Excel', message: `Đã xuất ${data.length} nhiệm vụ chi tiết (cấu hình trước).`, type: 'success' });
    } catch (err) {
      addToast({ title: '⛔ Lỗi', message: 'Không thể xuất file Excel.', type: 'error' });
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (rows.length === 0) {
          addToast({ title: '⚠️ Không có dữ liệu', message: 'File Excel không có dòng nào.', type: 'warning' });
          return;
        }
        const imported: SubTaskMissionTemplate[] = rows.map((r, idx) => {
          const name = String(r['Tên nhiệm vụ'] || '').trim();
          const deadlineRaw = String(r['Hạn hoàn thành'] || '').trim();
          let deadline: string | undefined;
          if (deadlineRaw) {
            const isoMatch = deadlineRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (isoMatch) {
              deadline = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
            } else {
              const parts = deadlineRaw.split(/[\/\s:]/).map(Number);
              if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
                const [day, month, year] = parts;
                deadline = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              }
            }
          }
          const memberNames = String(r['Thành viên'] || '').split(',').map(s => s.trim()).filter(Boolean);
          const memberIds = memberNames.map(n => empIdByName(employees, n)).filter((v): v is string => Boolean(v));
          const mainAssigneeId = empIdByName(employees, String(r['Người phụ trách chính'] || '').trim());
          return {
            id: `ms_cfg_${Date.now()}_${idx}`,
            name: name || `Nhiệm vụ ${idx + 1}`,
            deadline,
            mainAssigneeId,
            memberIds
          };
        }).filter(m => m.name && m.name.trim());

        if (imported.length === 0) {
          addToast({ title: '⚠️ Không có dữ liệu hợp lệ', message: 'Cần cột "Tên nhiệm vụ" trong file Excel.', type: 'warning' });
          return;
        }
        onChange([...value, ...imported]);
        addToast({ title: '✅ Nhập thành công', message: `Đã import ${imported.length} nhiệm vụ chi tiết (cấu hình trước).`, type: 'success' });
      } catch (err) {
        addToast({ title: '⛔ Lỗi', message: 'Không thể đọc file Excel. Vui lòng kiểm tra định dạng.', type: 'error' });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-amber-400 animate-pulse" />
          <div>
            <span className="font-extrabold text-slate-200 text-[11px] block text-left">
              NHIỆM VỤ CHI TIẾT (cấu hình trước)
            </span>
            <span className="text-[9.5px] text-slate-450 block text-left">
              Cấu hình trước các nhiệm vụ cần làm trong công việc con
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleExport}
            title="Xuất Excel danh sách nhiệm vụ cấu hình trước"
            className="flex items-center gap-1 bg-emerald-600/90 hover:bg-emerald-500 text-white text-[9px] font-bold px-2 py-1 rounded-lg cursor-pointer transition-colors"
          >
            <Download className="w-3 h-3" /> Export
          </button>
          <button
            type="button"
            onClick={() => excelInputRef.current?.click()}
            title="Nhập Excel danh sách nhiệm vụ cấu hình trước"
            className="flex items-center gap-1 bg-indigo-600/90 hover:bg-indigo-500 text-white text-[9px] font-bold px-2 py-1 rounded-lg cursor-pointer transition-colors"
          >
            <Upload className="w-3 h-3" /> Import
          </button>
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImport}
            className="hidden"
          />
        </div>
      </div>

      {/* Danh sách các mục đã cấu hình */}
      {value.length > 0 ? (
        <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
          {value.map((mission, idx) => (
            <div key={mission.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-lg text-slate-300 text-[9.5px]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[8px] font-bold bg-slate-800 text-slate-450 w-4 h-4 flex items-center justify-center rounded shrink-0">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <span className="block font-bold text-slate-200 truncate">{mission.name}</span>
                  <span className="flex items-center gap-1.5 text-[8.5px] text-slate-500 mt-0.5 flex-wrap">
                    {mission.deadline && (
                      <span className="bg-slate-800/80 px-1 py-px rounded font-mono">📅 {formatDateForExcel(mission.deadline)}</span>
                    )}
                    {mission.mainAssigneeId && (
                      <span className="bg-amber-950/40 text-amber-400 px-1 py-px rounded">
                        👑 {empNameById(employees, mission.mainAssigneeId)}
                      </span>
                    )}
                    {(mission.memberIds || []).length > 0 && (
                      <span className="bg-indigo-950/40 text-indigo-400 px-1 py-px rounded">
                        👷 {mission.memberIds!.map(id => empNameById(employees, id)).join(', ')}
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeMission(mission.id)}
                className="text-slate-500 hover:text-rose-400 p-1 hover:bg-rose-950/20 rounded cursor-pointer transition-all shrink-0"
                title="Xóa nhiệm vụ này"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-500 text-[10px]">
          Chưa có cấu hình nhiệm vụ chi tiết nào.
        </div>
      )}

      {/* Form thêm mới */}
      <div className="space-y-2 pt-1 border-t border-slate-800/60">
        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
          <Plus className="w-3 h-3 text-amber-400" /> Thêm nhiệm vụ mới:
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
              Tên nhiệm vụ <span className="text-rose-400">*</span>:
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMission(); } }}
              placeholder="VD: Kiểm tra mộng tủ dưới bếp, Cắt CNC hồi tủ áo..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-[10.5px] text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
              Hạn hoàn thành {defaultDeadlineHint ? '(mặc định: hạn việc con)' : ''}:
            </label>
            <input
              type="date"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              title={defaultDeadlineHint}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-[10.5px] text-slate-200 outline-none focus:border-indigo-500 transition-colors font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
              <User className="w-2.5 h-2.5 inline-block mr-0.5 text-amber-400" />
              Phụ trách chính:
            </label>
            <SearchableEmployeeSelect
              value={newMainAssigneeId}
              onChange={(val) => setNewMainAssigneeId(val || '')}
              employees={employees}
              placeholder="-- Chọn phụ trách chính --"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
              Nhân sự tham gia:
            </label>
            <div className="flex items-center gap-1.5 flex-wrap bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 min-h-[32px]">
              {newMemberIds.map(memId => (
                <span key={memId} className="inline-flex items-center gap-1 bg-indigo-950/50 text-indigo-300 text-[9px] font-bold px-1.5 py-0.5 rounded border border-indigo-900/50">
                  {empNameById(employees, memId)}
                  <button
                    type="button"
                    onClick={() => removeMemberFromDraft(memId)}
                    className="text-indigo-400 hover:text-rose-400 cursor-pointer"
                    title="Gỡ nhân sự"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              <div className="relative flex-1 min-w-[90px]">
                <select
                  value=""
                  onChange={(e) => { addMemberToDraft(e.target.value); }}
                  className="w-full bg-transparent text-[9.5px] text-slate-400 outline-none cursor-pointer appearance-none py-0.5"
                >
                  <option value="">+ Thêm thợ...</option>
                  {employees
                    .filter(emp => !newMemberIds.includes(emp.id))
                    .map(emp => (
                      <option key={emp.id} value={emp.id} className="bg-slate-950 text-slate-100">
                        {emp.name} ({emp.department || emp.role})
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={addMission}
          className="w-full bg-amber-600/90 hover:bg-amber-500 text-slate-950 text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
        >
          <Plus className="w-3 h-3" /> Thêm nhiệm vụ
        </button>
      </div>
    </div>
  );
}
