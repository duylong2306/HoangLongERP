import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { checkNewPassword } from '../../lib/passwordChange';

vi.mock('../../context', () => ({ useNotification: () => ({ addToast: vi.fn() }) }));
const requestPasswordChange = vi.fn();
vi.mock('../../lib/passwordChange', async (orig) => ({ ...(await orig<any>()), requestPasswordChange: (...a: any[]) => requestPasswordChange(...a) }));
import ForcePasswordModal from '../ForcePasswordModal';

// (dùng khối {} để beforeEach không trả về hàm mock — vitest sẽ gọi giá trị trả về như hàm dọn dẹp)
beforeEach(() => { requestPasswordChange.mockReset(); });
const dien = (o: string, n: string, c: string) => {
  fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: o } });
  fireEvent.change(screen.getByLabelText('Mật khẩu mới (từ 6 ký tự)'), { target: { value: n } });
  fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: c } });
};

describe('ForcePasswordModal', () => {
  it.each(['force', 'default'] as const)("'%s' có nút Để sau, bấm thì đóng mà không gọi máy chủ", (notice) => {
    const onDone = vi.fn();
    render(<ForcePasswordModal notice={notice} onDone={onDone} />);
    fireEvent.click(screen.getByText('Để sau'));
    expect(onDone).toHaveBeenCalled();
    expect(requestPasswordChange).not.toHaveBeenCalled();
  });
  it('mật khẩu xác nhận không khớp → báo lỗi, không gọi máy chủ', () => {
    render(<ForcePasswordModal notice="force" onDone={() => {}} />);
    dien('123', 'MatKhauMoi9', 'khac');
    fireEvent.click(screen.getByText('Đổi mật khẩu'));
    expect(screen.getByRole('alert').textContent).toMatch(/không khớp/);
    expect(requestPasswordChange).not.toHaveBeenCalled();
  });
  it('đổi thành công → gọi máy chủ và đóng', async () => {
    requestPasswordChange.mockResolvedValue(undefined);
    const onDone = vi.fn();
    render(<ForcePasswordModal notice="force" onDone={onDone} />);
    dien('123', 'MatKhauMoi9', 'MatKhauMoi9');
    fireEvent.click(screen.getByText('Đổi mật khẩu'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(requestPasswordChange).toHaveBeenCalledWith('123', 'MatKhauMoi9');
  });
  it('máy chủ từ chối → hiện lỗi và không đóng', async () => {
    requestPasswordChange.mockRejectedValue(new Error('Mật khẩu hiện tại không đúng.'));
    const onDone = vi.fn();
    render(<ForcePasswordModal notice="force" onDone={onDone} />);
    dien('sai', 'MatKhauMoi9', 'MatKhauMoi9');
    fireEvent.click(screen.getByText('Đổi mật khẩu'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/không đúng/));
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('checkNewPassword', () => {
  it('các quy tắc', () => {
    expect(checkNewPassword('', 'abcdef', 'abcdef')).toMatch(/hiện tại/);
    expect(checkNewPassword('a', 'abc', 'abc')).toMatch(/ít nhất/);
    expect(checkNewPassword('a', '123', '123')).toMatch(/ít nhất/);
    expect(checkNewPassword('abcdef', 'abcdef', 'abcdef')).toMatch(/khác/);
    expect(checkNewPassword('a', 'abcdef', 'abcdeg')).toMatch(/không khớp/);
    expect(checkNewPassword('a', 'abcdef', 'abcdef')).toBeNull();
  });
});
