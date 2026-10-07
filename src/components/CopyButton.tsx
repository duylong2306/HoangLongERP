import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check, AlertCircle } from 'lucide-react';

// NÚT SAO CHÉP NHANH dùng chung (mã chuyển khoản, số tài khoản, địa chỉ doanh nghiệp, khóa 2FA, mã khôi phục...).
// Khi bấm: sao chép vào bộ nhớ tạm rồi HIỆN THÔNG BÁO "Đã sao chép" (xanh, ~2 giây) ngay cạnh nút; không sao chép được
// (trình duyệt chặn) thì hiện "Không sao chép được" (đỏ) để người dùng biết mà chép tay — không im lặng.
//  • variant "icon": chỉ biểu tượng, chữ thông báo hiện thêm bên cạnh;
//  • variant "text": nút có chữ (children), đổi thành "Đã sao chép" trong lúc thông báo.
const SHOW_MS = 2000;

// Sao chép: ưu tiên Clipboard API (cần https), lỗi/không có thì dùng cách cũ (textarea + execCommand) — trả về đã chép được hay chưa.
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* thử cách cũ bên dưới */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

export default function CopyButton({ text, label, variant = 'icon', iconClass = 'w-4 h-4', className = '', children }: {
  text: string; label: string; variant?: 'icon' | 'text'; iconClass?: string; className?: string; children?: React.ReactNode;
}) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);   // dọn bộ hẹn giờ khi nút bị gỡ khỏi trang

  const onClick = async () => {
    const ok = await copyText(text);
    setState(ok ? 'ok' : 'fail');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), SHOW_MS);
  };

  const msg = state === 'ok' ? 'Đã sao chép' : state === 'fail' ? 'Không sao chép được' : '';
  const tone = state === 'fail' ? 'text-rose-600' : 'text-emerald-600';

  if (variant === 'text') {
    return (
      <>
        <button type="button" onClick={onClick} className={`${className} ${state === 'ok' ? '!border-emerald-400 !text-emerald-700' : ''}`}>
          {state === 'ok' ? <Check className="w-3.5 h-3.5" aria-hidden /> : state === 'fail' ? <AlertCircle className="w-3.5 h-3.5" aria-hidden /> : <Copy className="w-3.5 h-3.5" aria-hidden />}
          {' '}{state === 'idle' ? children : msg}
        </button>
        <span className="sr-only" role="status" aria-live="polite">{msg}</span>
      </>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      <button type="button" onClick={onClick} title={`Sao chép ${label}`} aria-label={`Sao chép ${label}`} className={`${className || 'text-slate-400 hover:text-slate-700'} ${state === 'ok' ? '!text-emerald-600' : ''}`}>
        {state === 'ok' ? <Check className={iconClass} aria-hidden /> : <Copy className={iconClass} aria-hidden />}
      </button>
      {/* Thông báo cạnh nút (aria-live để trình đọc màn hình cũng đọc được) */}
      <span role="status" aria-live="polite" className={`text-xs font-semibold whitespace-nowrap ${tone}`}>{msg}</span>
    </span>
  );
}
