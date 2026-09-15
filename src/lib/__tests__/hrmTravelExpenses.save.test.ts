import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture payload sent to Supabase so we can assert the row primary-key id
// is a real UUID (migration 021 defines hrm_travel_expenses.id as uuid).
const rowsByTable: Record<string, any[]> = {};
const fakeSupabase: any = {
  from: (table: string) => ({
    upsert: (payload: any) => {
      rowsByTable[table] = rowsByTable[table] || [];
      // Mô phỏng upsert thật: thay thế dòng có cùng id (idempotent).
      const i = rowsByTable[table].findIndex((r) => r.id === payload.id);
      if (i >= 0) rowsByTable[table][i] = payload;
      else rowsByTable[table].push(payload);
      return { select: () => Promise.resolve({ data: [payload], error: null }) };
    },
    select: () => Promise.resolve({ data: rowsByTable[table] || [], error: null }),
  }),
};

vi.mock('../supabase', () => ({ getSupabase: () => fakeSupabase }));

import { dbService } from '../dbService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

beforeEach(() => {
  Object.keys(rowsByTable).forEach((k) => delete rowsByTable[k]);
});

describe('hrmTravelExpenses.save — khóa chính phải là uuid', () => {
  it('không dùng mã THCTP (string) làm id cột uuid → upsert sẽ fail silent', async () => {
    const item = {
      id: 'THCTP-1699000000000-0', // mã hiển thị, KHÔNG phải uuid
      code: 'THCTP-001',
      employeeName: 'Thợ A',
      amount: 200000,
      content: 'Đi Đà Lạt',
    };

    await dbService.hrmTravelExpenses.save(item);

    const saved = rowsByTable['hrm_travel_expenses'];
    expect(saved).toBeTruthy();
    expect(saved.length).toBe(1);

    // CỘT id TRƯỚC ĐÂY BỊ TRUYỀN = 'THCTP-...' (sai kiểu uuid) → Postgres báo
    // "invalid input syntax for type uuid" và upsert thất bại silent.
    // Sau fix: id phải là UUID hợp lệ.
    expect(saved[0].id).toMatch(UUID_RE);
    // Mã THCTP vẫn được giữ nguyên bên trong cột data để hiển thị.
    expect(saved[0].data.id).toBe('THCTP-1699000000000-0');
    expect(saved[0].data.code).toBe('THCTP-001');
  });

  it('list() đọc lại trả về đúng item (data jsonb, keys camelCase)', async () => {
    await dbService.hrmTravelExpenses.save({
      id: 'THCTP-2-0',
      code: 'THCTP-002',
      employeeName: 'Thợ B',
      amount: 120000,
      completedDate: '31/07/2026',
      projectName: 'Dự án test',
    });

    const list = await dbService.hrmTravelExpenses.list();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('THCTP-2-0');
    expect(list[0].employeeName).toBe('Thợ B');
    expect(list[0].completedDate).toBe('31/07/2026');
  });

  it('truyền opts.rowId → dùng làm khóa chính (upsert idempotent, không trùng dòng)', async () => {
    const fixedRowId = '11111111-2222-3333-4444-555555555555';
    const item = { id: 'THCTP-3-0', code: 'THCTP-003', employeeName: 'Thợ C', amount: 90000 };

    // Lưu 2 lần cùng rowId → chỉ tạo 1 dòng (upsert), không bị trùng.
    await dbService.hrmTravelExpenses.save({ ...item, status: 'pending' }, { rowId: fixedRowId });
    await dbService.hrmTravelExpenses.save({ ...item, status: 'completed' }, { rowId: fixedRowId });

    const saved = rowsByTable['hrm_travel_expenses'];
    expect(saved.length).toBe(1);
    expect(saved[0].id).toBe(fixedRowId);
    // Dòng được cập nhật lên trạng thái completed (idempotent).
    expect(saved[0].data.status).toBe('completed');
  });
});
