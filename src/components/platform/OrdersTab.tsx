import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2, Check, X, BellRing } from 'lucide-react';
import { platformCall } from './platformApi';
import ConfirmDialog from './ConfirmDialog';
import { formatVnd, formatDate, formatDateTime, PERIOD_LABEL, ORDER_STATUS_LABEL, ORDER_STATUS_BADGE } from './format';

// TAB "ĐƠN ĐĂNG KÝ" — khách chọn gói + kỳ hạn (tháng/năm) → đơn "Chờ xác nhận" kèm số tiền + mã chuyển khoản.
// Admin kiểm tra tiền đã về (theo mã chuyển khoản) rồi bấm XÁC NHẬN để kích hoạt/gia hạn doanh nghiệp.
// ⚠️ Chữ trắng dùng `text-[#ffffff]` (không dùng `text-white`): src/index.css ghi đè mọi `.text-white` thành xám đậm.
interface Order {
  id: string; code: string; companyId: string; companyName: string; companySlug: string; planName: string;
  period: string; months: number; amount: number; status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string; confirmedAt: string | null; periodStart: string | null; periodEnd: string | null; note: string;
  paidClaimedAt: string | null;   // khách đã bấm "Xác nhận chuyển khoản thành công"
}

const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors';

export default function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const list = (await platformCall<{ orders: Order[] }>('orders.list', filter === 'pending' ? { status: 'pending' } : {})).orders;
      // Đơn khách đã báo chuyển khoản lên đầu (cần duyệt gấp), trong nhóm xếp theo thời điểm báo/đặt mới nhất trước.
      const key = (o: Order) => (o.status === 'pending' && o.paidClaimedAt ? 1 : 0);
      setOrders([...list].sort((a, b) => key(b) - key(a) || (b.paidClaimedAt || b.createdAt).localeCompare(a.paidClaimedAt || a.createdAt)));
    }
    catch (e: any) { setLoadError(e.message); } finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  // Xác nhận / hủy đơn: bấm nút chỉ MỞ HỘP XÁC NHẬN trong trang (ConfirmDialog, không dùng window.confirm/prompt vì trình duyệt
  // nhúng có thể chặn hoặc tự đồng ý không hiện gì — nguy hiểm với thao tác kích hoạt gói có tiền). Chỉ khi bấm nút trong hộp mới gọi máy chủ.
  const [action, setAction] = useState<{ kind: 'confirm' | 'cancel'; order: Order } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelNote, setCancelNote] = useState('');
  const openAction = (kind: 'confirm' | 'cancel', order: Order) => { setActionError(null); setCancelNote(''); setAction({ kind, order }); };

  const runAction = async () => {
    if (!action || actionBusy) return;
    const { kind, order: o } = action;
    setActionBusy(true); setActionError(null);
    try {
      if (kind === 'confirm') {
        const r = await platformCall<{ expiresAt: string }>('orders.confirm', { id: o.id });
        setNotice(`Đã kích hoạt "${o.companyName}" — gói ${o.planName}, hạn mới đến ${formatDate(r.expiresAt)}.`);
      } else {
        await platformCall('orders.cancel', { id: o.id, note: cancelNote.trim() });
        setNotice(`Đã hủy đơn ${o.code}.`);
      }
      setAction(null); load();
    } catch (e: any) {
      // Lỗi (vd đơn vừa được người khác xử lý) hiện NGAY trong hộp để không bị bỏ sót; tải lại danh sách cho đúng thực tế.
      setActionError(e.message); load();
    } finally { setActionBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">Đơn đăng ký gói</h2>
          <p className="text-xs text-slate-500">Đối chiếu tiền về theo <b>mã chuyển khoản</b> rồi bấm "Xác nhận" để kích hoạt/gia hạn.</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden text-xs font-bold" role="tablist">
          {(['pending', 'all'] as const).map(k => (
            <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 ${filter === k ? 'bg-blue-600 text-[#ffffff]' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{k === 'pending' ? 'Chờ xác nhận' : 'Tất cả'}</button>
          ))}
        </div>
      </div>

      {orders.some(o => o.status === 'pending' && o.paidClaimedAt) && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg px-3 py-2.5 text-sm" role="status">
          <BellRing className="w-4 h-4 mt-0.5 shrink-0" /> Có <b>{orders.filter(o => o.status === 'pending' && o.paidClaimedAt).length}</b> đơn khách đã báo chuyển khoản — hãy đối chiếu tiền về rồi xác nhận.
        </div>
      )}
      {notice && <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2.5 text-sm" role="status"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> {notice}</div>}
      {loading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Đang tải...</div>}
      {loadError && <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2.5 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {loadError}</div>}

      {!loading && !loadError && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm" id="orders_table">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-200 bg-slate-50">
                <th className="py-2.5 px-3">Mã chuyển khoản</th><th className="py-2.5 px-3">Doanh nghiệp</th><th className="py-2.5 px-3">Gói / kỳ hạn</th>
                <th className="py-2.5 px-3 text-right">Số tiền</th><th className="py-2.5 px-3">Ngày đặt</th><th className="py-2.5 px-3">Trạng thái</th><th className="py-2.5 px-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className={`border-b border-slate-100 last:border-0 align-top ${o.status === 'pending' && o.paidClaimedAt ? 'bg-amber-50/60' : ''}`}>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{o.code}</td>
                  <td className="py-2.5 px-3"><div className="font-semibold text-slate-800">{o.companyName}</div><div className="font-mono text-xs text-slate-500">{o.companySlug}</div></td>
                  <td className="py-2.5 px-3"><div>{o.planName}</div><div className="text-xs text-slate-500">{PERIOD_LABEL[o.period]} · {o.months} tháng</div></td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">{formatVnd(o.amount)}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">{formatDateTime(o.createdAt)}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 rounded border text-xs font-bold ${ORDER_STATUS_BADGE[o.status]}`}>{ORDER_STATUS_LABEL[o.status]}</span>
                    {o.status === 'pending' && o.paidClaimedAt && <div className="text-xs font-bold text-amber-800 mt-1 inline-flex items-center gap-1"><BellRing className="w-3.5 h-3.5" /> Khách báo đã chuyển khoản<br />{formatDateTime(o.paidClaimedAt)}</div>}
                    {o.status === 'confirmed' && <div className="text-xs text-slate-500 mt-0.5">Hạn đến {formatDate(o.periodEnd)}</div>}
                    {o.status === 'cancelled' && o.note && <div className="text-xs text-slate-500 mt-0.5">{o.note}</div>}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    {o.status === 'pending' && (
                      <>
                        <button onClick={() => openAction('confirm', o)} className={`${btn} bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-[#ffffff]`}><Check className="w-3.5 h-3.5" /> Xác nhận</button>{' '}
                        <button onClick={() => openAction('cancel', o)} className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-100`}><X className="w-3.5 h-3.5" /> Hủy</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-slate-500">{filter === 'pending' ? 'Không có đơn nào đang chờ xác nhận.' : 'Chưa có đơn nào.'}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {action && action.kind === 'confirm' && (
        <ConfirmDialog title="Xác nhận đã nhận đủ tiền?" confirmLabel="Đã nhận đủ — kích hoạt gói" busy={actionBusy} error={actionError} onConfirm={runAction} onClose={() => setAction(null)}>
          <p>Doanh nghiệp <b>{action.order.companyName}</b> chuyển <b className="font-mono">{formatVnd(action.order.amount)}</b>.</p>
          <p>Mã chuyển khoản: <b className="font-mono">{action.order.code}</b><br />Gói {action.order.planName} — {PERIOD_LABEL[action.order.period]?.toLowerCase()} ({action.order.months} tháng)</p>
          {action.order.paidClaimedAt && <p className="text-amber-700">Khách đã báo chuyển khoản lúc {formatDateTime(action.order.paidClaimedAt)}.</p>}
          <p className="font-semibold text-rose-700">Chỉ bấm khi tiền ĐÃ VỀ tài khoản. Bấm xác nhận sẽ KÍCH HOẠT / GIA HẠN doanh nghiệp ngay.</p>
        </ConfirmDialog>
      )}
      {action && action.kind === 'cancel' && (
        <ConfirmDialog title={`Hủy đơn ${action.order.code}?`} confirmLabel="Hủy đơn" danger busy={actionBusy} error={actionError} onConfirm={runAction} onClose={() => setAction(null)}>
          <p>Đơn của <b>{action.order.companyName}</b> ({formatVnd(action.order.amount)}) sẽ bị hủy và không kích hoạt gói.</p>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide" htmlFor="od_ghi_chu_huy">Ghi chú lý do (không bắt buộc)</label>
          <input id="od_ghi_chu_huy" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={cancelNote} maxLength={300} onChange={e => setCancelNote(e.target.value)} placeholder="vd: Khách không chuyển tiền" />
        </ConfirmDialog>
      )}
    </div>
  );
}
