// BÁO "CÓ BẢN MỚI": cửa sổ / ứng dụng cài trên điện thoại mở lâu không tự lấy bản mới → vẫn chạy bản cũ (thiếu sửa lỗi, gửi tin kiểu cũ…).
// Mỗi lần build ghi file /version.json (mã commit); ứng dụng định kỳ hỏi file này, khác mã đang chạy thì hiện thanh "Cập nhật".
import { useCallback, useEffect, useState } from 'react';

/** Mã bản đang chạy (vite.config.ts bơm lúc build; 'dev' khi chạy máy phát triển) */
export const CURRENT_BUILD: string = (import.meta as any).env?.VITE_BUILD_COMMIT || 'dev';
export const UPDATE_CHECK_MS = 5 * 60 * 1000;   // hỏi mỗi 5 phút (và khi quay lại cửa sổ)

/** Có bản mới không: cả hai mã đều có, đang chạy không phải 'dev', và khác nhau */
export const isUpdateAvailable = (current: string, latest: string | null | undefined): boolean =>
  !!latest && !!current && current !== 'dev' && latest !== current;

/** Lấy mã bản mới nhất từ máy chủ; lỗi mạng / file chưa có → null (không báo gì) */
export async function fetchLatestBuild(fetchFn: typeof fetch = fetch): Promise<string | null> {
  try {
    const r = await fetchFn(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j?.commit === 'string' && j.commit ? j.commit : null;
  } catch { return null; }
}

/** Theo dõi bản mới: kiểm tra lúc mở, mỗi 5 phút và khi quay lại cửa sổ. Đã báo "có bản mới" thì giữ nguyên cho tới khi tải lại. */
export function useAppUpdate(current: string = CURRENT_BUILD, fetchFn: typeof fetch = fetch): { updateAvailable: boolean; reload: () => void } {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  useEffect(() => {
    if (!current || current === 'dev') return;
    let alive = true;
    const check = () => { fetchLatestBuild(fetchFn).then(latest => { if (alive && isUpdateAvailable(current, latest)) setUpdateAvailable(true); }); };
    check();
    const timer = setInterval(check, UPDATE_CHECK_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', onVisible); };
  }, [current, fetchFn]);
  // Tải lại: điều hướng đi qua mạng trước (xem public/sw.js) nên lấy được index.html và các tệp mới
  const reload = useCallback(() => { window.location.reload(); }, []);
  return { updateAvailable, reload };
}
