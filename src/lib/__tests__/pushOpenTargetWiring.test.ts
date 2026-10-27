// Kiểm tra dây nối (đọc mã nguồn): push mang đích mở thẳng, App mở đích + rơi về hội thoại khi không mở được, duyệt nghỉ phép báo nhóm Điểm danh.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../', p), 'utf8');

describe('thông báo đẩy mở thẳng đích', () => {
  it('notifyChatPush gửi kèm đích suy từ relatedEntity (và vẫn kèm mã hội thoại)', () => {
    const s = read('lib/chatStore.ts');
    expect(s).toMatch(/const target = pushTargetFromMessage\(msg\)/);
    expect(s).toMatch(/\.\.\.target/);
    expect(s).toMatch(/conversationId: conv\.id,\s*\n\s*senderId/);
  });
  it('App: công việc/nhiệm vụ → phiếu duyệt → hội thoại; không tìm thấy công việc thì rơi về hội thoại', () => {
    const s = read('App.tsx');
    const fn = s.slice(s.indexOf('const handlePushDeepLink'), s.indexOf('(1) App ĐANG MỞ'));
    expect(fn.indexOf('setPendingTaskLink(link)')).toBeLessThan(fn.indexOf('openApprovalTarget(link.targetKind'));
    expect(fn.indexOf('openApprovalTarget(link.targetKind')).toBeLessThan(fn.indexOf('setInitialConvId(link.conversationId)'));
    expect(s).toMatch(/pendingTaskLink\.conversationId[\s\S]{0,120}setInitialConvId\(pendingTaskLink\.conversationId\)/);
    // sự kiện hl-open-approval dùng chung hàm mở nơi duyệt với thông báo đẩy
    expect(s).toMatch(/openApprovalTarget\(kind, id\)/);
  });
});

describe('duyệt nghỉ phép → báo nhóm Điểm danh', () => {
  for (const f of ['components/TaskManagement.tsx', 'components/HumanResourcesManagement.tsx']) {
    it(`${f}: chỉ báo khi duyệt (không phải từ chối) và đơn chưa duyệt trước đó`, () => {
      const s = read(f);
      expect(s).toMatch(/status === 'approved' && targetLeave && targetLeave\.status !== 'approved'\) \{[^}]*announceLeaveApproved\(/);
    });
  }
});
