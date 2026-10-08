import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// Màn "Nhật ký": hiện danh sách các lần sửa phân quyền, bấm để xem "từ → sang"; chưa bật nhật ký thì báo rõ cách bật.
const L = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('../../lib/permissionAudit', async () => {
  const real = await vi.importActual<any>('../../lib/permissionAudit');
  return { ...real, loadPermissionAudit: L.load };
});
import PermissionAuditLog from '../hr/tabs/PermissionAuditLog';

afterEach(() => { cleanup(); L.load.mockReset(); });

describe('Nhật ký thay đổi phân quyền', () => {
  it('hiện người sửa, vùng, tóm tắt; bấm mới thấy chi tiết từ → sang', async () => {
    L.load.mockResolvedValue({ ok: true, rows: [{ id: '1', actorName: 'Trương Hữu Long', area: 'project_group', summary: 'Kế toán: +2 quyền, −1 quyền', target: 'Kế toán', createdAt: '2026-10-09T01:00:00Z', changes: [{ label: 'Kế toán — Tạo dự án mới', from: 'Không', to: 'Có' }] }] });
    render(<PermissionAuditLog />);
    expect(await screen.findByText('Kế toán: +2 quyền, −1 quyền')).toBeInTheDocument();
    expect(screen.getByText(/Trương Hữu Long/)).toBeInTheDocument();
    expect(screen.getByText(/Quyền Dự Án — theo nhóm HRM/)).toBeInTheDocument();
    expect(screen.queryByText('Kế toán — Tạo dự án mới:')).toBeNull();                 // chưa mở
    fireEvent.click(screen.getByRole('button', { name: /Kế toán: \+2 quyền/ }));
    expect(screen.getByText('Kế toán — Tạo dự án mới:')).toBeInTheDocument();
    expect(screen.getByText('Không')).toBeInTheDocument(); expect(screen.getByText('Có')).toBeInTheDocument();
  });
  it('trống → báo chưa có thay đổi', async () => {
    L.load.mockResolvedValue({ ok: true, rows: [] });
    render(<PermissionAuditLog />);
    expect(await screen.findByText(/Chưa có thay đổi nào được ghi lại/)).toBeInTheDocument();
  });
  it('chưa chạy migration → báo rõ file cần chạy, không phải lỗi mơ hồ', async () => {
    L.load.mockResolvedValue({ ok: false, notEnabled: true, message: 'x' });
    render(<PermissionAuditLog />);
    expect(await screen.findByRole('alert')).toHaveTextContent('20261019_permission_audit_log.sql');
  });
  it('lỗi khác → hiện thông báo lỗi', async () => {
    L.load.mockResolvedValue({ ok: false, notEnabled: false, message: 'mất mạng' });
    render(<PermissionAuditLog />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('mất mạng'));
  });
});
