import { ProjectType } from '../types';

/**
 * Ký hiệu viết tắt lĩnh vực gắn vào projectId khi tạo dự án mới — để projectId
 * TỰ mang thông tin lĩnh vực (không cần join bảng projects mới biết dự án
 * thuộc Xây Dựng/Nội Thất/Cơ Khí). Đây là nền tảng cho việc phân quyền theo
 * lĩnh vực cho task sau này: mọi task chỉ cần nhìn vào projectId là suy ra
 * ngay được lĩnh vực, không phải tra cứu thêm.
 *
 * 'general' không có ký hiệu riêng (dự án không thuộc lĩnh vực cụ thể).
 */
const SECTOR_ABBR: Record<ProjectType, string | null> = {
  construction: 'XD',
  furniture: 'NT',
  mechanical: 'CK',
  general: null,
};

/**
 * Sinh id cho dự án MỚI, có gắn ký hiệu lĩnh vực để tránh trùng id giữa các
 * lĩnh vực khác nhau (vd: 2 dự án ở 2 lĩnh vực được tạo cùng mili-giây).
 *
 * CHỈ dùng cho dự án tạo mới — KHÔNG áp dụng ngược cho id dự án cũ đã tồn tại
 * (id cũ đang được hàng loạt bảng khác tham chiếu qua projectId, đổi lại sẽ
 * gãy liên kết dữ liệu).
 */
export function generateProjectId(type: ProjectType): string {
  const abbr = SECTOR_ABBR[type];
  return abbr ? `proj_${abbr}_${Date.now()}` : `proj_${Date.now()}`;
}

/**
 * Suy ra lĩnh vực từ projectId theo ký hiệu đã gắn lúc tạo (proj_XD_/proj_NT_/proj_CK_).
 * Trả về null với id dự án theo format cũ (trước khi có ký hiệu) hoặc dự án
 * 'general' — những trường hợp này vẫn phải tra cứu qua project.type như cũ.
 */
export function getProjectSectorFromId(projectId: string | undefined | null): ProjectType | null {
  if (!projectId) return null;
  if (projectId.startsWith('proj_XD_')) return 'construction';
  if (projectId.startsWith('proj_NT_')) return 'furniture';
  if (projectId.startsWith('proj_CK_')) return 'mechanical';
  return null;
}
