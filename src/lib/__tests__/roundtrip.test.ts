import { describe, it, expect } from 'vitest';
import { keysToSnake, rowToCamel } from '../dbService';

describe('missions travelAllowances round-trip', () => {
  it('preserves travelAllowances through keysToSnake -> rowToCamel', () => {
    const task: any = {
      id: 'task1',
      name: 'CV',
      missions: [
        {
          id: 'm1',
          name: 'Nhiệm vụ',
          memberIds: ['emp1'],
          status: 'todo',
          travelAllowances: [
            { id: 'ta1', memberId: 'emp1', content: 'Đi HN', quantity: 1, unitPrice: 200000, amount: 200000 },
          ],
        },
      ],
    };

    // Simulate saveSupabase: keysToSnake(item) then upsert jsonb
    const saved = keysToSnake(task);
    console.log('SAVED missions[0] keys:', Object.keys(saved.missions[0]));
    console.log('SAVED missions[0].travelAllowances present?', !!saved.missions[0].travelAllowances, Object.keys(saved.missions[0].travelAllowances?.[0] || {}));

    // Simulate load: row = saved (jsonb returns as-is), then rowToCamel
    const loaded = rowToCamel(saved);
    console.log('LOADED missions[0] keys:', Object.keys(loaded.missions[0]));
    console.log('LOADED travelAllowances:', loaded.missions[0].travelAllowances);

    expect(loaded.missions[0].travelAllowances).toBeTruthy();
    expect(loaded.missions[0].travelAllowances.length).toBe(1);
    expect(loaded.missions[0].travelAllowances[0].content).toBe('Đi HN');
  });
});
