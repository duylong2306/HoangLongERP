import { useState } from 'react';
import { X, KeyRound, Copy, Check, ShieldAlert } from 'lucide-react';
import { requestAdminPasswordReset, type ResetResult } from '../lib/adminResetPassword';

// Hộp thoại QUẢN TRỊ VIÊN ĐẶT LẠI MẬT KHẨU: xác nhận → máy chủ sinh mật khẩu tạm → hiện MỘT LẦN kèm nút sao chép.
// Người bị đặt lại bị đăng xuất mọi máy và phải đổi mật khẩu ở lần đăng nhập kế tiếp.
interface Props { employee: { id: string; name: string; username?: string }; onClose: () => void; fetcher?: typeof requestAdminPasswordReset }

export default function ResetPasswordDialog({ employee, onClose, fetcher = requestAdminPasswordReset }: Props) {
  const [step, setStep] = useState<'confirm' | 'busy' | 'done'>('confirm');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ResetResult | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async () => {
    setStep('busy'); setError('');
    try { setResult(await fetcher(employee.id)); setStep('done'); }
    catch (e: any) { setError(e?.message || 'Không đặt lại được mật khẩu.'); setStep('confirm'); }
  };
  const copy = async () => {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.tempPassword); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* người dùng tự chép */ }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-label="Đặt lại mật khẩu" data-testid="reset-pw-dialog" onClick={() => step !== 'busy' && step !== 'done' && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl text-slate-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <b className="flex items-center gap-2 text-[15px]"><KeyRound className="w-5 h-5 text-blue-600" />Đặt lại mật khẩu</b>
          {step !== 'busy' && <button type="button" onClick={onClose} aria-label="Đóng" className="cursor-pointer"><X className="w-5 h-5" /></button>}
        </div>
        {step !== 'done' ? (
          <div className="p-4 space-y-3 text-[13px]">
            <p>Đặt lại mật khẩu đăng nhập cho <b>{employee.name}</b>{employee.username ? <> (<span className="font-mono">{employee.username}</span>)</> : null}?</p>
            <ul className="list-disc pl-5 text-slate-600 space-y-1">
              <li>Hệ thống tạo <b>mật khẩu tạm ngẫu nhiên</b> và chỉ hiện <b>một lần</b>.</li>
              <li>Họ bị <b>đăng xuất khỏi mọi thiết bị</b> và <b>phải đổi mật khẩu</b> khi đăng nhập lại.</li>
            </ul>
            {error && <p className="text-rose-600 font-semibold" role="alert" data-testid="reset-pw-error">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} disabled={step === 'busy'} className="px-4 py-2 rounded-lg bg-slate-100 font-bold cursor-pointer disabled:opacity-50">Hủy</button>
              <button type="button" onClick={run} disabled={step === 'busy'} data-testid="reset-pw-confirm" className="px-4 py-2 rounded-lg bg-blue-600 font-bold cursor-pointer disabled:opacity-60" style={{ color: '#ffffff' }}>{step === 'busy' ? 'Đang đặt lại…' : 'Đặt lại mật khẩu'}</button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3 text-[13px]">
            <p>Đã đặt lại mật khẩu cho <b>{result?.employeeName || employee.name}</b>. Gửi mật khẩu tạm này cho họ:</p>
            <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
              <code className="flex-1 text-[18px] font-bold tracking-wider select-all" data-testid="reset-pw-temp">{result?.tempPassword}</code>
              <button type="button" onClick={copy} className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 font-bold flex items-center gap-1.5 cursor-pointer" data-testid="reset-pw-copy">{copied ? <><Check className="w-4 h-4 text-emerald-600" />Đã chép</> : <><Copy className="w-4 h-4" />Sao chép</>}</button>
            </div>
            <p className="flex gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5"><ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" /><span>Mật khẩu này <b>không hiện lại</b> sau khi đóng hộp thoại. {result?.forced === false ? 'Lưu ý: hệ thống chưa bật được chế độ "bắt đổi mật khẩu" cho tài khoản này.' : 'Họ sẽ được yêu cầu tự đổi mật khẩu khi đăng nhập.'}</span></p>
            <div className="flex justify-end"><button type="button" onClick={onClose} data-testid="reset-pw-close" className="px-4 py-2 rounded-lg bg-blue-600 font-bold cursor-pointer" style={{ color: '#ffffff' }}>Xong</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
