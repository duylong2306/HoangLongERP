import React, { useState } from 'react';
import { Lock, User, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { platformCall, setPlatformToken } from './platformApi';

// ĐĂNG NHẬP TRANG QUẢN TRỊ NỀN TẢNG — tài khoản riêng (không phải nhân viên của doanh nghiệp nào).
// ⚠️ Chữ trắng dùng `text-[#ffffff]` (không dùng `text-white`): src/index.css ghi đè mọi `.text-white` thành xám đậm.
export default function PlatformLogin({ onLoggedIn }: { onLoggedIn: (admin: { id: string; username: string; name: string; isOwner: boolean }) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const r = await platformCall<{ token: string; admin: { id: string; username: string; name: string; isOwner: boolean } }>('login', { username, password });
      setPlatformToken(r.token);
      onLoggedIn(r.admin);
    } catch (err: any) {
      setError(err.message);
      setPassword('');
    } finally { setBusy(false); }
  };

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
