import { useState, useEffect, useCallback, useRef } from 'react';

export interface PersistedStateOptions {
  /** Debounce writes to localStorage (ms). Default: 300 */
  debounceMs?: number;
  /** Custom serializer. Default: JSON.stringify */
  serialize?: (value: any) => string;
  /** Custom deserializer. Default: JSON.parse */
  deserialize?: (value: string) => any;
  /** Validate the parsed value — return a safe fallback if invalid */
  validate?: (parsed: unknown) => boolean;
}

/**
 * Generic hook for persisting state to localStorage with debounced writes.
 *
 * Designed to be a drop-in replacement for:
 *   const [state, setState] = useState<T>(init)
 *   useEffect(() => { localStorage.setItem(key, JSON.stringify(state)) }, [state])
 *
 * Usage:
 *   const [projects, setProjects] = usePersistedState<Project[]>('hl_erp_projects', [])
 */
export function usePersistedState<T>(
  key: string,
  fallback: T,
  options: PersistedStateOptions = {}
): [T, (value: T | ((prev: T) => T)) => void, { loading: boolean; error: Error | null }] {
  const {
    debounceMs = 300,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    validate,
  } = options;

  // Hydrate from localStorage on mount
  const [state, setStateInternal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const parsed = deserialize(raw);
        if (validate && !validate(parsed)) {
          console.warn(`[usePersistedState] Invalid data for "${key}", using fallback`);
          return fallback;
        }
        return parsed;
      }
    } catch (e) {
      console.warn(`[usePersistedState] Error reading "${key}" from localStorage:`, e);
    }
    return fallback;
  });

  const [loading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Debounced ref to avoid writing on every render
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestStateRef = useRef<T>(state);
  latestStateRef.current = state;

  // Debounced write to localStorage
  useEffect(() => {
    if (writeTimerRef.current) {
      clearTimeout(writeTimerRef.current);
    }
    writeTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, serialize(latestStateRef.current));
        setError(null);
      } catch (e) {
        console.error(`[usePersistedState] Error writing "${key}" to localStorage:`, e);
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    }, debounceMs);

    return () => {
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
      }
    };
  }, [state, key, serialize, debounceMs]);

  // Public setter — same API as useState setter
  const setState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStateInternal(prev => {
        const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
        return next;
      });
    },
    []
  );

  return [state, setState, { loading, error }];
}

/**
 * Synchronize local state with a cloud dbService collection.
 * Reads from cloud on mount (if available), writes on change.
 */
export function useSupabaseSync<T extends { id: string }>(
  localData: T[],
  cloudService: {
    list: () => Promise<T[]>;
    save: (item: T) => Promise<void>;
    delete: (id: string) => Promise<void>;
  },
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled !== false;
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!enabled || syncedRef.current) return;
    syncedRef.current = true;

    // Optionally read from cloud on first mount to merge
    // For now this is a no-op — manual sync via UI buttons
  }, [enabled]);

  const syncItem = useCallback(
    async (item: T) => {
      if (!enabled) return;
      try {
        await cloudService.save(item);
      } catch (e) {
        console.warn('[useSupabaseSync] Save failed:', e);
      }
    },
    [cloudService, enabled]
  );

  const syncDelete = useCallback(
    async (id: string) => {
      if (!enabled) return;
      try {
        await cloudService.delete(id);
      } catch (e) {
        console.warn('[useSupabaseSync] Delete failed:', e);
      }
    },
    [cloudService, enabled]
  );

  return { syncItem, syncDelete };
}
