import { describe, it, expect, vi, beforeEach } from 'vitest';

// Lưu cấu hình ca có 2 cột mới (leave_advance_days / leave_advance_block). Nếu cột chưa tồn tại (chưa chạy migration 20261018) thì
// thử lại KHÔNG kèm 2 cột đó để các cấu hình khác (giờ ca, dung sai...) vẫn lưu được.
const upserts: any[] = [];
const missingColumns = new Set<string>();
vi.mock('../supabase', async (orig) => {
  const actual: any = await orig();
  return {
    ...actual,
    getCurrentCompanyId: () => 'co-1',
    getSupabase: () => ({
      from: (_t: string) => ({
        upsert: (payload: any) => {
          upserts.push(JSON.parse(JSON.stringify(payload)));
          // Mô phỏng PostgREST: lần lưu nào còn chứa cột không tồn tại thì báo lỗi nêu tên cột đầu tiên thiếu
          const missingCol = ['accountant_base_salary', 'leave_advance_days'].find(c => missingColumns.has(c) && c in payload);
          const err = missingCol ? { message: `Could not find the '${missingCol}' column of 'shift_config' in the schema cache` } : null;
          return Promise.resolve({ error: err });
        },
      }),
    }),
  };
});

import { dbService } from '../dbService';

beforeEach(() => { upserts.length = 0; missingColumns.clear(); });

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
  it('cột mới chưa có (chưa chạy migration) → bỏ riêng 2 cột đó rồi thử lại, các cột khác vẫn lưu', async () => {
    missingColumns.add('leave_advance_days');
    await dbService.shiftConfig.save({ morningIn: '07:45', leaveAdvanceDays: 2 });
    const last = upserts[upserts.length - 1];
    expect('leave_advance_days' in last).toBe(false);
    expect(last.morning_in).toBe('07:45');
  });
  it('cột lương cũ chưa bao giờ có trên bảng → bỏ riêng cột đó, vẫn lưu được số ngày báo trước', async () => {
    missingColumns.add('accountant_base_salary');
    await dbService.shiftConfig.save({ morningIn: '07:30', accountantBaseSalary: 5, leaveAdvanceDays: 0.5, leaveAdvanceBlock: true });
    const last = upserts[upserts.length - 1];
    expect('accountant_base_salary' in last).toBe(false);
    expect(last.leave_advance_days).toBe(0.5);
    expect(last.leave_advance_block).toBe(true);
  });
});
