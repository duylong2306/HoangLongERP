import React, { useState } from 'react';
import { Lock, User, Loader2, AlertCircle, ShieldCheck, KeyRound } from 'lucide-react';
import { platformCall, setPlatformToken, type PlatformAdmin } from './platformApi';

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
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang kiểm tra...</> : 'Xác nhận'}
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

        {error && (
          <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2.5 text-sm" role="alert">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-[#ffffff] font-bold py-3 rounded-lg transition-colors">
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang đăng nhập...</> : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}
