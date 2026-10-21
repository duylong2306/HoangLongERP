import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, UserPlus, Users, X, Pin, BellOff, Bell, Send, Paperclip, Image as ImageIcon, Smile, ChevronLeft, PanelRight, MoreHorizontal, CornerUpLeft, Forward, ThumbsUp, Check, CheckCheck, Download, Trash2, ClipboardList, ChevronDown, Edit3, Copy, Loader2, MessageSquare } from 'lucide-react';
import type { Employee, Task, Conversation, ChatMessage, ChatAttachment } from '../types';
import { useNotification, isRoleAdmin } from '../context';
import {
  getConversations, getMessages, addMessage, getOrCreatePersonalConversation, createGroupConversation, deleteConversation,
  markConversationRead, markMessagesReadByUser, updateMessage, softDeleteMessage, togglePinMessage, toggleMessageReaction,
  addMemberToConversation, isUserInConversation, loadConversationsFromCloud, loadMessagesFromCloud, subscribeConversations, subscribeMessages,
  searchMessagesInConversation,
} from '../lib/chatStore';
import { usePresence } from '../lib/presence';
import { companyScopedKey } from '../lib/supabase';
import {
  prefsKey, readPrefs, writePrefs, toggleIn, type ChatPrefs,
} from '../lib/chatPrefs';
import {
  filterConversations, sortConversations, categoryOf, isPinnedConv, collectMedia, extractLinks, pinnedMessages, dayKey, dayLabel, listTime, isFirstOfRun,
  CATEGORY_LABEL, type Category, type ListTab,
} from '../lib/chatInfo';
import UserAvatar from './UserAvatar';

// GIAO DIỆN TIN NHẮN KIỂU MỚI (lấy cảm hứng từ Zalo): danh sách hội thoại | khung chat | thông tin hội thoại.
// Dùng lại toàn bộ hệ thống nhắn tin có sẵn (chatStore: realtime, đã xem, ghim tin, cảm xúc, trả lời, @nhắc tên, đính kèm...).
// Thêm: tab Chưa đọc, Phân loại, tắt thông báo / ghim hội thoại (lưu trình duyệt), chuyển tiếp tin, thanh tin đã ghim, ảnh-tệp-liên kết gom ở khung thông tin.

interface Props {
  currentUser: Employee;
  employees: Employee[];
  onNavigateTab?: (tab: string) => void;
  tasks?: Task[];
  onUpdateTask?: (taskId: string, updates: any) => void;
  initialConversationId?: string;
  showBadgeCounts?: boolean;
  onToggleBadgeCounts?: (next: boolean) => void;
}

const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
const PICKER_EMOJIS = ['😊', '😂', '🥰', '😍', '😉', '😎', '🤔', '😅', '😭', '😡', '👍', '👏', '🙏', '💪', '🎉', '🔥', '❤️', '✅', '⚠️', '📌'];
const PAL = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#f97316', '#ef4444', '#64748b'];
const colorOf = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return PAL[h % PAL.length]; };
const initials = (n: string) => { const p = (n || '?').replace('📁', '').trim().split(/\s+/); return (p[0]?.[0] || '?') + (p.length > 1 ? p[p.length - 1][0] : ''); };
const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const fmtSize = (n?: number) => (!n ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Avatar hội thoại: cá nhân dùng avatar tài khoản; nhóm ghép tối đa 4 người. */
function ConvAvatar({ conv, employees, me, size }: { conv: Conversation; employees: Employee[]; me: string; size: number }) {
  if (conv.type === 'personal') {
    const other = employees.find(e => e.id === conv.participantIds.find(i => i !== me));
    return <UserAvatar employee={other || null} name={conv.name} size={size >= 56 ? 'xl' : size >= 44 ? 'lg' : 'md'} noRing />;
  }
  const members = conv.participantIds.slice(0, 4).map(id => employees.find(e => e.id === id)?.name || conv.name);
  return (
    <span className="grid grid-cols-2 grid-rows-2 gap-px rounded-full overflow-hidden bg-white shrink-0" style={{ width: size, height: size }}>
      {members.map((n, i) => <i key={i} className="grid place-items-center text-white not-italic font-bold" style={{ background: colorOf(n), fontSize: Math.max(8, size / 6) }}>{initials(n)}</i>)}
    </span>
  );
}

export default function MessagesZalo({ currentUser, employees, tasks = [], onNavigateTab, initialConversationId }: Props) {
  const { addToast } = useNotification();
  const me = currentUser.id;
  const { isOnline, getLastSeen, formatLastSeen } = usePresence();

  // ─── Dữ liệu ───
  const [conversations, setConversations] = useState<Conversation[]>(() => getConversations());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingEmpId, setPendingEmpId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  // Màn rộng (≥1024px): khung thông tin là cột thứ 3 (mở sẵn); điện thoại: khung thông tin phủ toàn màn hình (đóng sẵn, mở bằng nút bảng)
  const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(min-width: 1024px)') : null;
  const [isDesktop, setIsDesktop] = useState(() => (mq ? mq.matches : true));
  const [infoOpen, setInfoOpen] = useState(() => (mq ? mq.matches : true));
  useEffect(() => {
    if (!mq) return;
    const on = (e: MediaQueryListEvent) => { setIsDesktop(e.matches); setInfoOpen(e.matches); };
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Tùy chọn riêng ───
  const pKey = useMemo(() => companyScopedKey(prefsKey(me)), [me]);
  const [prefs, setPrefs] = useState<ChatPrefs>(() => readPrefs(companyScopedKey(prefsKey(me))));
  const updatePrefs = (next: ChatPrefs) => { setPrefs(next); writePrefs(pKey, next); window.dispatchEvent(new CustomEvent('hl-chat-prefs-updated')); };
  const toggleMute = (id: string) => { const was = prefs.muted.includes(id); updatePrefs({ ...prefs, muted: toggleIn(prefs.muted, id) }); addToast({ title: was ? '🔔 Đã bật thông báo' : '🔕 Đã tắt thông báo', message: was ? 'Hội thoại này sẽ báo tin mới trở lại.' : 'Tin mới của hội thoại này không tính vào huy hiệu chưa đọc.', type: 'info' }); };
  const togglePinConv = (id: string) => updatePrefs({ ...prefs, pinned: toggleIn(prefs.pinned, id) });

  // ─── Bộ lọc danh sách ───
  const [tab, setTab] = useState<ListTab>('all');
  const [category, setCategory] = useState<Category>('all');
  const [query, setQuery] = useState('');
  const [showCategory, setShowCategory] = useState(false);

  const selected = useMemo(() => conversations.find(c => c.id === selectedId) || null, [conversations, selectedId]);
  const empName = useCallback((id?: string) => employees.find(e => e.id === id)?.name || '', [employees]);
  const convName = useCallback((c: Conversation) => (c.type === 'personal' ? (empName(c.participantIds.find(i => i !== me)) || c.name) : c.name).replace('📁 ', ''), [empName, me]);
  const otherOf = (c: Conversation) => employees.find(e => e.id === c.participantIds.find(i => i !== me));

  const mine = useMemo(() => conversations.filter(c => c.participantIds.includes(me)), [conversations, me]);
  const listed = useMemo(() => sortConversations(filterConversations(conversations, { userId: me, tab, category, query, prefs, nameOf: convName }), prefs), [conversations, me, tab, category, query, prefs, convName]);
  const unreadTotal = useMemo(() => mine.filter(c => (c.unreadCount || 0) > 0).length, [mine]);

  // ─── Tải hội thoại + realtime ───
  useEffect(() => {
    let alive = true;
    (async () => { await loadConversationsFromCloud(me); if (alive) setConversations(getConversations()); })();
    const unsub = subscribeConversations(me, () => { if (alive) setConversations(getConversations()); });
    const onVisible = () => { if (document.visibilityState === 'visible') loadConversationsFromCloud(me).then(() => alive && setConversations(getConversations())); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; unsub(); document.removeEventListener('visibilitychange', onVisible); };
  }, [me]);

  // Mở hội thoại theo yêu cầu từ nơi khác (thông báo, nhóm công trình…)
  useEffect(() => {
    if (!initialConversationId) return;
    const c = getConversations().find(x => x.id === initialConversationId);
    if (c) { setSelectedId(c.id); setPendingEmpId(null); setMobileView('chat'); }
  }, [initialConversationId]);

  // ─── Tin nhắn của hội thoại đang mở (cửa sổ 2 ngày, cuộn lên để tải thêm) ───
  const windowRef = useRef<string | null>(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const applyWindow = useCallback((msgs: ChatMessage[]) => {
    const cutoff = windowRef.current ? new Date(windowRef.current).getTime() : -Infinity;
    // tin đã thu hồi vẫn hiện dòng "Tin nhắn đã được thu hồi" như Zalo
    return msgs.filter(m => new Date(m.createdAt).getTime() >= cutoff);
  }, []);

  useEffect(() => {
    if (!selected) { setMessages([]); return; }
    if (!selected.participantIds.includes(me)) { setSelectedId(null); return; }
    const convId = selected.id;
    const latest = selected.lastMessageAt ? new Date(selected.lastMessageAt).getTime() : Date.now();
    const start = new Date(Math.min(Date.now() - TWO_DAYS, latest - TWO_DAYS)).toISOString();
    windowRef.current = start; setHasMoreOlder(true);
    let alive = true;
    const refresh = (msgs?: ChatMessage[]) => {
      if (!alive) return;
      setMessages(applyWindow(msgs || getMessages(convId)));
      markConversationRead(convId, me); markMessagesReadByUser(convId, me);
      setConversations(getConversations());
    };
    refresh();
    loadMessagesFromCloud(convId, { fromIso: start }).then(msgs => { refresh(); setHasMoreOlder(msgs.length > 0); });
    const unsub = subscribeMessages(convId, (msgs) => refresh(msgs));
    return () => { alive = false; unsub(); };
  }, [selectedId]);   // eslint-disable-line react-hooks/exhaustive-deps

  const lastLenRef = useRef(0);
  useEffect(() => {
    if (messages.length !== lastLenRef.current) { lastLenRef.current = messages.length; endRef.current?.scrollIntoView?.({ behavior: 'smooth' }); }
  }, [messages.length, selectedId]);

  const loadOlder = async () => {
    if (!selected || !windowRef.current || loadingOlder || !hasMoreOlder) return;
    const older = new Date(new Date(windowRef.current).getTime() - TWO_DAYS).toISOString();
    setLoadingOlder(true);
    const el = listRef.current; const prevH = el?.scrollHeight ?? 0; const prevTop = el?.scrollTop ?? 0;
    const fetched = await loadMessagesFromCloud(selected.id, { fromIso: older });
    windowRef.current = older; setMessages(applyWindow(getMessages(selected.id))); setHasMoreOlder(fetched.length > 0); setLoadingOlder(false);
    requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevH + prevTop; });
  };

  // ─── Soạn tin ───
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; senderName: string; content: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mention, setMention] = useState<string | null>(null);   // chuỗi đang gõ sau @
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>, source: 'image' | 'file') => {
    const files = Array.from(e.target.files || []);
    files.forEach((file, i) => {
      if (file.size > 10 * 1024 * 1024) { addToast({ title: '⚠️ File quá lớn', message: `"${file.name}" > 10MB`, type: 'warning' }); return; }
      const r = new FileReader();
      r.onload = ev => setAttachments(prev => [...prev, { id: `att_${Date.now()}_${i}`, type: source === 'image' && file.type.startsWith('image/') ? 'image' : 'file', name: file.name, url: String(ev.target?.result), size: file.size, mimeType: file.type }]);
      r.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const send = async (override?: string) => {
    const body = (override ?? text).trim();
    if (editing) {
      if (!body) return;
      await updateMessage(selected!.id, editing.id, body);
      setMessages(applyWindow(getMessages(selected!.id))); setEditing(null); setText(''); return;
    }
    if (!body && attachments.length === 0) return;
    if (sending) return;
    setSending(true);
    try {
      let conv = selected;
      if (!conv && pendingEmpId) {
        const emp = employees.find(e => e.id === pendingEmpId); if (!emp) return;
        conv = await getOrCreatePersonalConversation(me, emp.id, currentUser.name, emp.name);
        setSelectedId(conv.id); setPendingEmpId(null); setConversations(getConversations());
      }
      if (!conv) return;
      const names: string[] = []; const re = /@([^\s,.:;!?]+)/g; let m;
      while ((m = re.exec(body)) !== null) if (!names.includes(m[1])) names.push(m[1]);
      await addMessage({
        conversationId: conv.id, senderId: me, senderName: currentUser.name, senderRole: currentUser.role || 'member',
        content: body || (attachments[0] ? `📎 ${attachments[0].name}` : ''), attachments: attachments.length ? [...attachments] : undefined,
        replyTo: replyTo ?? undefined, mentions: names.length ? names : undefined,
      });
      setMessages(applyWindow(getMessages(conv.id))); setConversations(getConversations());
      setText(''); setAttachments([]); setReplyTo(null); setMention(null); setEmojiOpen(false);
    } finally { setSending(false); }
  };

  const onTextChange = (v: string) => {
    setText(v);
    const m = /@([^\s@]*)$/.exec(v);
    setMention(m && (selected?.type !== 'personal') ? m[1] : null);
  };
  const mentionCandidates = useMemo(() => {
    if (mention === null || !selected) return [];
    const q = mention.toLowerCase();
    return selected.participantIds.filter(id => id !== me).map(id => employees.find(e => e.id === id)).filter((e): e is Employee => !!e && e.name.toLowerCase().includes(q)).slice(0, 6);
  }, [mention, selected, employees, me]);
  const pickMention = (e: Employee) => { setText(prev => prev.replace(/@([^\s@]*)$/, `@${e.name.replace(/\s+/g, '')} `)); setMention(null); };

  // ─── Thao tác trên tin ───
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [pinsOpen, setPinsOpen] = useState(false);
  const react = async (m: ChatMessage, emoji: string) => { await toggleMessageReaction(selected!.id, m.id, me, emoji); setMessages(applyWindow(getMessages(selected!.id))); setMenuFor(null); };
  const pinMsg = async (m: ChatMessage) => { await togglePinMessage(selected!.id, m.id); setMessages(applyWindow(getMessages(selected!.id))); setMenuFor(null); addToast({ title: m.pinned ? '📌 Đã bỏ ghim' : '📌 Đã ghim tin nhắn', message: '', type: 'info' }); };
  const recall = async (m: ChatMessage) => { if (!confirm('Thu hồi tin nhắn này với mọi người?')) return; await softDeleteMessage(selected!.id, m.id); setMessages(applyWindow(getMessages(selected!.id))); setConversations(getConversations()); setMenuFor(null); };
  const copyMsg = async (m: ChatMessage) => { try { await navigator.clipboard.writeText(m.content); addToast({ title: '📋 Đã sao chép', message: '', type: 'info' }); } catch { /* bỏ qua */ } setMenuFor(null); };

  // Chuyển tiếp tin sang các hội thoại khác (tin được gửi như tin của bạn, giữ nguyên nội dung và tệp đính kèm)
  const [fwdTargets, setFwdTargets] = useState<string[]>([]);
  const doForward = async () => {
    if (!forwardMsg || fwdTargets.length === 0) return;
    for (const id of fwdTargets) {
      await addMessage({ conversationId: id, senderId: me, senderName: currentUser.name, senderRole: currentUser.role || 'member', content: forwardMsg.content, attachments: forwardMsg.attachments });
    }
    setConversations(getConversations());
    addToast({ title: '↪ Đã chuyển tiếp', message: `Đã gửi tới ${fwdTargets.length} hội thoại`, type: 'success' });
    setForwardMsg(null); setFwdTargets([]);
  };

  // Mở thực thể liên quan trong tin (công việc, duyệt…)
  const openRelated = (m: ChatMessage) => {
    const re = m.relatedEntity; if (!re) return;
    if (re.type === 'task') window.dispatchEvent(new CustomEvent('hl-open-task', { detail: { taskId: re.id } }));
    else if (re.type === 'mission') { const t = tasks.find(x => x.missions?.some(mm => mm.id === re.id)); if (t) window.dispatchEvent(new CustomEvent('hl-open-task', { detail: { taskId: t.id } })); }
    else if (re.type === 'project') window.dispatchEvent(new CustomEvent('hl-open-conversation', { detail: { conversationId: `conv_project_${re.id}` } }));
    else window.dispatchEvent(new CustomEvent('hl-open-approval', { detail: { kind: re.type, id: re.id } }));
  };

  // ─── Hộp thoại: nhắn mới, tạo nhóm, thêm thành viên ───
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState(''); const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [contactQ, setContactQ] = useState('');
  const contacts = useMemo(() => employees.filter(e => e.id !== me && e.hasSystemAccount && (!contactQ.trim() || e.name.toLowerCase().includes(contactQ.toLowerCase()))), [employees, me, contactQ]);
  const openDirect = (emp: Employee) => {
    const ex = conversations.find(c => c.type === 'personal' && c.participantIds.includes(me) && c.participantIds.includes(emp.id));
    if (ex) { setSelectedId(ex.id); setPendingEmpId(null); } else { setSelectedId(null); setPendingEmpId(emp.id); setMessages([]); }
    setMobileView('chat'); setNewChatOpen(false); setContactQ('');
  };
  const createGroup = async () => {
    if (!groupName.trim()) { addToast({ title: '⚠️ Thiếu tên nhóm', message: 'Vui lòng nhập tên nhóm', type: 'warning' }); return; }
    if (groupMembers.length < 1) { addToast({ title: '⚠️ Thiếu thành viên', message: 'Cần ít nhất 1 thành viên khác', type: 'warning' }); return; }
    const conv = await createGroupConversation(groupName.trim(), [me, ...groupMembers], me);
    setConversations(getConversations()); setGroupOpen(false); setGroupName(''); setGroupMembers([]); setSelectedId(conv.id); setMobileView('chat');
    addToast({ title: '✅ Đã tạo nhóm', message: `Nhóm "${conv.name}" đã được tạo`, type: 'success' });
  };
  const addMember = async (empId: string) => { if (!selected) return; await addMemberToConversation(selected.id, empId); setConversations(getConversations()); setAddMemberOpen(false); };
  const deleteConv = async () => {
    if (!selected) return;
    if (selected.type === 'task') { addToast({ title: '🔒 Không thể xóa', message: 'Nhóm này liên kết với Công việc, chỉ xóa khi Công việc bị xóa', type: 'warning' }); return; }
    if (selected.type === 'group' && selected.createdBy !== me && !isRoleAdmin(me)) { addToast({ title: '⛔ Không đủ quyền', message: 'Chỉ người tạo nhóm hoặc Admin mới được xóa hội thoại nhóm này.', type: 'warning' }); return; }
    if (!confirm(`Xóa toàn bộ cuộc trò chuyện "${convName(selected)}"?`)) return;
    await deleteConversation(selected.id); setSelectedId(null); setConversations(getConversations()); setMobileView('list');
  };
  const markAllRead = async () => { for (const c of mine.filter(x => (x.unreadCount || 0) > 0)) await markConversationRead(c.id, me); setConversations(getConversations()); setShowCategory(false); };

  // ─── Dữ liệu dẫn xuất cho khung chat/thông tin ───
  const pins = useMemo(() => pinnedMessages(messages), [messages]);
  const media = useMemo(() => collectMedia(messages), [messages]);
  const links = useMemo(() => extractLinks(messages), [messages]);
  const searchHits = useMemo(() => (selected && searchQ.trim() ? searchMessagesInConversation(getMessages(selected.id), searchQ.trim()) : []), [selected, searchQ, messages]);
  const lastMine = useMemo(() => [...messages].reverse().find(m => m.senderId === me && !m.deleted), [messages, me]);
  const jumpTo = (id: string) => { document.getElementById(`zmsg-${id}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }); };
  const mutedSel = selected ? prefs.muted.includes(selected.id) : false;

  const statusLine = (c: Conversation) => {
    if (c.type === 'personal') { const o = otherOf(c); return isOnline(o?.id) ? 'Đang hoạt động' : formatLastSeen(getLastSeen(o?.id)); }
    return `${new Set(c.participantIds).size} thành viên${categoryOf(c) === 'project' ? ' · Nhóm công trình' : categoryOf(c) === 'task' ? ' · Nhóm công việc' : ''}`;
  };
  const previewOf = (c: Conversation) => {
    const lm = c.lastMessage; if (!lm) return c.type === 'personal' ? 'Chưa có tin nhắn' : 'Nhóm mới tạo';
    const body = lm.deleted ? 'Tin nhắn đã được thu hồi' : lm.content;
    const who = lm.senderId === me ? 'Bạn: ' : c.type === 'personal' ? '' : `${(lm.senderName || '').split(' ').pop()}: `;
    return `${who}${body}`;
  };

  const renderContent = (content: string) => {
    const parts: React.ReactNode[] = []; const re = /@([^\s,.:;!?]+)/g; let last = 0, m;
    while ((m = re.exec(content)) !== null) { if (m.index > last) parts.push(content.slice(last, m.index)); parts.push(<span key={m.index} className="text-blue-600 font-semibold">@{m[1]}</span>); last = m.index + m[0].length; }
    if (last < content.length) parts.push(content.slice(last));
    return parts;
  };

  // ─── Giao diện ───
  const showList = mobileView === 'list';
  const showChat = mobileView === 'chat';
  const inChat = !!selected || !!pendingEmpId;
  const pendingEmp = pendingEmpId ? employees.find(e => e.id === pendingEmpId) : null;

  const infoPanel = selected && (
    <aside className="bg-white border-l border-slate-200 overflow-y-auto min-h-0 h-full" data-testid="zalo-info">
      <div className="text-center font-bold py-3.5 border-b border-slate-100 flex items-center justify-center relative">Thông tin hội thoại
        <button type="button" onClick={() => setInfoOpen(false)} className="lg:hidden absolute right-3 text-slate-500" aria-label="Đóng"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex flex-col items-center gap-1 pt-4 pb-1 px-3">
        <ConvAvatar conv={selected} employees={employees} me={me} size={64} />
        <b className="text-[15px] text-center">{convName(selected)}</b>
        {selected.type === 'personal' && otherOf(selected)?.position && <small className="text-slate-500">{otherOf(selected)?.position}</small>}
      </div>
      <div className="grid grid-cols-3 gap-1 px-3 pt-2 pb-4 text-center text-[11.5px] text-slate-600">
        <button type="button" onClick={() => toggleMute(selected.id)} className="cursor-pointer" data-testid="zalo-mute"><span className={`mx-auto mb-1 grid place-items-center w-9 h-9 rounded-full ${mutedSel ? 'bg-blue-100 text-blue-600' : 'bg-slate-100'}`}>{mutedSel ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}</span>{mutedSel ? 'Bật thông báo' : 'Tắt thông báo'}</button>
        <button type="button" onClick={() => togglePinConv(selected.id)} className="cursor-pointer" data-testid="zalo-pinconv"><span className={`mx-auto mb-1 grid place-items-center w-9 h-9 rounded-full ${prefs.pinned.includes(selected.id) ? 'bg-blue-100 text-blue-600' : 'bg-slate-100'}`}><Pin className="w-4 h-4" /></span>{prefs.pinned.includes(selected.id) ? 'Bỏ ghim' : 'Ghim hội thoại'}</button>
        <button type="button" onClick={() => (selected.type === 'personal' ? (setGroupMembers([otherOf(selected)?.id || '']), setGroupOpen(true)) : setAddMemberOpen(true))} className="cursor-pointer"><span className="mx-auto mb-1 grid place-items-center w-9 h-9 rounded-full bg-slate-100"><UserPlus className="w-4 h-4" /></span>{selected.type === 'personal' ? 'Tạo nhóm' : 'Thêm thành viên'}</button>
      </div>
      {(selected.projectId || selected.taskId) && (
        <div className="border-t-8 border-slate-100 px-4 py-3">
          <div className="font-bold text-[13px] mb-1.5">{selected.taskId ? 'Công việc liên quan' : 'Công trình'}</div>
          <button type="button" onClick={() => selected.taskId ? window.dispatchEvent(new CustomEvent('hl-open-task', { detail: { taskId: selected.taskId } })) : onNavigateTab?.('projects-construction')} className="text-[12px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 cursor-pointer">{selected.taskId ? 'Mở công việc' : 'Mở công trình'}</button>
        </div>
      )}
      {selected.type !== 'personal' && (
        <div className="border-t-8 border-slate-100 px-4 py-3" data-testid="zalo-members">
          <div className="font-bold text-[13px] mb-2">Thành viên ({new Set(selected.participantIds).size})</div>
          {Array.from(new Set(selected.participantIds)).slice(0, 8).map(id => { const e = employees.find(x => x.id === id); return (
            <div key={id} className="flex items-center gap-2.5 my-1.5 text-[13px]"><UserAvatar employee={e || null} name={e?.name || id} size="sm" noRing /><span className="truncate">{e?.name || id}{id === me ? ' (Bạn)' : ''}</span>{isOnline(id) && <i className="w-2 h-2 rounded-full bg-emerald-500 ml-auto" />}</div>); })}
        </div>
      )}
      <div className="border-t-8 border-slate-100 px-4 py-3" data-testid="zalo-media">
        <div className="font-bold text-[13px] mb-2">Ảnh/Video</div>
        {media.images.length === 0 ? <small className="text-slate-400">Chưa có ảnh/video</small> : (
          <div className="grid grid-cols-4 gap-1">{media.images.slice(0, 8).map(i => <button key={i.id} type="button" onClick={() => setExpanded(i.url)} className="aspect-square rounded-md overflow-hidden bg-slate-100 cursor-pointer"><img src={i.url} alt={i.name} className="w-full h-full object-cover" /></button>)}</div>)}
        {media.images.length > 8 && <div className="text-[11.5px] text-slate-500 mt-1.5">+{media.images.length - 8} ảnh khác</div>}
      </div>
      <div className="border-t-8 border-slate-100 px-4 py-3" data-testid="zalo-files">
        <div className="font-bold text-[13px] mb-2">File</div>
        {media.files.length === 0 ? <small className="text-slate-400">Chưa có tệp</small> : media.files.slice(0, 6).map(f => (
          <a key={f.id} href={f.url} download={f.name} className="flex items-center gap-2.5 my-2 hover:bg-slate-50 rounded-lg">
            <span className="w-9 h-9 rounded-lg bg-sky-100 text-sky-700 grid place-items-center text-[10px] font-extrabold shrink-0">{(f.name.split('.').pop() || 'FILE').slice(0, 4).toUpperCase()}</span>
            <span className="min-w-0"><b className="block text-[12.5px] font-semibold truncate">{f.name}</b><small className="text-slate-500">{new Date(f.at).toLocaleDateString('vi-VN')}</small></span><Download className="w-4 h-4 ml-auto text-slate-400" />
          </a>))}
      </div>
      <div className="border-t-8 border-slate-100 px-4 py-3" data-testid="zalo-links">
        <div className="font-bold text-[13px] mb-2">Link</div>
        {links.length === 0 ? <small className="text-slate-400">Chưa có link</small> : links.slice(0, 6).map(l => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="block text-[12.5px] text-blue-600 truncate my-1.5">{l.url}</a>)}
      </div>
      <div className="border-t-8 border-slate-100 px-4 py-3">
        <button type="button" onClick={deleteConv} className="flex items-center gap-2 text-[12.5px] font-bold text-rose-600 cursor-pointer"><Trash2 className="w-4 h-4" />Xóa cuộc trò chuyện</button>
      </div>
    </aside>
  );

  return (
    <div className="relative bg-white rounded-2xl border border-slate-200 overflow-hidden text-slate-900 h-[calc(100vh-190px)] min-h-[520px]" data-testid="zalo-root">
      <div className={`grid h-full ${infoOpen && selected ? 'lg:grid-cols-[340px_minmax(0,1fr)_300px]' : 'lg:grid-cols-[340px_minmax(0,1fr)]'} grid-cols-1`}>
        {/* ── DANH SÁCH ── */}
        <section className={`${showList ? 'flex' : 'hidden'} lg:flex flex-col min-h-0 border-r border-slate-200`}>
          <div className="flex items-center gap-2 px-3 pt-3 pb-2">
            <label className="flex-1 flex items-center gap-2 bg-slate-100 rounded-lg px-2.5 py-2 text-[13px] text-slate-500">
              <Search className="w-4 h-4 shrink-0" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm kiếm" aria-label="Tìm kiếm hội thoại" className="bg-transparent outline-none w-full text-slate-900" />
            </label>
            <button type="button" title="Nhắn tin mới" aria-label="Nhắn tin mới" onClick={() => setNewChatOpen(true)} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"><UserPlus className="w-[18px] h-[18px]" /></button>
            <button type="button" title="Tạo nhóm" aria-label="Tạo nhóm" onClick={() => { setGroupMembers([]); setGroupOpen(true); }} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"><Users className="w-[18px] h-[18px]" /></button>
          </div>
          <div className="relative flex items-center gap-4 px-3.5 border-b border-slate-100">
            {([['all', 'Tất cả'], ['unread', 'Chưa đọc']] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k} className={`py-2 text-[13px] font-bold border-b-2 -mb-px cursor-pointer ${tab === k ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent'}`}>
                {l}{k === 'unread' && unreadTotal > 0 && <span className="ml-1.5 inline-grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold align-middle">{unreadTotal}</span>}
              </button>))}
            <span className="flex-1" />
            <button type="button" onClick={() => setShowCategory(v => !v)} className="text-[13px] font-semibold text-slate-600 flex items-center gap-1 cursor-pointer" data-testid="zalo-category-btn">{category === 'all' ? 'Phân loại' : CATEGORY_LABEL[category]}<ChevronDown className="w-3.5 h-3.5" /></button>
            {showCategory && (
              <div className="absolute right-2 top-full mt-1 z-30 bg-white rounded-xl shadow-xl border border-slate-200 py-1 w-52" role="menu" data-testid="zalo-category-menu">
                {(Object.keys(CATEGORY_LABEL) as Category[]).map(k => <button key={k} type="button" role="menuitem" onClick={() => { setCategory(k); setShowCategory(false); }} className={`w-full text-left px-3.5 py-2 text-[13px] hover:bg-slate-50 cursor-pointer ${category === k ? 'font-bold text-blue-600' : ''}`}>{CATEGORY_LABEL[k]}</button>)}
                <div className="border-t border-slate-100 my-1" />
                <button type="button" role="menuitem" onClick={markAllRead} className="w-full text-left px-3.5 py-2 text-[13px] hover:bg-slate-50 cursor-pointer flex items-center gap-2"><CheckCheck className="w-4 h-4" />Đánh dấu tất cả đã đọc</button>
              </div>)}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0" data-testid="zalo-list">
            {listed.length === 0 && <div className="py-14 text-center text-slate-500 text-[13px]"><MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />{tab === 'unread' ? 'Không có tin chưa đọc 🎉' : 'Không có hội thoại nào'}</div>}
            {listed.map(c => {
              const unread = c.unreadCount || 0; const muted = prefs.muted.includes(c.id); const pinned = isPinnedConv(c, prefs); const o = otherOf(c);
              return (
                <button key={c.id} type="button" data-testid="zalo-conv" data-conv={c.id} onClick={() => { setSelectedId(c.id); setPendingEmpId(null); setMobileView('chat'); }}
                  className={`w-full grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-3.5 py-2.5 text-left items-center cursor-pointer ${selectedId === c.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <span className="relative"><ConvAvatar conv={c} employees={employees} me={me} size={48} />{c.type === 'personal' && isOnline(o?.id) && <i className="absolute right-0 bottom-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />}</span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5"><b className={`truncate text-[14.5px] ${unread > 0 && !muted ? 'font-extrabold' : 'font-medium'}`}>{convName(c)}</b>
                      {categoryOf(c) === 'project' && <span className="text-[9.5px] font-extrabold text-blue-600 bg-blue-50 rounded px-1.5 py-px shrink-0">Công trình</span>}
                      <span className="ml-auto text-[11.5px] text-slate-500 shrink-0 flex items-center gap-1">{muted && <BellOff className="w-3 h-3" aria-label="Đã tắt thông báo" />}{listTime(c.lastMessageAt)}</span></span>
                    <span className="flex items-center gap-2"><span className={`truncate text-[13px] ${unread > 0 && !muted ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>{previewOf(c)}</span>
                      {unread > 0 ? <span data-testid="zalo-unread" className={`ml-auto shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[11px] font-bold grid place-items-center ${muted ? 'bg-slate-400' : 'bg-red-500'}`}>{unread}</span> : pinned ? <Pin className="w-3.5 h-3.5 ml-auto text-slate-400 shrink-0" /> : null}</span>
                  </span>
                </button>);
            })}
          </div>
        </section>

        {/* ── KHUNG CHAT ── */}
        <section className={`${showChat ? 'flex' : 'hidden'} lg:flex flex-col min-h-0 bg-gradient-to-br from-[#dbe3d3] via-[#c9d6df] to-[#d5d9ea]`} data-testid="zalo-chat">
          {!inChat ? (
            <div className="flex-1 grid place-items-center text-center p-6 bg-slate-50"><div><MessageSquare className="w-12 h-12 mx-auto text-slate-300 mb-3" /><b className="block text-[15px]">Chào mừng đến với Tin nhắn</b><p className="text-[13px] text-slate-500 mt-1">Chọn một hội thoại bên trái hoặc bấm biểu tượng thêm người để bắt đầu.</p></div></div>
          ) : (<>
            <header className="bg-white flex items-center gap-3 px-3 sm:px-4 py-2.5 border-b border-slate-200">
              <button type="button" onClick={() => setMobileView('list')} className="lg:hidden p-1 -ml-1 text-slate-700 cursor-pointer" aria-label="Quay lại danh sách"><ChevronLeft className="w-6 h-6" /></button>
              {selected ? <ConvAvatar conv={selected} employees={employees} me={me} size={44} /> : <UserAvatar employee={pendingEmp || null} size="lg" noRing />}
              <div className="min-w-0"><b className="block text-[16px] truncate">{selected ? convName(selected) : pendingEmp?.name}</b><small className="block text-[12px] text-slate-500 truncate">{selected ? statusLine(selected) : 'Nhắn tin mới'}</small></div>
              <div className="ml-auto flex items-center gap-1">
                {selected && <button type="button" onClick={() => { setSearchOpen(v => !v); setSearchQ(''); }} title="Tìm trong hội thoại" aria-label="Tìm trong hội thoại" className={`p-2 rounded-lg cursor-pointer ${searchOpen ? 'bg-slate-100 text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`}><Search className="w-[18px] h-[18px]" /></button>}
                {selected && <button type="button" onClick={() => setInfoOpen(v => !v)} title="Thông tin hội thoại" aria-label="Thông tin hội thoại" aria-pressed={infoOpen} className={`p-2 rounded-lg cursor-pointer ${infoOpen ? 'bg-blue-100 text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`}><PanelRight className="w-[18px] h-[18px]" /></button>}
              </div>
            </header>
            {mutedSel && (
              <div className="mx-3 mt-2 bg-white rounded-xl px-3 py-2 flex items-center gap-2.5 text-[12.5px] text-slate-600 shadow-sm" data-testid="zalo-mutebar"><BellOff className="w-4 h-4 text-slate-500 shrink-0" /><span className="flex-1 truncate">Tin nhắn trong hội thoại sẽ KHÔNG được thông báo cho bạn</span><button type="button" onClick={() => toggleMute(selected!.id)} className="bg-blue-50 text-blue-600 font-bold rounded-lg px-3 py-1 cursor-pointer">Mở lại</button></div>)}
            {pins.length > 0 && (
              <div className="mx-3 mt-2 bg-white rounded-xl shadow-sm" data-testid="zalo-pinbar">
                <div className="px-3 py-2 flex items-center gap-2.5"><Pin className="w-4 h-4 text-blue-600 shrink-0" />
                  <button type="button" onClick={() => jumpTo(pins[0].id)} className="flex-1 min-w-0 text-left cursor-pointer"><b className="block text-[12.5px]">Tin nhắn đã ghim</b><span className="block text-[12.5px] text-slate-600 truncate">{pins[0].senderName}: {pins[0].content}</span></button>
                  {pins.length > 1 && <button type="button" onClick={() => setPinsOpen(v => !v)} className="border border-slate-300 rounded-lg px-2.5 py-1 text-[12px] font-semibold cursor-pointer">+{pins.length - 1} ghim ⌄</button>}</div>
                {pinsOpen && <div className="border-t border-slate-100 max-h-40 overflow-y-auto">{pins.slice(1).map(p => <button key={p.id} type="button" onClick={() => { jumpTo(p.id); setPinsOpen(false); }} className="w-full text-left px-3 py-1.5 text-[12.5px] hover:bg-slate-50 truncate cursor-pointer"><b>{p.senderName}:</b> {p.content}</button>)}</div>}
              </div>)}
            {searchOpen && (
              <div className="mx-3 mt-2 bg-white rounded-xl shadow-sm p-2" data-testid="zalo-search">
                <input autoFocus value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Tìm tin nhắn trong hội thoại…" className="w-full bg-slate-100 rounded-lg px-3 py-1.5 text-[13px] outline-none" />
                {searchQ.trim() && <div className="max-h-40 overflow-y-auto mt-1.5">{searchHits.length === 0 ? <div className="text-[12px] text-slate-500 px-1 py-1">Không tìm thấy</div> : searchHits.slice(0, 20).map(h => <button key={h.id} type="button" onClick={() => jumpTo(h.id)} className="w-full text-left px-2 py-1 text-[12.5px] hover:bg-slate-50 rounded truncate cursor-pointer"><b>{h.senderName}</b> · {hhmm(h.createdAt)} — {h.content}</button>)}</div>}
              </div>)}

            <div ref={listRef} onScroll={e => { if ((e.currentTarget as HTMLDivElement).scrollTop < 80) loadOlder(); }} className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 min-h-0" data-testid="zalo-messages">
              {loadingOlder && <div className="text-center text-[12px] text-slate-600 py-2"><Loader2 className="w-4 h-4 inline animate-spin mr-1" />Đang tải tin cũ hơn…</div>}
              {messages.length === 0 && <div className="text-center text-[13px] text-slate-600 py-10">Chưa có tin nhắn. Hãy gửi lời chào 👋</div>}
              {messages.map((m, i) => {
                const mineMsg = m.senderId === me; const first = isFirstOfRun(messages, i); const newDay = i === 0 || dayKey(messages[i - 1].createdAt) !== dayKey(m.createdAt);
                const group = selected ? selected.type !== 'personal' : false;
                const reacts = (m.reactions || []).filter(r => r.users.length > 0);
                const showSeen = mineMsg && lastMine?.id === m.id;
                return (
                  <React.Fragment key={m.id}>
                    {newDay && <div className="flex justify-center my-3"><span className="bg-slate-700/50 text-white text-[11.5px] rounded-full px-3 py-0.5">{dayLabel(m.createdAt)}</span></div>}
                    {m.system ? <div className="flex justify-center my-2"><span className="bg-white/60 text-slate-600 text-[12px] rounded-full px-3 py-0.5">{m.content}</span></div> : (
                      <div id={`zmsg-${m.id}`} data-testid="zalo-msg" className={`group flex gap-2 items-end ${mineMsg ? 'justify-end' : ''} ${first ? 'mt-3' : 'mt-0.5'} ${reacts.length ? 'mb-3' : ''}`}>
                        {!mineMsg && (first ? <UserAvatar employee={employees.find(e => e.id === m.senderId) || null} name={m.senderName} size="sm" noRing className="shrink-0" /> : <span className="w-7 shrink-0" />)}
                        <div className={`relative max-w-[78%] sm:max-w-[70%] ${mineMsg ? 'order-2' : ''}`}>
                          <div className={`rounded-xl px-3 py-2 shadow-sm text-[14px] leading-snug break-words ${m.deleted ? 'bg-white/55 text-slate-500 italic shadow-none' : mineMsg ? 'bg-[#d6e6ff]' : 'bg-white'}`}>
                            {group && !mineMsg && first && !m.deleted && <div className="text-[12px] text-slate-500 mb-0.5">{m.senderName}</div>}
                            {m.deleted ? 'Tin nhắn đã được thu hồi' : (<>
                              {m.replyTo && <div className="border-l-[3px] border-blue-500 bg-slate-500/10 rounded-md px-2.5 py-1.5 mb-1.5 text-[12.5px]"><b className="block font-semibold">{m.replyTo.senderName}</b><span className="text-slate-600 line-clamp-2">{m.replyTo.content}</span></div>}
                              {(m.attachments || []).filter(a => a.type !== 'file' && (a.mimeType || 'image/').startsWith('image/')).map(a => <button key={a.id} type="button" onClick={() => setExpanded(a.url)} className="block mb-1 cursor-pointer"><img src={a.url} alt={a.name} className="max-w-[240px] max-h-[200px] rounded-lg object-cover" /></button>)}
                              {(m.attachments || []).filter(a => a.type === 'file' || !(a.mimeType || 'image/').startsWith('image/')).map(a => <a key={a.id} href={a.url} download={a.name} className="flex items-center gap-2 bg-slate-100 rounded-lg px-2.5 py-1.5 mb-1 text-[12.5px]"><Paperclip className="w-4 h-4 text-slate-500" /><span className="truncate max-w-[200px]">{a.name}</span><small className="text-slate-500">{fmtSize(a.size)}</small></a>)}
                              {m.content && !(m.attachments?.length && m.content.startsWith('📎')) && <div>{renderContent(m.content)}</div>}
                              {m.relatedEntity && <button type="button" onClick={() => openRelated(m)} className="mt-1.5 text-[12px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1 cursor-pointer inline-flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" />Mở chi tiết</button>}
                            </>)}
                            {(first || m.edited) && !m.deleted && <div className="text-[10.5px] text-slate-500 mt-0.5">{hhmm(m.createdAt)}{m.edited ? ' · đã chỉnh sửa' : ''}{m.pinned ? ' · 📌' : ''}</div>}
                          </div>
                          {reacts.length > 0 && <span className="absolute -bottom-3 right-2 bg-white rounded-full shadow px-2 py-0.5 text-[11.5px] whitespace-nowrap" data-testid="zalo-react">{reacts.map(r => `${r.emoji}${r.users.length > 1 ? r.users.length : ''}`).join(' ')}</span>}
                          {showSeen && <div className="text-right mt-0.5"><span className="inline-flex items-center gap-1 text-[10.5px] text-slate-600 bg-white/60 rounded-full px-2" data-testid="zalo-seen">{(m.readBy || []).length > 0 ? <><CheckCheck className="w-3 h-3" />Đã xem</> : <><Check className="w-3 h-3" />Đã nhận</>}</span></div>}
                        </div>
                        {!m.deleted && (
                          <div className={`self-center flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 ${mineMsg ? 'order-1' : ''}`}>
                            <button type="button" title="Trả lời" aria-label="Trả lời" onClick={() => setReplyTo({ id: m.id, senderName: m.senderName, content: m.content })} className="w-7 h-7 rounded-full bg-white/90 shadow grid place-items-center cursor-pointer"><CornerUpLeft className="w-3.5 h-3.5" /></button>
                            <button type="button" title="Chuyển tiếp" aria-label="Chuyển tiếp" onClick={() => { setForwardMsg(m); setFwdTargets([]); }} className="w-7 h-7 rounded-full bg-white/90 shadow grid place-items-center cursor-pointer"><Forward className="w-3.5 h-3.5" /></button>
                            <div className="relative">
                              <button type="button" title="Thêm" aria-label="Thêm" onClick={() => setMenuFor(menuFor === m.id ? null : m.id)} className="w-7 h-7 rounded-full bg-white/90 shadow grid place-items-center cursor-pointer"><MoreHorizontal className="w-3.5 h-3.5" /></button>
                              {menuFor === m.id && (
                                <div className={`absolute z-30 bottom-full mb-1 ${mineMsg ? 'right-0' : 'left-0'} bg-white rounded-xl shadow-xl border border-slate-200 py-1 w-52`} role="menu" data-testid="zalo-msgmenu">
                                  <div className="flex justify-around px-2 py-1.5 border-b border-slate-100">{QUICK_EMOJIS.map(e => <button key={e} type="button" onClick={() => react(m, e)} className="text-lg hover:scale-125 transition cursor-pointer" aria-label={`Thả ${e}`}>{e}</button>)}</div>
                                  <button type="button" role="menuitem" onClick={() => pinMsg(m)} className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-slate-50 flex items-center gap-2 cursor-pointer"><Pin className="w-4 h-4" />{m.pinned ? 'Bỏ ghim tin nhắn' : 'Ghim tin nhắn'}</button>
                                  <button type="button" role="menuitem" onClick={() => copyMsg(m)} className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-slate-50 flex items-center gap-2 cursor-pointer"><Copy className="w-4 h-4" />Sao chép</button>
                                  {mineMsg && !m.attachments?.length && <button type="button" role="menuitem" onClick={() => { setEditing({ id: m.id, text: m.content }); setText(m.content); setMenuFor(null); }} className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-slate-50 flex items-center gap-2 cursor-pointer"><Edit3 className="w-4 h-4" />Chỉnh sửa</button>}
                                  {mineMsg && <button type="button" role="menuitem" onClick={() => recall(m)} className="w-full text-left px-3 py-1.5 text-[13px] text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"><Trash2 className="w-4 h-4" />Thu hồi</button>}
                                </div>)}
                            </div>
                          </div>)}
                      </div>)}
                  </React.Fragment>);
              })}
              <div ref={endRef} />
            </div>

            <footer className="bg-white border-t border-slate-200 relative" data-testid="zalo-composer">
              {(replyTo || editing) && (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-50 border-b border-slate-100 text-[12.5px]"><span className="border-l-[3px] border-blue-500 pl-2 min-w-0 flex-1">{editing ? <b>Đang chỉnh sửa tin nhắn</b> : <><b>Trả lời {replyTo!.senderName}</b><span className="block truncate text-slate-500">{replyTo!.content}</span></>}</span><button type="button" onClick={() => { setReplyTo(null); setEditing(null); setText(''); }} aria-label="Hủy" className="cursor-pointer"><X className="w-4 h-4" /></button></div>)}
              {attachments.length > 0 && (
                <div className="flex gap-2 px-4 py-2 overflow-x-auto" data-testid="zalo-pending">{attachments.map(a => <span key={a.id} className="relative shrink-0 bg-slate-100 rounded-lg px-2.5 py-1.5 text-[12px] flex items-center gap-1.5">{a.type === 'image' ? <ImageIcon className="w-3.5 h-3.5" /> : <Paperclip className="w-3.5 h-3.5" />}<span className="max-w-[120px] truncate">{a.name}</span><button type="button" onClick={() => setAttachments(p => p.filter(x => x.id !== a.id))} aria-label="Bỏ tệp"><X className="w-3.5 h-3.5" /></button></span>)}</div>)}
              {mention !== null && mentionCandidates.length > 0 && (
                <div className="absolute bottom-full left-3 mb-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1 w-56 z-30" data-testid="zalo-mention">{mentionCandidates.map(e => <button key={e.id} type="button" onClick={() => pickMention(e)} className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-slate-50 flex items-center gap-2 cursor-pointer"><UserAvatar employee={e} size="xs" noRing />{e.name}</button>)}</div>)}
              {emojiOpen && (
                <div className="absolute bottom-full left-3 mb-1 bg-white rounded-xl shadow-xl border border-slate-200 p-2 grid grid-cols-10 gap-1 z-30 w-[330px]" data-testid="zalo-emoji">{PICKER_EMOJIS.map(e => <button key={e} type="button" onClick={() => setText(t => t + e)} className="text-lg hover:bg-slate-100 rounded cursor-pointer">{e}</button>)}</div>)}
              <div className="flex items-center gap-1 px-3 pt-1.5">
                <button type="button" title="Biểu tượng cảm xúc" aria-label="Biểu tượng cảm xúc" onClick={() => setEmojiOpen(v => !v)} className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"><Smile className="w-5 h-5" /></button>
                <button type="button" title="Gửi ảnh" aria-label="Gửi ảnh" onClick={() => imgRef.current?.click()} className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"><ImageIcon className="w-5 h-5" /></button>
                <button type="button" title="Đính kèm tệp" aria-label="Đính kèm tệp" onClick={() => fileRef.current?.click()} className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"><Paperclip className="w-5 h-5" /></button>
                <input ref={imgRef} type="file" accept="image/*" multiple hidden onChange={e => onFiles(e, 'image')} data-testid="zalo-img-input" />
                <input ref={fileRef} type="file" multiple hidden onChange={e => onFiles(e, 'file')} data-testid="zalo-file-input" />
              </div>
              <div className="flex items-center gap-2 px-4 pb-3 pt-1">
                <input value={text} onChange={e => onTextChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={`Nhập @, tin nhắn tới ${selected ? convName(selected) : pendingEmp?.name || ''}`} aria-label="Nhập tin nhắn" className="flex-1 outline-none text-[14px] py-1.5" />
                {text.trim() || attachments.length || editing
                  ? <button type="button" onClick={() => send()} disabled={sending} aria-label="Gửi" className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 cursor-pointer disabled:opacity-50"><Send className="w-5 h-5" /></button>
                  : <button type="button" onClick={() => send('👍')} aria-label="Gửi 👍" className="p-2 rounded-lg text-amber-500 hover:bg-amber-50 cursor-pointer"><ThumbsUp className="w-5 h-5" /></button>}
              </div>
            </footer>
          </>)}
        </section>

        {/* ── THÔNG TIN (màn rộng: cột thứ 3; điện thoại: phủ toàn màn hình) ── */}
        {isDesktop && infoOpen && selected && <div className="min-h-0">{infoPanel}</div>}
      </div>
      {!isDesktop && infoOpen && selected && showChat && <div className="absolute inset-0 z-40 bg-white overflow-y-auto" data-testid="zalo-info-mobile">{infoPanel}</div>}

      {/* ── Hộp thoại ── */}
      {newChatOpen && (
        <div className="absolute inset-0 z-50 bg-black/40 grid place-items-center p-4" role="dialog" aria-label="Nhắn tin mới" data-testid="zalo-newchat">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80%] flex flex-col"><div className="flex items-center justify-between px-4 py-3 border-b"><b>Nhắn tin mới</b><button type="button" onClick={() => setNewChatOpen(false)} aria-label="Đóng"><X className="w-5 h-5" /></button></div>
            <div className="p-3"><input autoFocus value={contactQ} onChange={e => setContactQ(e.target.value)} placeholder="Tìm đồng nghiệp…" className="w-full bg-slate-100 rounded-lg px-3 py-2 text-[13px] outline-none" /></div>
            <div className="overflow-y-auto pb-2">{contacts.map(e => <button key={e.id} type="button" onClick={() => openDirect(e)} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-left cursor-pointer"><span className="relative"><UserAvatar employee={e} size="md" noRing />{isOnline(e.id) && <i className="absolute right-0 bottom-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />}</span><span className="min-w-0"><b className="block text-[13.5px] truncate">{e.name}</b><small className="text-slate-500">{e.position || e.department}</small></span></button>)}</div></div></div>)}
      {groupOpen && (
        <div className="absolute inset-0 z-50 bg-black/40 grid place-items-center p-4" role="dialog" aria-label="Tạo nhóm" data-testid="zalo-newgroup">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[85%] flex flex-col"><div className="flex items-center justify-between px-4 py-3 border-b"><b>Tạo nhóm trò chuyện</b><button type="button" onClick={() => setGroupOpen(false)} aria-label="Đóng"><X className="w-5 h-5" /></button></div>
            <div className="p-3"><input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Tên nhóm" aria-label="Tên nhóm" className="w-full bg-slate-100 rounded-lg px-3 py-2 text-[13px] outline-none" /></div>
            <div className="overflow-y-auto flex-1">{employees.filter(e => e.id !== me && e.hasSystemAccount).map(e => <label key={e.id} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer"><input type="checkbox" checked={groupMembers.includes(e.id)} onChange={() => setGroupMembers(toggleIn(groupMembers, e.id))} /><UserAvatar employee={e} size="sm" noRing /><span className="text-[13.5px]">{e.name}</span></label>)}</div>
            <div className="p-3 border-t flex justify-end gap-2"><button type="button" onClick={() => setGroupOpen(false)} className="px-4 py-2 rounded-lg bg-slate-100 text-[13px] font-semibold cursor-pointer">Hủy</button><button type="button" onClick={createGroup} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-[13px] font-bold cursor-pointer">Tạo nhóm ({groupMembers.length})</button></div></div></div>)}
      {addMemberOpen && selected && (
        <div className="absolute inset-0 z-50 bg-black/40 grid place-items-center p-4" role="dialog" aria-label="Thêm thành viên">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80%] flex flex-col"><div className="flex items-center justify-between px-4 py-3 border-b"><b>Thêm thành viên</b><button type="button" onClick={() => setAddMemberOpen(false)} aria-label="Đóng"><X className="w-5 h-5" /></button></div>
            <div className="overflow-y-auto py-1">{employees.filter(e => e.hasSystemAccount && !selected.participantIds.includes(e.id)).map(e => <button key={e.id} type="button" onClick={() => addMember(e.id)} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-left cursor-pointer"><UserAvatar employee={e} size="sm" noRing /><span className="text-[13.5px]">{e.name}</span></button>)}</div></div></div>)}
      {forwardMsg && (
        <div className="absolute inset-0 z-50 bg-black/40 grid place-items-center p-4" role="dialog" aria-label="Chuyển tiếp tin nhắn" data-testid="zalo-forward">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[85%] flex flex-col"><div className="flex items-center justify-between px-4 py-3 border-b"><b>Chuyển tiếp tin nhắn</b><button type="button" onClick={() => setForwardMsg(null)} aria-label="Đóng"><X className="w-5 h-5" /></button></div>
            <div className="mx-3 mt-3 border-l-[3px] border-blue-500 bg-slate-50 rounded-md px-3 py-1.5 text-[12.5px] text-slate-600 line-clamp-2">{forwardMsg.content}</div>
            <div className="overflow-y-auto flex-1 py-1">{sortConversations(mine, prefs).map(c => <label key={c.id} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer"><input type="checkbox" checked={fwdTargets.includes(c.id)} onChange={() => setFwdTargets(toggleIn(fwdTargets, c.id))} data-testid="zalo-fwd-target" /><ConvAvatar conv={c} employees={employees} me={me} size={32} /><span className="text-[13.5px] truncate">{convName(c)}</span></label>)}</div>
            <div className="p-3 border-t flex justify-end gap-2"><button type="button" onClick={() => setForwardMsg(null)} className="px-4 py-2 rounded-lg bg-slate-100 text-[13px] font-semibold cursor-pointer">Hủy</button><button type="button" onClick={doForward} disabled={fwdTargets.length === 0} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-[13px] font-bold disabled:opacity-40 cursor-pointer">Gửi ({fwdTargets.length})</button></div></div></div>)}
      {expanded && <div className="absolute inset-0 z-[60] bg-black/80 grid place-items-center p-4" onClick={() => setExpanded(null)} role="dialog" aria-label="Xem ảnh"><img src={expanded} alt="" className="max-w-full max-h-full rounded-lg" /></div>}
    </div>
  );
}
