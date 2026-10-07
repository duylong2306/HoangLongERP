import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, AlertCircle, CheckCircle2, KeyRound, Lock, Unlock } from 'lucide-react';
import { platformCall, setPlatformToken } from './platformApi';
import { formatDateTime } from './format';

// TAB "TÀI KHOẢN" — (1) mọi quản trị viên: đổi mật khẩu của chính mình; (2) CHỦ nền tảng: tạo / khóa / đặt lại mật khẩu
// cho các quản trị viên khác (nhiều người cùng dùng trang quản trị). Quyền thật kiểm tra ở máy chủ (api/platform.ts).
// ⚠️ Chữ trắng dùng `text-[#ffffff]` (không dùng `text-white`): src/index.css ghi đè mọi `.text-white` thành xám đậm.
interface Account { id: string; username: string; name: string; active: boolean; isOwner: boolean; lastLoginAt: string | null; createdAt: string }

const btn = 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-[#ffffff]';
const btnSm = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-60';
const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const label = 'block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1';

function Msg({ ok, text }: { ok: boolean; text: string }) {
  return ok
    ? <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2 text-sm" role="status"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> {text}</div>
    : <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-sm" role="alert"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {text}</div>;
}

// ─── Đổi mật khẩu của tôi ────────────────────────────────────────────────────────────────────────
function ChangePasswordForm() {
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (pw.newPassword !== pw.confirm) { setMsg({ ok: false, text: 'Hai lần nhập mật khẩu mới không khớp.' }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await platformCall<{ token?: string }>('password.change', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      // Đổi mật khẩu đã thu hồi mọi token cũ → lưu token mới máy chủ trả về để phiên này không bị đá ra.
      if (r?.token) setPlatformToken(r.token);
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      setMsg({ ok: true, text: 'Đã đổi mật khẩu.' });
    } catch (err: any) { setMsg({ ok: false, text: err.message }); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4" id="password_form">
      <h2 className="text-base font-black text-slate-900">Đổi mật khẩu của tôi</h2>
      <div><label className={label} htmlFor="st_mat_khau_hien_tai">Mật khẩu hiện tại</label><input id="st_mat_khau_hien_tai" type="password" className={input} value={pw.currentPassword} onChange={e => setPw(p => ({ ...p, currentPassword: e.target.value }))} autoComplete="current-password" required /></div>
      <div><label className={label} htmlFor="st_mat_khau_moi">Mật khẩu mới</label><input id="st_mat_khau_moi" type="password" className={input} value={pw.newPassword} onChange={e => setPw(p => ({ ...p, newPassword: e.target.value }))} autoComplete="new-password" required /><p className="text-xs text-slate-500 mt-1">Từ 10 đến 72 ký tự, có cả chữ và số.</p></div>
      <div><label className={label} htmlFor="st_nhap_lai_mat_khau_moi">Nhập lại mật khẩu mới</label><input id="st_nhap_lai_mat_khau_moi" type="password" className={input} value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} autoComplete="new-password" required /></div>
      {msg && <Msg {...msg} />}
      <button type="submit" disabled={busy} className={btn}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Đổi mật khẩu</button>
    </form>
  );
}

// ─── Quản lý tài khoản (chủ nền tảng) ────────────────────────────────────────────────────────────
function ManageAccounts({ myId }: { myId: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ username: '', name: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [resetFor, setResetFor] = useState<{ id: string; username: string; password: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try { setAccounts((await platformCall<{ accounts: Account[] }>('accounts.list')).accounts); }
    catch (e: any) { setLoadError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true); setNotice(null);
    try {
      await platformCall('accounts.create', form);
      setNotice({ ok: true, text: `Đã tạo tài khoản "${form.username.trim().toLowerCase()}". Hãy gửi mật khẩu cho họ qua kênh an toàn và nhắc đổi mật khẩu sau khi đăng nhập.` });
      setForm({ username: '', name: '', password: '' });
      await load();
    } catch (err: any) { setNotice({ ok: false, text: err.message }); } finally { setCreating(false); }
  };

  const toggleActive = async (a: Account) => {
    setBusyId(a.id); setNotice(null);
    try {
      await platformCall('accounts.update', { id: a.id, active: !a.active });
      setNotice({ ok: true, text: a.active ? `Đã khóa tài khoản "${a.username}" (phiên đang mở bị thu hồi ngay).` : `Đã mở khóa tài khoản "${a.username}".` });
      await load();
    } catch (err: any) { setNotice({ ok: false, text: err.message }); } finally { setBusyId(null); }
  };

  const doReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetFor) return;
    setBusyId(resetFor.id); setNotice(null);
    try {
      await platformCall('accounts.resetPassword', { id: resetFor.id, newPassword: resetFor.password });
      setNotice({ ok: true, text: `Đã đặt lại mật khẩu cho "${resetFor.username}" (phiên cũ của họ bị thu hồi).` });
      setResetFor(null);
    } catch (err: any) { setNotice({ ok: false, text: err.message }); } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={create} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4" id="account_create_form">
        <h2 className="text-base font-black text-slate-900">Thêm quản trị viên</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className={label} htmlFor="ac_ten_dang_nhap">Tên đăng nhập *</label><input id="ac_ten_dang_nhap" className={input} value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} autoCapitalize="none" spellCheck={false} placeholder="chữ thường, số, . _ -" required /></div>
          <div><label className={label} htmlFor="ac_ho_ten">Họ tên</label><input id="ac_ho_ten" className={input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={80} /></div>
          <div><label className={label} htmlFor="ac_mat_khau">Mật khẩu ban đầu *</label><input id="ac_mat_khau" type="password" className={input} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} autoComplete="new-password" required /></div>
        </div>
        <p className="text-xs text-slate-500">Mật khẩu từ 10 đến 72 ký tự, có cả chữ và số. Quản trị viên mới có đủ quyền như bạn, trừ quản lý tài khoản.</p>
        <button type="submit" disabled={creating} className={btn}>{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Tạo tài khoản</button>
      </form>

      {notice && <Msg {...notice} />}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <h2 className="text-base font-black text-slate-900 px-5 pt-5 pb-3">Danh sách quản trị viên</h2>
        {loading ? <div className="flex items-center gap-2 text-sm text-slate-500 px-5 pb-5"><Loader2 className="w-4 h-4 animate-spin" /> Đang tải...</div>
          : loadError ? <div className="px-5 pb-5"><Msg ok={false} text={loadError} /></div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
                  <th className="text-left px-5 py-2">Tên đăng nhập</th><th className="text-left px-3 py-2">Họ tên</th><th className="text-left px-3 py-2">Trạng thái</th>
                  <th className="text-left px-3 py-2">Đăng nhập gần nhất</th><th className="px-5 py-2" />
                </tr></thead>
                <tbody>
                  {accounts.map(a => (
                    <tr key={a.id} className="border-t border-slate-100">
                      <td className="px-5 py-2.5 font-mono">{a.username}{a.isOwner && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-300 font-sans">Chủ nền tảng</span>}</td>
                      <td className="px-3 py-2.5">{a.name}</td>
                      <td className="px-3 py-2.5">{a.active ? <span className="text-emerald-700 font-semibold">Đang hoạt động</span> : <span className="text-rose-700 font-semibold">Đã khóa</span>}</td>
                      <td className="px-3 py-2.5 text-slate-600">{formatDateTime(a.lastLoginAt)}</td>
                      <td className="px-5 py-2.5 text-right whitespace-nowrap">
                        {/* Chủ nền tảng không bị khóa / đặt lại ở đây (tự đổi mật khẩu ở form phía trên) */}
                        {!a.isOwner && a.id !== myId && (
                          <span className="inline-flex gap-2">
                            <button onClick={() => { setNotice(null); setResetFor({ id: a.id, username: a.username, password: '' }); }} className={btnSm}><KeyRound className="w-3.5 h-3.5" /> Đặt lại mật khẩu</button>
                            <button onClick={() => toggleActive(a)} disabled={busyId === a.id} className={btnSm}>{a.active ? <><Lock className="w-3.5 h-3.5" /> Khóa</> : <><Unlock className="w-3.5 h-3.5" /> Mở khóa</>}</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {resetFor && (
        <form onSubmit={doReset} className="bg-white border border-amber-300 rounded-xl p-5 space-y-3" id="account_reset_form">
          <h2 className="text-base font-black text-slate-900">Đặt lại mật khẩu cho "{resetFor.username}"</h2>
          <div><label className={label} htmlFor="ac_mat_khau_moi">Mật khẩu mới</label><input id="ac_mat_khau_moi" type="password" className={input} value={resetFor.password} onChange={e => setResetFor(r => r && { ...r, password: e.target.value })} autoComplete="new-password" required /></div>
          <div className="flex gap-2">
            <button type="submit" disabled={busyId === resetFor.id} className={btn}>{busyId === resetFor.id && <Loader2 className="w-4 h-4 animate-spin" />} Lưu mật khẩu mới</button>
            <button type="button" onClick={() => setResetFor(null)} className={btnSm}>Hủy</button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function AccountsTab({ myId, isOwner }: { myId: string; isOwner: boolean }) {
  return (
    <div className="space-y-6">
      <div className="max-w-xl"><ChangePasswordForm /></div>
      {isOwner && <ManageAccounts myId={myId} />}
    </div>
  );
}
