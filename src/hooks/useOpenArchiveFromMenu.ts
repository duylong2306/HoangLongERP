import { useEffect, useRef } from 'react';
import { dbService } from '../lib/dbService';
import { ArchivedQuote } from '../types';

/**
 * Chọn hồ sơ báo giá MỚI NHẤT (theo ngày tạo) của 1 dự án — dùng chung cho mọi nơi
 * "mở hồ sơ từ Menu Hồ Sơ Dự Án" để cùng chỉ về 1 hồ sơ (trước đây có nơi lấy bản đầu
 * tiên, có nơi lấy bản cuối cùng nên trạng thái hiển thị và hồ sơ được mở bị lệch nhau).
 */
export function pickLatestQuote<T extends { projectId?: string; createdAt?: string }>(list: T[], projectId: string): T | undefined {
  return list
    .filter(q => q.projectId === projectId)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
}

interface Options {
  /** Mã tab của lĩnh vực trong sự kiện hl-switch-tab (vd 'quotes-construction') */
  tabId: string;
  /** Lĩnh vực để tải danh sách hồ sơ ('furniture' | 'construction' | 'mechanical') */
  sector: string;
  /** Mở chi tiết hồ sơ + tab tài liệu; nhận danh sách mới tải để cập nhật lại bảng */
  onOpen: (list: ArchivedQuote[], quote: ArchivedQuote, docType: string) => void;
}

/**
 * Lắng nghe 'hl-switch-tab' do Menu Hồ Sơ Dự Án (Công việc) phát ra và mở đúng hồ sơ.
 *
 * Vì sao cần: các màn Lưu trữ (Cabinet/Construction/MechanicalArchive) nằm trong
 * QuotationSystem được GIỮ MOUNTED (ẩn bằng CSS) sau lần vào đầu tiên, nên cách cũ
 * (tự mở dựa vào props + 1 cờ "đã mở dự án này") chỉ chạy được vài lần rồi bỏ qua, và
 * danh sách hồ sơ chỉ tải 1 lần nên có thể thiếu hồ sơ mới. Ở đây mỗi lần bấm đều tải
 * lại danh sách rồi mở, không phụ thuộc trạng thái cũ.
 * (Lần vào đầu tiên khi component chưa mount vẫn do effect theo props ở từng màn xử lý.)
 */
export function useOpenArchiveFromMenu({ tabId, sector, onOpen }: Options) {
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    const handler = async (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d || typeof d !== 'object') return;
      if (d.tab !== tabId || d.quotesSubTab !== 'archive' || !d.projectId) return;
      try {
        const fresh = await dbService.archivedQuotes.list(sector);
        const q = pickLatestQuote(fresh, d.projectId);
        if (q) onOpenRef.current(fresh, q, d.docType || 'quote');
      } catch (err) {
        console.error('Không mở được hồ sơ từ Menu Hồ Sơ Dự Án:', err);
      }
    };
    window.addEventListener('hl-switch-tab', handler);
    return () => window.removeEventListener('hl-switch-tab', handler);
  }, [tabId, sector]);
}
