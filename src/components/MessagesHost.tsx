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
  return (
    <div className="space-y-2" data-testid="messages-host">
      <div className="flex justify-end">
        <div className="relative inline-grid grid-cols-2 p-1 rounded-full bg-slate-100 border border-slate-200" role="group" aria-label="Kiểu giao diện Tin nhắn" data-testid="messages-ui-switch">
          <span aria-hidden className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-md ring-1 ring-slate-200 transition-transform duration-200 ease-out ${ui === 'classic' ? 'translate-x-full' : 'translate-x-0'}`} />
          {btn('new', 'Kiểu mới', <MessageSquareText className="w-4 h-4" />)}
          {btn('classic', 'Kiểu cũ', <LayoutList className="w-4 h-4" />)}
        </div>
      </div>
      {ui === 'new' ? <MessagesZalo {...props} /> : <MessagesView {...props} />}
    </div>
  );
}
