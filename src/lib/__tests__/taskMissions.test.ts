import { describe, it, expect, vi, beforeEach } from 'vitest';

// Bảng task_missions (mỗi mission 1 dòng, tách từ cột jsonb tasks.missions cũ —
// xem migration 20260824_task_missions_table.sql). Test này xác nhận:
// 1. tasks.list() gắn lại đúng `.missions` từ bảng mới.
// 2. tasks.save() KHÔNG còn ghi "missions" vào row tasks.
// 3. taskMissions.save()/delete() thao tác đúng theo từng dòng riêng biệt —
//    lưu 1 mission không đụng tới các mission khác của cùng task (đây chính
//    là điều bảng cũ (1 cột jsonb) không đảm bảo được, gây mất dữ liệu).
const rowsByTable: Record<string, any[]> = {};
const fakeSupabase: any = {
  from: (table: string) => ({
    select: (_cols?: string) => {
      const query: any = {
        eq: (col: string, val: any) => Promise.resolve({
          data: (rowsByTable[table] || []).filter((r) => r[col] === val),
          error: null,
        }),
        then: (resolve: any) => resolve({ data: rowsByTable[table] || [], error: null }),
      };
      return query;
    },
    upsert: (payload: any) => ({
      select: () => {
        rowsByTable[table] = rowsByTable[table] || [];
        const i = rowsByTable[table].findIndex((r) => r.id === payload.id);
        if (i >= 0) rowsByTable[table][i] = payload;
        else rowsByTable[table].push(payload);
        return Promise.resolve({ data: [payload], error: null });
      },
    }),
    delete: () => ({
      eq: (_col: string, val: any) => {
        rowsByTable[table] = (rowsByTable[table] || []).filter((r) => r.id !== val);
        return Promise.resolve({ error: null });
      },
    }),
  }),
};

vi.mock('../supabase', () => ({ getSupabase: () => fakeSupabase }));

import { dbService, invalidateCache } from '../dbService';

beforeEach(() => {
  Object.keys(rowsByTable).forEach((k) => delete rowsByTable[k]);
  invalidateCache();
});

describe('taskMissions — bảng riêng cho missions', () => {
  it('save() lưu 1 mission thành 1 dòng, không động tới mission khác của cùng task', async () => {
    await dbService.taskMissions.save('task1', { id: 'm1', name: 'NV1', status: 'todo' });
    invalidateCache('task_missions');
    await dbService.taskMissions.save('task1', { id: 'm2', name: 'NV2', status: 'todo' });
    invalidateCache('task_missions');

    // Chỉ cập nhật m1, m2 không hề bị đọc lại hay ghi lại.
    await dbService.taskMissions.save('task1', { id: 'm1', name: 'NV1', status: 'completed' });
    invalidateCache('task_missions');

    const missions = await dbService.taskMissions.listByTask('task1');
    expect(missions.length).toBe(2);
    expect(missions.find((m: any) => m.id === 'm1')?.status).toBe('completed');
    expect(missions.find((m: any) => m.id === 'm2')?.status).toBe('todo');
  });

  it('delete() chỉ xóa đúng 1 mission', async () => {
    await dbService.taskMissions.save('task1', { id: 'm1', name: 'NV1' });
    invalidateCache('task_missions');
    await dbService.taskMissions.save('task1', { id: 'm2', name: 'NV2' });
    invalidateCache('task_missions');

    await dbService.taskMissions.delete('task1', 'm1');
    invalidateCache('task_missions');

    const missions = await dbService.taskMissions.listByTask('task1');
    expect(missions.length).toBe(1);
    expect(missions[0].id).toBe('m2');
  });

  it('tasks.list() gắn missions từ task_missions vào từng task', async () => {
    rowsByTable['tasks'] = [{ id: 'task1', name: 'CV 1' }, { id: 'task2', name: 'CV 2' }];
    await dbService.taskMissions.save('task1', { id: 'm1', name: 'NV1' });
    invalidateCache('task_missions');

    const tasks = await dbService.tasks.list();
    const t1 = tasks.find((t: any) => t.id === 'task1');
    const t2 = tasks.find((t: any) => t.id === 'task2');
    expect(t1?.missions).toEqual([{ id: 'm1', name: 'NV1' }]);
    expect(t2?.missions).toEqual([]); // task không có mission nào → mảng rỗng, không lỗi
  });

  it('tasks.save() không ghi "missions" vào row của bảng tasks', async () => {
    await dbService.tasks.save({ id: 'task1', name: 'CV 1', missions: [{ id: 'm1', name: 'NV1' }] } as any);

    const savedRow = rowsByTable['tasks']?.[0];
    expect(savedRow).toBeTruthy();
    expect(savedRow.missions).toBeUndefined();
    // Và task_missions KHÔNG tự động được ghi bởi tasks.save() — việc đồng bộ
    // do App.tsx (performUpdateTask) chủ động làm qua taskMissions.save/delete.
    expect(rowsByTable['task_missions'] || []).toEqual([]);
  });

  it('2 mission ở 2 task khác nhau trùng id vẫn được lưu đủ, không ghi đè nhau', async () => {
    // Mô phỏng đúng bug đã sửa: mission.id sinh kiểu `mission_${Date.now()}`
    // (không có phần ngẫu nhiên) có thể trùng giữa 2 task khác nhau nếu tạo
    // cùng mili-giây. Khóa chính của bảng task_missions phải là khóa GHÉP
    // (task_id + mission.id), không phải mission.id đơn thuần.
    const trungId = 'mission_1700000000000';
    await dbService.taskMissions.save('taskA', { id: trungId, name: 'NV của task A' });
    invalidateCache('task_missions');
    await dbService.taskMissions.save('taskB', { id: trungId, name: 'NV của task B' });
    invalidateCache('task_missions');

    const missionsA = await dbService.taskMissions.listByTask('taskA');
    const missionsB = await dbService.taskMissions.listByTask('taskB');
    expect(missionsA.length).toBe(1);
    expect(missionsB.length).toBe(1);
    expect(missionsA[0].name).toBe('NV của task A');
    expect(missionsB[0].name).toBe('NV của task B');

    // Xóa mission của task A không được đụng tới mission trùng id ở task B.
    await dbService.taskMissions.delete('taskA', trungId);
    invalidateCache('task_missions');
    expect((await dbService.taskMissions.listByTask('taskA')).length).toBe(0);
    expect((await dbService.taskMissions.listByTask('taskB')).length).toBe(1);
  });
});
