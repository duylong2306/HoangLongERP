import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Clock, X, Lock, LogOut } from 'lucide-react';
import SubscriptionPanel from './SubscriptionPanel';
import { subscriptionCall, describeRemaining, type SubscriptionStatus, type SubscriptionCheck } from '../../lib/subscriptionClient';
import { clearStoredSession } from '../../lib/supabase';

// THANH HIỂN THỊ HẠN DÙNG trong ERP: ngày hết hạn + còn bao nhiêu ngày + nút mở bảng "Gói dịch vụ" để mua/gia hạn.
//  • Dùng thử → thanh vàng "Đang dùng thử"; sắp hết (≤ 14 ngày) → thanh vàng; còn nhiều → 1 dòng nhỏ;
//  • Không giới hạn (doanh nghiệp cũ) → không hiện gì.
// Lỗi tải/chưa đăng nhập → ẩn im lặng (không làm phiền người dùng ERP). Làm mới mỗi 10 phút.
//
// CHẶN NGAY khi doanh nghiệp bị KHÓA hoặc HẾT HẠN lúc đang dùng: dữ liệu ở máy chủ đã bị chặn (RLS company_live), nhưng giao
// diện ERP còn dữ liệu trong bộ nhớ/bộ đệm nên trông vẫn dùng bình thường — vì vậy cứ ~60 giây (và khi quay lại tab) hỏi máy
// chủ 1 lần (action 'check'); bị chặn thì phủ kín màn hình bằng thông báo, không cho thao tác tiếp.
const CHECK_EVERY_MS = 60 * 1000;
const dateVi = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '');

export default function SubscriptionBanner() {
  const [st, setSt] = useState<SubscriptionStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState<SubscriptionCheck['reason']>(null);

  const load = useCallback(() => {
    subscriptionCall<SubscriptionStatus>('status').then(setSt).catch(() => setSt(null));
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  // Hỏi máy chủ định kỳ + khi người dùng quay lại tab. Lỗi mạng/phiên → bỏ qua (không chặn nhầm).
  useEffect(() => {
    const check = () => {
      subscriptionCall<SubscriptionCheck>('check').then(r => setBlocked(r.blocked ? r.reason : null)).catch(() => { /* bỏ qua */ });
    };
    check();
    const t = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  if (blocked) {
    // Đăng xuất = xóa phiên + tải lại; đăng nhập lại: bị khóa → báo lỗi tại màn đăng nhập; hết hạn → vào trang gia hạn.
    const logout = () => { clearStoredSession(); window.location.reload(); };
    const inactive = blocked === 'inactive';
    return (
      <div className="fixed inset-0 z-[200] bg-slate-900/80 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="blocked_title" id="subscription_blocked">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center space-y-3">
          <Lock className="w-10 h-10 text-rose-600 mx-auto" aria-hidden />
          <h2 id="blocked_title" className="text-lg font-black text-slate-900">{inactive ? 'Doanh nghiệp đã bị khóa' : 'Gói dịch vụ đã hết hạn'}</h2>
          <p className="text-sm text-slate-600">
            {inactive
              ? 'Quản trị nền tảng đã tạm khóa doanh nghiệp này. Bạn không thể tiếp tục sử dụng cho tới khi được mở lại. Dữ liệu vẫn được giữ nguyên — vui lòng liên hệ quản trị nền tảng.'
              : 'Gói dịch vụ của doanh nghiệp đã hết hạn. Hãy đăng nhập lại để vào trang gia hạn; dữ liệu được giữ nguyên.'}
          </p>
          <button onClick={logout} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-[#ffffff] font-bold px-5 py-2.5 rounded-lg"><LogOut className="w-4 h-4" /> {inactive ? 'Đăng xuất' : 'Đăng nhập lại để gia hạn'}</button>
        </div>
      </div>
    );
  }

  if (!st || st.subscription.status === 'unlimited') return null;
  const sub = st.subscription;
  const pending = st.orders.filter(o => o.status === 'pending').length;
  const warn = sub.status === 'trial' || (sub.daysLeft !== null && sub.daysLeft <= 14);
  const label = sub.status === 'trial'
    ? `Đang dùng thử — ${describeRemaining(sub.daysLeft, sub.status).toLowerCase()} (hết hạn ${dateVi(sub.expiresAt)})`
    : `Gói ${sub.planName || ''} — hết hạn ${dateVi(sub.expiresAt)} (${describeRemaining(sub.daysLeft, sub.status).toLowerCase()})`;

  return (
    <>
      <div
        id="subscription_banner"
        className={`flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-xs border-b ${warn ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
      >
        <span className="inline-flex items-center gap-1.5 font-semibold">
          {warn ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> : <Clock className="w-3.5 h-3.5" />}
          {label}
          {pending > 0 && <span className="ml-1 text-blue-700">· Có {pending} đơn chờ xác nhận</span>}
        </span>
        <button onClick={() => setOpen(true)} className="font-bold text-blue-700 hover:underline">{warn ? 'Mua / gia hạn gói' : 'Gói dịch vụ'}</button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Gói dịch vụ">
          <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-4xl my-6 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-slate-900">Gói dịch vụ — {st.company.name}</h2>
              <button onClick={() => { setOpen(false); load(); }} aria-label="Đóng" className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <SubscriptionPanel onChanged={load} />
          </div>
        </div>
      )}
    </>
  );
}
