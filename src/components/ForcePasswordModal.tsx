import React, { useState } from 'react';
import { KeyRound, Lock, Eye, EyeOff } from 'lucide-react';
import { useNotification } from '../context';
import { checkNewPassword, requestPasswordChange, setPasswordNotice, type PasswordNotice } from '../lib/passwordChange';
import MiniLoader from './MiniLoader';

// Hộp thoại đổi mật khẩu hiện ngay sau đăng nhập khi:
//  • notice = 'force'   — quản trị viên yêu cầu đổi (cờ must_change_password).
//  • notice = 'default' — đang dùng mật khẩu mặc định "123": nhắc đổi.
// Cả hai đều có nút "Để sau" (chủ dự án yêu cầu): bỏ qua trong phiên này, lần đăng nhập sau máy chủ báo lại nên hộp thoại hiện lại
// cho tới khi đổi xong (cờ chỉ được xóa khi đổi mật khẩu thành công qua api/change-password).
// Giao diện theo cùng tông tối (slate) với UserProfileModal.
interface Props {
  notice: PasswordNotice;
  onDone: () => void;   // đã đổi xong hoặc người dùng chọn "Để sau"
}

export default function ForcePasswordModal({ notice, onDone }: Props) {
  const { addToast } = useNotification();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bad = checkNewPassword(oldPw, newPw, confirmPw);
    if (bad) { setError(bad); return; }
    setBusy(true); setError(null);
    try {
      await requestPasswordChange(oldPw, newPw);
      addToast({ title: '✅ Thành công', message: 'Đã đổi mật khẩu.', type: 'success' });
      onDone();
    } catch (err: any) {
      setError(err?.message || 'Không đổi được mật khẩu.');
    } finally {
      setBusy(false);
    }
  };

  const later = () => { setPasswordNotice(null); onDone(); };

  const input = 'w-full bg-slate-950 border border-slate-800 rounded-lg p-2 pl-9 pr-3 text-xs text-white outline-none focus:border-slate-700 font-mono font-bold';
  return (
    <div className="fixed inset-0 z-[10001] bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Đổi mật khẩu">
      <form onSubmit={submit} className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-2xl">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center"><KeyRound className="w-5 h-5" /></div>
          <div>
            <h2 className="text-sm font-black text-white">{notice === 'force' ? 'Bạn cần đổi mật khẩu' : 'Nên đổi mật khẩu mặc định'}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {notice === 'force'
                ? 'Quản trị viên yêu cầu bạn đặt mật khẩu mới. Nếu chọn "Để sau", hộp thoại này sẽ hiện lại ở lần đăng nhập kế tiếp.'
                : 'Bạn đang dùng mật khẩu mặc định (123) nên rất dễ bị đoán. Hãy đặt mật khẩu riêng của bạn.'}
            </p>
          </div>
        </div>

        {([['Mật khẩu hiện tại', oldPw, setOldPw], ['Mật khẩu mới (từ 6 ký tự)', newPw, setNewPw], ['Nhập lại mật khẩu mới', confirmPw, setConfirmPw]] as const).map(([label, val, set]) => (
          <div key={label} className="space-y-1">
            <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</label>
            <div className="relative">
              <input type={show ? 'text' : 'password'} value={val} onChange={e => set(e.target.value)} className={input} aria-label={label} autoComplete="off" />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setShow(s => !s)} className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1.5">
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}{show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        </button>

        {error && <div role="alert" className="text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={later} disabled={busy} className="flex-1 py-2 rounded-lg text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-40">Để sau</button>
          <button type="submit" disabled={busy} className="flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center gap-2 disabled:opacity-40">
            {busy ? <MiniLoader size={16} /> : <Lock className="w-4 h-4" />}Đổi mật khẩu
          </button>
        </div>
      </form>
    </div>
  );
}
