import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2, Clock, Users, X, CreditCard, Hourglass } from 'lucide-react';
import {
  subscriptionCall, describeRemaining, type SubscriptionStatus, type SubscriptionPlan, type SubscriptionOrder, type BankInfo,
} from '../../lib/subscriptionClient';
import PlanFeatures from './PlanFeatures';
import CheckoutModal from './CheckoutModal';

// BẢNG GÓI & GIA HẠN của doanh nghiệp — dùng ở 2 nơi: trang "hết hạn" (RenewalPage, token khóa) và cửa sổ "Gói dịch vụ" trong ERP.
// Hiện: hạn dùng + gói hiện tại + số nhân viên; các gói đang bán (chọn Tháng/Năm, mô tả được/không được nhận);
// bấm mua → đơn chờ + TRANG THANH TOÁN (CheckoutModal: mã QR VietQR + nút "Xác nhận chuyển khoản thành công").
// Chỉ admin doanh nghiệp đặt mua được (máy chủ kiểm tra lại); nhân viên thường chỉ thấy tình trạng hạn dùng.
// ⚠️ Chữ trắng dùng `text-[#ffffff]` (không dùng `text-white`): src/index.css ghi đè mọi `.text-white` thành xám đậm.

const vnd = (n: number) => `${new Intl.NumberFormat('vi-VN').format(Math.round(n))} đ`;
const dateVi = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '—');

const STATUS_STYLE: Record<string, string> = {
  trial: 'bg-amber-50 text-amber-700 border-amber-300', active: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  expired: 'bg-rose-50 text-rose-700 border-rose-300', unlimited: 'bg-slate-100 text-slate-700 border-slate-300',
};
const STATUS_TEXT: Record<string, string> = { trial: 'Đang dùng thử', active: 'Đang sử dụng', expired: 'Đã hết hạn', unlimited: 'Không giới hạn' };

export default function SubscriptionPanel({ onChanged, onStatus }: { onChanged?: () => void; onStatus?: (s: SubscriptionStatus) => void }) {
  const [st, setSt] = useState<SubscriptionStatus | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  // Đơn đang mở ở trang thanh toán (lưu id để luôn lấy bản mới nhất sau mỗi lần tải lại trạng thái)
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [bankFromOrder, setBankFromOrder] = useState<BankInfo | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, p] = await Promise.all([subscriptionCall<SubscriptionStatus>('status'), subscriptionCall<{ plans: SubscriptionPlan[] }>('plans')]);
      setSt(s); setPlans(p.plans); onStatus?.(s);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const order = async (plan: SubscriptionPlan) => {
    if (busyPlan) return;
    setBusyPlan(plan.id); setError(null);
    try {
      const r = await subscriptionCall<{ order: SubscriptionOrder; bank: BankInfo }>('order', { planId: plan.id, period });
      setBankFromOrder(r.bank); setCheckoutId(r.order.id);   // mở ngay trang thanh toán cho đơn vừa tạo
      await load(); onChanged?.();
    } catch (e: any) { setError(e.message); } finally { setBusyPlan(null); }
  };

  // Hủy đơn: hỏi xác nhận bằng hộp thoại NGAY TRONG TRANG (không dùng window.confirm — trình duyệt nhúng/ứng dụng bọc web
  // thường chặn hộp thoại gốc và trả về "không" ngay, khiến nút Hủy đơn bấm không có phản ứng gì).
  const [cancelTarget, setCancelTarget] = useState<SubscriptionOrder | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const cancel = (o: SubscriptionOrder) => { setCancelError(null); setCancelTarget(o); };
  const doCancel = async () => {
    if (!cancelTarget || cancelBusy) return;
    setCancelBusy(true); setCancelError(null);
    try {
      await subscriptionCall('cancel', { id: cancelTarget.id });
      if (checkoutId === cancelTarget.id) setCheckoutId(null);
      setCancelTarget(null);
      await load(); onChanged?.();
    } catch (e: any) { setCancelError(e.message); } finally { setCancelBusy(false); }
  };

  const pending = useMemo(() => (st?.orders || []).filter(o => o.status === 'pending'), [st]);
  const history = useMemo(() => (st?.orders || []).filter(o => o.status !== 'pending').slice(0, 5), [st]);

  if (loading) return <div className="flex items-center gap-2 text-sm text-slate-500 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Đang tải...</div>;
  if (!st) return <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2.5 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error || 'Không tải được thông tin gói.'}</div>;

  const sub = st.subscription;
  const limitHit = sub.maxEmployees !== null && st.employeeCount >= sub.maxEmployees;
  const bank = st.bank ?? bankFromOrder;
  const checkoutOrder = checkoutId ? (st.orders || []).find(o => o.id === checkoutId && o.status === 'pending') ?? null : null;

  return (
    <div className="space-y-5 text-slate-800" id="subscription_panel">
      {/* Tình trạng hiện tại */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tình trạng</div>
          <span className={`inline-block mt-1.5 px-2.5 py-1 rounded border text-sm font-bold ${STATUS_STYLE[sub.status]}`}>{STATUS_TEXT[sub.status]}</span>
          <div className="text-sm text-slate-600 mt-2">Gói: <b>{sub.planName || (sub.isTrial ? 'Dùng thử' : '—')}</b></div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Ngày hết hạn</div>
          <div className="text-xl font-black text-slate-900 mt-1">{sub.expiresAt ? dateVi(sub.expiresAt) : 'Không giới hạn'}</div>
          <div className={`text-sm mt-0.5 ${sub.status === 'expired' ? 'text-rose-600 font-bold' : (sub.daysLeft ?? 99) <= 7 ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>{describeRemaining(sub.daysLeft, sub.status)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Nhân viên</div>
          <div className={`text-xl font-black mt-1 ${limitHit ? 'text-rose-600' : 'text-slate-900'}`}>{st.employeeCount}{sub.maxEmployees !== null ? ` / ${sub.maxEmployees}` : ''}</div>
          <div className="text-sm text-slate-500 mt-0.5">{sub.maxEmployees === null ? 'Không giới hạn' : limitHit ? 'Đã đạt giới hạn của gói' : 'Theo giới hạn của gói'}</div>
        </div>
      </div>

      {error && <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2.5 text-sm" role="alert"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}

      {!st.canManage && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5 text-sm">
          Chỉ <b>quản trị viên của doanh nghiệp</b> mới đặt mua/gia hạn được. Vui lòng liên hệ quản trị viên của doanh nghiệp bạn.
        </div>
      )}

      {/* Đơn đang chờ thanh toán: mở lại trang thanh toán bất cứ lúc nào */}
      {st.canManage && pending.length > 0 && (
        <div className="space-y-2" id="pending_orders">
          {pending.map(o => (
            <div key={o.id} className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm min-w-0">
                <div className="font-bold text-blue-900">Đơn chờ thanh toán: Gói {o.planName} — {o.period === 'year' ? 'theo năm' : 'theo tháng'} ({o.months} tháng) · <span className="font-mono">{vnd(o.amount)}</span></div>
                <div className="text-xs text-slate-600 mt-0.5">Mã đơn: <span className="font-mono font-bold">{o.code}</span>
                  {o.paidClaimedAt && <span className="ml-2 inline-flex items-center gap-1 text-amber-700 font-bold"><Hourglass className="w-3.5 h-3.5" /> Đã báo chuyển khoản — chờ quản trị xác nhận</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setCheckoutId(o.id)} className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-[#ffffff] text-sm font-bold px-4 py-2 rounded-lg"><CreditCard className="w-4 h-4" /> {o.paidClaimedAt ? 'Xem đơn' : 'Thanh toán'}</button>
                <button onClick={() => cancel(o)} className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-rose-600"><X className="w-3.5 h-3.5" /> Hủy đơn</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-[120] bg-slate-900/50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="cancel_title" id="cancel_dialog">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-3">
            <h3 id="cancel_title" className="font-black text-slate-900">Hủy đơn {cancelTarget.code}?</h3>
            <p className="text-sm text-slate-600">Đơn gói <b>{cancelTarget.planName}</b> ({vnd(cancelTarget.amount)}) sẽ bị hủy. Nếu bạn đã chuyển khoản, vui lòng <b>không hủy</b> mà chờ quản trị xác nhận.</p>
            {cancelError && <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-sm" role="alert"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {cancelError}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCancelTarget(null)} disabled={cancelBusy} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold">Giữ đơn</button>
              <button type="button" onClick={doCancel} disabled={cancelBusy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-[#ffffff] text-sm font-bold">{cancelBusy && <Loader2 className="w-4 h-4 animate-spin" />} Xác nhận hủy đơn</button>
            </div>
          </div>
        </div>
      )}

      {checkoutOrder && (
        <CheckoutModal order={checkoutOrder} bank={bank} onClose={() => setCheckoutId(null)} onChanged={() => { load(); onChanged?.(); }} onCancelOrder={cancel} />
      )}

      {/* Các gói đang bán */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="font-black text-slate-900">{sub.status === 'expired' ? 'Chọn gói để tiếp tục sử dụng' : 'Mua / gia hạn gói'}</h3>
          <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden text-sm font-bold" role="tablist" aria-label="Kỳ hạn">
            {(['month', 'year'] as const).map(k => (
              <button key={k} role="tab" aria-selected={period === k} onClick={() => setPeriod(k)} className={`px-4 py-1.5 ${period === k ? 'bg-blue-600 text-[#ffffff]' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{k === 'month' ? 'Theo tháng' : 'Theo năm'}</button>
            ))}
          </div>
        </div>

        {plans.length === 0 ? (
          <div className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-4">Hiện chưa có gói nào được mở bán. Vui lòng liên hệ quản trị nền tảng.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map(p => {
              const price = period === 'month' ? p.priceMonthly : p.priceYearly;
              const monthly = period === 'year' && p.priceYearly > 0 ? Math.round(p.priceYearly / 12) : null;
              const isCurrent = sub.planId === p.id && sub.status === 'active';
              return (
                <div key={p.id} className={`bg-white border rounded-xl p-4 flex flex-col ${isCurrent ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-2"><h4 className="font-black text-slate-900">{p.name}{p.badge && <span className="ml-2 align-middle text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded px-1.5 py-0.5">{p.badge}</span>}</h4>{isCurrent && <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">Gói hiện tại</span>}</div>
                  {p.description && <p className="text-xs text-slate-500 mt-1">{p.description}</p>}
                  <div className="mt-3">
                    {price > 0 ? <><div className="text-2xl font-black text-slate-900 font-mono">{vnd(price)}</div><div className="text-xs text-slate-500">/ {period === 'month' ? 'tháng' : 'năm'}{monthly ? ` (≈ ${vnd(monthly)} / tháng)` : ''}</div></>
                      : <div className="text-sm text-slate-400 italic">Chưa mở bán theo kỳ hạn này</div>}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100"><PlanFeatures plan={p} /></div>
                  <div className="mt-auto pt-4">
                    <button disabled={!st.canManage || price <= 0 || busyPlan !== null} onClick={() => order(p)}
                      className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-[#ffffff] font-bold py-2.5 rounded-lg transition-colors">
                      {busyPlan === p.id && <Loader2 className="w-4 h-4 animate-spin" />} {isCurrent ? 'Gia hạn gói này' : 'Chọn gói này'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lịch sử đơn gần đây */}
      {st.canManage && history.length > 0 && (
        <div>
          <h3 className="font-black text-slate-900 mb-2 text-sm">Đơn gần đây</h3>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 text-sm">
            {history.map(o => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div><span className="font-mono font-bold">{o.code}</span> · {o.planName} · {o.period === 'year' ? 'năm' : 'tháng'} · {vnd(o.amount)}</div>
                <div className={`inline-flex items-center gap-1 text-xs font-bold ${o.status === 'confirmed' ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {o.status === 'confirmed' ? <><CheckCircle2 className="w-3.5 h-3.5" /> Đã kích hoạt, hạn đến {dateVi(o.periodEnd)}</> : 'Đã hủy'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
