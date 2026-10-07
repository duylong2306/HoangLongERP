import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2, Copy, Clock, Users, Check, X } from 'lucide-react';
import {
  subscriptionCall, describeRemaining, type SubscriptionStatus, type SubscriptionPlan, type SubscriptionOrder, type BankInfo,
} from '../../lib/subscriptionClient';

// BẢNG GÓI & GIA HẠN của doanh nghiệp — dùng ở 2 nơi: trang "hết hạn" (RenewalPage, token khóa) và cửa sổ "Gói dịch vụ" trong ERP.
// Hiện: hạn dùng + gói hiện tại + số nhân viên; các gói đang bán (chọn Tháng/Năm); đặt mua → đơn chờ + hướng dẫn chuyển khoản.
// Chỉ admin doanh nghiệp đặt mua được (máy chủ kiểm tra lại); nhân viên thường chỉ thấy tình trạng hạn dùng.
// ⚠️ Chữ trắng dùng `text-[#ffffff]` (không dùng `text-white`): src/index.css ghi đè mọi `.text-white` thành xám đậm.

const vnd = (n: number) => `${new Intl.NumberFormat('vi-VN').format(Math.round(n))} đ`;
const dateVi = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '—');
const copy = (t: string) => { try { navigator.clipboard?.writeText(t).catch(() => {}); } catch { /* bỏ qua */ } };

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
  const [justOrdered, setJustOrdered] = useState<{ order: SubscriptionOrder; bank: BankInfo } | null>(null);

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
      setJustOrdered(r);
      await load(); onChanged?.();
    } catch (e: any) { setError(e.message); } finally { setBusyPlan(null); }
  };

  const cancel = async (o: SubscriptionOrder) => {
    if (!window.confirm(`Hủy đơn ${o.code}?`)) return;
    try {
      await subscriptionCall('cancel', { id: o.id });
      if (justOrdered?.order.id === o.id) setJustOrdered(null);
      await load(); onChanged?.();
    } catch (e: any) { setError(e.message); }
  };

  const pending = useMemo(() => (st?.orders || []).filter(o => o.status === 'pending'), [st]);
  const history = useMemo(() => (st?.orders || []).filter(o => o.status !== 'pending').slice(0, 5), [st]);

  if (loading) return <div className="flex items-center gap-2 text-sm text-slate-500 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Đang tải...</div>;
  if (!st) return <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2.5 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error || 'Không tải được thông tin gói.'}</div>;

  const sub = st.subscription;
  const limitHit = sub.maxEmployees !== null && st.employeeCount >= sub.maxEmployees;
  const bank = justOrdered?.bank ?? st.bank;

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

      {/* Hướng dẫn chuyển khoản cho đơn vừa tạo / đơn đang chờ */}
      {st.canManage && (justOrdered || pending.length > 0) && (
        <div className="space-y-3" id="pending_orders">
          {(justOrdered ? [justOrdered.order, ...pending.filter(o => o.id !== justOrdered.order.id)] : pending).map(o => (
            <div key={o.id} className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-blue-900">Đơn chờ thanh toán: Gói {o.planName} — {o.period === 'year' ? 'theo năm' : 'theo tháng'} ({o.months} tháng)</div>
                <button onClick={() => cancel(o)} className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-rose-600"><X className="w-3.5 h-3.5" /> Hủy đơn</button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                <div><span className="text-slate-500">Số tiền: </span><b className="font-mono text-base">{vnd(o.amount)}</b> <button onClick={() => copy(String(o.amount))} title="Sao chép số tiền" className="text-slate-400 hover:text-slate-700 align-middle"><Copy className="w-3.5 h-3.5 inline" /></button></div>
                <div><span className="text-slate-500">Nội dung chuyển khoản: </span><b className="font-mono text-base">{o.code}</b> <button onClick={() => copy(o.code)} title="Sao chép nội dung" className="text-slate-400 hover:text-slate-700 align-middle"><Copy className="w-3.5 h-3.5 inline" /></button></div>
                {bank && bank.accountNumber ? (
                  <>
                    <div><span className="text-slate-500">Ngân hàng: </span><b>{bank.bankName}</b></div>
                    <div><span className="text-slate-500">Số tài khoản: </span><b className="font-mono">{bank.accountNumber}</b> <button onClick={() => copy(bank.accountNumber)} title="Sao chép số tài khoản" className="text-slate-400 hover:text-slate-700 align-middle"><Copy className="w-3.5 h-3.5 inline" /></button></div>
                    <div className="sm:col-span-2"><span className="text-slate-500">Chủ tài khoản: </span><b>{bank.accountName}</b></div>
                  </>
                ) : <div className="sm:col-span-2 text-amber-700">Chưa có thông tin tài khoản nhận tiền. Vui lòng liên hệ quản trị nền tảng.</div>}
              </div>
              <p className="text-xs text-slate-600">Chuyển khoản <b>đúng số tiền</b> và <b>đúng nội dung</b> ở trên. Sau khi tiền về, quản trị nền tảng xác nhận và gói được kích hoạt/gia hạn (trang này tự cập nhật khi bạn tải lại).{bank?.note ? ` ${bank.note}` : ''}</p>
            </div>
          ))}
        </div>
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
                  <div className="flex items-start justify-between gap-2"><h4 className="font-black text-slate-900">{p.name}</h4>{isCurrent && <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">Gói hiện tại</span>}</div>
                  {p.description && <p className="text-xs text-slate-500 mt-1">{p.description}</p>}
                  <div className="mt-3">
                    {price > 0 ? <><div className="text-2xl font-black text-slate-900 font-mono">{vnd(price)}</div><div className="text-xs text-slate-500">/ {period === 'month' ? 'tháng' : 'năm'}{monthly ? ` (≈ ${vnd(monthly)} / tháng)` : ''}</div></>
                      : <div className="text-sm text-slate-400 italic">Chưa mở bán theo kỳ hạn này</div>}
                  </div>
                  <div className="text-sm text-slate-600 mt-2 inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" /> {p.maxEmployees === null ? 'Không giới hạn nhân viên' : `Tối đa ${p.maxEmployees} nhân viên`}</div>
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
