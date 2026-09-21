import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ConstructionTakeoff from '../ConstructionTakeoff';

const mk = (id: string, name: string, item: string) => ({
  id, name, createdAt: '1/1/2026',
  rows: [
    { id: 's', kind: 'section', name: '1. PHẦN ' + id },
    { id: 'i', kind: 'item', name: item, unit: 'm2', vatTu: 100, nhanCong: 50, heSo: 1.1 },
  ],
});

const openTemplates = () => fireEvent.click(screen.getByRole('button', { name: /Mẫu bóc tách \(/i }));
const values = (c: HTMLElement) => Array.from(c.querySelectorAll('input')).map((i: any) => i.value);

describe('Bóc tách — nút Áp dụng mẫu', () => {
  it('đổi sang mẫu khác khi bảng đang có dữ liệu (window.confirm bị trình duyệt chặn vẫn chạy được)', () => {
    localStorage.setItem('hl_takeoff_templates', JSON.stringify([mk('A', 'Mẫu A', 'Hạng mục A'), mk('B', 'Mẫu B', 'Hạng mục B')]));
    sessionStorage.clear();
    // Mô phỏng trình duyệt chặn hộp thoại: confirm luôn trả về false
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { container } = render(<ConstructionTakeoff />);

    openTemplates();
    fireEvent.click(screen.getAllByText('Áp dụng')[0]);      // bảng trống → áp thẳng mẫu A
    expect(values(container)).toContain('Hạng mục A');

    openTemplates();
    fireEvent.click(screen.getAllByText('Áp dụng')[1]);      // đổi sang mẫu B → hiện hộp xác nhận trong ứng dụng
    expect(values(container)).toContain('Hạng mục A');       // chưa đổi cho tới khi xác nhận
    fireEvent.click(screen.getByText('Áp dụng mẫu'));
    expect(values(container)).toContain('Hạng mục B');
    expect(values(container)).not.toContain('Hạng mục A');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('hồ sơ đang khóa: áp mẫu sẽ mở khóa', () => {
    localStorage.setItem('hl_takeoff_templates', JSON.stringify([mk('A', 'Mẫu A', 'Hạng mục A')]));
    sessionStorage.clear();
    const setIsLocked = vi.fn();
    const { container } = render(<ConstructionTakeoff isLocked setIsLocked={setIsLocked} isConstructionSaved />);
    openTemplates();
    fireEvent.click(screen.getByText('Áp dụng'));
    fireEvent.click(screen.getByText('Áp dụng mẫu'));
    expect(values(container)).toContain('Hạng mục A');
    expect(setIsLocked).toHaveBeenCalledWith(false);
  });
});
