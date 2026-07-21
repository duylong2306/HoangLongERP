/**
 * Migration runner for Hoàng Long ERP
 * Replaces inline useEffect migrations in App.tsx
 */
import { Employee } from '../types';
import { INITIAL_EMPLOYEES, HRM_26_EMPLOYEES } from '../data';
import { generateUsername } from '../context/SettingsContext';
import { dbService } from './dbService';
import { hashPasswordSync } from './passwordUtils';

/** Run all pending migrations. Returns the current version after running. */
export async function runMigrations(getVersion: () => number, setVersion: (v: number) => void): Promise<void> {
  const currentVersion = getVersion();

  if (currentVersion < 5) {
    console.log('[Migration] Running v5: account reset');
    const resetEmps = INITIAL_EMPLOYEES.map(emp => ({
      ...emp,
      username: emp.username || generateUsername(emp.name),
      password: hashPasswordSync('123')
    }));
    await Promise.allSettled(
      resetEmps.map(emp => dbService.employees.save(emp))
    );
    setVersion(5);
  }

  if (currentVersion < 6) {
    console.log('[Migration] Running v6: merge HRM 26 employees');
    const existing: Employee[] = INITIAL_EMPLOYEES;
    const merged = [...existing];
    HRM_26_EMPLOYEES.forEach(newEmp => {
      if (!merged.some(e => e.id === newEmp.id || e.username === newEmp.username)) {
        merged.push(newEmp);
      }
    });
    await Promise.allSettled(
      merged.map(emp => dbService.employees.save(emp))
    );
    setVersion(6);
  }

  // Future migrations go here:
  // if (currentVersion < 7) { ... setVersion(7); }

  console.log(`[Migration] Current version: ${getVersion()}`);
}
