import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as MT from '../lib/messageTemplates';
import { createPortal } from 'react-dom';
import ProjectActivityModal from './ProjectActivityModal';
import ProjectTodayCard from './ProjectTodayCard';
import { loadUnreadSummary, markProjectSeen, projectIdOfConversation, type UnreadSummary } from '../lib/projectEventReads';
import { ChevronsDown, Search, UserPlus, Users, X, Pin, BellOff, Bell, Send, Paperclip, Image as ImageIcon, Smile, ChevronLeft, PanelRight, MoreHorizontal, CornerUpLeft, Forward, ThumbsUp, Check, CheckCheck, Download, Trash2, ClipboardList, ChevronDown, Edit3, Copy, Loader2, MessageSquare } from 'lucide-react';
import type { Employee, Task, Conversation, ChatMessage, ChatAttachment } from '../types';
import { useNotification, isRoleAdmin } from '../context';
import {
  loadMessagesProgressive,
  getConversations, getMessages, addMessage, getOrCreatePersonalConversation, createGroupConversation, deleteConversation,
  markConversationRead, markMessagesReadByUser, updateMessage, softDeleteMessage, togglePinMessage, toggleMessageReaction,
  addMemberToConversation, loadConversationsFromCloud, loadMessagesFromCloud, subscribeConversations, subscribeMessages,
  searchMessagesInConversation, sendApprovalDirectMessage,
} from '../lib/chatStore';
import { usePresence } from '../lib/presence';
import { dbService } from '../lib/dbService';
import { companyScopedKey } from '../lib/supabase';
import {
  prefsKey, readPrefs, writePrefs, toggleIn, type ChatPrefs,
} from '../lib/chatPrefs';
import {
  scrollTopAfterPrepend, filterConversations, sortConversations, categoryOf, isPinnedConv, collectMedia, extractLinks, pinnedMessages, dayKey, dayLabel, listTime, isFirstOfRun,
  CATEGORY_LABEL, type Category, type ListTab,
} from '../lib/chatInfo';
import UserAvatar from './UserAvatar';
import ConvAvatar from './ConvAvatar';
import { WorkList, WorkDetail } from './MessagesWork';
import { WorkCardView, SendWorkDialog, CreateTaskDialog, cardOfEntry, type NewTaskInput } from './MessagesWorkCards';
import type { InboxItem } from './MyWorkOverview';
import { buildWorkEntries } from '../lib/workEntries';
import { workThreadId, isWorkThreadId } from '../lib/workThread';
import { todayYmd, type MyWorkItem } from '../lib/myWork';

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
  /** Tab "Việc của tôi": việc/nhiệm vụ của tôi, các mục chờ xử lý và hành động (do App dựng theo đúng quy tắc quyền của menu Việc của tôi) */
  workItems?: MyWorkItem[];
  workInbox?: InboxItem[];
  onReceiveWork?: (it: MyWorkItem) => void;
  onOpenWorkTask?: (taskId: string) => void;
  /** Tạo công việc mới (lưu lên hệ thống) — dùng cho "Tạo công việc từ tin nhắn" */
  onCreateTask?: (t: Task) => Promise<void> | void;
  /** "Mở công trình" từ nhóm chat công trình: App kiểm tra quyền (truy cập phân hệ dự án) rồi mở thẳng chi tiết dự án */
  canOpenProject?: (projectId: string) => boolean;
  onOpenProject?: (projectId: string) => void;
  /** "Xuất Excel" trong Nhật ký dự án — App dựng file đầy đủ thông tin dự án; chỉ hiện cho người được xem dự án (canOpenProject) vì file có giá trị hợp đồng, khách hàng */
  onExportProjectLog?: (projectId: string) => void | Promise<void>;
  projects?: { id: string; name: string; pmId?: string }[];
}

const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
const PICKER_EMOJIS = ['😊', '😂', '🥰', '😍', '😉', '😎', '🤔', '😅', '😭', '😡', '👍', '👏', '🙏', '💪', '🎉', '🔥', '❤️', '✅', '⚠️', '📌'];
const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const fmtSize = (n?: number) => (!n ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function MessagesZalo({ currentUser, employees, tasks = [], onNavigateTab, initialConversationId, workItems = [], workInbox = [], onReceiveWork, onOpenWorkTask, onCreateTask, projects = [], canOpenProject, onOpenProject, onExportProjectLog }: Props) {
  const { addToast } = useNotification();
  const me = currentUser.id;
  const { isOnline, getLastSeen, formatLastSeen } = usePresence();

  // ─── Dữ liệu ───
  const [conversations, setConversations] = useState<Conversation[]>(() => getConversations());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Nhật ký dự án đang mở (mã dự án) — mọi thành viên nhóm chat dự án đều xem được
  const [activityPid, setActivityPid] = useState<string | null>(null);
  // Số hoạt động mới trong nhật ký của từng dự án (kể từ lần người dùng xem nhật ký gần nhất) — hiện chấm số + dải "Cập nhật mới"
  const [unreadAct, setUnreadAct] = useState<Record<string, UnreadSummary>>({});
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

  // ─── Tab "Việc của tôi" (cột trái chuyển giữa Tin nhắn | Việc của tôi) ───
  const [leftMode, setLeftMode] = useState<'chat' | 'work'>('chat');
  const [workKey, setWorkKey] = useState<string | null>(null);
  const today = useMemo(() => todayYmd(), []);
  const workEntries = useMemo(() => buildWorkEntries({
    items: workItems, inbox: workInbox, tasks, me, today,
    onReceive: it => onReceiveWork?.(it), onOpenTask: id => onOpenWorkTask?.(id),
  }), [workItems, workInbox, tasks, me, today, onReceiveWork, onOpenWorkTask]);
  const workSel = useMemo(() => workEntries.find(e => e.key === workKey) || null, [workEntries, workKey]);   // mục đã xử lý xong biến mất khỏi danh sách → tự đóng
  // Mục có thảo luận chưa đọc (luồng riêng của mục, không lẫn vào Tin nhắn thường)
  const workUnreadKeys = useMemo(() => {
    const unreadIds = new Set(conversations.filter(c => isWorkThreadId(c.id) && (c.unreadCount || 0) > 0).map(c => c.id));
    return new Set(workEntries.filter(e => unreadIds.has(workThreadId(e.key))).map(e => e.key));
  }, [conversations, workEntries]);

  // ─── Bộ lọc danh sách ───
  const [tab, setTab] = useState<ListTab>('all');
  const [category, setCategory] = useState<Category>('all');
  const [query, setQuery] = useState('');
  const [showCategory, setShowCategory] = useState(false);

  const selected = useMemo(() => conversations.find(c => c.id === selectedId) || null, [conversations, selectedId]);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;
  const [reloadTick, setReloadTick] = useState(0);   // bấm lại hội thoại đang mở → tải lại + đánh dấu đã đọc
  const empName = useCallback((id?: string) => employees.find(e => e.id === id)?.name || '', [employees]);
  const convName = useCallback((c: Conversation) => (c.type === 'personal' ? (empName(c.participantIds.find(i => i !== me)) || c.name) : c.name).replace('📁 ', ''), [empName, me]);
  const otherOf = (c: Conversation) => employees.find(e => e.id === c.participantIds.find(i => i !== me));

  const mine = useMemo(() => conversations.filter(c => c.participantIds.includes(me)), [conversations, me]);
  // Các dự án mà người dùng có nhóm chat — khóa chuỗi để effect bên dưới không chạy lại khi mảng đổi tham chiếu
  const actProjectKey = useMemo(() => Array.from(new Set(mine.map(projectIdOfConversation).filter(Boolean) as string[])).sort().join(','), [mine]);
  // Tải số hoạt động mới: lúc mở, mỗi 60 giây, khi quay lại cửa sổ, và khi vừa đánh dấu đã xem (chưa có realtime cho nhật ký)
  useEffect(() => {
    const ids = actProjectKey ? actProjectKey.split(',') : [];
    if (ids.length === 0) { setUnreadAct({}); return; }
    let alive = true;
    const refresh = () => { loadUnreadSummary(me, ids).then(r => { if (alive) setUnreadAct(r); }); };
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    window.addEventListener('hl-project-seen', refresh);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('hl-project-seen', refresh); };
  }, [actProjectKey, me]);
  const listed = useMemo(() => sortConversations(filterConversations(conversations, { userId: me, tab, category, query, prefs, nameOf: convName }), prefs), [conversations, me, tab, category, query, prefs, convName]);
  const unreadTotal = useMemo(() => mine.filter(c => (c.unreadCount || 0) > 0).length, [mine]);

  // ─── Tải hội thoại + realtime ───
  useEffect(() => {
    let alive = true;
    (async () => { await loadConversationsFromCloud(me); if (alive) setConversations(getConversations()); })();
    const unsub = subscribeConversations(me, () => {
      if (!alive) return;
      const all = getConversations();
      setConversations(all);
      // Đang mở sẵn đúng hội thoại này mà có tin mới → đánh dấu đã đọc NGAY (trước đây tin tới trước khi số chưa đọc kịp cập nhật nên huy hiệu kẹt lại, bấm vào không hết)
      const sid = selectedIdRef.current; const cur = sid ? all.find(c => c.id === sid) : null;
      if (cur && (cur.unreadCount || 0) > 0 && document.visibilityState === 'visible') { markConversationRead(cur.id, me); markMessagesReadByUser(cur.id, me); }
    });
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
    const refresh = (msgs?: ChatMessage[], kind?: 'insert' | 'update') => {
      if (!alive) return;
      setMessages(applyWindow(msgs || getMessages(convId)));
      // Sự kiện CẬP NHẬT (sửa/thu hồi/cảm xúc/đã xem) chỉ vẽ lại — không đánh dấu đã đọc lại (tránh vòng lặp ghi → sự kiện → ghi)
      if (kind !== 'update') { markConversationRead(convId, me); markMessagesReadByUser(convId, me); }
      setConversations(getConversations());
    };
    refresh();
    // Tải 2 bước: chữ trước (vẽ ngay), ảnh/tệp sau — mở hội thoại có ảnh vẫn nhanh
    loadMessagesProgressive(convId, { fromIso: start }, () => refresh(undefined, 'update')).then(msgs => { refresh(undefined, 'update'); setHasMoreOlder(msgs.length > 0); markConversationRead(convId, me); markMessagesReadByUser(convId, me); });
    const unsub = subscribeMessages(convId, (msgs, kind) => {
      if (kind === 'insert') { const last = msgs[msgs.length - 1]; if (last) console.info('[Chat] tin mới qua realtime, trễ', Math.max(0, Date.now() - new Date(last.createdAt).getTime()), 'ms'); }
      refresh(msgs, kind);
    });
    // LƯỚI AN TOÀN: nếu kênh realtime chậm/rớt, cứ ~4 giây (khi đang xem tab) hỏi nhẹ tin mới hơn tin cuối đang có → tin không bao giờ trễ quá vài giây
    let polling = false;
    const timer = setInterval(async () => {
      if (polling || document.visibilityState !== 'visible') return;
      polling = true;
      try {
        const before = getMessages(convId); const lastAt = before[before.length - 1]?.createdAt || start;
        await loadMessagesProgressive(convId, { fromIso: lastAt });
        if (alive && getMessages(convId).length !== before.length) refresh();
      } finally { polling = false; }
    }, 4000);
    return () => { alive = false; unsub(); clearInterval(timer); };
  }, [selectedId, reloadTick]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Tự cuộn xuống cuối như Zalo ───
  // pinned = đang ở sát đáy (người dùng chưa cuộn lên xem tin cũ). Khi pinned: tin mới / ảnh tải xong làm khung cao thêm đều tự kéo xuống đáy.
  // Mở hội thoại khác luôn nhảy xuống cuối; tin của CHÍNH MÌNH vừa gửi cũng luôn xuống cuối.
  const pinnedRef = useRef(true);
  // Nút "xuống cuối" (như Zalo): hiện khi đã cuộn lên xa đáy; kèm số tin mới đến trong lúc đang xem tin cũ
  const [showJump, setShowJump] = useState(false);
  const [newWhileUp, setNewWhileUp] = useState(0);
  // Trong lúc cuộn mượt xuống đáy sau khi bấm nút, các sự kiện cuộn trung gian KHÔNG được coi là "người dùng rời đáy" (jumpLock), và cuối cùng chốt xuống đáy thật.
  const jumpLockUntil = useRef(0);
  const jumpToBottom = () => {
    pinnedRef.current = true; setShowJump(false); setNewWhileUp(0); jumpLockUntil.current = Date.now() + 800;
    const el = listRef.current; if (!el) return;
    if (el.scrollTo) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); else el.scrollTop = el.scrollHeight;
    setTimeout(() => { if (pinnedRef.current) toBottom(); }, 450);
  };
  const innerRef = useRef<HTMLDivElement>(null);
  const toBottom = () => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; };
  useEffect(() => { pinnedRef.current = true; setShowJump(false); setNewWhileUp(0); }, [selectedId]);
  const lastLenRef = useRef(0);
  const lastLenBefore = useRef(0);
  useEffect(() => {
    lastLenBefore.current = lastLenRef.current;
    const last = messages[messages.length - 1];
    const changed = messages.length !== lastLenRef.current;
    lastLenRef.current = messages.length;
    if (changed && (pinnedRef.current || last?.senderId === me)) { pinnedRef.current = true; setShowJump(false); setNewWhileUp(0); toBottom(); requestAnimationFrame(toBottom); }
    else if (changed && messages.length > 0 && lastLenBefore.current < messages.length) setNewWhileUp(n => n + 1);   // tin mới đến khi đang đọc tin cũ → đếm để hiện trên nút
  }, [messages.length, selectedId]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const inner = innerRef.current; if (!inner || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { if (pinnedRef.current) toBottom(); });   // ảnh/tệp tải xong làm cao thêm → vẫn dính đáy
    ro.observe(inner);
    return () => ro.disconnect();
  }, [selectedId, leftMode]);

  const loadOlder = async () => {
    if (!selected || !windowRef.current || loadingOlder || !hasMoreOlder) return;
    const older = new Date(new Date(windowRef.current).getTime() - TWO_DAYS).toISOString();
    setLoadingOlder(true);
    const el = listRef.current; const prevH = el?.scrollHeight ?? 0;
    const fetched = await loadMessagesFromCloud(selected.id, { fromIso: older });
    windowRef.current = older; setMessages(applyWindow(getMessages(selected.id))); setHasMoreOlder(fetched.length > 0); setLoadingOlder(false);
    // Chỉnh vị trí theo chỗ ĐANG đọc lúc tải xong (không phải lúc bắt đầu tải) → bấm "xuống cuối" khi đang tải tin cũ không bị kéo ngược lại
    requestAnimationFrame(() => { if (!el) return; const t = scrollTopAfterPrepend({ pinned: pinnedRef.current, scrollTop: el.scrollTop, prevHeight: prevH, newHeight: el.scrollHeight }); if (t !== null) el.scrollTop = t; });
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

  // Số tệp đang tải lên Storage — chặn nút Gửi cho đến khi xong để tin không đi thiếu tệp
  const [uploading, setUploading] = useState(0);
  const onFiles = (e: React.ChangeEvent<HTMLInputElement>, source: 'image' | 'file') => {
    const files = Array.from(e.target.files || []);
    files.forEach((file, i) => {
      if (file.size > 10 * 1024 * 1024) { addToast({ title: '⚠️ File quá lớn', message: `"${file.name}" > 10MB`, type: 'warning' }); return; }
      setUploading(n => n + 1);
      // Ảnh được nén rồi tải lên kho lưu trữ; trong tin chỉ giữ đường dẫn (không nhúng base64 làm nặng chat)
      dbService.uploadChatAttachment(selected?.id || 'new', file)
        .then(up => setAttachments(prev => [...prev, { id: `att_${Date.now()}_${i}`, type: source === 'image' && file.type.startsWith('image/') ? 'image' : 'file', name: file.name, url: up.url, size: up.size, mimeType: up.mimeType }]))
        .catch(() => addToast({ title: '⚠️ Không đọc được tệp', message: `"${file.name}"`, type: 'warning' }))
        .finally(() => setUploading(n => n - 1));
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
    if (sending || uploading > 0) return;   // còn tệp đang tải lên → chờ xong
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
      const convId = conv.id;
      // Hiện tin của mình và xóa ô soạn NGAY (như Zalo) — việc ghi lên máy chủ chạy sau, không bắt người dùng chờ
      await addMessage({
        conversationId: convId, senderId: me, senderName: currentUser.name, senderRole: currentUser.role || 'member',
        content: body || (attachments[0] ? `📎 ${attachments[0].name}` : ''), attachments: attachments.length ? [...attachments] : undefined,
        replyTo: replyTo ?? undefined, mentions: names.length ? names : undefined,
      }, () => {
        setMessages(applyWindow(getMessages(convId))); setConversations(getConversations());
        setText(''); setAttachments([]); setReplyTo(null); setMention(null); setEmojiOpen(false);
        setSending(false);   // cho phép gõ và gửi tin kế tiếp ngay, không chờ máy chủ
      });
      setConversations(getConversations());
    } finally { setSending(false); }
  };

  // ─── Việc trong chat: gửi thẻ việc/đề xuất, tạo công việc từ tin nhắn ───
  const [sendWorkOpen, setSendWorkOpen] = useState(false);
  const [createFrom, setCreateFrom] = useState<ChatMessage | null>(null);
  /** Hội thoại đang mở; nếu mới chọn người (chưa có hội thoại) thì tạo luôn. */
  const ensureConv = async (): Promise<Conversation | null> => {
    if (selected) return selected;
    if (!pendingEmpId) return null;
    const emp = employees.find(e => e.id === pendingEmpId); if (!emp) return null;
    const c = await getOrCreatePersonalConversation(me, emp.id, currentUser.name, emp.name);
    setSelectedId(c.id); setPendingEmpId(null); setConversations(getConversations());
    return c;
  };
  const pushCard = async (conv: Conversation, entity: { type: any; id: string }, card: any, lead: string) => {
    await addMessage({
      conversationId: conv.id, senderId: me, senderName: currentUser.name, senderRole: currentUser.role || 'member',
      content: lead, relatedEntity: { ...entity, card },
    });
    setMessages(applyWindow(getMessages(conv.id))); setConversations(getConversations());
  };
  /** "Gửi việc vào hội thoại": đưa 1 việc/đề xuất của tôi vào hội thoại dưới dạng thẻ có nút xử lý. */
  const sendWorkCard = async (e: (typeof workEntries)[number]) => {
    setSendWorkOpen(false);
    const conv = await ensureConv(); if (!conv) return;
    const { card, entity } = cardOfEntry(e);
    await pushCard(conv, entity, card, `📌 ${e.chip}: ${e.title}`);
  };
  /** "Tạo công việc từ tin nhắn": tạo công việc thật, rồi gửi thẻ việc vào hội thoại (và nhắn riêng người nhận nếu họ không ở trong hội thoại này). */
  const createTaskFromMessage = async (v: NewTaskInput) => {
    if (!onCreateTask) return;
    setCreateFrom(null);
    const conv = await ensureConv(); if (!conv) return;
    const n = tasks.length + 1;
    const task: Task = {
      id: `task_${Date.now()}`, code: `CV-${n < 10 ? `00${n}` : n < 100 ? `0${n}` : n}`, projectId: v.projectId, name: v.name,
      description: createFrom?.content ? `Tạo từ tin nhắn của ${createFrom.senderName}: ${createFrom.content}`.slice(0, 500) : '',
      assignerId: me, assigneeId: v.assigneeId, department: '', deadline: v.deadline, priority: 'medium', status: 'todo', completionRate: 0,
      approvals: [],
      workLogs: [{ id: `wl_init_${Date.now()}`, actorId: me, actorName: currentUser.name, action: 'Khởi tạo công việc từ tin nhắn.', timestamp: new Date().toISOString() }],
    };
    await onCreateTask(task);
    const assignee = employees.find(e => e.id === v.assigneeId);
    const proj = projects.find(p => p.id === v.projectId)?.name;
    const card = { kind: 'task' as const, key: `task:${task.id}`, title: task.name, sub: `${assignee?.name || ''}${proj ? ` · ${proj}` : ''} · hạn ${v.deadline.slice(8, 10)}/${v.deadline.slice(5, 7)}`, chip: 'Công việc' };
    await pushCard(conv, { type: 'task', id: task.id }, card, MT.giaoViec({ task: task.name, assignee: assignee?.name, deadline: v.deadline, project: proj }));
    // Người nhận việc chưa có trong hội thoại này → nhắn riêng để họ thấy ngay (cùng cách giao việc ở menu Công việc)
    if (assignee && v.assigneeId !== me && !conv.participantIds.includes(v.assigneeId)) {
      sendApprovalDirectMessage({ senderId: me, senderName: currentUser.name, senderRole: currentUser.role, recipientId: assignee.id, recipientName: assignee.name,
        content: MT.giaoViec({ task: task.name, deadline: v.deadline, project: proj }), relatedEntity: { type: 'task', id: task.id } });
    }
    addToast({ title: '✅ Đã tạo công việc', message: `"${task.name}" đã được giao${assignee ? ` cho ${assignee.name}` : ''}.`, type: 'success' });
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
  // Menu "⋯" mở LÊN trên (mặc định) hay XUỐNG dưới: tin sát mép trên khung thì mở xuống, kẻo menu bị khung cuộn cắt mất (menu cao ~300px)
  const [menuDown, setMenuDown] = useState(false);
  const toggleMenu = (e: React.MouseEvent<HTMLElement>, id: string) => {
    if (menuFor === id) { setMenuFor(null); return; }
    const list = listRef.current;
    if (list) { const b = e.currentTarget.getBoundingClientRect(), l = list.getBoundingClientRect(); const above = b.top - l.top, below = l.bottom - b.bottom; setMenuDown(above < 320 && below > above); }
    setMenuFor(id);
  };
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [pinsOpen, setPinsOpen] = useState(false);
  // Chạm 2 lần nhanh vào 1 tin (điện thoại) → thả/bỏ tim ❤️. Chỉ tính cú chạm 1 ngón gần như không di chuyển (cuộn/vuốt không tính),
  // và bỏ qua chạm vào nút, liên kết, ảnh, ô nhập bên trong tin.
  const tapStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastTapRef = useRef<{ id: string; t: number } | null>(null);
  const onMsgTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; tapStartRef.current = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY, t: Date.now() } : null; };
  const onMsgTouchEnd = (e: React.TouchEvent, m: ChatMessage) => {
    const st = tapStartRef.current; tapStartRef.current = null;
    const t = e.changedTouches[0];
    if (!st || !t || m.deleted || m.system) return;
    if ((e.target as HTMLElement).closest('button,a,img,input,textarea,video')) return;
    const now = Date.now();
    if (Math.abs(t.clientX - st.x) > 10 || Math.abs(t.clientY - st.y) > 10 || now - st.t > 300) { lastTapRef.current = null; return; }
    const last = lastTapRef.current;
    if (last && last.id === m.id && now - last.t < 350) { lastTapRef.current = null; react(m, '❤️'); } else lastTapRef.current = { id: m.id, t: now };
  };
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
    return `${new Set(c.participantIds).size} thành viên${categoryOf(c) === 'project' ? ' · Nhóm dự án' : categoryOf(c) === 'task' ? ' · Nhóm công việc' : ''}`;
  };
  const previewOf = (c: Conversation) => {
    // Nhóm dự án chưa có tin thảo luận (các tin hệ thống đã chuyển sang Nhật ký dự án) cũng hiện "Chưa có tin nhắn" thay vì "Nhóm mới tạo"
    const lm = c.lastMessage; if (!lm) return c.type === 'personal' || categoryOf(c) === 'project' ? 'Chưa có tin nhắn' : 'Nhóm mới tạo';
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
          <div className="font-bold text-[13px] mb-1.5">{selected.taskId ? 'Công việc liên quan' : 'Dự án'}</div>
          {selected.taskId ? (
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('hl-open-task', { detail: { taskId: selected.taskId } }))} className="text-[12px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 cursor-pointer">Mở công việc</button>
          ) : (() => {
            // Mở thẳng chi tiết công trình — chỉ khi người dùng được vào phân hệ dự án đó (phân quyền do App kiểm); không thì nút bị khóa kèm lý do
            const pid = selected.projectId || String(selected.id).replace('conv_project_', '');
            const allowed = canOpenProject ? canOpenProject(pid) : true;
            return allowed
              ? <button type="button" onClick={() => onOpenProject ? onOpenProject(pid) : onNavigateTab?.('projects-construction')} className="text-[12px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 cursor-pointer" data-testid="zalo-open-project">Mở dự án</button>
              : <span className="inline-block text-[12px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5" data-testid="zalo-open-project-denied" title="Bạn không có quyền xem dự án này hoặc dự án không còn tồn tại">Bạn không có quyền xem dự án này</span>;
          })()}
          {/* Nhật ký dự án — mọi thành viên nhóm chat theo dõi được (kể cả người không có quyền mở dự án) */}
          {!selected.taskId && (
            <button type="button" onClick={() => setActivityPid(selected.projectId || String(selected.id).replace('conv_project_', ''))}
              className="relative ml-2 text-[12px] font-bold text-slate-700 bg-white border border-slate-300 rounded-lg px-3 py-1.5 cursor-pointer" data-testid="zalo-open-activity">🕘 Nhật ký dự án
              {(unreadAct[selected.projectId || String(selected.id).replace('conv_project_', '')]?.count || 0) > 0 && <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[11px] font-bold grid place-items-center" style={{ color: '#ffffff' }} data-testid="zalo-activity-badge">{Math.min(unreadAct[selected.projectId || String(selected.id).replace('conv_project_', '')].count, 99)}{unreadAct[selected.projectId || String(selected.id).replace('conv_project_', '')].count > 99 ? '+' : ''}</span>}</button>
          )}
          {/* Thẻ "Hôm nay": dòng thời gian thu nhỏ các hoạt động của Nhật ký trong ngày; "Xem thêm" mở khung Nhật ký */}
          {!selected.taskId && (() => { const pid = selected.projectId || String(selected.id).replace('conv_project_', ''); return <ProjectTodayCard projectId={pid} onOpen={() => setActivityPid(pid)} />; })()}
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
    <div className="relative bg-white overflow-hidden text-slate-900 h-full min-h-0" data-testid="zalo-root">
      {/* Độ rộng 3 cột theo Zalo: danh sách 340px · khung chat co giãn · Thông tin hội thoại 340px (trước đây 300px, hẹp hơn Zalo) */}
      <div className={`grid h-full ${leftMode === 'chat' && infoOpen && selected ? 'lg:grid-cols-[340px_minmax(0,1fr)_340px]' : 'lg:grid-cols-[340px_minmax(0,1fr)]'} grid-cols-1`}>
        {/* ── DANH SÁCH ── */}
        <section className={`${showList ? 'flex' : 'hidden'} lg:flex flex-col min-h-0 border-r border-slate-200`}>
          <div className="flex items-center gap-2 px-3 pt-3 pb-2">
            <label className="flex-1 flex items-center gap-2 bg-slate-100 rounded-lg px-2.5 py-2 text-[13px] text-slate-500">
              <Search className="w-4 h-4 shrink-0" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm kiếm" aria-label="Tìm kiếm hội thoại" className="chat-plain-input bg-transparent outline-none w-full text-slate-900" />
            </label>
            <button type="button" title="Nhắn tin mới" aria-label="Nhắn tin mới" onClick={() => setNewChatOpen(true)} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"><UserPlus className="w-[18px] h-[18px]" /></button>
            <button type="button" title="Tạo nhóm" aria-label="Tạo nhóm" onClick={() => { setGroupMembers([]); setGroupOpen(true); }} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"><Users className="w-[18px] h-[18px]" /></button>
          </div>
          {/* Chuyển Tin nhắn | Việc của tôi */}
          <div className="grid grid-cols-2 mx-3 mb-2 p-1 rounded-full bg-slate-100 border border-slate-200" role="group" aria-label="Chọn danh sách" data-testid="zalo-left-switch">
            <button type="button" aria-pressed={leftMode === 'chat'} onClick={() => setLeftMode('chat')} data-testid="zalo-mode-chat" className={`flex items-center justify-center gap-1.5 py-1.5 rounded-full text-[12.5px] font-bold cursor-pointer ${leftMode === 'chat' ? 'bg-white text-slate-900 shadow ring-1 ring-slate-200' : 'text-slate-500'}`}><MessageSquare className="w-4 h-4" />Tin nhắn</button>
            <button type="button" aria-pressed={leftMode === 'work'} onClick={() => setLeftMode('work')} data-testid="zalo-mode-work" className={`flex items-center justify-center gap-1.5 py-1.5 rounded-full text-[12.5px] font-bold cursor-pointer ${leftMode === 'work' ? 'bg-white text-slate-900 shadow ring-1 ring-slate-200' : 'text-slate-500'}`}><ClipboardList className="w-4 h-4" />Việc của tôi{workEntries.length > 0 && <span className="min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-white text-[10.5px] grid place-items-center" data-testid="zalo-work-badge">{workEntries.length}</span>}</button>
          </div>
          {leftMode === 'work' && <div className="flex-1 overflow-y-auto min-h-0" data-testid="zalo-worklist"><WorkList entries={workEntries} selectedKey={workKey} unreadKeys={workUnreadKeys} today={today} query={query} onSelect={k => { setWorkKey(k); setMobileView('chat'); }} /></div>}
          {leftMode === 'chat' && <>
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
            {workEntries.length > 0 && !query.trim() && (
              <button type="button" onClick={() => setLeftMode('work')} data-testid="zalo-today" style={{ color: '#ffffff' }} className="w-[calc(100%-1.5rem)] mx-3 mt-2 mb-1 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#1f6bff] to-[#0a4fd8] px-3.5 py-2.5 text-left cursor-pointer">
                <span><b className="block text-[14px]">Hôm nay</b><span className="block text-[12px] opacity-95">{workEntries.filter(e => e.section === 'today').length} việc đến hạn · {workEntries.filter(e => e.section === 'late').length} quá hạn · {workEntries.filter(e => e.section === 'inbox').length} mục chờ bạn xử lý</span></span>
                <span className="text-[12px] font-bold bg-white/20 rounded-full px-3 py-1 whitespace-nowrap">Xem →</span>
              </button>)}
            {listed.length === 0 && <div className="py-14 text-center text-slate-500 text-[13px]"><MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />{tab === 'unread' ? 'Không có tin chưa đọc 🎉' : 'Không có hội thoại nào'}</div>}
            {listed.map(c => {
              const unread = c.unreadCount || 0; const muted = prefs.muted.includes(c.id); const pinned = isPinnedConv(c, prefs); const o = otherOf(c);
              return (
                <button key={c.id} type="button" data-testid="zalo-conv" data-conv={c.id} onClick={() => { if (selectedId === c.id) setReloadTick(t => t + 1); setSelectedId(c.id); setPendingEmpId(null); setMobileView('chat'); }}
                  className={`w-full grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-3.5 py-2.5 text-left items-center cursor-pointer ${selectedId === c.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <span className="relative"><ConvAvatar conv={c} employees={employees} me={me} size={48} />{c.type === 'personal' && isOnline(o?.id) && <i className="absolute right-0 bottom-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />}</span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5"><b className={`truncate text-[14.5px] ${unread > 0 && !muted ? 'font-extrabold' : 'font-medium'}`}>{convName(c)}</b>
                      {categoryOf(c) === 'project' && <span className="text-[9.5px] font-extrabold text-blue-600 bg-blue-50 rounded px-1.5 py-px shrink-0">Dự án</span>}
                      {(unreadAct[projectIdOfConversation(c) || '']?.count || 0) > 0 && <span className="text-[9.5px] font-extrabold text-red-600 bg-red-50 rounded px-1.5 py-px shrink-0" data-testid="zalo-conv-activity">🕘 {unreadAct[projectIdOfConversation(c) || ''].count} mới</span>}
                      <span className="ml-auto text-[11.5px] text-slate-500 shrink-0 flex items-center gap-1">{muted && <BellOff className="w-3 h-3" aria-label="Đã tắt thông báo" />}{listTime(c.lastMessageAt)}</span></span>
                    <span className="flex items-center gap-2"><span className={`truncate text-[13px] ${unread > 0 && !muted ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>{previewOf(c)}</span>
                      {unread > 0 ? <span data-testid="zalo-unread" className={`ml-auto shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[11px] font-bold grid place-items-center ${muted ? 'bg-slate-400' : 'bg-red-500'}`}>{unread}</span> : pinned ? <Pin className="w-3.5 h-3.5 ml-auto text-slate-400 shrink-0" /> : null}</span>
                  </span>
                </button>);
            })}
          </div>
          </>}
        </section>

        {/* ── KHUNG CHAT ── */}
        <section className={`${showChat ? 'flex' : 'hidden'} lg:flex flex-col min-h-0 bg-gradient-to-br from-[#dbe3d3] via-[#c9d6df] to-[#d5d9ea]`} data-testid="zalo-chat">
          {leftMode === 'work' ? (
            workSel
              ? <WorkDetail key={workSel.key} entry={workSel} me={me} meName={currentUser.name} employees={employees} today={today} onBack={() => setMobileView('list')} />
              : <div className="flex-1 grid place-items-center text-center p-6 bg-slate-50" data-testid="work-placeholder"><div><ClipboardList className="w-12 h-12 mx-auto text-slate-300 mb-3" /><b className="block text-[15px]">Việc của tôi</b><p className="text-[13px] text-slate-500 mt-1">Chọn một việc hoặc đề xuất bên trái để xử lý và trao đổi.</p></div></div>
          ) : !inChat ? (
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
            {/* Dải "Cập nhật mới": tóm tắt hoạt động dự án chưa xem, bấm mở nhật ký; đã xem thì tự ẩn */}
            {selected && (() => {
              const pid = projectIdOfConversation(selected);
              const u = pid ? unreadAct[pid] : undefined;
              if (!pid || !u || u.count === 0 || activityPid === pid) return null;
              return (
                <div className="mx-3 mt-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex items-center gap-2.5 text-[12.5px]" style={{ color: '#0b3aa8' }} data-testid="zalo-activity-bar">
                  <span aria-hidden>🕘</span>
                  <button type="button" onClick={() => setActivityPid(pid)} className="flex-1 min-w-0 text-left cursor-pointer">
                    <b>{u.count} hoạt động mới</b>
                    <span className="block truncate opacity-90">{u.latest.map(l => (l.actorName ? `${l.actorName} ` : '') + l.text).join(' · ')}</span>
                  </button>
                  <button type="button" onClick={() => setActivityPid(pid)} className="font-bold whitespace-nowrap cursor-pointer" style={{ color: '#0d47c9' }}>Xem ›</button>
                  <button type="button" onClick={() => markProjectSeen(me, pid)} aria-label="Bỏ qua" title="Đánh dấu đã xem" className="p-1 cursor-pointer"><X className="w-4 h-4" /></button>
                </div>);
            })()}
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

            <div className="relative flex-1 min-h-0 flex flex-col">
            <div ref={listRef} onScroll={e => { const el = e.currentTarget as HTMLDivElement; if (Date.now() < jumpLockUntil.current) return;   // đang cuộn mượt xuống đáy theo nút → bỏ qua
                const dist = el.scrollHeight - el.scrollTop - el.clientHeight; pinnedRef.current = dist < 120; setShowJump(dist > 320); if (dist < 120) setNewWhileUp(0); if (el.scrollTop < 80) loadOlder(); }} className="flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-5 py-3 min-h-0 overscroll-contain" data-testid="zalo-messages">
              <div ref={innerRef}>
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
                      <div id={`zmsg-${m.id}`} data-testid="zalo-msg" onTouchStart={onMsgTouchStart} onTouchEnd={e => onMsgTouchEnd(e, m)} className={`group flex gap-2 items-end ${mineMsg ? 'justify-end' : ''} ${first ? 'mt-3' : 'mt-0.5'} ${reacts.length ? 'mb-3' : ''}`}>
                        {!mineMsg && (first ? <UserAvatar employee={employees.find(e => e.id === m.senderId) || null} name={m.senderName} size="sm" noRing className="shrink-0" /> : <span className="w-7 shrink-0" />)}
                        <div className={`relative max-w-[78%] sm:max-w-[70%] ${mineMsg ? 'order-2' : ''}`}>
                          <div className={`rounded-xl px-3 py-2 shadow-sm text-[14px] leading-snug break-words [overflow-wrap:anywhere] min-w-0 ${m.deleted ? 'bg-white/55 text-slate-500 italic shadow-none' : mineMsg ? 'bg-[#d6e6ff]' : 'bg-white'}`}>
                            {group && !mineMsg && first && !m.deleted && <div className="text-[12px] text-slate-500 mb-0.5">{m.senderName}</div>}
                            {m.deleted ? 'Tin nhắn đã được thu hồi' : (<>
                              {m.replyTo && <div className="border-l-[3px] border-blue-500 bg-slate-500/10 rounded-md px-2.5 py-1.5 mb-1.5 text-[12.5px]"><b className="block font-semibold">{m.replyTo.senderName}</b><span className="text-slate-600 line-clamp-2">{m.replyTo.content}</span></div>}
                              {(m.attachments || []).filter(a => a.type !== 'file' && (a.mimeType || 'image/').startsWith('image/')).map(a => <button key={a.id} type="button" onClick={() => setExpanded(a.url)} className="block mb-1 cursor-pointer"><img src={a.url} alt={a.name} className="max-w-[240px] max-h-[200px] rounded-lg object-cover" /></button>)}
                              {(m.attachments || []).filter(a => a.type === 'file' || !(a.mimeType || 'image/').startsWith('image/')).map(a => <a key={a.id} href={a.url} download={a.name} className="flex items-center gap-2 bg-slate-100 rounded-lg px-2.5 py-1.5 mb-1 text-[12.5px]"><Paperclip className="w-4 h-4 text-slate-500" /><span className="truncate max-w-[200px]">{a.name}</span><small className="text-slate-500">{fmtSize(a.size)}</small></a>)}
                              {m.content && !(m.attachments?.length && m.content.startsWith('📎')) && <div>{renderContent(m.content)}</div>}
                              {m.relatedEntity?.card && <WorkCardView card={m.relatedEntity.card} entry={workEntries.find(e => e.key === m.relatedEntity!.card!.key)} onOpen={m.relatedEntity.type === 'task' ? () => onOpenWorkTask?.(m.relatedEntity!.id) : undefined} />}
                              {m.relatedEntity && !m.relatedEntity.card && <button type="button" onClick={() => openRelated(m)} className="mt-1.5 text-[12px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1 cursor-pointer inline-flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" />Mở chi tiết</button>}
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
                              <button type="button" title="Thêm" aria-label="Thêm" onClick={e => toggleMenu(e, m.id)} className="w-7 h-7 rounded-full bg-white/90 shadow grid place-items-center cursor-pointer"><MoreHorizontal className="w-3.5 h-3.5" /></button>
                              {menuFor === m.id && (
                                <div className={`absolute z-30 ${menuDown ? 'top-full mt-1' : 'bottom-full mb-1'} ${mineMsg ? 'right-0' : 'left-0'} bg-white rounded-xl shadow-xl border border-slate-200 py-1 w-56`} role="menu" data-testid="zalo-msgmenu">
                                  <div className="flex justify-around px-2 py-1.5 border-b border-slate-100">{QUICK_EMOJIS.map(e => <button key={e} type="button" onClick={() => react(m, e)} className="text-lg hover:scale-125 transition cursor-pointer" aria-label={`Thả ${e}`}>{e}</button>)}</div>
                                  <button type="button" role="menuitem" onClick={() => pinMsg(m)} className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-slate-50 flex items-center gap-2 cursor-pointer"><Pin className="w-4 h-4" />{m.pinned ? 'Bỏ ghim tin nhắn' : 'Ghim tin nhắn'}</button>
                                  {onCreateTask && m.content && !m.relatedEntity?.card && <button type="button" role="menuitem" onClick={() => { setCreateFrom(m); setMenuFor(null); }} data-testid="zalo-menu-createtask" className="w-full text-left px-3 py-1.5 text-[13px] bg-blue-50 text-blue-800 font-bold hover:bg-blue-100 flex items-center gap-2 cursor-pointer"><ClipboardList className="w-4 h-4" />Tạo công việc từ tin nhắn</button>}
                                  {workEntries.length > 0 && <button type="button" role="menuitem" onClick={() => { setSendWorkOpen(true); setMenuFor(null); }} data-testid="zalo-menu-sendwork" className="w-full text-left px-3 py-1.5 text-[13px] bg-blue-50 text-blue-800 font-bold hover:bg-blue-100 flex items-center gap-2 cursor-pointer"><Paperclip className="w-4 h-4" />Gửi việc vào hội thoại</button>}
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
            </div>
            {showJump && (
              <button type="button" onClick={jumpToBottom} aria-label="Xuống tin mới nhất" title="Xuống tin mới nhất" data-testid="zalo-jump-bottom"
                className="absolute right-3 bottom-3 w-11 h-11 rounded-full bg-white shadow-lg border border-slate-200 grid place-items-center text-slate-600 hover:text-blue-600 cursor-pointer z-10">
                <ChevronsDown className="w-6 h-6" />
                {newWhileUp > 0 && <span className="absolute -top-1.5 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[11px] font-bold grid place-items-center" style={{ color: '#ffffff' }} data-testid="zalo-jump-count">{newWhileUp > 99 ? '99+' : newWhileUp}</span>}
              </button>)}
            </div>

            <footer className="bg-white border-t border-slate-200 relative" data-testid="zalo-composer">
              {(replyTo || editing) && (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-50 border-b border-slate-100 text-[12.5px]"><span className="border-l-[3px] border-blue-500 pl-2 min-w-0 flex-1">{editing ? <b>Đang chỉnh sửa tin nhắn</b> : <><b>Trả lời {replyTo!.senderName}</b><span className="block truncate text-slate-500">{replyTo!.content}</span></>}</span><button type="button" onClick={() => { setReplyTo(null); setEditing(null); setText(''); }} aria-label="Hủy" className="cursor-pointer"><X className="w-4 h-4" /></button></div>)}
              {(attachments.length > 0 || uploading > 0) && (
                <div className="flex gap-2 px-4 py-2 overflow-x-auto" data-testid="zalo-pending">{uploading > 0 && <span className="shrink-0 bg-blue-50 text-blue-700 rounded-lg px-2.5 py-1.5 text-[12px] flex items-center gap-1.5" data-testid="zalo-uploading"><Loader2 className="w-3.5 h-3.5 animate-spin" />Đang tải lên…</span>}{attachments.map(a => <span key={a.id} className="relative shrink-0 bg-slate-100 rounded-lg px-2.5 py-1.5 text-[12px] flex items-center gap-1.5">{a.type === 'image' ? <ImageIcon className="w-3.5 h-3.5" /> : <Paperclip className="w-3.5 h-3.5" />}<span className="max-w-[120px] truncate">{a.name}</span><button type="button" onClick={() => setAttachments(p => p.filter(x => x.id !== a.id))} aria-label="Bỏ tệp"><X className="w-3.5 h-3.5" /></button></span>)}</div>)}
              {mention !== null && mentionCandidates.length > 0 && (
                <div className="absolute bottom-full left-3 mb-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1 w-56 z-30" data-testid="zalo-mention">{mentionCandidates.map(e => <button key={e.id} type="button" onClick={() => pickMention(e)} className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-slate-50 flex items-center gap-2 cursor-pointer"><UserAvatar employee={e} size="xs" noRing />{e.name}</button>)}</div>)}
              {emojiOpen && (
                <div className="absolute bottom-full left-3 mb-1 bg-white rounded-xl shadow-xl border border-slate-200 p-2 grid grid-cols-10 gap-1 z-30 w-[330px]" data-testid="zalo-emoji">{PICKER_EMOJIS.map(e => <button key={e} type="button" onClick={() => setText(t => t + e)} className="text-lg hover:bg-slate-100 rounded cursor-pointer">{e}</button>)}</div>)}
              <div className="flex items-center gap-1 px-3 pt-1.5">
                <button type="button" title="Biểu tượng cảm xúc" aria-label="Biểu tượng cảm xúc" onClick={() => setEmojiOpen(v => !v)} className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"><Smile className="w-5 h-5" /></button>
                <button type="button" title="Gửi ảnh" aria-label="Gửi ảnh" onClick={() => imgRef.current?.click()} className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"><ImageIcon className="w-5 h-5" /></button>
                <button type="button" title="Đính kèm tệp" aria-label="Đính kèm tệp" onClick={() => fileRef.current?.click()} className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"><Paperclip className="w-5 h-5" /></button>
                {workEntries.length > 0 && <button type="button" title="Gửi việc vào hội thoại" aria-label="Gửi việc vào hội thoại" onClick={() => setSendWorkOpen(true)} data-testid="zalo-sendwork-btn" className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"><ClipboardList className="w-[18px] h-[18px]" /></button>}
                <input ref={imgRef} type="file" accept="image/*" multiple hidden onChange={e => onFiles(e, 'image')} data-testid="zalo-img-input" />
                <input ref={fileRef} type="file" multiple hidden onChange={e => onFiles(e, 'file')} data-testid="zalo-file-input" />
              </div>
              <div className="flex items-center gap-2 px-4 pb-3 pt-1">
                <input value={text} onChange={e => onTextChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={`Nhập @, tin nhắn tới ${selected ? convName(selected) : pendingEmp?.name || ''}`} aria-label="Nhập tin nhắn" className="chat-plain-input flex-1 outline-none text-[14px] py-1.5" />
                {text.trim() || attachments.length || uploading > 0 || editing
                  ? <button type="button" onClick={() => send()} disabled={sending || uploading > 0} aria-label="Gửi" className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 cursor-pointer disabled:opacity-50"><Send className="w-5 h-5" /></button>
                  : <button type="button" onClick={() => send('👍')} aria-label="Gửi 👍" className="p-2 rounded-lg text-amber-500 hover:bg-amber-50 cursor-pointer"><ThumbsUp className="w-5 h-5" /></button>}
              </div>
            </footer>
          </>)}
        </section>

        {/* ── THÔNG TIN (màn rộng: cột thứ 3; điện thoại: phủ toàn màn hình) ── */}
        {leftMode === 'chat' && isDesktop && infoOpen && selected && <div className="min-h-0">{infoPanel}</div>}
      </div>
      {leftMode === 'chat' && !isDesktop && infoOpen && selected && showChat && <div className="absolute inset-0 z-40 bg-white overflow-y-auto" data-testid="zalo-info-mobile">{infoPanel}</div>}

      {sendWorkOpen && <SendWorkDialog entries={workEntries} onPick={sendWorkCard} onClose={() => setSendWorkOpen(false)} />}
      {createFrom && <CreateTaskDialog initialName={createFrom.content} employees={employees} me={me} projects={projects}
        defaultAssigneeId={selected?.type === 'personal' ? selected.participantIds.find(i => i !== me) : undefined} defaultProjectId={selected?.projectId}
        onCreate={createTaskFromMessage} onClose={() => setCreateFrom(null)} />}

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
      {activityPid && createPortal(
        <ProjectActivityModal
          projectId={activityPid}
          viewerId={me}
          projectName={projects.find(p => p.id === activityPid)?.name || (selected ? convName(selected) : '')}
          onClose={() => setActivityPid(null)}
          onExport={onExportProjectLog && (canOpenProject ? canOpenProject(activityPid) : true) ? () => onExportProjectLog(activityPid) : undefined}
        />, document.body)}
    </div>
  );
}
