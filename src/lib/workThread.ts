// LUỒNG THẢO LUẬN CỦA MỘT MỤC "VIỆC CỦA TÔI" (công việc / nhiệm vụ / đề xuất chờ duyệt) trong Tin nhắn.
// Mỗi mục có 1 hội thoại riêng, mã xác định từ khóa của mục → ai mở cũng vào đúng 1 luồng, không tạo trùng.
// Các luồng này KHÔNG hiện trong danh sách Tin nhắn thường và KHÔNG tính vào huy hiệu Tin nhắn — chỉ hiện trong tab "Việc của tôi".
export const WORK_CONV_PREFIX = 'conv_work_';

export const isWorkThreadId = (id?: string) => String(id || '').startsWith(WORK_CONV_PREFIX);

/** Mã hội thoại từ khóa mục (vd "task:abc" → "conv_work_task_abc"). Chỉ giữ ký tự an toàn cho khóa chính. */
export const workThreadId = (key: string) => WORK_CONV_PREFIX + String(key).replace(/[^A-Za-z0-9_-]/g, '_');

/** Danh sách thành viên luồng: bỏ trống/trùng. */
export const uniqueMembers = (ids: (string | undefined | null)[]) => Array.from(new Set(ids.filter((x): x is string => !!x)));
