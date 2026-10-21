import React, { useState, useMemo } from 'react';
import { X, ClipboardList, Search } from 'lucide-react';
import type { Employee, ChatMessage, Task } from '../types';
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
  : tone === 'plain' ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-blue-600 text-white hover:bg-blue-500';

/** Thẻ trong tin nhắn. `entry` = trạng thái HIỆN TẠI của mục với người đang xem (không còn → đã xử lý / không phải việc của bạn). */
export function WorkCardView({ card, entry, onOpen }: { card: Card; entry?: WorkEntry; onOpen?: () => void }) {
  const isTask = card.kind === 'task';
  return (
    <div className="mt-1.5 border border-slate-200 bg-white rounded-xl px-3 py-2.5 min-w-[240px] max-w-full" data-testid="work-card">
      <small className={`block text-[9.5px] font-extrabold tracking-wider uppercase ${isTask ? 'text-blue-600' : 'text-amber-600'}`}>{card.chip || (isTask ? 'Công việc' : 'Đề xuất')}{!isTask && entry ? ' · chờ bạn xử lý' : ''}</small>
      <b className="block text-[13.5px] mt-0.5 break-words">{card.title}</b>
      {card.sub && <span className="block text-[12px] text-slate-500 mt-0.5 break-words">{card.sub}</span>}
      {card.amount ? <b className="block text-[15px] text-rose-600 mt-0.5">{money(card.amount)}</b> : null}
      {!entry && !isTask && <span className="block text-[11.5px] text-slate-500 mt-1" data-testid="work-card-done">Không còn chờ bạn xử lý (đã xử lý hoặc không thuộc quyền của bạn)</span>}
      <div className="flex gap-1.5 justify-end flex-wrap mt-2">
        {entry && entry.actions.map(a => <button key={a.label} type="button" onClick={a.onClick} className={`px-3 py-1 rounded-lg text-[12px] font-bold cursor-pointer ${btn(a.tone)}`}>{a.label}</button>)}
        {isTask && !entry && onOpen && <button type="button" onClick={onOpen} className="px-3 py-1 rounded-lg text-[12px] font-bold cursor-pointer bg-slate-100 text-slate-700 hover:bg-slate-200">Mở công việc</button>}
      </div>
    </div>
  );
}

/** Hộp thoại chọn việc/đề xuất của tôi để gửi vào hội thoại. */
export function SendWorkDialog({ entries, onPick, onClose }: { entries: WorkEntry[]; onPick: (e: WorkEntry) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => entries.filter(e => !q.trim() || `${e.title} ${e.meta}`.toLowerCase().includes(q.trim().toLowerCase())), [entries, q]);
  return (
    <div className="absolute inset-0 z-50 bg-black/40 grid place-items-center p-4" role="dialog" aria-label="Gửi việc vào hội thoại" data-testid="work-send-dialog">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[80%] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200"><b className="text-[15px]">Gửi việc vào hội thoại</b><button type="button" onClick={onClose} aria-label="Đóng" className="cursor-pointer"><X className="w-5 h-5" /></button></div>
        <label className="flex items-center gap-2 bg-slate-100 rounded-lg mx-3 mt-3 px-2.5 py-2 text-[13px] text-slate-500"><Search className="w-4 h-4" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm việc, đề xuất…" className="bg-transparent outline-none w-full text-slate-900" /></label>
        <div className="overflow-y-auto flex-1 py-1 mt-1">
          {shown.length === 0 && <p className="text-center text-[13px] text-slate-500 py-8">Không có việc nào để gửi.</p>}
          {shown.map(e => (
            <button key={e.key} type="button" data-testid="work-send-item" onClick={() => onPick(e)} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-3 cursor-pointer">
              <ClipboardList className="w-5 h-5 text-blue-500 shrink-0" />
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
  onCreate: (v: { name: string; assigneeId: string; deadline: string; projectId?: string }) => void; onClose: () => void;
}) {
  const [name, setName] = useState(initialName.replace(/\s+/g, ' ').trim().slice(0, 150));
  const [assignee, setAssignee] = useState(defaultAssigneeId || me);
  const [deadline, setDeadline] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 3); return ymd(d); });
  const [project, setProject] = useState(defaultProjectId || '');
  const people = employees.filter(e => (e as any).hasSystemAccount !== false);
  const ok = name.trim() && assignee && deadline;
  return (
    <div className="absolute inset-0 z-50 bg-black/40 grid place-items-center p-4" role="dialog" aria-label="Tạo công việc từ tin nhắn" data-testid="work-create-dialog">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200"><b className="text-[15px]">Tạo công việc từ tin nhắn</b><button type="button" onClick={onClose} aria-label="Đóng" className="cursor-pointer"><X className="w-5 h-5" /></button></div>
        <div className="p-4 space-y-3 text-[13px]">
          <label className="block"><span className="font-bold text-slate-600">Tên công việc</span><textarea value={name} onChange={e => setName(e.target.value)} rows={2} data-testid="work-create-name" className="mt-1 w-full border border-slate-300 rounded-lg px-2.5 py-2 outline-none focus:border-blue-500" /></label>
          <label className="block"><span className="font-bold text-slate-600">Giao cho</span><select value={assignee} onChange={e => setAssignee(e.target.value)} data-testid="work-create-assignee" className="mt-1 w-full border border-slate-300 rounded-lg px-2.5 py-2 bg-white">{people.map(e => <option key={e.id} value={e.id}>{e.name}{e.id === me ? ' (tôi)' : ''}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="font-bold text-slate-600">Hạn hoàn thành</span><input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} data-testid="work-create-deadline" className="mt-1 w-full border border-slate-300 rounded-lg px-2.5 py-2" /></label>
            <label className="block"><span className="font-bold text-slate-600">Công trình</span><select value={project} onChange={e => setProject(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-2.5 py-2 bg-white"><option value="">Nhiệm vụ nội bộ</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-200">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 font-bold text-[13px] cursor-pointer">Hủy</button>
          <button type="button" disabled={!ok} onClick={() => onCreate({ name: name.trim(), assigneeId: assignee, deadline, projectId: project || undefined })} data-testid="work-create-submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold text-[13px] cursor-pointer disabled:opacity-40">Tạo & gửi vào hội thoại</button>
        </div>
      </div>
    </div>
  );
}

export type NewTaskInput = { name: string; assigneeId: string; deadline: string; projectId?: string };
export type { Task };
