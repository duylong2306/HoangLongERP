import { useEffect, useState } from 'react';
import { dbService } from '../lib/dbService';
import { ensureColumnsHaveAutomationDefaults, getDefaultColumns, type KanbanColumn } from '../lib/kanbanLogic';

// Bộ cột kanban dự án của từng lĩnh vực — để màn không phải là bảng Kanban (Tổng quan…) vẫn biết dự án đang ở giai đoạn nào.
// Chưa lưu cột nào / lỗi mạng → dùng bộ cột mặc định (đúng như bảng Kanban). Tự tải lại khi cột đổi ở máy khác (sự kiện realtime).
const SECTORS = ['construction', 'furniture', 'mechanical'] as const;
export type ColumnsBySector = Partial<Record<string, KanbanColumn[]>>;

export function useKanbanColumnsBySector(): ColumnsBySector {
  const [bySector, setBySector] = useState<ColumnsBySector>({});
  useEffect(() => {
    let active = true;
    const load = () => {
      SECTORS.forEach(sector => {
        // try/catch đồng bộ: dbService chưa sẵn sàng (môi trường thử, chưa cấu hình) thì dùng cột mặc định, không làm sập màn hình
        let req: Promise<{ columns: any[] } | null | undefined>;
        try { req = Promise.resolve(dbService.kanbanColumns.get(sector)); } catch { req = Promise.reject(new Error('no db')); }
        req
          .then(data => {
            if (!active) return;
            const cols = data?.columns?.length ? ensureColumnsHaveAutomationDefaults(data.columns) : getDefaultColumns();
            setBySector(prev => ({ ...prev, [sector]: cols }));
          })
          .catch(() => { if (active) setBySector(prev => (prev[sector] ? prev : { ...prev, [sector]: getDefaultColumns() })); });
      });
    };
    load();
    window.addEventListener('hl-kanban-columns-updated', load);
    return () => { active = false; window.removeEventListener('hl-kanban-columns-updated', load); };
  }, []);
  return bySector;
}
