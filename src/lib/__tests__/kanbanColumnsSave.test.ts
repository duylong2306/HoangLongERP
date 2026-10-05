import { describe, it, expect, vi, beforeEach } from 'vitest';

// Sự cố 2026-10-05: cấu hình cột Kanban của lĩnh vực Nội thất bị ghi đè thành `[]` (nút "Thu phóng"
// lưu cả mảng `columns` đang rỗng) → thẻ dự án rơi về cột đầu, "nhảy lung tung". Test này khóa 2 hành vi:
//  - save() KHÔNG bao giờ ghi mảng cột rỗng;
//  - saveWidth() chỉ UPDATE cột column_width, không đụng tới `columns`.
const calls: { op: string; payload: any; opts?: any; eqs?: [string, any][] }[] = [];
// update(...).eq(...).eq(...) có thể nối nhiều eq rồi await → giả lập builder "thenable".
const fakeSupabase: any = {
  from: (_table: string) => ({
    upsert: (payload: any, opts?: any) => { calls.push({ op: 'upsert', payload, opts }); return Promise.resolve({ error: null }); },
    update: (payload: any) => {
      const entry: any = { op: 'update', payload, eqs: [] as [string, any][] };
      calls.push(entry);
      const b: any = {
        eq: (col: string, val: any) => { entry.eqs.push([col, val]); return b; },
        then: (res: any) => res({ error: null }),
      };
      return b;
    },
  }),
};

// Công ty đang đăng nhập (null = chưa đăng nhập) — đổi trong từng test.
let currentCompany: string | null = null;
vi.mock('../supabase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../supabase')>()),
  getSupabase: () => fakeSupabase,
  getCurrentCompanyId: () => currentCompany,
}));

import { dbService } from '../dbService';

beforeEach(() => { calls.length = 0; currentCompany = null; });

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
    expect(calls[0].eqs).toEqual([['sector', 'furniture']]);
  });

  // Multi-tenant: khóa chính là (company_id, sector) — xem migration 20261005_kanban_columns_company_key.sql
  it('đã đăng nhập: save() gắn company_id và upsert theo khóa ghép company_id,sector', async () => {
    currentCompany = 'co-A';
    const cols = [{ id: 'col_design', name: 'HÌNH THÀNH DỰ ÁN' }];
    await dbService.kanbanColumns.save('furniture', cols, 259);
    expect(calls[0].payload).toEqual({ sector: 'furniture', columns: cols, column_width: 259, company_id: 'co-A' });
    expect(calls[0].opts).toEqual({ onConflict: 'company_id,sector' });
  });

  it('đã đăng nhập: saveWidth() chỉ sửa hàng của đúng công ty đó', async () => {
    currentCompany = 'co-A';
    await dbService.kanbanColumns.saveWidth('furniture', 200);
    expect(calls[0].eqs).toEqual([['sector', 'furniture'], ['company_id', 'co-A']]);
  });
});
