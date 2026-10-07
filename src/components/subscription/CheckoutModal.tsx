import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2, X, QrCode, Clock, ShieldCheck } from 'lucide-react';
import CopyButton from '../CopyButton';
import { subscriptionCall, type SubscriptionOrder, type BankInfo } from '../../lib/subscriptionClient';
import { buildVietQrPayload } from '../../lib/vietqr';

// TRANG THANH TOÁN — hiện khi khách bấm mua/gia hạn một gói (hoặc bấm "Thanh toán" ở đơn đang chờ).
//   1) Mã QR VietQR: quét bằng app ngân hàng sẽ tự điền ngân hàng + số tài khoản + SỐ TIỀN + NỘI DUNG (= mã đơn);
//   2) thông tin chuyển khoản thủ công (có nút sao chép) cho ai không quét được;
//   3) nút "Xác nhận chuyển khoản thành công": đánh dấu đơn "khách báo đã chuyển" + gửi Telegram cho quản trị nền tảng để duyệt nhanh.
//      Bấm nút KHÔNG kích hoạt gói — chỉ quản trị nền tảng xác nhận khi thấy tiền về.
// Chưa cấu hình ngân hàng/BIN thì không có QR, vẫn hiện hướng dẫn chuyển khoản thủ công (nếu có số tài khoản).
// ⚠️ Chữ trắng dùng `text-[#ffffff]` (không dùng `text-white`): src/index.css ghi đè mọi `.text-white` thành xám đậm.

const vnd = (n: number) => `${new Intl.NumberFormat('vi-VN').format(Math.round(n))} đ`;
const dateTime = (iso: string) => new Date(iso).toLocaleString('vi-VN');

function Row({ label, value, mono, copy }: { label: string; value: string; mono?: boolean; copy?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <span className="flex items-center gap-2 min-w-0 text-right">
        <b className={`text-slate-900 break-all ${mono ? 'font-mono' : ''}`}>{value}</b>
        {copy !== undefined && <CopyButton text={copy} label={label.toLowerCase()} />}
      </span>
    </div>
  );
}

export default function CheckoutModal({ order, bank, onClose, onChanged, onCancelOrder }: {
  order: SubscriptionOrder; bank: BankInfo | null; onClose: () => void; onChanged: () => void; onCancelOrder: (o: SubscriptionOrder) => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [claimedAt, setClaimedAt] = useState<string | null>(order.paidClaimedAt ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasBank = !!bank && !!bank.accountNumber;
  const payload = bank && bank.bankBin ? buildVietQrPayload({ bin: bank.bankBin, account: bank.accountNumber, amount: order.amount, memo: order.code }) : null;

  // Vẽ mã QR (thư viện nạp khi cần để không làm nặng trang chính). Lỗi thì thôi, vẫn còn hướng dẫn thủ công.
  useEffect(() => {
    let cancelled = false;
    setQr(null);
    if (!payload) return;
    import('qrcode').then(m => (m.default || m).toDataURL(payload, { margin: 1, width: 280, errorCorrectionLevel: 'M' }))
      .then(url => { if (!cancelled) setQr(url); })
      .catch(() => { /* không vẽ được QR → chỉ hiện thông tin thủ công */ });
    return () => { cancelled = true; };
  }, [payload]);

  // Đóng bằng phím Esc
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const claim = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const r = await subscriptionCall<{ claimedAt: string }>('claim', { id: order.id });
      setClaimedAt(r.claimedAt);
      onChanged();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/50 flex items-start sm:items-center justify-center p-3 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="checkout_title" id="checkout_modal">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-4">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <div>
            <h2 id="checkout_title" className="text-lg font-black text-slate-900">Thanh toán gói {order.planName}</h2>
            <p className="text-xs text-slate-500">Đơn <span className="font-mono font-bold">{order.code}</span> · {order.period === 'year' ? 'theo năm' : 'theo tháng'} ({order.months} tháng)</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 grid gap-5 md:grid-cols-[280px_1fr]">
          {/* Cột trái: mã QR */}
          <div className="flex flex-col items-center gap-2">
            {payload ? (
              <>
                <div className="w-[280px] max-w-full aspect-square bg-white border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden">
                  {qr ? <img src={qr} alt={`Mã QR chuyển khoản ${vnd(order.amount)} nội dung ${order.code}`} className="w-full h-full" /> : <Loader2 className="w-6 h-6 animate-spin text-slate-400" />}
                </div>
                <p className="text-sm text-slate-600 text-center inline-flex items-start gap-1.5"><QrCode className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" /> Mở app ngân hàng → quét mã QR. Số tài khoản, số tiền và nội dung sẽ tự điền.</p>
              </>
            ) : (
              <div className="w-full bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 text-sm text-slate-500 text-center">
                <QrCode className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                Chưa có mã QR cho đơn này. Vui lòng chuyển khoản theo thông tin bên cạnh.
              </div>
            )}
          </div>

          {/* Cột phải: thông tin chuyển khoản */}
          <div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-blue-900">Số tiền cần thanh toán</span>
              <b className="text-2xl font-black font-mono text-blue-900">{vnd(order.amount)}</b>
            </div>
            {hasBank ? (
              <div>
                {bank!.bankName && <Row label="Ngân hàng" value={bank!.bankName} />}
                <Row label="Số tài khoản" value={bank!.accountNumber} mono copy={bank!.accountNumber} />
                {bank!.accountName && <Row label="Chủ tài khoản" value={bank!.accountName} />}
                <Row label="Số tiền" value={vnd(order.amount)} mono copy={String(order.amount)} />
                <Row label="Nội dung chuyển khoản" value={order.code} mono copy={order.code} />
              </div>
            ) : (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> Chưa có thông tin tài khoản nhận tiền. Vui lòng liên hệ quản trị nền tảng.</div>
            )}
            <p className="text-xs text-slate-500 mt-3">Chuyển <b>đúng số tiền</b> và <b>đúng nội dung</b> để được xác nhận nhanh nhất.{bank?.note ? ` ${bank.note}` : ''}</p>
          </div>
        </div>

        {/* Khu vực xác nhận */}
        <div className="px-5 pb-5 space-y-3">
          {error && <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2.5 text-sm" role="alert"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}

          {claimedAt ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3" role="status" id="checkout_claimed">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div className="text-sm text-emerald-900">
                <div className="font-black">Đã gửi yêu cầu xác nhận chuyển khoản</div>
                <div className="mt-0.5 inline-flex items-center gap-1 text-emerald-800"><Clock className="w-3.5 h-3.5" /> Gửi lúc {dateTime(claimedAt)}. Quản trị nền tảng sẽ kiểm tra tiền về và kích hoạt gói cho doanh nghiệp bạn ngay khi xác nhận xong.</div>
                <div className="mt-1 text-emerald-800">Bạn có thể đóng cửa sổ này; trạng thái được cập nhật khi tải lại trang.</div>
              </div>
            </div>
          ) : (
            <>
              <button type="button" onClick={claim} disabled={busy || !hasBank}
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-[#ffffff] font-black py-3 rounded-xl transition-colors">
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />} Xác nhận chuyển khoản thành công
              </button>
              <p className="text-xs text-slate-500 text-center">Chỉ bấm sau khi bạn <b>đã chuyển khoản</b>. Gói chỉ được kích hoạt khi quản trị nền tảng xác nhận tiền đã về.</p>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold">{claimedAt ? 'Đóng' : 'Để sau'}</button>
            {!claimedAt && <button type="button" onClick={() => onCancelOrder(order)} className="text-xs font-bold text-slate-500 hover:text-rose-600 inline-flex items-center gap-1"><X className="w-3.5 h-3.5" /> Hủy đơn này</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
