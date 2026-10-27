import { RefreshCw } from 'lucide-react';
import { useAppUpdate } from '../lib/appUpdate';

/** Thanh báo "Có bản mới" — chỉ hiện khi máy chủ đã có bản mới hơn bản đang chạy. Người dùng tự bấm để tải lại (không tự tải lại giữa lúc đang gõ). */
export default function UpdateBanner() {
  const { updateAvailable, reload } = useAppUpdate();
  if (!updateAvailable) return null;
  return (
    <div role="status" data-testid="update-banner"
      className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-3 px-3 py-2 text-[13px] font-semibold shadow-md"
      style={{ background: '#0d47c9', color: '#ffffff' }}>
      <RefreshCw className="w-4 h-4 shrink-0" />
      <span>Có bản mới của LoLo. Bấm Cập nhật để dùng bản mới nhất.</span>
      <button type="button" onClick={reload} data-testid="update-reload"
        className="shrink-0 rounded-lg px-3 py-1 text-[12.5px] font-bold cursor-pointer" style={{ background: '#ffffff', color: '#0d47c9' }}>Cập nhật</button>
    </div>
  );
}
