import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { platformCall } from './platformApi';
import { formatDateTime } from './format';

// TAB "NHẬT KÝ" — lịch sử thao tác của các quản trị viên (ai đổi gì, lúc nào), chỉ lưu 30 ngày rồi tự xóa.
// Chỉ ĐỌC: không có chức năng sửa/xóa nhật ký. Chi tiết "trước → sau" mở bằng cách bấm vào dòng.
interface Log { id: string; createdAt: string; adminUsername: string; action: string; targetType: string | null; targetId: string | null; summary: string; detail: any }

// Nhãn tiếng Việt cho mã thao tác (mã lạ thì hiện nguyên mã)
const ACTION_LABEL: Record<string, string> = {
  login: 'Đăng nhập', logout: 'Đăng xuất', 'password.change': 'Đổi mật khẩu',
  'companies.create': 'Tạo doanh nghiệp', 'companies.update': 'Sửa doanh nghiệp',
  'plans.save': 'Lưu gói', 'telegram.test': 'Gửi thử Telegram', 'orders.confirm': 'Xác nhận đơn', 'orders.cancel': 'Hủy đơn', 'settings.save': 'Sửa cấu hình',
  'accounts.create': 'Tạo tài khoản', 'accounts.update': 'Sửa tài khoản', 'accounts.resetPassword': 'Đặt lại mật khẩu',
};
const input = 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function LogsTab() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [retention, setRetention] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [who, setWho] = useState('');
  const [action, setAction] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await platformCall<{ logs: Log[]; retentionDays: number }>('logs.list', { adminUsername: who, actionFilter: action });
      setLogs(r.logs); setRetention(r.retentionDays);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [who, action]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">Nhật ký thao tác</h2>
          <p className="text-xs text-slate-500">Lưu {retention} ngày gần nhất, bản ghi cũ hơn tự động bị xóa. Không có chức năng sửa hay xóa nhật ký. Mật khẩu không bao giờ được ghi.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="lg_nguoi">Lọc theo tên đăng nhập</label>
          <input id="lg_nguoi" className={input} placeholder="Tên đăng nhập" value={who} onChange={e => setWho(e.target.value)} autoCapitalize="none" />
          <label className="sr-only" htmlFor="lg_thao_tac">Lọc theo thao tác</label>
          <select id="lg_thao_tac" className={input} value={action} onChange={e => setAction(e.target.value)}>
            <option value="">Mọi thao tác</option>
            {Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-semibold"><RefreshCw className="w-4 h-4" /> Tải lại</button>
        </div>
      </div>

      {error && <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-sm" role="alert"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? <div className="flex items-center gap-2 text-sm text-slate-500 p-5"><Loader2 className="w-4 h-4 animate-spin" /> Đang tải...</div>
          : logs.length === 0 ? <p className="text-sm text-slate-500 p-5">Chưa có nhật ký nào.</p>
          : (
            <ul className="divide-y divide-slate-100">
              {logs.map(l => {
                const isOpen = open === l.id;
                const hasDetail = l.detail && Object.keys(l.detail).length > 0;
                return (
                  <li key={l.id} className="px-4 py-2.5 text-sm">
                    <button type="button" onClick={() => hasDetail && setOpen(isOpen ? null : l.id)} className="w-full text-left flex items-start gap-2" aria-expanded={hasDetail ? isOpen : undefined}>
                      <span className="mt-0.5 text-slate-400 w-4 shrink-0">{hasDetail ? (isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : null}</span>
                      <span className="flex-1 min-w-0">
                        <span className="font-semibold text-slate-900">{l.summary}</span>
                        <span className="block text-xs text-slate-500">{formatDateTime(l.createdAt)} · {l.adminUsername} · {ACTION_LABEL[l.action] || l.action}</span>
                      </span>
                    </button>
                    {isOpen && hasDetail && <pre className="mt-2 ml-6 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(l.detail, null, 2)}</pre>}
                  </li>
                );
              })}
            </ul>
          )}
      </div>
    </div>
  );
}
