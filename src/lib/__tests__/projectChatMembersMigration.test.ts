// Migration 20261030: kiểm tra các điểm an toàn bằng đọc nội dung file (không có cơ sở dữ liệu để chạy thử trong test)
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
const sql = fs.readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20261030_project_chat_members.sql'), 'utf8');

describe('migration thành viên nhóm chat dự án', () => {
  it('có đủ 5 trigger: dự án, công việc, nhiệm vụ, nhân viên, nhóm quyền', () => {
    for (const t of ['pcm_projects', 'pcm_tasks', 'pcm_missions', 'pcm_employees', 'pcm_role_groups']) expect(sql).toMatch(new RegExp(`create trigger ${t} `));
  });
  it('nguồn thành viên: trưởng dự án, người trong dự án, công việc, nhiệm vụ, Giám đốc/quản trị; bỏ người nghỉ việc', () => {
    expect(sql).toMatch(/p\.pm_id as id/); expect(sql).toMatch(/involved_employee_ids/); expect(sql).toMatch(/assignee_id/); expect(sql).toMatch(/assigner_id/);
    expect(sql).toMatch(/mainAssigneeId/); expect(sql).toMatch(/memberIds/);
    expect(sql).toMatch(/__role_kind__admin/); expect(sql).toMatch(/role_superadmin/);
    // tài khoản kỹ thuật emp_admin KHÔNG được tự thêm vào mọi nhóm (chủ dự án chọn)
    expect(sql).toMatch(/t\.x not in \('emp_admin', 'NV_ADMIN', 'admin'\)/);
    expect(sql).not.toMatch(/e\.id in \('emp_admin'/);
    expect(sql).toMatch(/status is distinct from 'retired'/);
  });
  it('người thêm tay được giữ (auto_member_ids), nghỉ việc thì gỡ khỏi mọi nhóm trừ hội thoại 1-1', () => {
    expect(sql).toMatch(/auto_member_ids text\[\]/);
    expect(sql).toMatch(/type <> 'personal' and participant_ids @> array\[new\.id\]/);
  });
  it('không ghi đè nhóm có sẵn: chỉ insert khi chưa có (on conflict do nothing)', () => {
    expect(sql).toMatch(/on conflict \(company_id, id\) do nothing/);
  });
  it('hàm ứng dụng lấy công ty từ TOKEN, chỉ cấp cho người đã đăng nhập; hàm nội bộ bị thu quyền', () => {
    expect(sql).toMatch(/auth\.jwt\(\) ->> 'company_id'/);
    expect(sql).toMatch(/grant execute on function public\.ensure_project_chat_group\(text\), public\.add_conversation_members\(text, text\[\]\) to authenticated/);
    expect(sql).toMatch(/revoke all on function public\.project_chat_admin_ids/);
  });
  it('dữ liệu cũ KHÔNG tự sửa trong migration — có hàm xem trước và hướng dẫn chạy tay', () => {
    expect(sql).toMatch(/preview_project_chat_members/);
    expect(sql).not.toMatch(/^select public\.sync_all_project_chat_members/m);
  });
});
