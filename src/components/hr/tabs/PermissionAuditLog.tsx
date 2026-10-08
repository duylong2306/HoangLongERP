// ─── Nhật ký thay đổi phân quyền ─────────────────────────────────────────────────────────────────────
// Danh sách các lần Lưu ở màn Phân Quyền Và Vai Trò: thời điểm, người sửa, vùng, tóm tắt; bấm để xem chi tiết "từ → sang".
// Dữ liệu từ bảng permission_audit_log (migration 20261019). Chưa chạy migration → báo rõ thay vì để trống khó hiểu.
import React from 'react';
import { History, ChevronDown, ChevronRight, RefreshCw, ArrowRight } from 'lucide-react';
import { loadPermissionAudit, AUDIT_AREA_LABELS, AuditRow } from '../../../lib/permissionAudit';

const dinhDang = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('vi-VN', { hour12: false });
};

export default function PermissionAuditLog() {
  const [state, setState] = React.useState<{ loading: boolean; rows: AuditRow[]; error?: string; notEnabled?: boolean }>({ loading: true, rows: [] });
  const [moRong, setMoRong] = React.useState<Set<string>>(new Set());

  const tai = React.useCallback(async () => {
    setState(s => ({ ...s, loading: true }));
    const r = await loadPermissionAudit(100);
    if (r.ok) setState({ loading: false, rows: r.rows || [] });
    else setState({ loading: false, rows: [], error: r.message, notEnabled: !!r.notEnabled });
  }, []);
  React.useEffect(() => { tai(); }, [tai]);

  const bat = (id: string) => setMoRong(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 text-left" data-testid="permission-audit-log">
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex items-start justify-between gap-3">
        <div>
          <h4 className="font-extrabold text-sm text-white flex items-center gap-2"><History className="w-4 h-4 text-violet-400" /> Nhật ký thay đổi phân quyền</h4>
          <p className="text-[10.5px] text-slate-400 mt-1">Mỗi lần bấm "Lưu thay đổi" ở các tab phân quyền được ghi lại: ai đổi, lúc nào, đổi gì (từ → sang). Hiển thị 100 lần gần nhất.</p>
        </div>
        <button type="button" onClick={tai} disabled={state.loading} className="px-3 py-1.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg cursor-pointer flex items-center gap-1 disabled:opacity-50">
          <RefreshCw className={`w-3 h-3 ${state.loading ? 'animate-spin' : ''}`} /> Tải lại
        </button>
      </div>

      {state.loading && <p className="text-xs text-slate-400">Đang tải nhật ký…</p>}

      {!state.loading && state.notEnabled && (
        <div role="alert" className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          Nhật ký chưa được bật cho hệ thống này. Quản trị cần chạy file <b>supabase/migrations/20261019_permission_audit_log.sql</b> trong Supabase SQL Editor.
          Việc lưu phân quyền vẫn hoạt động bình thường — chỉ là chưa có nhật ký.
        </div>
      )}
      {!state.loading && state.error && !state.notEnabled && (
        <div role="alert" className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">Không tải được nhật ký: {state.error}</div>
      )}
      {!state.loading && !state.error && state.rows.length === 0 && (
        <p className="text-xs text-slate-500 italic">Chưa có thay đổi nào được ghi lại. Nhật ký chỉ ghi từ lần Lưu tiếp theo.</p>
      )}

      <ul className="space-y-2">
        {state.rows.map(r => {
          const mo = moRong.has(r.id);
          return (
            <li key={r.id} className="bg-slate-950 border border-slate-850 rounded-xl">
              <button type="button" onClick={() => bat(r.id)} aria-expanded={mo} className="w-full text-left p-3 flex items-start gap-2 cursor-pointer">
                {mo ? <ChevronDown className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" /> : <ChevronRight className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" />}
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-200 font-bold">{r.summary || r.target || AUDIT_AREA_LABELS[r.area]}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {dinhDang(r.createdAt)} · <span className="text-slate-300">{r.actorName || r.actorId || 'Không rõ người sửa'}</span> · {AUDIT_AREA_LABELS[r.area] || r.area}
                  </div>
                </div>
              </button>
              {mo && (
                <ul className="px-4 pb-3 space-y-1">
                  {r.changes.map((c, i) => (
                    <li key={i} className="text-[10.5px] text-slate-300 flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{c.label}:</span>
                      <span className="text-rose-300">{c.from}</span><ArrowRight className="w-3 h-3 text-slate-500" /><span className="text-emerald-300">{c.to}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
