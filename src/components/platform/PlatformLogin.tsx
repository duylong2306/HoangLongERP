import React, { useState } from 'react';
import { Lock, User, AlertCircle, ShieldCheck, KeyRound, CheckCircle2 } from 'lucide-react';
import { platformCall, setPlatformToken, type PlatformAdmin } from './platformApi';
import MiniLoader from '../MiniLoader';

// ĐĂNG NHẬP TRANG QUẢN TRỊ NỀN TẢNG — tài khoản riêng (không phải nhân viên của doanh nghiệp nào).
// Có 2 bước: (1) tên + mật khẩu; (2) nếu tài khoản bật XÁC THỰC HAI LỚP → nhập mã 6 số từ Google Authenticator (hoặc 1 mã khôi phục).
// Máy chủ chỉ cấp phiên sau bước 2; ở giữa chỉ có "thẻ thử thách" sống 5 phút (không dùng được để gọi API).
// ⚠️ Chữ trắng dùng `text-[#ffffff]` (không dùng `text-white`): src/index.css ghi đè mọi `.text-white` thành xám đậm.
export default function PlatformLogin({ onLoggedIn }: { onLoggedIn: (admin: PlatformAdmin) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);   // có = đang ở bước nhập mã 2FA
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  // Quên mật khẩu: 'forgot' = nhập tên/email để nhận liên kết; 'reset' = đã bấm liên kết trong thư (?reset=MÃ) → nhập mật khẩu mới.
  // Mã lấy từ địa chỉ rồi XÓA khỏi thanh địa chỉ ngay (không để lại trong lịch sử/ảnh chụp màn hình).
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>(() => {
    try { return new URLSearchParams(window.location.search).get('reset') ? 'reset' : 'login'; } catch { return 'login'; }
  });
  const [resetToken] = useState<string>(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('reset') || '';
      if (t) window.history.replaceState(null, '', window.location.pathname);
      return t;
    } catch { return ''; }
  });
  const [identifier, setIdentifier] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [info, setInfo] = useState<string | null>(null);   // thông báo thành công (đã gửi thư / đã đổi mật khẩu)

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setInfo(null);
    try {
      const r = await platformCall<{ message?: string }>('password.forgot', { identifier });
      setInfo(r.message || 'Nếu tài khoản tồn tại và đã có email, liên kết đặt lại mật khẩu vừa được gửi.');
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (newPw !== newPw2) { setError('Hai lần nhập mật khẩu mới không khớp.'); return; }
    setBusy(true); setError(null);
    try {
      await platformCall('password.reset', { token: resetToken, newPassword: newPw });
      setNewPw(''); setNewPw2(''); setMode('login');
      setInfo('Đã đổi mật khẩu. Hãy đăng nhập bằng mật khẩu mới.');
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const r = await platformCall<{ token?: string; admin?: PlatformAdmin; needTotp?: boolean; challenge?: string }>('login', { username, password });
      if (r.needTotp && r.challenge) { setChallenge(r.challenge); setPassword(''); return; }   // sang bước nhập mã 2FA
      setPlatformToken(r.token!);
      onLoggedIn(r.admin!);
    } catch (err: any) {
      setError(err.message);
      setPassword('');
    } finally { setBusy(false); }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !challenge) return;
    setBusy(true); setError(null);
    try {
      const r = await platformCall<{ token: string; admin: PlatformAdmin }>('login.totp', { challenge, ...(useRecovery ? { recoveryCode: code } : { code }) });
      setPlatformToken(r.token);
      onLoggedIn(r.admin);
    } catch (err: any) {
      setError(err.message); setCode('');
      // Thẻ hết hạn (5 phút) hoặc bị vô hiệu → quay lại bước mật khẩu
      if (/hết hạn|không còn hiệu lực/.test(err.message)) setChallenge(null);
    } finally { setBusy(false); }
  };

  const fieldInput = 'w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
  const errBox = error && (
    <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2.5 text-sm" role="alert">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
    </div>
  );
  const infoBox = info && (
    <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2.5 text-sm" role="status">
      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> <span>{info}</span>
    </div>
  );

  // ── Quên mật khẩu: nhập tên đăng nhập hoặc email ──
  if (mode === 'forgot') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <form onSubmit={submitForgot} className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-lg p-6 sm:p-8 space-y-5" id="platform_forgot_form">
          <div className="text-center space-y-2">
            <img src="/lolo-icon-192.png" alt="LoLo" className="w-14 h-14 rounded-xl mx-auto shadow" />
            <h1 className="text-lg font-black text-slate-900">Quên mật khẩu</h1>
            <p className="text-sm text-slate-600">Nhập tên đăng nhập hoặc email. Chúng tôi sẽ gửi liên kết đặt lại mật khẩu về email của tài khoản.</p>
          </div>
          <div className="space-y-1">
            <label htmlFor="pf_forgot" className="block text-xs font-bold text-slate-600 uppercase tracking-wide">Tên đăng nhập hoặc email</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input id="pf_forgot" className={fieldInput} value={identifier} onChange={e => setIdentifier(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus required />
            </div>
          </div>
          {errBox}{infoBox}
          <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-[#ffffff] font-bold py-3 rounded-lg transition-colors">
            {busy ? <><MiniLoader size={16} /> Đang gửi...</> : 'Gửi liên kết đặt lại'}
          </button>
          <button type="button" onClick={() => { setMode('login'); setError(null); setInfo(null); }} className="w-full text-xs font-semibold text-slate-500 hover:underline">Quay lại đăng nhập</button>
        </form>
      </div>
    );
  }

  // ── Đặt mật khẩu mới (đã bấm liên kết trong thư) ──
  if (mode === 'reset') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <form onSubmit={submitReset} className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-lg p-6 sm:p-8 space-y-5" id="platform_reset_form">
          <div className="text-center space-y-2">
            <img src="/lolo-icon-192.png" alt="LoLo" className="w-14 h-14 rounded-xl mx-auto shadow" />
            <h1 className="text-lg font-black text-slate-900">Đặt mật khẩu mới</h1>
            <p className="text-sm text-slate-600">Từ 10 đến 72 ký tự, có cả chữ và số. Đổi xong, mọi phiên đang đăng nhập sẽ bị đăng xuất.</p>
          </div>
          <div className="space-y-1">
            <label htmlFor="pf_new" className="block text-xs font-bold text-slate-600 uppercase tracking-wide">Mật khẩu mới</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input id="pf_new" type="password" className={fieldInput} value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" autoFocus required />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="pf_new2" className="block text-xs font-bold text-slate-600 uppercase tracking-wide">Nhập lại mật khẩu mới</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input id="pf_new2" type="password" className={fieldInput} value={newPw2} onChange={e => setNewPw2(e.target.value)} autoComplete="new-password" required />
            </div>
          </div>
          {errBox}
          <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-[#ffffff] font-bold py-3 rounded-lg transition-colors">
            {busy ? <><MiniLoader size={16} /> Đang lưu...</> : 'Đổi mật khẩu'}
          </button>
          <button type="button" onClick={() => { setMode('forgot'); setError(null); setInfo(null); }} className="w-full text-xs font-semibold text-slate-500 hover:underline">Liên kết hết hạn? Yêu cầu liên kết mới</button>
        </form>
      </div>
    );
  }

  if (challenge) {
    const inputBase = 'w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <form onSubmit={submitCode} className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-lg p-6 sm:p-8 space-y-5" id="platform_totp_form">
          <div className="text-center space-y-2">
            <img src="/lolo-icon-192.png" alt="LoLo" className="w-14 h-14 rounded-xl mx-auto shadow" />
            <h1 className="text-lg font-black text-slate-900">Xác thực hai lớp</h1>
            <p className="text-sm text-slate-600">{useRecovery ? 'Nhập một mã khôi phục (mỗi mã chỉ dùng được 1 lần).' : 'Mở ứng dụng Google Authenticator và nhập mã 6 số của LoLo.'}</p>
          </div>
          <div className="space-y-1">
            <label htmlFor="pf_code" className="block text-xs font-bold text-slate-600 uppercase tracking-wide">{useRecovery ? 'Mã khôi phục' : 'Mã xác thực 6 số'}</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input id="pf_code" className={`${inputBase} font-mono tracking-widest`} value={code} onChange={e => setCode(e.target.value)} autoFocus autoComplete="one-time-code" inputMode={useRecovery ? 'text' : 'numeric'} maxLength={useRecovery ? 20 : 7} placeholder={useRecovery ? 'XXXX-XXXX-XX' : '123456'} required />
            </div>
          </div>
          {error && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2.5 text-sm" role="alert">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}
          <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-[#ffffff] font-bold py-3 rounded-lg transition-colors">
            {busy ? <><MiniLoader size={16} /> Đang kiểm tra...</> : 'Xác nhận'}
          </button>
          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={() => { setUseRecovery(v => !v); setCode(''); setError(null); }} className="font-semibold text-blue-700 hover:underline">{useRecovery ? 'Dùng mã từ ứng dụng' : 'Mất điện thoại? Dùng mã khôi phục'}</button>
            <button type="button" onClick={() => { setChallenge(null); setCode(''); setError(null); setUseRecovery(false); }} className="font-semibold text-slate-500 hover:underline">Quay lại</button>
          </div>
        </form>
      </div>
    );
  }

  const inputCls = 'w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <form onSubmit={submit} className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-lg p-6 sm:p-8 space-y-5" id="platform_login_form">
        <div className="text-center space-y-2">
          <img src="/lolo-icon-192.png" alt="LoLo" className="w-14 h-14 rounded-xl mx-auto shadow" />
          <h1 className="text-lg font-black text-slate-900">Quản trị nền tảng LoLo</h1>
          <p className="text-xs text-slate-500 inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Khu vực dành riêng cho quản trị viên</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="pf_user" className="block text-xs font-bold text-slate-600 uppercase tracking-wide">Tên đăng nhập</label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input id="pf_user" className={inputCls} value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor="pf_pass" className="block text-xs font-bold text-slate-600 uppercase tracking-wide">Mật khẩu</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input id="pf_pass" type="password" className={inputCls} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
        </div>

        {errBox}{infoBox}

        <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-[#ffffff] font-bold py-3 rounded-lg transition-colors">
          {busy ? <><MiniLoader size={16} /> Đang đăng nhập...</> : 'Đăng nhập'}
        </button>
        <button type="button" onClick={() => { setMode('forgot'); setIdentifier(username); setError(null); setInfo(null); }} className="w-full text-xs font-semibold text-blue-700 hover:underline" id="platform_forgot_link">Quên mật khẩu?</button>
      </form>
    </div>
  );
}
