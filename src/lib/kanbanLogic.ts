import { Project } from '../types';

/**
 * Pure, framework-free logic for the Project Kanban board.
 * Extracted from ProjectKanbanBoard.tsx so it can be unit-tested in isolation.
 * Behavior must stay identical to the original closure-based implementation.
 */

export interface KanbanColumnAutomation {
  type: 'auto_pm' | 'auto_progress' | 'auto_comment' | 'auto_approval' | 'auto_complete' | 'none';
  param?: string | number;
  assignId?: string;
  statusUpdate?: string;
  approvalRole?: string;
  tagToAdd?: string;
  progressVal?: number;
  subtaskTitle?: string;
  subtaskTitles?: string[];
  subtaskAutomations?: any[];
  dueDateDaysOffset?: number;
  checklistText?: string;
  checklistTexts?: string[];
  involvedId?: string;
  involvedEmployeeIds?: string[];
  descriptionToAdd?: string;
  sendEmailTo?: string;
  textStyleStyleItalic?: boolean;
  textStyleStyleBold?: boolean;
  textStyleStyleStrike?: boolean;
  textStyleStyleColor?: string;
}

export interface KanbanColumn {
  id: string;
  name: string;
  color: string; // Tailwind bg- classes
  iconColor: string; // text class
  automation?: KanbanColumnAutomation;
}

const AVAILABLE_CARD_COLORS = [
  { className: 'bg-sky-500', name: 'Xanh dương' },
  { className: 'bg-cyan-400', name: 'Xanh lơ' },
  { className: 'bg-teal-500', name: 'Xanh ngọc' },
  { className: 'bg-emerald-500', name: 'Xanh lá' },
  { className: 'bg-amber-500', name: 'Vàng nghệ' },
  { className: 'bg-orange-500', name: 'Cam đất' },
  { className: 'bg-rose-500', name: 'Đỏ hồng' },
  { className: 'bg-pink-500', name: 'Hồng phấn' },
  { className: 'bg-violet-500', name: 'Tím hoa súng' },
  { className: 'bg-indigo-500', name: 'Xanh chàm' }
];

export { AVAILABLE_CARD_COLORS };

/** Initial column configuration for a fresh sector (no saved custom columns). */
export const getDefaultColumns = (): KanbanColumn[] => {
  return [
    { id: 'col_design', name: 'YÊU CẦU THIẾT KẾ', color: 'bg-indigo-650', iconColor: 'text-indigo-400', automation: { type: 'auto_progress', param: 10 } },
    { id: 'col_bid', name: 'ĐẤU THẦU', color: 'bg-sky-600', iconColor: 'text-sky-450', automation: { type: 'auto_pm', param: 'emp_3' } },
    { id: 'col_waiting', name: 'CHỜ KẾT QUẢ', color: 'bg-blue-700', iconColor: 'text-blue-450', automation: { type: 'none' } },
    { id: 'col_active', name: 'GIỚI ĐOẠN THI CÔNG', color: 'bg-amber-500', iconColor: 'text-amber-400', automation: { type: 'auto_progress', param: 40 } },
    { id: 'col_accept', name: 'NGHIỆM THU', color: 'bg-emerald-600', iconColor: 'text-emerald-450', automation: { type: 'auto_approval', param: 'director' } },
    { id: 'col_fix', name: 'XỬ LÝ - KHẮC PHỤC', color: 'bg-purple-600', iconColor: 'text-purple-400', automation: { type: 'auto_progress', param: 90 } },
    { id: 'col_done', name: 'HOÀN THÀNH', color: 'bg-pink-600', iconColor: 'text-pink-400', automation: { type: 'auto_complete' } },
  ];
};

/** Build short uppercase initials from a Vietnamese name. */
export const getAbbrev = (nameStr: string): string => {
  if (!nameStr) return '';
  const norm = nameStr
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
  const words = norm.trim().split(/\s+/).filter(Boolean);
  return words.map(w => w[0].toUpperCase()).join('');
};

export interface ColumnStyleDetails {
  borderTop: string;
  text: string;
  bg: string;
  borderCol: string;
  badge: string;
}

/** Map a column color class to its derived border/text/badge style classes (light mode). */
export const getColumnStyleDetails = (colorClass: string): ColumnStyleDetails => {
  const c = colorClass || 'bg-slate-500';

  if (c.includes('teal')) {
    return {
      borderTop: 'border-t-teal-500',
      text: 'text-teal-700',
      bg: 'bg-teal-50/30',
      borderCol: 'border-teal-200/80 hover:border-teal-300',
      badge: 'bg-teal-50 text-teal-800 border border-teal-100 text-[10px]'
    };
  }
  if (c.includes('emerald') || c.includes('green')) {
    return {
      borderTop: 'border-t-emerald-500',
      text: 'text-emerald-700',
      bg: 'bg-emerald-50/30',
      borderCol: 'border-emerald-200/80 hover:border-emerald-300',
      badge: 'bg-emerald-50 text-emerald-800 border border-emerald-100 text-[10px]'
    };
  }
  if (c.includes('amber') || c.includes('orange') || c.includes('yellow')) {
    return {
      borderTop: 'border-t-amber-500',
      text: 'text-amber-700',
      bg: 'bg-amber-50/30',
      borderCol: 'border-amber-200/80 hover:border-amber-300',
      badge: 'bg-amber-50 text-amber-800 border border-amber-100 text-[10px]'
    };
  }
  if (c.includes('rose') || c.includes('red')) {
    return {
      borderTop: 'border-t-rose-500',
      text: 'text-rose-700',
      bg: 'bg-rose-50/30',
      borderCol: 'border-rose-200/80 hover:border-rose-300',
      badge: 'bg-rose-50 text-rose-800 border border-rose-100 text-[10px]'
    };
  }
  if (c.includes('pink')) {
    return {
      borderTop: 'border-t-pink-500',
      text: 'text-pink-700',
      bg: 'bg-pink-50/30',
      borderCol: 'border-pink-200/80 hover:border-pink-300',
      badge: 'bg-pink-50 text-pink-800 border border-pink-100 text-[10px]'
    };
  }
  if (c.includes('sky')) {
    return {
      borderTop: 'border-t-sky-500',
      text: 'text-sky-700',
      bg: 'bg-sky-50/30',
      borderCol: 'border-sky-200/80 hover:border-sky-300',
      badge: 'bg-sky-50 text-sky-800 border border-sky-100 text-[10px]'
    };
  }
  if (c.includes('blue')) {
    return {
      borderTop: 'border-t-blue-500',
      text: 'text-blue-700',
      bg: 'bg-blue-50/30',
      borderCol: 'border-blue-200/80 hover:border-blue-300',
      badge: 'bg-blue-50 text-blue-800 border border-blue-100 text-[10px]'
    };
  }
  if (c.includes('indigo') || c.includes('violet') || c.includes('purple')) {
    return {
      borderTop: 'border-t-indigo-500',
      text: 'text-indigo-700',
      bg: 'bg-indigo-50/30',
      borderCol: 'border-indigo-200/80 hover:border-indigo-300',
      badge: 'bg-indigo-50 text-indigo-800 border border-indigo-100 text-[10px]'
    };
  }
  return {
    borderTop: 'border-t-slate-500',
    text: 'text-slate-700',
    bg: 'bg-slate-50/30',
    borderCol: 'border-slate-200/80 hover:border-slate-300',
    badge: 'bg-slate-50 text-slate-800 border border-slate-100 text-[10px]'
  };
};

/**
 * Resolve which column a project belongs to.
 * Prefers the project's stored kanbanColumnId (only if it still exists in `columns`),
 * otherwise falls back to a status/progress heuristic.
 */
export const getProjectColumnId = (project: Project, columns: KanbanColumn[]): string => {
  const kanbanColumnId = (project as any).kanbanColumnId as string | undefined;
  if (kanbanColumnId) {
    if (columns.some(c => c.id === kanbanColumnId)) {
      return kanbanColumnId;
    }
  }
  if (project.status === 'completed') return 'col_done';
  if (project.status === 'new') return 'col_design';
  if (project.progress >= 90) return 'col_fix';
  if (project.progress >= 70) return 'col_accept';
  if (project.progress > 0) return 'col_active';
  return 'col_design';
};

// ─── Column reducers (pure, return new arrays) ──────────────────────────────

/** Append a new custom column. Returns the new column object + updated list. */
export const addColumnReducer = (
  columns: KanbanColumn[],
  newId: string = `col_custom_${typeof Date !== 'undefined' ? Date.now() : Math.floor(Math.random() * 1e9)}`
): { column: KanbanColumn; columns: KanbanColumn[] } => {
  const newCol: KanbanColumn = {
    id: newId,
    name: 'BƯỚC CẢI TIẾN MỚI',
    color: 'bg-slate-700',
    iconColor: 'text-slate-400',
    automation: { type: 'none' }
  };
  return { column: newCol, columns: [...columns, newCol] };
};

/** Remove a column. Returns updated list + the id of the first remaining column (for migration). */
export const deleteColumnReducer = (
  columns: KanbanColumn[],
  id: string
): { columns: KanbanColumn[]; firstColId: string | null } => {
  const remaining = columns.filter(c => c.id !== id);
  return { columns: remaining, firstColId: remaining.length > 0 ? remaining[0].id : null };
};

/** Patch a single column's top-level fields. */
export const updateColumnReducer = (
  columns: KanbanColumn[],
  colId: string,
  updates: Partial<KanbanColumn>
): KanbanColumn[] => {
  return columns.map(c => (c.id === colId ? { ...c, ...updates } : c));
};

/** Patch a column's automation object (deletes keys whose value is undefined). */
export const updateColumnAutomationReducer = (
  columns: KanbanColumn[],
  colId: string,
  updates: Partial<NonNullable<KanbanColumn['automation']>>
): KanbanColumn[] => {
  return columns.map(c => {
    if (c.id !== colId) return c;
    const curAuto = { ...(c.automation || { type: 'none' }) } as any;
    Object.entries(updates).forEach(([k, val]) => {
      if (val === undefined) {
        delete curAuto[k];
      } else {
        curAuto[k] = val;
      }
    });
    return { ...c, automation: curAuto };
  });
};
