import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// Hồi quy rà soát tự động đăng nhập (17/11/2026):
//  1) AuthProvider phải PHẢN CHIẾU đúng người đang đăng nhập của App (trước đây giữ bản riêng bị lệch).
//  2) Cập nhật hồ sơ KHÔNG được ghi mật khẩu vào "ghi nhớ đăng nhập".
//  3) Phiên không xác minh được thì không tin vai trò/nhóm quyền ghi trong localStorage.
vi.mock('../../lib/dbService', () => ({ dbService: { employees: { save: vi.fn(async () => {}) } } }));
import { AuthProvider, useAuth } from '../AuthContext';
import { untrustedSessionUser } from '../../lib/employeeAccount';

const u = (o: any = {}): any => ({ id: 'e1', name: 'An', email: '', phone: '', department: '', username: 'an', roleGroupIds: ['role_office'], ...o });
let api: ReturnType<typeof useAuth>;
const Probe = () => { api = useAuth(); return <span data-testid="who">{api.currentUser ? `${api.currentUser.name}|${(api.currentUser.roleGroupIds || []).join(',')}` : 'none'}</span>; };
const mount = (props: any = {}) => render(<AuthProvider employees={[]} addToast={vi.fn()} {...props}><Probe /></AuthProvider>);

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe('AuthProvider phản chiếu người dùng của App', () => {
  it('quyền/tên đổi ở App → useAuth() thấy ngay (không giữ bản cũ trong storage)', () => {
    sessionStorage.setItem('hl_erp_active_session', JSON.stringify(u()));   // bản cũ trong storage
    const { rerender } = mount({ currentUser: u({ roleGroupIds: ['role_admin'], name: 'An (mới)' }), onCurrentUserChange: vi.fn() });
    expect(screen.getByTestId('who').textContent).toBe('An (mới)|role_admin');
    rerender(<AuthProvider employees={[]} addToast={vi.fn()} currentUser={u({ roleGroupIds: [] })} onCurrentUserChange={vi.fn()}><Probe /></AuthProvider>);
    expect(screen.getByTestId('who').textContent).toBe('An|');
  });
  it('setCurrentUser của context chuyển ngược lên App', () => {
    const onChange = vi.fn();
    mount({ currentUser: u(), onCurrentUserChange: onChange });
    act(() => api.setCurrentUser(null));
    expect(onChange).toHaveBeenCalledWith(null);
  });
  it('không truyền currentUser → vẫn tự quản lý như trước (đọc phiên từ storage)', () => {
    sessionStorage.setItem('hl_erp_active_session', JSON.stringify(u({ name: 'Bình' })));
    mount();
    expect(screen.getByTestId('who').textContent).toContain('Bình');
  });
});

describe('Ghi nhớ đăng nhập không chứa mật khẩu', () => {
  it('cập nhật hồ sơ: chỉ còn tên đăng nhập trong hl_erp_remembered_credentials', async () => {
    localStorage.setItem('hl_erp_remembered_credentials', JSON.stringify({ username: 'an' }));
    mount({ currentUser: u(), onCurrentUserChange: vi.fn() });
    await act(async () => { await api.handleUpdateProfile(u({ password: '$2a$10$hashgiả' })); });
    const saved = JSON.parse(localStorage.getItem('hl_erp_remembered_credentials') || '{}');
    expect(saved).toEqual({ username: 'an' });
    expect(JSON.stringify(localStorage)).not.toContain('hashgiả');
  });
});

describe('untrustedSessionUser', () => {
  it('bỏ vai trò/nhóm quyền ghi trong phiên (kể cả admin giả), chỉ giữ thông tin nhận diện', () => {
    const r: any = untrustedSessionUser(u({ role: 'director', roleGroupIds: ['role_admin'], phone: '090', password: 'x' }));
    expect(r.roleGroupIds).toEqual([]);
    expect(r.role).toBeUndefined();
    expect(r.password).toBeUndefined();
    expect(r).toMatchObject({ id: 'e1', name: 'An', username: 'an', phone: '090' });
  });
});
