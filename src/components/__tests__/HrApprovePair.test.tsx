import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// Kiểm chứng LUỒNG THẬT trong màn hình Nhân sự: 2 đơn "Báo cáo nghỉ ca" (sáng + chiều) cùng ngày → bấm "Duyệt cả ngày" MỘT lần →
// cả hai đơn được duyệt và lưu (không bị ghi đè lẫn nhau); "Từ chối cả ngày" → cả hai bị từ chối.
const chatMock = vi.hoisted(() => ({ sendGroupChatMessage: vi.fn().mockResolvedValue(null), sendApprovalDirectMessage: vi.fn().mockResolvedValue(null) }));
vi.mock('../../lib/chatStore', () => chatMock);
vi.mock('../../context', () => ({
  useNotification: () => ({ addToast: vi.fn() }),
  isUserInRoleGroup: () => true, isRoleAdmin: () => true, isRoleAccounting: () => true, isRoleOffice: () => true, isRoleTechnical: () => true,
  getConfiguredSettler: () => null, getConfiguredSettlers: () => [],
  getAccentClasses: () => '', getConfiguredApprover: () => null, getConfiguredApprovers: () => [],
  hasModulePermission: () => true,
}));

vi.mock('../../context/SettingsContext', () => ({ useSettings: () => ({ settings: {}, businessInfo: { companyName: 'Cty thử' }, hrmConfig: {} }) }));

const d = `${new Date().getFullYear()}-01-10`;
const mkLeave = (id: string, shift: string) => ({ id, empId: 'NV018', empName: 'Lê Văn Công', type: 'Báo cáo nghỉ ca', shift, fromDate: d, toDate: d, daysCount: 1, status: 'pending', reason: `[Vắng mặt / Không điểm danh] - Lý do: Em bị ốm`, isAttendanceCorrection: true, approverName: 'Admin', approverId: 'admin1' });
const leaveStore: any[] = [];
const leaveSave = vi.fn().mockImplementation((l: any) => { const i = leaveStore.findIndex(x => x.id === l.id); if (i >= 0) leaveStore[i] = l; else leaveStore.push(l); return Promise.resolve(); });
const attendanceSave = vi.fn().mockResolvedValue(undefined);
const employeesSave = vi.fn().mockResolvedValue(undefined);

vi.mock('../../lib/dbService', () => {
  const makeTable = (extra: Record<string, any> = {}) => ({ list: vi.fn().mockResolvedValue([]), save: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined), deleteMultiple: vi.fn().mockResolvedValue(undefined), get: vi.fn().mockResolvedValue(null), ...extra });
  const target: any = {
    hrmLeaves: { ...makeTable(), list: vi.fn().mockImplementation(() => Promise.resolve(JSON.parse(JSON.stringify(leaveStore)))), save: (...a: any[]) => leaveSave(...a) },
    attendance: { ...makeTable(), save: (...a: any[]) => attendanceSave(...a), listForRange: vi.fn().mockResolvedValue([]), getCachedRange: vi.fn().mockReturnValue(null) },
    employees: { ...makeTable(), list: vi.fn().mockResolvedValue([{ id: 'NV018', name: 'Lê Văn Công', status: 'working', phepNam: 12 }]), save: (...a: any[]) => employeesSave(...a) },
  };
  return { dbService: new Proxy(target, { get(t: any, p: string) { if (p in t) return t[p]; t[p] = makeTable(); return t[p]; } }), camelToSnake: (s: string) => s, snakeToCamel: (s: string) => s };
});

import HumanResourcesManagement from '../HumanResourcesManagement';
import { computeDailyWorkday } from '../hr/hrCalculations';

beforeEach(() => { cleanup(); attendanceSave.mockClear(); employeesSave.mockClear(); leaveStore.length = 0; leaveStore.push(mkLeave('LR-001', 'morning'), mkLeave('LR-002', 'afternoon')); leaveSave.mockClear(); localStorage.clear(); });

const admin = { id: 'admin1', name: 'Admin', role: 'director', roleGroupIds: ['role_admin'] } as any;
const open = async () => {
  const { container } = render(<HumanResourcesManagement currentUser={admin} defaultSubTab="leaves" hideSidebar systemConfig={{} as any} />);
  await waitFor(() => expect(container.textContent).toContain('Cả ngày (sáng + chiều)'), { timeout: 4000 });
  // Màn hình tạm KHÔNG ghi lên cơ sở dữ liệu trong ~0,5 giây đầu sau khi tải danh sách từ máy chủ (chống ghi đè) — người dùng thật bấm sau đó
  await new Promise(r => setTimeout(r, 800));
  fireEvent.click(container.querySelector('tbody tr')!);
  return container;
};

describe('Màn hình Nhân sự — duyệt cả ngày (luồng thật)', () => {
  it('Duyệt cả ngày: cả 2 đơn đều thành "approved" và được lưu', async () => {
    await open();
    fireEvent.click(await screen.findByText('Duyệt cả ngày ✅'));
    await waitFor(() => expect(leaveStore.map(l => l.status)).toEqual(['approved', 'approved']), { timeout: 4000 });
  });
  it('Từ chối cả ngày: cả 2 đơn đều thành "rejected"', async () => {
    await open();
    fireEvent.click(await screen.findByText('Từ chối cả ngày'));
    await waitFor(() => expect(leaveStore.map(l => l.status)).toEqual(['rejected', 'rejected']), { timeout: 4000 });
  });

  it('Duyệt cả ngày khi ngày CHƯA có bản ghi chấm công: KHÔNG tự điền giờ làm, công = 0 (mã P) — không phải +0,5/+1', async () => {
    await open();
    fireEvent.click(await screen.findByText('Duyệt cả ngày ✅'));
    await waitFor(() => expect(leaveStore.map(l => l.status)).toEqual(['approved', 'approved']), { timeout: 4000 });
    await waitFor(() => expect(attendanceSave.mock.calls.some(c => c[0]?.date === d)).toBe(true), { timeout: 4000 });
    const saved = attendanceSave.mock.calls.map(c => c[0]).filter(r => r?.empId === 'NV018' && r?.date === d).pop();
    const blank = (v: any) => !v || v === '--:--' || v === '';
    expect([saved.timeInS, saved.timeOutS, saved.timeInC, saved.timeOutC].every(blank)).toBe(true);   // không có giờ làm bịa ra
    const coefs = [{ id: 'MSHID', coefficient: 0.5 }, { id: 'ASHID', coefficient: 0.5 }, { id: 'KP', coefficient: -2 }, { id: 'P', coefficient: 0 }];
    const leaves = leaveStore.map(l => ({ ...l, fromDate: l.fromDate, toDate: l.toDate }));
    expect(computeDailyWorkday(saved, coefs, [], [0], leaves).workday).toBe(0);
  });
});

describe('Màn hình Nhân sự — duyệt báo cáo lỗi chấm công điền giờ theo CẤU HÌNH CA', () => {
  const cfg = { morningIn: '08:00', morningOut: '12:00', afternoonIn: '13:30', afternoonOut: '17:30' } as any;
  const openOne = async (leave: any, systemConfig: any) => {
    leaveStore.length = 0; leaveStore.push(leave);
    const { container } = render(<HumanResourcesManagement currentUser={admin} defaultSubTab="leaves" hideSidebar systemConfig={systemConfig} />);
    await waitFor(() => expect(container.querySelector('tbody tr')).not.toBeNull(), { timeout: 4000 });
    await new Promise(r => setTimeout(r, 800));   // qua giai đoạn không ghi sau khi tải danh sách
    fireEvent.click(container.querySelector('tbody tr')!);
    fireEvent.click(await screen.findByText('Duyệt phép ✅'));
  };
  const lastSaved = async () => {
    await waitFor(() => expect(attendanceSave.mock.calls.some(c => c[0]?.empId === 'NV018' && c[0]?.date === d)).toBe(true), { timeout: 4000 });
    return attendanceSave.mock.calls.map(c => c[0]).filter(r => r?.empId === 'NV018' && r?.date === d).pop();
  };

  it('Lỗi chấm ra ca (ca chiều, chưa có bản ghi) → giờ vào/ra chiều lấy theo cấu hình ca (13:30–17:30), ca sáng để trống', async () => {
    await openOne({ ...mkLeave('LR-9', 'afternoon'), type: 'Báo cáo lỗi chấm ra ca' }, cfg);
    const r = await lastSaved();
    expect([r.timeInC, r.timeOutC]).toEqual(['13:30', '17:30']);
    expect([r.timeInS, r.timeOutS]).toEqual(['', '']);
  });
  it('Lỗi hệ thống chấm công (ca sáng) → giờ sáng theo cấu hình (08:00–12:00)', async () => {
    await openOne({ ...mkLeave('LR-9', 'morning'), type: 'Báo cáo lỗi hệ thống chấm công' }, cfg);
    const r = await lastSaved();
    expect([r.timeInS, r.timeOutS]).toEqual(['08:00', '12:00']);
    expect([r.timeInC, r.timeOutC]).toEqual(['', '']);
  });
  it('Chưa có cấu hình ca → dùng giờ mặc định (không lỗi)', async () => {
    await openOne({ ...mkLeave('LR-9', 'afternoon'), type: 'Báo cáo lỗi chấm ra ca' }, undefined);
    const r = await lastSaved();
    expect([r.timeInC, r.timeOutC]).toEqual(['13:00', '17:00']);
  });
});

describe('Màn hình Nhân sự — duyệt đơn nghỉ phép năm 1 CA', () => {
  const shiftLeave = (o: any = {}) => ({ id: 'LR-S1', empId: 'NV018', empName: 'Lê Văn Công', type: 'Nghỉ phép năm', shift: 'morning', fromDate: d, toDate: d, daysCount: 0.5, status: 'pending', reason: 'Việc gia đình', approverName: 'Admin', approverId: 'admin1', ...o });
  const openOneLeave = async (leave: any) => {
    leaveStore.length = 0; leaveStore.push(leave);
    const { container } = render(<HumanResourcesManagement currentUser={admin} defaultSubTab="leaves" hideSidebar systemConfig={{} as any} />);
    await waitFor(() => expect(container.querySelector('tbody tr')).not.toBeNull(), { timeout: 4000 });
    await new Promise(r => setTimeout(r, 800));
    return container;
  };

  it('danh sách hiện nhãn "Nghỉ 1 ca sáng" cho đơn nghỉ phép 1 ca', async () => {
    const c = await openOneLeave(shiftLeave());
    expect(c.querySelector('tbody')!.textContent).toContain('Nghỉ 1 ca sáng');
    expect(c.querySelector('tbody')!.textContent).toContain('0.5 ngày');
  });
  it('duyệt: trừ ĐÚNG 0,5 ngày phép năm, và KHÔNG ghi ký hiệu nghỉ đè cả ngày (bản ghi chấm công để trống giờ)', async () => {
    const c = await openOneLeave(shiftLeave());
    fireEvent.click(c.querySelector('tbody tr')!);
    fireEvent.click(await screen.findByText('Duyệt phép ✅'));
    await waitFor(() => expect(leaveStore[0].status).toBe('approved'), { timeout: 4000 });
    await waitFor(() => expect(employeesSave).toHaveBeenCalled(), { timeout: 4000 });
    expect(employeesSave.mock.calls[0][0].phepNam).toBe(11.5);                       // 12 − 0,5
    await waitFor(() => expect(attendanceSave.mock.calls.some(c => c[0]?.empId === 'NV018' && c[0]?.date === d)).toBe(true), { timeout: 4000 });
    const rec = attendanceSave.mock.calls.map(c => c[0]).filter(r => r?.empId === 'NV018' && r?.date === d).pop();
    expect([rec.timeInS, rec.timeOutS, rec.timeInC, rec.timeOutC].every((v: any) => !v)).toBe(true);   // không có 'PN' đè lên giờ
    expect(rec.status).not.toBe('excused');
  });
  it('nghỉ không lương 1 ca: duyệt không trừ phép năm', async () => {
    const c = await openOneLeave(shiftLeave({ type: 'Nghỉ không lương có xin phép', shift: 'afternoon' }));
    fireEvent.click(c.querySelector('tbody tr')!);
    fireEvent.click(await screen.findByText('Duyệt phép ✅'));
    await waitFor(() => expect(leaveStore[0].status).toBe('approved'), { timeout: 4000 });
    expect(employeesSave).not.toHaveBeenCalled();
  });
});
