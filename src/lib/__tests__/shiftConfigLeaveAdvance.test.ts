import { describe, it, expect, vi, beforeEach } from 'vitest';

// Lưu cấu hình ca có 2 cột mới (leave_advance_days / leave_advance_block). Nếu cột chưa tồn tại (chưa chạy migration 20261018) thì
// thử lại KHÔNG kèm 2 cột đó để các cấu hình khác (giờ ca, dung sai...) vẫn lưu được.
const upserts: any[] = [];
let failFirstWithMissingColumn = false;
vi.mock('../supabase', async (orig) => {
  const actual: any = await orig();
  return {
    ...actual,
    getCurrentCompanyId: () => 'co-1',
    getSupabase: () => ({
      from: (_t: string) => ({
        upsert: (payload: any) => {
          upserts.push(JSON.parse(JSON.stringify(payload)));
          const err = failFirstWithMissingColumn && upserts.length === 1
            ? { message: "Could not find the 'leave_advance_days' column of 'shift_config' in the schema cache" } : null;
          return Promise.resolve({ error: err });
        },
      }),
    }),
  };
});

import { dbService } from '../dbService';

beforeEach(() => { upserts.length = 0; failFirstWithMissingColumn = false; });

describe('shiftConfig.save — quy định xin nghỉ báo trước', () => {
  it('ghi kèm leave_advance_days (thập phân) và leave_advance_block', async () => {
    await dbService.shiftConfig.save({ morningIn: '07:30', leaveAdvanceDays: 0.5, leaveAdvanceBlock: true });
    expect(upserts).toHaveLength(1);
    expect(upserts[0].leave_advance_days).toBe(0.5);
    expect(upserts[0].leave_advance_block).toBe(true);
  });
  it('thiếu giá trị → mặc định 1 ngày và không chặn', async () => {
    await dbService.shiftConfig.save({ morningIn: '07:30' });
    expect(upserts[0].leave_advance_days).toBe(1);
    expect(upserts[0].leave_advance_block).toBe(false);
  });
  it('cột chưa có trên cơ sở dữ liệu → thử lại không kèm 2 cột mới, các cột khác vẫn lưu', async () => {
    failFirstWithMissingColumn = true;
    await dbService.shiftConfig.save({ morningIn: '07:45', leaveAdvanceDays: 2 });
    expect(upserts).toHaveLength(2);
    expect('leave_advance_days' in upserts[1]).toBe(false);
    expect('leave_advance_block' in upserts[1]).toBe(false);
    expect(upserts[1].morning_in).toBe('07:45');
  });
});
