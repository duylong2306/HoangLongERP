// Service worker Web Push: chạy hàm xử lý sự kiện 'push' thật với showNotification giả để kiểm tra thẻ + nút bấm.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.resolve(__dirname, '../../../public/web-push-sw.js'), 'utf8');

/** Chạy sw với 1 gói push, trả về (tiêu đề, options) mà showNotification nhận được. */
function runPush(payload: any) {
  const handlers: Record<string, (e: any) => void> = {};
  let shown: any = null;
  const self: any = {
    addEventListener: (n: string, f: any) => { handlers[n] = f; },
    registration: { showNotification: (t: string, o: any) => { shown = { t, o }; return Promise.resolve(); } },
    clients: {}, location: { origin: 'https://x' },
  };
  new Function('self', src)(self);
  handlers.push({ data: { json: () => payload }, waitUntil: (p: any) => p });
  return shown;
}

describe('Web Push SW — thẻ & nút', () => {
  it('chat: mỗi hội thoại một thông báo (thẻ theo mã hội thoại) và rung lại khi thay thế', () => {
    const a = runPush({ title: 'An', body: 'x', tag: 'web-push-notification', data: { conversationId: 'c1' } });
    const b = runPush({ title: 'Bình', body: 'y', tag: 'web-push-notification', data: { conversationId: 'c2' } });
    expect(a.o.tag).toBe('conv-c1');
    expect(b.o.tag).toBe('conv-c2');
    expect(a.o.renotify).toBe(true);
  });
  it('thẻ riêng của máy chủ (nhắc điểm danh) được dùng', () => {
    const r = runPush({ title: 'T', body: 'b', tag: 'attendance-morning-2026-10-27', data: { type: 'attendance' } });
    expect(r.o.tag).toBe('attendance-morning-2026-10-27');
  });
  it('nút ở ngoài cùng gói push được dùng, nhãn "Mo" đổi thành "Mở"', () => {
    const r = runPush({ title: 'T', body: 'b', actions: [{ action: 'open', title: 'Mo' }], data: {} });
    expect(r.o.actions).toEqual([{ action: 'open', title: 'Mở' }]);
    const r2 = runPush({ title: 'T', body: 'b', actions: [{ action: 'open', title: 'Điểm danh ngay' }], data: {} });
    expect(r2.o.actions[0].title).toBe('Điểm danh ngay');
  });
});

// Bấm thông báo khi app CHƯA mở: service worker mở cửa sổ mới với link — phải mang cả đích mở thẳng lẫn hội thoại dự phòng
describe('Web Push SW — bấm thông báo mở thẳng đích', () => {
  async function click(data: any) {
    const handlers: Record<string, (e: any) => void> = {};
    let opened = '';
    const self: any = {
      addEventListener: (n: string, f: any) => { handlers[n] = f; },
      registration: { showNotification: () => Promise.resolve() },
      clients: { matchAll: async () => [], openWindow: async (u: string) => { opened = u; } },
      location: { origin: 'https://x' },
    };
    new Function('self', src)(self);
    let p: any;
    handlers.notificationclick({ notification: { data, close: () => {} }, action: '', waitUntil: (x: any) => { p = x; } });
    await p;
    return opened;
  }
  it('công việc: /?taskId=…&conversation=… (dự phòng về hội thoại)', async () => {
    expect(await click({ conversationId: 'c1', taskId: 'T1' })).toBe('https://x/?taskId=T1&conversation=c1');
  });
  it('phiếu cần duyệt: giữ đích tk/ti cùng hội thoại', async () => {
    expect(await click({ conversationId: 'c1', targetKind: 'leave', targetId: 'LR-1' })).toBe('https://x/?conversation=c1&tk=leave&ti=LR-1');
  });
  it('thông báo cũ chỉ có hội thoại vẫn mở hội thoại', async () => {
    expect(await click({ conversationId: 'c1' })).toBe('https://x/?conversation=c1');
  });
});

