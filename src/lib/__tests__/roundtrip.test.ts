import { describe, it, expect } from 'vitest';
import { keysToSnake, rowToCamel } from '../dbService';

describe('missions travelAllowances round-trip', () => {
  it('preserves travelAllowances through keysToSnake -> rowToCamel', () => {
    const task: any = {
      id: 'task1',
      name: 'CV',
      missions: [
        {
          id: 'm1',
          name: 'Nhiệm vụ',
          memberIds: ['emp1'],
          status: 'todo',
          travelAllowances: [
            { id: 'ta1', memberId: 'emp1', content: 'Đi HN', quantity: 1, unitPrice: 200000, amount: 200000 },
          ],
        },
      ],
    };

    // Simulate saveSupabase: keysToSnake(item) then upsert jsonb
    const saved = keysToSnake(task);
    console.log('SAVED missions[0] keys:', Object.keys(saved.missions[0]));
    console.log('SAVED missions[0].travelAllowances present?', !!saved.missions[0].travelAllowances, Object.keys(saved.missions[0].travelAllowances?.[0] || {}));

    // Simulate load: row = saved (jsonb returns as-is), then rowToCamel
    const loaded = rowToCamel(saved);
    console.log('LOADED missions[0] keys:', Object.keys(loaded.missions[0]));
    console.log('LOADED travelAllowances:', loaded.missions[0].travelAllowances);

    expect(loaded.missions[0].travelAllowances).toBeTruthy();
    expect(loaded.missions[0].travelAllowances.length).toBe(1);
    expect(loaded.missions[0].travelAllowances[0].content).toBe('Đi HN');
  });
});

describe('hrm_role_groups permissions round-trip', () => {
  it('preserves snake_case module codes after load (rowToCamel would mangle them)', () => {
    // DB row: cột snake_case, permissions dùng mã module snake_case
    const row: any = {
      id: 'role_accounting',
      name: 'Kế toán',
      description: 'Phòng kế toán',
      permissions: { projects_construction: { view: true, create: false, edit: false, delete: false } },
      member_ids: ['emp_admin', 'NV001'],
    };

    // Save: keysToSnake (mã module đã snake_case -> giữ nguyên)
    const saved = keysToSnake(row);
    expect(saved.permissions.projects_construction).toBeTruthy();

    // Load: querySupabase áp dụng rowToCamel đệ quy -> mã module bị đổi thành camelCase
    const loaded = rowToCamel(saved);
    expect(loaded.permissions.projectsConstruction).toBeTruthy();
    expect(loaded.permissions.projects_construction).toBeUndefined(); // bug gốc

    // Khôi phục như trong hrmRoleGroups.list()
    const fixedPermissions = keysToSnake(loaded.permissions);
    expect(fixedPermissions.projects_construction).toBeTruthy();
    expect(fixedPermissions.projects_construction.view).toBe(true);
    // memberIds không bị mất (array string không đổi)
    expect(loaded.memberIds).toEqual(['emp_admin', 'NV001']);
  });
});
