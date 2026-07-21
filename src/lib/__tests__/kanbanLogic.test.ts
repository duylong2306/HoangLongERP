/// <reference types="vitest" />
import { KanbanColumn } from '../kanbanLogic';
import {
  getDefaultColumns,
  getColumnStyleDetails,
  getProjectColumnId,
  getAbbrev,
  addColumnReducer,
  deleteColumnReducer,
  updateColumnReducer,
  updateColumnAutomationReducer,
  AVAILABLE_CARD_COLORS,
} from '../kanbanLogic';

// Mock Project interface for tests
interface MockProject {
  id: string;
  code: string;
  name: string;
  customerId: string;
  address: string;
  type: string;
  contractValue: number;
  startDate: string;
  endDate: string;
  pmId: string;
  status: string;
  progress: number;
  notes?: string;
  image?: string;
  documents?: any[];
  involvedEmployeeIds?: string[];
  kanbanColumnId?: string;
  styleItalic?: boolean;
  styleBold?: boolean;
  styleStrike?: boolean;
  styleColor?: string;
  cardColor?: string;
}

describe('Kanban Logic Module', () => {
  describe('getDefaultColumns', () => {
    it('should return 7 default columns', () => {
      const columns = getDefaultColumns();
      expect(columns).toHaveLength(7);
    });

    it('should have correct column IDs', () => {
      const columns = getDefaultColumns();
      const ids = columns.map(c => c.id);
      expect(ids).toContain('col_design');
      expect(ids).toContain('col_bid');
      expect(ids).toContain('col_waiting');
      expect(ids).toContain('col_active');
      expect(ids).toContain('col_accept');
      expect(ids).toContain('col_fix');
      expect(ids).toContain('col_done');
    });

    it('should have non-empty names and colors', () => {
      const columns = getDefaultColumns();
      columns.forEach(col => {
        expect(col.name).toBeTruthy();
        expect(col.color).toBeTruthy();
        expect(col.iconColor).toBeTruthy();
      });
    });

    it('should have automation types for some columns', () => {
      const columns = getDefaultColumns();
      expect(columns[0].automation?.type).toBe('auto_progress');
      expect(columns[1].automation?.type).toBe('auto_pm');
      expect(columns[4].automation?.type).toBe('auto_approval');
      expect(columns[6].automation?.type).toBe('auto_complete');
      expect(columns[2].automation?.type).toBe('none');
    });
  });

  describe('getColumnStyleDetails', () => {
    it('should return style object for each color category', () => {
      const tests = [
        { color: 'bg-teal-500', expected: 'border-t-teal-500' },
        { color: 'bg-emerald-500', expected: 'border-t-emerald-500' },
        { color: 'bg-amber-500', expected: 'border-t-amber-500' },
        { color: 'bg-rose-500', expected: 'border-t-rose-500' },
        { color: 'bg-pink-500', expected: 'border-t-pink-500' },
        { color: 'bg-sky-500', expected: 'border-t-sky-500' },
        { color: 'bg-blue-500', expected: 'border-t-blue-500' },
        { color: 'bg-indigo-500', expected: 'border-t-indigo-500' },
      ];

      tests.forEach(({ color, expected }) => {
        const result = getColumnStyleDetails(color);
        expect(result.borderTop).toBe(expected);
      });
    });

    it('should return default slate style for unknown color', () => {
      const result = getColumnStyleDetails('bg-unknown-999');
      expect(result.borderTop).toBe('border-t-slate-500');
    });
  });

  describe('getAbbrev', () => {
    it('should handle Vietnamese names with accents', () => {
      expect(getAbbrev('Trần Hữu Long')).toBe('THL');
      expect(getAbbrev('Lê Thị Mai')).toBe('LTM');
      expect(getAbbrev('Nguyễn Văn A')).toBe('NVA');
    });

    it('should extract initials from names with single chars', () => {
      expect(getAbbrev('Trương Hữu')).toBe('TH');
      expect(getAbbrev('Võ Chí')).toBe('VC');
      expect(getAbbrev('Lê')).toBe('L');
    });

    it('should handle names without accents', () => {
      expect(getAbbrev('Nguyen Van A')).toBe('NVA');
      expect(getAbbrev('John Doe')).toBe('JD');
      expect(getAbbrev('Ngô Đình')).toBe('ND');
    });

    it('should return empty string for empty input', () => {
      expect(getAbbrev('')).toBe('');
      expect(getAbbrev('   ')).toBe('');
    });
  });

  describe('getProjectColumnId', () => {
    const colors = ['col_design', 'col_bid', 'col_waiting', 'col_active', 'col_accept', 'col_fix', 'col_done'];

    it('should return kanbanColumnId if valid', () => {
      const project: MockProject = {
        id: 'proj1',
        code: 'PRJ001',
        name: 'Test Project',
        customerId: 'cust1',
        address: 'Adress',
        type: 'type',
        contractValue: 0,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        pmId: 'pm1',
        status: 'doing',
        progress: 50,
        kanbanColumnId: colors[0],
      };
      const columnList = colors.map(id => ({ id, name: '', color: '', iconColor: '' }));
      expect(getProjectColumnId(project, columnList)).toBe(colors[0]);
    });

    it('should ignore invalid kanbanColumnId (not in columns)', () => {
      const project: MockProject = {
        id: 'proj2',
        code: 'PRJ002',
        name: 'Test Project 2',
        customerId: 'cust2',
        address: 'Adress',
        type: 'type',
        contractValue: 0,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        pmId: 'pm2',
        status: 'doing',
        progress: 50,
        kanbanColumnId: 'invalid_col_id',
      };
      const columnList = colors.map(id => ({ id, name: '', color: '', iconColor: '' }));
      expect(getProjectColumnId(project, columnList)).not.toBe('invalid_col_id');
    });

    it('should fallback to status for completed project', () => {
      const project: MockProject = {
        id: 'proj3',
        code: 'PRJ003',
        name: 'Test Project 3',
        customerId: 'cust3',
        address: 'Adress',
        type: 'type',
        contractValue: 0,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        pmId: 'pm3',
        status: 'completed',
        progress: 100,
        kanbanColumnId: undefined,
      };
      const columnList = colors.map(id => ({ id, name: '', color: '', iconColor: '' }));
      expect(getProjectColumnId(project, columnList)).toBe('col_done');
    });

    it('should fallback to status for new project', () => {
      const project: MockProject = {
        id: 'proj4',
        code: 'PRJ004',
        name: 'Test Project 4',
        customerId: 'cust4',
        address: 'Adress',
        type: 'type',
        contractValue: 0,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        pmId: 'pm4',
        status: 'new',
        progress: 0,
        kanbanColumnId: undefined,
      };
      const columnList = colors.map(id => ({ id, name: '', color: '', iconColor: '' }));
      expect(getProjectColumnId(project, columnList)).toBe('col_design');
    });

    it('should fallback to progress for high progress', () => {
      const project1: MockProject = {
        id: 'proj5',
        code: 'PRJ005',
        name: 'Test Project 5',
        customerId: 'cust5',
        address: 'Adress',
        type: 'type',
        contractValue: 0,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        pmId: 'pm5',
        status: 'doing',
        progress: 95,
        kanbanColumnId: undefined,
      };
      const project2: MockProject = {
        id: 'proj6',
        code: 'PRJ006',
        name: 'Test Project 6',
        customerId: 'cust6',
        address: 'Adress',
        type: 'type',
        contractValue: 0,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        pmId: 'pm6',
        status: 'doing',
        progress: 75,
        kanbanColumnId: undefined,
      };
      const project3: MockProject = {
        id: 'proj7',
        code: 'PRJ007',
        name: 'Test Project 7',
        customerId: 'cust7',
        address: 'Adress',
        type: 'type',
        contractValue: 0,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        pmId: 'pm7',
        status: 'doing',
        progress: 25,
        kanbanColumnId: undefined,
      };
      const columnList = colors.map(id => ({ id, name: '', color: '', iconColor: '' }));
      expect(getProjectColumnId(project1, columnList)).toBe('col_fix');
      expect(getProjectColumnId(project2, columnList)).toBe('col_accept');
      expect(getProjectColumnId(project3, columnList)).toBe('col_active');
    });
  });

  describe('addColumnReducer', () => {
    it('should add new column to columns list', () => {
      const existingColumns = [
        { id: 'col1', name: 'Column 1', color: 'bg-slate-500', iconColor: 'text-white' },
        { id: 'col2', name: 'Column 2', color: 'bg-slate-500', iconColor: 'text-white' },
      ];
      const result = addColumnReducer(existingColumns);
      expect(result.columns).toHaveLength(3);
      expect(result.column.id).toMatch(/^col_custom_/);
      expect(result.column.name).toBe('BƯỚC CẢI TIẾN MỚI');
    });

    it('should add column in non-destructive order', () => {
      const columns = [{ id: 'old', name: 'Old', color: '', iconColor: '' }];
      const result = addColumnReducer(columns);
      expect(result.columns[0].id).toBe('old');
      expect(result.columns[1].id).toMatch(/^col_custom_/);
    });
  });

  describe('deleteColumnReducer', () => {
    it('should remove column from list', () => {
      const columns = [
        { id: 'col1', name: 'Column 1', color: '', iconColor: '' },
        { id: 'col2', name: 'Column 2', color: '', iconColor: '' },
        { id: 'col3', name: 'Column 3', color: '', iconColor: '' },
      ];
      const result = deleteColumnReducer(columns, 'col2');
      expect(result.columns).toHaveLength(2);
      expect(result.columns.map(c => c.id)).toEqual(['col1', 'col3']);
      expect(result.firstColId).toBe('col1');
    });

    it('should return null firstColId if no columns left', () => {
      const columns = [{ id: 'col1', name: 'Column 1', color: '', iconColor: '' }];
      const result = deleteColumnReducer(columns, 'col1');
      expect(result.columns).toHaveLength(0);
      expect(result.firstColId).toBeNull();
    });
  });

  describe('updateColumnReducer', () => {
    it('should update matching column', () => {
      const columns = [
        { id: 'col1', name: 'Column 1', color: 'bg-red-500', iconColor: 'text-white' },
        { id: 'col2', name: 'Column 2', color: 'bg-blue-500', iconColor: 'text-white' },
      ];
      const result = updateColumnReducer(columns, 'col1', { name: 'Column 1 Updated', color: 'bg-green-500' });
      expect(result[0].name).toBe('Column 1 Updated');
      expect(result[0].color).toBe('bg-green-500');
      expect(result[1].name).toBe('Column 2'); // unchanged
    });

    it('should not modify other columns', () => {
      const columns = [
        { id: 'col1', name: 'Column 1', color: 'bg-red-500', iconColor: 'text-white' },
        { id: 'col2', name: 'Column 2', color: 'bg-blue-500', iconColor: 'text-white' },
      ];
      const result = updateColumnReducer(columns, 'col1', { name: 'Updated' });
      expect(result[1].name).toBe('Column 2');
      expect(result[1].color).toBe('bg-blue-500');
    });
  });

  describe('updateColumnAutomationReducer', () => {
    it('should update automation properties', () => {
      const columns = [
        {
          id: 'col1',
          name: 'Column 1',
          color: 'bg-slate-500',
          iconColor: 'text-white',
          automation: { type: 'none' },
        },
      ];
      const updates = { type: 'auto_progress' as const, param: 50 };
      const result = updateColumnAutomationReducer(columns, 'col1', updates);
      expect(result[0].automation?.type).toBe('auto_progress');
      expect(result[0].automation?.param).toBe(50);
    });

    it('should remove automation keys when undefined', () => {
      const columns = [
        {
          id: 'col1',
          name: 'Column 1',
          color: 'bg-slate-500',
          iconColor: 'text-white',
          automation: { type: 'auto_progress', param: 50 },
        },
      ];
      const updates = { param: undefined };
      const result = updateColumnAutomationReducer(columns, 'col1', updates);
      expect(result[0].automation?.param).toBeUndefined();
    });
  });
});