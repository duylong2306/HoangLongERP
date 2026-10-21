// MÔ HÌNH MENU dùng chung cho thanh menu trái (máy tính) và thanh dưới + trang Danh mục (điện thoại).
// App.tsx dựng mô hình này MỘT lần theo quyền truy cập, 2 giao diện chỉ việc hiển thị — không lặp lại quy tắc phân quyền.
import type { ReactNode } from 'react';

/** Mục con (vd "Xây dựng" trong Phòng Dự Án). */
export interface NavLeaf { id: string; label: string; active: boolean; onSelect: () => void }
/** Mục cấp 1 đứng riêng (Tổng quan, Việc của tôi, Tin nhắn). */
export interface NavTop extends NavLeaf { icon: ReactNode; badge?: number }
/** Nhóm (phòng ban) gồm nhiều mục con. */
export interface NavGroup { id: string; label: string; icon: ReactNode; active: boolean; children: NavLeaf[] }
/** Thông tin người đăng nhập + hành động trong menu tài khoản. */
export interface NavUser {
  name: string; avatar?: string; subtitle?: string;
  onProfile: () => void; onDisplaySettings?: () => void; onReload: () => void; onLogout: () => void;
}

/** Chữ cái đầu hiển thị khi không có ảnh đại diện. */
export const initialOf = (name: string) => (name || '?').trim().charAt(0).toUpperCase();
