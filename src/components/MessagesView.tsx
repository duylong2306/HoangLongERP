import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Employee, ChatAttachment, Task, TaskComment, Conversation, ChatMessage } from '../types';
import { useNotification } from '../context';
import {
  getConversations, saveConversations, getMessages, addMessage,
  getOrCreatePersonalConversation, createGroupConversation, deleteConversation,
  markConversationRead, getUserConversations, deleteMessageFromConversation,
  updateMessage, searchMessagesInConversation, getConversationUnreadCount,
  addMemberToConversation, toggleMessageReaction, markMessagesReadByUser,
  isUserInConversation,
  loadConversationsFromCloud, loadMessagesFromCloud,
  subscribeConversations, subscribeMessages,
} from '../lib/chatStore';
import {
  Search, MessageSquare, User, Users, Send, Image, Smile,
  ThumbsUp, Phone, Info, MoreVertical, CheckCheck, ChevronLeft,
  Pin, Plus, X, Trash, Camera, Paperclip, File, Download, Check, Loader2,
} from 'lucide-react';
import UserAvatar from './UserAvatar';

interface MessagesViewProps {
  currentUser: Employee;
  employees: Employee[];
  onNavigateTab?: (tab: string) => void;
  tasks?: Task[];
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
  initialConversationId?: string; // Mở trực tiếp hội thoại này
  showBadgeCounts?: boolean; // Hiển thị badge số chưa đọc trên tab
  onToggleBadgeCounts?: (next: boolean) => void; // Bật/tắt badge
}

type ActivePaneTab = 'all' | 'personal' | 'group' | 'contacts';

export default function MessagesView({
  currentUser, employees, onNavigateTab, tasks = [], onUpdateTask,
  initialConversationId,
  showBadgeCounts = true,
  onToggleBadgeCounts,
}: MessagesViewProps) {
  const { addToast } = useNotification();
  const [activePaneTab, setActivePaneTab] = useState<ActivePaneTab>('all');

  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // ─── Conversations (unified: personal + group) ─────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>(() => getConversations());
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [pendingChatEmpId, setPendingChatEmpId] = useState<string | null>(null);
  const [convMessages, setConvMessages] = useState<ChatMessage[]>([]);

  // ─── Khi App yêu cầu mở hội thoại cụ thể ──────────────────────────────
  useEffect(() => {
    if (!initialConversationId) return;
    const conv = conversations.find(c => c.id === initialConversationId);
    if (conv) {
      setSelectedConv(conv);
      setPendingChatEmpId(null);
      setMobileView('detail');
      if (conv.type === 'personal') setActivePaneTab('personal');
      else if (conv.type === 'group' || conv.type === 'task') setActivePaneTab('group');
    }
  }, [initialConversationId]);

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  // ─── Attachment State ───────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [showAttachPreview, setShowAttachPreview] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const quickEmojis = ['😊', '👍', '❤️', '😂', '🎉', '🔥'];

  // ─── Lazy-load tin nhắn theo cửa sổ ngày (2 ngày/lần) ──────────────────────
  // Chỉ load sẵn 2 ngày gần nhất; vuốt lên đầu danh sách → load tiếp 2 ngày cũ hơn.
  const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
  const [msgWindowStart, setMsgWindowStartState] = useState<string | null>(null);
  const msgWindowStartRef = useRef<string | null>(null);
  const setMsgWindowStart = (v: string | null) => { msgWindowStartRef.current = v; setMsgWindowStartState(v); };
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadingOlderRef = useRef(false);
  const messageListRef = useRef<HTMLDivElement>(null);

  // ─── Reply & Edit State ────────────────────────────────────────────────
  const [replyToMsg, setReplyToMsg] = useState<{ id: string; senderName: string; content: string } | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // ─── Reaction & Gesture (double-tap / right-click / swipe-to-reply) ────
  const [contextMenu, setContextMenu] = useState<{ msgId: string; x: number; y: number } | null>(null);
  const touchTrackRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastTapRef = useRef<{ msgId: string; t: number } | null>(null);

  // ─── @Mention State ────────────────────────────────────────────────────
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  // ─── In-conversation Search ─────────────────────────────────────────────
  const [showConvSearch, setShowConvSearch] = useState(false);
  const [convSearchQuery, setConvSearchQuery] = useState('');
  const [convSearchResults, setConvSearchResults] = useState<ChatMessage[]>([]);

  // ─── Multi-select mode ──────────────────────────────────────────────────
  const [convSelectMode, setConvSelectMode] = useState(false);
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());

  // ─── Cloud: load hội thoại + subscribe realtime khi mount ────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      await loadConversationsFromCloud(currentUser.id);
      if (mounted) setConversations(getConversations());
    })();

    const unsub = subscribeConversations(currentUser.id, () => {
      if (mounted) setConversations(getConversations());
    });

    return () => { mounted = false; unsub(); };
  }, [currentUser.id]);

  // ─── Effects ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedConv) {
      // Bảo mật: chỉ tải tin nhắn nếu user là thành viên hội thoại
      if (!selectedConv.participantIds.includes(currentUser.id)) {
        setSelectedConv(null);
        setConvMessages([]);
        return;
      }

      // Chỉ load sẵn 2 ngày gần nhất. Neo cửa sổ vào tin mới nhất của hội thoại
      // (không chỉ "now - 2 ngày") để hội thoại có tin nhắn cũ vẫn hiện được tin gần nhất.
      const latestTs = selectedConv.lastMessageAt ? new Date(selectedConv.lastMessageAt).getTime() : Date.now();
      const initialStart = new Date(Math.min(Date.now() - TWO_DAYS, latestTs - TWO_DAYS)).toISOString();
      setMsgWindowStart(initialStart);
      setHasMoreOlder(true);
      loadingOlderRef.current = false;
      setLoadingOlder(false);

      // Hiển thị ngay từ cache (chỉ trong cửa sổ 2 ngày)
      setConvMessages(applyWindow(getMessages(selectedConv.id)));
      markConversationRead(selectedConv.id);
      // Ghi "đã xem" (read_by) cho tin của người khác → hiển thị người đã xem
      markMessagesReadByUser(selectedConv.id, currentUser.id);
      setConversations(getConversations());

      // Kéo bản mới nhất từ cloud (chỉ cửa sổ 2 ngày) + subscribe realtime
      const convId = selectedConv.id;
      let mounted = true;
      loadMessagesFromCloud(convId, { fromIso: initialStart }).then(msgs => {
        if (mounted) {
          setConvMessages(applyWindow(msgs));
          markConversationRead(convId);
          markMessagesReadByUser(convId, currentUser.id);
          setConversations(getConversations());
          setHasMoreOlder(msgs.length > 0);
        }
      });
      // Chỉ cập nhật UI khi có tin nhắn MỚI (insert), KHÔNG gọi markConversationRead
      // để tránh loop: realtime fire → markRead → update → realtime fire lại
      const unsub = subscribeMessages(convId, (msgs) => {
        if (mounted) {
          setConvMessages(applyWindow(msgs));
          // Hội thoại đang mở → đánh dấu tin mới đã xem ngay (idempotent, không loop)
          markMessagesReadByUser(convId, currentUser.id);
        }
      });
      return () => { mounted = false; unsub(); };
    } else {
      setConvMessages([]);
    }
  }, [selectedConv?.id]);

  useEffect(() => {
    // Không cuộn xuống khi đang prepred tin cũ (loadOlder đã tự giữ vị trí)
    if (loadingOlderRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convMessages.length, selectedConv?.id]);

  // ─── Avatar helpers ─────────────────────────────────────────────────────
  const getAvatarFallback = (name: string) => {
    if (!name) return '??';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const getAvatarBgColor = (name: string) => {
    const colors = [
      'bg-indigo-500 text-white', 'bg-red-500 text-white', 'bg-emerald-500 text-white',
      'bg-amber-500 text-white', 'bg-purple-500 text-white', 'bg-blue-500 text-white',
      'bg-teal-500 text-white', 'bg-orange-500 text-white', 'bg-slate-700 text-white',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso); const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = d.toDateString() === yesterday.toDateString();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      if (isToday) return `${hh}:${mm}`;
      if (isYesterday) return `Hôm qua ${hh}:${mm}`;
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${hh}:${mm}`;
    } catch { return ''; }
  };

  const formatFullDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return ''; }
  };

  // ─── Conversation Selection ─────────────────────────────────────────────
  const handleSelectConv = (conv: Conversation) => {
    setSelectedConv(conv);
    setPendingChatEmpId(null);
    setMobileView('detail');
  };

  const handleSelectContact = (emp: Employee) => {
    const existing = conversations.find(c =>
      c.type === 'personal' &&
      c.participantIds.includes(currentUser.id) &&
      c.participantIds.includes(emp.id)
    );
    if (existing) {
      setPendingChatEmpId(null);
      handleSelectConv(existing);
    } else {
      setSelectedConv(null);
      setPendingChatEmpId(emp.id);
      setMobileView('detail');
    }
  };

  // ─── Create Group ───────────────────────────────────────────────────────
  const createGroup = async () => {
    if (!newGroupName.trim()) {
      addToast({ title: '⚠️ Thiếu tên nhóm', message: 'Vui lòng nhập tên nhóm', type: 'warning' });
      return;
    }
    if (newGroupMembers.length < 1) {
      addToast({ title: '⚠️ Thiếu thành viên', message: 'Cần ít nhất 1 thành viên khác', type: 'warning' });
      return;
    }
    const allParticipantIds = [currentUser.id, ...newGroupMembers];
    const uniqueIds = new Set(allParticipantIds);
    if (uniqueIds.size !== allParticipantIds.length) {
      addToast({ title: '⚠️ Thành viên trùng lặp', message: 'Vui lòng loại bỏ nhân viên đã có trong danh sách', type: 'warning' });
      return;
    }
    const conv = await createGroupConversation(
      newGroupName.trim(),
      [currentUser.id, ...newGroupMembers],
      currentUser.id,
    );
    setConversations(getConversations());
    setNewGroupName('');
    setNewGroupMembers([]);
    setShowCreateGroup(false);
    handleSelectConv(conv);
    addToast({ title: '✅ Đã tạo nhóm', message: `Nhóm "${conv.name}" đã được tạo`, type: 'success' });
  };

  // ─── Delete conversation ────────────────────────────────────────────────
  const handleDeleteConversation = async () => {
    if (!selectedConv) return;
    if (selectedConv.type === 'task') {
      addToast({ title: '🔒 Không thể xóa', message: 'Nhóm này liên kết với Công việc, chỉ xóa khi Công việc bị xóa', type: 'warning' });
      return;
    }
    if (!confirm(`Xóa toàn bộ cuộc trò chuyện "${selectedConv.name}"?`)) return;
    await deleteConversation(selectedConv.id);
    setSelectedConv(null);
    setConvMessages([]);
    setConversations(getConversations());
    addToast({ title: '🗑️ Đã xóa', message: 'Cuộc trò chuyện đã được xóa', type: 'info' });
  };

  // Xóa tin nhắn từ hội thoại (chỉ xóa đối với senderId hiện tại)
  const handleDeleteMessage = (msgId: string) => {
    if (!selectedConv) return;
    // Chỉ cho phép xóa tin nhắn đối với người gửi
    const msg = convMessages.find(m => m.id === msgId);
    if (msg && msg.senderId === currentUser.id) {
      deleteMessageFromConversation(selectedConv.id, msgId);
      setConvMessages(applyWindow(getMessages(selectedConv.id)));
      setConversations(getConversations());
      addToast({ title: '🗑️ Đã xóa', message: 'Tin nhắn đã được xóa', type: 'info' });
    }
  };

  // ─── Deep-link từ tin nhắn thông báo công việc ─────────────────────────
  // Mở nhóm chat dự án (conv_project_<projectId>) liên kết với công việc/nhiệm vụ
  // trong tin nhắn. CHẶN THEO PHÂN QUYỀN: chỉ mở nếu user hiện tại LÀ THÀNH VIÊN
  // của nhóm (membership là ACL của hệ chat — getUserConversations lọc theo đó).
  // Nếu không phải thành viên → toast chặn, không mở.
  const openProjectChat = async (projectId?: string) => {
    if (!projectId) return;
    // Refresh conversations từ cloud để chắc chắn membership mới nhất
    // (người được giao vừa được thêm vào nhóm ở luồng giao việc) — tránh lag realtime.
    try {
      await loadConversationsFromCloud(currentUser.id);
      setConversations(getConversations());
    } catch { /* offline — fall về cache */ }
    const convId = `conv_project_${projectId}`;
    if (!isUserInConversation(getConversations(), currentUser.id, convId)) {
      addToast({ title: '🔒 Không có quyền', message: 'Bạn chưa được thêm vào nhóm chat dự án này.', type: 'warning' });
      return;
    }
    window.dispatchEvent(new CustomEvent('hl-open-conversation', { detail: { conversationId: convId } }));
  };

  // Giải projectId từ thực thể liên quan (task / mission / project) rồi mở nhóm dự án
  const openProjectChatForEntity = (re: ChatMessage['relatedEntity']) => {
    if (!re) return;
    let projectId: string | undefined;
    if (re.type === 'project') {
      projectId = re.id;
    } else if (re.type === 'task') {
      projectId = tasks.find(t => t.id === re.id)?.projectId;
    } else if (re.type === 'mission') {
      const task = tasks.find(t => t.missions?.some(m => m.id === re.id));
      projectId = task?.projectId;
    }
    if (!projectId) {
      addToast({ title: 'ℹ️ Không có nhóm dự án', message: 'Thực thể này không thuộc dự án nào nên không có nhóm chat dự án.', type: 'info' });
      return;
    }
    openProjectChat(projectId);
  };

  // Mở chi tiết thực thể liên quan theo loại (deep-link cũ, bổ sung nhóm dự án)
  const openRelatedEntity = (msg: ChatMessage) => {
    const re = msg.relatedEntity;
    if (!re) return;
    if (re.type === 'task') {
      window.dispatchEvent(new CustomEvent('hl-open-task', { detail: { taskId: re.id } }));
    } else if (re.type === 'project') {
      openProjectChat(re.id);
    } else if (re.type === 'leave' || re.type === 'payment' || re.type === 'advance' || re.type === 'travel_expense') {
      // Xét duyệt → mở bảng "Công việc phải duyệt" trong tab Công việc;
      // travel_expense → mở tab Nhân Sự → Công Tác Phí (xử lý ở App.tsx).
      window.dispatchEvent(new CustomEvent('hl-open-approval', { detail: { kind: re.type, id: re.id } }));
    } else if (re.type === 'mission') {
      // Mở task chứa nhiệm vụ (tra qua props tasks)
      const task = tasks.find(t => t.missions?.some(m => m.id === re.id));
      if (task) window.dispatchEvent(new CustomEvent('hl-open-task', { detail: { taskId: task.id } }));
    }
  };

  // ─── Reaction & Gesture handlers ────────────────────────────────────────
  // Thả/bỏ thả phản ứng (tim ❤️ mặc định) vào tin nhắn
  const handleToggleReaction = async (msgId: string, emoji: string) => {
    if (!selectedConv) return;
    await toggleMessageReaction(selectedConv.id, msgId, currentUser.id, emoji);
    setConvMessages(applyWindow(getMessages(selectedConv.id)));
  };

  // Click chuột phải (desktop) → mở context menu ngay vị trí chuột
  const handleContextMenu = (e: React.MouseEvent, msgId: string) => {
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 170);
    const y = Math.min(e.clientY, window.innerHeight - 100);
    setContextMenu({ msgId, x, y });
  };

  const closeContextMenu = () => setContextMenu(null);

  // Lọc tin nhắn theo cửa sổ ngày hiện tại (chỉ hiển thị những tin >= msgWindowStart)
  const applyWindow = (msgs: ChatMessage[]): ChatMessage[] => {
    const ws = msgWindowStartRef.current;
    const cutoff = ws ? new Date(ws).getTime() : -Infinity;
    return msgs.filter(
      m => (!m.deleted || m.senderId === currentUser.id) && new Date(m.createdAt).getTime() >= cutoff,
    );
  };

  // Vuốt lên đầu → mở rộng cửa sổ ngược lên 2 ngày cũ hơn, load tiếp từ cloud
  const loadOlderMessages = async () => {
    if (!selectedConv || !msgWindowStartRef.current || loadingOlderRef.current || !hasMoreOlder) return;
    const olderStartIso = new Date(new Date(msgWindowStartRef.current).getTime() - TWO_DAYS).toISOString();

    loadingOlderRef.current = true;
    setLoadingOlder(true);

    // Giữ nguyên vị trí cuộn sau khi prepred tin cũ (tránh nhảy lên đầu)
    const el = messageListRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;

    const fetched = await loadMessagesFromCloud(selectedConv.id, { fromIso: olderStartIso });
    setMsgWindowStart(olderStartIso);
    setConvMessages(applyWindow(getMessages(selectedConv.id)));
    setHasMoreOlder(fetched.length > 0);

    loadingOlderRef.current = false;
    setLoadingOlder(false);

    // Khôi phục vị trí cuộn (scrollHeight tăng do prepred)
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight + prevTop;
    });
  };

  // Phát hiện vuốt lên gần đầu danh sách → load tiếp tin cũ hơn
  const handleMessageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop < 80 && !loadingOlderRef.current && hasMoreOlder && selectedConv) {
      loadOlderMessages();
    }
  };

  // Double-tap (mobile) → thả tim; Vuốt sang phải (mobile) → trả lời
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchTrackRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const handleTouchEnd = (e: React.TouchEvent, msgId: string) => {
    const track = touchTrackRef.current;
    touchTrackRef.current = null;
    if (!track) return;

    // Bỏ qua nếu chạm vào phần tử tương tác (nút, link, input...) — tránh gây
    // thả tim ngoài ý muốn khi user bấm nút reply/pill/ảnh.
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, [data-no-gesture]')) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - track.x;
    const dy = t.clientY - track.y;
    const dt = Date.now() - track.t;

    // Vuốt sang phải (ưu tiên nếu chuyển động ngang rõ ràng) → kích hoạt trả lời
    if (dx > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const msg = convMessages.find(m => m.id === msgId);
      if (msg) setReplyToMsg({ id: msg.id, senderName: msg.senderName, content: msg.content });
      return;
    }

    // Tap không di chuyển → kiểm tra double-tap để thả tim
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 300) {
      const now = Date.now();
      const last = lastTapRef.current;
      if (last && last.msgId === msgId && now - last.t < 300) {
        lastTapRef.current = null;
        handleToggleReaction(msgId, '❤️');
      } else {
        lastTapRef.current = { msgId, t: now };
      }
    }
  };

  // ─── Multi-select: Chọn/Bỏ chọn 1 hội thoại ──────────────────────────
  const toggleConvSelect = (convId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedConvIds(prev => {
      const next = new Set(prev);
      if (next.has(convId)) next.delete(convId);
      else next.add(convId);
      return next;
    });
  };

  // Chọn/Bỏ chọn tất cả hội thoại đang hiển thị
  const toggleSelectAllConvs = () => {
    if (selectedConvIds.size === filteredConversations.length) {
      setSelectedConvIds(new Set());
    } else {
      setSelectedConvIds(new Set(filteredConversations.map(c => c.id)));
    }
  };

  // Xóa hàng loạt hội thoại đã chọn
  const handleBulkDeleteConversations = async () => {
    const count = selectedConvIds.size;
    if (count === 0) return;
    if (!confirm(`Xóa ${count} cuộc trò chuyện đã chọn?\nThao tác này không thể hoàn tác.`)) return;

    let deletedCount = 0;
    for (const convId of selectedConvIds) {
      const conv = conversations.find(c => c.id === convId);
      if (conv && conv.type !== 'task') {
        await deleteConversation(convId);
        deletedCount++;
      }
    }

    // Nếu hội thoại đang mở cũng bị xóa → reset
    if (selectedConv && selectedConvIds.has(selectedConv.id)) {
      setSelectedConv(null);
      setConvMessages([]);
    }

    setSelectedConvIds(new Set());
    setConvSelectMode(false);
    setConversations(getConversations());
    addToast({ title: '🗑️ Đã xóa', message: `Đã xóa ${deletedCount} cuộc trò chuyện`, type: 'info' });
  };

  // Đếm tin nhắn chưa đọc CHỈ của hội thoại cá nhân (1-1)
  const personalUnreadCount = useMemo(() => {
    const userConvs = getUserConversations(getConversations(), currentUser.id);
    return userConvs
      .filter(c => c.type === 'personal')
      .reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  }, [currentUser.id, conversations]);

  // Đếm tin nhắn chưa đọc của hội thoại nhóm (group + task)
  const groupUnreadCount = useMemo(() => {
    const userConvs = getUserConversations(getConversations(), currentUser.id);
    return userConvs
      .filter(c => c.type === 'group' || c.type === 'task')
      .reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  }, [currentUser.id, conversations]);

  // Tổng tin nhắn chưa đọc (cá nhân + nhóm) cho tab Tất cả
  const newMessageCount = useMemo(() => {
    const userConvs = getUserConversations(getConversations(), currentUser.id);
    return userConvs.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  }, [currentUser.id, conversations]);

  // ─── Send Message (unified for personal & group) ────────────────────────
  const handleSendMessage = async (text: string = inputText) => {
    if (!text.trim() && pendingAttachments.length === 0) return;
    const attachments = pendingAttachments.length > 0 ? [...pendingAttachments] : undefined;

    // Trích xuất danh sách tên được @tag từ nội dung tin nhắn
    const mentionRegex = /@([^\s,.:;!?]+)/g;
    const mentionedNames: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      const name = match[1].trim();
      if (name && !mentionedNames.includes(name)) {
        mentionedNames.push(name);
      }
    }

    if (selectedConv || pendingChatEmpId) {
      // Personal or group chat
      const otherEmpId = pendingChatEmpId ?? selectedConv?.participantIds.find(id => id !== currentUser.id);
      if (!otherEmpId && !pendingChatEmpId && !selectedConv) return;

      let conv = selectedConv;
      if (!conv && pendingChatEmpId) {
        const emp = employees.find(e => e.id === pendingChatEmpId);
        if (!emp) return;
        // Check if it's a group creation (multiple selected) or personal
        conv = await getOrCreatePersonalConversation(currentUser.id, emp.id, currentUser.name, emp.name);
        setSelectedConv(conv);
        setPendingChatEmpId(null);
        setConversations(getConversations());
      }
      if (!conv) return;

      await addMessage({
        conversationId: conv.id,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role || 'member',
        content: text || (attachments ? `📎 ${attachments[0].name}` : ''),
        attachments,
        replyTo: replyToMsg ?? undefined,
        mentions: mentionedNames.length > 0 ? mentionedNames : undefined,
      });
      setConvMessages(applyWindow(getMessages(conv.id)));
      setConversations(getConversations());
      setInputText('');
      clearAttachments();
      setReplyToMsg(null);
      setShowMentionPicker(false);

      // Gửi notification cho những người được tag trong group chat
      if (mentionedNames.length > 0 && conv && (conv.type === 'group' || conv.type === 'task')) {
        // Lõi Thông báo hệ thống đã bị xóa (phần D) — nhắc @mention giờ do tin
        // nhắn chat + Web Push (chatStore.addMessage) đảm nhận, không tạo bản ghi
        // notifications riêng nữa.
      }

      return;
    }
  };

  // ─── Render content with highlighted @mentions ──────────────────────────
  const renderContentWithMentions = (content: string) => {
    const mentionRegex = /@([^\s,.:;!?]+)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      // Text trước @mention
      if (match.index > lastIndex) {
        parts.push(<span key={`t${lastIndex}`}>{content.substring(lastIndex, match.index)}</span>);
      }
      // @mention highlight
      parts.push(
        <span key={`m${match.index}`} className="inline-flex items-center bg-indigo-500/20 text-indigo-300 font-semibold rounded px-1 text-[13px] leading-tight cursor-default">
          @{match[1]}
        </span>
      );
      lastIndex = match.index + match[0].length;
    }
    // Text còn lại
    if (lastIndex < content.length) {
      parts.push(<span key={`e${lastIndex}`}>{content.substring(lastIndex)}</span>);
    }
    return parts;
  };

  // ─── In-conversation Search ─────────────────────────────────────────────
  const handleConvSearch = (query: string) => {
    setConvSearchQuery(query);
    if (!selectedConv || !query.trim()) {
      setConvSearchResults([]);
      return;
    }
    const results = searchMessagesInConversation(getMessages(selectedConv.id), query.trim());
    setConvSearchResults(results);
  };
  // ─── Attachment helpers ─────────────────────────────────────────────────
  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>, source: 'image' | 'file' | 'camera') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        addToast({ title: '⚠️ File quá lớn', message: `"${file.name}" > 10MB`, type: 'warning' });
        continue;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPendingAttachments(prev => [...prev, {
          id: `att_${Date.now()}_${i}`,
          type: source === 'camera' ? 'camera' : (file.type.startsWith('image/') ? 'image' : 'file'),
          name: file.name, url: ev.target?.result as string, size: file.size, mimeType: file.type,
        }]);
        setShowAttachPreview(true);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  }, [addToast]);

  const clearAttachments = () => { setPendingAttachments([]); setShowAttachPreview(false); };

  // ─── Filtered data (chỉ hội thoại mà currentUser là thành viên) ──────────
  const userConversations = useMemo(() =>
    conversations.filter(c => c.participantIds.includes(currentUser.id)),
    [conversations, currentUser.id]
  );

  // Sắp xếp ưu tiên: chưa đọc trước, sau đó mới nhất (lastMessageAt)
  const sortByUnreadThenNewest = (a: Conversation, b: Conversation) => {
    const aUnread = a.unreadCount || 0;
    const bUnread = b.unreadCount || 0;
    if (aUnread > 0 && bUnread === 0) return -1;
    if (aUnread === 0 && bUnread > 0) return 1;
    return (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt);
  };

  const personalConversations = useMemo(() =>
    userConversations
      .filter(c => c.type === 'personal')
      .sort(sortByUnreadThenNewest),
    [userConversations]
  );

  const groupConversations = useMemo(() =>
    userConversations
      .filter(c => c.type === 'group' || c.type === 'task')
      .sort(sortByUnreadThenNewest),
    [userConversations]
  );

  const allConversations = useMemo(() => [...groupConversations, ...personalConversations], [groupConversations, personalConversations]);

  const filteredConversations = useMemo(() => {
    const list = activePaneTab === 'personal' ? personalConversations
      : activePaneTab === 'group' ? groupConversations
      : activePaneTab === 'all' ? allConversations : [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(c => c.name.toLowerCase().includes(q));
  }, [activePaneTab, allConversations, personalConversations, groupConversations, searchQuery]);

  const contactEmployees = useMemo(() => {
    const filtered = employees.filter(e => e.id !== currentUser.id && e.hasSystemAccount);
    if (!searchQuery.trim()) return filtered;
    const q = searchQuery.toLowerCase();
    return filtered.filter(e => e.name.toLowerCase().includes(q) || (e.department && e.department.toLowerCase().includes(q)));
  }, [employees, currentUser.id, searchQuery]);

  // personalUnreadCount đã được tính toán bằng useMemo ở trên (chỉ tính hội thoại người dùng tham gia)

  // Danh sách tab menu bên trái (dạng cột hẹp, kiểu Telegram PC)
  const paneTabs = [
    { id: 'all' as const, label: 'Tất cả', icon: MessageSquare, count: newMessageCount },
    { id: 'personal' as const, label: 'Cá nhân', icon: User, count: personalUnreadCount },
    { id: 'group' as const, label: 'Nhóm', icon: Users, count: groupUnreadCount },
  ];

  // ─── Helper: get member info ────────────────────────────────────────────
  const getConvOtherMember = (conv: Conversation) => {
    const otherId = conv.participantIds.find(id => id !== currentUser.id);
    return otherId ? employees.find(e => e.id === otherId) : null;
  };

  // Danh sách id thành viên DUY NHẤT (loại trùng & rỗng).
  // participantIds là nguồn sự thật của nhóm; KHÔNG lọc qua employees vì
  // một số thành viên (vd: nhân sự HRM ánh xạ riêng) có thể không nằm trong
  // mảng employees hiện tại nhưng vẫn là thành viên hợp lệ của nhóm.
  const getUniqueParticipantIds = (conv: Conversation): string[] => {
    return Array.from(new Set(conv.participantIds.filter(Boolean)));
  };

  // Đếm số thành viên DUY NHẤT của nhóm
  const getConvMemberCount = (conv: Conversation) => {
    return getUniqueParticipantIds(conv).length;
  };

  const getConvLastMessage = (conv: Conversation): string => {
    const msgs = getMessages(conv.id);
    return msgs.length > 0 ? msgs[msgs.length - 1]?.content : '';
  };

  const getMemberNames = (conv: Conversation) => {
    return conv.participantIds
      .map(id => employees.find(e => e.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[500px] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden font-sans shadow-2xl relative" id="messenger_container">

      {/* ===== TAB MENU COLUMN (trái, hẹp) — ẩn trên mobile, dùng dropdown thay thế ===== */}
      <div className="w-[110px] shrink-0 border-r border-slate-800 bg-slate-900 hidden md:flex flex-col p-2 gap-1.5">
        {paneTabs.map(tab => (
          <button key={tab.id}
            onClick={() => { setActivePaneTab(tab.id); setSearchQuery(''); }}
            className={`flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl transition-all cursor-pointer relative ${
              activePaneTab === tab.id
                ? 'bg-indigo-500/15 text-indigo-400 font-semibold ring-1 ring-indigo-500/30'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <tab.icon className="w-5 h-5" />
              {showBadgeCounts && tab.count > 0 && (
                <span className="absolute -top-2 -right-3 bg-rose-500 text-white text-[9px] font-bold min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full">
                  {tab.count > 99 ? '99+' : tab.count}
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium leading-tight text-center whitespace-nowrap">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ===== RIGHT PANEL (header + search + danh sách hội thoại) ===== */}
      <div className={`flex-1 lg:flex-none lg:w-[400px] flex flex-col bg-slate-950 h-full min-w-0 ${mobileView === 'detail' ? 'hidden md:flex' : 'flex'}`}>

        {/* Header */}
        <div className="p-3 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between mb-2">
            {/* Mobile: dropdown thay thế tab column */}
            <div className="sm:hidden flex-1">
              <select
                value={activePaneTab}
                onChange={(e) => { setActivePaneTab(e.target.value as ActivePaneTab); setSearchQuery(''); }}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-[13px] font-bold rounded-lg px-3 py-2 outline-none cursor-pointer appearance-none"
              >
                {paneTabs.map(tab => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}{showBadgeCounts && tab.count > 0 ? ` (${tab.count > 99 ? '99+' : tab.count})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {/* Desktop: title */}
            <h1 className="hidden sm:flex text-base font-bold text-white tracking-tight items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
              <span>Tin nhắn</span>
            </h1>
            <div className="flex items-center gap-2">
              {activePaneTab !== 'contacts' && (
                <button
                  onClick={() => { setConvSelectMode(v => !v); setSelectedConvIds(new Set()); }}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    convSelectMode
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                  title={convSelectMode ? 'Hủy chọn' : 'Chọn nhiều'}
                >
                  {convSelectMode ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{convSelectMode ? 'Hủy' : 'Chọn'}</span>
                </button>
              )}
              <button
                onClick={() => setShowCreateGroup(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                title="Tạo nhóm mới"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tạo nhóm</span>
              </button>
              <button
                onClick={() => onToggleBadgeCounts?.(!showBadgeCounts)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  showBadgeCounts ? 'bg-slate-800 text-slate-300 hover:bg-indigo-500/20 hover:text-indigo-400' : 'bg-slate-850 text-slate-600'
                }`}
                title={showBadgeCounts ? 'Ẩn số tin chưa đọc' : 'Hiện số tin chưa đọc'}
              >
                <span className="text-sm leading-none">{showBadgeCounts ? '🔔' : '🔕'}</span>
              </button>
              <button
                onClick={() => { setActivePaneTab('contacts'); setSearchQuery(''); }}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-indigo-500/20 flex items-center justify-center text-slate-400 hover:text-indigo-400 transition-all cursor-pointer"
                title="Danh bạ"
              >
                <Users className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text" placeholder="Tìm kiếm..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-[13px] text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500/50 transition-all"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin bg-slate-950 border-r border-slate-800">

          {/* ALL TAB - Groups + Personal */}
          {activePaneTab !== 'contacts' && (<>
            {/* Conversations list */}
            {filteredConversations.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="w-7 h-7 text-slate-400" />
                </div>
                <p className="text-[13px] text-slate-400 font-medium">Chưa có cuộc trò chuyện nào</p>
                <p className="text-[11px] text-slate-500 mt-1">Nhấn nút bên trên để tạo nhóm hoặc vào Danh bạ</p>
              </div>
            ) : (
              filteredConversations.map(conv => {
                const isActive = selectedConv?.id === conv.id;
                const isGroup = conv.type === 'group' || conv.type === 'task';
                const otherEmp = !isGroup ? getConvOtherMember(conv) : null;
                const lastContent = getConvLastMessage(conv);
                const memberNames = isGroup ? getMemberNames(conv) : '';

                return (
                  <div key={conv.id} id={conv.id}
                    onClick={() => convSelectMode ? toggleConvSelect(conv.id) : handleSelectConv(conv)}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all border-l-[3px] ${
                      convSelectMode && selectedConvIds.has(conv.id)
                        ? 'bg-indigo-500/15 border-l-indigo-500'
                        : isActive ? 'bg-indigo-500/10 border-l-indigo-500' : 'border-l-transparent hover:bg-slate-900'
                    }`}
                  >
                    {/* Select checkbox */}
                    {convSelectMode && (
                      <div
                        onClick={(e) => toggleConvSelect(conv.id, e)}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                          selectedConvIds.has(conv.id)
                            ? 'bg-indigo-500 border-indigo-500'
                            : 'border-slate-600 hover:border-slate-400'
                        }`}
                      >
                        {selectedConvIds.has(conv.id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    )}

                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {isGroup ? (
                        <UserAvatar name={conv.name} avatar={conv.avatar} size="lg" className="shadow-md" />
                      ) : (
                        <>
                          <UserAvatar employee={otherEmp || null} size="lg" className="shadow-md" />
                          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-[2px] border-slate-950"></span>
                        </>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {conv.pinned && <Pin className="w-3 h-3 text-slate-400 shrink-0" />}
                          <span className="font-semibold text-[14px] text-white truncate">
                            {isGroup ? conv.name : (otherEmp?.name || 'Người dùng')}
                          </span>
                        </div>
                        {conv.lastMessageAt && (
                          <span className="text-[11px] text-slate-400 font-mono shrink-0 ml-2">
                            {formatTime(conv.lastMessageAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {isGroup ? (
                          <span className="text-[11px] text-slate-400">{getConvMemberCount(conv)} thành viên • <span className="text-amber-500">Nhóm</span></span>
                        ) : (
                          <span className="text-[11px] text-slate-400">{otherEmp?.role === 'director' ? '💎 Giám Đốc' : `💼 ${otherEmp?.department || 'Nhân viên'}`}</span>
                        )}
                      </div>
                      {lastContent ? (
                        <p className={`text-[12px] mt-0.5 truncate leading-tight ${(conv.unreadCount || 0) > 0 ? 'text-white font-semibold' : 'text-slate-400'}`}>
                          {lastContent}
                        </p>
                      ) : isGroup ? (
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">{memberNames}</p>
                      ) : (
                        <p className="text-[11px] text-slate-500 mt-0.5">Chưa có tin nhắn</p>
                      )}
                    </div>

                    {/* Unread badge */}
                    {(conv.unreadCount || 0) > 0 && (
                      <span className="bg-indigo-500 text-white text-[10px] font-bold min-w-[20px] h-5 flex items-center justify-center rounded-full px-1.5 shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                );
              })
            )}

          </>)}

          {/* BULK ACTION BAR */}
          {convSelectMode && activePaneTab !== 'contacts' && (
            <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 px-3 py-2.5 flex items-center justify-between z-20">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAllConvs}
                  className="text-[11px] text-indigo-400 hover:text-white font-semibold cursor-pointer transition-colors"
                >
                  {selectedConvIds.size === filteredConversations.length ? 'Bỏ chọn hết' : 'Chọn tất cả'}
                </button>
                <span className="text-[11px] text-slate-500">
                  {selectedConvIds.size > 0 && `Đã chọn ${selectedConvIds.size}`}
                </span>
              </div>
              {selectedConvIds.size > 0 && (
                <button
                  onClick={handleBulkDeleteConversations}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold rounded-lg transition-all cursor-pointer"
                >
                  <Trash className="w-3.5 h-3.5" />
                  Xóa ({selectedConvIds.size})
                </button>
              )}
            </div>
          )}

          {/* CONTACTS TAB */}
          {activePaneTab === 'contacts' && (
            <div className="flex-1 overflow-y-auto scrollbar-thin bg-slate-950 py-2">
              {contactEmployees.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
                    <Users className="w-7 h-7 text-slate-400" />
                  </div>
                  <p className="text-[13px] text-slate-400 font-medium">Không tìm thấy nhân viên</p>
                </div>
              ) : (
                contactEmployees.map(emp => {
                  const existingConv = conversations.find(c =>
                    c.type === 'personal' &&
                    c.participantIds.includes(currentUser.id) &&
                    c.participantIds.includes(emp.id)
                  );
                  return (
                    <div key={emp.id}
                      onClick={() => handleSelectContact(emp)}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-900 cursor-pointer transition-all"
                    >
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${getAvatarBgColor(emp.name)}`}>
                        {getAvatarFallback(emp.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] text-white font-medium truncate block">{emp.name}</span>
                        <span className="text-[10px] text-slate-500">{emp.role === 'director' ? '💎 Giám Đốc' : emp.department}</span>
                      </div>
                      {existingConv && (
                        <span className="text-[9px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">Đã chat</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== RIGHT PANEL (chat detail) ===== */}
      <div className={`flex-1 flex flex-col bg-slate-950 relative h-full min-w-[320px] border-l border-slate-800 ${mobileView === 'list' && !selectedConv && !pendingChatEmpId ? 'hidden md:flex' : 'flex'}`}>

        {/* SPLASH */}
        {!selectedConv && !pendingChatEmpId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-950">
            <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-5">
              <MessageSquare className="w-10 h-10 text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">{currentUser.name} ơi, chào mừng!</h2>
            <p className="text-[13px] text-slate-400 max-w-sm leading-relaxed">
              Chọn một cuộc trò chuyện từ danh sách bên trái hoặc nhấn nút tạo nhóm mới.
            </p>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="mt-6 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-semibold rounded-lg transition-all cursor-pointer"
            >
              🚀 Tạo nhóm mới
            </button>
          </div>
        ) : (
          <>
            {/* HEADER */}
            <div className="h-[56px] bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => { setSelectedConv(null); setPendingChatEmpId(null); setMobileView('list'); }}
                  className="p-1 text-slate-400 hover:text-white md:hidden mr-1 cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {selectedConv ? (() => {
                  const isGroup = selectedConv.type === 'group' || selectedConv.type === 'task';
                  const otherEmp = !isGroup ? getConvOtherMember(selectedConv) : null;
                  return (
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-md text-white"
                        style={{ backgroundColor: selectedConv.color || '#6366F1' }}>
                        {isGroup ? (selectedConv.avatar || getAvatarFallback(selectedConv.name)) : (otherEmp ? getAvatarFallback(otherEmp.name) : '??')}
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-semibold text-[15px] text-white truncate">
                          {isGroup ? selectedConv.name : (otherEmp?.name || 'Người dùng')}
                        </h2>
                        <p className="text-[11px] text-slate-400 truncate">
                          {isGroup ? `${getConvMemberCount(selectedConv)} thành viên` : (otherEmp?.role === 'director' ? '💎 Giám Đốc' : `💼 ${otherEmp?.department || ''}`)}
                        </p>
                      </div>
                    </div>
                  );
                })() : pendingChatEmpId ? (() => {
                  const emp = employees.find(e => e.id === pendingChatEmpId);
                  return (
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 text-white ${emp ? getAvatarBgColor(emp.name) : 'bg-indigo-500'}`}>
                        {emp ? getAvatarFallback(emp.name) : '??'}
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-semibold text-[15px] text-white truncate">{emp?.name || 'Người dùng'}</h2>
                        <p className="text-[11px] text-indigo-400">💬 Nhắn tin mới</p>
                      </div>
                    </div>
                  );
                })() : null}
              </div>

              <div className="flex items-center gap-1">
                {selectedConv && (
                  <button
                    onClick={() => { setShowConvSearch(v => !v); setConvSearchQuery(''); setConvSearchResults([]); }}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all ${showConvSearch ? 'text-indigo-400 bg-slate-800' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    title="Tìm kiếm trong cuộc trò chuyện"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                )}
                {selectedConv && selectedConv.type !== 'task' && (
                  <button
                    onClick={handleDeleteConversation}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg cursor-pointer transition-all"
                    title="Xóa cuộc trò chuyện"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                )}
                {selectedConv && (selectedConv.type === 'group' || selectedConv.type === 'task') && (
                  <button
                    onClick={() => setShowInfoPanel(!showInfoPanel)}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-all"
                    title="Thông tin nhóm"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* IN-CONVERSATION SEARCH BAR */}
            {showConvSearch && selectedConv && (
              <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Tìm kiếm tin nhắn trong cuộc trò chuyện..."
                    value={convSearchQuery}
                    onChange={(e) => handleConvSearch(e.target.value)}
                    className="w-full pl-9 pr-9 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-[13px] text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500/50 transition-all"
                  />
                  {convSearchQuery && (
                    <button
                      onClick={() => { setConvSearchQuery(''); setConvSearchResults([]); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {convSearchQuery && (
                  <div className="mt-1.5 text-[10px] text-slate-400">
                    {convSearchResults.length > 0
                      ? `Tìm thấy ${convSearchResults.length} kết quả`
                      : 'Không tìm thấy tin nhắn nào'}
                  </div>
                )}
              </div>
            )}

            {/* MESSAGES AREA */}
            <div className="flex-1 flex overflow-hidden min-h-0 relative">
              <div className="flex-1 flex flex-col bg-slate-950 relative min-w-0 h-full">

                {/* Messages */}
                <div
                  ref={messageListRef}
                  onScroll={handleMessageScroll}
                  className="flex-1 overflow-y-auto px-4 py-3 space-y-1 scrollbar-thin bg-slate-950"
                >
                  {/* Welcome */}
                  {selectedConv && (
                    <div className="py-6 text-center shrink-0">
                      {(() => {
                        if (selectedConv.type === 'group' || selectedConv.type === 'task') {
                          return <UserAvatar name={selectedConv.name} avatar={selectedConv.avatar} size="xl" className="mx-auto shadow-md mb-2" />;
                        }
                        const e = getConvOtherMember(selectedConv);
                        return <UserAvatar employee={e || null} size="xl" className="mx-auto shadow-md mb-2" />;
                      })()}
                      <h3 className="font-semibold text-white text-[14px]">
                        {(selectedConv.type === 'group' || selectedConv.type === 'task') ? selectedConv.name : (getConvOtherMember(selectedConv)?.name || 'Cuộc trò chuyện')}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {(selectedConv.type === 'group' || selectedConv.type === 'task') ? `${getConvMemberCount(selectedConv)} thành viên` : 'Cuộc trò chuyện riêng tư'}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">Tin nhắn được mã hóa cục bộ trong trình duyệt</p>
                    </div>
                  )}

                  {/* Spinner load tin cũ hơn khi vuốt lên đầu */}
                  {loadingOlder && (
                    <div className="py-3 flex items-center justify-center gap-2 text-slate-400 text-[11px]">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang tải tin nhắn cũ hơn...
                    </div>
                  )}

                  {pendingChatEmpId && !selectedConv ? (
                    <div className="py-10 text-center text-slate-400 text-[12px]">
                      <MessageSquare className="w-10 h-10 mx-auto mb-2 text-indigo-400" />
                      Nhấn gửi tin nhắn để khởi tạo cuộc trò chuyện
                    </div>
                  ) : convMessages.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-[12px]">
                      Chưa có tin nhắn nào. Hãy gửi tin nhắn đầu tiên!
                    </div>
                  ) : (
                    <div className="flex flex-col space-y-1">
                      {convMessages.map((msg, idx) => {
                        const isSelf = msg.senderId === currentUser.id;
                        const prevMsg = idx > 0 ? convMessages[idx - 1] : null;
                        const sameSender = prevMsg && prevMsg.senderId === msg.senderId;
                        const showDateSep = !prevMsg || new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
                        const senderEmp = employees.find(e => e.id === msg.senderId);
                        const isGroup = selectedConv?.type === 'group' || selectedConv?.type === 'task';

                        return (
                          <React.Fragment key={msg.id}>
                            {showDateSep && (
                              <div className="flex justify-center my-2 shrink-0">
                                <span className="text-[10px] bg-slate-900 text-slate-400 border border-slate-800 px-3 py-1 rounded-full font-medium">
                                  {formatFullDate(msg.createdAt)}
                                </span>
                              </div>
                            )}

                            <div
                              className={`group flex gap-2 max-w-[88%] items-end ${isSelf ? 'ml-auto flex-row-reverse' : ''}`}
                              style={{ touchAction: 'pan-y' }}
                              onContextMenu={e => { if (!msg.deleted) handleContextMenu(e, msg.id); }}
                              onTouchStart={handleTouchStart}
                              onTouchEnd={e => { if (!msg.deleted) handleTouchEnd(e, msg.id); }}
                            >
                              {/* Avatar */}
                              {!isSelf && isGroup && (
                                <div className={`shrink-0 ${sameSender ? 'invisible' : ''}`}>
                                  <UserAvatar employee={senderEmp || null} size="sm" noRing />
                                </div>
                              )}

                              {/* Bubble */}
                              <div className={`space-y-0.5 ${sameSender && !isSelf && isGroup ? 'ml-9' : ''}`}>
                                {/* Sender name */}
                                {!isSelf && isGroup && !sameSender && (
                                  <span className="text-[10px] font-bold ml-1 text-indigo-400">
                                    {msg.senderName || senderEmp?.name || 'Unknown'}
                                  </span>
                                )}

                                {/* Reply preview (clickable to scroll) */}
                                {msg.replyTo && (
                                  <div
                                    data-no-gesture
                                    onClick={() => {
                                      const el = document.getElementById(`msg_${msg.replyTo!.id}`);
                                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }}
                                    className={`mb-1 px-2 py-1 rounded-lg border-l-2 cursor-pointer transition-opacity hover:opacity-80 ${isSelf ? 'bg-indigo-900/40 border-l-indigo-400' : 'bg-slate-800 border-l-indigo-500'}`}
                                  >
                                    <span className="text-[10px] font-semibold text-indigo-300 block truncate">{msg.replyTo.senderName}</span>
                                    <span className="text-[11px] text-slate-400 block truncate">{msg.replyTo.content}</span>
                                  </div>
                                )}

                                {/* Message bubble + footer: thời gian dưới phải, ❤️+avatar dưới trái */}
                                <div className="flex flex-col">
                                <div id={`msg_${msg.id}`} className={`p-2.5 text-[14px] leading-relaxed ${isSelf ? 'bg-indigo-700 text-white rounded-2xl rounded-br-md' : 'bg-slate-800 text-slate-200 rounded-2xl rounded-bl-md'} ${msg.deleted ? 'opacity-60 italic' : ''}`}>
                                  <p className="whitespace-pre-wrap">{renderContentWithMentions(msg.content)}</p>
                                  {/* Attachments */}
                                  {msg.attachments && msg.attachments.length > 0 && !msg.deleted && (
                                    <div className="flex flex-wrap gap-1.5 mt-1.5" data-no-gesture>
                                      {msg.attachments.map((att: any) => (
                                        <div key={att.id} className="relative group">
                                          {att.type === 'image' || att.type === 'camera' ? (
                                            <img src={att.url} alt={att.name} onClick={() => setExpandedImage(att.url)}
                                              className="max-w-[200px] max-h-[150px] rounded-lg object-cover cursor-pointer border border-white/10 hover:opacity-90 transition-opacity" />
                                          ) : (
                                            <div onClick={() => window.open(att.url, '_blank')}
                                              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] cursor-pointer transition-colors">
                                              <File className="w-3.5 h-3.5 text-indigo-400" />
                                              <span className="truncate max-w-[120px]">{att.name}</span>
                                              <Download className="w-3 h-3 text-slate-400 shrink-0" />
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  </div>
                                  {/* Footer nằm DƯỚI bubble: ❤️+avatar (trái) | thời gian+đã xem (phải) */}
                                  <div className="flex items-center gap-2 mt-0.5 px-0.5">
                                    {/* Trái: ❤️ + avatar người đã thả tim */}
                                    {(() => {
                                      const heartGrp = msg.reactions?.find(g => g.emoji === '❤️');
                                      if (!heartGrp || heartGrp.users.length === 0) return null;
                                      return (
                                        <div className="flex items-center gap-0.5 flex-shrink-0"
                                          title={heartGrp.users.map(uid => employees.find(e => e.id === uid)?.name || uid).join(', ')}>
                                          <span className="text-[11px] leading-none">❤️</span>
                                          <div className="flex -space-x-1.5">
                                            {heartGrp.users.slice(0, 4).map(uid => {
                                              const emp = employees.find(e => e.id === uid);
                                              return (
                                                <UserAvatar key={uid} employee={emp || null} size="xs" noRing className="ring-slate-900/70" />
                                              );
                                            })}
                                          </div>
                                          {heartGrp.users.length > 4 && (
                                            <span className="text-[8px] text-slate-400">+{heartGrp.users.length - 4}</span>
                                          )}
                                        </div>
                                      );
                                    })()}

                                    {/* Phải: time + readBy + check — luôn sát phải (ml-auto) */}
                                    <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                                      <span className={`text-[10px] ${isSelf ? 'text-indigo-300' : 'text-slate-500'}`}>{formatTime(msg.createdAt)}</span>
                                      {msg.edited && <span className="text-[9px] text-slate-500">(đã sửa)</span>}
                                      {isSelf && !msg.deleted && msg.readBy && msg.readBy.length > 0 && (
                                        <div className="flex items-center gap-0.5"
                                          title={`Đã xem: ${msg.readBy.map(uid => employees.find(e => e.id === uid)?.name || uid).join(', ')}`}>
                                          <div className="flex -space-x-1">
                                            {msg.readBy.slice(0, 3).map(uid => {
                                              const emp = employees.find(e => e.id === uid);
                                              return <UserAvatar key={uid} employee={emp || null} size="xs" noRing className="ring-white/20" />;
                                            })}
                                          </div>
                                          {msg.readBy.length > 3 && <span className="text-[8px] text-slate-400">+{msg.readBy.length - 3}</span>}
                                        </div>
                                      )}
                                      {isSelf && !msg.deleted && <CheckCheck className="w-3 h-3 text-indigo-300" />}
                                    </div>
                                  </div>
                                </div>

                                {/* Action menu (reply / delete) */}
                                {!msg.deleted && (
                                  <div className={`flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ${isSelf ? 'justify-end' : ''}`}>
                                    <button
                                      onClick={() => setReplyToMsg({ id: msg.id, senderName: msg.senderName, content: msg.content })}
                                      className="text-slate-400 hover:text-indigo-400 text-[10px] cursor-pointer"
                                      title="Trả lời"
                                    >
                                      ↩ Trả lời
                                    </button>
                                    {msg.relatedEntity && (
                                      <>
                                        <button
                                          onClick={() => openRelatedEntity(msg)}
                                          className="text-indigo-400 hover:text-indigo-300 text-[10px] cursor-pointer font-medium"
                                          title="Xem chi tiết"
                                        >
                                          👁 Xem chi tiết
                                        </button>
                                        {(msg.relatedEntity?.type === 'task' || msg.relatedEntity?.type === 'mission' || msg.relatedEntity?.type === 'project') && (
                                          <button
                                            onClick={() => openProjectChatForEntity(msg.relatedEntity)}
                                            className="text-emerald-400 hover:text-emerald-300 text-[10px] cursor-pointer font-medium"
                                            title="Mở nhóm chat dự án của công việc này"
                                          >
                                            💬 Nhóm dự án
                                          </button>
                                        )}
                                      </>
                                    )}
                                    {isSelf && (
                                      <button
                                        onClick={() => handleDeleteMessage(msg.id)}
                                        className="text-slate-400 hover:text-rose-400 text-[10px] cursor-pointer"
                                        title="Xóa"
                                      >
                                        🗑️ Xóa
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Pending Attachments */}
                {showAttachPreview && pendingAttachments.length > 0 && (
                  <div className="px-3 py-2 bg-slate-900 border-t border-slate-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-slate-400 font-semibold">{pendingAttachments.length} tệp</span>
                      <button onClick={clearAttachments} className="text-[10px] text-rose-400 hover:text-white cursor-pointer">Xóa</button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto">
                      {pendingAttachments.map(att => (
                        <div key={att.id} className="relative shrink-0">
                          {att.type === 'image' || att.type === 'camera' ? (
                            <img src={att.url} alt={att.name} className="w-16 h-16 rounded-lg object-cover border border-slate-800" />
                          ) : (
                            <div className="w-16 h-16 rounded-lg border border-slate-800 bg-slate-800 flex flex-col items-center justify-center">
                              <File className="w-5 h-5 text-indigo-400" />
                              <span className="text-[7px] text-slate-400 truncate w-full text-center px-0.5">{att.name.slice(0, 12)}</span>
                            </div>
                          )}
                          <button onClick={() => setPendingAttachments(prev => prev.filter(a => a.id !== att.id))}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center cursor-pointer">
                            <X className="w-2.5 h-2.5 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* INPUT BAR */}
                {(selectedConv || pendingChatEmpId) && (
                  <div className="px-3 py-2.5 bg-slate-900 border-t border-slate-800 shrink-0">
                    {/* Reply banner */}
                    {replyToMsg && (
                      <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-slate-950 border-l-2 border-l-indigo-500 rounded-lg">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-semibold text-indigo-400 block truncate">Đang trả lời {replyToMsg.senderName}</span>
                          <span className="text-[11px] text-slate-400 block truncate">{replyToMsg.content}</span>
                        </div>
                        <button onClick={() => setReplyToMsg(null)} className="text-slate-400 hover:text-white cursor-pointer shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden"
                      onChange={e => handleFileSelected(e, 'image')} />
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden"
                      onChange={e => handleFileSelected(e, 'camera')} />
                    <form onSubmit={e => { e.preventDefault(); handleSendMessage(); }} className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-400 rounded-lg cursor-pointer transition-all" title="Gửi ảnh">
                          <Image className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => cameraInputRef.current?.click()}
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-400 rounded-lg cursor-pointer transition-all" title="Chụp hình">
                          <Camera className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-400 rounded-lg cursor-pointer transition-all" title="Đính kèm file">
                          <Paperclip className="w-4 h-4" />
                        </button>
                        <div onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className="relative w-8 h-8 flex items-center justify-center text-sm hover:bg-slate-800 rounded-lg cursor-pointer transition-all" title="Biểu tượng cảm xúc">
                          <Smile className="w-4 h-4 text-slate-400 hover:text-amber-400" />
                          {showEmojiPicker && (
                            <div className="absolute bottom-full left-0 mb-2 z-10" onClick={e => e.stopPropagation()}>
                              <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 shadow-2xl">
                                <div className="flex items-center gap-1.5">
                                  {quickEmojis.map(emoji => (
                                    <button key={emoji} type="button" onClick={(e) => { e.preventDefault(); setInputText(prev => prev + emoji); setShowEmojiPicker(false); }}
                                      className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-700 rounded-lg cursor-pointer transition-all">{emoji}</button>
                                  ))}
                                  <div className="w-px h-6 bg-slate-700 mx-0.5"></div>
                                  <button type="button" onClick={() => { handleSendMessage('👍'); setShowEmojiPicker(false); }}
                                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-700 rounded-lg cursor-pointer transition-all">
                                    <ThumbsUp className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="relative flex-1">
                        <input type="text"
                          placeholder={`Nhắn tin${(selectedConv?.type === 'group' || selectedConv?.type === 'task') ? ` đến ${selectedConv.name}` : ''}...`}
                          value={inputText}
                          onChange={e => {
                            const val = e.target.value;
                            setInputText(val);

                            // Detect @mention trigger trong group chat
                            if (selectedConv && (selectedConv.type === 'group' || selectedConv.type === 'task')) {
                              const lastAt = val.lastIndexOf('@');
                              if (lastAt >= 0 && (lastAt === 0 || val[lastAt - 1] === ' ')) {
                                const query = val.substring(lastAt + 1);
                                // Chỉ show picker nếu query không có khoảng trắng (chưa chọn xong)
                                if (!query.includes(' ')) {
                                  setMentionQuery(query.toLowerCase());
                                  setShowMentionPicker(true);
                                  return;
                                }
                              }
                            }
                            setShowMentionPicker(false);
                          }}
                          onFocus={() => { setShowEmojiPicker(false); setShowMentionPicker(false); }}
                          className="flex-1 bg-slate-800 border-none text-[14px] text-white rounded-lg px-4 py-2.5 placeholder-slate-400 outline-none w-full" />

                        {/* @MENTION PICKER DROPDOWN */}
                        {showMentionPicker && selectedConv && (selectedConv.type === 'group' || selectedConv.type === 'task') && (() => {
                          const memberIds = Array.from(new Set(selectedConv.participantIds.filter(Boolean)));
                          const filtered = employees.filter(e =>
                            memberIds.includes(e.id) &&
                            e.id !== currentUser.id &&
                            e.name.toLowerCase().includes(mentionQuery)
                          ).slice(0, 8);

                          if (filtered.length === 0) return null;

                          return (
                            <div className="absolute bottom-full left-0 mb-1 w-64 max-h-[220px] overflow-y-auto bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50">
                              <div className="px-3 py-1.5 border-b border-slate-700">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tag thành viên</span>
                              </div>
                              {filtered.map(emp => (
                                <button
                                  key={emp.id}
                                  type="button"
                                  onClick={() => {
                                    // Thay thế "@query" bằng "@Tên "
                                    const lastAt = inputText.lastIndexOf('@');
                                    const newText = inputText.substring(0, lastAt) + `@${emp.name} `;
                                    setInputText(newText);
                                    setShowMentionPicker(false);
                                    setMentionQuery('');
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-700 transition-colors cursor-pointer text-left"
                                >
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[8px] shrink-0 ${getAvatarBgColor(emp.name)}`}>
                                    {getAvatarFallback(emp.name)}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-[13px] text-white font-medium block truncate">{emp.name}</span>
                                    <span className="text-[10px] text-slate-400">{emp.department || emp.role || ''}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button type="submit"
                          className="w-9 h-9 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center transition-all cursor-pointer">
                          <Send className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

              {/* INFO PANEL (group only) */}
              {showInfoPanel && (selectedConv?.type === 'group' || selectedConv?.type === 'task') && (
                <div className="w-[260px] border-l border-slate-800 bg-slate-950 h-full p-4 overflow-y-auto space-y-4 shrink-0 z-20 absolute right-0 top-0 md:relative">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thông tin nhóm</h3>
                    <button onClick={() => setShowInfoPanel(false)} className="text-slate-400 hover:text-white cursor-pointer">
                      <ChevronLeft className="w-4 h-4 rotate-180" />
                    </button>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center font-bold text-lg shadow-md text-white"
                      style={{ backgroundColor: selectedConv.color || '#6366F1' }}>
                      {selectedConv.avatar || getAvatarFallback(selectedConv.name)}
                    </div>
                    <h4 className="font-bold text-white text-sm">{selectedConv.name}</h4>
                    <p className="text-[11px] text-slate-400">{getConvMemberCount(selectedConv)} thành viên</p>
                  </div>
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Thành viên</h5>
                    {getUniqueParticipantIds(selectedConv).map(id => {
                      const emp = employees.find(e => e.id === id);
                      // Nếu không tìm thấy nhân viên trong danh sách, hiển thị ID thay vì bỏ qua
                      const displayName = emp ? emp.name : `Người dùng ${id.substring(0, 8)}`;
                      const displayDept = emp ? (emp.role === 'director' ? 'Giám Đốc' : emp.department) : '—';
                      const avatarColor = emp ? getAvatarBgColor(emp.name) : 'bg-slate-700 text-white';
                      const avatarFallback = emp ? getAvatarFallback(emp.name) : '??';
                      return (
                        <div key={id} className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[8px] ${avatarColor} shrink-0`}>
                            {avatarFallback}
                          </div>
                          <div className="min-w-0">
                            <span className="text-[12px] text-white font-medium truncate block">
                              {displayName} {emp?.id === currentUser.id && <span className="text-[9px] text-indigo-400">(Bạn)</span>}
                            </span>
                            <span className="text-[9px] text-slate-500">{displayDept}</span>
                          </div>
                        </div>
                      );
                    })}
                    {/* Add member button */}
                    {(selectedConv.type === 'group' || selectedConv.type === 'task') && (
                      <button
                        onClick={() => setShowAddMember(true)}
                        className="w-full py-2 mt-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[12px] font-semibold rounded-lg transition-all cursor-pointer border border-dashed border-indigo-500/30 flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Thêm thành viên
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* EXPANDED IMAGE MODAL */}
      {expandedImage && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setExpandedImage(null)}>
          <div className="max-w-3xl max-h-[85vh] relative" onClick={e => e.stopPropagation()}>
            <img src={expandedImage} className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl" alt="Phóng to" />
            <button onClick={() => setExpandedImage(null)}
              className="absolute top-3 right-3 w-8 h-8 bg-slate-950/80 rounded-full flex items-center justify-center text-white cursor-pointer hover:bg-slate-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      {showCreateGroup && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">🆕 Tạo nhóm mới</h3>
              <button onClick={() => setShowCreateGroup(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4">
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Tên nhóm</label>
              <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                placeholder="VD: Dự án Biệt thự B2"
                className="w-full bg-slate-800 border border-slate-700 text-[13px] text-white rounded-lg px-3 py-2 outline-none focus:border-indigo-500/50" autoFocus />
            </div>
            <div className="mb-4">
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Thêm thành viên</label>
              <div className="max-h-[200px] overflow-y-auto space-y-1 border border-slate-700 rounded-lg p-2">
                {employees.filter(e => e.id !== currentUser.id && e.hasSystemAccount && !newGroupMembers.includes(e.id)).map(emp => (
                  <div key={emp.id} onClick={() => setNewGroupMembers(prev => [...prev, emp.id])}
                    className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors">
                    <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-[9px] font-bold text-indigo-400 shrink-0">
                      {emp.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-[12px] text-white flex-1">{emp.name}</span>
                    <span className="text-[9px] text-slate-500">{emp.department}</span>
                    <Plus className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                ))}
              </div>
            </div>
            {newGroupMembers.length > 0 && (
              <div className="mb-4">
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Thành viên đã chọn ({newGroupMembers.length})
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {newGroupMembers.map(id => {
                    const emp = employees.find(e => e.id === id);
                    if (!emp) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 bg-slate-800 text-white text-[10px] px-2 py-1 rounded-lg">
                        {emp.name}
                        <X className="w-3 h-3 cursor-pointer text-slate-400 hover:text-white"
                          onClick={() => setNewGroupMembers(prev => prev.filter(x => x !== id))} />
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowCreateGroup(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-400 text-[12px] font-semibold rounded-lg hover:bg-slate-700 transition-all cursor-pointer">
                Hủy
              </button>
              <button onClick={createGroup}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-semibold rounded-lg transition-all cursor-pointer">
                Tạo nhóm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL */}
      {showAddMember && selectedConv && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">👥 Thêm thành viên vào nhóm</h3>
              <button onClick={() => setShowAddMember(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4">
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Chọn nhân viên</label>
              <div className="max-h-[300px] overflow-y-auto space-y-1 border border-slate-700 rounded-lg p-2">
                {employees.filter(e => e.id !== currentUser.id && e.hasSystemAccount && !getUniqueParticipantIds(selectedConv).includes(e.id)).map(emp => (
                  <div key={emp.id} onClick={async () => {
                    const updated = await addMemberToConversation(selectedConv.id, emp.id);
                    if (updated) {
                      setSelectedConv(updated);
                      setConversations(getConversations());
                      addToast({ title: '✅ Đã thêm', message: `${emp.name} đã được thêm vào nhóm`, type: 'success' });
                    }
                  }}
                    className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors">
                    <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-[9px] font-bold text-indigo-400 shrink-0">
                      {emp.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-[12px] text-white flex-1">{emp.name}</span>
                    <span className="text-[9px] text-slate-500">{emp.department}</span>
                    <Plus className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                ))}
                {employees.filter(e => e.id !== currentUser.id && !getUniqueParticipantIds(selectedConv).includes(e.id)).length === 0 && (
                  <p className="text-[12px] text-slate-500 text-center py-4">Tất cả nhân viên đã có trong nhóm</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAddMember(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-400 text-[12px] font-semibold rounded-lg hover:bg-slate-700 transition-all cursor-pointer">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTEXT MENU (click chuột phải trên desktop → thả tim) */}
      {contextMenu && (() => {
        const ctxMsg = convMessages.find(m => m.id === contextMenu.msgId);
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={closeContextMenu} onContextMenu={e => { e.preventDefault(); closeContextMenu(); }} />
            <div
              className="fixed z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 min-w-[160px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button
                onClick={() => {
                  handleToggleReaction(contextMenu.msgId, '❤️');
                  closeContextMenu();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] transition-colors cursor-pointer ${
                  ctxMsg?.reactions?.some(g => g.emoji === '❤️' && g.users.includes(currentUser.id))
                    ? 'text-indigo-300 bg-indigo-500/20'
                    : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span className="text-[15px]">❤️</span>
                {ctxMsg?.reactions?.some(g => g.emoji === '❤️' && g.users.includes(currentUser.id))
                  ? 'Bỏ thả tim'
                  : 'Thả tim'}
              </button>
              {!ctxMsg?.deleted && (
                <button
                  onClick={() => {
                    if (ctxMsg) setReplyToMsg({ id: ctxMsg.id, senderName: ctxMsg.senderName, content: ctxMsg.content });
                    closeContextMenu();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <span className="text-[15px]">↩️</span>
                  Trả lời
                </button>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
}
