import React, { useState } from 'react';
import { LogOut, ShieldAlert, CheckCircle2 } from 'lucide-react';
import SubscriptionPanel from './SubscriptionPanel';
import { clearStoredSession } from '../../lib/supabase';
import type { SubscriptionStatus } from '../../lib/subscriptionClient';

// TRANG GIA HẠN — hiện thay cho toàn bộ ERP khi doanh nghiệp HẾT HẠN (dùng thử 7 ngày hoặc gói đã hết).
// Người dùng đăng nhập được nhưng nhận "token khóa" (xem api/login.ts): token này KHÔNG đọc/ghi được dữ liệu ERP (kiểm soát ở
// tầng cơ sở dữ liệu) — vì vậy ở đây không nạp ERP/Supabase, chỉ gọi api/subscription.ts. Dữ liệu doanh nghiệp được giữ nguyên.
// Sau khi quản trị nền tảng xác nhận thanh toán, người dùng ĐĂNG NHẬP LẠI để nhận token thường.
// ⚠️ Chữ trắng dùng `text-[#ffffff]` (không dùng `text-white`): src/index.css ghi đè mọi `.text-white` thành xám đậm.
export default function RenewalPage() {
  const [st, setSt] = useState<SubscriptionStatus | null>(null);
  const [version, setVersion] = useState(0);

  const relogin = () => { clearStoredSession(); window.location.reload(); };
  const activated = !!st && !st.subscription.locked;   // máy chủ báo công ty đã được gia hạn (token này vẫn là token khóa)
  const trialEnded = !!st && st.subscription.isTrial;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/lolo-icon-192.png" alt="LoLo" className="w-8 h-8 rounded-lg" />
            <span className="font-black text-slate-900 truncate">{st?.company.name || 'LoLo'}</span>
          </div>
          <button onClick={relogin} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-semibold">
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {activated ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3" id="renewal_activated">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div><div className="font-black text-emerald-900">Gói của doanh nghiệp đã được kích hoạt!</div><div className="text-sm text-emerald-800">Vui lòng đăng nhập lại để tiếp tục sử dụng hệ thống.</div></div>
            </div>
            <button onClick={relogin} className="bg-emerald-600 hover:bg-emerald-700 text-[#ffffff] font-bold px-5 py-2.5 rounded-lg">Đăng nhập lại</button>
          </div>
        ) : (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 flex items-start gap-3" id="renewal_expired">
            <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0" />
            <div>
              <div className="font-black text-rose-900">{trialEnded ? 'Thời gian dùng thử đã kết thúc' : 'Gói dịch vụ đã hết hạn'}</div>
              <div className="text-sm text-rose-800 mt-0.5">Chọn một gói bên dưới để tiếp tục sử dụng. <b>Dữ liệu của doanh nghiệp được giữ nguyên</b> và sẽ sử dụng lại được ngay sau khi gia hạn.</div>
            </div>
          </div>
        )}
        <SubscriptionPanel key={version} onStatus={setSt} />
        <div className="text-center"><button onClick={() => setVersion(v => v + 1)} className="text-sm font-semibold text-blue-700 hover:underline">Tôi đã thanh toán — kiểm tra lại</button></div>
      </main>
    </div>
  );
}
