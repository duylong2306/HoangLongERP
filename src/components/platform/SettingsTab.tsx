import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { platformCall } from './platformApi';
import { VIETNAM_BANKS } from '../../lib/vietnamBanks';

// TAB "CẤU HÌNH" — số ngày dùng thử, tài khoản ngân hàng nhận tiền (hiện cho khách khi đặt mua) (đổi mật khẩu nằm ở tab "Tài khoản").
// ⚠️ Chữ trắng dùng `text-[#ffffff]` (không dùng `text-white`): src/index.css ghi đè mọi `.text-white` thành xám đậm.
const btn = 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-[#ffffff]';
const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const label = 'block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1';

function Msg({ ok, text }: { ok: boolean; text: string }) {
  return ok
    ? <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2 text-sm" role="status"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> {text}</div>
    : <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-sm" role="alert"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {text}</div>;
}

export default function SettingsTab() {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [trialDays, setTrialDays] = useState('7');
  const [trialMax, setTrialMax] = useState('');
  const [bank, setBank] = useState({ bankName: '', bankBin: '', accountNumber: '', accountName: '', note: '' });
  const [telegram, setTelegram] = useState<{ configured: boolean; busy: boolean; msg: { ok: boolean; text: string } | null }>({ configured: false, busy: false, msg: null });
  // Ngân hàng không có trong danh sách → cho nhập tay tên + mã BIN
  const [manualBank, setManualBank] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    platformCall<{ trial: { days: number; maxEmployees: number | null }; bank: typeof bank; telegramConfigured?: boolean }>('settings.get')
      .then(r => {
        setTrialDays(String(r.trial.days)); setTrialMax(r.trial.maxEmployees === null ? '' : String(r.trial.maxEmployees));
        setBank({ ...r.bank, bankBin: r.bank.bankBin || '' }); setManualBank(!!(r.bank.bankName || r.bank.bankBin) && !VIETNAM_BANKS.some(b => b.bin === r.bank.bankBin));
        setTelegram(t => ({ ...t, configured: !!r.telegramConfigured })); setLoaded(true);
      })
      .catch(e => setLoadError(e.message));
  }, []);

  const testTelegram = async () => {
    setTelegram(t => ({ ...t, busy: true, msg: null }));
    try { await platformCall('telegram.test'); setTelegram(t => ({ ...t, busy: false, msg: { ok: true, text: 'Đã gửi tin nhắn thử — hãy kiểm tra Telegram.' } })); }
    catch (err: any) { setTelegram(t => ({ ...t, busy: false, msg: { ok: false, text: err.message } })); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      await platformCall('settings.save', { trial: { days: Number(trialDays), maxEmployees: trialMax === '' ? null : Number(trialMax) }, bank });
      setMsg({ ok: true, text: 'Đã lưu cấu hình.' });
    } catch (err: any) { setMsg({ ok: false, text: err.message }); } finally { setBusy(false); }
  };

  if (loadError) return <Msg ok={false} text={loadError} />;
  if (!loaded) return <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Đang tải...</div>;

  return (
    <div className="max-w-3xl">
      <form onSubmit={save} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4" id="settings_form">
        <h2 className="text-base font-black text-slate-900">Dùng thử & nhận thanh toán</h2>

        <fieldset className="space-y-3">
          <legend className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Dùng thử khi đăng ký mới</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={label} htmlFor="st_so_ngay_dung_thu">Số ngày dùng thử *</label><input id="st_so_ngay_dung_thu" type="number" min={1} max={365} className={input} value={trialDays} onChange={e => setTrialDays(e.target.value)} required /></div>
            <div><label className={label} htmlFor="st_nhan_vien_toi_da_dung_thu">Nhân viên tối đa (dùng thử)</label><input id="st_nhan_vien_toi_da_dung_thu" type="number" min={1} className={input} value={trialMax} onChange={e => setTrialMax(e.target.value)} placeholder="Để trống = không giới hạn" /></div>
          </div>
          <p className="text-xs text-slate-500">Chỉ áp dụng cho doanh nghiệp đăng ký SAU khi lưu. Doanh nghiệp đang dùng thử giữ nguyên hạn đã cấp.</p>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Tài khoản ngân hàng nhận tiền (hiện cho khách khi đặt mua)</legend>
          <p className="text-xs text-slate-500">Có chọn ngân hàng + số tài khoản thì trang thanh toán của khách sẽ có <b>mã QR</b> tự điền số tài khoản, số tiền, nội dung. Sau khi lưu, hãy tự mua thử một gói và quét mã bằng app ngân hàng để chắc chắn đúng tài khoản.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="st_ngan_hang">Ngân hàng</label>
              <select id="st_ngan_hang" className={input} value={manualBank ? 'other' : (VIETNAM_BANKS.find(b => b.bin === bank.bankBin)?.bin || '')}
                onChange={e => {
                  const v = e.target.value;
                  if (v === 'other') { setManualBank(true); return; }
                  setManualBank(false);
                  const b = VIETNAM_BANKS.find(x => x.bin === v);
                  setBank(prev => ({ ...prev, bankName: b?.name || '', bankBin: b?.bin || '' }));
                }}>
                <option value="">— Chọn ngân hàng —</option>
                {VIETNAM_BANKS.map(b => <option key={b.bin} value={b.bin}>{b.name}</option>)}
                <option value="other">Khác (nhập tay tên và mã BIN)</option>
              </select>
            </div>
            <div><label className={label} htmlFor="st_so_tai_khoan">Số tài khoản</label><input id="st_so_tai_khoan" className={`${input} font-mono`} value={bank.accountNumber} onChange={e => setBank(b => ({ ...b, accountNumber: e.target.value }))} maxLength={40} /></div>
            {manualBank && (
              <>
                <div><label className={label} htmlFor="st_ten_ngan_hang_khac">Tên ngân hàng</label><input id="st_ten_ngan_hang_khac" className={input} value={bank.bankName} onChange={e => setBank(b => ({ ...b, bankName: e.target.value }))} maxLength={80} /></div>
                <div><label className={label} htmlFor="st_ma_bin">Mã BIN (6 số)</label><input id="st_ma_bin" className={`${input} font-mono`} inputMode="numeric" value={bank.bankBin} onChange={e => setBank(b => ({ ...b, bankBin: e.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder="vd: 970436" /></div>
              </>
            )}
            <div className="sm:col-span-2"><label className={label} htmlFor="st_ten_chu_tai_khoan">Tên chủ tài khoản</label><input id="st_ten_chu_tai_khoan" className={input} value={bank.accountName} onChange={e => setBank(b => ({ ...b, accountName: e.target.value }))} maxLength={80} /></div>
            <div className="sm:col-span-2"><label className={label} htmlFor="st_ghi_chu_cho_khach">Ghi chú cho khách</label><input id="st_ghi_chu_cho_khach" className={input} value={bank.note} onChange={e => setBank(b => ({ ...b, note: e.target.value }))} maxLength={300} placeholder="vd: Ghi đúng mã chuyển khoản, kích hoạt trong giờ hành chính" /></div>
          </div>
        </fieldset>

        {msg && <Msg {...msg} />}
        <button type="submit" disabled={busy} className={btn}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Lưu cấu hình</button>
      </form>

      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 mt-6" id="telegram_box">
        <h2 className="text-base font-black text-slate-900">Thông báo Telegram</h2>
        <p className="text-sm text-slate-600">Khi khách bấm <b>"Xác nhận chuyển khoản thành công"</b>, hệ thống tự nhắn vào Telegram của bạn để duyệt đơn nhanh hơn.</p>
        <div className={`text-sm font-semibold ${telegram.configured ? 'text-emerald-700' : 'text-amber-700'}`}>
          {telegram.configured ? '✓ Đã cấu hình bot Telegram' : 'Chưa cấu hình bot Telegram'}
        </div>
        {!telegram.configured && (
          <ol className="text-xs text-slate-600 list-decimal pl-5 space-y-1">
            <li>Mở Telegram, chat với <b>@BotFather</b> → /newbot → lấy <b>token</b> của bot.</li>
            <li>Nhắn một tin bất kỳ cho bot mới (hoặc thêm bot vào nhóm), rồi lấy <b>chat id</b> (vd: chat với @userinfobot, hoặc mở https://api.telegram.org/bot&lt;token&gt;/getUpdates).</li>
            <li>Trên Vercel (project của nền tảng) thêm biến môi trường <code className="font-mono">TELEGRAM_BOT_TOKEN</code> và <code className="font-mono">TELEGRAM_CHAT_ID</code>, rồi deploy lại.</li>
          </ol>
        )}
        {telegram.msg && <Msg {...telegram.msg} />}
        <button type="button" onClick={testTelegram} disabled={telegram.busy} className={btn}>{telegram.busy && <Loader2 className="w-4 h-4 animate-spin" />} Gửi tin nhắn thử</button>
      </section>
    </div>
  );
}
