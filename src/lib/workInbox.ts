// Dựng danh sách "CHỜ TÔI XỬ LÝ" cho tab Việc của tôi trong Tin nhắn (hàm thuần).
// Đầu vào là các danh sách ĐÃ LỌC theo quyền bằng đúng hàm của menu Việc của tôi (lib/approvalInbox.ts, materialApproval.ts…) —
// hàm này chỉ định dạng thành thẻ và gắn "người cùng thảo luận" (người lập/đề xuất, khớp theo MÃ nhân viên).
// Giai đoạn này nút trong thẻ MỞ nơi xử lý có sẵn; duyệt/từ chối ngay trong chat sẽ làm ở giai đoạn sau.
import type { InboxItem } from '../components/MyWorkOverview';
import { materialProposalTotal, COORDINATOR_STATUS_LABEL } from './materialApproval';

export interface WorkInboxInput {
  employeeIds: Set<string>;                         // để chỉ nhận mã thật của nhân viên làm thành viên thảo luận
  reviewingTasks: { id: string; name: string; project: string; assigneeId?: string }[];
  leaves: { id: string; empId?: string; empName: string; type: string; fromDate: string; toDate: string }[];
  payments: { id: string; recipient: string; notes?: string; amount: number; proposerId?: string }[];
  advances: { id: string; reason?: string; projectName?: string; creatorName?: string; creator?: string; amount: number }[];
  travel: any[];
  vouchers: { id: string; reason?: string; projectName?: string; creatorName?: string; creator?: string; amount: number }[];
  materialToApprove: any[];
  materialToCoordinate: any[];
  open: {
    task: (id: string) => void;                     // mở chi tiết công việc
    finance: (proposalId: string) => void;          // mở form lập phiếu
    material: (proposalId: string) => void;         // mở chi tiết đề xuất vật tư
    myWork: () => void;                             // mở menu Việc của tôi (nơi duyệt/từ chối)
    /** Duyệt/Từ chối NGAY (chỉ phiếu chi và đề xuất thu chi); không truyền thì các thẻ chỉ có nút mở nơi xử lý */
    approve?: (kind: 'pm' | 'ad', id: string, decision: 'approved' | 'rejected') => void;
  };
}

export function buildWorkInbox(i: WorkInboxInput): InboxItem[] {
  const mem = (...ids: (string | undefined)[]) => ids.filter((x): x is string => !!x && i.employeeIds.has(x));
  const out: InboxItem[] = [];
  const goMy: InboxItem['actions'] = [{ label: 'Mở & xử lý', tone: 'main', onClick: i.open.myWork }];
  // Nút Duyệt/Từ chối ngay — luôn hỏi xác nhận (liên quan tiền). Từ chối đứng trước, Duyệt đứng sau (cùng thứ tự menu Việc của tôi).
  const decide = (kind: 'pm' | 'ad', id: string, what: string): InboxItem['actions'] => !i.open.approve ? goMy : [
    { label: 'Từ chối', tone: 'no', onClick: () => { if (window.confirm(`Từ chối ${what}?`)) i.open.approve!(kind, id, 'rejected'); } },
    { label: 'Duyệt', tone: 'ok', onClick: () => { if (window.confirm(`Duyệt ${what}?`)) i.open.approve!(kind, id, 'approved'); } },
    { label: 'Mở chi tiết', tone: 'plain', onClick: i.open.myWork },
  ];
  i.reviewingTasks.forEach(t => out.push({ key: `rv:${t.id}`, chip: 'Duyệt việc', chipTone: 'sky', title: t.name, meta: `${t.project || 'Nhiệm vụ nội bộ'} · chờ duyệt kết quả`, memberIds: mem(t.assigneeId), actions: [{ label: 'Mở & duyệt', tone: 'main', onClick: () => i.open.task(t.id) }] }));
  i.leaves.forEach(l => out.push({ key: `lv:${l.id}`, chip: 'Nghỉ phép', chipTone: 'rose', title: `${l.empName} — ${l.type}`, meta: `${l.fromDate} → ${l.toDate}`, memberIds: mem(l.empId), actions: goMy }));
  i.payments.forEach(p => out.push({ key: `pm:${p.id}`, chip: 'Phiếu chi', chipTone: 'amber', title: `Phát cho ${p.recipient}`, meta: `${p.notes || ''}`.slice(0, 90), amount: p.amount, memberIds: mem(p.proposerId), actions: decide('pm', p.id, `phiếu chi ${p.amount.toLocaleString('vi-VN')}đ cho ${p.recipient}`) }));
  i.advances.forEach(a => out.push({ key: `ad:${a.id}`, chip: 'Duyệt chi', chipTone: 'amber', title: (a.reason || a.id).slice(0, 90), meta: `${a.projectName || '—'} · ${a.creatorName || a.creator || ''} · ${a.id}`, amount: a.amount, memberIds: mem(a.creator), actions: decide('ad', a.id, `đề xuất ${a.id} (${a.amount.toLocaleString('vi-VN')}đ)`) }));
  i.travel.forEach((t: any) => out.push({ key: `tr:${t.rowId || t.id}`, chip: 'Công tác phí', chipTone: 'emerald', title: `${t.creatorName || t.employeeName || 'Nhân viên'} — ${t.code || t.id}`, meta: `${t.completedDate || t.createdAt || ''}`, amount: Number(t.amount || 0), memberIds: mem(t.creatorId, t.employeeId), actions: goMy }));
  i.vouchers.forEach(v => out.push({ key: `vc:${v.id}`, chip: 'Lập phiếu', chipTone: 'orange', title: (v.reason || v.id).slice(0, 90), meta: `${v.projectName || '—'} · ${v.creatorName || v.creator || 'Kế Toán'} · ${v.id}`, amount: v.amount, memberIds: mem(v.creator), actions: [{ label: 'Lập phiếu (KT)', tone: 'main', onClick: () => i.open.finance(v.id) }] }));
  i.materialToApprove.forEach((m: any) => out.push({ key: `mp:${m.id}`, chip: 'Vật tư', chipTone: 'violet', title: `${m.code || m.id} — chờ duyệt`, meta: `${m.projectName || 'Không gắn dự án'} · ${m.createdByName || ''} · ${(m.items || []).length} dòng`, amount: materialProposalTotal(m), memberIds: mem(m.createdBy, m.createdById), actions: [{ label: 'Xem & duyệt', tone: 'main', onClick: () => i.open.material(m.id) }] }));
  i.materialToCoordinate.forEach((m: any) => out.push({ key: `mc:${m.id}`, chip: 'Vật tư', chipTone: 'violet', title: `${m.code || m.id} — ${COORDINATOR_STATUS_LABEL[m.status] || m.status}`, meta: `${m.projectName || 'Không gắn dự án'} · ${m.createdByName || ''} · ${(m.items || []).length} dòng`, right: m.status === 'find_supplier' ? 'Tìm NCC' : 'Chờ đặt hàng', memberIds: mem(m.createdBy, m.createdById), actions: [{ label: 'Mở & xử lý', tone: 'main', onClick: () => i.open.material(m.id) }] }));
  return out;
}
