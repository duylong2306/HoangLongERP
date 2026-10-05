import { describe, it, expect, vi, beforeEach } from 'vitest';

// Sự cố 2026-10-05: cấu hình cột Kanban của lĩnh vực Nội thất bị ghi đè thành `[]` (nút "Thu phóng"
// lưu cả mảng `columns` đang rỗng) → thẻ dự án rơi về cột đầu, "nhảy lung tung". Test này khóa 2 hành vi:
//  - save() KHÔNG bao giờ ghi mảng cột rỗng;
//  - saveWidth() chỉ UPDATE cột column_width, không đụng tới `columns`.
const calls: { op: string; payload: any; eq?: [string, any] }[] = [];
const fakeSupabase: any = {
  from: (_table: string) => ({
    upsert: (payload: any) => { calls.push({ op: 'upsert', payload }); return Promise.resolve({ error: null }); },
    update: (payload: any) => ({
      eq: (col: string, val: any) => { calls.push({ op: 'update', payload, eq: [col, val] }); return Promise.resolve({ error: null }); },
    }),
  }),
};

vi.mock('../supabase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../supabase')>()),
  getSupabase: () => fakeSupabase,
}));

import { dbService } from '../dbService';

beforeEach(() => { calls.length = 0; });

describe('dbService.kanbanColumns — không để mất cấu hình cột', () => {
  it('save() với mảng cột rỗng → bỏ qua, không gọi upsert', async () => {
    await dbService.kanbanColumns.save('furniture', [], 180);
    expect(calls).toHaveLength(0);
  });

  it('save() với danh sách cột hợp lệ → vẫn upsert bình thường', async () => {
    const cols = [{ id: 'col_design', name: 'HÌNH THÀNH DỰ ÁN' }];
    await dbService.kanbanColumns.save('furniture', cols, 259);
    expect(calls).toHaveLength(1);
    expect(calls[0].payload).toEqual({ sector: 'furniture', columns: cols, column_width: 259 });
  });

  it('saveWidth() chỉ cập nhật column_width của đúng lĩnh vực, không có trường columns', async () => {
    await dbService.kanbanColumns.saveWidth('furniture', 200);
    expect(calls).toHaveLength(1);
    expect(calls[0].op).toBe('update');
    expect(calls[0].payload).toEqual({ column_width: 200 });
    expect(calls[0].eq).toEqual(['sector', 'furniture']);
  });
});
