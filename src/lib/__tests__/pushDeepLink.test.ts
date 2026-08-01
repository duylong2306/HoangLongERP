import { describe, it, expect } from 'vitest';
import {
  buildPushUrl,
  parsePushUrl,
  parsePushData,
  hasDeepLinkTarget,
  normalizePushUrl,
} from '../pushDeepLink';

describe('buildPushUrl', () => {
  it('dựng link chi tiết công việc theo ID', () => {
    expect(buildPushUrl({ taskId: 'TASK-123' })).toBe('/?taskId=TASK-123');
  });

  it('dùng taskCode khi không có taskId', () => {
    expect(buildPushUrl({ taskCode: 'CV-001' })).toBe('/?taskCode=CV-001');
  });

  it('ưu tiên CÔNG VIỆC hơn dự án (lỗi cũ: rơi vào trang dự án)', () => {
    const url = buildPushUrl({ taskId: 'TASK-9', projectId: 'PRJ-1' });
    expect(url).toContain('taskId=TASK-9');
    expect(url).not.toContain('projectId');
  });

  it('vẫn gắn projectId khi thông báo không thuộc công việc nào', () => {
    expect(buildPushUrl({ projectId: 'PRJ-1' })).toBe('/?projectId=PRJ-1');
  });

  it('trả về "/" khi không có đích cụ thể', () => {
    expect(buildPushUrl({})).toBe('/');
  });

  it('mã hoá ký tự đặc biệt an toàn', () => {
    const url = buildPushUrl({ taskCode: 'CV/2026 #1' });
    expect(parsePushUrl(url).taskCode).toBe('CV/2026 #1');
  });
});

describe('parsePushUrl', () => {
  it('đọc được deep link công việc', () => {
    expect(parsePushUrl('/?taskId=TASK-5').taskId).toBe('TASK-5');
  });

  it('tương thích link chat cũ /messages?conversation=', () => {
    expect(parsePushUrl('/messages?conversation=CONV-7').conversationId).toBe('CONV-7');
  });

  it('không vỡ với URL rác', () => {
    expect(() => parsePushUrl('::::')).not.toThrow();
  });

  it('round-trip build → parse', () => {
    const link = { taskId: 'TASK-1', conversationId: 'CONV-2' };
    const parsed = parsePushUrl(buildPushUrl(link));
    expect(parsed.taskId).toBe('TASK-1');
    expect(parsed.conversationId).toBe('CONV-2');
  });
});

describe('parsePushData', () => {
  it('ưu tiên field rời hơn URL', () => {
    const link = parsePushData({ taskId: 'TASK-A', url: '/?taskId=TASK-B' });
    expect(link.taskId).toBe('TASK-A');
  });

  it('rơi về parse URL khi thiếu field rời', () => {
    expect(parsePushData({ url: '/?taskId=TASK-B' }).taskId).toBe('TASK-B');
  });

  it('suy ra mã công việc từ sourceId của thông báo công việc cũ', () => {
    const link = parsePushData({ type: 'tasks', sourceId: 'CV-001', url: '/' });
    expect(link.taskCode).toBe('CV-001');
  });

  it('KHÔNG suy sourceId thành mã công việc với thông báo tài chính', () => {
    const link = parsePushData({ type: 'finance', sourceId: 'PC-88', url: '/' });
    expect(link.taskCode).toBeUndefined();
  });

  it('giữ conversationId của push chat', () => {
    const link = parsePushData({
      type: 'chat.message',
      conversationId: 'CONV-3',
      url: '/messages?conversation=CONV-3',
    });
    expect(link.conversationId).toBe('CONV-3');
  });

  it('an toàn với payload rỗng/null', () => {
    expect(parsePushData(null)).toEqual({});
    expect(hasDeepLinkTarget(parsePushData(undefined))).toBe(false);
  });
});

// Các thông báo ĐÃ GỬI trước đây vẫn nằm trên máy người dùng và mang URL dạng
// đường dẫn. Host không có SPA fallback → mở ra là 404 (lỗi trên điện thoại).
// Phải đọc được và quy về '/' + query string.
describe('tương thích định dạng CŨ (nguyên nhân lỗi 404)', () => {
  it('đọc được /tasks/<id>', () => {
    expect(parsePushUrl('/tasks/TASK-77').taskId).toBe('TASK-77');
  });

  it('đọc được /projects/<id>', () => {
    expect(parsePushUrl('/projects/PRJ-3').projectId).toBe('PRJ-3');
  });

  it('đọc được /messages/<id>', () => {
    expect(parsePushUrl('/messages/CONV-4').conversationId).toBe('CONV-4');
  });

  it('giải mã ID có ký tự đặc biệt trên đường dẫn', () => {
    expect(parsePushUrl('/tasks/CV%2F2026').taskId).toBe('CV/2026');
  });

  it('normalizePushUrl đưa /tasks/<id> về đường dẫn gốc — hết 404', () => {
    const out = normalizePushUrl('/tasks/TASK-77');
    expect(out).toBe('/?taskId=TASK-77');
    expect(out.startsWith('/?')).toBe(true);
  });

  it('normalizePushUrl đưa /messages?conversation= về gốc', () => {
    expect(normalizePushUrl('/messages?conversation=CONV-4')).toBe('/?conversation=CONV-4');
  });

  it('URL không nhận dạng được → về "/" chứ không giữ đường dẫn 404', () => {
    expect(normalizePushUrl('/some/unknown/deep/path')).toBe('/');
  });

  it('mọi URL sau chuẩn hoá đều nằm ở đường dẫn gốc', () => {
    const inputs = ['/tasks/A', '/projects/B', '/messages/C', '/', '/?taskId=D', '::rác::'];
    for (const raw of inputs) {
      const out = normalizePushUrl(raw);
      expect(out === '/' || out.startsWith('/?')).toBe(true);
    }
  });

  it('parsePushData xử lý được payload cũ nguyên vẹn', () => {
    const link = parsePushData({ url: '/tasks/TASK-9', type: 'tasks', sourceId: 'CV-9' });
    expect(link.taskId).toBe('TASK-9');
  });
});

describe('hasDeepLinkTarget', () => {
  it('phân biệt có đích và không có đích', () => {
    expect(hasDeepLinkTarget({ taskId: 'T-1' })).toBe(true);
    expect(hasDeepLinkTarget({ category: 'tasks' })).toBe(false);
  });
});
