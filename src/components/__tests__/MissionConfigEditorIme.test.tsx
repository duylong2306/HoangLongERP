import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../context', () => ({ useNotification: () => ({ addToast: vi.fn() }) }));
import MissionConfigEditor from '../MissionConfigEditor';

// Ô "Tên nhiệm vụ" thêm nhiệm vụ bằng Enter: lúc đang ghép chữ tiếng Việt, Enter chỉ chốt chữ, không được thêm nhiệm vụ nửa chừng.
describe('MissionConfigEditor — Enter khi gõ tiếng Việt', () => {
  const setup = () => {
    const onChange = vi.fn();
    render(<MissionConfigEditor value={[]} onChange={onChange} employees={[]} />);
    const input = screen.getByPlaceholderText(/Kiểm tra mộng tủ dưới bếp/);
    return { input, onChange };
  };
  it('Enter lúc đang ghép chữ (Chrome isComposing / Safari keyCode 229) → chưa thêm', () => {
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: 'Cắt hồi tủ ơi' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: false, keyCode: 229 });
    expect(onChange).not.toHaveBeenCalled();
  });
  it('Enter thường → thêm nhiệm vụ với đủ tên đã gõ', () => {
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: 'Cắt hồi tủ ơi' } });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0].name).toBe('Cắt hồi tủ ơi');
  });
});
