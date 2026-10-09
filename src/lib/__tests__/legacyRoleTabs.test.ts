import { describe, it, expect } from 'vitest';
import { filterLegacyFallbackTabs } from '../legacyRoleTabs';

// Hồi quy lỗi nghiêm trọng: nhân viên không có nhóm rơi về quyền cũ theo `role=engineer` và vào được Cài đặt/Phân quyền/Nhân sự.
const ENGINEER = ['dashboard', 'project-office', 'projects-construction', 'projects-furniture', 'projects-mechanical', 'tasks', 'messages', 'hr-office', 'employees', 'system-office', 'settings'];
const DIRECTOR = [...ENGINEER, 'director-office', 'director-dashboard', 'accounting-office', 'finance', 'finance-data', 'hr-data', 'settings-accounts', 'settings-roles', 'display-settings'];

describe('filterLegacyFallbackTabs — đường dự phòng không cấp màn nhạy cảm', () => {
  it('quyền cũ của engineer: giữ màn nghiệp vụ, bỏ nhân sự và toàn bộ cài đặt', () => {
    const r = filterLegacyFallbackTabs(ENGINEER);
    expect(r).toEqual(['dashboard', 'project-office', 'projects-construction', 'projects-furniture', 'projects-mechanical', 'tasks', 'messages']);
    for (const t of ['hr-office', 'employees', 'system-office', 'settings']) expect(r).not.toContain(t);
  });
  it('quyền cũ của director: cũng không còn Cài đặt/Phân quyền/Tài khoản/Tài chính/Phòng giám đốc qua đường dự phòng', () => {
    const r = filterLegacyFallbackTabs(DIRECTOR);
    for (const t of ['settings-roles', 'settings-accounts', 'display-settings', 'finance', 'accounting-office', 'director-dashboard', 'hr-data']) expect(r).not.toContain(t);
    expect(r).toContain('projects-construction');
  });
  it('rỗng/undefined không gây lỗi', () => {
    expect(filterLegacyFallbackTabs(undefined)).toEqual([]);
    expect(filterLegacyFallbackTabs([])).toEqual([]);
  });
});
