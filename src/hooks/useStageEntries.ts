import { useEffect, useState } from 'react';
import { loadStageEntries } from '../lib/projectEvents';

// Ngày vào giai đoạn hiện tại của các dự án (từ nhật ký dự án) — tải 1 lần khi màn hình mở.
export function useStageEntries(): Map<string, string> {
  const [entries, setEntries] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let alive = true;
    loadStageEntries().then(m => { if (alive) setEntries(m); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return entries;
}
