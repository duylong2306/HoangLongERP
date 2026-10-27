import { useCallback, useEffect, useState } from 'react';
import { EVENT_TYPE_META, loadTodayProjectEvents, type ProjectEventRow } from '../lib/projectEvents';
import { TONE } from './ProjectActivityModal';

interface Props {
  projectId: string;
  /** Bấm "Xem thêm" → mở khung Nhật ký dự án */
  onOpen: () => void;
  /** Số dòng hiện sẵn; còn lại gom vào "Xem thêm N hoạt động" */
  maxItems?: number;
  /** Dùng cho kiểm thử: thay hàm tải */
  loader?: typeof loadTodayProjectEvents;
}

const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

/**
 * Thẻ "Hôm nay" trong khung Thông tin hội thoại của nhóm dự án: dòng thời gian THU NHỎ các hoạt động của Nhật ký trong ngày
 * (cùng ngôn ngữ với khung Nhật ký: chấm tròn + nhãn màu theo loại). Chưa có hoạt động nào → hiện 1 dòng nhắc; chưa bật nhật ký → ẩn.
 */
export default function ProjectTodayCard({ projectId, onOpen, maxItems = 4, loader = loadTodayProjectEvents }: Props) {
  const [rows, setRows] = useState<ProjectEventRow[] | null>(null);   // null = đang tải lần đầu
  const load = useCallback(() => { loader(projectId).then(setRows).catch(() => setRows([])); }, [loader, projectId]);

  // Tải lúc mở / đổi dự án, mỗi 60 giây, khi quay lại cửa sổ và khi nhật ký của dự án này vừa có sự kiện mới
  useEffect(() => {
    setRows(null);
    load();
    const timer = setInterval(load, 60000);
    const onNew = (e: any) => { if (!e?.detail?.projectId || e.detail.projectId === projectId) load(); };
    window.addEventListener('focus', load);
    window.addEventListener('hl-project-events-updated', onNew);
    return () => { clearInterval(timer); window.removeEventListener('focus', load); window.removeEventListener('hl-project-events-updated', onNew); };
  }, [load, projectId]);

  if (rows === null) return null;
  const shown = rows.slice(0, maxItems);
  const rest = rows.length - shown.length;
  return (
    <div className="mt-3 border border-slate-200 rounded-2xl p-3" data-testid="today-card">
      <div className="flex items-baseline gap-2 mb-2">
        <b className="text-[13px]">Hôm nay</b>
        <span className="text-[11.5px] text-slate-500">{ddmm(new Date())}{rows.length > 0 ? ` · ${rows.length} hoạt động` : ''}</span>
      </div>
      {rows.length === 0 ? (
        <div className="text-[12px] text-slate-500" data-testid="today-empty">Hôm nay chưa có hoạt động nào.</div>
      ) : (
        <div className="relative ml-3 border-l-2 border-slate-200 pl-5" data-testid="today-list">
          {shown.map(ev => {
            const meta = EVENT_TYPE_META[ev.type]; const tone = TONE[meta.tone] || TONE.slate;
            return (
              <div key={ev.id} className="relative pt-1 pb-2.5 last:pb-0" data-testid="today-item">
                <span className={`absolute -left-[33px] top-1.5 w-6 h-6 rounded-full border-2 grid place-items-center text-[11px] ${tone.dot}`}>{meta.icon}</span>
                <div className="text-[12.5px] leading-snug line-clamp-2">{ev.actorName && <b>{ev.actorName} </b>}{ev.text}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className={`font-bold border rounded-full px-2 ${tone.badge}`}>{meta.label}</span>
                  <span>{hhmm(ev.createdAt)}</span>
                  {ev.attachments && ev.attachments.length > 0 && <span>📎 {ev.attachments.length} tệp</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {rest > 0 && (
        <button type="button" onClick={onOpen} className="mt-2 w-full text-center text-[12.5px] font-bold text-[#0d47c9] cursor-pointer" data-testid="today-more">Xem thêm {rest} hoạt động ›</button>
      )}
    </div>
  );
}
