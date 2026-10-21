import React, { useMemo, useState } from 'react';
import { LayoutList, MessageSquareText } from 'lucide-react';
import type { Employee, Task } from '../types';
import type { MyWorkItem } from '../lib/myWork';
import type { InboxItem } from './MyWorkOverview';
import MessagesView from './MessagesView';
import MessagesZalo from './MessagesZalo';
import { companyScopedKey } from '../lib/supabase';
import { uiKey, readMessagesUi, writeMessagesUi, type MessagesUi } from '../lib/chatPrefs';

// Cổng vào menu Tin nhắn: chọn KIỂU MỚI (kiểu Zalo, mặc định) hoặc KIỂU CŨ; lựa chọn được nhớ trong trình duyệt theo từng người dùng.
interface Props {
  currentUser: Employee; employees: Employee[]; onNavigateTab?: (tab: string) => void; tasks?: Task[]; onUpdateTask?: (taskId: string, updates: any) => void;
  workItems?: MyWorkItem[]; workInbox?: InboxItem[]; onReceiveWork?: (it: MyWorkItem) => void; onOpenWorkTask?: (taskId: string) => void;
  onCreateTask?: (t: Task) => Promise<void> | void; projects?: { id: string; name: string; pmId?: string }[];
  initialConversationId?: string; showBadgeCounts?: boolean; onToggleBadgeCounts?: (next: boolean) => void;
}

export default function MessagesHost(props: Props) {
  const key = useMemo(() => companyScopedKey(uiKey(props.currentUser?.id)), [props.currentUser?.id]);
  const [ui, setUi] = useState<MessagesUi>(() => readMessagesUi(key));
  const choose = (v: MessagesUi) => { setUi(v); writeMessagesUi(key, v); };
  const btn = (v: MessagesUi, label: string, icon: React.ReactNode) => (
    <button type="button" onClick={() => choose(v)} aria-pressed={ui === v}
      className={`relative z-10 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full text-[12px] font-bold cursor-pointer transition-colors ${ui === v ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>{icon}{label}</button>
  );
  const switcher = (
    <div className="relative inline-grid grid-cols-2 p-1 rounded-full bg-slate-100 border border-slate-200" role="group" aria-label="Kiểu giao diện Tin nhắn" data-testid="messages-ui-switch">
      <span aria-hidden className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-md ring-1 ring-slate-200 transition-transform duration-200 ease-out ${ui === 'classic' ? 'translate-x-full' : 'translate-x-0'}`} />
      {btn('new', 'Kiểu mới', <MessageSquareText className="w-4 h-4" />)}
      {btn('classic', 'Kiểu cũ', <LayoutList className="w-4 h-4" />)}
    </div>
  );
  // Kiểu mới: chiếm TRỌN vùng nội dung như Zalo (công tắc nằm gọn đầu cột danh sách). Kiểu cũ giữ bố cục có lề như trước.
  return (
    <div className="h-full min-h-0" data-testid="messages-host">
      {ui === 'new'
        ? <MessagesZalo {...props} headerExtra={<div className="px-3 pt-2 flex justify-end">{switcher}</div>} />
        : <div className="p-3 space-y-2 h-full overflow-y-auto"><div className="flex justify-end">{switcher}</div><MessagesView {...props} /></div>}
    </div>
  );
}
