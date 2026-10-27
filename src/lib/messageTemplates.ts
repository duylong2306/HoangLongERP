// MẪU TIN NHẮN HỆ THỐNG — một nơi duy nhất quyết định cách viết, để mọi thông báo ngắn gọn, đủ thông tin và thống nhất.
// Quy tắc:
//  - KHÔNG nhắc tên người gửi trong nội dung (tên đã hiện ở tiêu đề thông báo đẩy và ở bong bóng chat / dòng nhật ký);
//  - dòng đầu = "Biểu tượng + Loại: Đối tượng · Số liệu chính · Dự án" (thấy ngay trên thông báo đẩy); lý do (nếu cần) xuống dòng thứ hai;
//  - tiền "12.000.000đ", ngày "30/10" (khác năm hiện tại thì "30/10/2027"), nhiều ngày "28/10 → 30/10";
//  - biểu tượng cố định theo loại: 📌 giao việc · 🧩 nhiệm vụ · 🔔 cần duyệt · ✅ đã duyệt · ❌ từ chối · 🌴 nghỉ phép · ⏰ nhắc giờ.
// LƯU Ý: dòng đầu của tin 🔔 được dùng để xác định đích mở thẳng khi bấm thông báo (pushDeepLink.pushTargetFromMessage);
// biểu tượng + từ khóa ở các mẫu nhật ký (nhóm D) được projectEvents.classifyEvent dùng để phân loại sự kiện — đổi chữ thì chạy lại test.
import { formatDays } from './leaveNotice';
import { shiftLabel } from './leaveShift';

/** YYYY-MM-DD (hoặc ISO có giờ) → dd/MM; khác năm hiện tại → dd/MM/yyyy. Chuỗi khác dạng đó giữ nguyên. */
export function fmtDay(s?: string | null, now: Date = new Date()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  if (!m) return String(s || '');
  return Number(m[1]) === now.getFullYear() ? `${m[3]}/${m[2]}` : `${m[3]}/${m[2]}/${m[1]}`;
}
export const fmtMoney = (n?: number | string | null): string => `${Number(n || 0).toLocaleString('vi-VN')}đ`;
/** Khoảng ngày: 1 ngày → "28/10"; nhiều ngày → "28/10 → 30/10" */
export const fmtRange = (from?: string, to?: string, now?: Date): string => (!to || to === from ? fmtDay(from, now) : `${fmtDay(from, now)} → ${fmtDay(to, now)}`);

/** Ghép các phần còn giá trị bằng " · " */
const join = (parts: (string | undefined | null | false)[]) => parts.filter(Boolean).join(' · ');
const hanPart = (d?: string) => (d ? `Hạn ${fmtDay(d)}` : '');
const reasonLine = (r?: string) => (r && r.trim() ? `\nLý do: ${r.trim()}` : '');

// ───────────── A. GIAO VIỆC (tin riêng cho người nhận) ─────────────
export const giaoViec = (p: { task: string; assignee?: string; deadline?: string; project?: string }) => `📌 Giao việc: ${join([p.task, p.assignee && `giao ${p.assignee}`, hanPart(p.deadline), p.project])}`;
export const giaoViecCon = (p: { task: string; deadline?: string; project?: string }) => `📌 Giao việc con: ${join([p.task, hanPart(p.deadline), p.project])}`;
export const giaoViecTuDong = (p: { task: string; deadline?: string; project?: string }) => `📌 Giao việc tự động: ${join([p.task, hanPart(p.deadline), p.project])}`;
export const themNhiemVu = (p: { mission: string; task: string }) => `🧩 Thêm nhiệm vụ: ${p.mission} · trong công việc ${p.task}`;
export const giaoNhiemVuTuDong = (p: { mission: string; task: string; deadline?: string }) => `🧩 Giao nhiệm vụ tự động: ${join([p.mission, `công việc ${p.task}`, hanPart(p.deadline)])}`;

// ───────────── B. CẦN DUYỆT (tin riêng cho người duyệt) — luôn mở đầu 🔔 ─────────────
export const canDuyetHoanThanh = (p: { task: string; project?: string }) => `🔔 Cần duyệt hoàn thành: ${join([`Công việc ${p.task}`, p.project])}`;
export const canDuyetTamUngThauPhu = (p: { code: string; amount: number; subcontractor?: string; task?: string; reason?: string }) =>
  `🔔 Cần duyệt tạm ứng ${p.code}: ${join([fmtMoney(p.amount), p.subcontractor && `Thầu phụ ${p.subcontractor}`, p.task && `Công việc ${p.task}`])}${reasonLine(p.reason)}`;
export const canDuyetDeXuatChi = (p: { loai: string; code: string; amount: number; project?: string; reason?: string }) =>
  `🔔 Cần duyệt ${p.loai} ${p.code}: ${join([fmtMoney(p.amount), p.project])}${reasonLine(p.reason)}`;
export const canDuyetNghiPhep = (p: { type: string; shift?: string; fromDate: string; toDate: string; daysCount?: number; reason?: string }) => {
  const ca = shiftLabel(p.shift);
  const same = p.fromDate === p.toDate;
  const extra = ca || (!same && p.daysCount ? `${formatDays(p.daysCount)} ngày` : '');
  return `🔔 Cần duyệt nghỉ phép: ${p.type} · ${fmtRange(p.fromDate, p.toDate)}${extra ? ` (${extra})` : ''}${reasonLine(p.reason)}`;
};
export const canDuyetChamCong = (p: { type: string; wholeDay: boolean; shift?: string; date: string; reason?: string }) =>
  `🔔 Cần duyệt báo cáo chấm công: ${p.type} · ${fmtDay(p.date)} (${p.wholeDay ? 'cả ngày' : (p.shift || '')})${reasonLine(p.reason)}`;
export const canDuyetTamUngLuong = (p: { code: string; amount: number; reason?: string }) => `🔔 Cần duyệt tạm ứng lương ${p.code}: ${fmtMoney(p.amount)}${reasonLine(p.reason)}`;
export const canDuyetCongTacPhi = (p: { content: string; amount: number; employee?: string; mission?: string }) =>
  `🔔 Cần duyệt công tác phí: ${join([p.content, fmtMoney(p.amount), p.employee, p.mission && `nhiệm vụ ${p.mission}`])}`;
export const canDuyetLienThong = (p: { step: string; approver: string }) => `🔔 Cần duyệt liên thông: ${p.step} · Người duyệt: ${p.approver}`;

// ───────────── C. KẾT QUẢ DUYỆT (gửi người lập) ─────────────
const kq = (ok: boolean) => (ok ? '✅ Đã duyệt' : '❌ Từ chối');
export const ketQuaNghiPhep = (ok: boolean, p: { type: string; fromDate: string; toDate: string }) => `${kq(ok)} nghỉ phép: ${p.type} · ${fmtRange(p.fromDate, p.toDate)}`;
export const ketQuaPhieuChi = (ok: boolean, p: { code: string; amount: number; recipient?: string }) => `${kq(ok)} phiếu chi ${p.code}: ${join([fmtMoney(p.amount), p.recipient])}`;
export const ketQuaTamUng = (ok: boolean, p: { code: string; amount: number; task?: string }) =>
  `${kq(ok)} tạm ứng ${p.code}: ${join([fmtMoney(p.amount), p.task, ok && 'Chờ lập phiếu'])}`;
export const ketQuaCongTacPhi = (ok: boolean, p: { content: string; amount: number; mission?: string }) =>
  `${kq(ok)} công tác phí: ${join([p.content, fmtMoney(p.amount), p.mission && `nhiệm vụ ${p.mission}`])}`;
export const ketQuaHoanThanh = (ok: boolean, task: string) => `${kq(ok)} hoàn thành: Công việc ${task}`;

// ───────────── D. NHẬT KÝ / NHÓM DỰ ÁN (không có tên người — giao diện in sẵn tên người làm) ─────────────
// Mở đầu bằng biểu tượng + động từ/từ khóa để classifyEvent phân loại đúng (xem projectEvents.ts).
/** "BG-1: 120.000.000đ · Khách" — bỏ phần thiếu và bỏ luôn dấu hai chấm nếu không còn gì sau mã */
const bgTail = (p: { code: string; total?: number; customer?: string }) => { const rest = join([p.total ? fmtMoney(p.total) : '', p.customer]); return rest ? `${p.code}: ${rest}` : p.code; };

export const nk = {
  doiTruongDuAn: (p: { project: string; to: string }) => `👤 Chuyển Trưởng dự án ${p.project} sang ${p.to}`,
  doiTruongDuAnTuDong: (p: { project: string; to: string }) => `👤 Chuyển Trưởng dự án ${p.project} sang ${p.to} (tự động theo quy trình)`,
  taoCongViecTuDong: (p: { task: string; assignee?: string; deadline?: string }) => `📝 Tạo công việc tự động: ${join([p.task, p.assignee && `giao ${p.assignee}`, hanPart(p.deadline)])}`,
  giaoViecCon: (p: { task: string; project?: string }) => `📝 Tạo công việc con: ${join([p.task, p.project])}`,
  suaViecCon: (task: string) => `✏️ Cập nhật công việc con: ${task}`,
  nhanViec: (task: string) => `🙋 Nhận việc: ${task}`,
  hoanThanhViec: (task: string) => `🎉 Hoàn thành công việc: ${task}`,
  guiDuyetHoanThanh: (p: { task: string; approver: string }) => `🔔 Gửi duyệt hoàn thành: ${p.task} · Người duyệt: ${p.approver}`,
  duyetHoanThanh: (ok: boolean, task: string) => `${ok ? '✅ Duyệt hoàn thành' : '❌ Từ chối hoàn thành'}: ${task}`,
  doiPhuTrachViec: (p: { task: string; to: string }) => `👤 Chuyển phụ trách công việc ${p.task} sang ${p.to}`,
  doiThauPhu: (task: string) => `🔄 Đổi thầu phụ công việc ${task}`,
  vipham: (p: { names: string; task: string }) => `⚠️ Ghi nhận vi phạm: ${p.names} · công việc ${p.task}`,
  taoNhiemVu: (p: { mission: string; task: string }) => `📝 Tạo nhiệm vụ: ${p.mission} (công việc ${p.task})`,
  suaNhiemVu: (p: { from: string; to: string; deadline?: string }) => `✏️ Sửa nhiệm vụ: ${p.from} → ${p.to}${p.deadline ? ` · ${hanPart(p.deadline)}` : ''}`,
  gan: (p: { who: string; mission: string }) => `👤 Phụ trách nhiệm vụ ${p.mission}: ${p.who}`,
  boGan: (mission: string) => `🔓 Bỏ phụ trách nhiệm vụ ${mission}`,
  themNguoi: (p: { who: string; mission: string }) => `➕ Thêm ${p.who} vào nhiệm vụ ${p.mission}`,
  botNguoi: (p: { who: string; mission: string }) => `➖ Bớt ${p.who} khỏi nhiệm vụ ${p.mission}`,
  tichMuc: (p: { done: boolean; item: string; mission: string }) => `🔄 ${p.done ? 'Hoàn thành' : 'Bỏ tích'} đầu mục "${p.item}" · nhiệm vụ ${p.mission}`,
  hoanThanhNhiemVu: (p: { mission: string; report?: string; files?: number }) =>
    `✅ Hoàn thành nhiệm vụ: ${p.mission}${p.report ? `\nBáo cáo: ${p.report}` : ''}${p.files ? `\n${p.files} tệp đính kèm` : ''}`,
  xoaCongTacPhi: (p: { content: string; mission: string }) => `🗑️ Xóa công tác phí: ${p.content} · nhiệm vụ ${p.mission}`,
  nhapExcel: (p: { count: number; task: string }) => `📝 Nhập ${p.count} nhiệm vụ từ Excel · công việc ${p.task}`,
  dongBoNhanSu: (n: number) => `👥 Đồng bộ nhân sự dự án: ${n} người`,
  kyDuyetHoSo: (p: { loai: string; code: string }) => `✅ Ký duyệt ${p.loai} ${p.code}`,
  // Báo giá / phiếu thu / đơn mua gắn với dự án
  baoGiaTao: (p: { code: string; total?: number; customer?: string }) => `📝 Lập báo giá ${bgTail(p)}`,
  baoGiaTrangThai: (status: 'draft' | 'sent' | 'approved' | 'rejected', p: { code: string; total?: number; customer?: string }) => {
    const tail = bgTail(p);
    return status === 'sent' ? `📤 Gửi báo giá ${tail}` : status === 'approved' ? `✅ Khách duyệt báo giá ${tail}` : status === 'rejected' ? `❌ Khách từ chối báo giá ${tail}` : `🔄 Chuyển báo giá ${tail} về bản nháp`;
  },
  phieuThuTao: (p: { code: string; amount: number; method?: string; customer?: string }) => `💰 Thu tiền ${p.code}: ${join([fmtMoney(p.amount), p.method, p.customer])}`,
  phieuThuSua: (p: { code: string; amount: number }) => `✏️ Sửa phiếu thu ${p.code}: ${fmtMoney(p.amount)}`,
  phieuThuXoa: (p: { code: string; amount: number }) => `🗑️ Xóa phiếu thu ${p.code}: ${fmtMoney(p.amount)}`,
  donMuaTao: (p: { id: string; total: number; supplier?: string }) => `🛒 Tạo đơn mua ${p.id}: ${join([fmtMoney(p.total), p.supplier])}`,
  donMuaXoa: (p: { id: string; total: number; supplier?: string }) => `🗑️ Xóa đơn mua ${p.id}: ${join([fmtMoney(p.total), p.supplier])}`,
  deXuatVatTu: (p: { code: string; project: string; congViec?: string; lines: string[]; note?: string }) =>
    `📦 Đề xuất vật tư ${p.code} · ${p.project}${p.congViec ? ` · ${p.congViec}` : ''}\n${p.lines.join('\n')}${p.note ? `\n${p.note}` : ''}`,
};

// ───────────── E. NHÓM ĐIỂM DANH ─────────────
export const nhacDiemDanh = (ca: string, gio?: string) => `⏰ Đến giờ ${ca}${gio ? ` (${gio})` : ''}. Mời chấm công.`;
export const baoNghiPhep = (p: { empName: string; type: string; fromDate: string; toDate: string; daysCount?: number; shift?: string; approver: string; now?: Date }) => {
  const ca = shiftLabel(p.shift);
  const same = p.fromDate === p.toDate;
  const extra = ca || (!same && p.daysCount ? `${formatDays(p.daysCount)} ngày` : same ? 'cả ngày' : '');
  return `🌴 ${p.empName} nghỉ ${p.type.replace(/^Nghỉ\s+/i, '').toLowerCase()} · ${same ? `ngày ${fmtDay(p.fromDate, p.now)}` : fmtRange(p.fromDate, p.toDate, p.now)}${extra ? ` (${extra})` : ''} · ${p.approver} duyệt`;
};
