// Định dạng hiển thị cho trang quản trị (tiền VNĐ, ngày, trạng thái hạn dùng).
export const formatVnd = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : `${new Intl.NumberFormat('vi-VN').format(Math.round(n))} đ`;

export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
};

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('vi-VN');
};

// ISO → giá trị cho <input type="date"> (YYYY-MM-DD, theo giờ địa phương)
export const toDateInput = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Giá trị <input type="date"> → ISO cuối ngày đó (23:59:59 giờ địa phương): hạn "đến hết ngày".
export const fromDateInputEndOfDay = (v: string): string | null => {
  if (!v) return null;
  const [y, m, d] = v.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59).toISOString();
};

export type SubStatus = 'unlimited' | 'trial' | 'active' | 'expired';
export const STATUS_LABEL: Record<SubStatus, string> = {
  unlimited: 'Không giới hạn', trial: 'Dùng thử', active: 'Đang dùng', expired: 'Hết hạn',
};
export const STATUS_BADGE: Record<SubStatus, string> = {
  unlimited: 'bg-slate-100 text-slate-700 border-slate-300',
  trial: 'bg-amber-50 text-amber-700 border-amber-300',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  expired: 'bg-rose-50 text-rose-700 border-rose-300',
};
export const PERIOD_LABEL: Record<string, string> = { month: 'Theo tháng', year: 'Theo năm' };
export const ORDER_STATUS_LABEL: Record<string, string> = { pending: 'Chờ xác nhận', confirmed: 'Đã kích hoạt', cancelled: 'Đã hủy' };
export const ORDER_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-300',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-300',
};
