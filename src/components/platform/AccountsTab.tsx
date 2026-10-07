import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, AlertCircle, CheckCircle2, KeyRound, Lock, Unlock, ShieldCheck, ShieldOff, Copy } from 'lucide-react';
import { platformCall, setPlatformToken } from './platformApi';
import { formatDateTime } from './format';
import ConfirmDialog from './ConfirmDialog';

// TAB "TÀI KHOẢN" — (1) mọi quản trị viên: đổi mật khẩu của chính mình; (2) CHỦ nền tảng: tạo / khóa / đặt lại mật khẩu
// cho các quản trị viên khác (nhiều người cùng dùng trang quản trị). Quyền thật kiểm tra ở máy chủ (api/platform.ts).
// ⚠️ Chữ trắng dùng `text-[#ffffff]` (không dùng `text-white`): src/index.css ghi đè mọi `.text-white` thành xám đậm.
interface Account { id: string; username: string; name: string; active: boolean; isOwner: boolean; lastLoginAt: string | null; createdAt: string; totpEnabled?: boolean }

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

// ─── Xác thực hai lớp (Google Authenticator) của chính mình ─────────────────────────────────────
// Bật: (1) máy chủ tạo khóa → hiện mã QR + khóa nhập tay; (2) nhập mã 6 số đầu tiên để chứng minh đã quét đúng → mới bật, và hiện 8 mã
// khôi phục ĐÚNG MỘT LẦN (lưu lại để dùng khi mất điện thoại). Tắt: phải nhập mật khẩu + mã hiện tại.
type TotpStep = 'idle' | 'setup' | 'codes' | 'disable';
function TotpCard({ enabled, onChanged }: { enabled: boolean; onChanged: (on: boolean) => void }) {
  const [step, setStep] = useState<TotpStep>('idle');
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);          // đã tick "tôi đã lưu mã khôi phục"
  const [pw, setPw] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Vẽ mã QR từ địa chỉ otpauth (thư viện nạp khi cần). Lỗi vẽ → vẫn còn khóa nhập tay.
  useEffect(() => {
    let cancelled = false;
    setQr(null);
    if (!setup) return;
    import('qrcode').then(m => (m.default || m).toDataURL(setup.uri, { margin: 1, width: 220, errorCorrectionLevel: 'M' }))
      .then(url => { if (!cancelled) setQr(url); }).catch(() => { /* chỉ hiện khóa nhập tay */ });
    return () => { cancelled = true; };
  }, [setup]);

  const reset = () => { setStep('idle'); setSetup(null); setCode(''); setPw(''); setUseRecoveryCode(false); setRecovery([]); setSaved(false); };

  const start = async () => {
    setBusy(true); setMsg(null);
    try { setSetup(await platformCall<{ secret: string; uri: string }>('totp.setup')); setCode(''); setStep('setup'); }
    catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };
  const enable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const r = await platformCall<{ recoveryCodes: string[] }>('totp.enable', { code });
      setRecovery(r.recoveryCodes); setSaved(false); setStep('codes'); onChanged(true);
    } catch (err: any) { setMsg({ ok: false, text: err.message }); } finally { setBusy(false); }
  };
  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const r = await platformCall<{ token?: string }>('totp.disable', { password: pw, ...(useRecoveryCode ? { recoveryCode: code } : { code }) });
      if (r?.token) setPlatformToken(r.token);   // tắt 2FA thu hồi phiên cũ → dùng phiên mới để không bị đá ra
      reset(); onChanged(false); setMsg({ ok: true, text: 'Đã tắt xác thực hai lớp.' });
    } catch (err: any) { setMsg({ ok: false, text: err.message }); } finally { setBusy(false); }
  };
  const copy = (t: string) => { try { navigator.clipboard?.writeText(t).catch(() => {}); } catch { /* bỏ qua */ } };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4" id="totp_card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-900 inline-flex items-center gap-2">{enabled ? <ShieldCheck className="w-5 h-5 text-emerald-600" /> : <ShieldOff className="w-5 h-5 text-slate-400" />} Xác thực hai lớp (Google Authenticator)</h2>
          <p className="text-xs text-slate-500 mt-1">Đăng nhập phải nhập thêm mã 6 số đổi mỗi 30 giây từ điện thoại — lộ mật khẩu cũng không vào được.</p>
        </div>
        <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded border ${enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>{enabled ? 'Đang bật' : 'Chưa bật'}</span>
      </div>

      {msg && <Msg {...msg} />}

      {step === 'idle' && !enabled && (
        <button type="button" onClick={start} disabled={busy} className={btn}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Bật xác thực hai lớp</button>
      )}
      {step === 'idle' && enabled && (
        <button type="button" onClick={() => { setMsg(null); setStep('disable'); }} className={btnSm}>Tắt xác thực hai lớp</button>
      )}

      {step === 'setup' && setup && (
        <form onSubmit={enable} className="space-y-3" id="totp_setup_form">
          <ol className="text-sm text-slate-700 list-decimal pl-5 space-y-1">
            <li>Cài ứng dụng <b>Google Authenticator</b> (hoặc Microsoft Authenticator, Authy) trên điện thoại.</li>
            <li>Chọn <b>Thêm tài khoản → Quét mã QR</b> rồi quét mã bên dưới (hoặc nhập khóa bằng tay).</li>
            <li>Nhập mã 6 số đang hiện trong ứng dụng vào ô dưới và bấm <b>Xác nhận và bật</b>.</li>
          </ol>
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-[220px] h-[220px] bg-white border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden">
              {qr ? <img src={qr} alt="Mã QR để thêm tài khoản vào ứng dụng xác thực" className="w-full h-full" /> : <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wide">Khóa nhập tay</div>
              <div className="flex items-center gap-2"><code className="font-mono text-sm break-all bg-slate-50 border border-slate-200 rounded px-2 py-1" id="totp_secret_text">{setup.secret}</code>
                <button type="button" onClick={() => copy(setup.secret)} aria-label="Sao chép khóa" className="text-slate-400 hover:text-slate-700"><Copy className="w-4 h-4" /></button></div>
              <p className="text-xs text-slate-500">Khóa này chỉ hiện lúc thiết lập. Đừng chụp màn hình gửi cho ai.</p>
              <div><label className={label} htmlFor="totp_code">Mã 6 số trong ứng dụng</label>
                <input id="totp_code" className={`${input} font-mono tracking-widest max-w-[200px]`} value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" maxLength={7} autoComplete="one-time-code" placeholder="123456" required /></div>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={btn}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Xác nhận và bật</button>
            <button type="button" onClick={reset} className={btnSm}>Hủy</button>
          </div>
        </form>
      )}

      {step === 'codes' && (
        <div className="space-y-3" id="totp_recovery_box">
          <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-lg px-3 py-2.5 text-sm">
            <b>Đã bật xác thực hai lớp.</b> Hãy lưu <b>8 mã khôi phục</b> dưới đây ở nơi an toàn (trình quản lý mật khẩu, giấy cất kỹ). Khi mất điện thoại, mỗi mã dùng được <b>1 lần</b> để đăng nhập. Mã <b>chỉ hiện một lần này</b>.
          </div>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm" aria-label="Mã khôi phục">
            {recovery.map(c => <li key={c} className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-center">{c}</li>)}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => copy(recovery.join('\n'))} className={btnSm}><Copy className="w-3.5 h-3.5" /> Sao chép tất cả</button>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} /> Tôi đã lưu các mã khôi phục</label>
          </div>
          <button type="button" disabled={!saved} onClick={reset} className={btn}>Hoàn tất</button>
        </div>
      )}

      {step === 'disable' && (
        <form onSubmit={disable} className="space-y-3" id="totp_disable_form">
          <div><label className={label} htmlFor="totp_pw">Mật khẩu hiện tại</label><input id="totp_pw" type="password" className={`${input} max-w-sm`} value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" required /></div>
          <div><label className={label} htmlFor="totp_dcode">{useRecoveryCode ? 'Mã khôi phục' : 'Mã 6 số trong ứng dụng'}</label>
            <input id="totp_dcode" className={`${input} font-mono tracking-widest max-w-[240px]`} value={code} onChange={e => setCode(e.target.value)} maxLength={useRecoveryCode ? 20 : 7} autoComplete="one-time-code" required /></div>
          <button type="button" onClick={() => { setUseRecoveryCode(v => !v); setCode(''); }} className="text-xs font-semibold text-blue-700 hover:underline">{useRecoveryCode ? 'Dùng mã từ ứng dụng' : 'Dùng mã khôi phục'}</button>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={`${btn} !bg-rose-600 hover:!bg-rose-700`}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Tắt xác thực hai lớp</button>
            <button type="button" onClick={reset} className={btnSm}>Hủy</button>
          </div>
        </form>
      )}
    </div>
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
  // Đặt lại 2FA của người khác (khi họ mất điện thoại + mã khôi phục): hỏi xác nhận bằng hộp trong trang
  const [resetTotpFor, setResetTotpFor] = useState<Account | null>(null);
  const [resetTotpError, setResetTotpError] = useState<string | null>(null);

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

  const doResetTotp = async () => {
    const a = resetTotpFor;
    if (!a) return;
    setBusyId(a.id); setResetTotpError(null);
    try {
      await platformCall('accounts.resetTotp', { id: a.id });
      setNotice({ ok: true, text: `Đã đặt lại xác thực hai lớp cho "${a.username}". Họ đăng nhập chỉ bằng mật khẩu và nên bật lại 2FA.` });
      setResetTotpFor(null); await load();
    } catch (err: any) { setResetTotpError(err.message); } finally { setBusyId(null); }
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
                  <th className="text-left px-5 py-2">Tên đăng nhập</th><th className="text-left px-3 py-2">Họ tên</th><th className="text-left px-3 py-2">Trạng thái</th><th className="text-left px-3 py-2">2FA</th>
                  <th className="text-left px-3 py-2">Đăng nhập gần nhất</th><th className="px-5 py-2" />
                </tr></thead>
                <tbody>
                  {accounts.map(a => (
                    <tr key={a.id} className="border-t border-slate-100">
                      <td className="px-5 py-2.5 font-mono">{a.username}{a.isOwner && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-300 font-sans">Chủ nền tảng</span>}</td>
                      <td className="px-3 py-2.5">{a.name}</td>
                      <td className="px-3 py-2.5">{a.active ? <span className="text-emerald-700 font-semibold">Đang hoạt động</span> : <span className="text-rose-700 font-semibold">Đã khóa</span>}</td>
                      <td className="px-3 py-2.5">{a.totpEnabled ? <span className="text-emerald-700 font-semibold">Đã bật</span> : <span className="text-slate-400">Chưa bật</span>}</td>
                      <td className="px-3 py-2.5 text-slate-600">{formatDateTime(a.lastLoginAt)}</td>
                      <td className="px-5 py-2.5 text-right whitespace-nowrap">
                        {/* Chủ nền tảng không bị khóa / đặt lại ở đây (tự đổi mật khẩu ở form phía trên) */}
                        {!a.isOwner && a.id !== myId && (
                          <span className="inline-flex gap-2">
                            {a.totpEnabled && <button onClick={() => { setResetTotpError(null); setResetTotpFor(a); }} className={btnSm}><ShieldOff className="w-3.5 h-3.5" /> Đặt lại 2FA</button>}
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

      {resetTotpFor && (
        <ConfirmDialog title={`Đặt lại 2FA của "${resetTotpFor.username}"?`} confirmLabel="Đặt lại 2FA" danger busy={busyId === resetTotpFor.id} error={resetTotpError} onConfirm={doResetTotp} onClose={() => setResetTotpFor(null)}>
          <p>Tài khoản này sẽ <b>không còn yêu cầu mã 6 số</b> khi đăng nhập và <b>mọi phiên đang mở của họ bị thu hồi</b>.</p>
          <p>Chỉ làm khi chính họ báo mất điện thoại <b>và</b> mã khôi phục. Hãy chắc chắn đang làm việc với đúng người đó.</p>
        </ConfirmDialog>
      )}

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

export default function AccountsTab({ myId, isOwner, totpEnabled, onTotpChanged }: { myId: string; isOwner: boolean; totpEnabled: boolean; onTotpChanged: (on: boolean) => void }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <ChangePasswordForm />
        <TotpCard enabled={totpEnabled} onChanged={onTotpChanged} />
      </div>
      {isOwner && <ManageAccounts myId={myId} />}
    </div>
  );
}
