import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { formatContractMoney } from '../../lib/subcontractorContractValue';
import { docSoTiengViet } from '../QuotationTableSheet';

// Hợp đồng thầu phụ: sau "Hủy phê duyệt" phải sửa được giá trị ngay (không cần "Chỉnh sửa bản in"), lưu riêng, đổi cả số trong văn bản.
let stored: any;
// save cập nhật "cơ sở dữ liệu" giả — component tải lại danh sách sau mỗi lần lưu (sự kiện hl-archived-subcontractor-quotes-updated)
const save = vi.fn(async (q: any) => { stored = { ...q }; });
vi.mock('../../lib/dbService', () => ({
  dbService: {
    archivedQuotes: { list: vi.fn(async () => [stored]), save: (q: any) => save(q), delete: vi.fn() },
    projects: { list: vi.fn(async () => []) },
    accountingSubcontractors: { list: vi.fn(async () => []) },
    businessProfile: { get: vi.fn(async () => null) },
  },
}));
const addToast = vi.fn();
vi.mock('../../context', () => ({
  useNotification: () => ({ addToast }),
  isUserInRoleGroup: () => true, isRoleAdmin: () => true, isRoleAccounting: () => true,
  canApproveProjectDoc: () => true,
}));
vi.mock('../RichTextEditor', () => ({ default: (p: any) => <div data-testid="editor" data-disabled={String(!!p.disabled)}>{p.value}</div> }));
import SubcontractorArchive from '../SubcontractorArchive';

const html = (v: number) => `<p>Giá trị: ${formatContractMoney(v)} (${docSoTiengViet(v)})</p>`;
const user: any = { id: 'u1', name: 'Giám đốc' };
beforeEach(() => {
  save.mockClear(); addToast.mockClear();
  stored = { id: 'h1', code: 'HDTP-1', sector: 'subcontractor', creatorId: 'u1', subcontractorName: 'Tổ A', contractValue: 420000000, isApproved: true, status: 'Hoàn thành', contractHtml: html(420000000) };
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
const open = async () => {
  render(<SubcontractorArchive currentUser={user} viewContractId="h1" />);
  return await screen.findByDisplayValue('420000000');
};
// Sau khi hủy duyệt component tải lại danh sách (có thể dựng lại ô nhập) → luôn lấy lại ô hiện tại, đã mở khóa
const unlockedInput = async () => {
  fireEvent.click(screen.getByText('Hủy phê duyệt'));
  await waitFor(() => expect((screen.getByDisplayValue('420000000') as HTMLInputElement).disabled).toBe(false));
  await new Promise(r => setTimeout(r, 50));   // chờ lần tải lại danh sách sau khi hủy duyệt xong (không được làm mất thao tác kế tiếp)
  return screen.getByDisplayValue('420000000') as HTMLInputElement;
};

describe('SubcontractorArchive — sửa giá trị hợp đồng sau khi hủy duyệt', () => {
  it('đã duyệt → ô giá trị khóa', async () => {
    const input = await open();
    expect((input as HTMLInputElement).disabled).toBe(true);
  });
  it('hủy duyệt → ô giá trị sửa được NGAY (chưa bấm Chỉnh sửa bản in), lưu riêng và đổi cả số trong văn bản', async () => {
    await open();
    const input = await unlockedInput();
    expect(screen.queryByText('Lưu giá trị')).toBeNull();           // chưa đổi gì → chưa có nút
    fireEvent.change(input, { target: { value: '500000000' } });
    fireEvent.click(await screen.findByText('Lưu giá trị'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));     // lần 1: hủy duyệt, lần 2: lưu giá trị
    const saved = save.mock.calls[1][0];
    expect(saved.contractValue).toBe(500000000);
    expect(saved.isApproved).toBe(false);
    expect(saved.contractHtml).toContain('500.000.000 VND');
    expect(saved.contractHtml).toContain(docSoTiengViet(500000000));
    expect(saved.contractHtml).not.toContain('420.000.000');
    await waitFor(() => expect(screen.queryByText('Lưu giá trị')).toBeNull());   // lưu xong nút biến mất
  });
  it('Hoàn tác trả ô về giá trị đã lưu, không ghi gì', async () => {
    await open();
    const input = await unlockedInput();
    save.mockClear();
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.click(await screen.findByText('Hoàn tác'));
    expect(input.value).toBe('420000000');
    expect(save).not.toHaveBeenCalled();
  });
  it('văn bản đã bị sửa tay (mất số cũ) → vẫn lưu giá trị nhưng cảnh báo phải sửa văn bản', async () => {
    stored.contractHtml = '<p>Giá trị hợp đồng theo thỏa thuận</p>';
    await open();
    const input = await unlockedInput();
    fireEvent.change(input, { target: { value: '510000000' } });
    fireEvent.click(await screen.findByText('Lưu giá trị'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1][0].contractValue).toBe(510000000);
    expect(addToast.mock.calls.at(-1)![0].type).toBe('warning');
  });
});
