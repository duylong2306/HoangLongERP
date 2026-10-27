// Chuyển ảnh/tệp base64 trong tin nhắn cũ sang Storage + upload mới của chat.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
// @ts-expect-error — module .mjs của script, không có kiểu
import * as core from '../../../scripts/lib/chat-attachments-core.mjs';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('lõi chuyển đính kèm', () => {
  it('parseDataUrl tách loại và nội dung; không phải data URL → null', () => {
    const p = core.parseDataUrl('data:image/png;base64,aGVsbG8=');
    expect(p.mime).toBe('image/png');
    expect(p.buf.toString()).toBe('hello');
    expect(core.parseDataUrl('https://x/a.png')).toBeNull();
    expect(core.parseDataUrl(undefined)).toBeNull();
  });

  it('chỉ tệp có url data: mới cần chuyển', () => {
    expect(core.needsMigration({ url: 'data:image/png;base64,AA' })).toBe(true);
    expect(core.needsMigration({ url: 'https://x/a.png' })).toBe(false);
    expect(core.messageNeedsMigration([{ url: 'https://x' }, { url: 'data:x;base64,AA' }])).toBe(true);
    expect(core.messageNeedsMigration([{ url: 'https://x' }])).toBe(false);
    expect(core.messageNeedsMigration(null)).toBe(false);
  });

  it('rebuildAttachments thay đúng tệp base64, giữ nguyên tệp đã là đường dẫn và các trường khác', () => {
    const atts = [
      { id: 'a', type: 'image', name: 'a.jpg', url: 'data:image/jpeg;base64,AA', size: 999 },
      { id: 'b', type: 'file', name: 'b.pdf', url: 'https://kho/b.pdf', size: 5 },
    ];
    const out = core.rebuildAttachments(atts, [{ url: 'https://kho/a.jpg', size: 100 }]);
    expect(out[0]).toEqual({ id: 'a', type: 'image', name: 'a.jpg', url: 'https://kho/a.jpg', size: 100 });
    expect(out[1]).toBe(atts[1]);
  });

  it('thiếu kết quả tải lên của tệp nào thì giữ nguyên tệp đó (không mất dữ liệu)', () => {
    const atts = [{ id: 'a', url: 'data:image/png;base64,AA' }];
    expect(core.rebuildAttachments(atts, [])).toEqual(atts);
  });

  it('đường dẫn kho có công ty làm thư mục gốc, ổn định theo nội dung', () => {
    const p = core.storagePath('C1', 'conv_project_P 1', 'msg_1', 0, 'abc123', 'jpg');
    expect(p).toBe('C1/conv_project_P_1/msg_1_0_abc123.jpg');
    expect(core.storagePath('C1', 'conv_project_P 1', 'msg_1', 0, 'abc123', 'jpg')).toBe(p);
  });

  it('đuôi tệp: theo tên, không có thì theo loại nội dung', () => {
    expect(core.extOf('anh.JPG', 'image/jpeg')).toBe('jpg');
    expect(core.extOf('khongduoi', 'image/png')).toBe('png');
    expect(core.extOf('', 'application/x-lạ')).toBe('bin');
  });
});

describe('script, migration, upload mới', () => {
  it('script có chạy thử / --ghi / --khoi-phuc, sao lưu trước khi sửa, kiểm tra tệp mở được', () => {
    const js = read('scripts/migrate-chat-attachments-to-storage.mjs');
    expect(js).toMatch(/args\.ghi/); expect(js).toMatch(/args\['khoi-phuc'\]/);
    expect(js.indexOf('writeFileSync(backupFile')).toBeLessThan(js.indexOf(".update({ attachments: rebuildAttachments"));
    expect(js).toMatch(/method: 'HEAD'/);
    expect(js).toMatch(/JSON\.stringify\(cur\.attachments\) !== JSON\.stringify\(row\.attachments\)/);   // không ghi đè tin vừa bị sửa
  });

  it('migration tạo bucket chat-attachments và policy theo công ty', () => {
    const sql = read('supabase/migrations/20261101_chat_attachments_bucket.sql');
    expect(sql).toMatch(/'chat-attachments'/);
    for (const op of ['select', 'insert', 'update', 'delete']) expect(sql).toMatch(new RegExp(`chat_attachments_tenant_${op}`));
    expect(sql).toMatch(/storage\.foldername\(name\)\)\[1\] = \(auth\.jwt\(\) ->> 'company_id'\)/);
  });

  it('chat gửi ảnh/tệp qua dbService.uploadChatAttachment (nén + Storage), không còn FileReader trong MessagesZalo', () => {
    const z = read('src/components/MessagesZalo.tsx');
    expect(z).toMatch(/dbService\.uploadChatAttachment\(/);
    expect(z).not.toMatch(/readAsDataURL/);
    const d = read('src/lib/dbService.ts');
    expect(d).toMatch(/async uploadChatAttachment\([\s\S]*?compressImageFile\(file\)[\s\S]*?chat-attachments/);
  });
});

describe('uploadChatAttachment (hành vi)', () => {
  it('chưa kết nối Supabase → quay về data URL (gửi tin vẫn hoạt động), kèm kích thước/loại/tên', async () => {
    const { dbService } = await import('../dbService');
    const out = await dbService.uploadChatAttachment('conv_1', new File(['hello'], 'ghi-chu.txt', { type: 'text/plain' }));
    expect(out.stored).toBe('local');
    expect(out.url.startsWith('data:text/plain')).toBe(true);
    expect(out).toMatchObject({ name: 'ghi-chu.txt', mimeType: 'text/plain', size: 5 });
  });
});
