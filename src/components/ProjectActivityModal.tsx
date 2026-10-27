import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Download, Search, Loader2 } from 'lucide-react';
import { markProjectSeen } from '../lib/projectEventReads';
import { EVENT_TYPE_META, EVENT_PAGE_DAYS, loadProjectEventsPage, type EventFilters, type ProjectEventRow, type ProjectEventType } from '../lib/projectEvents';

// NHẬT KÝ HOẠT ĐỘNG DỰ ÁN / CÔNG VIỆC — dòng thời gian (kiểu A trong bản xem trước docs/preview-nhat-ky).
// Mở từ: Tin nhắn (cạnh nút "Mở dự án"), chi tiết dự án, chi tiết công việc (truyền taskId → "Lịch sử" riêng của việc).
// Tải theo CỤM 3 NGÀY mỗi lần cuộn xuống (giống tải tin nhắn cũ): cuộn gần cuối là tự tải 3 ngày trước đó.
interface Props {
  projectId: string;
  projectName?: string;
  /** Có taskId → chỉ hiện lịch sử của công việc đó */
  taskId?: string;
  taskName?: string;
  onClose: () => void;
  /** Có hàm này mới hiện nút "Xuất Excel" (dữ liệu dự án đầy đủ do nơi gọi cung cấp) */
  onExport?: () => void | Promise<void>;
  /** Mặc định mở công việc bằng sự kiện 'hl-open-task' (như nút ở khung thông tin hội thoại) */
  /** missionId: mở thẳng nhiệm vụ trong công việc (nếu sự kiện thuộc 1 nhiệm vụ) */
  onOpenTask?: (taskId: string, missionId?: string) => void;
  /** Người đang xem: có thì đánh dấu "đã xem nhật ký dự án" khi mở và khi đóng (chỉ với nhật ký cả dự án, không phải lịch sử 1 công việc) */
  viewerId?: string;
  /** Dùng cho kiểm thử: thay hàm tải trang */
  loader?: typeof loadProjectEventsPage;
}

const TONE: Record<string, { dot: string; badge: string }> = {
  sky:     { dot: 'border-sky-300 bg-sky-50',         badge: 'text-sky-700 bg-sky-50 border-sky-200' },
  blue:    { dot: 'border-blue-300 bg-blue-50',       badge: 'text-blue-700 bg-blue-50 border-blue-200' },
  emerald: { dot: 'border-emerald-300 bg-emerald-50', badge: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  amber:   { dot: 'border-amber-300 bg-amber-50',     badge: 'text-amber-700 bg-amber-50 border-amber-200' },
  violet:  { dot: 'border-violet-300 bg-violet-50',   badge: 'text-violet-700 bg-violet-50 border-violet-200' },
  rose:    { dot: 'border-rose-300 bg-rose-50',       badge: 'text-rose-700 bg-rose-50 border-rose-200' },
  red:     { dot: 'border-red-300 bg-red-50',         badge: 'text-red-700 bg-red-50 border-red-200' },
  slate:   { dot: 'border-slate-300 bg-slate-50',     badge: 'text-slate-600 bg-slate-50 border-slate-200' },
};
const OBJ_LABEL: Record<string, string> = { project: 'Dự án', task: 'Công việc', mission: 'Nhiệm vụ', proposal: 'Đề xuất', payment: 'Phiếu chi', material: 'Vật tư' };

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const dayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const WEEK = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Hôm qua';
  return `${WEEK[date.getDay()]}, ${pad(d)}/${pad(m)}/${y}`;
}

export default function ProjectActivityModal({ projectId, projectName, taskId, taskName, onClose, onExport, onOpenTask, viewerId, loader = loadProjectEventsPage }: Props) {
  const [rows, setRows] = useState<ProjectEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | undefined>();
  const [notEnabled, setNotEnabled] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  // Bộ lọc áp dụng Ở MÁY CHỦ (tìm trong toàn bộ lịch sử, không chỉ phần đã tải): loại, đối tượng, người, ngày, chữ
  const [type, setType] = useState<'' | ProjectEventType>('');
  const [kind, setKind] = useState('');
  const [who, setWho] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [known, setKnown] = useState<string[]>([]); // danh sách người đã gặp (để chọn lọc dù đang lọc theo người khác)
  const [open, setOpen] = useState<Set<string>>(new Set());
  const boxRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false); // chặn tải trùng khi cuộn liên tục
  const asked = useRef<string | undefined>(undefined); // mốc `before` đã xin rồi — không bao giờ xin lại cùng một trang (cuộn + tự lấp đầy có thể chạm nhau)

  useEffect(() => { const t = setTimeout(() => setQDebounced(q), 350); return () => clearTimeout(t); }, [q]);
  const filters = useMemo<EventFilters>(() => ({
    type: type || undefined, objKind: kind || undefined, actorName: who || undefined, from: from || undefined, to: to || undefined, q: qDebounced || undefined,
  }), [type, kind, who, from, to, qDebounced]);
  const hasFilter = !!(type || kind || who || from || to || qDebounced);

  // Tải trang đầu (3 ngày mới nhất khớp bộ lọc)
  const loadFirst = useCallback(async () => {
    setLoading(true); setError(''); asked.current = undefined;
    const r = await loader(projectId, { taskId, filters });
    setNotEnabled(!!r.notEnabled);
    if (!r.ok && !r.notEnabled) setError(r.message || 'Không tải được nhật ký.');
    setRows(r.rows); setHasMore(r.hasMore); setNextBefore(r.nextBefore);
    setKnown(prev => Array.from(new Set([...prev, ...(r.rows.map(x => x.actorName).filter(Boolean) as string[])])));
    setLoading(false);
  }, [projectId, taskId, loader, filters]);
  useEffect(() => { loadFirst(); }, [loadFirst]);

  // Đánh dấu đã xem (xóa chấm số / dải "Cập nhật mới"): lúc mở và lúc đóng — hoạt động đến trong lúc đang mở cũng tính là đã xem
  useEffect(() => {
    if (!viewerId || taskId) return;
    markProjectSeen(viewerId, projectId);
    return () => { markProjectSeen(viewerId, projectId); };
  }, [viewerId, projectId, taskId]);

  // Có sự kiện mới (của chính dự án này) → tải lại từ đầu
  useEffect(() => {
    const onNew = (e: any) => { if (!e?.detail?.projectId || e.detail.projectId === projectId) loadFirst(); };
    window.addEventListener('hl-project-events-updated', onNew);
    return () => window.removeEventListener('hl-project-events-updated', onNew);
  }, [projectId, loadFirst]);

  // Tải thêm 3 ngày cũ hơn
  const loadMore = useCallback(async () => {
    if (busy.current || !hasMore || !nextBefore || asked.current === nextBefore) return;
    busy.current = true; asked.current = nextBefore; setLoading(true);
    const r = await loader(projectId, { taskId, before: nextBefore, filters });
    if (r.ok) {
      // gộp theo id để chắc chắn không trùng dòng khi 2 lần tải chạm nhau
      setRows(prev => { const seen = new Set(prev.map(x => x.id)); return [...prev, ...r.rows.filter(x => !seen.has(x.id))]; });
      setHasMore(r.hasMore); setNextBefore(r.nextBefore);
    } else setError(r.message || 'Không tải thêm được.');
    setLoading(false); busy.current = false;
  }, [hasMore, nextBefore, projectId, taskId, loader, filters]);

  const onScroll = () => {
    const el = boxRef.current; if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) loadMore();
  };
  // Khung quá cao (màn lớn) làm 3 ngày chưa đủ tạo thanh cuộn → tự tải tiếp cho tới khi cuộn được hoặc hết
  useEffect(() => {
    const el = boxRef.current;
    if (el && hasMore && !loading && el.scrollHeight <= el.clientHeight + 4) loadMore();
  }, [rows, hasMore, loading, loadMore]);

  const shown = rows; // đã lọc ở máy chủ
  const groups = useMemo(() => {
    const out: { key: string; items: ProjectEventRow[] }[] = [];
    shown.forEach(r => { const k = dayKey(r.createdAt); const g = out[out.length - 1]; if (g && g.key === k) g.items.push(r); else out.push({ key: k, items: [r] }); });
    return out;
  }, [shown]);

  const openTask = (id: string, missionId?: string) => (onOpenTask ? onOpenTask(id, missionId) : window.dispatchEvent(new CustomEvent('hl-open-task', { detail: { taskId: id, missionId } })));
  const doExport = async () => { if (!onExport || exporting) return; setExporting(true); try { await onExport(); } finally { setExporting(false); } };

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex justify-end" data-testid="activity-modal" onClick={onClose}>
      <div className="w-full sm:max-w-[560px] h-full bg-white flex flex-col" onClick={e => e.stopPropagation()}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {/* Tiêu đề nền xanh LoLo */}
        <div className="shrink-0 px-4 py-3 flex items-center gap-2" style={{ background: '#0d47c9', color: '#ffffff' }}>
          <div className="min-w-0 flex-1">
            <div className="font-extrabold text-[15px] truncate" style={{ color: '#ffffff' }}>{taskId ? 'Lịch sử công việc' : 'Nhật ký dự án'}</div>
            <div className="text-[11.5px] truncate" style={{ color: '#dbe7ff' }}>{taskId ? (taskName || '') : (projectName || '')}</div>
          </div>
          {onExport && (
            <button type="button" onClick={doExport} disabled={exporting} data-testid="activity-export"
              className="shrink-0 flex items-center gap-1 text-[12px] font-bold rounded-lg px-2.5 py-1.5 cursor-pointer disabled:opacity-60" style={{ background: '#ffffff', color: '#0d47c9' }}>
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Xuất Excel
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Đóng" className="shrink-0 p-1.5 rounded-lg cursor-pointer" style={{ color: '#ffffff' }}><X className="w-5 h-5" /></button>
        </div>

        {/* Bộ lọc (áp dụng trên toàn bộ lịch sử) */}
        <div className="shrink-0 px-3 py-2 bg-slate-50 border-b border-slate-200 space-y-2" data-testid="activity-filters">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm người, công việc, nội dung…" data-testid="activity-search"
                className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-2 py-2 text-[12.5px] outline-none focus:border-blue-400" />
            </div>
            <select value={who} onChange={e => setWho(e.target.value)} aria-label="Lọc theo người" className="bg-white border border-slate-200 rounded-lg px-2 text-[12.5px] max-w-[120px]">
              <option value="">Mọi người</option>
              {known.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" data-testid="activity-kinds">
            {([['', 'Mọi đối tượng'], ...(taskId ? [] : [['project', 'Dự án'], ['task', 'Công việc'], ['mission', 'Nhiệm vụ'], ['proposal', 'Đề xuất']]), ...(taskId ? [['mission', 'Nhiệm vụ'], ['proposal', 'Đề xuất']] : [])] as [string, string][]).map(([k, label]) => (
              <button key={k || 'all'} type="button" onClick={() => setKind(k)}
                className={`shrink-0 text-[11.5px] font-bold rounded-full px-3 py-1 border cursor-pointer ${kind === k ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-200 text-slate-600'}`}
                style={kind === k ? { color: '#ffffff' } : undefined}>{label}</button>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" data-testid="activity-types">
            {([['', 'Tất cả loại'], ...Object.entries(EVENT_TYPE_META).map(([k, v]) => [k, `${v.icon} ${v.label}`])] as [string, string][]).map(([k, label]) => (
              <button key={k || 'all'} type="button" onClick={() => setType(k as any)}
                className={`shrink-0 text-[11.5px] font-bold rounded-full px-3 py-1 border cursor-pointer ${type === k ? 'bg-[#0d47c9] border-[#0d47c9]' : 'bg-white border-slate-200 text-slate-600'}`}
                style={type === k ? { color: '#ffffff' } : undefined}>{label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[12px] text-slate-600">
            Từ <input type="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="Từ ngày" className="bg-white border border-slate-200 rounded-lg px-2 py-1" />
            đến <input type="date" value={to} onChange={e => setTo(e.target.value)} aria-label="Đến ngày" className="bg-white border border-slate-200 rounded-lg px-2 py-1" />
            {hasFilter && <button type="button" onClick={() => { setType(''); setKind(''); setWho(''); setFrom(''); setTo(''); setQ(''); }} data-testid="activity-clear"
              className="ml-auto text-[11.5px] font-bold text-red-600 cursor-pointer">Xóa lọc</button>}
          </div>
        </div>

        {/* Dòng thời gian */}
        <div ref={boxRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto px-3 pb-6" data-testid="activity-scroll" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
          {notEnabled && (
            <div className="my-3 text-[12.5px] bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3" data-testid="activity-not-enabled">
              Nhật ký chưa được bật cho hệ thống này. Quản trị cần chạy file <b>supabase/migrations/20261027_project_events.sql</b> trong Supabase.
            </div>
          )}
          {error && <div className="my-3 text-[12.5px] bg-red-50 border border-red-200 text-red-700 rounded-xl p-3">{error}</div>}
          {!loading && !notEnabled && !error && groups.length === 0 && (
            <div className="text-center text-slate-400 text-[13px] py-12" data-testid="activity-empty">{hasFilter ? 'Không có sự kiện phù hợp bộ lọc.' : 'Chưa có hoạt động nào được ghi lại.'}</div>
          )}
          {groups.map(g => (
            <div key={g.key} data-testid="activity-day">
              <div className="sticky top-0 z-10 bg-white/95 py-2 flex items-center gap-2 text-[11.5px] font-extrabold text-slate-500">
                {dayLabel(g.key)}<span className="flex-1 h-px bg-slate-200" />
              </div>
              <div className="ml-3 border-l-2 border-slate-200 pl-5">
                {g.items.map(ev => {
                  const meta = EVENT_TYPE_META[ev.type]; const tone = TONE[meta.tone] || TONE.slate; const isOpen = open.has(ev.id);
                  return (
                    <div key={ev.id} className="relative py-2 px-2 rounded-xl hover:bg-slate-50" data-testid="activity-event">
                      <span className={`absolute -left-[33px] top-2.5 w-6 h-6 rounded-full border-2 grid place-items-center text-[11px] ${tone.dot}`}>{meta.icon}</span>
                      <div className="text-[13.5px] leading-snug">
                        {ev.actorName && <b>{ev.actorName} </b>}{ev.text}
                        {ev.objName && (ev.taskId && !taskId
                          ? <button type="button" onClick={() => openTask(ev.taskId!, ev.missionId)} className="ml-1 text-[11.5px] font-bold text-blue-700 bg-blue-50 rounded px-1.5 cursor-pointer">{ev.objName}</button>
                          : <span className="ml-1 text-[11.5px] font-bold text-blue-700 bg-blue-50 rounded px-1.5">{ev.objName}</span>)}
                      </div>
                      {(ev.from || ev.to) && (
                        <div className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
                          {ev.from && <><s className="text-red-600">{ev.from}</s><span>→</span></>}<b className="text-emerald-700">{ev.to}</b>
                        </div>
                      )}
                      {ev.detail && (
                        <div className="mt-1">
                          <button type="button" onClick={() => setOpen(prev => { const n = new Set(prev); n.has(ev.id) ? n.delete(ev.id) : n.add(ev.id); return n; })}
                            className="text-[11.5px] font-bold text-slate-500 cursor-pointer">{isOpen ? 'Thu gọn ▲' : 'Xem chi tiết ▼'}</button>
                          {isOpen && <div className="mt-1 text-[12.5px] text-slate-600 whitespace-pre-line bg-slate-50 border border-slate-200 rounded-lg p-2">{ev.detail}</div>}
                        </div>
                      )}
                      {ev.attachments && (
                        // Ảnh/tệp đính kèm (báo cáo hoàn thành…): ảnh hiện thu nhỏ, bấm mở bản đầy đủ ở tab mới
                        <div className="mt-1.5 flex flex-wrap gap-1.5" data-testid="activity-attachments">
                          {ev.attachments.map((a, i) => (a.type === 'image' || a.type === 'camera'
                            ? <a key={a.id || i} href={a.url} target="_blank" rel="noreferrer" title={a.name}><img src={a.url} alt={a.name || 'Ảnh'} loading="lazy" className="w-16 h-16 object-cover rounded-lg border border-slate-200" /></a>
                            : <a key={a.id || i} href={a.url} target="_blank" rel="noreferrer" className="text-[11.5px] font-bold text-blue-700 bg-blue-50 rounded px-2 py-1 max-w-[220px] truncate">📎 {a.name || 'Tệp đính kèm'}</a>))}
                        </div>
                      )}
                      <div className="mt-1 flex gap-2 items-center text-[11px] text-slate-500">
                        <span className={`font-bold border rounded-full px-2 ${tone.badge}`}>{meta.label}</span>
                        <span>{hhmm(ev.createdAt)}</span>
                        {ev.objKind && <span>{OBJ_LABEL[ev.objKind] || ''}</span>}
                        {/* Lối tắt về công việc / nhiệm vụ của sự kiện (không hiện khi đang xem lịch sử của chính công việc đó) */}
                        {ev.taskId && !taskId && <button type="button" onClick={() => openTask(ev.taskId!, ev.missionId)} className="font-bold text-blue-700 cursor-pointer" data-testid="activity-open-task">Mở {ev.objKind === 'mission' ? 'nhiệm vụ' : 'công việc'} ›</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {loading && <div className="flex justify-center py-4 text-slate-400" data-testid="activity-loading"><Loader2 className="w-5 h-5 animate-spin" /></div>}
          {!loading && hasMore && (
            <button type="button" onClick={loadMore} data-testid="activity-more"
              className="block mx-auto my-3 text-[12px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 cursor-pointer">Tải {EVENT_PAGE_DAYS} ngày trước đó</button>
          )}
          {!loading && !hasMore && rows.length > 0 && <div className="text-center text-[11.5px] text-slate-400 py-3">— Đã hiện toàn bộ lịch sử —</div>}
        </div>
      </div>
    </div>
  );
}
