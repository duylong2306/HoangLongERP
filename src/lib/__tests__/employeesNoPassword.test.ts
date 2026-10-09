import { describe, it, expect, vi, beforeEach } from 'vitest';

// Bước 1: trình duyệt KHÔNG được nhận hash mật khẩu của nhân viên.
//  • employees.list đọc qua RPC list_employees_safe (không có password); RPC chưa có/lỗi → quay về select như cũ (chạy được với DB chưa migrate).
//  • lưu nhân viên chỉ đòi trả lại cột id (RETURNING * sẽ bị từ chối sau khi thu quyền đọc cột password).
const S = vi.hoisted(() => ({
  rpcResult: { data: null as any, error: null as any },
  rpcCalls: [] as string[],
  selects: [] as { table: string; cols: string }[],
  upsertSelects: [] as { table: string; cols: string | undefined }[],
  selectRows: [] as any[],
}));
vi.mock('../supabase', async (orig) => {
  const actual: any = await orig();
  return {
    ...actual,
    getCurrentCompanyId: () => 'co-1',
    getSupabase: () => ({
      rpc: (name: string) => { S.rpcCalls.push(name); return Promise.resolve(S.rpcResult); },
      from: (table: string) => ({
        select: (cols: string) => { S.selects.push({ table, cols }); return { eq: () => Promise.resolve({ data: S.selectRows, error: null }) }; },
        upsert: () => ({ select: (cols?: string) => { S.upsertSelects.push({ table, cols }); return Promise.resolve({ data: [{ id: 'x' }], error: null }); } }),
      }),
    }),
  };
});
import { dbService, invalidateCache } from '../dbService';

beforeEach(() => {
  S.rpcResult = { data: null, error: null }; S.rpcCalls.length = 0; S.selects.length = 0; S.upsertSelects.length = 0; S.selectRows = [];
  invalidateCache('employees');
});

describe('employees.list — không lấy cột password', () => {
  it('đọc qua rpc list_employees_safe và đổi khóa sang camelCase', async () => {
    S.rpcResult = { data: [{ id: 'NV1', name: 'A', role_group_ids: ['g1'], has_system_account: true, username: 'a01' }], error: null };
    const ds = await dbService.employees.list();
    expect(S.rpcCalls).toEqual(['list_employees_safe']);
    expect(S.selects).toHaveLength(0);                       // không select trực tiếp bảng
    expect(ds[0]).toMatchObject({ id: 'NV1', roleGroupIds: ['g1'], hasSystemAccount: true, username: 'a01' });
    expect('password' in (ds[0] as any)).toBe(false);
  });
  it('RPC chưa có (chưa chạy migration) → quay về select như cũ, không làm hỏng việc tải nhân viên', async () => {
    S.rpcResult = { data: null, error: { message: 'Could not find the function public.list_employees_safe', code: 'PGRST202' } };
    S.selectRows = [{ id: 'NV2', name: 'B', has_system_account: false }];
    const ds = await dbService.employees.list();
    expect(S.rpcCalls).toEqual(['list_employees_safe']);
    expect(S.selects).toEqual([{ table: 'employees', cols: '*' }]);
    expect(ds[0]).toMatchObject({ id: 'NV2', hasSystemAccount: false });
  });
  it('bảng khác vẫn đọc bình thường (không đi qua RPC)', async () => {
    S.selectRows = [{ id: 'k1', name: 'KH' }];
    await dbService.customers.list();
    expect(S.rpcCalls).toEqual([]);
  });
});

describe('employees.save — không đòi trả lại toàn bộ cột', () => {
  it('chỉ select("id") sau khi upsert nhân viên', async () => {
    await dbService.employees.save({ id: 'NV1', roleGroupIds: ['g1'] });
    expect(S.upsertSelects).toEqual([{ table: 'employees', cols: 'id' }]);
  });
  it('bảng khác giữ nguyên hành vi cũ (select mặc định)', async () => {
    await dbService.hrmRoleGroups.save({ id: 'g1', name: 'N', description: '', permissions: {}, memberIds: [] });
    expect(S.upsertSelects[0]).toEqual({ table: 'hrm_role_groups', cols: undefined });
  });
});
