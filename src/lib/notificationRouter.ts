import { Employee, AppNotification } from '../types';
import {
  INITIAL_EMPLOYEES,
  HRM_26_EMPLOYEES,
  INITIAL_PROJECTS
} from '../data';
import { getSupabase } from './supabase';

// Gửi push notification qua Web Push API (VAPID) sau khi đã viết notification in-app.
// Hàm async, không block UI. Bỏ qua lỗi nếu Supabase chưa cấu hình.
async function sendWebPush(
  recipientIds: string[],
  title: string,
  content: string,
  event: NotificationEvent
) {
  try {
    const supabase = getSupabase();
    if (!supabase || !recipientIds.length) return;

    const metadata = event.metadata || {};
    const url =
      (metadata.projectId && `/projects/${metadata.projectId}`) ||
      (metadata.taskId && `/tasks/${metadata.taskId}`) ||
      '/';

    // Get config from env or localStorage
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sujhvotnlbsgavoenuma.supabase.co';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('hl_supabase_anon_key') || '';

    const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        userIds: recipientIds,
        title,
        body: content,
        data: {
          url,
          type: event.type,
          sourceId: event.sourceId,
          sourceModule: event.sourceModule,
          ...metadata,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('Web Push failed:', res.status, text);
    }
  } catch (err) {
    console.warn('Web Push error (ignored):', err);
  }
}

export type EventType =
  | 'task.created' | 'task.updated' | 'task.completed' | 'task.assigned'
  | 'approval.requested' | 'approval.approved' | 'approval.rejected'
  | 'finance.payment' | 'finance.advance' | 'finance.receipt'
  | 'project.milestone' | 'project.status'
  | 'hr.leave_request' | 'hr.attendance_correction'
  | 'chat.mention';

export interface NotificationEvent {
  type: EventType;
  sourceId: string;
  sourceModule: 'tasks' | 'finance' | 'projects' | 'hr' | 'chat';
  initiator: string;  // employee ID
  metadata: Record<string, any>;
  timestamp: string;
}

// Get all employees (including HRM_26)
function getAllEmployees(): Employee[] {
  const all = [...INITIAL_EMPLOYEES, ...HRM_26_EMPLOYEES];
  // Dedup by ID
  const seen = new Set<string>();
  return all.filter(emp => {
    if (seen.has(emp.id)) return false;
    seen.add(emp.id);
    return true;
  });
}

// Find employee by ID
function findEmployee(empId: string): Employee | undefined {
  const all = getAllEmployees();
  return all.find(e => e.id === empId);
}

// Get employees by role
function getEmployeesByRole(role: string): Employee[] {
  return getAllEmployees().filter(e => e.role === role);
}

// Get employees by department
function getEmployeesByDepartment(dept: string): Employee[] {
  return getAllEmployees().filter(e => e.department === dept);
}

// Find project by ID
function findProject(projectId: string) {
  return INITIAL_PROJECTS.find(p => p.id === projectId);
}

// Xác định stakeholders từ context event
export function resolveStakeholders(event: NotificationEvent): string[] {
  const recipients = new Set<string>();
  const { type, metadata, initiator } = event;

  // Helper to add if exists
  const add = (id?: string) => { if (id) recipients.add(id); };

  switch (event.type) {
    case 'task.created':
    case 'task.assigned':
      // 1. Người được giao (assignee)
      add(metadata.assigneeId);

      // 2. Người giao (assigner/creator)
      add(metadata.assignerId || metadata.creatorId);

      // 3. PM của dự án
      if (metadata.projectId) {
        const project = findProject(metadata.projectId);
        if (project?.pmId) add(project.pmId);
      }

      // 4. Những người involved
      if (metadata.involvedIds?.length) {
        metadata.involvedIds.forEach((id: string) => add(id));
      }

      // 5. Approvers
      if (metadata.approverIds?.length) {
        metadata.approverIds.forEach((id: string) => add(id));
      }
      break;

    case 'task.updated':
    case 'task.completed':
      // 1. Assignee
      add(metadata.assigneeId);

      // 2. Assigner/Creator
      add(metadata.assignerId);

      // 3. PM
      if (metadata.projectId) {
        const project = findProject(metadata.projectId);
        if (project?.pmId) add(project.pmId);
      }

      // 4. Approvers
      if (metadata.approverIds?.length) {
        metadata.approverIds.forEach((id: string) => add(id));
      }
      break;

    case 'approval.requested':
      // 1. Approvers
      if (metadata.approverIds?.length) {
        metadata.approverIds.forEach((id: string) => add(id));
      }

      // 2. Requestor
      add(metadata.requestorId);

      // 4. PM (nếu task thuộc dự án)
      if (metadata.projectId) {
        const project = findProject(metadata.projectId);
        if (project?.pmId) add(project.pmId);
      }
      break;

    case 'approval.approved':
    case 'approval.rejected':
      // 1. Requestor
      add(metadata.requestorId);

      // 2. Approver (đã duyệt)
      add(event.initiator);

      // 3. PM
      if (metadata.projectId) {
        const project = findProject(metadata.projectId);
        if (project?.pmId) add(project.pmId);
      }

      // 4. Assignee (nếu có)
      add(metadata.assigneeId);
      break;

    case 'finance.advance':
      // 1. Kế Toán
      getEmployeesByRole('accountant').forEach(e => add(e.id));

      // 2. Giám đốc
      getEmployeesByRole('director').forEach(e => add(e.id));

      // 3. Người đề xuất
      add(metadata.proposerId || metadata.proposer);
      break;

    case 'finance.payment':
    case 'finance.receipt':
      // 1. Kế toán
      getEmployeesByRole('accountant').forEach(e => add(e.id));

      // 2. Proposer
      add(metadata.proposer);

      // 3. Giám đốc (nếu amount lớn)
      if (metadata.amount && metadata.amount > 50000000) {
        getEmployeesByRole('director').forEach(e => add(e.id));
      }
      break;

    case 'project.milestone':
    case 'project.status':
      if (metadata.projectId) {
        const project = findProject(metadata.projectId);
        if (project) {
          // PM
          add(project.pmId);

          // Members (involvedEmployeeIds)
          if ((project as any).memberIds) {
            (project as any).memberIds.forEach((id: string) => add(id));
          }
        }
      }
      break;

    case 'hr.leave_request':
      // 1. Quản lý trực tiếp
      add(metadata.managerId);

      // 2. Hành chính nhân sự
      getEmployeesByDepartment('Phòng Hành Chính Nhân Sự')
        .forEach(e => add(e.id));

      // 3. Giám đốc (nếu phép năm > 5 ngày)
      if (metadata.daysCount && metadata.daysCount > 5) {
        getEmployeesByRole('director').forEach(e => add(e.id));
      }
      break;

    case 'hr.attendance_correction':
      // 1. Hành chính nhân sự
      getEmployeesByDepartment('Phòng Hành Chính Nhân Sự')
        .forEach(e => add(e.id));

      // 2. Quản lý trực tiếp
      add(metadata.managerId);
      break;

    case 'chat.mention':
      // Người được mention
      if (metadata.mentionedIds?.length) {
        metadata.mentionedIds.forEach((id: string) => add(id));
      }
      break;
  }

  // Luôn loại bỏ initiator khỏi danh sách nhận (trừ khi là approval rejected - cần thông báo cho initiator)
  if (event.type !== 'approval.rejected') {
    recipients.delete(event.initiator);
  }

  // Filter out undefined/null
  return Array.from(recipients).filter(Boolean);
}

// Dispatch notification to recipients
export function dispatchNotification(
  event: NotificationEvent,
  addNotification: (notif: Partial<AppNotification>) => void,
  employees: Employee[],
  currentUser: Employee | null
) {
  const recipientIds = resolveStakeholders(event);

  // Build base notification
  const baseNotif: Partial<AppNotification> = {
    title: getTitle(event),
    content: getContent(event),
    detailedContent: getDetailedContent(event),
    category: getCategory(event),
    subTaskCode: event.sourceId,
    senderId: event.initiator,
    senderName: currentUser?.name || 'Hệ Thống',
    senderAvatar: currentUser?.name?.substring(0, 2).toUpperCase() || 'HT',
    createdAt: event.timestamp,
    read: false,
  };

  recipientIds.forEach(recipientId => {
    const recipient = findEmployee(recipientId);
    if (!recipient) return;

    addNotification({
      ...baseNotif,
      recipientId,
      recipientName: recipient.name,
      department: recipient.department || 'Phòng Ban',
    });
  });

  // Gửi push Web Push thực tế (async, không block)
  sendWebPush(recipientIds, baseNotif.title || 'Thông báo mới', baseNotif.content || '', event);
}

// Helper functions
function getTitle(event: NotificationEvent): string {
  const titles: Record<string, string> = {
    'task.created': '📌 Công việc mới',
    'task.assigned': '📌 Được giao việc mới',
    'task.updated': '📝 Công việc được cập nhật',
    'task.completed': '✅ Công việc hoàn thành',
    'approval.requested': '⏳ Cần phê duyệt',
    'approval.approved': '✅ Đã phê duyệt',
    'approval.rejected': '❌ Bị từ chối',
    'finance.advance': '💰 Đề xuất tạm ứng',
    'finance.payment': '💸 Phiếu chi mới',
    'finance.receipt': '💰 Phiếu thu mới',
    'project.milestone': '🎯 Mốc dự án',
    'project.status': '📊 Cập nhật dự án',
    'hr.leave_request': '📝 Đơn xin nghỉ phép',
    'hr.attendance_correction': '📋 Yêu cầu sửa chấm công',
    'chat.mention': '💬 Bạn được nhắc đến',
  };
  return titles[event.type] || 'Thông báo mới';
}

function getContent(event: NotificationEvent): string {
  const { metadata } = event;
  switch (event.type) {
    case 'task.created':
    case 'task.assigned':
      return `Bạn được giao: "${metadata.taskName || metadata.name}"`;
    case 'task.updated':
      return `Công việc "${metadata.taskName}" đã được cập nhật`;
    case 'task.completed':
      return `Công việc "${metadata.taskName}" đã hoàn thành`;
    case 'approval.requested':
      return `${metadata.taskName || 'Đơn'} đang chờ bạn duyệt`;
    case 'approval.approved':
      return `"${metadata.taskName}" đã được duyệt`;
    case 'approval.rejected':
      return `"${metadata.taskName}" bị từ chối`;
    case 'finance.advance':
      return `Đề xuất tạm ứng ${metadata.amount?.toLocaleString('vi-VN')}đ`;
    case 'finance.payment':
      return `Phiếu chi ${metadata.amount?.toLocaleString('vi-VN')}đ`;
    case 'finance.receipt':
      return `Phiếu thu ${metadata.amount?.toLocaleString('vi-VN')}đ`;
    case 'project.milestone':
      return `Mốc "${metadata.milestoneName}" ${metadata.status === 'completed' ? 'hoàn thành' : 'cập nhật'}`;
    case 'hr.leave_request':
      return `Xin nghỉ phép ${metadata.daysCount} ngày`;
    case 'chat.mention':
      return 'Bạn được nhắc đến trong tin nhắn';
    default:
      return 'Bạn có thông báo mới';
  }
}

function getDetailedContent(event: NotificationEvent): string {
  const { metadata } = event;
  const lines: string[] = [];

  if (metadata.taskName) lines.push(`Công việc: ${metadata.taskName}`);
  if (metadata.projectName) lines.push(`Dự án: ${metadata.projectName}`);
  if (metadata.department) lines.push(`Phòng ban: ${metadata.department}`);
  if (metadata.amount) lines.push(`Số tiền: ${metadata.amount.toLocaleString('vi-VN')}đ`);
  if (metadata.deadline) lines.push(`Hạn chót: ${metadata.deadline}`);
  if (metadata.daysCount) lines.push(`Số ngày: ${metadata.daysCount}`);
  if (metadata.reason) lines.push(`Lý do: ${metadata.reason}`);

  return lines.join('\n') || 'Không có chi tiết thêm';
}

function getCategory(event: NotificationEvent): 'tasks' | 'finance' | 'projects' | 'hr' | 'chat' | 'approval' {
  const categories: Record<string, 'tasks' | 'finance' | 'projects' | 'hr' | 'chat' | 'approval'> = {
    'task.created': 'tasks',
    'task.assigned': 'tasks',
    'task.updated': 'tasks',
    'task.completed': 'tasks',
    'approval.requested': 'approval',
    'approval.approved': 'approval',
    'approval.rejected': 'approval',
    'finance.advance': 'finance',
    'finance.payment': 'finance',
    'finance.receipt': 'finance',
    'project.milestone': 'projects',
    'project.status': 'projects',
    'hr.leave_request': 'hr',
    'hr.attendance_correction': 'hr',
    'chat.mention': 'chat',
  };
  return categories[event.type] || 'tasks';
}

export { findEmployee, getEmployeesByRole, getEmployeesByDepartment, findProject };