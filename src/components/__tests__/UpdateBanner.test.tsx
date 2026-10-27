import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const S = vi.hoisted(() => ({ available: true, reload: vi.fn() }));
vi.mock('../../lib/appUpdate', () => ({ useAppUpdate: () => ({ updateAvailable: S.available, reload: S.reload }) }));
import UpdateBanner from '../UpdateBanner';

describe('Thanh báo bản mới', () => {
  it('có bản mới → hiện thanh và nút Cập nhật gọi tải lại', () => {
    S.available = true; S.reload.mockClear();
    render(<UpdateBanner />);
    expect(screen.getByTestId('update-banner').textContent).toContain('Có bản mới');
    fireEvent.click(screen.getByTestId('update-reload'));
    expect(S.reload).toHaveBeenCalledTimes(1);
  });
  it('chưa có bản mới → không hiện gì', () => {
    S.available = false;
    render(<UpdateBanner />);
    expect(screen.queryByTestId('update-banner')).toBeNull();
  });
});
