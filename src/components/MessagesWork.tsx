import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ChevronLeft, Send, MessageSquare, CheckCircle2 } from 'lucide-react';
import type { Employee, ChatMessage } from '../types';
import { ensureWorkThread, getMessages, addMessage, markConversationRead, markMessagesReadByUser, loadMessagesFromCloud, subscribeMessages } from '../lib/chatStore';
import { workThreadId } from '../lib/workThread';
import { SECTION_LABEL, SECTION_ORDER, type WorkEntry, type WorkSection } from '../lib/workEntries';
import { diffDays } from '../lib/executiveDashboard';
import UserAvatar from './UserAvatar';

// TAB "VIỆC CỦA TÔI" TRONG TIN NHẮN (kiểu Zalo): danh sách việc/đề xuất chờ xử lý + chi tiết có LUỒNG THẢO LUẬN riêng cho từng mục.
// Dữ liệu và hành động (Nhận việc, Mở chi tiết, Duyệt…) do App truyền xuống — dùng đúng quy tắc quyền của menu "Việc của tôi".

const TONE: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-700', orange: 'bg-orange-100 text-orange-700', violet: 'bg-violet-100 text-violet-700',
  sky: 'bg-sky-100 text-sky-700', rose: 'bg-rose-100 text-rose-700', emerald: 'bg-emerald-100 text-emerald-700', slate: 'bg-slate-100 text-slate-600',
};
const money = (n?: number) => `${Math.round(n || 0).toLocaleString('vi-VN')} đ`;
const dm = (s: string) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '—');
const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/** Nhãn hạn: Trễ n ngày / Hôm nay / Ngày mai / Còn n ngày — kèm màu theo mức khẩn. */
export function DueChip({ due, today }: { due: string; today: string }) {
  if (!due) return null;
  const d = diffDays(today, due);
  const [txt, cls] = d < 0 ? [`Trễ ${-d} ngày`, 'bg-rose-100 text-rose-700'] : d === 0 ? ['Hôm nay', 'bg-amber-100 text-amber-700']
    : d <= 2 ? [d === 1 ? 'Ngày mai' : `Còn ${d} ngày`, 'bg-sky-100 text-sky-700'] : [`Còn ${d} ngày · ${dm(due)}`, 'bg-slate-100 text-slate-500'];
  return <span className={`text-[10.5px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`} data-testid="work-due">{txt}</span>;
}

function Ring({ pct }: { pct: number }) {
  return <span className="relative inline-grid place-items-center w-11 h-11 rounded-full shrink-0" style={{ background: `conic-gradient(#059669 ${pct * 3.6}deg,#e2e8f0 0)` }}><span className="absolute inset-[5px] bg-white rounded-full" /><b className="relative text-[11px]">{pct}%</b></span>;
}

const btnCls = (tone: string) => tone === 'ok' ? 'bg-emerald-600 text-white hover:bg-emerald-500' : tone === 'no' ? 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50'
  : tone === 'plain' ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-blue-600 text-white hover:bg-blue-500';

// ─── Danh sách (cột trái) ───
export function WorkList({ entries, selectedKey, onSelect, unreadKeys, today, query }: {
  entries: WorkEntry[]; selectedKey: string | null; onSelect: (key: string) => void; unreadKeys: Set<string>; today: string; query: string;
}) {
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => entries.filter(e => !q || `${e.title} ${e.meta}`.toLowerCase().includes(q)), [entries, q]);
  const bySection = (s: WorkSection) => shown.filter(e => e.section === s);
  if (entries.length === 0) return <div className="p-8 text-center text-[13px] text-slate-500" data-testid="work-empty"><CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2" />Bạn không có việc hay đề xuất nào đang chờ. 🎉</div>;
  return (
    <div data-testid="work-list">
      {SECTION_ORDER.map(s => {
        const rows = bySection(s); if (rows.length === 0) return null;
        return (
          <div key={s} data-testid={`work-section-${s}`}>
            <div className="px-3.5 pt-2.5 pb-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5">{SECTION_LABEL[s]}<span className="bg-slate-200/70 rounded-full px-1.5 text-[10.5px]">{rows.length}</span></div>
            {rows.map(e => (
              <button key={e.key} type="button" data-testid="work-row" data-work={e.key} onClick={() => onSelect(e.key)}
                className={`w-full text-left grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-3.5 py-2.5 items-center cursor-pointer ${selectedKey === e.key ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                <span className={`w-12 h-12 rounded-2xl grid place-items-center px-0.5 text-[9.5px] font-black text-center leading-[1.1] break-words ${TONE[e.chipTone] || TONE.slate}`}>{e.chip}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2"><b className="text-[14px] font-semibold truncate" title={e.title}>{e.title}</b>{unreadKeys.has(e.key) && <i className="ml-auto w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" data-testid="work-unread" aria-label="Có thảo luận mới" />}</span>
                  <span className="flex items-center justify-between gap-2 mt-0.5"><span className="text-[12.5px] text-slate-500 truncate">{e.meta}</span>{e.amount ? <b className="text-[12px] text-rose-600 whitespace-nowrap">{money(e.amount)}</b> : e.right ? <b className="text-[11px] text-slate-500 whitespace-nowrap">{e.right}</b> : <DueChip due={e.due} today={today} />}</span>
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── Chi tiết + luồng thảo luận (khung giữa) ───
export function WorkDetail({ entry, me, meName, employees, today, onBack }: {
  entry: WorkEntry; me: string; meName: string; employees: Employee[]; today: string; onBack: () => void;
}) {
  const convId = workThreadId(entry.key);
  const [msgs, setMsgs] = useState<ChatMessage[]>(() => getMessages(convId));
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const memberKey = entry.memberIds.join(',');

  // Mở mục → bảo đảm luồng tồn tại (thêm thành viên còn thiếu), tải tin, đăng ký realtime, đánh dấu đã đọc.
  useEffect(() => {
    let alive = true;
    setMsgs(getMessages(convId));
    const refresh = (m?: ChatMessage[]) => { if (!alive) return; setMsgs(m || getMessages(convId)); markConversationRead(convId, me); markMessagesReadByUser(convId, me); };
    (async () => {
      await ensureWorkThread({ key: entry.key, title: entry.title, memberIds: entry.memberIds, createdBy: me });
      if (!alive) return;
      await loadMessagesFromCloud(convId); refresh();
    })();
    const unsub = subscribeMessages(convId, m => refresh(m));
    return () => { alive = false; unsub(); };
  }, [convId, memberKey]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { endRef.current?.scrollIntoView?.({ behavior: 'smooth' }); }, [msgs.length, convId]);

  const send = useCallback(async () => {
    const content = text.trim(); if (!content || sending) return;
    setSending(true);
    try {
      // Luồng có thể chưa kịp tạo (mạng chậm) → bảo đảm trước khi gửi
      await ensureWorkThread({ key: entry.key, title: entry.title, memberIds: entry.memberIds, createdBy: me });
      await addMessage({ conversationId: convId, senderId: me, senderName: meName, content, system: false } as any);
      setText(''); setMsgs(getMessages(convId));
    } finally { setSending(false); }
  }, [text, sending, entry, convId, me, meName]);

  const emp = (id: string) => employees.find(e => e.id === id) || null;
  const names = entry.memberIds.map(id => emp(id)?.name).filter(Boolean) as string[];

  return (
    <div className="flex flex-col min-h-0 h-full" data-testid="work-detail">
      <header className="bg-white px-4 pt-3 pb-2 border-b border-slate-200">
        <div className="flex items-start gap-3">
          <button type="button" onClick={onBack} className="lg:hidden p-1 -ml-1 mt-0.5 text-slate-700 cursor-pointer" aria-label="Quay lại danh sách"><ChevronLeft className="w-6 h-6" /></button>
          <div className="min-w-0 flex-1">
            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wide ${TONE[entry.chipTone] || TONE.slate}`}>{entry.chip}</span>
            <h2 className="text-[17px] font-extrabold tracking-tight mt-1 leading-snug" data-testid="work-title">{entry.title}</h2>
            <div className="text-[12.5px] text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">{entry.meta}<DueChip due={entry.due} today={today} /></div>
          </div>
          {entry.amount ? <b className="text-[19px] text-rose-600 whitespace-nowrap">{money(entry.amount)}</b> : entry.rate !== null ? <Ring pct={entry.rate} /> : null}
        </div>
        <div className="flex gap-2 flex-wrap mt-2.5" data-testid="work-actions">
          {entry.actions.map(a => <button key={a.label} type="button" onClick={a.onClick} className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-bold cursor-pointer ${btnCls(a.tone)}`}>{a.label}</button>)}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-5 py-3 bg-gradient-to-br from-[#dbe3d3] via-[#c9d6df] to-[#d5d9ea]" data-testid="work-thread">
        <p className="text-center text-[11.5px] text-slate-600 mb-2 inline-flex w-full justify-center items-center gap-1"><MessageSquare className="w-3.5 h-3.5" />Thảo luận về mục này{names.length > 0 ? ` · ${names.join(', ')}` : ''}</p>
        {msgs.length === 0 && <p className="text-center text-[12.5px] text-slate-600 bg-white/60 rounded-xl py-3 px-4 mx-auto max-w-sm" data-testid="work-thread-empty">Chưa có trao đổi nào. Nhắn để hỏi nhanh hoặc báo tiến độ — chỉ những người liên quan đến mục này thấy.</p>}
        {msgs.filter(m => !m.deleted).map(m => {
          const mine = m.senderId === me;
          return (
            <div key={m.id} data-testid="work-msg" className={`flex gap-2 items-end mt-1.5 ${mine ? 'justify-end' : ''}`}>
              {!mine && <UserAvatar employee={emp(m.senderId)} name={m.senderName} size="sm" noRing />}
              <div className="max-w-[78%]">
                {!mine && <div className="text-[11.5px] text-slate-600 ml-1 mb-0.5">{m.senderName}</div>}
                <div className={`rounded-xl px-3 py-2 text-[13.5px] shadow-sm whitespace-pre-wrap break-words ${mine ? 'bg-[#d6e6ff]' : 'bg-white'}`}>{m.content}<div className="text-[10.5px] text-slate-500 mt-0.5">{hhmm(m.createdAt)}</div></div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <footer className="bg-white border-t border-slate-200 flex items-center gap-2 px-3 py-2.5" data-testid="work-composer">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Trao đổi về mục này…" aria-label="Nhập tin nhắn thảo luận" className="flex-1 outline-none text-[14px] px-2 py-2" data-testid="work-input" />
        <button type="button" onClick={send} disabled={!text.trim() || sending} aria-label="Gửi" className="p-2 rounded-lg text-blue-600 disabled:text-slate-300 cursor-pointer" data-testid="work-send"><Send className="w-5 h-5" /></button>
      </footer>
    </div>
  );
}
