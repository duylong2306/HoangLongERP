import { describe, it, expect } from 'vitest';
import { getDefaultColumns, getProjectColumnId } from '../kanbanLogic';

// Kịch bản tái hiện lỗi "nhảy cột lung tung": dự án có kanbanColumnId trỏ tới 1
// cột ĐÃ BỊ XÓA (mô phỏng việc user xóa/đổi tên cột). Theo quyết định nghiệp vụ
// (2026-08-26): vị trí cột CHỈ do kanbanColumnId quyết định (kéo thả thủ công
// hoặc quy tắc "Chuyển cột khi hoàn thành") — KHÔNG còn đoán theo % tiến độ hay
// trạng thái dự án nữa. Khi kanbanColumnId không hợp lệ, dự án phải rơi về CỘT
// ĐẦU TIÊN của board, bất kể % tiến độ là bao nhiêu.
describe('kanban jump repro — kanbanColumnId trỏ tới cột đã xóa', () => {
  const columns = getDefaultColumns();
  const firstColId = columns[0].id;

  const makeProject = (progress: number, deletedColId: string) => ({
    id: 'p1', progress, status: 'processing', kanbanColumnId: deletedColId,
  } as any);

  it.each([15, 75, 95])('progress=%i%% với kanbanColumnId đã mất hiệu lực → luôn về cột đầu tiên, không đoán theo %%', (progress) => {
    const proj = makeProject(progress, 'col_that_was_deleted');
    expect(getProjectColumnId(proj, columns)).toBe(firstColId);
  });

  it('kanbanColumnId còn hợp lệ → giữ nguyên, không bị ghi đè bởi progress/status', () => {
    const proj = { id: 'p1', progress: 95, status: 'processing', kanbanColumnId: 'col_waiting' } as any;
    expect(getProjectColumnId(proj, columns)).toBe('col_waiting');
  });
});
