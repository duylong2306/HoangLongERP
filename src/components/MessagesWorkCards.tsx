import { useState, useMemo } from 'react';
import { X, ClipboardList, Search, ChevronDown } from 'lucide-react';
import type { Employee, ChatMessage, Task, SubTaskMission, TaskPriority } from '../types';
import type { WorkEntry } from '../lib/workEntries';

// Thẻ VIỆC / ĐỀ XUẤT trong khung chat + hộp thoại "Gửi việc vào hội thoại" + "Tạo công việc từ tin nhắn".

type Card = NonNullable<NonNullable<ChatMessage['relatedEntity']>['card']>;
const money = (n?: number) => `${Math.round(n || 0).toLocaleString('vi-VN')} đ`;

/** Loại thực thể (relatedEntity.type) suy từ khóa mục của "Việc của tôi". */
export function entityOfKey(key: string, taskId?: string): { type: NonNullable<ChatMessage['relatedEntity']>['type']; id: string } {
  if (key.startsWith('task:')) return { type: 'task', id: key.slice(5) };
  if (key.startsWith('mis:')) { const [, t, m] = key.split(':'); return { type: 'mission', id: m || t }; }
  const k = key.replace(/^ap:/, '');
  const [pre, ...rest] = k.split(':'); const id = rest.join(':');
  return { type: pre === 'pm' ? 'payment' : pre === 'lv' ? 'leave' : pre === 'tr' ? 'travel_expense' : pre === 'mp' || pre === 'mc' ? 'material' : pre === 'rv' ? 'task' : 'advance', id: id || taskId || key };
}

/** Dữ liệu thẻ từ 1 mục Việc của tôi. */
export function cardOfEntry(e: WorkEntry): { card: Card; entity: { type: NonNullable<ChatMessage['relatedEntity']>['type']; id: string } } {
  return {
    card: { kind: e.kind === 'approval' ? 'approval' : 'task', key: e.key, title: e.title, sub: e.meta, amount: e.amount, chip: e.chip },
    entity: entityOfKey(e.key),
  };
}

const btn = (tone: string) => tone === 'ok' ? 'bg-emerald-600 text-white hover:bg-emerald-500' : tone === 'no' ? 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50'
  : tone === 'plain' ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-[#0d47c9] text-white hover:bg-[#0a3aa8]';

/** Thẻ trong tin nhắn. `entry` = trạng thái HIỆN TẠI của mục với người đang xem (không còn → đã xử lý / không phải việc của bạn). */
/** Nhãn + màu trạng thái 1 nhiệm vụ (Task.missions[].status). Hoàn thành cần báo cáo/bằng chứng nên chỉ làm ở màn hình công việc — thẻ chat chỉ HIỂN THỊ. */
const MISSION_STATUS: Record<SubTaskMission['status'], { label: string; cls: string }> = {
  todo: { label: 'Chưa làm', cls: 'bg-slate-100 text-slate-600' },
  doing: { label: 'Đang làm', cls: 'bg-[#e8efff] text-[#0d47c9]' },
  completed: { label: 'Hoàn thành', cls: 'bg-emerald-100 text-emerald-700' },
};
const initials = (name?: string) => (name || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
const dmy = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');

export type NewMissionInput = { name: string; assigneeId: string; deadline: string };

/** Khối "Nhiệm vụ" của thẻ công việc: tiến độ x/y, danh sách nhiệm vụ (người phụ trách, hạn, trạng thái) và ô thêm nhiệm vụ nhanh. */
function MissionBlock({ task, employees, onAdd }: { task: Task; employees: Employee[]; onAdd?: (v: NewMissionInput) => Promise<boolean | void> | boolean | void }) {
  const missions = task.missions || [];
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [who, setWho] = useState(task.assigneeId || '');
  // Hạn nhiệm vụ mặc định = hạn công việc (nhiệm vụ không được trễ hơn công việc cha)
  const [due, setDue] = useState((task.deadline || '').slice(0, 10));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const done = missions.filter(m => m.status === 'completed').length;
  const pct = missions.length ? Math.round((done * 100) / missions.length) : 0;
  const nameOf = (id?: string) => employees.find(e => e.id === id)?.name;
  const people = employees.filter(e => (e as any).hasSystemAccount !== false);
  if (missions.length === 0 && !onAdd) return null;

  const submit = async () => {
    if (!name.trim()) { setErr('Nhập tên nhiệm vụ'); return; }
    if (!who) { setErr('Chọn người phụ trách'); return; }
    // Cùng quy tắc form "Tạo nhiệm vụ" trong chi tiết công việc: hạn nhiệm vụ không quá hạn công việc cha (so theo NGÀY)
    if (due && task.deadline && due > task.deadline.slice(0, 10) && new Date(`${task.deadline.slice(0, 10)}T23:59:59`).getTime() >= Date.now()) {
      setErr('Hạn nhiệm vụ không được sau hạn của công việc'); return;
    }
    setBusy(true);
    try {
      const r = await onAdd?.({ name: name.trim(), assigneeId: who, deadline: due });
      if (r === false) { setErr('Không lưu được. Kiểm tra kết nối và thử lại.'); return; }
      setName(''); setErr(''); setAdding(false);
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-2 border-t border-slate-100 pt-2" data-testid="mission-block">
      <button type="button" onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2 text-left cursor-pointer" aria-expanded={open}>
        <span className="text-[12px] font-bold text-slate-700">Nhiệm vụ</span>
        <span className="text-[11.5px] text-slate-500" data-testid="mission-count">{done}/{missions.length} · {pct}%</span>
        <span className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden"><i className="block h-full bg-[#0d47c9]" style={{ width: `${pct}%` }} /></span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="mt-1">
          {missions.map(m => {
            const st = MISSION_STATUS[m.status] || MISSION_STATUS.todo;
            const owner = nameOf(m.mainAssigneeId);
            return (
              <div key={m.id} className="flex items-center gap-2 py-1.5 border-t border-slate-100 first:border-t-0" data-testid="mission-row">
                <span className={`flex-1 min-w-0 text-[12.5px] break-words ${m.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{m.name}</span>
                <span className="w-6 h-6 rounded-full bg-[#e8efff] text-[#0d47c9] text-[9.5px] font-bold grid place-items-center shrink-0" title={owner || 'Chưa có người phụ trách'}>{initials(owner)}</span>
                <span className="text-[11px] text-slate-500 shrink-0">{dmy(m.deadline)}</span>
                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
              </div>
            );
          })}
          {onAdd && !adding && <button type="button" onClick={() => setAdding(true)} data-testid="mission-add-open" className="mt-1 text-[12px] font-bold text-[#0d47c9] hover:text-[#0d47c9] cursor-pointer">+ Thêm nhiệm vụ</button>}
          {onAdd && adding && (
            <div className="mt-1.5 flex flex-wrap gap-1.5 items-center" data-testid="mission-add-form">
              <input value={name} onChange={e => { setName(e.target.value); setErr(''); }} placeholder="Tên nhiệm vụ" aria-label="Tên nhiệm vụ" data-testid="mission-add-name" className="flex-[2] min-w-[130px] h-8 border border-slate-300 rounded-xl px-2.5 text-[12.5px] outline-none focus:border-[#0d47c9]" />
              <select value={who} onChange={e => setWho(e.target.value)} aria-label="Người phụ trách" data-testid="mission-add-who" className="flex-1 min-w-[110px] h-8 border border-slate-300 rounded-xl px-2 text-[12.5px] bg-white">{people.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
              <input type="date" value={due} onChange={e => { setDue(e.target.value); setErr(''); }} aria-label="Hạn nhiệm vụ" data-testid="mission-add-due" className="flex-1 min-w-[120px] h-8 border border-slate-300 rounded-xl px-2 text-[12.5px]" />
              <button type="button" disabled={busy} onClick={submit} data-testid="mission-add-submit" className="h-8 px-3 rounded-xl bg-[#0d47c9] hover:bg-[#0a3aa8] text-[12.5px] font-bold cursor-pointer disabled:opacity-50" style={{ color: '#ffffff' }}>Thêm</button>
              <button type="button" onClick={() => { setAdding(false); setErr(''); }} className="h-8 px-3 rounded-xl border border-slate-300 text-[12.5px] font-bold text-slate-600 cursor-pointer">Hủy</button>
              {err && <p className="w-full text-[11.5px] text-rose-600" data-testid="mission-add-err">{err}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WorkCardView({ card, entry, onOpen, task, employees = [], onAddMission }: {
  card: Card; entry?: WorkEntry; onOpen?: () => void;
  /** Công việc THẬT (trạng thái hiện tại) — có thì thẻ hiện danh sách nhiệm vụ bên trong */
  task?: Task; employees?: Employee[];
  /** Có thì hiện nút "Thêm nhiệm vụ" (nơi gọi đã kiểm tra quyền) */
  onAddMission?: (v: NewMissionInput) => Promise<boolean | void> | boolean | void;
}) {
  const isTask = card.kind === 'task';
  return (
    <div className="mt-1.5 border border-slate-200 bg-white rounded-xl px-3 py-2.5 min-w-[240px] max-w-full" data-testid="work-card">
      <small className={`block text-[9.5px] font-extrabold ${isTask ? 'text-[#0d47c9]' : 'text-amber-600'}`}>{card.chip || (isTask ? 'Công việc' : 'Đề xuất')}{!isTask && entry ? ' · chờ bạn xử lý' : ''}</small>
      <b className="block text-[13.5px] mt-0.5 break-words">{card.title}</b>
      {card.sub && <span className="block text-[12px] text-slate-500 mt-0.5 break-words">{card.sub}</span>}
      {card.amount ? <b className="block text-[15px] text-rose-600 mt-0.5">{money(card.amount)}</b> : null}
      {!entry && !isTask && <span className="block text-[11.5px] text-slate-500 mt-1" data-testid="work-card-done">Không còn chờ bạn xử lý (đã xử lý hoặc không thuộc quyền của bạn)</span>}
      {isTask && task && <MissionBlock task={task} employees={employees} onAdd={onAddMission} />}
      <div className="flex gap-1.5 justify-end flex-wrap mt-2">
        {entry && entry.actions.map(a => <button key={a.label} type="button" onClick={a.onClick} className={`h-8 px-3 rounded-xl text-[12px] font-bold cursor-pointer ${btn(a.tone)}`}>{a.label}</button>)}
        {isTask && !entry && onOpen && <button type="button" onClick={onOpen} className="h-8 px-3 rounded-xl text-[12px] font-bold cursor-pointer bg-slate-100 text-slate-700 hover:bg-slate-200">Mở công việc</button>}
      </div>
    </div>
  );
}

/** Hộp thoại chọn việc/đề xuất của tôi để gửi vào hội thoại. */
export function SendWorkDialog({ entries, onPick, onClose }: { entries: WorkEntry[]; onPick: (e: WorkEntry) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => entries.filter(e => !q.trim() || `${e.title} ${e.meta}`.toLowerCase().includes(q.trim().toLowerCase())), [entries, q]);
  return (
    <div className="absolute inset-0 z-50 bg-black/50 grid place-items-center p-4" role="dialog" aria-label="Gửi việc vào hội thoại" data-testid="work-send-dialog">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md max-h-[80%] flex flex-col shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200"><b className="font-extrabold text-[14px] text-slate-800">Gửi việc vào hội thoại</b><button type="button" onClick={onClose} aria-label="Đóng" className="w-8 h-8 grid place-items-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5" /></button></div>
        <label className="flex items-center gap-2 bg-white border border-slate-300 focus-within:border-[#0d47c9] rounded-xl mx-3 mt-3 px-2.5 h-9 text-[13px] text-slate-500"><Search className="w-4 h-4" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm việc, đề xuất…" className="bg-transparent outline-none w-full text-slate-900" /></label>
        <div className="overflow-y-auto flex-1 py-1 mt-1">
          {shown.length === 0 && <p className="text-center text-[13px] text-slate-500 py-8">Không có việc nào để gửi.</p>}
          {shown.map(e => (
            <button key={e.key} type="button" data-testid="work-send-item" onClick={() => onPick(e)} className="w-[calc(100%-1rem)] mx-2 text-left px-3 py-2 rounded-xl hover:bg-[#e8efff] flex items-center gap-3 cursor-pointer">
              <ClipboardList className="w-5 h-5 text-[#0d47c9] shrink-0" />
              <span className="min-w-0"><b className="block text-[13.5px] truncate">{e.title}</b><span className="block text-[12px] text-slate-500 truncate">{e.chip} · {e.meta}</span></span>
            </button>))}
        </div>
      </div>
    </div>
  );
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Hộp thoại tạo công việc từ nội dung 1 tin nhắn. Tạo xong: App lưu + gửi thẻ việc vào hội thoại. */
export function CreateTaskDialog({ initialName, employees, me, projects, defaultAssigneeId, defaultProjectId, onCreate, onClose }: {
  initialName: string; employees: Employee[]; me: string; projects: { id: string; name: string }[]; defaultAssigneeId?: string; defaultProjectId?: string;
  onCreate: (v: NewTaskInput) => void; onClose: () => void;
}) {
  const [name, setName] = useState(initialName.replace(/\s+/g, ' ').trim().slice(0, 150));
  const [assignee, setAssignee] = useState(defaultAssigneeId || me);
  const [deadline, setDeadline] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 3); return ymd(d); });
  const [project, setProject] = useState(defaultProjectId || '');
  // Mức ưu tiên + ghi chú (tùy chọn) — ghi thẳng vào công việc được tạo
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [note, setNote] = useState('');
  const people = employees.filter(e => (e as any).hasSystemAccount !== false);
  const ok = name.trim() && assignee && deadline;
  return (
    <div className="absolute inset-0 z-50 bg-black/50 grid place-items-center p-4" role="dialog" aria-label="Tạo công việc từ tin nhắn" data-testid="work-create-dialog">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200"><b className="font-extrabold text-[14px] text-slate-800">Tạo công việc từ tin nhắn</b><button type="button" onClick={onClose} aria-label="Đóng" className="w-8 h-8 grid place-items-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5" /></button></div>
        <div className="p-4 space-y-3 text-[13px]">
          <label className="block"><span className="font-bold text-slate-600">Tên công việc</span><textarea value={name} onChange={e => setName(e.target.value)} rows={2} data-testid="work-create-name" className="mt-1 w-full border border-slate-300 rounded-xl px-2.5 py-2 outline-none focus:border-[#0d47c9]" /></label>
          <label className="block"><span className="font-bold text-slate-600">Giao cho</span><select value={assignee} onChange={e => setAssignee(e.target.value)} data-testid="work-create-assignee" className="mt-1 w-full border border-slate-300 rounded-xl px-2.5 h-9 bg-white">{people.map(e => <option key={e.id} value={e.id}>{e.name}{e.id === me ? ' (tôi)' : ''}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="font-bold text-slate-600">Hạn hoàn thành</span><input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} data-testid="work-create-deadline" className="mt-1 w-full border border-slate-300 rounded-xl px-2.5 h-9" /></label>
            <label className="block"><span className="font-bold text-slate-600">Dự án</span><select value={project} onChange={e => setProject(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-xl px-2.5 h-9 bg-white"><option value="">Nhiệm vụ nội bộ</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          </div>
          <div>
            <span className="font-bold text-slate-600">Mức ưu tiên</span>
            <div className="mt-1 grid grid-cols-3 gap-1.5" role="group" aria-label="Mức ưu tiên">
              {([['low', 'Thấp'], ['medium', 'Trung bình'], ['high', 'Cao']] as [TaskPriority, string][]).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setPriority(v)} data-testid={`work-create-priority-${v}`} aria-pressed={priority === v}
                  className={`py-1.5 rounded-xl border text-[12.5px] font-bold cursor-pointer ${priority === v ? 'bg-[#e8efff] border-[#0d47c9] text-[#0d47c9]' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>{l}</button>
              ))}
            </div>
          </div>
          <label className="block"><span className="font-bold text-slate-600">Ghi chú</span><input value={note} onChange={e => setNote(e.target.value)} placeholder="Yêu cầu thêm nếu có" data-testid="work-create-note" className="mt-1 w-full border border-slate-300 rounded-xl px-2.5 h-9 outline-none focus:border-[#0d47c9]" /></label>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-200">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-[13px] cursor-pointer">Hủy</button>
          <button type="button" disabled={!ok} onClick={() => onCreate({ name: name.trim(), assigneeId: assignee, deadline, projectId: project || undefined, priority, note: note.trim() || undefined })} data-testid="work-create-submit" style={{ color: '#ffffff' }} className="h-9 px-4 rounded-xl bg-[#0d47c9] hover:bg-[#0a3aa8] font-bold text-[13px] cursor-pointer disabled:opacity-40">Tạo & gửi vào hội thoại</button>
        </div>
      </div>
    </div>
  );
}

export type NewTaskInput = { name: string; assigneeId: string; deadline: string; projectId?: string; priority?: TaskPriority; note?: string };
export type { Task };
