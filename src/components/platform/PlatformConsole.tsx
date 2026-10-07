import React, { useEffect, useState } from 'react';
import { Building2, Package, ReceiptText, Settings, Users, ScrollText, LogOut, Loader2 } from 'lucide-react';
import PlatformLogin from './PlatformLogin';
import CompaniesTab from './CompaniesTab';
import PlansTab from './PlansTab';
import OrdersTab from './OrdersTab';
import SettingsTab from './SettingsTab';
import AccountsTab from './AccountsTab';
import LogsTab from './LogsTab';
import { getPlatformToken, setPlatformToken, platformCall, UNAUTHORIZED_EVENT, type PlatformAdmin } from './platformApi';

// TRANG QUẢN TRỊ NỀN TẢNG (lolo.io.vn/quantri) — tách hẳn khỏi ERP của các doanh nghiệp.
// Được src/main.tsx chọn khi đường dẫn bắt đầu bằng /quantri ở địa chỉ gốc (không bao giờ ở subdomain doanh nghiệp).
// Quyền thật nằm ở máy chủ (api/platform.ts kiểm tra token + tài khoản mỗi lần); giao diện này chỉ là vỏ.
// ⚠️ Chữ trắng dùng `text-[#ffffff]` (không dùng `text-white`): src/index.css ghi đè mọi `.text-white` thành xám đậm.

type TabKey = 'companies' | 'orders' | 'plans' | 'settings' | 'accounts' | 'logs';
const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'companies', label: 'Doanh nghiệp', icon: Building2 },
  { key: 'orders', label: 'Đơn đăng ký', icon: ReceiptText },
  { key: 'plans', label: 'Gói dịch vụ', icon: Package },
  { key: 'settings', label: 'Cấu hình', icon: Settings },
  { key: 'accounts', label: 'Tài khoản', icon: Users },
  { key: 'logs', label: 'Nhật ký', icon: ScrollText },
];

export default function PlatformConsole() {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [checking, setChecking] = useState(!!getPlatformToken());   // có token cũ → hỏi máy chủ còn hiệu lực không
  const [tab, setTab] = useState<TabKey>('companies');

  // Khôi phục phiên: token còn trong sessionStorage thì xác nhận lại với máy chủ (token có thể đã hết hạn/bị khóa).
  useEffect(() => {
    if (!getPlatformToken()) return;
    platformCall<{ admin: PlatformAdmin }>('me')
      .then(r => setAdmin(r.admin))
      .catch(() => setPlatformToken(null))
      .finally(() => setChecking(false));
  }, []);

  // Bất kỳ lời gọi nào báo hết phiên (401) → về trang đăng nhập.
  useEffect(() => {
    const onExpired = () => setAdmin(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onExpired);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onExpired);
  }, []);

  // Đăng xuất thật: báo máy chủ thu hồi token (không chờ được thì vẫn xóa token phía trình duyệt).
  const logout = () => {
    platformCall('logout').catch(() => { /* bỏ qua: token cũng sẽ tự hết hạn */ });
    setPlatformToken(null); setAdmin(null);
  };

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!admin) return <PlatformLogin onLoggedIn={setAdmin} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/lolo-icon-192.png" alt="LoLo" className="w-8 h-8 rounded-lg" />
            <span className="font-black text-slate-900 truncate">Quản trị nền tảng LoLo</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600 hidden sm:inline">{admin.name || admin.username}</span>
            <button onClick={logout} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold">
              <LogOut className="w-4 h-4" /> Đăng xuất
            </button>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto" aria-label="Chức năng quản trị">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === 'companies' && <CompaniesTab />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'plans' && <PlansTab />}
        {tab === 'settings' && <SettingsTab />}
        {tab === 'accounts' && <AccountsTab myId={admin.id} isOwner={admin.isOwner} totpEnabled={admin.totpEnabled === true} onTotpChanged={(on) => setAdmin(a => (a ? { ...a, totpEnabled: on } : a))} />}
        {tab === 'logs' && <LogsTab />}
      </main>
    </div>
  );
}
