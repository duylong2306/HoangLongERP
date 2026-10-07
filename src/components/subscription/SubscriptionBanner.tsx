import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Clock, X } from 'lucide-react';
import SubscriptionPanel from './SubscriptionPanel';
import { subscriptionCall, describeRemaining, type SubscriptionStatus } from '../../lib/subscriptionClient';

// THANH HIỂN THỊ HẠN DÙNG trong ERP: ngày hết hạn + còn bao nhiêu ngày + nút mở bảng "Gói dịch vụ" để mua/gia hạn.
//  • Dùng thử → thanh vàng "Đang dùng thử"; sắp hết (≤ 14 ngày) → thanh vàng; còn nhiều → 1 dòng nhỏ;
//  • Không giới hạn (doanh nghiệp cũ) → không hiện gì.
// Lỗi tải/chưa đăng nhập → ẩn im lặng (không làm phiền người dùng ERP). Làm mới mỗi 10 phút.
const dateVi = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '');

export default function SubscriptionBanner() {
  const [st, setSt] = useState<SubscriptionStatus | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    subscriptionCall<SubscriptionStatus>('status').then(setSt).catch(() => setSt(null));
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

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
