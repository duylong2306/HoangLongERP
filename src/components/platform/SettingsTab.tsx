import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { platformCall } from './platformApi';

// TAB "CẤU HÌNH" — số ngày dùng thử, tài khoản ngân hàng nhận tiền (hiện cho khách khi đặt mua) và đổi mật khẩu quản trị.
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
  const [bank, setBank] = useState({ bankName: '', accountNumber: '', accountName: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    platformCall<{ trial: { days: number; maxEmployees: number | null }; bank: typeof bank }>('settings.get')
      .then(r => { setTrialDays(String(r.trial.days)); setTrialMax(r.trial.maxEmployees === null ? '' : String(r.trial.maxEmployees)); setBank(r.bank); setLoaded(true); })
      .catch(e => setLoadError(e.message));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      await platformCall('settings.save', { trial: { days: Number(trialDays), maxEmployees: trialMax === '' ? null : Number(trialMax) }, bank });
      setMsg({ ok: true, text: 'Đã lưu cấu hình.' });
    } catch (err: any) { setMsg({ ok: false, text: err.message }); } finally { setBusy(false); }
  };

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwBusy) return;
    if (pw.newPassword !== pw.confirm) { setPwMsg({ ok: false, text: 'Hai lần nhập mật khẩu mới không khớp.' }); return; }
    setPwBusy(true); setPwMsg(null);
    try {
      await platformCall('password.change', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      setPwMsg({ ok: true, text: 'Đã đổi mật khẩu.' });
    } catch (err: any) { setPwMsg({ ok: false, text: err.message }); } finally { setPwBusy(false); }
  };

  if (loadError) return <Msg ok={false} text={loadError} />;
  if (!loaded) return <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Đang tải...</div>;

  return (
    <div className="grid gap-6 lg:grid-cols-2 items-start">
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={label} htmlFor="st_ngan_hang">Ngân hàng</label><input id="st_ngan_hang" className={input} value={bank.bankName} onChange={e => setBank(b => ({ ...b, bankName: e.target.value }))} maxLength={80} placeholder="vd: Vietcombank" /></div>
            <div><label className={label} htmlFor="st_so_tai_khoan">Số tài khoản</label><input id="st_so_tai_khoan" className={`${input} font-mono`} value={bank.accountNumber} onChange={e => setBank(b => ({ ...b, accountNumber: e.target.value }))} maxLength={40} /></div>
            <div className="sm:col-span-2"><label className={label} htmlFor="st_ten_chu_tai_khoan">Tên chủ tài khoản</label><input id="st_ten_chu_tai_khoan" className={input} value={bank.accountName} onChange={e => setBank(b => ({ ...b, accountName: e.target.value }))} maxLength={80} /></div>
            <div className="sm:col-span-2"><label className={label} htmlFor="st_ghi_chu_cho_khach">Ghi chú cho khách</label><input id="st_ghi_chu_cho_khach" className={input} value={bank.note} onChange={e => setBank(b => ({ ...b, note: e.target.value }))} maxLength={300} placeholder="vd: Ghi đúng mã chuyển khoản, kích hoạt trong giờ hành chính" /></div>
          </div>
        </fieldset>

        {msg && <Msg {...msg} />}
        <button type="submit" disabled={busy} className={btn}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Lưu cấu hình</button>
      </form>

      <form onSubmit={changePw} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4" id="password_form">
        <h2 className="text-base font-black text-slate-900">Đổi mật khẩu quản trị</h2>
        <div><label className={label} htmlFor="st_mat_khau_hien_tai">Mật khẩu hiện tại</label><input id="st_mat_khau_hien_tai" type="password" className={input} value={pw.currentPassword} onChange={e => setPw(p => ({ ...p, currentPassword: e.target.value }))} autoComplete="current-password" required /></div>
        <div><label className={label} htmlFor="st_mat_khau_moi">Mật khẩu mới</label><input id="st_mat_khau_moi" type="password" className={input} value={pw.newPassword} onChange={e => setPw(p => ({ ...p, newPassword: e.target.value }))} autoComplete="new-password" required /><p className="text-xs text-slate-500 mt-1">Từ 10 đến 72 ký tự, có cả chữ và số.</p></div>
        <div><label className={label} htmlFor="st_nhap_lai_mat_khau_moi">Nhập lại mật khẩu mới</label><input id="st_nhap_lai_mat_khau_moi" type="password" className={input} value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} autoComplete="new-password" required /></div>
        {pwMsg && <Msg {...pwMsg} />}
        <button type="submit" disabled={pwBusy} className={btn}>{pwBusy && <Loader2 className="w-4 h-4 animate-spin" />} Đổi mật khẩu</button>
      </form>
    </div>
  );
}
