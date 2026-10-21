// Gom "Việc của tôi" thành danh sách phẳng cho tab Việc của tôi trong Tin nhắn (hàm thuần, dễ kiểm tra).
// Nguồn: việc/nhiệm vụ (lib/myWork.ts) + các mục chờ xử lý (đề xuất, phiếu chi, nghỉ phép, vật tư… do App dựng sẵn).
import type { Task } from '../types';
import type { InboxItem, InboxAction } from '../components/MyWorkOverview';
import { bucketOf, BUCKET_LABEL, BUCKET_ORDER, type Bucket, type MyWorkItem } from './myWork';
import { uniqueMembers } from './workThread';

export type WorkSection = 'inbox' | Bucket;
export const SECTION_LABEL: Record<WorkSection, string> = { inbox: 'Chờ tôi xử lý', ...BUCKET_LABEL };
export const SECTION_ORDER: WorkSection[] = ['inbox', ...BUCKET_ORDER];

export interface WorkEntry {
  key: string;                       // khóa duy nhất → sinh mã luồng thảo luận
  kind: 'task' | 'mission' | 'approval';
  chip: string; chipTone: InboxItem['chipTone'] | 'slate';
  title: string; meta: string; project: string;
  due: string; rate: number | null; status: string;
  amount?: number; right?: string;
  memberIds: string[];               // người tham gia luồng thảo luận (đã gồm tôi)
  actions: InboxAction[];
  section: WorkSection;
}

export function buildWorkEntries(o: {
  items: MyWorkItem[]; inbox: InboxItem[]; tasks: Task[]; me: string; today: string;
  onReceive: (it: MyWorkItem) => void; onOpenTask: (taskId: string) => void;
}): WorkEntry[] {
  const out: WorkEntry[] = [];
  // 1) Mục chờ xử lý — đưa lên đầu; thảo luận giữa tôi và người lập/đề xuất (chưa rõ người lập → chỉ mình tôi, người khác được thêm khi họ mở)
  for (const a of o.inbox) {
    out.push({
      key: `ap:${a.key}`, kind: 'approval', chip: a.chip, chipTone: a.chipTone, title: a.title, meta: a.meta, project: '',
      due: '', rate: null, status: 'pending', amount: a.amount, right: a.right, memberIds: uniqueMembers([o.me, ...(a.memberIds || [])]),
      actions: a.actions, section: 'inbox',
    });
  }
  // 2) Việc & nhiệm vụ đang mở của tôi, chia theo mốc thời gian
  for (const it of o.items) {
    if (it.status === 'completed') continue;
    const t = o.tasks.find(x => x.id === it.taskId);
    const mis = it.missionId ? (t?.missions || []).find(m => m.id === it.missionId) : undefined;
    const members = uniqueMembers([o.me, t?.assigneeId, t?.assignerId, mis?.mainAssigneeId, ...(mis?.memberIds || [])]);
    const actions: InboxAction[] = [];
    if (it.canReceive) actions.push({ label: 'Nhận việc', tone: 'main', onClick: () => o.onReceive(it) });
    actions.push({ label: 'Mở chi tiết', tone: 'plain', onClick: () => o.onOpenTask(it.taskId) });
    out.push({
      key: it.key, kind: it.kind, chip: it.kind === 'task' ? 'Công việc' : 'Nhiệm vụ', chipTone: it.kind === 'task' ? 'sky' : 'violet',
      title: it.title, meta: [it.project || 'Nhiệm vụ nội bộ', it.kind === 'mission' ? it.taskName : ''].filter(Boolean).join(' · '),
      project: it.project, due: it.due, rate: it.rate, status: it.status, memberIds: members, actions, section: bucketOf(it.due, o.today),
    });
  }
  // Trong mỗi nhóm: hạn gần nhất trước (mục chờ xử lý giữ thứ tự gốc)
  return out.sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section)
    || (a.section === 'inbox' ? 0 : (a.due || '9999').localeCompare(b.due || '9999') || a.title.localeCompare(b.title, 'vi')));
}
