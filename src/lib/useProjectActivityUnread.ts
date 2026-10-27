// SỐ DỰ ÁN CÓ HOẠT ĐỘNG MỚI trong Nhật ký (chưa xem) — cộng vào huy hiệu menu "Tin nhắn" và chuông, để người dùng thấy
// ngay cả khi chưa mở màn Tin nhắn. Quy ước: MỖI DỰ ÁN TÍNH 1 (dự án có động tĩnh = +1, không cộng theo số hoạt động).
import { useEffect, useState } from 'react';
import { loadUnreadSummary, projectIdOfConversation, type UnreadSummary } from './projectEventReads';

/** Khóa chuỗi (ổn định) các dự án mà người dùng có nhóm chat; bỏ nhóm đã tắt thông báo để huy hiệu nhất quán với số tin chưa đọc */
export function activityProjectKey(convs: { id: string; projectId?: string; taskId?: string }[], mutedIds: string[]): string {
  const muted = new Set(mutedIds);
  const ids = new Set<string>();
  for (const c of convs) {
    if (muted.has(c.id)) continue;
    const pid = projectIdOfConversation(c);
    if (pid) ids.add(pid);
  }
  return Array.from(ids).sort().join(',');
}

/** Số dự án có ít nhất 1 hoạt động mới */
export const countProjectsWithNew = (summary: Record<string, UnreadSummary>): number =>
  Object.values(summary).filter(s => (s?.count || 0) > 0).length;

/**
 * Tải số dự án có hoạt động mới: lúc mở, mỗi 60 giây, khi quay lại cửa sổ và khi vừa đánh dấu đã xem
 * (cùng nhịp với màn Tin nhắn; nhật ký chưa có realtime).
 */
export function useProjectActivityUnread(userId: string | undefined, projectKey: string): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const ids = projectKey ? projectKey.split(',') : [];
    if (!userId || ids.length === 0) { setCount(0); return; }
    let alive = true;
    const refresh = () => { loadUnreadSummary(userId, ids).then(r => { if (alive) setCount(countProjectsWithNew(r)); }); };
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    window.addEventListener('hl-project-seen', refresh);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('hl-project-seen', refresh); };
  }, [userId, projectKey]);
  return count;
}
